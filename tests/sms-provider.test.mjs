import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReslNaloPayload,
  buildReslNaloRequestUrl,
  extractProviderMessageId,
  normalizeRecipientList,
  normalizeRecipientMsisdn,
  sendReslNaloSms,
} from "../scripts/sms-provider.js";

test("normalizeRecipientMsisdn converts local Ghana numbers", () => {
  assert.equal(normalizeRecipientMsisdn("0556007486"), "233556007486");
  assert.equal(normalizeRecipientMsisdn("+233 244 071 872"), "233244071872");
});

test("normalizeRecipientList keeps multiple recipients comma-separated", () => {
  assert.equal(
    normalizeRecipientList("0556007486, 0535605682"),
    "233556007486,233535605682"
  );
});

test("buildReslNaloPayload produces the provider payload", () => {
  assert.deepEqual(
    buildReslNaloPayload({
      apiKey: "test-key",
      msisdn: "0556007486",
      message: "Food is on the way",
      senderId: "Mayrit",
    }),
    {
      key: "test-key",
      msisdn: "233556007486",
      message: "Food is on the way",
      sender_id: "Mayrit",
    }
  );
});

test("extractProviderMessageId returns the last pipe-delimited segment", () => {
  assert.equal(
    extractProviderMessageId("1701|233535605682|api.0313605.20260515.1778848343.7238936"),
    "api.0313605.20260515.1778848343.7238936"
  );
});

test("buildReslNaloRequestUrl produces the NALO query string", () => {
  const requestUrl = buildReslNaloRequestUrl({
    providerUrl: "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/",
    username: "johndoe",
    password: "secret",
    msisdn: "0556007486",
    message: "Meal delivered",
    senderId: "Mayrit",
  });

  const parsed = new URL(requestUrl);
  assert.equal(parsed.origin + parsed.pathname, "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/");
  assert.equal(parsed.searchParams.get("username"), "johndoe");
  assert.equal(parsed.searchParams.get("password"), "secret");
  assert.equal(parsed.searchParams.get("type"), "0");
  assert.equal(parsed.searchParams.get("destination"), "233556007486");
  assert.equal(parsed.searchParams.get("dlr"), "1");
  assert.equal(parsed.searchParams.get("source"), "Mayrit");
  assert.equal(parsed.searchParams.get("message"), "Meal delivered");
});

test("sendReslNaloSms uses GET for the public NALO endpoint", async () => {
  let capturedRequest = null;
  const response = {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify({ success: true, id: "abc123" }),
  };

  const result = await sendReslNaloSms({
    providerUrl: "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/",
    username: "johndoe",
    password: "test-key",
    msisdn: "0556007486",
    message: "Meal delivered",
    senderId: "Mayrit",
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options };
      return response;
    },
  });

  assert.ok(capturedRequest);
  assert.equal(capturedRequest.options.method, "GET");
  const parsed = new URL(capturedRequest.url);
  assert.equal(parsed.searchParams.get("username"), "johndoe");
  assert.equal(parsed.searchParams.get("password"), "test-key");
  assert.equal(parsed.searchParams.get("destination"), "233556007486");
  assert.equal(parsed.searchParams.get("source"), "Mayrit");
  assert.equal(parsed.searchParams.get("message"), "Meal delivered");
  assert.equal(result.transport, "get");
  assert.equal(result.messageId, "abc123");
  assert.deepEqual(result.body, { success: true, id: "abc123" });
});

test("sendReslNaloSms extracts a pipe-delimited provider message id", async () => {
  const response = {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => "1701|233535605682|api.0313605.20260515.1778848343.7238936",
  };

  const result = await sendReslNaloSms({
    providerUrl: "https://sms.nalosolutions.com/smsbackend/clientapi/Resl_Nalo/send-message/",
    username: "johndoe",
    password: "test-key",
    msisdn: "0556007486",
    message: "Meal delivered",
    senderId: "Mayrit",
    fetchImpl: async () => response,
  });

  assert.equal(result.transport, "get");
  assert.equal(result.messageId, "api.0313605.20260515.1778848343.7238936");
  assert.equal(result.body, "1701|233535605682|api.0313605.20260515.1778848343.7238936");
});

test("sendReslNaloSms keeps legacy POST for localhost endpoints", async () => {
  let capturedRequest = null;
  const response = {
    ok: true,
    status: 200,
    statusText: "OK",
    text: async () => JSON.stringify({ success: true, id: "abc123" }),
  };

  const result = await sendReslNaloSms({
    providerUrl: "http://127.0.0.1:8000/Resl_Nalo/send-message/",
    apiKey: "test-key",
    msisdn: "0556007486",
    message: "Meal delivered",
    senderId: "Mayrit",
    fetchImpl: async (url, options) => {
      capturedRequest = { url, options };
      return response;
    },
  });

  assert.ok(capturedRequest);
  assert.equal(capturedRequest.options.method, "POST");
  assert.equal(capturedRequest.options.headers["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(capturedRequest.options.body), {
    key: "test-key",
    msisdn: "233556007486",
    message: "Meal delivered",
    sender_id: "Mayrit",
  });
  assert.equal(result.transport, "legacy-post");
  assert.equal(result.messageId, "abc123");
  assert.deepEqual(result.body, { success: true, id: "abc123" });
});
