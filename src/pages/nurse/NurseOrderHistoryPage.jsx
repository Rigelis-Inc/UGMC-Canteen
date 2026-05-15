import { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { History, AlertTriangle, RefreshCw } from "lucide-react";
import { format, subDays } from "date-fns";

const STATUS_BADGE = {
  REQUESTED: "bg-orange-50 text-orange-700 border-orange-200",
  APPROVED:  "bg-blue-50 text-blue-700 border-blue-200",
  PREPARING: "bg-amber-50 text-amber-700 border-amber-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const STATUS_LABEL = {
  REQUESTED: "Requested",
  APPROVED:  "Approved",
  PREPARING: "Preparing",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

const PERIOD_DOT = {
  BREAKFAST: "bg-amber-400",
  LUNCH:     "bg-blue-400",
  SUPPER:    "bg-purple-400",
};

const CLASS_AVATAR = {
  VVIP:    "bg-purple-100 text-purple-700",
  VIP:     "bg-amber-100 text-amber-700",
  GENERAL: "bg-slate-100 text-slate-600",
};

const MEAL_PERIODS = ["BREAKFAST", "LUNCH", "SUPPER"];
const PERIOD_LABEL = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SUPPER: "Supper" };
const STATUSES = ["REQUESTED", "APPROVED", "PREPARING", "DELIVERED", "CANCELLED"];

export default function NurseOrderHistoryPage() {
  const { userProfile, assignedWards } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [wardFilter, setWardFilter] = useState("ALL");
  const [wardOptions, setWardOptions] = useState([]);

  const todayStr = format(new Date(), "yyyy-MM-dd");

  const setRange = (days) => {
    setDateFrom(format(subDays(new Date(), days), "yyyy-MM-dd"));
    setDateTo(todayStr);
  };

  const load = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      if (assignedWards.length === 0) { setOrders([]); return; }
      const chunkSize = 10;
      const chunks = [];
      for (let i = 0; i < assignedWards.length; i += chunkSize)
        chunks.push(assignedWards.slice(i, i + chunkSize));
      const sets = await Promise.all(chunks.map(async (chunk) => {
        const snap = await getDocs(query(collection(db, "wardMealOrders"), where("wardId", "in", chunk)));
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
      }));
      const merged = sets.flat().sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
      setOrders(merged);
      setWardOptions([...new Set(merged.map(o => o.wardName).filter(Boolean))].sort());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [userProfile, assignedWards]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    if (o.orderDate < dateFrom || o.orderDate > dateTo) return false;
    if (periodFilter !== "ALL" && o.mealPeriod !== periodFilter) return false;
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    if (wardFilter !== "ALL" && o.wardName !== wardFilter) return false;
    return true;
  });

  const grouped = MEAL_PERIODS.reduce((acc, p) => {
    acc[p] = filtered
      .filter(o => o.mealPeriod === p)
      .sort((a, b) => (b.createdAt?.seconds ?? 0) - (a.createdAt?.seconds ?? 0));
    return acc;
  }, {});

  const visiblePeriods = periodFilter === "ALL" ? MEAL_PERIODS : [periodFilter];

  const isToday = dateFrom === todayStr && dateTo === todayStr;
  const is7d    = dateFrom === format(subDays(new Date(), 7),  "yyyy-MM-dd") && dateTo === todayStr;
  const is30d   = dateFrom === format(subDays(new Date(), 30), "yyyy-MM-dd") && dateTo === todayStr;

  return (
    <div className="space-y-3 pb-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Order History</h1>
          <p className="mt-0.5 text-[12px] text-slate-500">Past meal orders for your ward</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 shadow-sm transition-colors hover:text-slate-700 disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* ── Controls ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm space-y-2.5">

        {/* Date range row */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-xl border border-slate-200 text-[11px] font-semibold">
            {[
              { label: "Today", active: isToday, handler: () => { setDateFrom(todayStr); setDateTo(todayStr); } },
              { label: "7d",    active: is7d,    handler: () => setRange(7)  },
              { label: "30d",   active: is30d,   handler: () => setRange(30) },
            ].map(({ label, active, handler }) => (
              <button
                key={label}
                type="button"
                onClick={handler}
                className={`px-3 py-1.5 transition-colors ${active ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
          <span className="text-[10px] text-slate-300">—</span>
          <input
            type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
          />
        </div>

        {/* Filter chips row */}
        <div className="flex flex-wrap items-center gap-2">

          {/* Period segmented control */}
          <div className="flex overflow-hidden rounded-xl border border-slate-200 text-[11px] font-semibold">
            {["ALL", ...MEAL_PERIODS].map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPeriodFilter(p)}
                className={`px-2.5 py-1.5 transition-colors ${periodFilter === p ? "bg-primary-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"}`}
              >
                {p === "ALL" ? "All" : p === "BREAKFAST" ? "Bkfst" : p === "LUNCH" ? "Lunch" : "Supper"}
              </button>
            ))}
          </div>

          {/* Status select */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
          >
            <option value="ALL">All statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>

          {/* Ward select */}
          {wardOptions.length > 1 && (
            <select
              value={wardFilter}
              onChange={e => setWardFilter(e.target.value)}
              className="rounded-xl border border-slate-200 px-2.5 py-1.5 text-[11px] focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="ALL">All wards</option>
              {wardOptions.map(w => <option key={w} value={w}>{w}</option>)}
            </select>
          )}

          <span className="ml-auto text-[10px] font-semibold text-slate-400">
            {filtered.length} order{filtered.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* ── Order log ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="divide-y divide-slate-50">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 px-3 py-2.5">
                <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-slate-100" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-2.5 w-28 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-2 w-20 animate-pulse rounded-full bg-slate-100" />
                </div>
                <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14">
            <History size={24} className="mb-2 text-slate-200" />
            <p className="text-xs font-semibold text-slate-400">No orders found</p>
            <p className="mt-0.5 text-[10px] text-slate-300">Adjust the filters or date range</p>
          </div>
        ) : (
          visiblePeriods.map((period) => {
            const periodOrders = grouped[period] || [];
            if (periodOrders.length === 0) return null;
            return (
              <section key={period} className="border-b border-slate-100 last:border-b-0">

                {/* Period header */}
                <div className="flex items-center gap-2 bg-slate-50/80 px-3 py-2">
                  <span className={`h-1.5 w-1.5 rounded-full ${PERIOD_DOT[period]}`} />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                    {PERIOD_LABEL[period]}
                  </span>
                  <span className="ml-auto rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold text-slate-500">
                    {periodOrders.length}
                  </span>
                </div>

                {/* Rows */}
                <div className="divide-y divide-slate-50">
                  {periodOrders.map((o) => {
                    const avatarCls = CLASS_AVATAR[o.patientClass] || CLASS_AVATAR.GENERAL;
                    const badge = STATUS_BADGE[o.status] || "bg-slate-50 text-slate-600 border-slate-200";
                    return (
                      <div
                        key={o.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-slate-50/80"
                      >
                        {/* Avatar */}
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${avatarCls}`}>
                          {o.patientName?.[0]?.toUpperCase()}
                        </div>

                        {/* Name + meal */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-baseline gap-1.5">
                            <p className="truncate text-xs font-semibold text-slate-800">{o.patientName}</p>
                            {(o.patientClass === "VIP" || o.patientClass === "VVIP") && (
                              <span className={`shrink-0 rounded px-1 text-[8px] font-bold ${o.patientClass === "VVIP" ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"}`}>
                                {o.patientClass}
                              </span>
                            )}
                            <span className="shrink-0 text-[10px] text-slate-400">· Bed {o.bedNumber}</span>
                          </div>
                          <p className="truncate text-[10px] text-slate-500">{o.mainMeal?.name || "—"}</p>
                        </div>

                        {/* Right: status + date */}
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <span className={`rounded-full border px-1.5 py-0.5 text-[9px] font-bold ${badge}`}>
                            {STATUS_LABEL[o.status] || o.status}
                          </span>
                          <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            {o.isLate && (
                              <AlertTriangle size={8} className="text-amber-400" title={o.lateReason} />
                            )}
                            <span>{o.orderDate}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>
    </div>
  );
}
