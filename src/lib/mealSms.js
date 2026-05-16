const SMS_DELIVERY_ENDPOINT = import.meta.env?.VITE_SMS_DELIVERY_ENDPOINT || "/api/sms/delivered";
const DEFAULT_SUPPORT_CONTACT = "0000000000";

function cleanText(value) {
  return String(value || "").trim();
}

export function buildDeliveredMessage({ patientName, supportContactNumber }) {
  const name = cleanText(patientName);
  const contact = cleanText(supportContactNumber) || DEFAULT_SUPPORT_CONTACT;
  const leadIn = name ? `Hello ${name},` : "Hello,";

  return `${leadIn} your meal from Mayrit Cuisines has been delivered. If you have any issue, please contact ${contact}.`;
}

function buildOrderIdPayload(orderOrDb, maybeOrder) {
  const order = maybeOrder ?? orderOrDb;
  const orderId = cleanText(order?.id ?? order?.orderId ?? order);

  if (!orderId) {
    throw new Error("Missing order id for delivered SMS request.");
  }

  return { orderId };
}

async function parseResponseBody(response) {
  const rawBody = await response.text();
  if (!rawBody) return null;

  try {
    return JSON.parse(rawBody);
  } catch {
    return rawBody;
  }
}

export async function sendDeliveredMealSms(orderOrDb, maybeOrder) {
  const payload = buildOrderIdPayload(orderOrDb, maybeOrder);

  const response = await fetch(SMS_DELIVERY_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(payload),
  });

  const body = await parseResponseBody(response);

  if (!response.ok) {
    const details = typeof body === "string" ? body : JSON.stringify(body || {});
    throw new Error(details || `SMS delivery request failed (${response.status})`);
  }

  return body || { sent: true, orderId: payload.orderId };
}

export const queueDeliveredMealSms = sendDeliveredMealSms;
