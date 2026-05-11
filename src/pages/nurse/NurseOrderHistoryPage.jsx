import { useEffect, useState, useCallback } from "react";
import { collection, query, where, getDocs, orderBy } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { History, AlertTriangle } from "lucide-react";
import { format, subDays } from "date-fns";

const STATUS_COLORS = {
  REQUESTED: "bg-orange-100 text-orange-700",
  APPROVED: "bg-blue-100 text-blue-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  SERVED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

const PERIOD_COLORS = {
  BREAKFAST: "bg-amber-50 text-amber-700 border-amber-200",
  LUNCH: "bg-blue-50 text-blue-700 border-blue-200",
  SUPPER: "bg-purple-50 text-purple-700 border-purple-200",
};

export default function NurseOrderHistoryPage() {
  const { userProfile, assignedWards } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const load = useCallback(async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      let q;
      if (assignedWards.length > 0) {
        q = query(collection(db, "wardMealOrders"),
          where("wardId", "in", assignedWards.slice(0, 10)),
          orderBy("createdAt", "desc"));
      } else {
        q = query(collection(db, "wardMealOrders"),
          where("requestedBy", "==", userProfile.uid),
          orderBy("createdAt", "desc"));
      }
      const snap = await getDocs(q);
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [userProfile, assignedWards]);

  useEffect(() => { load(); }, [load]);

  const filtered = orders.filter(o => {
    if (o.orderDate < dateFrom || o.orderDate > dateTo) return false;
    if (periodFilter !== "ALL" && o.mealPeriod !== periodFilter) return false;
    if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Order History</h1>
        <p className="text-sm text-slate-500">View past meal orders for your ward</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">From</label>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">To</label>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Meal Period</label>
          <select value={periodFilter} onChange={e => setPeriodFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="ALL">All periods</option>
            <option value="BREAKFAST">Breakfast</option>
            <option value="LUNCH">Lunch</option>
            <option value="SUPPER">Supper</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Status</label>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="ALL">All statuses</option>
            {["REQUESTED","PREPARING","SERVED","DELIVERED","CANCELLED"].map(s =>
              <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>
            )}
          </select>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-slate-500">{filtered.length} order{filtered.length !== 1 ? "s" : ""} found</p>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center">
            <History size={32} className="mx-auto text-slate-300 mb-2" />
            <p className="text-slate-500 text-sm">No orders found for the selected period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Order #</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Period</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Patient</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Bed</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Main Meal</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
                  <th className="px-4 py-3 text-left font-medium text-slate-600">Late?</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(o => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.orderNumber}</td>
                    <td className="px-4 py-3 text-slate-600">{o.orderDate}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${PERIOD_COLORS[o.mealPeriod] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
                        {o.mealPeriod}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-800">{o.patientName}</td>
                    <td className="px-4 py-3 text-slate-600">{o.bedNumber}</td>
                    <td className="px-4 py-3 text-slate-700">{o.mainMeal?.name || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || "bg-slate-100 text-slate-600"}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {o.isLate ? (
                        <span title={o.lateReason} className="flex items-center gap-1 text-amber-600 text-xs">
                          <AlertTriangle size={12} /> {o.lateReason?.replace("_", " ")}
                        </span>
                      ) : <span className="text-slate-400 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
