import test from "node:test";
import assert from "node:assert/strict";
import {
  buildReferenceNumber,
  calculateAdjustmentStock,
  calculateIssueStock,
  calculateReceiveStock,
  calculateTransferStock,
  calculateWriteOffStock,
  toInt,
  toNumber,
} from "../src/lib/stockMath.js";

test("helpers normalize primitive values", () => {
  assert.equal(toInt("7"), 7);
  assert.equal(toInt("abc"), 0);
  assert.equal(toNumber("12.5"), 12.5);
  assert.equal(toNumber("abc"), 0);
});

test("buildReferenceNumber combines prefix and timestamp", () => {
  assert.equal(buildReferenceNumber("REC", 123), "REC-123");
});

test("receive stock increases quantity and value", () => {
  assert.deepEqual(
    calculateReceiveStock({ currentQty: 10, quantity: 5, unitCost: 2 }),
    {
      previousQuantity: 10,
      quantity: 5,
      newQuantity: 15,
      totalCost: 10,
      totalValue: 30,
    }
  );
});

test("issue stock decreases quantity and blocks overdraft", () => {
  assert.deepEqual(
    calculateIssueStock({ currentQty: 10, quantity: 4, unitCost: 3 }),
    {
      previousQuantity: 10,
      quantity: 4,
      newQuantity: 6,
      totalCost: 12,
      totalValue: 18,
    }
  );
  assert.throws(() => calculateIssueStock({ currentQty: 2, quantity: 3, unitCost: 3 }), /exceeds available stock/i);
});

test("transfer stock updates both ends atomically", () => {
  assert.deepEqual(
    calculateTransferStock({ sourceQty: 20, destinationQty: 4, quantity: 6, unitCost: 5 }),
    {
      sourcePreviousQuantity: 20,
      destinationPreviousQuantity: 4,
      quantity: 6,
      newSourceQty: 14,
      newDestinationQty: 10,
      totalCost: 30,
      sourceTotalValue: 70,
      destinationTotalValue: 50,
    }
  );
});

test("adjustment stock records direction and final quantity", () => {
  assert.deepEqual(
    calculateAdjustmentStock({ currentQty: 8, countedQty: 11, unitCost: 2 }),
    {
      previousQuantity: 8,
      countedQty: 11,
      quantityDifference: 3,
      newQuantity: 11,
      direction: "INCREASE",
      totalCost: 6,
      totalValue: 22,
    }
  );
});

test("damage and expiry write-off cannot exceed available stock", () => {
  assert.deepEqual(
    calculateWriteOffStock({ currentQty: 9, quantity: 4, unitCost: 2.5 }),
    {
      previousQuantity: 9,
      quantity: 4,
      newQuantity: 5,
      totalCost: 10,
      totalValue: 12.5,
    }
  );
  assert.throws(() => calculateWriteOffStock({ currentQty: 1, quantity: 2, unitCost: 2.5 }), /exceeds available stock/i);
});
