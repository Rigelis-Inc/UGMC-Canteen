import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection, getDocs, updateDoc, doc, serverTimestamp, addDoc, setDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { writeAuditLog } from "../../lib/audit";
import Layout from "../../components/layout/Layout";
import { useNavigate } from "react-router-dom";
import {
  Search, Loader2, ClipboardList, AlertCircle, Check, X, MapPin, Phone, ChevronRight, Clock, Bell,
} from "lucide-react";

const STATUSES = ["All", "PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED", "CANCELLED"];

const STATUS_STYLES = {
  PENDING: "bg-amber-50 text-amber-700",
  CONFIRMED: "bg-primary-50 text-primary-700",
  PREPARING: "bg-purple-50 text-purple-700",
  READY: "bg-green-50 text-green-700",
  COMPLETED: "bg-gray-100 text-gray-600",
  CANCELLED: "bg-red-50 text-red-600",
};

const STATUS_LABELS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const NEXT_STATUS = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

export default function OrdersPage() {
  const { userProfile, currentUser } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("PENDING");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [updatingId, setUpdatingId] = useState(null);

  const fetchOrders = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, "foodOrders"));
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setOrders(docs);
      setError(null);
    } catch (err) {
      console.error("Orders fetch error:", err);
      setError("Failed to load orders.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const run = async () => {
      if (!active) return;
      await fetchOrders();
    };

    run();
    const intervalId = setInterval(run, 30000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [fetchOrders]);

  async function advanceStatus(order, e) {
    e.stopPropagation();
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    setUpdatingId(order.id);
    try {
      const now = serverTimestamp();
      const update = { status: next, updatedAt: now };
      if (next === "CONFIRMED") update.confirmedAt = now;
      if (next === "COMPLETED") update.completedAt = now;
      if (!order.handledBy) {
        update.handledBy = userProfile?.uid || null;
        update.handledByName = userProfile?.fullName || null;
      }
      await updateDoc(doc(db, "foodOrders", order.id), update);
      const trackingRef = doc(db, "publicOrderTracking", order.id);
      await setDoc(trackingRef, {
        orderId: order.id,
        orderNumber: order.orderNumber || "",
        customerName: order.customerName || "",
        status: next,
        subtotal: order.subtotal || 0,
        deliveryFee: order.deliveryFee || 0,
        total: order.total || 0,
        deliveryLocation: order.deliveryLocation || "",
        specialInstructions: order.specialInstructions || "",
        items: (order.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          subtotal: item.subtotal,
          imageUrl: item.imageUrl || null,
        })),
        updatedAt: now,
        confirmedAt: next === "CONFIRMED" ? now : (order.confirmedAt || null),
        completedAt: next === "COMPLETED" ? now : (order.completedAt || null),
        cancelledAt: next === "CANCELLED" ? now : (order.cancelledAt || null),
      }, { merge: true });
      await addDoc(collection(db, "orderStatusLogs"), {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: next,
        changedBy: userProfile?.uid || null,
        changedByName: userProfile?.fullName || null,
        note: "",
        createdAt: now,
      });
      await writeAuditLog(db, {
        action: "Food order status changed",
        entityType: "foodOrder",
        entityId: order.id,
        description: `Changed ${order.orderNumber} from ${order.status} to ${next}`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber || "",
          previousStatus: order.status,
          newStatus: next,
        },
        currentUser,
        userProfile,
      });
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: next } : o));
      setSuccessMsg(`Order ${order.orderNumber} → ${STATUS_LABELS[next]}`);
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchOrders();
    } catch {
      setError("Failed to update order status.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function cancelOrder(order, e) {
    e.stopPropagation();
    if (!window.confirm(`Cancel order ${order.orderNumber}?`)) return;
    setUpdatingId(order.id);
    try {
      const now = serverTimestamp();
      await updateDoc(doc(db, "foodOrders", order.id), { status: "CANCELLED", updatedAt: now, cancelledAt: now });
      const trackingRef = doc(db, "publicOrderTracking", order.id);
      await setDoc(trackingRef, {
        orderId: order.id,
        orderNumber: order.orderNumber || "",
        customerName: order.customerName || "",
        status: "CANCELLED",
        subtotal: order.subtotal || 0,
        deliveryFee: order.deliveryFee || 0,
        total: order.total || 0,
        deliveryLocation: order.deliveryLocation || "",
        specialInstructions: order.specialInstructions || "",
        items: (order.items || []).map((item) => ({
          name: item.name,
          quantity: item.quantity,
          subtotal: item.subtotal,
          imageUrl: item.imageUrl || null,
        })),
        updatedAt: now,
        cancelledAt: now,
      }, { merge: true });
      await addDoc(collection(db, "orderStatusLogs"), {
        orderId: order.id,
        previousStatus: order.status,
        newStatus: "CANCELLED",
        changedBy: userProfile?.uid || null,
        changedByName: userProfile?.fullName || null,
        note: "Cancelled by admin",
        createdAt: now,
      });
      await writeAuditLog(db, {
        action: "Food order cancelled",
        entityType: "foodOrder",
        entityId: order.id,
        description: `Cancelled ${order.orderNumber}`,
        metadata: {
          orderId: order.id,
          orderNumber: order.orderNumber || "",
          previousStatus: order.status,
          newStatus: "CANCELLED",
        },
        currentUser,
        userProfile,
      });
      setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, status: "CANCELLED" } : o));
      setSuccessMsg("Order cancelled.");
      setTimeout(() => setSuccessMsg(null), 3000);
      fetchOrders();
    } catch {
      setError("Failed to cancel order.");
    } finally {
      setUpdatingId(null);
    }
  }

  const pendingCount = useMemo(() => orders.filter((o) => o.status === "PENDING").length, [orders]);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = !search || o.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
        o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        o.phone?.includes(search) || o.deliveryLocation?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = filterStatus === "All" || o.status === filterStatus;

      let matchDate = true;
      if (o.createdAt) {
        const ts = o.createdAt.toDate ? o.createdAt.toDate() : new Date(o.createdAt);
        const orderDate = ts.toISOString().split("T")[0];
        if (filterDateFrom) matchDate = orderDate >= filterDateFrom;
        if (matchDate && filterDateTo) matchDate = orderDate <= filterDateTo;
      }

      return matchSearch && matchStatus && matchDate;
    });
  }, [orders, search, filterStatus, filterDateFrom, filterDateTo]);

  const formatDate = (ts) => {
    if (!ts) return "";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString("en-GH", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Food Orders</h1>
            <p className="text-sm text-gray-500 mt-0.5">Manage and process customer orders</p>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 shadow-sm">
              <div className="relative">
                <Bell size={16} className="text-amber-600" />
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-amber-50 animate-pulse" />
              </div>
              <span className="text-sm font-bold text-amber-700">{pendingCount} pending</span>
            </div>
          )}
        </div>

        {successMsg && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-green-700 text-sm">
            <Check size={15} />
            {successMsg}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">
            <AlertCircle size={15} />
            {error}
            <button onClick={() => setError(null)} className="ml-auto"><X size={14} /></button>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search by order #, name, phone, ward..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              placeholder="From"
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
            />
            <span className="text-xs text-gray-400 font-medium">to</span>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              placeholder="To"
              className="px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-orange-400 cursor-pointer"
            />
            {(filterDateFrom || filterDateTo) && (
              <button
                onClick={() => { setFilterDateFrom(""); setFilterDateTo(""); }}
                className="text-xs text-gray-400 hover:text-red-500 font-medium px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {STATUSES.map((s) => (
            <button
              key={s}
              onClick={(e) => { e.stopPropagation(); setFilterStatus(s); }}
              className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                filterStatus === s ? "bg-orange-500 text-white" : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
              }`}
            >
              {s === "All" ? "All" : STATUS_LABELS[s]}
              {s === "PENDING" && pendingCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-white/25 text-[9px] font-bold">
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Orders */}
        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-orange-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
            <ClipboardList size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No orders found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((order) => {
              const statusStyle = STATUS_STYLES[order.status] || "bg-gray-100 text-gray-500";
              const next = NEXT_STATUS[order.status];
              const isUpdating = updatingId === order.id;
              const isTerminal = ["COMPLETED", "CANCELLED"].includes(order.status);
              return (
                <div
                  key={order.id}
                  onClick={() => navigate(`/admin/orders/${order.id}`)}
                  className={`bg-white rounded-2xl border shadow-sm p-4 hover:shadow-md cursor-pointer transition-all group ${
                    order.status === "PENDING" ? "border-amber-200 hover:border-amber-300" : "border-gray-100 hover:border-orange-200"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    {/* Left: order info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-mono text-sm font-bold text-gray-900">{order.orderNumber}</span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${statusStyle}`}>
                          {STATUS_LABELS[order.status] || order.status}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-gray-500">
                        <span className="font-medium text-gray-900">{order.customerName}</span>
                        <span className="flex items-center gap-1"><Phone size={11} />{order.phone}</span>
                        {order.deliveryLocation && (
                          <span className="flex items-center gap-1"><MapPin size={11} />{order.deliveryLocation}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                        <span className="flex items-center gap-1"><Clock size={11} />{formatDate(order.createdAt)}</span>
                        <span>{(order.items || []).length} item{(order.items || []).length !== 1 ? "s" : ""}</span>
                        <span className="font-semibold text-orange-600">GH₵ {Number(order.total).toFixed(2)}</span>
                      </div>
                    </div>

                    {/* Right: actions */}
                    <div className="flex items-center gap-1.5 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                      {!isTerminal && next && (
                        <button
                          onClick={(e) => advanceStatus(order, e)}
                          disabled={isUpdating}
                          className="flex items-center gap-1 bg-orange-50 hover:bg-orange-100 text-orange-600 text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {isUpdating ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
                          {STATUS_LABELS[next]}
                        </button>
                      )}
                      {!isTerminal && (
                        <button
                          onClick={(e) => cancelOrder(order, e)}
                          disabled={isUpdating}
                          className="text-[11px] text-red-400 hover:text-red-600 px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      )}
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-orange-400 transition-colors" />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Layout>
  );
}
