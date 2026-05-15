import assert from "node:assert/strict";
import test from "node:test";
import { buildDeliveredMessage } from "../src/lib/mealSms.js";

test("buildDeliveredMessage includes the support contact number", () => {
  assert.equal(
    buildDeliveredMessage({
      patientName: "Akosua Mensah",
      supportContactNumber: "0244001234",
    }),
    "Hello Akosua Mensah, your meal from Mayrit Cuisines has been delivered. If you have any issue, please contact 0244001234."
  );
});

test("buildDeliveredMessage falls back to a generic greeting and default contact", () => {
  assert.equal(
    buildDeliveredMessage({
      patientName: "",
      supportContactNumber: "",
    }),
    "Hello, your meal from Mayrit Cuisines has been delivered. If you have any issue, please contact 0000000000."
  );
});
