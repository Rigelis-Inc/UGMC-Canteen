import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  collection, query, where, getDocs, updateDoc, addDoc, doc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { sendDeliveredMealSms } from "../../lib/mealSms";
import SmsStatusBadge from "../../components/common/SmsStatusBadge";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft, Crown, RefreshCw, Eye } from "lucide-react";
import { APP_PATHS } from "../../lib/routes";

const PERIODS = ["BREAKFAST", "LUNCH", "SUPPER"];
const PERIOD_LABEL = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SUPPER: "Supper" };
const LIVE_REFRESH_MS = 10_000;
const today = format(new Date(), "yyyy-MM-dd");

const STATUS_CONFIG = {
  REQUESTED: { label: "Requested", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500", next: "PREPARING", nextLabel: "Start preparing" },
  PREPARING: { label: "Preparing", color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500", next: "DELIVERED", nextLabel: "Mark delivered" },
  DELIVERED: { label: "Delivered", color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", next: null, nextLabel: null },
  CANCELLED: { label: "Cancelled", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", next: null, nextLabel: null },
};

const PRIORITY = { VVIP: 0, VIP: 1, SPECIAL: 2, GENERAL: 3 };
const STATUS_ORDER = { REQUESTED: 0, PREPARING: 1, DELIVERED: 2, CANCELLED: 3 };

function sortOrders(orders) {
  return [...orders].sort((a, b) => {
    if (a.isLate && !b.isLate) return -1;
    if (!a.isLate && b.isLate) return 1;
    const sA = STATUS_ORDER[a.status] ?? 99;
    const sB = STATUS_ORDER[b.status] ?? 99;
    if (sA !== sB) return sA - sB;
    const pA = PRIORITY[a.patientClass] ?? 3;
    const pB = PRIORITY[b.patientClass] ?? 3;
    if (pA !== pB) return pA - pB;
    return (a.requestedAt?.seconds || 0) - (b.requestedAt?.seconds || 0);
  });
}

function formatSpecialMeal(value) {
  if (!value || value === "NONE") return "Special";
  return value.replace(/_/g, " ");
}

function StatusDot({ status }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-medium border ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

function PatientClassBadge({ patientClass }) {
  if (!patientClass || patientClass === "GENERAL") return null;
  if (patientClass === "VVIP") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-purple-100 text-purple-700">
        <Crown size={9} /> VVIP
      </span>
    );
  }
  if (patientClass === "VIP") {
    return (
      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-amber-100 text-amber-700">
        <Crown size={9} /> VIP
      </span>
    );
  }
  return <span className="text-[10px] font-medium text-slate-500">{patientClass}</span>;
}

export default function KitchenWardOrdersPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { currentUser, userProfile } = useAuth();
  const ward = searchParams.get("ward") || "";
  const initialPeriod = searchParams.get("period") || "BREAKFAST";

  const [periodTab, setPeriodTab] = useState(initialPeriod);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [selected, setSelected] = useState(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (!ward) return;
    if (isRefresh) setRefreshing(true);
    try {
      const snap = await getDocs(query(
        collection(db, "wardMealOrders"),
        where("orderDate", "==", today),
        where("wardName", "==", ward),
      ));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(sortOrders(docs));
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [ward]);

  useEffect(() => {
    fetchOrders();
    const id = setInterval(fetchOrders, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchOrders]);

  async function updateStatus(order, newStatus) {
    const actorUid = currentUser?.uid;
    if (!actorUid) return;
    const updates = { status: newStatus, updatedAt: serverTimestamp() };
    if (newStatus === "DELIVERED") {
      updates.deliveredBy = actorUid;
      updates.deliveredByName = userProfile.fullName || "";
      updates.deliveredAt = serverTimestamp();
    }
    setSavingOrderId(order.id);
    setOrders(prev => prev.map(o => o.id === order.id ? { ...o, status: newStatus } : o));
    try {
      await updateDoc(doc(db, "wardMealOrders", order.id), updates);
      await addDoc(collection(db, "mealOrderStatusLogs"), {
        orderId: order.id, previousStatus: order.status, newStatus,
        changedBy: actorUid, changedByName: userProfile.fullName || "", note: "", createdAt: serverTimestamp(),
      });
      if (newStatus === "DELIVERED") {
        await sendDeliveredMealSms(db, { ...order, status: newStatus }).catch((smsError) => {
          console.warn("Failed to send delivered SMS:", smsError);
        });
      }
      fetchOrders();
    } catch (e) {
      console.error(e);
      fetchOrders();
    } finally {
      setSavingOrderId(null);
    }
  }

  const periodRequestCounts = {};
  PERIODS.forEach(p => {
    periodRequestCounts[p] = orders.filter(o => o.mealPeriod === p && o.status === "REQUESTED").length;
  });

  const filtered = orders.filter(o => o.mealPeriod === periodTab && o.status !== "CANCELLED");
  const stats = {
    total: filtered.length,
    requested: filtered.filter(o => o.status === "REQUESTED").length,
    preparing: filtered.filter(o => o.status === "PREPARING").length,
    delivered: filtered.filter(o => o.status === "DELIVERED").length,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(APP_PATHS.kitchen.dashboard)}
          className="p-1.5 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft size={15} />
        </button>
        <div className="w-9 h-9 rounded-xl bg-primary-50 border border-primary-100 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-primary-700">{ward.charAt(0)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold text-slate-900 truncate">{ward}</h1>
          <p className="text-xs text-slate-500">{format(new Date(), "EEEE, MMMM d")}</p>
        </div>
        <button
          onClick={() => fetchOrders(true)}
          disabled={refreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      {/* Period tabs + stats */}
      <div className="flex items-center gap-3 flex-wrap pt-0.5">
        <div className="flex border border-slate-200 rounded-md">
          {PERIODS.map((p, i) => {
            const count = periodRequestCounts[p] || 0;
            const isActive = periodTab === p;
            return (
              <button key={p} onClick={() => setPeriodTab(p)}
                className={`relative px-3 py-1.5 text-xs font-medium ${
                  i > 0 ? "border-l border-slate-200" : ""
                } ${isActive ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                {PERIOD_LABEL[p]}
                {count > 0 && (
                  <span className={`absolute -top-1.5 -right-1.5 z-10 min-w-[16px] h-4 rounded-full text-[8px] font-bold flex items-center justify-center px-1 ${
                    isActive ? "bg-white text-primary-700" : "bg-primary-600 text-white"
                  }`}>{count}</span>
                )}
              </button>
            );
          })}
        </div>
        <div className="flex-1" />
        <p className="text-[11px] text-slate-400">
          {stats.total} orders · {stats.requested} waiting · {stats.preparing} preparing · {stats.delivered} delivered
        </p>
      </div>

      {lastRefresh && (
        <p className="text-[10px] text-slate-400 text-right">Updated {format(lastRefresh, "HH:mm:ss")}</p>
      )}

      {/* Orders table */}
      {loading ? (
        <div className="text-center text-slate-400 text-sm py-16">Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div className="border border-slate-200 rounded-xl bg-white p-10 text-center text-slate-400 text-sm">
          No orders for this ward and period.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Patient</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Bed / Room</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Meal</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Class</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((o, idx) => {
                const config = STATUS_CONFIG[o.status];
                const isSaving = savingOrderId === o.id;
                return (
                  <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-slate-400 font-medium">{idx + 1}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold text-slate-900">{o.patientName}</span>
                        {o.isLate && <AlertTriangle size={11} className="text-red-500 flex-shrink-0" title="Late order" />}
                      </div>
                      {o.specialInstructions && (
                        <p className="text-[10px] text-amber-600 mt-0.5 truncate max-w-[180px]" title={o.specialInstructions}>{o.specialInstructions}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">
                      Bed {o.bedNumber}{o.roomNumber ? ` · Rm ${o.roomNumber}` : ""}
                    </td>
                    <td className="px-3 py-2.5">
                      <p className="text-xs font-medium text-slate-800">{o.mainMeal?.name}</p>
                      {(o.appetiser?.name || o.dessert?.name) && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {[o.appetiser?.name, o.dessert?.name].filter(Boolean).join(" · ")}
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-2.5">
                      <PatientClassBadge patientClass={o.patientClass} />
                      {o.isSpecialPatient && (
                        <span className="block mt-0.5 text-[10px] font-medium text-primary-700">{formatSpecialMeal(o.specialMealType)}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5"><StatusDot status={o.status} /></td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelected(o)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 transition-colors"
                        >
                          <Eye size={11} /> View
                        </button>
                        {config?.next && (
                          <button
                            onClick={() => updateStatus(o, config.next)}
                            disabled={isSaving}
                            className="px-2.5 py-1 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-md disabled:opacity-50 transition-colors"
                          >
                            {isSaving ? "…" : config.nextLabel}
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
      )}

      {/* Detail modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900 truncate">{selected.patientName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.wardName} · Bed {selected.bedNumber}{selected.roomNumber ? ` · Rm ${selected.roomNumber}` : ""}</p>
                </div>
                <StatusDot status={selected.status} />
              </div>
              {selected.patientClass && selected.patientClass !== "GENERAL" && (
                <div className="mt-2"><PatientClassBadge patientClass={selected.patientClass} /></div>
              )}
            </div>

            {/* Meal */}
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-100">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meal</p>
              <p className="text-base font-bold text-slate-900">{selected.mainMeal?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{PERIOD_LABEL[selected.mealPeriod]}</p>
            </div>

            {/* Details */}
            <div className="px-5 py-4 space-y-3">
              {(selected.appetiser?.name || selected.dessert?.name || selected.isSpecialPatient) && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">Extras</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selected.appetiser?.name && <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600">{selected.appetiser.name}</span>}
                    {selected.dessert?.name && <span className="px-2 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-600">{selected.dessert.name}</span>}
                    {selected.isSpecialPatient && <span className="px-2 py-0.5 bg-primary-50 rounded text-[10px] font-semibold text-primary-700">Diet: {formatSpecialMeal(selected.specialMealType)}</span>}
                  </div>
                </div>
              )}
              {selected.specialInstructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-0.5">Special Instructions</p>
                  <p className="text-sm font-semibold text-amber-900">{selected.specialInstructions}</p>
                </div>
              )}
              {selected.isLate && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle size={12} />
                  <span className="font-medium">Late — {selected.lateReason?.replace("_", " ")}</span>
                </div>
              )}
              {selected.status === "DELIVERED" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">SMS Notification</p>
                  <SmsStatusBadge order={selected} onRetry={() => { setSelected(null); fetchOrders(); }} />
                  {selected.smsDeliveredError && selected.smsDeliveredStatus === "FAILED" && (
                    <p className="text-[10px] text-red-500 mt-1">{selected.smsDeliveredError}</p>
                  )}
                </div>
              )}
              {selected.requestedByName && (
                <p className="text-[11px] text-slate-400">Requested by <span className="font-medium text-slate-500">{selected.requestedByName}</span></p>
              )}
              {selected.orderNumber && (
                <p className="font-mono text-[11px] text-slate-300">{selected.orderNumber}</p>
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50 flex gap-2">
              <button onClick={() => setSelected(null)}
                className="flex-1 px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors">
                Close
              </button>
              {STATUS_CONFIG[selected.status]?.next && (
                <button onClick={() => { updateStatus(selected, STATUS_CONFIG[selected.status].next); setSelected(null); }}
                  className="flex-1 px-3 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
                  {STATUS_CONFIG[selected.status].nextLabel}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
