const DEFAULT_COUNTRY_CODE = "233";
const DEFAULT_SENDER_ID = "Mayrit";
const DEFAULT_PUBLIC_PROVIDER_URL = "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/";
const DEFAULT_SMS_TYPE = "0";
const DEFAULT_DLR = "1";
const LEGACY_LOCAL_HOSTS = new Set(["127.0.0.1", "localhost"]);

function cleanText(value) {
  return String(value || "").trim();
}

function normalizeSingleMsisdn(value) {
  const raw = cleanText(value);
  if (!raw) return "";

  const cleaned = raw.replace(/[^\d+]/g, "");
  if (!cleaned) return "";

  const digitsOnly = cleaned.startsWith("+") ? cleaned.slice(1) : cleaned;
  if (!digitsOnly) return "";

  if (digitsOnly.startsWith(DEFAULT_COUNTRY_CODE)) {
    return digitsOnly;
  }

  if (digitsOnly.startsWith("0") && digitsOnly.length >= 10) {
    return `${DEFAULT_COUNTRY_CODE}${digitsOnly.slice(1)}`;
  }

  if (/^\d{9}$/.test(digitsOnly)) {
    return `${DEFAULT_COUNTRY_CODE}${digitsOnly}`;
  }

  return digitsOnly;
}

export function normalizeRecipientMsisdn(value) {
  return normalizeSingleMsisdn(value);
}

export function normalizeRecipientList(value) {
  return cleanText(value)
    .split(/[,;\n]/)
    .map((item) => normalizeRecipientMsisdn(item))
    .filter(Boolean)
    .join(",");
}

export function buildReslNaloPayload({ apiKey, msisdn, message, senderId = DEFAULT_SENDER_ID }) {
  const key = cleanText(apiKey);
  const recipients = normalizeRecipientList(msisdn);
  const body = cleanText(message);
  const sender = cleanText(senderId) || DEFAULT_SENDER_ID;

  if (!key) {
    throw new Error("SMS provider key is required.");
  }

  if (!recipients) {
    throw new Error("At least one recipient phone number is required.");
  }

  if (!body) {
    throw new Error("SMS message is required.");
  }

  return {
    key,
    msisdn: recipients,
    message: body,
    sender_id: sender,
  };
}

function isLegacyLocalProviderUrl(providerUrl) {
  try {
    const url = new URL(cleanText(providerUrl));
    return LEGACY_LOCAL_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

function extractProviderMessageIdFromText(value) {
  const raw = cleanText(value);
  if (!raw) return "";

  if (raw.includes("|")) {
    const segments = raw.split("|").map(cleanText).filter(Boolean);
    if (segments.length) {
      return segments[segments.length - 1];
    }
  }

  return raw;
}

export function extractProviderMessageId(body) {
  if (!body) return "";

  if (typeof body === "string") {
    return extractProviderMessageIdFromText(body);
  }

  if (typeof body !== "object") {
    return "";
  }

  return extractProviderMessageIdFromText(
    body.message_id ??
      body.messageId ??
      body.id ??
      body.reference ??
      body.reference_id ??
      body.referenceId ??
      body.tracking_id ??
      body.trackingId
  );
}

export function buildReslNaloRequestUrl({
  providerUrl = DEFAULT_PUBLIC_PROVIDER_URL,
  username,
  password,
  msisdn,
  message,
  senderId = DEFAULT_SENDER_ID,
  type = DEFAULT_SMS_TYPE,
  dlr = DEFAULT_DLR,
}) {
  const url = new URL(cleanText(providerUrl) || DEFAULT_PUBLIC_PROVIDER_URL);
  const authUsername = cleanText(username);
  const authPassword = cleanText(password);
  const recipients = normalizeRecipientList(msisdn);
  const body = cleanText(message);
  const source = cleanText(senderId) || DEFAULT_SENDER_ID;

  if (!authUsername) {
    throw new Error("SMS provider username is required.");
  }

  if (!authPassword) {
    throw new Error("SMS provider password is required.");
  }

  if (!recipients) {
    throw new Error("At least one recipient phone number is required.");
  }

  if (!body) {
    throw new Error("SMS message is required.");
  }

  url.search = "";
  url.searchParams.set("username", authUsername);
  url.searchParams.set("password", authPassword);
  url.searchParams.set("type", cleanText(type) || DEFAULT_SMS_TYPE);
  url.searchParams.set("destination", recipients);
  url.searchParams.set("dlr", cleanText(dlr) || DEFAULT_DLR);
  url.searchParams.set("source", source);
  url.searchParams.set("message", body);

  return url.toString();
}

function isNaloSuccessBody(body) {
  if (!body) return true;

  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed.startsWith("1701|")) return true;
    const pipeCode = trimmed.split("|")[0];
    if (pipeCode && pipeCode !== "1701") return false;
    return true;
  }

  if (typeof body === "object") {
    const code = body.code ?? body.status ?? body.statusCode ?? body.status_code;
    if (code !== undefined && code !== null && String(code) !== "1701") return false;
    if (body.error) return false;
    if (body.success === false) return false;
  }

  return true;
}

export async function sendReslNaloSms({
  providerUrl,
  username,
  password,
  apiKey,
  msisdn,
  destination,
  message,
  senderId = DEFAULT_SENDER_ID,
  source,
  type = DEFAULT_SMS_TYPE,
  dlr = DEFAULT_DLR,
  fetchImpl = fetch,
}) {
  const url = cleanText(providerUrl);
  if (!url) {
    throw new Error("SMS provider URL is required.");
  }

  const recipientList = cleanText(destination || msisdn);
  const sourceId = cleanText(source || senderId) || DEFAULT_SENDER_ID;

  if (isLegacyLocalProviderUrl(url)) {
    const payload = buildReslNaloPayload({
      apiKey: password || apiKey,
      msisdn: recipientList,
      message,
      senderId: sourceId,
    });

    const response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });

    const rawBody = await response.text();
    let body = rawBody;

    try {
      body = JSON.parse(rawBody);
    } catch {
      body = rawBody;
    }

    if (!response.ok) {
      const bodyPreview = typeof body === "string" ? body : JSON.stringify(body);
      throw new Error(
        `SMS provider responded with ${response.status} ${response.statusText}: ${bodyPreview.slice(0, 500)}`
      );
    }

    if (!isNaloSuccessBody(body)) {
      const bodyPreview = typeof body === "string" ? body : JSON.stringify(body);
      throw new Error(
        `SMS provider indicated delivery failure: ${bodyPreview.slice(0, 500)}`
      );
    }

    return {
      transport: "legacy-post",
      request: {
        method: "POST",
        url,
        payload,
      },
      payload,
      status: response.status,
      body,
      messageId: extractProviderMessageId(body),
    };
  }

  const requestUrl = buildReslNaloRequestUrl({
    providerUrl: url,
    username,
    password: password || apiKey,
    msisdn: recipientList,
    message,
    senderId: sourceId,
    type,
    dlr,
  });

  const response = await fetchImpl(requestUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const rawBody = await response.text();
  let body = rawBody;

  try {
    body = JSON.parse(rawBody);
  } catch {
    body = rawBody;
  }

  if (!response.ok) {
    const bodyPreview = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(
      `SMS provider responded with ${response.status} ${response.statusText}: ${bodyPreview.slice(0, 500)}`
    );
  }

  if (!isNaloSuccessBody(body)) {
    const bodyPreview = typeof body === "string" ? body : JSON.stringify(body);
    throw new Error(
      `SMS provider indicated delivery failure: ${bodyPreview.slice(0, 500)}`
    );
  }

  return {
    transport: "get",
    request: {
      method: "GET",
      url: requestUrl,
    },
    status: response.status,
    body,
    messageId: extractProviderMessageId(body),
  };
}
