import admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import { buildDeliveredMessage } from "./lib/mealSms.js";
import { extractProviderMessageId, sendReslNaloSms } from "./lib/smsProvider.js";

const DEFAULT_SENDER_ID = "Mayrit";
const DEFAULT_SUPPORT_CONTACT = "0000000000";
const DEFAULT_PROVIDER_URL = "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/";

const smsProviderKey = defineSecret("SMS_PROVIDER_KEY");
const smsProviderUsername = defineSecret("SMS_PROVIDER_USERNAME");

setGlobalOptions({
  region: "us-central1",
  maxInstances: 10,
});

function cleanText(value) {
  return String(value || "").trim();
}

function jsonResponse(res, statusCode, payload) {
  res.status(statusCode).json(payload);
}

async function parseBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  const rawBody = req.rawBody?.toString("utf8") || "";
  if (!rawBody.trim()) return {};
  return JSON.parse(rawBody);
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

function getProviderUrl() {
  return cleanText(process.env.SMS_PROVIDER_URL) || DEFAULT_PROVIDER_URL;
}

function getProviderUsername() {
  return cleanText(smsProviderUsername.value() || process.env.SMS_PROVIDER_USERNAME || process.env.SMS_PROVIDER_USER);
}

function getSenderId() {
  return process.env.SMS_SENDER_ID || DEFAULT_SENDER_ID;
}

function getProviderPassword() {
  return cleanText(process.env.SMS_PROVIDER_PASSWORD) || cleanText(smsProviderKey.value());
}

function getDb() {
  if (!admin.apps.length) {
    admin.initializeApp();
  }

  return admin.firestore();
}

export const sendDeliveredMealSms = onRequest(
  { secrets: [smsProviderKey, smsProviderUsername], cors: true },
  async (req, res) => {
    if (req.method !== "POST") {
      jsonResponse(res, 405, { error: "Method not allowed." });
      return;
    }

    try {
      const db = getDb();
      const body = await parseBody(req);
      const orderId = cleanText(body.orderId);

      if (!orderId) {
        jsonResponse(res, 400, { error: "orderId is required." });
        return;
      }

      const orderRef = db.collection("wardMealOrders").doc(orderId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        jsonResponse(res, 404, { error: "Order not found." });
        return;
      }

      const orderData = orderSnap.data() || {};
      if (cleanText(orderData.status).toUpperCase() !== "DELIVERED") {
        jsonResponse(res, 400, { error: "Order must be marked DELIVERED before SMS is sent." });
        return;
      }

      const currentSmsStatus = cleanText(orderData.smsDeliveredStatus).toUpperCase();
      if (currentSmsStatus === "SENT") {
        jsonResponse(res, 200, { sent: true, alreadySent: true, orderId });
        return;
      }

      if (currentSmsStatus === "PROCESSING") {
        jsonResponse(res, 202, { sent: false, processing: true, orderId });
        return;
      }

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
          smsDeliveredUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          smsDeliveredError: "Missing patient phone number.",
        });
        jsonResponse(res, 400, { error: "Missing patient phone number." });
        return;
      }

      await orderRef.update({
        smsDeliveredStatus: "PROCESSING",
        smsDeliveredStartedAt: admin.firestore.FieldValue.serverTimestamp(),
        smsDeliveredUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
        smsDeliveredError: null,
        smsDeliveredAttempts: admin.firestore.FieldValue.increment(1),
      });

      const message = buildDeliveredMessage({
        patientName,
        supportContactNumber,
      });

      try {
        const providerResult = await sendReslNaloSms({
          providerUrl: getProviderUrl(),
          username: getProviderUsername(),
          password: getProviderPassword(),
          msisdn: phone,
          message,
          senderId: getSenderId(),
          source: getSenderId(),
        });

        await orderRef.update({
          smsDeliveredStatus: "SENT",
          smsDeliveredAt: admin.firestore.FieldValue.serverTimestamp(),
          smsDeliveredUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          smsDeliveredPhone: phone,
          smsDeliveredMessage: message,
          smsProviderMessageId: providerResult.messageId || extractProviderMessageId(providerResult.body),
          smsProviderResponse: providerResult.body,
          smsDeliveredError: null,
        });

        jsonResponse(res, 200, { sent: true, orderId });
      } catch (error) {
        await orderRef.update({
          smsDeliveredStatus: "FAILED",
          smsDeliveredUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
          smsDeliveredError: cleanText(error.message).slice(0, 500),
        });

        jsonResponse(res, 502, {
          error: "Failed to send SMS.",
        });
      }
    } catch (error) {
      jsonResponse(res, 500, {
        error: cleanText(error.message) || "Unexpected SMS delivery error.",
      });
    }
  }
);
