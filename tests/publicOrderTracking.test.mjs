import test from "node:test";
import assert from "node:assert/strict";
import {
  TRACKING_STEP_ORDER,
  TERMINAL_ORDER_STATUSES,
  TRACKING_STATUS_META,
  getTrackingStepIndex,
  buildPublicTrackingDoc,
  isActiveCustomerOrderStatus,
} from "../src/lib/publicOrderTracking.js";

test("tracking steps are in correct order", () => {
  assert.deepEqual(TRACKING_STEP_ORDER, [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "READY",
    "COMPLETED",
  ]);
});

test("terminal statuses are COMPLETED and CANCELLED", () => {
  assert.equal(TERMINAL_ORDER_STATUSES.has("COMPLETED"), true);
  assert.equal(TERMINAL_ORDER_STATUSES.has("CANCELLED"), true);
  assert.equal(TERMINAL_ORDER_STATUSES.has("PENDING"), false);
  assert.equal(TERMINAL_ORDER_STATUSES.has("CONFIRMED"), false);
});

test("all tracking steps have metadata", () => {
  for (const step of TRACKING_STEP_ORDER) {
    const meta = TRACKING_STATUS_META[step];
    assert.ok(meta, `Missing metadata for ${step}`);
    assert.ok(meta.label, `Missing label for ${step}`);
    assert.ok(meta.title, `Missing title for ${step}`);
    assert.ok(meta.detail, `Missing detail for ${step}`);
  }
});

test("getTrackingStepIndex returns correct position", () => {
  assert.equal(getTrackingStepIndex("PENDING"), 0);
  assert.equal(getTrackingStepIndex("CONFIRMED"), 1);
  assert.equal(getTrackingStepIndex("PREPARING"), 2);
  assert.equal(getTrackingStepIndex("READY"), 3);
  assert.equal(getTrackingStepIndex("COMPLETED"), 4);
  assert.equal(getTrackingStepIndex("UNKNOWN"), 0);
});

test("buildPublicTrackingDoc creates correct structure", () => {
  const orderData = {
    orderNumber: "ORD-20260101-ABCD",
    customerName: "Kwame Asante",
    orderType: "PICKUP",
    paymentMethod: "CASH_ON_DELIVERY",
    paymentStatus: "PENDING",
    status: "PENDING",
    subtotal: 50.0,
    deliveryFee: 0,
    total: 50.0,
    deliveryLocation: "",
    specialInstructions: "No salt",
    items: [
      { name: "Jollof Rice", quantity: 2, subtotal: 40.0, imageUrl: "https://example.com/img.jpg" },
      { name: "Drink", quantity: 1, subtotal: 10.0, imageUrl: null },
    ],
    createdAt: "2026-01-01T10:00:00Z",
    updatedAt: "2026-01-01T10:00:00Z",
    confirmedAt: null,
    completedAt: null,
    cancelledAt: null,
  };

  const doc = buildPublicTrackingDoc("order123", orderData);

  assert.equal(doc.orderId, "order123");
  assert.equal(doc.orderNumber, orderData.orderNumber);
  assert.equal(doc.customerName, orderData.customerName);
  assert.equal(doc.status, "PENDING");
  assert.equal(doc.subtotal, 50.0);
  assert.equal(doc.deliveryFee, 0);
  assert.equal(doc.total, 50.0);
  assert.equal(doc.items.length, 2);
  assert.equal(doc.items[0].name, "Jollof Rice");
  assert.equal(doc.items[0].quantity, 2);
  assert.equal(doc.items[0].imageUrl, "https://example.com/img.jpg");
  assert.equal(doc.items[1].imageUrl, null);
  assert.equal(doc.confirmedAt, null);
});

test("buildPublicTrackingDoc handles missing optional fields", () => {
  const orderData = {
    orderNumber: "ORD-TEST",
    customerName: "Test",
    orderType: "PICKUP",
    paymentMethod: "CASH_ON_DELIVERY",
    paymentStatus: "PENDING",
    status: "PENDING",
    subtotal: 10,
    total: 10,
    items: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const doc = buildPublicTrackingDoc("test1", orderData);

  assert.equal(doc.deliveryFee, 0);
  assert.equal(doc.deliveryLocation, "");
  assert.equal(doc.specialInstructions, "");
  assert.deepEqual(doc.items, []);
});

test("isActiveCustomerOrderStatus returns correct values", () => {
  assert.equal(isActiveCustomerOrderStatus("PENDING"), true);
  assert.equal(isActiveCustomerOrderStatus("CONFIRMED"), true);
  assert.equal(isActiveCustomerOrderStatus("PREPARING"), true);
  assert.equal(isActiveCustomerOrderStatus("READY"), true);
  assert.equal(isActiveCustomerOrderStatus("COMPLETED"), false);
  assert.equal(isActiveCustomerOrderStatus("CANCELLED"), false);
  assert.equal(isActiveCustomerOrderStatus(null), false);
  assert.equal(isActiveCustomerOrderStatus(""), false);
  assert.equal(isActiveCustomerOrderStatus(undefined), false);
});
