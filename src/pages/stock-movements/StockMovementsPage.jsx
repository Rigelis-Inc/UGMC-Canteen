import { useState, useEffect } from "react";
import { collection, getDocs, query, orderBy, limit, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { ArrowDownToLine, ArrowUpToLine, BarChart3, Calendar, Filter, X } from "lucide-react";
import Layout from "../../components/layout/Layout";

export default function StockMovementsPage() {
  const { userProfile, assignedStores } = useAuth();
  const [movements, setMovements] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState("");
  const [filterStore, setFilterStore] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    async function fetchData() {
      const [storesSnap] = await Promise.all([
        getDocs(collection(db, "stores")),
      ]);
      setStores(storesSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

      try {
        let q = query(collection(db, "stockMovements"), orderBy("createdAt", "desc"), limit(500));
        const snap = await getDocs(q);
        const data = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setMovements(data);
      } catch (err) {
        console.error("Error fetching movements:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const filtered = movements.filter((m) => {
    if (assignedStores.length > 0 && !["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role)) {
      if (!assignedStores.includes(m.storeId)) return false;
    }
    if (filterType && m.type !== filterType) return false;
    if (filterStore && m.storeId !== filterStore) return false;
    if (dateFrom && m.createdAt) {
      const d = m.createdAt.toDate();
      if (d < new Date(dateFrom)) return false;
    }
    if (dateTo && m.createdAt) {
      const d = m.createdAt.toDate();
      if (d > new Date(dateTo + "T23:59:59")) return false;
    }
    return true;
  });

  const typeConfig = {
    RECEIVE: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", icon: ArrowDownToLine },
    ISSUE: { bg: "bg-primary-100", text: "text-primary-700", dot: "bg-primary-500", icon: ArrowUpToLine },
    TRANSFER: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
    ADJUSTMENT: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
    DAMAGE: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
    EXPIRY: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  };

  const hasActiveFilters = filterType || filterStore || dateFrom || dateTo;

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Stock Movements</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Complete history of all stock transactions</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6 animate-fadeIn">
        <div className="p-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex items-center gap-2 text-gray-400 px-2">
              <Filter size={16} />
            </div>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="">All Types</option>
              <option value="RECEIVE">Receive</option>
              <option value="ISSUE">Issue</option>
              <option value="TRANSFER">Transfer</option>
              <option value="ADJUSTMENT">Adjustment</option>
              <option value="DAMAGE">Damage</option>
              <option value="EXPIRY">Expiry</option>
            </select>
            <select
              value={filterStore}
              onChange={(e) => setFilterStore(e.target.value)}
              className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
            >
              <option value="">All Stores</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-gray-400" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
              <span className="text-gray-400 text-sm">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 bg-gray-50/50"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={() => { setFilterType(""); setFilterStore(""); setDateFrom(""); setDateTo(""); }}
                className="flex items-center gap-1.5 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <X size={14} />
                Clear
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fadeIn">
        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading movements...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <BarChart3 size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">
              {movements.length === 0 ? "No movements recorded yet" : "No movements match your filters"}
            </p>
          </div>
        ) : (
          <>
            <div className="px-6 py-3 bg-gray-50/80 border-b border-gray-200 text-xs text-gray-500">
              Showing {filtered.length} of {movements.length} movements
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50/80 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Date</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Type</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Store</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                    <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Ref</th>
                    <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((m) => {
                    const config = typeConfig[m.type] || typeConfig.ADJUSTMENT;
                    const isNegative = ["ISSUE", "DAMAGE", "EXPIRY"].includes(m.type);
                    return (
                      <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-6 py-4 text-gray-500">
                          {m.createdAt?.toDate?.()?.toLocaleDateString() || "N/A"}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                            {m.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-gray-500">{m.storeName}</td>
                        <td className="px-6 py-4 font-medium text-gray-900">{m.productName}</td>
                        <td className={`px-6 py-4 text-right font-semibold ${isNegative ? "text-red-600" : "text-green-600"}`}>
                          {isNegative ? "-" : "+"}{m.quantity} {m.unit}
                        </td>
                        <td className="px-6 py-4 text-gray-500 font-mono text-xs">{m.referenceNumber || "—"}</td>
                        <td className="px-6 py-4 text-gray-500">{m.performedByName}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
