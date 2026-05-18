import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, updateDoc, addDoc, doc,
  serverTimestamp
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { sendDeliveredMealSms } from "../../lib/mealSms";
import SmsStatusBadge from "../../components/common/SmsStatusBadge";
import { format } from "date-fns";
import {
  ChefHat, Clock, CheckCircle, Truck, AlertTriangle, ChevronDown,
  BarChart2, Filter
} from "lucide-react";

const PERIODS = ["BREAKFAST","LUNCH","SUPPER"];

const STATUS_FLOW = {
  REQUESTED: { next: "PREPARING", label: "Start Preparing", color: "bg-amber-100 text-amber-700", btnColor: "bg-amber-500 hover:bg-amber-600 text-white" },
  PREPARING: { next: "DELIVERED", label: "Mark Delivered", color: "bg-blue-100 text-blue-700", btnColor: "bg-blue-500 hover:bg-blue-600 text-white" },
  DELIVERED: { next: null, color: "bg-emerald-100 text-emerald-700" },
  CANCELLED: { next: null, color: "bg-red-100 text-red-700" },
};

export default function KitchenDashboardPage() {
  const { currentUser, userProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodTab, setPeriodTab] = useState("ALL");
  const [viewMode, setViewMode] = useState("ward"); // list | summary | ward
  const [showLate, setShowLate] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");

  const fetchOrders = useCallback(async () => {
    try {
      const snap = await getDocs(query(
        collection(db, "wardMealOrders"),
        where("orderDate", "==", today)
      ));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => (a.requestedAt?.seconds ?? 0) - (b.requestedAt?.seconds ?? 0));
      setOrders(docs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, 30000);
    return () => clearInterval(id);
  }, [fetchOrders]);

  async function updateStatus(order, newStatus) {
    const now = serverTimestamp();
    const actorUid = currentUser?.uid;
    if (!actorUid) {
      console.error("Cannot update order status without an authenticated user.");
      return;
    }
    const updates = { status: newStatus, updatedAt: now };
    if (newStatus === "DELIVERED") {
      updates.deliveredBy = actorUid;
      updates.deliveredByName = userProfile.fullName || "";
      updates.deliveredAt = now;
    }
    await updateDoc(doc(db, "wardMealOrders", order.id), updates);
    // Log status change
    await addDoc(collection(db, "mealOrderStatusLogs"), {
      orderId: order.id,
      previousStatus: order.status,
      newStatus,
      changedBy: actorUid,
      changedByName: userProfile.fullName || "",
      note: "",
      createdAt: serverTimestamp(),
    });
    if (newStatus === "DELIVERED") {
      await sendDeliveredMealSms(db, { ...order, status: newStatus }).catch((smsError) => {
        console.warn("Failed to send delivered SMS:", smsError);
      });
    }
    fetchOrders();
  }

  async function cancelOrder(order) {
    const reason = prompt("Cancellation reason:");
    if (!reason) return;
    const actorUid = currentUser?.uid;
    if (!actorUid) {
      console.error("Cannot cancel order without an authenticated user.");
      return;
    }
    await updateDoc(doc(db, "wardMealOrders", order.id), {
      status: "CANCELLED",
      cancelledBy: actorUid,
      cancelledByName: userProfile.fullName || "",
      cancelledAt: serverTimestamp(),
      cancellationReason: reason,
      updatedAt: serverTimestamp(),
    });
    fetchOrders();
  }

  const filtered = orders.filter(o =>
    (periodTab === "ALL" || o.mealPeriod === periodTab) &&
    (showLate ? o.isLate : true)
  );

  // Summary: group by meal name
  const summary = {};
  filtered.filter(o => o.status !== "CANCELLED").forEach(o => {
    const key = o.mainMeal?.name || "Unknown";
    summary[key] = (summary[key] || 0) + 1;
  });

  // Ward groups
  const wardGroups = {};
  filtered.forEach(o => {
    if (!wardGroups[o.wardName]) wardGroups[o.wardName] = [];
    wardGroups[o.wardName].push(o);
  });

  const stats = {
    total: filtered.length,
    requested: filtered.filter(o => o.status === "REQUESTED").length,
    preparing: filtered.filter(o => o.status === "PREPARING").length,
    delivered: filtered.filter(o => o.status === "DELIVERED").length,
    late: filtered.filter(o => o.isLate).length,
  };

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kitchen Dashboard</h1>
            <p className="text-sm text-slate-500">{format(new Date(), "EEEE, MMMM d, yyyy")} · Real-time orders</p>
          </div>
          <div className="flex gap-2">
            {["list","summary","ward"].map(v => (
              <button key={v} onClick={() => setViewMode(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${viewMode === v ? "bg-slate-800 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {v === "list" ? "Orders" : v === "summary" ? "Food Summary" : "By Ward"}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {[
            { label: "Total", value: stats.total, color: "bg-slate-50 text-slate-700" },
            { label: "Requested", value: stats.requested, color: "bg-amber-50 text-amber-700" },
            { label: "Preparing", value: stats.preparing, color: "bg-blue-50 text-blue-700" },
            { label: "Delivered", value: stats.delivered, color: "bg-emerald-50 text-emerald-700" },
            { label: "Late", value: stats.late, color: "bg-primary-50 text-primary-700" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl p-3 ${s.color} border border-current/10`}>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs opacity-70">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="flex gap-1">
            {["ALL", ...PERIODS].map(p => (
              <button key={p} onClick={() => setPeriodTab(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periodTab === p ? "bg-primary-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
                {p === "ALL" ? "All Periods" : p[0] + p.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <button onClick={() => setShowLate(!showLate)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${showLate ? "bg-amber-500 text-white" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"}`}>
            <AlertTriangle size={12} /> Late orders only
          </button>
        </div>

        {/* Views */}
        {loading ? (
          <div className="text-center text-slate-400 text-sm py-8">Loading orders…</div>
        ) : viewMode === "summary" ? (
          <SummaryView summary={summary} />
        ) : viewMode === "ward" ? (
          <WardView wardGroups={wardGroups} onUpdate={updateStatus} onCancel={cancelOrder} />
        ) : (
          <ListView orders={filtered} onUpdate={updateStatus} onCancel={cancelOrder} />
        )}
      </div>
    </div>
  );
}

function ListView({ orders, onUpdate, onCancel }) {
  if (orders.length === 0) return (
    <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
      <ChefHat size={32} className="mx-auto text-slate-300 mb-2" />
      <p className="text-slate-500 text-sm">No orders for the selected filter.</p>
    </div>
  );
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              <th className="px-4 py-3 text-left font-medium text-slate-600">Patient</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Ward / Bed</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Period</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Main Meal</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Extras</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Class</th>
              <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
              <th className="px-4 py-3 text-right font-medium text-slate-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map(o => {
              const flow = STATUS_FLOW[o.status];
              return (
                <tr key={o.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-800">{o.patientName}</p>
                    {o.isLate && <span className="flex items-center gap-1 text-xs text-amber-600"><AlertTriangle size={10} /> Late</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{o.wardName}<br />Bed {o.bedNumber}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-slate-600">{o.mealPeriod}</span>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-800">{o.mainMeal?.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {o.appetiser?.name && <div>App: {o.appetiser.name}</div>}
                    {o.dessert?.name && <div>Des: {o.dessert.name}</div>}
                    {o.specialInstructions && <div className="text-amber-600">⚠ {o.specialInstructions}</div>}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs font-medium text-slate-600">{o.patientClass}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${flow?.color || "bg-slate-100 text-slate-600"}`}>{o.status}</span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {flow?.next && (
                        <button onClick={() => onUpdate(o, flow.next)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${flow.btnColor}`}>
                          {flow.label}
                        </button>
                      )}
                      {o.status !== "CANCELLED" && o.status !== "DELIVERED" && (
                        <button onClick={() => onCancel(o)}
                          className="px-2 py-1 rounded-md text-xs text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SummaryView({ summary }) {
  const sorted = Object.entries(summary).sort((a, b) => b[1] - a[1]);
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <h2 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><BarChart2 size={16} /> Food Preparation Summary</h2>
      {sorted.length === 0 ? (
        <p className="text-slate-400 text-sm">No orders.</p>
      ) : (
        <div className="space-y-2">
          {sorted.map(([name, count]) => (
            <div key={name} className="flex items-center gap-3">
              <div className="flex-1 flex items-center gap-2">
                <div className="h-7 bg-primary-100 rounded-md flex items-center px-3" style={{ width: `${Math.max(10, (count / sorted[0][1]) * 100)}%` }}>
                  <span className="text-sm font-medium text-primary-800 truncate">{name}</span>
                </div>
              </div>
              <span className="text-lg font-bold text-slate-800 w-8 text-right">{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WardView({ wardGroups, onUpdate, onCancel }) {
  const [expanded, setExpanded] = useState(null);
  return (
    <div className="space-y-3">
      {Object.entries(wardGroups).map(([ward, orders]) => (
        <div key={ward} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
            onClick={() => setExpanded(expanded === ward ? null : ward)}
          >
            <div className="flex items-center gap-3">
              <ChevronDown size={15} className={`text-slate-400 transition-transform ${expanded === ward ? "" : "-rotate-90"}`} />
              <span className="font-semibold text-slate-800">{ward}</span>
              <span className="text-xs text-slate-500">{orders.length} orders</span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="text-orange-600">{orders.filter(o => o.status === "REQUESTED").length} pending</span>
              <span className="text-emerald-600">{orders.filter(o => o.status === "DELIVERED").length} done</span>
            </div>
          </button>
          {expanded === ward && (
            <div className="border-t border-slate-100 divide-y divide-slate-100">
              {orders.map(o => {
                const flow = STATUS_FLOW[o.status];
                return (
                  <div key={o.id} className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 text-sm">{o.patientName}</p>
                      <p className="text-xs text-slate-500">Bed {o.bedNumber} · {o.mealPeriod} · {o.mainMeal?.name}</p>
                      {o.appetiser?.name && <p className="text-xs text-slate-400">Appetiser: {o.appetiser.name}</p>}
                      {o.isLate && <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={10} /> Late: {o.lateReason?.replace("_"," ")}</p>}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${flow?.color || "bg-slate-100 text-slate-600"}`}>{o.status}</span>
                    {o.status === "DELIVERED" && o.smsDeliveredStatus && (
                      <SmsStatusBadge order={o} onRetry={() => fetchOrders()} size="xs" />
                    )}
                    {flow?.next && (
                      <button onClick={() => onUpdate(o, flow.next)}
                        className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${flow.btnColor}`}>
                        {flow.label}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
