import { doc, getDoc } from "firebase/firestore";

export const TRACKING_STEP_ORDER = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "READY",
  "COMPLETED",
];

export const TERMINAL_ORDER_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

const CUSTOMER_ORDER_STORAGE_KEY = "mayrit_customer_orders";
const CUSTOMER_ORDER_LIMIT = 20;

export const TRACKING_STATUS_META = {
  PENDING: {
    label: "Order received",
    title: "We have your order",
    detail: "Your order is in the queue and waiting to be confirmed by the canteen team.",
  },
  CONFIRMED: {
    label: "Confirmed",
    title: "Order confirmed",
    detail: "The kitchen has accepted your order and work can begin.",
  },
  PREPARING: {
    label: "Preparing",
    title: "Meals are being prepared",
    detail: "Our team is cooking and packing your order now.",
  },
  READY: {
    label: "Ready",
    title: "Ready for delivery",
    detail: "Your order is packed and ready to be delivered to your ward or department.",
  },
  COMPLETED: {
    label: "Completed",
    title: "Order completed",
    detail: "The order has been delivered or collected successfully.",
  },
  CANCELLED: {
    label: "Cancelled",
    title: "Order cancelled",
    detail: "This order was cancelled and will not be processed further.",
  },
};

export function getTrackingStepIndex(status) {
  return Math.max(TRACKING_STEP_ORDER.indexOf(status), 0);
}

export function buildPublicTrackingDoc(orderId, orderData) {
  return {
    orderId,
    orderNumber: orderData.orderNumber,
    customerName: orderData.customerName,
    status: orderData.status || "PENDING",
    subtotal: orderData.subtotal,
    deliveryFee: orderData.deliveryFee || 0,
    total: orderData.total,
    deliveryLocation: orderData.deliveryLocation || "",
    specialInstructions: orderData.specialInstructions || "",
    items: (orderData.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      subtotal: item.subtotal,
      imageUrl: item.imageUrl || null,
    })),
    createdAt: orderData.createdAt,
    updatedAt: orderData.updatedAt,
    confirmedAt: orderData.confirmedAt || null,
    completedAt: orderData.completedAt || null,
    cancelledAt: orderData.cancelledAt || null,
  };
}

function safeLoadStoredOrders() {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(CUSTOMER_ORDER_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((entry) => ({
        id: typeof entry?.id === "string" ? entry.id.trim() : "",
        orderNumber: typeof entry?.orderNumber === "string" ? entry.orderNumber.trim() : "",
        customerName: typeof entry?.customerName === "string" ? entry.customerName.trim() : "",
        savedAt: typeof entry?.savedAt === "string" ? entry.savedAt : null,
      }))
      .filter((entry) => entry.id);
  } catch {
    return [];
  }
}

export function getCustomerOrderRefs() {
  return safeLoadStoredOrders();
}

export async function loadCustomerOrderStatuses(db, orderRefs) {
  if (!orderRefs.length) return [];

  const snaps = await Promise.all(
    orderRefs.map((ref) => getDoc(doc(db, "publicOrderTracking", ref.id)))
  );

  return snaps.map((snap, index) => ({
    id: orderRefs[index].id,
    status: snap.exists() ? snap.data()?.status : null,
  }));
}

export function rememberCustomerOrder(orderRef) {
  if (typeof window === "undefined" || !orderRef?.id) return [];

  const nextEntry = {
    id: String(orderRef.id).trim(),
    orderNumber: typeof orderRef.orderNumber === "string" ? orderRef.orderNumber.trim() : "",
    customerName: typeof orderRef.customerName === "string" ? orderRef.customerName.trim() : "",
    savedAt: new Date().toISOString(),
  };

  const nextList = [
    nextEntry,
    ...safeLoadStoredOrders().filter((entry) => entry.id !== nextEntry.id),
  ].slice(0, CUSTOMER_ORDER_LIMIT);

  window.localStorage.setItem(CUSTOMER_ORDER_STORAGE_KEY, JSON.stringify(nextList));
  window.dispatchEvent(new CustomEvent("customer-orders-changed"));
  return nextList;
}

export function isActiveCustomerOrderStatus(status) {
  return Boolean(status) && !TERMINAL_ORDER_STATUSES.has(status);
}
