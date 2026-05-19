import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection, query, where, updateDoc, addDoc, doc,
  serverTimestamp, getDocs
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { sendDeliveredMealSms } from "../../lib/mealSms";
import SmsStatusBadge from "../../components/common/SmsStatusBadge";
import { format } from "date-fns";
import {
  ChefHat, AlertTriangle, ChevronDown, BarChart2, RefreshCw,
  Clock, TrendingUp, Users, CheckCircle2, ArrowRight, ClipboardList,
  Crown, Flame, Timer, Filter, LayoutGrid, List, Building2
} from "lucide-react";
import ConfirmActionModal from "../../components/common/ConfirmActionModal";

const PERIODS = ["BREAKFAST", "LUNCH", "SUPPER"];
const PERIOD_LABEL = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SUPPER: "Supper" };
const PERIOD_TIME = { BREAKFAST: "6:00 AM", LUNCH: "12:00 PM", SUPPER: "5:00 PM" };

const STATUS_FLOW = {
  REQUESTED: { next: "PREPARING", label: "Start Preparing", color: "bg-amber-100 text-amber-700 border-amber-200", btnColor: "bg-amber-500 hover:bg-amber-600 text-white", btnIcon: Flame },
  PREPARING: { next: "DELIVERED", label: "Mark Delivered", color: "bg-blue-100 text-blue-700 border-blue-200", btnColor: "bg-blue-500 hover:bg-blue-600 text-white", btnIcon: ArrowRight },
  DELIVERED: { next: null, color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  CANCELLED: { next: null, color: "bg-red-50 text-red-600 border-red-200" },
};

const PRIORITY_ORDER = { VVIP: 0, VIP: 1, SPECIAL: 2, GENERAL: 3 };

function getPriority(order) {
  if (order.isLate) return -1;
  return PRIORITY_ORDER[order.patientClass] ?? 3;
}

function sortOrders(orders) {
  return [...orders].sort((a, b) => {
    const pA = getPriority(a);
    const pB = getPriority(b);
    if (pA !== pB) return pA - pB;
    return (a.requestedAt?.seconds || 0) - (b.requestedAt?.seconds || 0);
  });
}

function StatusBadge({ status, size = "sm" }) {
  const flow = STATUS_FLOW[status];
  if (!flow) return null;
  const sizeClasses = size === "xs" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-semibold border ${flow.color} ${sizeClasses}`}>
      {status === "DELIVERED" && <CheckCircle2 size={10} />}
      {status === "REQUESTED" && <Clock size={10} />}
      {status === "PREPARING" && <Flame size={10} />}
      {status}
    </span>
  );
}

function PatientClassBadge({ patientClass }) {
  if (!patientClass || patientClass === "GENERAL") return null;
  const styles = {
    VIP: "bg-amber-50 text-amber-700 border-amber-200",
    VVIP: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${styles[patientClass] || ""}`}>
      <Crown size={10} className={patientClass === "VVIP" ? "text-purple-500" : "text-amber-500"} />
      {patientClass}
    </span>
  );
}

function OrderCard({ order, onUpdate, onCancel }) {
  const flow = STATUS_FLOW[order.status];
  const isTerminal = ["DELIVERED", "CANCELLED"].includes(order.status);
  const Icon = flow?.btnIcon;

  return (
    <div className={`group relative bg-white rounded-xl border transition-all duration-200 hover:shadow-md ${
      order.isLate ? "border-primary-300 shadow-sm shadow-primary-100" : "border-slate-200 hover:border-slate-300"
    }`}>
      {/* Priority indicator bar */}
      {order.isLate && (
        <div className="absolute -top-px left-4 right-4 h-0.5 bg-gradient-to-r from-primary-400 to-primary-600 rounded-full" />
      )}
      {(order.patientClass === "VVIP" || order.patientClass === "VIP") && !order.isLate && (
        <div className={`absolute -top-px left-4 right-4 h-0.5 rounded-full ${
          order.patientClass === "VVIP" ? "bg-gradient-to-r from-purple-400 to-purple-600" : "bg-gradient-to-r from-amber-400 to-amber-500"
        }`} />
      )}

      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-slate-900 truncate">{order.patientName}</h3>
              <PatientClassBadge patientClass={order.patientClass} />
              {order.isLate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-100 text-primary-700 border border-primary-200">
                  <AlertTriangle size={9} /> Late
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Building2 size={11} />
                {order.wardName}
              </span>
              <span className="text-slate-300">·</span>
              <span>Bed {order.bedNumber}</span>
              {order.roomNumber && (
                <>
                  <span className="text-slate-300">·</span>
                  <span>Rm {order.roomNumber}</span>
                </>
              )}
            </div>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Meal details */}
        <div className="bg-slate-50 rounded-lg px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2 text-sm">
            <ChefHat size={14} className="text-slate-400 flex-shrink-0" />
            <span className="font-medium text-slate-800">{order.mainMeal?.name || "—"}</span>
          </div>
          {(order.appetiser?.name || order.dessert?.name) && (
            <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-500">
              {order.appetiser?.name && <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200">{order.appetiser.name}</span>}
              {order.dessert?.name && <span className="px-1.5 py-0.5 bg-white rounded border border-slate-200">{order.dessert.name}</span>}
            </div>
          )}
          {order.specialInstructions && (
            <div className="mt-1.5 text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded border border-primary-100">
              ⚠ {order.specialInstructions}
            </div>
          )}
        </div>

        {/* Actions */}
        {!isTerminal && (
          <div className="flex items-center gap-2">
            {flow?.next && (
              <button
                onClick={() => onUpdate(order, flow.next)}
                className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm hover:shadow ${flow.btnColor}`}
              >
                <Icon size={12} />
                {flow.label}
              </button>
            )}
            <button
              onClick={() => onCancel(order)}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-red-600 hover:bg-red-50 border border-slate-200 hover:border-red-200 transition-all"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Timestamp */}
        {order.requestedAt && (
          <div className="mt-2 text-[10px] text-slate-400 flex items-center gap-1">
            <Timer size={9} />
            {order.requestedAt?.seconds ? format(new Date(order.requestedAt.seconds * 1000), "HH:mm") : ""}
          </div>
        )}

        {/* SMS Delivery Status */}
        {order.status === "DELIVERED" && order.smsDeliveredStatus && (
          <div className="mt-2 pt-2 border-t border-slate-100">
            <SmsStatusBadge order={order} size="xs" />
          </div>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({ title, orders, count, color, onUpdate, onCancel, icon: Icon }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="flex flex-col min-w-0">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl mb-3 transition-colors ${color}`}
      >
        <Icon size={15} />
        <span className="font-semibold text-sm">{title}</span>
        <span className="ml-auto text-xs font-bold opacity-70">{count}</span>
        <ChevronDown size={14} className={`transition-transform ${collapsed ? "-rotate-90" : ""}`} />
      </button>
      {!collapsed && (
        <div className="space-y-2">
          {orders.map(o => (
            <OrderCard key={o.id} order={o} onUpdate={onUpdate} onCancel={onCancel} />
          ))}
        </div>
      )}
    </div>
  );
}

function FoodSummaryBar({ name, count, maxCount, rank }) {
  const width = maxCount > 0 ? (count / maxCount) * 100 : 0;
  const rankColors = ["bg-amber-400", "bg-slate-400", "bg-orange-400"];
  const rankBadge = rank < 3 ? (
    <span className={`w-5 h-5 rounded-full ${rankColors[rank]} text-white text-[10px] font-bold flex items-center justify-center shadow-sm`}>
      {rank + 1}
    </span>
  ) : (
    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-bold flex items-center justify-center">
      {rank + 1}
    </span>
  );

  return (
    <div className="flex items-center gap-3 group">
      {rankBadge}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm font-medium text-slate-700 truncate">{name}</span>
          <span className="text-sm font-bold text-slate-900 ml-2">{count}</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-500"
            style={{ width: `${width}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function WardGroup({ ward, orders, onUpdate, onCancel }) {
  const [expanded, setExpanded] = useState(false);
  const pending = orders.filter(o => o.status === "REQUESTED").length;
    const done = orders.filter(o => o.status === "DELIVERED").length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden transition-all hover:border-slate-300">
      <button
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
            <Building2 size={15} className="text-primary-600" />
          </div>
          <div className="text-left">
            <span className="font-semibold text-slate-800 text-sm">{ward}</span>
            <p className="text-[11px] text-slate-500">{orders.length} orders</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            {pending > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-medium">{pending} pending</span>}
            {done > 0 && <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{done} done</span>}
          </div>
          <ChevronDown size={15} className={`text-slate-400 transition-transform ${expanded ? "" : "-rotate-90"}`} />
        </div>
      </button>
      {expanded && (
        <div className="border-t border-slate-100 p-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
          {orders.map(o => (
            <OrderCard key={o.id} order={o} onUpdate={onUpdate} onCancel={onCancel} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function KitchenDashPage() {
  const { userProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodTab, setPeriodTab] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [viewMode, setViewMode] = useState("kanban");
  const [showLate, setShowLate] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const today = format(new Date(), "yyyy-MM-dd");
  const pollRef = useRef(null);

  const fetchOrders = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const q = query(collection(db, "wardMealOrders"), where("orderDate", "==", today));
      const snap = await getDocs(q);
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setOrders(sortOrders(docs));
      setLastRefresh(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, [today]);

  useEffect(() => {
    fetchOrders();
    pollRef.current = setInterval(() => fetchOrders(), 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchOrders]);

  async function updateStatus(order, newStatus) {
    const now = serverTimestamp();
    const updates = { status: newStatus, updatedAt: now };
    if (newStatus === "DELIVERED") {
      updates.deliveredBy = userProfile.uid;
      updates.deliveredByName = userProfile.fullName || "";
      updates.deliveredAt = now;
    }
    await updateDoc(doc(db, "wardMealOrders", order.id), updates);
    await addDoc(collection(db, "mealOrderStatusLogs"), {
      orderId: order.id,
      previousStatus: order.status,
      newStatus,
      changedBy: userProfile.uid,
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
    setCancelTarget(order);
  }

  async function confirmCancel() {
    if (!cancelTarget) return;
    const reason = window.prompt("Cancellation reason:");
    if (!reason) {
      setCancelTarget(null);
      return;
    }
    await updateDoc(doc(db, "wardMealOrders", cancelTarget.id), {
      status: "CANCELLED",
      cancelledBy: userProfile.uid,
      cancelledByName: userProfile.fullName || "",
      cancelledAt: serverTimestamp(),
      cancellationReason: reason,
      updatedAt: serverTimestamp(),
    });
    setCancelTarget(null);
    fetchOrders();
  }

  const filtered = orders.filter(o =>
    (periodTab === "ALL" || o.mealPeriod === periodTab) &&
    (statusFilter === "ALL" || o.status === statusFilter) &&
    (showLate ? o.isLate : true)
  );

  const activeOrders = filtered.filter(o => o.status !== "CANCELLED");
  const summary = {};
  activeOrders.forEach(o => {
    const key = o.mainMeal?.name || "Unknown";
    summary[key] = (summary[key] || 0) + 1;
  });
  const foodSummary = Object.entries(summary).sort((a, b) => b[1] - a[1]);
  const maxFoodCount = foodSummary[0]?.[1] || 1;

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

  const kanbanColumns = [
    { key: "REQUESTED", title: "Incoming", icon: Clock, color: "bg-amber-50 text-amber-700 border border-amber-200" },
    { key: "PREPARING", title: "Preparing", icon: Flame, color: "bg-blue-50 text-blue-700 border border-blue-200" },
    { key: "DELIVERED", title: "Delivered", icon: CheckCircle2, color: "bg-emerald-50 text-emerald-700 border border-emerald-200" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Kitchen Dashboard</h1>
          <p className="text-sm text-slate-500 mt-1">
            {format(new Date(), "EEEE, MMMM d, yyyy")}
            {lastRefresh && (
              <span className="ml-2 inline-flex items-center gap-1 text-slate-400">
                <span className={`w-1.5 h-1.5 rounded-full ${refreshing ? "bg-amber-400 animate-pulse" : "bg-emerald-400"}`} />
                Updated {format(lastRefresh, "HH:mm:ss")}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => fetchOrders(true)}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-white border border-slate-200 text-slate-600 hover:text-primary-600 hover:border-primary-300 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
          <div className="flex bg-slate-100 rounded-lg p-0.5">
            {[
              { key: "kanban", label: "Pipeline", icon: LayoutGrid },
              { key: "list", label: "List", icon: List },
              { key: "ward", label: "By Ward", icon: Building2 },
            ].map(v => (
              <button
                key={v.key}
                onClick={() => setViewMode(v.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  viewMode === v.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                <v.icon size={12} />
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {[
          { label: "Total Orders", value: stats.total, icon: ClipboardList, color: "from-slate-500 to-slate-600", bg: "bg-slate-50" },
          { label: "Incoming", value: stats.requested, icon: Clock, color: "from-amber-500 to-amber-600", bg: "bg-amber-50" },
          { label: "Preparing", value: stats.preparing, icon: Flame, color: "from-blue-500 to-blue-600", bg: "bg-blue-50" },
          { label: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50" },
          { label: "Late Orders", value: stats.late, icon: AlertTriangle, color: "from-primary-500 to-primary-600", bg: "bg-primary-50" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-slate-200 px-3 py-2">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-900 leading-none">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
          {["ALL", ...PERIODS].map(p => (
            <button
              key={p}
              onClick={() => setPeriodTab(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                periodTab === p
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {p === "ALL" ? "All Periods" : PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
        {viewMode !== "kanban" && (
          <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
            {[
              { key: "ALL", label: "All" },
              { key: "REQUESTED", label: "Requested" },
              { key: "PREPARING", label: "Preparing" },
              { key: "DELIVERED", label: "Delivered" },
            ].map(s => (
              <button
                key={s.key}
                onClick={() => setStatusFilter(s.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  statusFilter === s.key
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
        <button
          onClick={() => setShowLate(!showLate)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
            showLate
              ? "bg-primary-500 text-white border-primary-500 shadow-sm"
              : "bg-white text-slate-600 border-slate-200 hover:border-primary-300 hover:text-primary-600"
          }`}
        >
          <AlertTriangle size={12} />
          Late only
        </button>
      </div>

      {/* Kanban View */}
      {viewMode === "kanban" && (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {kanbanColumns.map(col => {
            const colOrders = filtered.filter(o => o.status === col.key);
            return (
              <div key={col.key} className="flex-1 min-w-[280px] max-w-sm">
                <KanbanColumn
                  title={col.title}
                  orders={colOrders}
                  count={colOrders.length}
                  color={col.color}
                  icon={col.icon}
                  onUpdate={updateStatus}
                  onCancel={cancelOrder}
                />
              </div>
            );
          })}
        </div>
      )}

      {/* List View */}
      {viewMode === "list" && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.length === 0 ? (
            <div className="col-span-full bg-white rounded-xl border border-slate-200 p-12 text-center">
              <ChefHat size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No orders for the selected filter.</p>
            </div>
          ) : (
            filtered.map(o => (
              <OrderCard key={o.id} order={o} onUpdate={updateStatus} onCancel={cancelOrder} />
            ))
          )}
        </div>
      )}

      {/* Ward View */}
      {viewMode === "ward" && (
        <div className="space-y-3">
          {Object.keys(wardGroups).length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center">
              <Building2 size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 font-medium">No orders yet today.</p>
            </div>
          ) : (
            Object.entries(wardGroups).map(([ward, wardOrders]) => (
              <WardGroup key={ward} ward={ward} orders={wardOrders} onUpdate={updateStatus} onCancel={cancelOrder} />
            ))
          )}
        </div>
      )}

      {/* Food Prep Summary */}
      {foodSummary.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center">
              <BarChart2 size={15} className="text-primary-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-800 text-sm">Food Preparation Summary</h2>
              <p className="text-[11px] text-slate-500">Quantities needed for active orders</p>
            </div>
          </div>
          <div className="space-y-3">
            {foodSummary.map(([name, count], idx) => (
              <FoodSummaryBar key={name} name={name} count={count} maxCount={maxFoodCount} rank={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Cancel Modal */}
      <ConfirmActionModal
        open={!!cancelTarget}
        title="Cancel Order"
        description={`Cancel the order for ${cancelTarget?.patientName}? This action cannot be undone.`}
        confirmLabel="Cancel Order"
        cancelLabel="Keep Order"
        tone="danger"
        icon={AlertTriangle}
        onConfirm={confirmCancel}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  );
}
