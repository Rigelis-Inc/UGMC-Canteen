import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, updateDoc, addDoc, doc,
  serverTimestamp, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { format, startOfDay, endOfDay, subDays } from "date-fns";
import { AlertTriangle, X, ChevronLeft, ChevronRight } from "lucide-react";
import Layout from "../../components/layout/Layout";

const PERIODS = ["ALL","BREAKFAST","LUNCH","SUPPER"];
const STATUSES = ["ALL","REQUESTED","PREPARING","SERVED","DELIVERED","CANCELLED"];
const CLASSES = ["ALL","GENERAL","VIP","VVIP","SPECIAL","PUREE","NG_TUBE"];

const STATUS_COLORS = {
  REQUESTED: "bg-orange-100 text-orange-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  SERVED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const PAGE_SIZE = 30;

export default function MealOrdersPage() {
  const { userProfile } = useAuth();
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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const constraints = [
        where("orderDate", ">=", dateFrom),
        where("orderDate", "<=", dateTo),
        orderBy("orderDate", "desc"),
        orderBy("requestedAt", "desc"),
      ];
      if (periodFilter !== "ALL") constraints.push(where("mealPeriod", "==", periodFilter));
      if (statusFilter !== "ALL") constraints.push(where("status", "==", statusFilter));
      const snap = await getDocs(query(collection(db, "wardMealOrders"), ...constraints));
      let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
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
    const updates = { status: newStatus, updatedAt: now };
    await updateDoc(doc(db, "wardMealOrders", order.id), updates);
    await addDoc(collection(db, "mealOrderStatusLogs"), {
      orderId: order.id,
      previousStatus: order.status,
      newStatus,
      changedBy: userProfile.uid,
      changedByName: userProfile.fullName || "",
      note: "Admin manual update",
      createdAt: serverTimestamp(),
    });
    load();
  }

  const paged = orders.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(orders.length / PAGE_SIZE);

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meal Orders</h1>
          <p className="text-sm text-slate-500">All ward patient meal orders</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
          <div className="sm:col-span-2 lg:col-span-5">
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search patient name, ward, order number…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
        </div>

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
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Order #</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Period</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Patient</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Ward / Bed</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Class</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Main Meal</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                      <th className="px-4 py-3 text-right font-medium text-slate-600">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {paged.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setSelected(o)}>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.orderNumber}</td>
                        <td className="px-4 py-3 text-slate-600">{o.orderDate}</td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{o.mealPeriod}</td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-slate-800">{o.patientName}</p>
                          {o.isLate && <span className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle size={10} /> Late</span>}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{o.wardName}<br />Bed {o.bedNumber}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{o.patientClass}</td>
                        <td className="px-4 py-3 font-medium text-slate-800">{o.mainMeal?.name}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || "bg-slate-100 text-slate-600"}`}>{o.status}</span>
                        </td>
                        <td className="px-4 py-3 text-right" onClick={e => e.stopPropagation()}>
                          {o.status === "REQUESTED" && (
                            <button onClick={() => updateStatus(o, "PREPARING")}
                              className="px-2.5 py-1 rounded-md text-xs font-medium bg-yellow-500 hover:bg-yellow-600 text-white transition-colors">
                              Approve
                            </button>
                          )}
                          {o.status === "PREPARING" && (
                            <button onClick={() => updateStatus(o, "SERVED")}
                              className="px-2.5 py-1 rounded-md text-xs font-medium bg-green-500 hover:bg-green-600 text-white transition-colors">
                              Served
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
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
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-800">Order Details</h2>
              <button onClick={() => setSelected(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="p-6 space-y-4 text-sm">
              <Row label="Order #" value={selected.orderNumber} mono />
              <Row label="Date" value={selected.orderDate} />
              <Row label="Period" value={selected.mealPeriod} />
              <Row label="Patient" value={selected.patientName} />
              <Row label="Ward" value={selected.wardName} />
              <Row label="Bed" value={selected.bedNumber} />
              {selected.roomNumber && <Row label="Room" value={selected.roomNumber} />}
              <Row label="Class" value={selected.patientClass} />
              <Row label="Main Meal" value={selected.mainMeal?.name} />
              {selected.appetiser?.name && <Row label="Appetiser" value={selected.appetiser.name} />}
              {selected.dessert?.name && <Row label="Dessert" value={selected.dessert.name} />}
              {selected.specialInstructions && <Row label="Instructions" value={selected.specialInstructions} />}
              {selected.isSpecialPatient && <Row label="Special Meal" value={selected.specialMealType} />}
              <Row label="Status" value={selected.status} />
              {selected.isLate && <Row label="Late" value={`Yes — ${selected.lateReason?.replace("_"," ")}`} />}
              {selected.requestedByName && <Row label="Requested by" value={selected.requestedByName} />}
              {selected.servedByName && <Row label="Served by" value={selected.servedByName} />}
              {selected.deliveredByName && <Row label="Delivered by" value={selected.deliveredByName} />}
              {selected.cancellationReason && <Row label="Cancelled — reason" value={selected.cancellationReason} />}
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

function Row({ label, value, mono }) {
  if (!value && value !== 0) return null;
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500 flex-shrink-0">{label}</span>
      <span className={`text-slate-800 font-medium text-right ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}
