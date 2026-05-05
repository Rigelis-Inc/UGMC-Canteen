export function toInt(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function toNumber(value) {
  const parsed = Number.parseFloat(value);
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function buildReferenceNumber(prefix, timestamp = Date.now()) {
  return `${prefix}-${timestamp}`;
}

export function calculateReceiveStock({ currentQty, quantity, unitCost }) {
  const nextQty = currentQty + quantity;
  return {
    previousQuantity: currentQty,
    quantity,
    newQuantity: nextQty,
    totalCost: unitCost * quantity,
    totalValue: unitCost * nextQty,
  };
}

export function calculateIssueStock({ currentQty, quantity, unitCost }) {
  if (quantity > currentQty) {
    throw new Error("Quantity exceeds available stock.");
  }

  const nextQty = currentQty - quantity;
  return {
    previousQuantity: currentQty,
    quantity,
    newQuantity: nextQty,
    totalCost: unitCost * quantity,
    totalValue: unitCost * nextQty,
  };
}

export function calculateTransferStock({ sourceQty, destinationQty, quantity, unitCost }) {
  if (quantity > sourceQty) {
    throw new Error("Quantity exceeds available stock.");
  }

  const newSourceQty = sourceQty - quantity;
  const newDestinationQty = destinationQty + quantity;
  return {
    sourcePreviousQuantity: sourceQty,
    destinationPreviousQuantity: destinationQty,
    quantity,
    newSourceQty,
    newDestinationQty,
    totalCost: unitCost * quantity,
    sourceTotalValue: unitCost * newSourceQty,
    destinationTotalValue: unitCost * newDestinationQty,
  };
}

export function calculateAdjustmentStock({ currentQty, countedQty, unitCost }) {
  const delta = countedQty - currentQty;
  return {
    previousQuantity: currentQty,
    countedQty,
    quantityDifference: Math.abs(delta),
    newQuantity: countedQty,
    direction: delta >= 0 ? "INCREASE" : "DECREASE",
    totalCost: unitCost * Math.abs(delta),
    totalValue: unitCost * countedQty,
  };
}

export function calculateWriteOffStock({ currentQty, quantity, unitCost }) {
  if (quantity > currentQty) {
    throw new Error("Quantity exceeds available stock.");
  }

  const nextQty = currentQty - quantity;
  return {
    previousQuantity: currentQty,
    quantity,
    newQuantity: nextQty,
    totalCost: unitCost * quantity,
    totalValue: unitCost * nextQty,
  };
}
