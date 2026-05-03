import { useState, useEffect } from "react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { Download, FileText, Loader2, BarChart3, Calendar, Filter, X, ArrowUpToLine, ArrowDownToLine, TrendingUp, DollarSign } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import Layout from "../../components/layout/Layout";

const REPORT_TYPES = [
  { id: "all-movements", label: "All Stock Movements" },
  { id: "received", label: "Stock Received" },
  { id: "issued", label: "Stock Issued" },
  { id: "transferred", label: "Stock Transfers" },
  { id: "adjustments", label: "Adjustments & Damages" },
  { id: "stock-balance", label: "Stock Balance" },
  { id: "low-stock", label: "Low Stock Alert" },
  { id: "expiry", label: "Expiry Report" },
];

export default function ReportsPage() {
  const [reportType, setReportType] = useState("all-movements");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [filterStore, setFilterStore] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [stores, setStores] = useState([]);
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    async function fetchStores() {
      const snap = await getDocs(collection(db, "stores"));
      setStores(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    }
    fetchStores();
  }, []);

  async function generateReport() {
    setGenerating(true);
    setData([]);
    setSummary(null);
    try {
      const [movementsSnap, productsSnap] = await Promise.all([
        getDocs(collection(db, "stockMovements")),
        getDocs(collection(db, "storeProducts")),
      ]);
      const allMovements = movementsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const allProducts = productsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

      let results = [];
      let sum = null;

      if (reportType === "stock-balance") {
        results = allProducts;
        if (filterStore) results = results.filter((p) => p.storeId === filterStore);
        sum = {
          totalProducts: results.length,
          totalQty: results.reduce((s, p) => s + (p.quantityOnHand || 0), 0),
          totalValue: results.reduce((s, p) => s + (p.totalValue || 0), 0),
        };
      } else if (reportType === "low-stock") {
        results = allProducts.filter((p) => p.quantityOnHand > 0 && p.reorderLevel && p.quantityOnHand <= p.reorderLevel);
        if (filterStore) results = results.filter((p) => p.storeId === filterStore);
        sum = { totalProducts: results.length };
      } else if (reportType === "expiry") {
        const now = new Date();
        results = allProducts.filter((p) => {
          if (!p.expiryDate) return false;
          const d = p.expiryDate.toDate ? p.expiryDate.toDate() : new Date(p.expiryDate);
          return d <= new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
        });
        if (filterStore) results = results.filter((p) => p.storeId === filterStore);
        sum = { totalProducts: results.length };
      } else {
        const typeMap = {
          "all-movements": null,
          "received": "RECEIVE",
          "issued": "ISSUE",
          "transferred": "TRANSFER",
          "adjustments": ["ADJUSTMENT", "DAMAGE", "EXPIRY"],
        };
        const types = typeMap[reportType];
        results = allMovements;
        if (types) {
          if (Array.isArray(types)) {
            results = results.filter((m) => types.includes(m.type));
          } else {
            results = results.filter((m) => m.type === types);
          }
        }
        if (filterStore) results = results.filter((m) => m.storeId === filterStore);
        if (dateFrom) {
          results = results.filter((m) => {
            const d = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
            return d >= new Date(dateFrom);
          });
        }
        if (dateTo) {
          results = results.filter((m) => {
            const d = m.createdAt?.toDate ? m.createdAt.toDate() : new Date(m.createdAt);
            return d <= new Date(dateTo + "T23:59:59");
          });
        }
        results.sort((a, b) => {
          const da = a.createdAt?.toDate ? a.createdAt.toDate() : new Date(a.createdAt);
          const db2 = b.createdAt?.toDate ? b.createdAt.toDate() : new Date(b.createdAt);
          return db2 - da;
        });

        const totalReceived = results.filter((m) => m.type === "RECEIVE").reduce((s, m) => s + (m.quantity || 0), 0);
        const totalIssued = results.filter((m) => m.type === "ISSUE").reduce((s, m) => s + (m.quantity || 0), 0);
        const totalValueIn = results.filter((m) => m.type === "RECEIVE").reduce((s, m) => s + (m.totalCost || 0), 0);
        const totalValueOut = results.filter((m) => m.type === "ISSUE").reduce((s, m) => s + (m.totalCost || 0), 0);
        sum = {
          totalMovements: results.length,
          totalReceived,
          totalIssued,
          totalValueIn,
          totalValueOut,
          netValue: totalValueIn - totalValueOut,
        };
      }

      setData(results);
      setSummary(sum);
    } catch (err) {
      console.error("Error generating report:", err);
    } finally {
      setGenerating(false);
    }
  }

  function getStoreName(storeId) {
    return stores.find((s) => s.id === storeId)?.name || storeId || "—";
  }

  function exportExcel() {
    if (data.length === 0) return;
    const isMovement = data[0]?.type;
    let rows;
    if (isMovement) {
      rows = data.map((m) => ({
        Date: formatDate(m.createdAt),
        Type: m.type,
        Store: getStoreName(m.storeId),
        Product: m.productName,
        Quantity: m.quantity,
        Unit: m.unit,
        "Unit Cost (GH₵)": m.unitCost?.toFixed(2) || "0.00",
        "Total Cost (GH₵)": (m.totalCost || 0).toFixed(2),
        Reference: m.referenceNumber || "—",
        Recipient: m.recipientName || "—",
        Supplier: m.supplierName || "—",
        "From Store": m.fromStoreName || "—",
        "To Store": m.toStoreName || "—",
        "Performed By": m.performedByName || "—",
        "Approved By": m.approvedByName || "—",
        Note: m.note || "—",
        Status: m.status || "—",
      }));
    } else {
      rows = data.map((p) => ({
        Product: p.productName,
        Store: getStoreName(p.storeId),
        Category: p.categoryId || "—",
        Quantity: p.quantityOnHand,
        Unit: p.unit,
        "Unit Cost (GH₵)": (p.unitCost || 0).toFixed(2),
        "Total Value (GH₵)": (p.totalValue || 0).toFixed(2),
        "Reorder Level": p.reorderLevel || "—",
        "Batch Number": p.batchNumber || "—",
        "Expiry Date": p.expiryDate ? formatDate(p.expiryDate) : "—",
        Supplier: p.supplierName || "—",
      }));
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Report");
    XLSX.writeFile(wb, `UGMC_${reportType}_${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  function exportPDF() {
    if (data.length === 0) return;
    const doc = new jsPDF("landscape");
    const label = REPORT_TYPES.find((r) => r.id === reportType)?.label;
    doc.setFontSize(16);
    doc.text(`UGMC - ${label}`, 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleDateString()}  |  Records: ${data.length}`, 14, 30);
    if (summary) {
      doc.text(`Summary: ${JSON.stringify(summary).replace(/[{}"]/g, "")}`, 14, 38);
    }
    doc.save(`UGMC_${reportType}_${new Date().toISOString().split("T")[0]}.pdf`);
  }

  function formatDate(val) {
    if (val?.toDate) return val.toDate().toLocaleDateString();
    if (typeof val === "string" && val.includes("T")) return new Date(val).toLocaleDateString();
    return String(val ?? "—");
  }

  const typeConfig = {
    RECEIVE: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", icon: ArrowDownToLine },
    ISSUE: { bg: "bg-blue-100", text: "text-blue-700", dot: "bg-blue-500", icon: ArrowUpToLine },
    TRANSFER: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
    ADJUSTMENT: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
    DAMAGE: { bg: "red-100", text: "text-red-700", dot: "bg-red-500" },
    EXPIRY: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  };

  const isMovement = data.length > 0 && data[0]?.type;

  return (
    <Layout>
      <div className="mb-6 animate-fadeIn">
        <h1 className="text-[22px] font-bold text-gray-900 tracking-tight">Reports</h1>
        <p className="text-[13px] text-gray-500 mt-0.5">Generate and export inventory reports</p>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 mb-6 animate-fadeIn">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Report Filters</h2>
          <div className="flex flex-wrap gap-4 items-end">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Report Type</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r.id} value={r.id}>{r.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Store</label>
              <select
                value={filterStore}
                onChange={(e) => setFilterStore(e.target.value)}
                className="px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
              >
                <option value="">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {isMovement !== false && (
              <>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">From</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Calendar size={14} className="text-gray-400" />
                  <div>
                    <label className="block text-xs text-gray-500 mb-0.5">To</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-gray-50/50"
                    />
                  </div>
                </div>
              </>
            )}
            <button
              onClick={generateReport}
              disabled={generating}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
            >
              {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
              {generating ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </div>

        {summary && (
          <div className="px-6 py-4 border-t border-gray-100 bg-gradient-to-r from-slate-50 to-blue-50/50">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Summary</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
              {summary.totalMovements !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Total Movements</p>
                  <p className="text-lg font-bold text-gray-900">{summary.totalMovements}</p>
                </div>
              )}
              {summary.totalReceived !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Qty Received</p>
                  <p className="text-lg font-bold text-green-600">{summary.totalReceived.toLocaleString()}</p>
                </div>
              )}
              {summary.totalIssued !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Qty Issued</p>
                  <p className="text-lg font-bold text-blue-600">{summary.totalIssued.toLocaleString()}</p>
                </div>
              )}
              {summary.totalValueIn !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Value In</p>
                  <p className="text-lg font-bold text-green-600">GH₵ {summary.totalValueIn.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</p>
                </div>
              )}
              {summary.totalValueOut !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Value Out</p>
                  <p className="text-lg font-bold text-blue-600">GH₵ {summary.totalValueOut.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</p>
                </div>
              )}
              {summary.netValue !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Net Value</p>
                  <p className={`text-lg font-bold ${summary.netValue >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                    GH₵ {summary.netValue.toLocaleString("en-GH", { minimumFractionDigits: 2 })}
                  </p>
                </div>
              )}
              {summary.totalProducts !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Products</p>
                  <p className="text-lg font-bold text-gray-900">{summary.totalProducts}</p>
                </div>
              )}
              {summary.totalQty !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Total Qty</p>
                  <p className="text-lg font-bold text-gray-900">{summary.totalQty.toLocaleString()}</p>
                </div>
              )}
              {summary.totalValue !== undefined && (
                <div>
                  <p className="text-xs text-gray-500">Total Value</p>
                  <p className="text-lg font-bold text-emerald-600">GH₵ {summary.totalValue.toLocaleString("en-GH", { minimumFractionDigits: 2 })}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {data.length > 0 && (
          <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">{data.length} records found</span>
            <div className="flex gap-2">
              <button
                onClick={exportExcel}
                className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                <Download size={14} />
                Excel
              </button>
              <button
                onClick={exportPDF}
                className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
              >
                <Download size={14} />
                PDF
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-fadeIn">
        {data.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <BarChart3 size={24} className="text-gray-400" />
            </div>
            <p className="text-gray-500 font-medium">Select filters and generate a report</p>
            <p className="text-sm text-gray-400 mt-1">Results will appear here</p>
          </div>
        ) : isMovement ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Date</th>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Type</th>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Store</th>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                  <th className="text-right px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                  <th className="text-right px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit Cost</th>
                  <th className="text-right px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Total Cost</th>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Ref #</th>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Party</th>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">By</th>
                  <th className="text-left px-4 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.slice(0, 200).map((m) => {
                  const config = typeConfig[m.type] || typeConfig.ADJUSTMENT;
                  const isNegative = ["ISSUE", "DAMAGE", "EXPIRY"].includes(m.type);
                  const party = m.recipientName || m.supplierName || m.fromStoreName || m.toStoreName || "—";
                  return (
                    <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(m.createdAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`}></span>
                          {m.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{getStoreName(m.storeId)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">{m.productName}</td>
                      <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${isNegative ? "text-red-600" : "text-green-600"}`}>
                        {isNegative ? "-" : "+"}{m.quantity} {m.unit}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-500">GH₵ {(m.unitCost || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">GH₵ {(m.totalCost || 0).toFixed(2)}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{m.referenceNumber || "—"}</td>
                      <td className="px-4 py-3 text-gray-500">{party}</td>
                      <td className="px-4 py-3 text-gray-500">{m.performedByName || "—"}</td>
                      <td className="px-4 py-3 text-gray-400 max-w-[180px] truncate">{m.note || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Product</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Store</th>
                  <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Qty</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit</th>
                  <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Unit Cost</th>
                  <th className="text-right px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Total Value</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Batch</th>
                  <th className="text-left px-6 py-3.5 font-medium text-gray-500 text-xs uppercase tracking-wider">Expiry</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.slice(0, 200).map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-3 font-medium text-gray-900">{p.productName}</td>
                    <td className="px-6 py-3 text-gray-500">{getStoreName(p.storeId)}</td>
                    <td className="px-6 py-3 text-right font-semibold text-gray-900">{p.quantityOnHand}</td>
                    <td className="px-6 py-3 text-gray-500">{p.unit}</td>
                    <td className="px-6 py-3 text-right text-gray-500">GH₵ {(p.unitCost || 0).toFixed(2)}</td>
                    <td className="px-6 py-3 text-right font-medium text-gray-900">GH₵ {(p.totalValue || 0).toFixed(2)}</td>
                    <td className="px-6 py-3 text-gray-500 font-mono text-xs">{p.batchNumber || "—"}</td>
                    <td className="px-6 py-3 text-gray-500">{p.expiryDate ? formatDate(p.expiryDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
