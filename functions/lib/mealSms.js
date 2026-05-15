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

