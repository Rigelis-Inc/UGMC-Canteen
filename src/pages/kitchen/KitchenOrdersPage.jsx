import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, updateDoc, addDoc, doc,
  serverTimestamp, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { sendDeliveredMealSms } from "../../lib/mealSms";
import { format, subDays } from "date-fns";
import { AlertTriangle, X, ChevronLeft, ChevronRight, Search, Filter, Clock, MapPin, UtensilsCrossed } from "lucide-react";

const PERIODS = ["ALL","BREAKFAST","LUNCH","SUPPER"];
const STATUSES = ["ALL","REQUESTED","PREPARING","DELIVERED","CANCELLED"];
const CLASSES = ["ALL","VVIP","VIP","GENERAL"];

const STATUS_COLORS = {
  REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  PREPARING: "bg-blue-50 text-blue-700 border-blue-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const PAGE_SIZE = 30;

function formatPatientStatus(value) {
  if (!value) return "";
  return value === "GENERAL" ? "General" : value;
}

function formatSpecialMeal(value) {
  if (!value || value === "NONE") return "Special";
  return value.replace(/_/g, " ");
}

function OrderMetaBadges({ order }) {
  const badges = [];
  if (order.patientClass) {
    badges.push({
      key: "class",
      label: formatPatientStatus(order.patientClass),
      className:
        order.patientClass === "VVIP"
          ? "bg-purple-50 text-purple-800 border-purple-200"
          : order.patientClass === "VIP"
          ? "bg-amber-50 text-amber-800 border-amber-200"
          : "bg-slate-50 text-slate-600 border-slate-200",
    });
  }
  if (order.isSpecialPatient) {
    badges.push({
      key: "diet",
      label: `Diet: ${formatSpecialMeal(order.specialMealType)}`,
      className: "bg-primary-50 text-primary-700 border-primary-200",
    });
  }
  if (order.specialInstructions) {
    badges.push({
      key: "note",
      label: `Note: ${order.specialInstructions}`,
      className: "bg-slate-50 text-slate-600 border-slate-200",
      title: order.specialInstructions,
    });
  }
  if (badges.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mt-1.5">
      {badges.map((badge) => (
        <span
          key={badge.key}
          title={badge.title}
          className={`inline-flex max-w-full items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${badge.className}`}
        >
          <span className="truncate">{badge.label}</span>
        </span>
      ))}
    </div>
  );
}

export default function KitchenOrdersPage() {
  const { currentUser, userProfile } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [classFilter, setClassFilter] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(null);
  const [showFilters, setShowFilters] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const constraints = [
        where("orderDate", ">=", dateFrom),
        where("orderDate", "<=", dateTo),
        orderBy("orderDate", "desc"),
      ];
      if (periodFilter !== "ALL") constraints.push(where("mealPeriod", "==", periodFilter));
      if (statusFilter !== "ALL") constraints.push(where("status", "==", statusFilter));
      const snap = await getDocs(query(collection(db, "wardMealOrders"), ...constraints));
      let docs = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.requestedAt?.seconds || 0) - (a.requestedAt?.seconds || 0));
      if (classFilter !== "ALL") docs = docs.filter(o => o.patientClass === classFilter);
      if (search.trim()) {
        const s = search.toLowerCase();
        docs = docs.filter(o =>
          o.patientName?.toLowerCase().includes(s) ||
          o.wardName?.toLowerCase().includes(s) ||
          o.orderNumber?.toLowerCase().includes(s)
        );
      }
      setOrders(docs);
      setPage(0);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, periodFilter, statusFilter, classFilter, search]);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(order, newStatus) {
    const now = serverTimestamp();
    const actorUid = currentUser?.uid;
    if (!actorUid) {
      console.error("Cannot update order status without an authenticated user.");
      return;
    }
    await updateDoc(doc(db, "wardMealOrders", order.id), { status: newStatus, updatedAt: now });
    await addDoc(collection(db, "mealOrderStatusLogs"), {
      orderId: order.id,
      previousStatus: order.status,
      newStatus,
      changedBy: actorUid,
      changedByName: userProfile.fullName || "",
      note: "Kitchen manual update",
      createdAt: serverTimestamp(),
    });
    if (newStatus === "DELIVERED") {
      await sendDeliveredMealSms(db, { ...order, status: newStatus }).catch((smsError) => {
        console.warn("Failed to send delivered SMS:", smsError);
      });
    }
    load();
  }

  const paged = orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);

  const stats = [
    { label: "Total Orders", value: orders.length, icon: UtensilsCrossed, color: "text-slate-700" },
    { label: "Requested", value: orders.filter(o => o.status === "REQUESTED").length, icon: Clock, color: "text-amber-600" },
    { label: "Delivered", value: orders.filter(o => o.status === "DELIVERED").length, icon: MapPin, color: "text-emerald-600" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meal Orders</h1>
          <p className="text-sm text-slate-500">All ward patient meal orders</p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
            showFilters
              ? "bg-primary-50 border-primary-200 text-primary-700"
              : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
          }`}
        >
          <Filter size={14} />
          Filters
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="bg-white rounded-lg border border-slate-200 p-3">
            <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
            <p className="mt-1 text-base font-semibold text-slate-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-slate-500 mb-1">From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Period</label>
              <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {PERIODS.map(p => <option key={p} value={p}>{p === "ALL" ? "All Periods" : p}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Status</label>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {STATUSES.map(s => <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Class</label>
              <select value={classFilter} onChange={e => setClassFilter(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
                {CLASSES.map(c => <option key={c} value={c}>{c === "ALL" ? "All Classes" : c}</option>)}
              </select>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search patient name, ward, order number…"
              className="w-full border border-slate-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">No orders match the selected filters.</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Order #</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Date</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Period</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Patient</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Ward / Bed</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Class</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Main Meal</th>
                    <th className="px-4 py-2.5 text-left font-medium text-slate-600 text-xs">Status</th>
                    <th className="px-4 py-2.5 text-right font-medium text-slate-600 text-xs">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paged.map(o => (
                    <tr key={o.id} className="hover:bg-slate-50 cursor-pointer transition-colors" onClick={() => setSelected(o)}>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{o.orderNumber}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{o.orderDate}</td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{o.mealPeriod}</td>
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-slate-800 text-sm">{o.patientName}</p>
                        <OrderMetaBadges order={o} />
                        {o.isLate && <span className="text-xs text-primary-600 flex items-center gap-1 mt-1"><AlertTriangle size={10} /> Late</span>}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 text-xs">{o.wardName}<br />Bed {o.bedNumber}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">{o.patientClass}</td>
                      <td className="px-4 py-2.5 font-medium text-slate-800 text-sm">{o.mainMeal?.name}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[o.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{o.status}</span>
                      </td>
                      <td className="px-4 py-2.5 text-right" onClick={e => e.stopPropagation()}>
                        {o.status === "REQUESTED" && (
                          <button onClick={() => updateStatus(o, "PREPARING")}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors">
                            Start
                          </button>
                        )}
                        {o.status === "PREPARING" && (
                          <button onClick={() => updateStatus(o, "DELIVERED")}
                            className="px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                            Deliver
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
                <span className="text-xs text-slate-500">{orders.length} orders · Page {page + 1} of {totalPages}</span>
                <div className="flex gap-2">
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                    className="p-1.5 rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                    className="p-1.5 rounded-md border border-slate-200 text-slate-600 disabled:opacity-40 hover:bg-slate-50 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setSelected(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Order Details</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="p-5 space-y-3 text-sm">
              <div className="flex items-center gap-2 mb-3">
                <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${STATUS_COLORS[selected.status] || "bg-slate-100 text-slate-600 border-slate-200"}`}>{selected.status}</span>
                <span className="font-mono text-xs text-slate-500">{selected.orderNumber}</span>
              </div>
              {[
                ["Date", selected.orderDate],
                ["Period", selected.mealPeriod],
                ["Patient", selected.patientName],
                ["Ward", selected.wardName],
                ["Bed", selected.bedNumber],
                selected.roomNumber && ["Room", selected.roomNumber],
                ["Class", selected.patientClass],
                selected.isSpecialPatient && ["Special Meal", formatSpecialMeal(selected.specialMealType)],
                ["Main Meal", selected.mainMeal?.name],
                selected.appetiser?.name && ["Appetiser", selected.appetiser.name],
                selected.dessert?.name && ["Dessert", selected.dessert.name],
                selected.specialInstructions && ["Instructions", selected.specialInstructions],
                selected.isLate && ["Late", `Yes — ${selected.lateReason?.replace("_"," ")}`],
                selected.requestedByName && ["Requested by", selected.requestedByName],
                selected.servedByName && ["Served by", selected.servedByName],
                selected.deliveredByName && ["Delivered by", selected.deliveredByName],
                selected.cancellationReason && ["Cancelled reason", selected.cancellationReason],
              ].filter(Boolean).map(([label, value]) => value ? (
                <div key={label} className="flex justify-between gap-4 py-1.5 border-b border-slate-50 last:border-0">
                  <span className="text-slate-500 flex-shrink-0 text-xs">{label}</span>
                  <span className="text-slate-800 font-medium text-right text-sm">{value}</span>
                </div>
              ) : null)}
            </div>
            <div className="px-5 py-3 border-t border-slate-100 flex gap-2">
              {selected.status === "REQUESTED" && (
                <button onClick={() => { updateStatus(selected, "PREPARING"); setSelected(null); }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-primary-600 hover:bg-primary-700 text-white transition-colors">
                  Start Preparing
                </button>
              )}
              {selected.status === "PREPARING" && (
                <button onClick={() => { updateStatus(selected, "DELIVERED"); setSelected(null); }}
                  className="flex-1 px-3 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors">
                  Mark Delivered
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
