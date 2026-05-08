import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  doc, getDoc, getDocs, collection, query, where, updateDoc, addDoc, setDoc, serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import Layout from "../../components/layout/Layout";
import {
  ChevronLeft, Loader2, AlertCircle, Check, UtensilsCrossed, User, Phone,
  MapPin, Package, Clock, ClipboardList,
} from "lucide-react";

const STATUS_LABELS = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  READY: "Ready",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

const STATUS_STYLES = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-primary-50 text-primary-700 border-primary-200",
  PREPARING: "bg-purple-50 text-purple-700 border-purple-200",
  READY: "bg-green-50 text-green-700 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-600 border-gray-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
};

const STATUS_FLOW = ["PENDING", "CONFIRMED", "PREPARING", "READY", "COMPLETED"];

const NEXT_STATUS = {
  PENDING: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

export default function OrderDetailPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  const [order, setOrder] = useState(null);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  useEffect(() => { fetchOrder(); }, [orderId]);

  async function fetchOrder() {
    setLoading(true);
    setError(null);
    try {
      const orderSnap = await getDoc(doc(db, "foodOrders", orderId));
      if (orderSnap.exists()) setOrder({ id: orderSnap.id, ...orderSnap.data() });
      else setError("Order not found.");
      try {
        const logsSnap = await getDocs(query(collection(db, "orderStatusLogs"), where("orderId", "==", orderId)));
        const sortedLogs = logsSnap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .sort((a, b) => {
            const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
            const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
            return aTime - bTime;
          });
        setLogs(sortedLogs);
      } catch (logErr) {
        console.error("Failed to load order timeline:", logErr);
        setLogs([]);
        if (!orderSnap.exists()) return;
        setError("Order loaded, but the status timeline could not be loaded.");
      }
    } catch {
      setError("Failed to load order.");
    } finally {
      setLoading(false);
    }
  }

  async function updateStatus(newStatus) {
    if (!order) return;
    setUpdating(true);
    setError(null);
    try {
      const now = serverTimestamp();
      const update = { status: newStatus, updatedAt: now };
      if (newStatus === "CONFIRMED") update.confirmedAt = now;
      if (newStatus === "COMPLETED") update.completedAt = now;
      if (newStatus === "CANCELLED") update.cancelledAt = now;
      if (!order.handledBy) {
        update.handledBy = userProfile?.uid || null;
        update.handledByName = userProfile?.fullName || null;
      }
      await updateDoc(doc(db, "foodOrders", orderId), update);
      await setDoc(doc(db, "publicOrderTracking", orderId), {
        orderId,
        orderNumber: order.orderNumber || "",
        customerName: order.customerName || "",
        status: newStatus,
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
        confirmedAt: newStatus === "CONFIRMED" ? now : (order.confirmedAt || null),
        completedAt: newStatus === "COMPLETED" ? now : (order.completedAt || null),
        cancelledAt: newStatus === "CANCELLED" ? now : (order.cancelledAt || null),
      }, { merge: true });
      const logRef = await addDoc(collection(db, "orderStatusLogs"), {
        orderId,
        previousStatus: order.status,
        newStatus,
        changedBy: userProfile?.uid || null,
        changedByName: userProfile?.fullName || null,
        note: "",
        createdAt: now,
      });
      setOrder((prev) => ({ ...prev, status: newStatus }));
      setLogs((prev) => [...prev, { id: logRef.id, orderId, previousStatus: order.status, newStatus, changedByName: userProfile?.fullName, createdAt: new Date() }]);
      setSuccess(`Status updated to ${STATUS_LABELS[newStatus]}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to update status.");
    } finally {
      setUpdating(false);
    }
  }

  const formatDate = (ts) => {
    if (!ts) return "—";
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleString("en-GH", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center items-center h-64">
          <Loader2 size={28} className="animate-spin text-orange-400" />
        </div>
      </Layout>
    );
  }

  if (error && !order) {
    return (
      <Layout>
        <div className="p-8 text-center">
          <AlertCircle size={36} className="text-red-400 mx-auto mb-3" />
          <p className="text-gray-600">{error}</p>
          <button onClick={() => navigate("/admin/orders")} className="mt-4 text-orange-500 text-sm hover:text-orange-600">← Back to Orders</button>
        </div>
      </Layout>
    );
  }

  const nextStatus = NEXT_STATUS[order?.status];
  const isFinal = ["COMPLETED", "CANCELLED"].includes(order?.status);
  const statusStyle = STATUS_STYLES[order?.status] || "bg-gray-100 text-gray-600 border-gray-200";
  const currentIdx = STATUS_FLOW.indexOf(order?.status);

  return (
    <Layout>
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Back */}
        <button
          onClick={() => navigate("/admin/orders")}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6 transition-colors"
        >
          <ChevronLeft size={16} />
          Back to Orders
        </button>

        {success && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-4 text-green-700 text-sm">
            <Check size={15} /> {success}
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-xl px-4 py-3 mb-4 text-red-700 text-sm">
            <AlertCircle size={15} /> {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main order info */}
          <div className="lg:col-span-2 space-y-5">
            {/* Header */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Order Number</p>
                  <p className="text-2xl font-bold text-gray-900 font-mono">{order.orderNumber}</p>
                  <p className="text-xs text-gray-400 mt-1">Placed {formatDate(order.createdAt)}</p>
                </div>
                <span className={`self-start sm:self-auto text-sm font-semibold px-3.5 py-2 rounded-xl border ${statusStyle}`}>
                  {STATUS_LABELS[order.status] || order.status}
                </span>
              </div>

              {/* Progress bar */}
              {!["CANCELLED"].includes(order.status) && (
                <div className="overflow-x-auto">
                  <div className="flex items-center gap-1 min-w-max">
                    {STATUS_FLOW.map((s, i) => {
                      const passed = i <= currentIdx;
                      return (
                        <div key={s} className="flex items-center">
                          <div className={`flex flex-col items-center`}>
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${passed ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-400"}`}>
                              {passed && i < currentIdx ? <Check size={12} /> : i + 1}
                            </div>
                            <span className={`text-[10px] mt-1 font-medium ${passed ? "text-orange-600" : "text-gray-400"}`}>{STATUS_LABELS[s]}</span>
                          </div>
                          {i < STATUS_FLOW.length - 1 && (
                            <div className={`w-8 h-0.5 mb-4 mx-1 ${i < currentIdx ? "bg-orange-400" : "bg-gray-100"}`} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Customer */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><User size={16} className="text-orange-400" /> Customer Details</h3>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div><dt className="text-gray-400 text-xs mb-0.5">Name</dt><dd className="font-medium text-gray-900">{order.customerName}</dd></div>
                <div><dt className="text-gray-400 text-xs mb-0.5">Phone</dt><dd className="font-medium text-gray-900">{order.phone}</dd></div>
                <div className="sm:col-span-2"><dt className="text-gray-400 text-xs mb-0.5">Ward / Department</dt><dd className="font-medium text-gray-900">{order.deliveryLocation || "—"}</dd></div>
              </dl>
            </div>

            {/* Order items */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><ClipboardList size={16} className="text-orange-400" /> Order Items</h3>
              <ul className="space-y-3 mb-4">
                {(order.items || []).map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <UtensilsCrossed size={16} className="text-orange-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      <p className="text-xs text-gray-400">GH₵ {Number(item.price).toFixed(2)} × {item.quantity}</p>
                    </div>
                    <p className="font-semibold text-gray-900 text-sm">GH₵ {Number(item.subtotal).toFixed(2)}</p>
                  </li>
                ))}
              </ul>
              <div className="space-y-1.5 text-sm pt-2">
                <div className="flex justify-between text-gray-500"><span>Subtotal</span><span>GH₵ {Number(order.subtotal).toFixed(2)}</span></div>
                {order.deliveryFee > 0 && <div className="flex justify-between text-gray-500"><span>Delivery fee</span><span>GH₵ {Number(order.deliveryFee).toFixed(2)}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-orange-600">GH₵ {Number(order.total).toFixed(2)}</span>
                </div>
              </div>
              {order.specialInstructions && (
                <div className="mt-3 bg-amber-50 rounded-xl p-3 text-xs text-amber-800 border border-amber-100">
                  <span className="font-medium">Special instructions: </span>{order.specialInstructions}
                </div>
              )}
            </div>
          </div>

          {/* Side panel */}
          <div className="space-y-5">
            {/* Actions */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-4">Actions</h3>
              {isFinal ? (
                <div className="text-sm text-gray-400 bg-gray-50 rounded-xl px-4 py-3 text-center">
                  This order is {order.status === "COMPLETED" ? "completed" : "cancelled"}.
                </div>
              ) : (
                <div className="space-y-2">
                  {nextStatus && (
                    <button
                      onClick={() => updateStatus(nextStatus)}
                      disabled={updating}
                      className="flex items-center justify-center gap-2 w-full bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white font-semibold py-2.5 rounded-xl transition-colors"
                    >
                      {updating ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                      Mark as {STATUS_LABELS[nextStatus]}
                    </button>
                  )}
                  <button
                    onClick={() => updateStatus("CANCELLED")}
                    disabled={updating}
                    className="flex items-center justify-center gap-2 w-full bg-white hover:bg-red-50 border border-red-200 text-red-500 hover:text-red-700 font-medium py-2.5 rounded-xl transition-colors disabled:opacity-50"
                  >
                    Cancel Order
                  </button>
                </div>
              )}
            </div>

            {/* Delivery info */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><MapPin size={15} className="text-orange-400" /> Delivery</h3>
              <dl className="space-y-2 text-sm">
                {order.deliveryLocation && <div><dt className="text-gray-400 text-xs mb-0.5">Ward / Department</dt><dd className="font-medium text-gray-900">{order.deliveryLocation}</dd></div>}
              </dl>
            </div>

            {/* Status timeline */}
            {logs.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><Clock size={15} className="text-orange-400" /> Status Timeline</h3>
                <ul className="space-y-3">
                  {logs.map((log) => (
                    <li key={log.id} className="flex items-start gap-2.5 text-xs">
                      <div className="w-1.5 h-1.5 rounded-full bg-orange-400 mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-gray-600">
                          <span className="font-medium text-gray-800">{STATUS_LABELS[log.newStatus]}</span>
                          {log.changedByName && <> · {log.changedByName}</>}
                        </p>
                        <p className="text-gray-400">{formatDate(log.createdAt)}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

