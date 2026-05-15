import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import admin from "firebase-admin";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildDeliveredMessage } from "./src/lib/mealSms.js";
import { extractProviderMessageId, sendReslNaloSms } from "./scripts/sms-provider.js";

const DEFAULT_PROVIDER_URL = "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/";
const DEFAULT_SENDER_ID = "Mayrit";
const DEFAULT_SUPPORT_CONTACT = "0000000000";

let adminDb = null;

function cleanText(value) {
  return String(value || "").trim();
}

function jsonResponse(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 1024 * 1024) {
        rejectBody(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!raw.trim()) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch (error) {
        rejectBody(error);
      }
    });
    req.on("error", rejectBody);
  });
}

function getAdminDb() {
  if (adminDb) return adminDb;

  const serviceAccountPath = resolve(process.cwd(), "serviceAccountKey.json");
  if (!existsSync(serviceAccountPath)) {
    throw new Error("Missing serviceAccountKey.json in the project root.");
  }

  if (!admin.apps.length) {
    const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, "utf8"));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  }

  adminDb = admin.firestore();
  return adminDb;
}

async function resolvePatientContact(db, orderData) {
  const directPhone = cleanText(orderData?.phone);
  if (directPhone) {
    return {
      phone: directPhone,
      patientName: cleanText(orderData?.patientName),
    };
  }

  const patientId = cleanText(orderData?.patientId);
  if (!patientId) {
    return {
      phone: "",
      patientName: cleanText(orderData?.patientName),
    };
  }

  const patientSnap = await db.collection("patients").doc(patientId).get();
  if (!patientSnap.exists) {
    return {
      phone: "",
      patientName: cleanText(orderData?.patientName),
    };
  }

  const patientData = patientSnap.data() || {};
  return {
    phone: cleanText(patientData.phone),
    patientName: cleanText(orderData?.patientName) || cleanText(patientData.patientName),
  };
}

function smsDeliveryBridge(env) {
  return {
    name: "sms-delivery-bridge",
    configureServer(server) {
      server.middlewares.use("/api/sms/delivered", async (req, res, next) => {
        if (req.method !== "POST") {
          next();
          return;
        }

        try {
          const body = await readJsonBody(req);
          const orderId = cleanText(body.orderId);
          if (!orderId) {
            jsonResponse(res, 400, { error: "orderId is required." });
            return;
          }

          const db = getAdminDb();
          const orderRef = db.collection("wardMealOrders").doc(orderId);
          const now = admin.firestore.FieldValue.serverTimestamp();

          const claimedOrder = await db.runTransaction(async (transaction) => {
            const snap = await transaction.get(orderRef);
            if (!snap.exists) {
              return { found: false };
            }

            const data = snap.data() || {};
            const orderStatus = cleanText(data.status).toUpperCase();
            if (orderStatus !== "DELIVERED") {
              return { found: true, allowed: false, data };
            }

            const smsStatus = cleanText(data.smsDeliveredStatus).toUpperCase();
            if (smsStatus === "SENT") {
              return { found: true, alreadySent: true, data };
            }

            if (smsStatus === "PROCESSING") {
              return { found: true, processing: true, data };
            }

            transaction.update(orderRef, {
              smsDeliveredStatus: "PROCESSING",
              smsDeliveredStartedAt: now,
              smsDeliveredUpdatedAt: now,
              smsDeliveredError: null,
              smsDeliveredAttempts: admin.firestore.FieldValue.increment(1),
            });

            return { found: true, data };
          });

          if (!claimedOrder.found) {
            jsonResponse(res, 404, { error: "Order not found." });
            return;
          }

          if (claimedOrder.allowed === false) {
            jsonResponse(res, 400, { error: "Order must be marked DELIVERED before SMS is sent." });
            return;
          }

          if (claimedOrder.alreadySent) {
            jsonResponse(res, 200, {
              sent: true,
              alreadySent: true,
              orderId,
            });
            return;
          }

          if (claimedOrder.processing) {
            jsonResponse(res, 202, {
              sent: false,
              processing: true,
              orderId,
            });
            return;
          }

          const orderData = claimedOrder.data || {};
          const [settingsSnap, patientContact] = await Promise.all([
            db.doc("settings/mealOrdering").get(),
            resolvePatientContact(db, orderData),
          ]);

          const supportContactNumber = cleanText(
            settingsSnap.exists ? settingsSnap.data()?.supportContactNumber : ""
          ) || DEFAULT_SUPPORT_CONTACT;
          const phone = cleanText(patientContact.phone);
          const patientName = cleanText(patientContact.patientName) || cleanText(orderData.patientName);

          if (!phone) {
            await orderRef.update({
              smsDeliveredStatus: "FAILED",
              smsDeliveredUpdatedAt: now,
              smsDeliveredError: "Missing patient phone number.",
            });
            jsonResponse(res, 400, { error: "Missing patient phone number." });
            return;
          }

          const message = buildDeliveredMessage({
            patientName,
            supportContactNumber,
          });

          try {
            const providerResult = await sendReslNaloSms({
              providerUrl: env.providerUrl || DEFAULT_PROVIDER_URL,
              username: env.providerUsername,
              password: env.providerPassword || env.providerKey,
              msisdn: phone,
              message,
              senderId: env.senderId || DEFAULT_SENDER_ID,
              source: env.senderId || DEFAULT_SENDER_ID,
            });

            await orderRef.update({
              smsDeliveredStatus: "SENT",
              smsDeliveredAt: now,
              smsDeliveredUpdatedAt: now,
              smsDeliveredPhone: phone,
              smsDeliveredMessage: message,
              smsProviderMessageId: providerResult.messageId || extractProviderMessageId(providerResult.body),
              smsProviderResponse: providerResult.body,
              smsDeliveredError: null,
            });

            jsonResponse(res, 200, {
              sent: true,
              orderId,
            });
          } catch (error) {
            await orderRef.update({
              smsDeliveredStatus: "FAILED",
              smsDeliveredUpdatedAt: now,
              smsDeliveredError: cleanText(error.message).slice(0, 500),
            });

            jsonResponse(res, 502, {
              error: "Failed to send SMS.",
            });
          }
        } catch (error) {
          jsonResponse(res, 500, {
            error: cleanText(error.message) || "Unexpected SMS bridge error.",
          });
        }
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const smsEnv = {
    providerUrl: cleanText(env.SMS_PROVIDER_URL) || DEFAULT_PROVIDER_URL,
    providerUsername: cleanText(env.SMS_PROVIDER_USERNAME || env.SMS_PROVIDER_USER),
    providerPassword: cleanText(env.SMS_PROVIDER_PASSWORD) || cleanText(env.SMS_PROVIDER_KEY),
    providerKey: cleanText(env.SMS_PROVIDER_KEY),
    senderId: cleanText(env.SMS_SENDER_ID) || DEFAULT_SENDER_ID,
  };

  return {
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
    },
    plugins: [react(), tailwindcss(), smsDeliveryBridge(smsEnv)],
  };
});
