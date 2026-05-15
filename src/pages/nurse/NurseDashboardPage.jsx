import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, query, where, getDocs, limit } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { ClipboardList, Users, Clock, CheckCircle, AlertTriangle, Plus } from "lucide-react";
import { format } from "date-fns";

const PERIOD_BADGE = {
  BREAKFAST: "bg-amber-50 text-amber-700 border-amber-200",
  LUNCH: "bg-blue-50 text-blue-700 border-blue-200",
  SUPPER: "bg-purple-50 text-purple-700 border-purple-200",
};

const MEAL_PERIOD_LABELS = {
  BREAKFAST: "Breakfast",
  LUNCH: "Lunch",
  SUPPER: "Supper",
};

const STATUS_COLORS = {
  REQUESTED: "bg-orange-50 text-orange-700",
  APPROVED: "bg-blue-50 text-blue-700",
  PREPARING: "bg-yellow-50 text-yellow-700",
  DELIVERED: "bg-emerald-50 text-emerald-700",
  CANCELLED: "bg-red-50 text-red-700",
};

const STATUS_DOTS = {
  REQUESTED: "bg-orange-500",
  APPROVED: "bg-blue-500",
  PREPARING: "bg-amber-500",
  DELIVERED: "bg-emerald-500",
  CANCELLED: "bg-red-500",
};

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function NurseDashboardPage() {
  const { userProfile, assignedWards } = useAuth();
  const [todayOrders, setTodayOrders] = useState([]);
  const [patientCount, setPatientCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [wardNames, setWardNames] = useState([]);
  const [wardNamesLoading, setWardNamesLoading] = useState(true);

  const today = format(new Date(), "yyyy-MM-dd");
  const dayName = format(new Date(), "EEEE, MMMM d");
  const firstName = userProfile?.fullName?.split(" ")[0] || "Nurse";

  useEffect(() => {
    let active = true;

    async function loadWardNames() {
      if (assignedWards.length === 0) {
        if (active) {
          setWardNames([]);
          setWardNamesLoading(false);
        }
        return;
      }

      if (active) setWardNamesLoading(true);
      try {
        const snap = await getDocs(collection(db, "wards"));
        const wardMap = new Map();
        snap.docs.forEach((wardDoc) => {
          const ward = wardDoc.data();
          wardMap.set(wardDoc.id, ward?.name || wardDoc.id);
          if (ward?.name) {
            wardMap.set(ward.name, ward.name);
          }
        });
        const nextWardNames = assignedWards.map((ward) => wardMap.get(ward) || ward);
        if (active) setWardNames(nextWardNames);
      } catch {
        if (active) setWardNames([]);
      }
      if (active) setWardNamesLoading(false);
    }

    loadWardNames();

    async function load() {
      if (!userProfile) return;
      try {
        const wardIds = assignedWards;

        if (wardIds.length > 0) {
          const pSnap = await getDocs(
            query(
              collection(db, "patients"),
              where("wardId", "in", wardIds),
              where("status", "==", "ADMITTED")
            )
          );
          if (active) setPatientCount(pSnap.size);
        }

        if (wardIds.length === 0) {
          if (active) setTodayOrders([]);
          if (active) setLoading(false);
          return;
        }

        const chunkSize = 10;
        const chunks = [];
        for (let i = 0; i < wardIds.length; i += chunkSize) {
          chunks.push(wardIds.slice(i, i + chunkSize));
        }

        const orderSets = await Promise.all(
          chunks.map(async (chunk) => {
            const snap = await getDocs(
              query(
                collection(db, "wardMealOrders"),
                where("orderDate", "==", today),
                where("wardId", "in", chunk),
                limit(20)
              )
            );
            return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
          })
        );

        const merged = orderSets
          .flat()
          .sort((a, b) => (b.requestedAt?.seconds ?? 0) - (a.requestedAt?.seconds ?? 0));

        if (active) setTodayOrders(merged);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [userProfile, assignedWards, today]);

  const summary = {
    requested: todayOrders.filter((o) => o.status === "REQUESTED").length,
    delivered: todayOrders.filter((o) => o.status === "DELIVERED").length,
    late: todayOrders.filter((o) => o.isLate).length,
  };

  return (
    <div className="space-y-4 pb-6">
      {/* ── Header ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="lg:hidden text-[11px] font-semibold uppercase tracking-widest text-primary-600">
              {getGreeting()}
            </p>
            <h1 className="text-[22px] font-bold leading-tight text-slate-900 lg:text-xl">
              <span className="lg:hidden">{firstName}</span>
              <span className="hidden lg:inline">Ward Dashboard</span>
            </h1>
            <p className="mt-0.5 text-[12px] text-slate-500">{dayName}</p>
          </div>
          <Link
            to="/nurse/orders"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 active:scale-95"
          >
            <Plus size={14} />
            <span className="whitespace-nowrap">Place Orders</span>
          </Link>
        </div>

        {/* ── Ward pills ── */}
        {assignedWards.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Your Wards
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
              {wardNamesLoading ? (
                <>
                  <div className="h-8 w-24 shrink-0 animate-pulse rounded-full bg-slate-100" />
                  <div className="h-8 w-20 shrink-0 animate-pulse rounded-full bg-slate-100" />
                </>
              ) : (
                (wardNames.length > 0 ? wardNames : assignedWards).map((ward, i) => (
                  <span
                    key={ward}
                    className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold ${
                      i === 0
                        ? "border-primary-500 bg-primary-600 text-white"
                        : "border-slate-200 bg-white text-slate-700"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${i === 0 ? "bg-white/70" : "bg-primary-400"}`} />
                    {ward}
                  </span>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Stats strip ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="grid grid-cols-4 divide-x divide-slate-100">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex animate-pulse flex-col items-center gap-1.5 px-2 py-3.5">
                <div className="h-3.5 w-3.5 rounded bg-slate-200" />
                <div className="h-5 w-8 rounded bg-slate-200" />
                <div className="h-2 w-10 rounded bg-slate-200" />
              </div>
            ))
          ) : (
            <>
              <StatCell icon={Users} label="Admitted" value={patientCount} color="blue" />
              <StatCell icon={ClipboardList} label="Orders" value={todayOrders.length} color="violet" />
              <StatCell icon={Clock} label="Pending" value={summary.requested} color="amber" />
              <StatCell icon={CheckCircle} label="Done" value={summary.delivered} color="emerald" />
            </>
          )}
        </div>
      </div>

      {/* ── Late warning ── */}
      {summary.late > 0 && (
        <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle size={15} className="text-red-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-red-800">
              {summary.late} late order{summary.late !== 1 ? "s" : ""}
            </p>
            <p className="mt-0.5 text-[11px] text-red-600">Submitted after the meal cutoff time.</p>
          </div>
        </div>
      )}

      {/* ── Today's orders ── */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-slate-900">Today's Orders</h2>
          {!loading && todayOrders.length > 0 && (
            <Link to="/nurse/history" className="text-xs font-semibold text-primary-600 hover:text-primary-700">
              See all →
            </Link>
          )}
        </div>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <OrderSkeleton key={i} />
            ))}
          </div>
        ) : todayOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
              <ClipboardList size={22} className="text-slate-400" />
            </div>
            <p className="text-sm font-semibold text-slate-700">No orders yet today</p>
            <p className="mt-1 text-xs text-slate-400">Place meal orders for your patients</p>
            <Link
              to="/nurse/orders"
              className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
            >
              <Plus size={13} /> Place Orders
            </Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {todayOrders.map((order, idx) => (
              <div
                key={order.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-slate-50/70 ${
                  idx < todayOrders.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                {/* Avatar */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                  {order.patientName?.[0]?.toUpperCase() || "?"}
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-slate-900">{order.patientName}</p>
                    {order.isLate && (
                      <AlertTriangle size={11} className="shrink-0 text-amber-500" title="Late order" />
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bed {order.bedNumber}
                    <span className="mx-1 text-slate-300">·</span>
                    {order.wardName}
                  </p>
                </div>
                {/* Badges */}
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      PERIOD_BADGE[order.mealPeriod] || "border-slate-200 bg-slate-50 text-slate-600"
                    }`}
                  >
                    {MEAL_PERIOD_LABELS[order.mealPeriod] || order.mealPeriod}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      STATUS_COLORS[order.status] || "bg-slate-100 text-slate-600"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOTS[order.status] || "bg-slate-400"}`} />
                    {order.status[0] + order.status.slice(1).toLowerCase()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCell({ icon: Icon, label, value, color }) {
  const text = {
    blue: "text-blue-500",
    violet: "text-violet-500",
    amber: "text-amber-500",
    emerald: "text-emerald-500",
  };
  return (
    <div className="flex flex-col items-center gap-1 px-1 py-3.5">
      <Icon size={12} className={`mb-0.5 ${text[color] || text.blue}`} />
      <p className="text-lg font-bold leading-none text-slate-900 lg:text-[19px]">{value ?? "—"}</p>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
    </div>
  );
}

function OrderSkeleton() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="h-8 w-8 rounded-full bg-slate-200" />
        <div className="flex-1 space-y-1.5">
          <div className="h-3.5 w-32 rounded bg-slate-200" />
          <div className="h-2.5 w-20 rounded bg-slate-200" />
        </div>
        <div className="space-y-1.5">
          <div className="h-4 w-16 rounded-full bg-slate-200" />
          <div className="h-4 w-14 rounded-full bg-slate-200" />
        </div>
      </div>
    </div>
  );
}
