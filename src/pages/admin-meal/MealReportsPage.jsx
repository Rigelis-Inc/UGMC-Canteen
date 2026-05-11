import { useEffect, useState, useCallback, useRef } from "react";
import {
  collection, query, where, getDocs, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { format, subDays } from "date-fns";
import { Download, Printer } from "lucide-react";
import Layout from "../../components/layout/Layout";

const REPORT_TYPES = [
  { id: "daily", label: "Daily Summary" },
  { id: "ward", label: "By Ward" },
  { id: "meal", label: "By Meal" },
  { id: "period", label: "By Period" },
  { id: "late", label: "Late Orders" },
  { id: "class", label: "By Patient Class" },
];

const STATUS_COLORS = {
  REQUESTED: "bg-orange-100 text-orange-700",
  PREPARING: "bg-yellow-100 text-yellow-700",
  SERVED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-red-100 text-red-700",
};

export default function MealReportsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reportType, setReportType] = useState("daily");
  const printRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "wardMealOrders"),
        where("orderDate", ">=", dateFrom),
        where("orderDate", "<=", dateTo),
        orderBy("orderDate", "asc"),
        orderBy("requestedAt", "asc"),
      ));
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function handlePrint() {
    window.print();
  }

  function exportCSV() {
    const headers = [
      "Order #","Date","Day","Period","Ward","Bed","Room","Patient","Class",
      "Special","Meal Type","Main Meal","Appetiser","Dessert","Instructions",
      "Requested By","Served By","Delivered By","Status","Late","Late Reason","Price",
    ];
    const rows = orders.map(o => [
      o.orderNumber || "", o.orderDate || "", o.dayOfWeek || "", o.mealPeriod || "",
      o.wardName || "", o.bedNumber || "", o.roomNumber || "", o.patientName || "",
      o.patientClass || "", o.isSpecialPatient ? "Yes" : "No", o.specialMealType || "",
      o.mainMeal?.name || "", o.appetiser?.name || "", o.dessert?.name || "",
      o.specialInstructions || "", o.requestedByName || "", o.servedByName || "",
      o.deliveredByName || "", o.status || "", o.isLate ? "Yes" : "No",
      o.lateReason?.replace("_"," ") || "", (o.mainMeal?.price || 0).toFixed(2),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Meal Reports</h1>
            <p className="text-sm text-slate-500">Analyse and export ward meal order data</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrint}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 bg-white rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
              <Printer size={14} /> Print
            </button>
            <button onClick={exportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 transition-colors">
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap gap-4">
          <div>
            <label className="block text-xs text-slate-500 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">To</label>
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-xs text-slate-500 mb-1">Report Type</label>
            <select value={reportType} onChange={e => setReportType(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500">
              {REPORT_TYPES.map(r => <option key={r.id} value={r.id}>{r.label}</option>)}
            </select>
          </div>
        </div>

        {/* Summary cards */}
        {!loading && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total Orders", value: orders.length },
              { label: "Delivered", value: orders.filter(o => o.status === "DELIVERED").length },
              { label: "Late Orders", value: orders.filter(o => o.isLate).length },
              { label: "Cancelled", value: orders.filter(o => o.status === "CANCELLED").length },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="text-2xl font-bold text-slate-800">{s.value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Report View */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden" ref={printRef}>
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="font-semibold text-slate-800">
              {REPORT_TYPES.find(r => r.id === reportType)?.label} — {dateFrom} to {dateTo}
            </h2>
          </div>
          {loading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading…</div>
          ) : reportType === "daily" ? (
            <DailyReport orders={orders} />
          ) : reportType === "ward" ? (
            <GroupedReport orders={orders} groupKey="wardName" />
          ) : reportType === "meal" ? (
            <MealReport orders={orders} />
          ) : reportType === "period" ? (
            <GroupedReport orders={orders} groupKey="mealPeriod" />
          ) : reportType === "late" ? (
            <LateReport orders={orders} />
          ) : (
            <GroupedReport orders={orders} groupKey="patientClass" />
          )}
        </div>
      </div>
    </Layout>
  );
}

function DailyReport({ orders }) {
  const byDate = {};
  orders.forEach(o => { if (!byDate[o.orderDate]) byDate[o.orderDate] = []; byDate[o.orderDate].push(o); });
  return (
    <div className="divide-y divide-slate-100">
      {Object.entries(byDate).map(([date, items]) => (
        <div key={date} className="px-4 py-3">
          <div className="flex items-center gap-4 mb-2">
            <h3 className="font-medium text-slate-800">{date}</h3>
            <span className="text-xs text-slate-500">{items.length} orders</span>
            <span className="text-xs text-green-600">{items.filter(o => o.status === "DELIVERED").length} delivered</span>
            <span className="text-xs text-amber-600">{items.filter(o => o.isLate).length} late</span>
          </div>
          <div className="text-xs text-slate-500">
            {["BREAKFAST","LUNCH","SUPPER"].map(p => {
              const c = items.filter(o => o.mealPeriod === p).length;
              return c > 0 ? <span key={p} className="mr-3">{p}: {c}</span> : null;
            })}
          </div>
        </div>
      ))}
      {Object.keys(byDate).length === 0 && (
        <p className="px-4 py-6 text-center text-slate-400 text-sm">No orders in range.</p>
      )}
    </div>
  );
}

function GroupedReport({ orders, groupKey }) {
  const groups = {};
  orders.forEach(o => {
    const k = o[groupKey] || "Unknown";
    if (!groups[k]) groups[k] = [];
    groups[k].push(o);
  });
  return (
    <div className="divide-y divide-slate-100">
      {Object.entries(groups).sort((a,b) => b[1].length - a[1].length).map(([key, items]) => (
        <div key={key} className="px-4 py-3 flex items-center gap-4">
          <span className="font-medium text-slate-800 w-40 truncate">{key}</span>
          <span className="text-xs text-slate-500">{items.length} orders</span>
          <span className="text-xs text-green-600">{items.filter(o => o.status === "DELIVERED").length} delivered</span>
          <span className="text-xs text-red-500">{items.filter(o => o.status === "CANCELLED").length} cancelled</span>
          <span className="text-xs text-amber-600">{items.filter(o => o.isLate).length} late</span>
        </div>
      ))}
      {Object.keys(groups).length === 0 && (
        <p className="px-4 py-6 text-center text-slate-400 text-sm">No orders in range.</p>
      )}
    </div>
  );
}

function MealReport({ orders }) {
  const meals = {};
  orders.filter(o => o.status !== "CANCELLED").forEach(o => {
    const k = o.mainMeal?.name || "Unknown";
    meals[k] = (meals[k] || 0) + 1;
  });
  const sorted = Object.entries(meals).sort((a,b) => b[1] - a[1]);
  const max = sorted[0]?.[1] || 1;
  return (
    <div className="p-4 space-y-2">
      {sorted.map(([name, count]) => (
        <div key={name} className="flex items-center gap-3">
          <div className="w-40 text-sm text-slate-700 truncate">{name}</div>
          <div className="flex-1 h-6 bg-slate-100 rounded-md overflow-hidden">
            <div className="h-full bg-primary-500 rounded-md transition-all" style={{ width: `${(count / max) * 100}%` }} />
          </div>
          <span className="text-sm font-semibold text-slate-800 w-8 text-right">{count}</span>
        </div>
      ))}
      {sorted.length === 0 && <p className="text-center text-slate-400 text-sm py-4">No orders in range.</p>}
    </div>
  );
}

function LateReport({ orders }) {
  const late = orders.filter(o => o.isLate);
  if (!late.length) return <p className="px-4 py-6 text-center text-slate-400 text-sm">No late orders in range.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-100">
            <th className="px-4 py-3 text-left font-medium text-slate-600">Order #</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Date</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Period</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Patient</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Ward</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Reason</th>
            <th className="px-4 py-3 text-left font-medium text-slate-600">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {late.map(o => (
            <tr key={o.id} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-mono text-xs text-slate-500">{o.orderNumber}</td>
              <td className="px-4 py-3 text-slate-600">{o.orderDate}</td>
              <td className="px-4 py-3 text-xs text-slate-600">{o.mealPeriod}</td>
              <td className="px-4 py-3 font-medium text-slate-800">{o.patientName}</td>
              <td className="px-4 py-3 text-slate-600">{o.wardName}</td>
              <td className="px-4 py-3 text-xs text-amber-700">{o.lateReason?.replace("_"," ")}</td>
              <td className="px-4 py-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[o.status] || ""}`}>{o.status}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
