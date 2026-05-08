import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import {
  ArrowRight, Clock, Loader2, UtensilsCrossed,
  ChefHat, Package, Ban, CheckCircle2, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  TRACKING_STATUS_META,
  TRACKING_STEP_ORDER,
  getTrackingStepIndex,
  getCustomerOrderRefs,
} from "../../lib/publicOrderTracking";

const TERMINAL_STATUSES = new Set(["COMPLETED", "CANCELLED"]);

const STATUS_ICONS = {
  PENDING: Clock,
  CONFIRMED: CheckCircle2,
  PREPARING: ChefHat,
  READY: Package,
  COMPLETED: CheckCircle2,
  CANCELLED: Ban,
};

function formatDate(ts) {
  if (!ts) return "";
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-GH", { day: "2-digit", month: "short" });
}

function formatMoney(value) {
  return `GH₵ ${Number(value || 0).toFixed(2)}`;
}

function OrderCard({ order, expanded, onToggle }) {
  const meta = TRACKING_STATUS_META[order.status] || { label: "Unknown", title: "Unknown" };
  const Icon = STATUS_ICONS[order.status] || Clock;
  const isTerminal = TERMINAL_STATUSES.has(order.status);
  const itemCount = (order.items || []).length;

  if (order.loading) {
    return (
      <div className="bg-gray-900 rounded-2xl p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-800" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-24 bg-gray-800 rounded" />
            <div className="h-3 w-36 bg-gray-800/50 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (order.error || order.missing) {
    return (
      <div className="bg-gray-900 rounded-2xl p-4 border border-gray-800">
        <p className="text-sm font-medium text-white">{order.rememberedOrderNumber || order.id}</p>
        <p className="text-xs text-gray-500 mt-1">{order.error || "Order no longer available."}</p>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full text-left bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden transition-all"
    >
      <div className="p-4">
        <div className="flex items-center gap-3">
          {/* Status icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            isTerminal ? "bg-gray-800" : "bg-orange-900/20"
          }`}>
            <Icon size={17} className={isTerminal ? "text-gray-500" : "text-orange-500"} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-white truncate">{meta.label}</span>
              <span className="text-xs text-gray-500 flex-shrink-0">{formatDate(order.updatedAt || order.createdAt)}</span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-xs text-gray-400">{itemCount} item{itemCount !== 1 ? "s" : ""}</span>
              <span className="text-xs text-gray-600">·</span>
              <span className="text-xs font-semibold text-white">{formatMoney(order.total)}</span>
            </div>
          </div>

          {/* Chevron */}
          {expanded ? (
            <ChevronUp size={16} className="text-gray-600 flex-shrink-0" />
          ) : (
            <ChevronDown size={16} className="text-gray-600 flex-shrink-0" />
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-gray-800 px-4 py-4 space-y-4 animate-fadeIn">
          {/* Order number */}
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">Order</span>
            <span className="font-mono text-sm font-semibold text-white">{order.orderNumber}</span>
          </div>

          {/* Progress bar */}
          {!isTerminal && (
            <div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-orange-400 to-amber-400 transition-all duration-700"
                  style={{ width: `${Math.min(((getTrackingStepIndex(order.status) + 1) / TRACKING_STEP_ORDER.length) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">{meta.title}</p>
            </div>
          )}

          {/* Cancelled banner */}
          {order.status === "CANCELLED" && (
            <div className="flex items-center gap-2 bg-red-900/20 rounded-xl px-3 py-2.5">
              <Ban size={14} className="text-red-400 flex-shrink-0" />
              <p className="text-xs text-red-400 font-medium">This order was cancelled</p>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs text-gray-500 font-medium mb-2">Items</p>
            <div className="space-y-1.5">
              {(order.items || []).map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <span className="text-gray-300">{item.name} <span className="text-gray-500">× {item.quantity}</span></span>
                  <span className="font-medium text-white">{formatMoney(item.subtotal)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Total */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-800">
            <span className="text-sm font-medium text-gray-400">Total</span>
            <span className="text-lg font-bold text-white">{formatMoney(order.total)}</span>
          </div>

          {order.deliveryLocation && (
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="bg-gray-800 px-2 py-1 rounded-md font-medium">Deliver to: {order.deliveryLocation}</span>
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export default function TrackOrderPage() {
  const { orderId } = useParams();
  const [orderRefs, setOrderRefs] = useState(() => getCustomerOrderRefs());
  const [trackedOrderMap, setTrackedOrderMap] = useState({});
  const [expandedId, setExpandedId] = useState(orderId || null);

  useEffect(() => {
    const refs = getCustomerOrderRefs();
    if (orderId && !refs.some((ref) => ref.id === orderId)) {
      refs.unshift({ id: orderId, orderNumber: "", customerName: "", savedAt: new Date().toISOString() });
    }
    setOrderRefs(refs);
  }, [orderId]);

  useEffect(() => {
    if (orderId) setExpandedId(orderId);
  }, [orderId]);

  useEffect(() => {
    if (orderRefs.length === 0) {
      setTrackedOrderMap({});
      return undefined;
    }

    const unsubs = orderRefs.map((ref) =>
      onSnapshot(
        doc(db, "publicOrderTracking", ref.id),
        (snap) => {
          if (snap.exists()) {
            setTrackedOrderMap((prev) => ({
              ...prev,
              [ref.id]: { id: snap.id, ...snap.data(), rememberedOrderNumber: ref.orderNumber },
            }));
          } else {
            setTrackedOrderMap((prev) => ({
              ...prev,
              [ref.id]: { id: ref.id, missing: true, rememberedOrderNumber: ref.orderNumber },
            }));
          }
        },
        () => {
          setTrackedOrderMap((prev) => ({
            ...prev,
            [ref.id]: { id: ref.id, error: "Could not load order.", rememberedOrderNumber: ref.orderNumber },
          }));
        }
      )
    );

    return () => unsubs.forEach((u) => u());
  }, [orderRefs]);

  const orders = useMemo(
    () => orderRefs.map((ref) => trackedOrderMap[ref.id] || { id: ref.id, loading: true, rememberedOrderNumber: ref.orderNumber }),
    [orderRefs, trackedOrderMap]
  );

  const activeOrders = orders.filter((o) => o.status && !TERMINAL_STATUSES.has(o.status));
  const doneOrders = orders.filter((o) => o.status && TERMINAL_STATUSES.has(o.status));

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-6 sm:px-8 py-6">

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white tracking-tight">My Orders</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tap an order to see details</p>
        </div>

        {orders.length === 0 ? (
          <div className="bg-gray-900 rounded-2xl p-10 text-center border border-gray-800">
            <div className="w-14 h-14 rounded-2xl bg-orange-900/20 flex items-center justify-center mx-auto mb-4">
              <UtensilsCrossed size={22} className="text-orange-400" />
            </div>
            <h2 className="text-lg font-bold text-white mb-1">No orders yet</h2>
            <p className="text-sm text-gray-500 mb-6">Your orders will appear here once you place one.</p>
            <Link
              to="/menu"
              className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 active:scale-[0.98] text-white font-semibold px-6 py-3 rounded-2xl transition-all text-sm"
            >
              Browse Menu
              <ArrowRight size={14} />
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Active */}
            {activeOrders.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 px-1">Active</p>
                <div className="space-y-2">
                  {activeOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      expanded={expandedId === order.id}
                      onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Past */}
            {doneOrders.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3 px-1">Past</p>
                <div className="space-y-2">
                  {doneOrders.map((order) => (
                    <OrderCard
                      key={order.id}
                      order={order}
                      expanded={expandedId === order.id}
                      onToggle={() => setExpandedId(expandedId === order.id ? null : order.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
