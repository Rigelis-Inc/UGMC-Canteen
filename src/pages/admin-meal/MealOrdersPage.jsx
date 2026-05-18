import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, updateDoc, addDoc, doc,
  serverTimestamp, getDoc
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { sendDeliveredMealSms } from "../../lib/mealSms";
import SmsStatusBadge from "../../components/common/SmsStatusBadge";
import { format, subDays } from "date-fns";
import {
  AlertTriangle, X, ChevronLeft, ChevronRight, ChevronDown,
  RefreshCw, Radio, Clock, Crown, Bell, Send
} from "lucide-react";

const PERIODS = ["BREAKFAST", "LUNCH", "SUPPER"];
const PERIOD_LABEL = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SUPPER: "Supper" };
const STATUSES = ["ALL", "REQUESTED", "PREPARING", "DELIVERED", "CANCELLED"];
const CLASSES = ["ALL", "GENERAL", "VIP", "VVIP", "SPECIAL", "PUREE", "NG_TUBE"];
const PAGE_SIZE = 30;
const LIVE_REFRESH_MS = 10000;

const STATUS_CONFIG = {
  REQUESTED: { label: "Requested", color: "text-amber-700 bg-amber-50 border-amber-200", dot: "bg-amber-500", next: "PREPARING", nextLabel: "Start" },
  PREPARING: { label: "Preparing", color: "text-blue-700 bg-blue-50 border-blue-200", dot: "bg-blue-500", next: "DELIVERED", nextLabel: "Deliver" },
  DELIVERED: { label: "Delivered", color: "text-emerald-700 bg-emerald-50 border-emerald-200", dot: "bg-emerald-500", next: null, nextLabel: null },
  CANCELLED: { label: "Cancelled", color: "text-red-700 bg-red-50 border-red-200", dot: "bg-red-500", next: null, nextLabel: null },
};

const PRIORITY = { VVIP: 0, VIP: 1, SPECIAL: 2, GENERAL: 3 };
const PERIOD_CUTOFF_KEYS = {
  BREAKFAST: "breakfastCutoffTime",
  LUNCH: "lunchCutoffTime",
  SUPPER: "supperCutoffTime",
};
const PERIOD_DEFAULT_CUTOFFS = { BREAKFAST: "05:30", LUNCH: "11:30", SUPPER: "16:30" };

function getCurrentPeriod(settings) {
  const now = new Date();
  const cutoffs = PERIODS.map(p => {
    const key = PERIOD_CUTOFF_KEYS[p];
    const val = settings?.[key] || PERIOD_DEFAULT_CUTOFFS[p];
    const [hh, mm] = val.split(":").map(Number);
    const cutoff = new Date();
    cutoff.setHours(hh, mm, 0, 0);
    return { period: p, cutoff };
  });
  for (const { period, cutoff } of cutoffs) {
    if (now < cutoff) return period;
  }
  return "SUPPER";
}

function sortOrders(orders) {
  return [...orders].sort((a, b) => {
    if (a.isLate && !b.isLate) return -1;
    if (!a.isLate && b.isLate) return 1;
    const pA = PRIORITY[a.patientClass] ?? 3;
    const pB = PRIORITY[b.patientClass] ?? 3;
    if (pA !== pB) return pA - pB;
    return (a.requestedAt?.seconds || 0) - (b.requestedAt?.seconds || 0);
  });
}

const today = format(new Date(), "yyyy-MM-dd");

function formatSpecialMeal(value) {
  if (!value || value === "NONE") return "Special";
  return value.replace(/_/g, " ");
}

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status];
  if (!config) return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-medium border ${config.color}`}>
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

export default function MealOrdersPage() {
  const { currentUser, userProfile } = useAuth();
  const [mode, setMode] = useState("live");

  const [liveOrders, setLiveOrders] = useState([]);
  const [liveLoading, setLiveLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [settings, setSettings] = useState(null);
  const [periodTab, setPeriodTab] = useState(() => getCurrentPeriod(null));
  const [refreshing, setRefreshing] = useState(false);
  const [savingOrderId, setSavingOrderId] = useState(null);
  const [selected, setSelected] = useState(null);
  const [bulkSmsResult, setBulkSmsResult] = useState(null);
  const [expandedWards, setExpandedWards] = useState(new Set());
  const [selectedIds, setSelectedIds] = useState(new Set());

  const [histOrders, setHistOrders] = useState([]);
  const [histLoading, setHistLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(today);
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [histStatusFilter, setHistStatusFilter] = useState("ALL");
  const [histWardFilter, setHistWardFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // Load settings
  useEffect(() => {
    getDoc(doc(db, "settings", "mealOrdering")).then(snap => {
      if (snap.exists()) {
        const data = snap.data();
        setSettings(data);
        setPeriodTab(getCurrentPeriod(data));
      }
    });
  }, []);

  const fetchLive = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const snap = await getDocs(query(collection(db, "wardMealOrders"), where("orderDate", "==", today)));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLiveOrders(sortOrders(docs));
      setLastRefresh(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      setLiveLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const id = setInterval(fetchLive, LIVE_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchLive]);

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const snap = await getDocs(query(collection(db, "wardMealOrders"), where("orderDate", ">=", dateFrom), where("orderDate", "<=", dateTo)));
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        if (a.orderDate !== b.orderDate) return a.orderDate > b.orderDate ? -1 : 1;
        return (b.requestedAt?.seconds ?? 0) - (a.requestedAt?.seconds ?? 0);
      });
      if (periodFilter !== "ALL") docs = docs.filter(o => o.mealPeriod === periodFilter);
      if (histStatusFilter !== "ALL") docs = docs.filter(o => o.status === histStatusFilter);
      if (histWardFilter !== "ALL") docs = docs.filter(o => o.wardName === histWardFilter);
      if (search.trim()) {
        const s = search.toLowerCase();
        docs = docs.filter(o => o.patientName?.toLowerCase().includes(s) || o.wardName?.toLowerCase().includes(s) || o.orderNumber?.toLowerCase().includes(s));
      }
      setHistOrders(docs);
      setPage(0);
    } catch (e) {
      console.error(e);
    } finally {
      setHistLoading(false);
    }
  }, [dateFrom, dateTo, periodFilter, histStatusFilter, histWardFilter, search]);

  useEffect(() => {
    if (mode === "history") fetchHistory();
  }, [mode, fetchHistory]);

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
      if (mode === "live") fetchLive(); else fetchHistory();
    } catch (e) {
      console.error(e);
      if (mode === "live") fetchLive(); else fetchHistory();
    } finally {
      setSavingOrderId(null);
    }
  }

  async function bulkUpdateStatus(newStatus) {
    const actorUid = currentUser?.uid;
    if (!actorUid || selectedIds.size === 0) return;
    
    const updates = { status: newStatus, updatedAt: serverTimestamp() };
    if (newStatus === "DELIVERED") {
      updates.deliveredBy = actorUid;
      updates.deliveredByName = userProfile.fullName || "";
      updates.deliveredAt = serverTimestamp();
    }

    setSavingOrderId("bulk");
    try {
      const promises = Array.from(selectedIds).map(id => 
        updateDoc(doc(db, "wardMealOrders", id), updates)
      );
      await Promise.all(promises);
      
      const logPromises = Array.from(selectedIds).map(id => {
        const order = liveOrders.find(o => o.id === id);
        return addDoc(collection(db, "mealOrderStatusLogs"), {
          orderId: id, previousStatus: order?.status, newStatus,
          changedBy: actorUid, changedByName: userProfile.fullName || "", note: "Bulk update", createdAt: serverTimestamp(),
        });
      });
      await Promise.all(logPromises);

      if (newStatus === "DELIVERED") {
        const smsResults = { total: selectedIds.size, sent: 0, failed: 0 };
        await Promise.all(
          Array.from(selectedIds).map((id) => {
            const order = liveOrders.find((item) => item.id === id);
            if (!order) return Promise.resolve();
            return sendDeliveredMealSms(db, { ...order, status: newStatus })
              .then(() => { smsResults.sent++; })
              .catch((smsError) => {
                smsResults.failed++;
                console.warn("Failed to send delivered SMS:", smsError);
              });
          })
        );
        setBulkSmsResult(smsResults);
        setTimeout(() => setBulkSmsResult(null), 8000);
      }
      
      setSelectedIds(new Set());
      if (mode === "live") fetchLive(); else fetchHistory();
    } catch (e) {
      console.error(e);
      if (mode === "live") fetchLive(); else fetchHistory();
    } finally {
      setSavingOrderId(null);
    }
  }

  function toggleSelect(id) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === periodOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(periodOrders.map(o => o.id)));
    }
  }

  function toggleWard(ward) {
    setExpandedWards(prev => {
      const next = new Set(prev);
      if (next.has(ward)) next.delete(ward);
      else next.add(ward);
      return next;
    });
  }

  function expandAllWards() {
    setExpandedWards(new Set(wardRows.map(w => w.ward)));
  }

  function collapseAllWards() {
    setExpandedWards(new Set());
  }

  async function cancelOrder(order) {
    const reason = prompt("Cancellation reason:");
    if (!reason) return;
    const actorUid = currentUser?.uid;
    if (!actorUid) return;
    setSavingOrderId(order.id);
    try {
      await updateDoc(doc(db, "wardMealOrders", order.id), {
        status: "CANCELLED", cancelledBy: actorUid, cancelledByName: userProfile.fullName || "",
        cancelledAt: serverTimestamp(), cancellationReason: reason, updatedAt: serverTimestamp(),
      });
      if (mode === "live") fetchLive(); else fetchHistory();
    } catch (e) {
      console.error(e);
      if (mode === "live") fetchLive(); else fetchHistory();
    } finally {
      setSavingOrderId(null);
    }
  }

  const wards = [...new Set(liveOrders.map(o => o.wardName).filter(Boolean))].sort();
  const periodRequestCounts = {};
  PERIODS.forEach(p => {
    periodRequestCounts[p] = liveOrders.filter(o => o.mealPeriod === p && o.status === "REQUESTED").length;
  });
  const totalRequested = liveOrders.filter(o => o.status === "REQUESTED").length;

  const periodOrders = liveOrders.filter(o => o.mealPeriod === periodTab && o.status !== "CANCELLED" && o.status !== "DELIVERED");

  const wardMap = {};
  periodOrders.forEach(o => {
    if (!wardMap[o.wardName]) {
      wardMap[o.wardName] = { ward: o.wardName, total: 0, requested: 0, preparing: 0, delivered: 0, late: 0, special: 0, vip: 0, vvip: 0 };
    }
    const r = wardMap[o.wardName];
    r.total++;
    if (o.status === "REQUESTED") r.requested++;
    if (o.status === "PREPARING") r.preparing++;
    if (o.status === "DELIVERED") r.delivered++;
    if (o.isLate) r.late++;
    if (o.isSpecialPatient) r.special++;
    if (o.patientClass === "VIP") r.vip++;
    if (o.patientClass === "VVIP") r.vvip++;
  });
  const wardRows = Object.values(wardMap).sort((a, b) => {
    if (b.requested !== a.requested) return b.requested - a.requested;
    return a.ward.localeCompare(b.ward);
  });

  const stats = {
    total: periodOrders.length,
    requested: periodOrders.filter(o => o.status === "REQUESTED").length,
    preparing: periodOrders.filter(o => o.status === "PREPARING").length,
  };

  const paged = histOrders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(histOrders.length / PAGE_SIZE);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Order Centre</h1>
          <p className="text-sm text-slate-500">
            {mode === "live" ? format(new Date(), "EEEE, MMMM d, yyyy") : "Search and manage orders"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {mode === "live" && (
            <>
              <button onClick={() => fetchLive(true)} disabled={refreshing}
                className="relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">
                <Bell size={13} />
                {totalRequested > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-primary-600 text-white text-[9px] font-bold flex items-center justify-center">{totalRequested}</span>
                )}
              </button>
              <button onClick={() => fetchLive(true)} disabled={refreshing}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-600 border border-slate-200 rounded-md hover:bg-slate-50 disabled:opacity-50">
                <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
                Refresh
              </button>
            </>
          )}
          <div className="flex border border-slate-200 rounded-md overflow-hidden">
            <button onClick={() => setMode("live")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium ${mode === "live" ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Radio size={11} /> Live
            </button>
            <button onClick={() => setMode("history")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border-l border-slate-200 ${mode === "history" ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
              <Clock size={11} /> History
            </button>
          </div>
        </div>
      </div>

      {mode === "live" && (
        <>
          {/* Period tabs */}
          <div className="flex items-center gap-3 flex-wrap pt-1">
            <div className="flex border border-slate-200 rounded-md">
              {PERIODS.map((p, i) => {
                const count = periodRequestCounts[p] || 0;
                return (
                  <button key={p} onClick={() => setPeriodTab(p)}
                    className={`relative px-3 py-1.5 text-xs font-medium ${i > 0 ? "border-l border-slate-200" : ""} ${periodTab === p ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}>
                    {p[0] + p.slice(1).toLowerCase()}
                    {count > 0 && (
                      <span className={`absolute -top-1.5 -right-1.5 z-10 min-w-[16px] h-4 rounded-full text-[8px] font-bold flex items-center justify-center px-1 ${periodTab === p ? "bg-white text-primary-700" : "bg-primary-600 text-white"}`}>{count}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <div className="flex-1" />
            <p className="text-[11px] text-slate-400">
              {stats.total} active orders · {stats.requested} waiting · {stats.preparing} preparing
            </p>
          </div>

          {/* Attention Banner */}
          {stats.requested > 0 && (
            <div className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={18} className="text-amber-600" />
                <div>
                  <p className="text-sm font-bold text-amber-900">{stats.requested} order{stats.requested > 1 ? "s" : ""} need{stats.requested === 1 ? "s" : ""} attention</p>
                  <p className="text-xs text-amber-700">Across {new Set(periodOrders.filter(o => o.status === "REQUESTED").map(o => o.wardName)).size} ward{new Set(periodOrders.filter(o => o.status === "REQUESTED").map(o => o.wardName)).size !== 1 ? "s" : ""}</p>
                </div>
              </div>
              <button onClick={() => setStatusFilter("REQUESTED")}
                className="ml-auto px-3 py-1.5 text-xs font-semibold text-amber-900 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors">
                View Pending
              </button>
            </div>
          )}

          {/* Bulk Actions */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 bg-primary-50 border border-primary-200 rounded-lg px-4 py-2">
              <span className="text-xs font-semibold text-primary-700">{selectedIds.size} selected</span>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => bulkUpdateStatus("PREPARING")} disabled={savingOrderId === "bulk"}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg disabled:opacity-50 transition-colors">
                  Mark Preparing
                </button>
                <button onClick={() => bulkUpdateStatus("DELIVERED")} disabled={savingOrderId === "bulk"}
                  className="px-3 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 transition-colors">
                  Mark Delivered
                </button>
                <button onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1.5 text-xs font-medium text-primary-700 hover:bg-primary-100 rounded-lg transition-colors">
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Bulk SMS Result Banner */}
          {bulkSmsResult && (
            <div className={`flex items-center gap-3 rounded-lg px-4 py-2.5 border ${
              bulkSmsResult.failed === 0
                ? "bg-blue-50 border-blue-200"
                : bulkSmsResult.sent === 0
                  ? "bg-red-50 border-red-200"
                  : "bg-amber-50 border-amber-200"
            }`}>
              <Send size={15} className={bulkSmsResult.failed === 0 ? "text-blue-600" : "text-amber-600"} />
              <div>
                <span className="text-xs font-medium">
                  {bulkSmsResult.failed === 0
                    ? `${bulkSmsResult.sent} SMS dispatched to NALO`
                    : bulkSmsResult.sent === 0
                      ? `SMS failed for all ${bulkSmsResult.failed} patient${bulkSmsResult.failed !== 1 ? "s" : ""}`
                      : `${bulkSmsResult.sent} SMS dispatched, ${bulkSmsResult.failed} failed`}
                </span>
                {bulkSmsResult.failed === 0 && (
                  <p className="text-[10px] text-blue-600 mt-0.5">Carrier delivery may take a moment — check SMS status in order details if needed.</p>
                )}
              </div>
              <button onClick={() => setBulkSmsResult(null)} className="ml-auto p-0.5 rounded hover:bg-black/5">
                <X size={12} />
              </button>
            </div>
          )}

          {/* Ward Grouped Orders */}
          {liveLoading ? (
            <div className="text-center text-slate-400 text-sm py-16">Loading orders…</div>
          ) : wardRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center text-slate-400 text-sm">No orders for this period.</div>
          ) : (
            <div className="space-y-2">
              {/* Expand/Collapse All */}
              <div className="flex justify-end gap-2">
                <button onClick={expandAllWards} className="text-[10px] font-medium text-slate-500 hover:text-slate-700">Expand All</button>
                <span className="text-slate-300">·</span>
                <button onClick={collapseAllWards} className="text-[10px] font-medium text-slate-500 hover:text-slate-700">Collapse All</button>
              </div>

              {wardRows.map(ward => {
                const isExpanded = expandedWards.has(ward.ward);
                const wardOrders = periodOrders.filter(o => o.wardName === ward.ward);
                return (
                  <div key={ward.ward} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                    {/* Ward Header - Clickable */}
                    <button onClick={() => toggleWard(ward.ward)}
                      className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-3">
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
                        <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center">
                          <span className="text-xs font-bold text-slate-600">{ward.ward.charAt(0)}</span>
                        </div>
                        <div className="text-left">
                          <h3 className="text-sm font-bold text-slate-900">{ward.ward}</h3>
                          <p className="text-[10px] text-slate-500">{ward.total} orders · {ward.requested} pending</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {ward.requested > 0 && (
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-bold">{ward.requested} pending</span>
                        )}
                      </div>
                    </button>

                    {/* Expanded Orders */}
                    {isExpanded && (
                      <div className="border-t border-slate-100">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 border-b border-slate-100">
                              <th className="px-3 py-2 w-10">
                                <input type="checkbox" 
                                  checked={wardOrders.every(o => selectedIds.has(o.id)) && wardOrders.length > 0}
                                  onChange={() => {
                                    const wardIds = wardOrders.map(o => o.id);
                                    const allSelected = wardIds.every(id => selectedIds.has(id));
                                    setSelectedIds(prev => {
                                      const next = new Set(prev);
                                      wardIds.forEach(id => allSelected ? next.delete(id) : next.add(id));
                                      return next;
                                    });
                                  }}
                                  className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                              </th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Patient</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Bed</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Meal</th>
                              <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                              <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-50">
                            {wardOrders.map(o => (
                              <tr key={o.id} className={`hover:bg-slate-50/60 transition-colors ${selectedIds.has(o.id) ? "bg-primary-50/40" : ""}`}>
                                <td className="px-3 py-2">
                                  <input type="checkbox" checked={selectedIds.has(o.id)} onChange={() => toggleSelect(o.id)} className="rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                                </td>
                                <td className="px-3 py-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-semibold text-slate-800">{o.patientName}</span>
                                    <PatientClassBadge patientClass={o.patientClass} />
                                    {o.isLate && <AlertTriangle size={10} className="text-red-500 flex-shrink-0" />}
                                  </div>
                                  {o.specialInstructions && <p className="text-[9px] text-amber-600 mt-0.5 truncate max-w-[150px]" title={o.specialInstructions}>{o.specialInstructions}</p>}
                                </td>
                                <td className="px-3 py-2 text-xs text-slate-600">Bed {o.bedNumber}{o.roomNumber ? ` · Rm ${o.roomNumber}` : ""}</td>
                                <td className="px-3 py-2 text-xs font-medium text-slate-800">{o.mainMeal?.name}</td>
                                <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button onClick={() => setSelected(o)} className="px-2 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded transition-colors">
                                Details
                              </button>
                              {STATUS_CONFIG[o.status]?.next && (
                                <button onClick={() => updateStatus(o, STATUS_CONFIG[o.status].next)} disabled={savingOrderId === o.id}
                                  className="px-2 py-0.5 text-[10px] font-medium text-white bg-primary-600 hover:bg-primary-700 rounded disabled:opacity-50 transition-colors">
                                  {savingOrderId === o.id ? "…" : STATUS_CONFIG[o.status].nextLabel}
                                </button>
                              )}
                            </div>
                          </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {lastRefresh && (
            <p className="text-[11px] text-slate-400 text-right">Updated {format(lastRefresh, "HH:mm:ss")}</p>
          )}
        </>
      )}

      {mode === "history" && (
        <>
          <div className="border border-slate-200 rounded-lg bg-white p-3 flex flex-wrap gap-3">
            <div><label className="block text-[11px] text-slate-500 mb-0.5">From</label><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-0.5">To</label><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs" /></div>
            <div><label className="block text-[11px] text-slate-500 mb-0.5">Period</label><select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs">{["ALL", ...PERIODS].map(p => <option key={p} value={p}>{p === "ALL" ? "All" : p}</option>)}</select></div>
            <div><label className="block text-[11px] text-slate-500 mb-0.5">Status</label><select value={histStatusFilter} onChange={e => setHistStatusFilter(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs">{STATUSES.map(s => <option key={s} value={s}>{s === "ALL" ? "All" : s}</option>)}</select></div>
            <div><label className="block text-[11px] text-slate-500 mb-0.5">Ward</label><select value={histWardFilter} onChange={e => setHistWardFilter(e.target.value)} className="border border-slate-200 rounded px-2 py-1 text-xs"><option value="ALL">All Wards</option>{[...new Set(histOrders.map(o => o.wardName).filter(Boolean))].sort().map(w => <option key={w} value={w}>{w}</option>)}</select></div>
            <div className="flex-1 min-w-[200px]"><label className="block text-[11px] text-slate-500 mb-0.5">Search</label><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Patient, ward, order…" className="w-full border border-slate-200 rounded px-2 py-1 text-xs" /></div>
          </div>

          <div className="border border-slate-200 rounded-lg bg-white overflow-hidden">
            {histLoading ? (
              <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
            ) : histOrders.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">No orders match the filters.</div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Order #</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Date</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Patient</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Ward / Bed</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Meal</th>
                      <th className="text-left px-3 py-2 text-xs font-medium text-slate-500">Status</th>
                      <th className="text-right px-3 py-2 text-xs font-medium text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paged.map(o => {
                      const config = STATUS_CONFIG[o.status];
                      return (
                        <tr key={o.id} className="hover:bg-slate-50/50 cursor-pointer" onClick={() => setSelected(o)}>
                          <td className="px-3 py-2 font-mono text-[11px] text-slate-500">{o.orderNumber}</td>
                          <td className="px-3 py-2 text-xs text-slate-600">{o.orderDate}</td>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-900 text-xs">{o.patientName}</span>
                            <PatientClassBadge patientClass={o.patientClass} />
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">{o.wardName} · Bed {o.bedNumber}{o.roomNumber ? ` · Rm ${o.roomNumber}` : ""}</td>
                          <td className="px-3 py-2 text-xs text-slate-800">{o.mainMeal?.name}</td>
                          <td className="px-3 py-2"><StatusBadge status={o.status} /></td>
                          <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                            {config?.next && (
                              <button onClick={() => updateStatus(o, config.next)}
                                className="px-2.5 py-1 text-xs font-medium text-white bg-primary-600 hover:bg-primary-700 rounded transition-colors">
                                {config.nextLabel}
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-3 py-2 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">{histOrders.length} orders · Page {page + 1} of {totalPages}</span>
                    <div className="flex gap-1">
                      <button disabled={page === 0} onClick={() => setPage(p => p - 1)} className="p-1 rounded border border-slate-200 disabled:opacity-40"><ChevronLeft size={13} /></button>
                      <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} className="p-1 rounded border border-slate-200 disabled:opacity-40"><ChevronRight size={13} /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
            {/* Header: Patient + Status */}
            <div className="px-5 py-4 border-b border-slate-100">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-base font-bold text-slate-900 truncate">{selected.patientName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{selected.wardName} · Bed {selected.bedNumber}{selected.roomNumber ? ` · Rm ${selected.roomNumber}` : ""}</p>
                </div>
                <StatusBadge status={selected.status} />
              </div>
              {selected.patientClass && selected.patientClass !== "GENERAL" && (
                <div className="mt-2"><PatientClassBadge patientClass={selected.patientClass} /></div>
              )}
            </div>

            {/* Meal - most important */}
            <div className="px-5 py-4 bg-slate-50">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Meal</p>
              <p className="text-base font-bold text-slate-900">{selected.mainMeal?.name}</p>
              <p className="text-xs text-slate-500 mt-0.5">{PERIOD_LABEL[selected.mealPeriod]}</p>
            </div>

            {/* Details */}
            <div className="px-5 py-4 space-y-3">
              {/* Extras */}
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

              {/* Special instructions - critical */}
              {selected.specialInstructions && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 mb-0.5">Special Instructions</p>
                  <p className="text-sm font-semibold text-amber-900">{selected.specialInstructions}</p>
                </div>
              )}

              {/* Late */}
              {selected.isLate && (
                <div className="flex items-center gap-2 text-xs text-red-600">
                  <AlertTriangle size={12} />
                  <span className="font-medium">Late — {selected.lateReason?.replace("_", " ")}</span>
                </div>
              )}

              {/* SMS Delivery Status */}
              {selected.status === "DELIVERED" && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">SMS Notification</p>
                  <SmsStatusBadge order={selected} onRetry={() => {
                    setSelected(null);
                    if (mode === "live") fetchLive(); else fetchHistory();
                  }} />
                  {selected.smsDeliveredError && selected.smsDeliveredStatus === "FAILED" && (
                    <p className="text-[10px] text-red-500 mt-1">{selected.smsDeliveredError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Footer: Action */}
            {STATUS_CONFIG[selected.status]?.next && (
              <div className="px-5 py-3 border-t border-slate-100 bg-slate-50">
                <button onClick={() => { updateStatus(selected, STATUS_CONFIG[selected.status].next); setSelected(null); }}
                  className="w-full px-3 py-2.5 text-sm font-semibold text-white bg-primary-600 hover:bg-primary-700 rounded-lg transition-colors">
                  {STATUS_CONFIG[selected.status].nextLabel}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
