import test from "node:test";
import assert from "node:assert/strict";
import {
  buildPublicTrackingDoc,
  getTrackingStepIndex,
  isActiveCustomerOrderStatus,
} from "./publicOrderTracking.js";

test("tracking step index follows the public order timeline", () => {
  assert.equal(getTrackingStepIndex("PENDING"), 0);
  assert.equal(getTrackingStepIndex("PREPARING"), 2);
  assert.equal(getTrackingStepIndex("COMPLETED"), 4);
  assert.equal(getTrackingStepIndex("UNKNOWN"), 0);
});

test("active customer statuses exclude terminal states", () => {
  assert.equal(isActiveCustomerOrderStatus("PENDING"), true);
  assert.equal(isActiveCustomerOrderStatus("READY"), true);
  assert.equal(isActiveCustomerOrderStatus("COMPLETED"), false);
  assert.equal(isActiveCustomerOrderStatus("CANCELLED"), false);
});

test("public tracking docs normalize optional fields", () => {
  const doc = buildPublicTrackingDoc("order-1", {
    orderNumber: "ORD-123",
    customerName: "Jane Doe",
    status: "READY",
    subtotal: 25,
    total: 30,
    items: [
      { name: "Rice", quantity: 2, subtotal: 20 },
      { name: "Soup", quantity: 1, subtotal: 5, imageUrl: "/soup.png" },
    ],
  });

  assert.deepEqual(doc, {
    orderId: "order-1",
    orderNumber: "ORD-123",
    customerName: "Jane Doe",
    status: "READY",
    subtotal: 25,
    deliveryFee: 0,
    total: 30,
    deliveryLocation: "",
    specialInstructions: "",
    items: [
      { name: "Rice", quantity: 2, subtotal: 20, imageUrl: null },
      { name: "Soup", quantity: 1, subtotal: 5, imageUrl: "/soup.png" },
    ],
    createdAt: undefined,
    updatedAt: undefined,
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
  });
});
