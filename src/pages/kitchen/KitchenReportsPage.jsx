import { useEffect, useState, useCallback } from "react";
import {
  collection, query, where, getDocs, orderBy
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { format, subDays, parseISO } from "date-fns";
import {
  Download, Printer, Clock, AlertTriangle,
  CheckCircle2, XCircle, UtensilsCrossed, Users, BarChart3, Calendar,
  ChevronDown, ChevronUp, Filter, ArrowUp, ArrowDown, TrendingUp
} from "lucide-react";

const PERIODS = ["BREAKFAST", "LUNCH", "SUPPER"];
const PERIOD_LABEL = { BREAKFAST: "Breakfast", LUNCH: "Lunch", SUPPER: "Supper" };
const STATUSES = ["ALL", "REQUESTED", "PREPARING", "DELIVERED", "CANCELLED"];

const STATUS_COLORS = {
  REQUESTED: "bg-amber-50 text-amber-700 border-amber-200",
  PREPARING: "bg-blue-50 text-blue-700 border-blue-200",
  DELIVERED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const LATE_REASONS = {
  NEW_PATIENT: "New Patient",
  MISSED_ORDER: "Missed Order",
  PATIENT_TRANSFER: "Patient Transfer",
  EMERGENCY_ADMISSION: "Emergency Admission",
  DIET_CHANGE: "Diet Change",
  OTHER: "Other",
};

function formatSpecialMeal(value) {
  if (!value || value === "NONE") return "Special";
  return value.replace(/_/g, " ");
}

function StatusBadge({ status }) {
  const color = STATUS_COLORS[status];
  if (!color) return null;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium border ${color}`}>
      {status}
    </span>
  );
}

function SectionHeader({ title, count, icon: Icon }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-white px-4 py-3">
      <div className="flex items-center gap-2">
        {Icon && <Icon size={14} className="text-slate-400" />}
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      </div>
      {count != null && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{count}</span>}
    </div>
  );
}

export default function KitchenReportsPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dateFrom, setDateFrom] = useState(format(subDays(new Date(), 7), "yyyy-MM-dd"));
  const [dateTo, setDateTo] = useState(format(new Date(), "yyyy-MM-dd"));
  const [reportTab, setReportTab] = useState("overview");
  const [wardFilter, setWardFilter] = useState("ALL");
  const [periodFilter, setPeriodFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [expandedSections, setExpandedSections] = useState({ overviewWards: true, overviewMeals: true });
  const [mealSortField, setMealSortField] = useState("count");
  const [mealSortDir, setMealSortDir] = useState("desc");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, "wardMealOrders"),
        where("orderDate", ">=", dateFrom),
        where("orderDate", "<=", dateTo),
        orderBy("orderDate", "asc"),
      ));
      setOrders(
        snap.docs.map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (a.requestedAt?.seconds || 0) - (b.requestedAt?.seconds || 0))
      );
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  function escapeCsv(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function labelForFilter(value, allLabel, lookup = null) {
    if (value === "ALL") return allLabel;
    if (lookup?.[value]) return lookup[value];
    return value;
  }

  function exportCSV() {
    const orderedRows = [...filteredOrders].sort((a, b) => {
      const aKey = `${a.orderDate || ""}-${a.orderNumber || ""}`;
      const bKey = `${b.orderDate || ""}-${b.orderNumber || ""}`;
      return aKey.localeCompare(bKey);
    });

    const summaryRows = [
      ["Total orders", totalOrders],
      ["Delivered", deliveredCount],
      ["Pending", pendingCount],
      ["Late orders", lateCount],
      ["Special diet", specialCount],
      ["Active wards", wardRows.length],
    ];

    const detailHeaders = [
      "Order #", "Date", "Period", "Ward", "Bed", "Room", "Patient", "Class",
      "Special Diet", "Main Meal", "Appetiser", "Dessert", "Instructions",
      "Requested By", "Delivered By", "Status", "Late", "Late Reason",
    ];
    const detailRows = orderedRows.map(o => [
      o.orderNumber || "", o.orderDate || "", PERIOD_LABEL[o.mealPeriod] || o.mealPeriod || "",
      o.wardName || "", o.bedNumber || "", o.roomNumber || "", o.patientName || "",
      o.patientClass || "", o.isSpecialPatient ? formatSpecialMeal(o.specialMealType) : "No",
      o.mainMeal?.name || "", o.appetiser?.name || "", o.dessert?.name || "",
      o.specialInstructions || "", o.requestedByName || "", o.deliveredByName || "",
      o.status || "", o.isLate ? "Yes" : "No", o.lateReason?.replace("_", " ") || "",
    ]);

    const csvBlocks = [
      [["Kitchen Meal Report"]],
      [["Date range", `${dateFrom} to ${dateTo}`]],
      [["Ward filter", labelForFilter(wardFilter, "All Wards")]],
      [["Period filter", labelForFilter(periodFilter, "All Periods", PERIOD_LABEL)]],
      [["Status filter", labelForFilter(statusFilter, "All Statuses")]],
      [[]],
      [["Summary"], ["Metric", "Value"], ...summaryRows],
      [[]],
      [["Detailed Orders"], detailHeaders, ...detailRows],
    ];

    const csv = csvBlocks
      .map(block => block.map(row => row.map(escapeCsv).join(",")).join("\n"))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `meal-report-${dateFrom}-to-${dateTo}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printCurrentReport() {
    const overviewItems = [
      { label: "Total orders", value: totalOrders },
      { label: "Delivered", value: deliveredCount },
      { label: "Pending", value: pendingCount },
      { label: "Late", value: lateCount },
      { label: "Special diet", value: specialCount },
    ];

    const printDate = format(new Date(), "yyyy-MM-dd HH:mm");
    const reportSections = {
      overview: `
        <section class="section">
          <h2>Operations summary</h2>
          <div class="summary-grid">
            ${overviewItems.map(item => `
              <div class="metric"><strong>${escapeHtml(item.value)}</strong><span>${escapeHtml(item.label)}</span></div>
            `).join("")}
          </div>
          <div class="two-col">
            <div>
              <h3>Ward summary</h3>
              <table>
                <thead><tr><th>Ward</th><th>Total</th><th>Delivered</th><th>Late</th><th>Special</th></tr></thead>
                <tbody>
                  ${wardRows.slice(0, 12).map(([ward, data]) => `
                    <tr>
                      <td>${escapeHtml(ward)}</td>
                      <td>${data.total}</td>
                      <td>${data.delivered}</td>
                      <td>${data.late}</td>
                      <td>${data.special}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
            <div>
              <h3>Top meals</h3>
              <table>
                <thead><tr><th>Meal</th><th>Orders</th><th>Wards</th></tr></thead>
                <tbody>
                  ${mealRows.slice(0, 12).map(([name, data]) => `
                    <tr>
                      <td>${escapeHtml(name)}</td>
                      <td>${data.count}</td>
                      <td>${data.wards.size}</td>
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      `,
      wards: `
        <section class="section">
          <h2>Ward breakdown</h2>
          <table>
            <thead><tr><th>Ward</th><th>Total</th><th>Delivered</th><th>Cancelled</th><th>Late</th><th>Special</th><th>Rate</th></tr></thead>
            <tbody>
              ${wardRows.map(([ward, data]) => {
                const rate = data.total > 0 ? Math.round((data.delivered / Math.max(data.total - data.cancelled, 1)) * 100) : 0;
                return `
                  <tr>
                    <td>${escapeHtml(ward)}</td>
                    <td>${data.total}</td>
                    <td>${data.delivered}</td>
                    <td>${data.cancelled}</td>
                    <td>${data.late}</td>
                    <td>${data.special}</td>
                    <td>${rate}%</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </section>
      `,
      meals: `
        <section class="section">
          <h2>Meal analysis</h2>
          <table>
            <thead><tr><th>Meal</th><th>Orders</th><th>Special</th><th>Wards</th><th>Breakfast</th><th>Lunch</th><th>Supper</th></tr></thead>
            <tbody>
              ${mealRows.map(([name, data]) => `
                <tr>
                  <td>${escapeHtml(name)}</td>
                  <td>${data.count}</td>
                  <td>${data.special}</td>
                  <td>${data.wards.size}</td>
                  <td>${data.byPeriod.BREAKFAST || 0}</td>
                  <td>${data.byPeriod.LUNCH || 0}</td>
                  <td>${data.byPeriod.SUPPER || 0}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </section>
      `,
      periods: `
        <section class="section">
          <h2>Period breakdown</h2>
          <table>
            <thead><tr><th>Period</th><th>Total</th><th>Delivered</th><th>Late</th><th>Rate</th></tr></thead>
            <tbody>
              ${PERIODS.map(p => {
                const data = periodData[p];
                const rate = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0;
                return `
                  <tr>
                    <td>${PERIOD_LABEL[p]}</td>
                    <td>${data.total}</td>
                    <td>${data.delivered}</td>
                    <td>${data.late}</td>
                    <td>${rate}%</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </section>
      `,
      late: `
        <section class="section">
          <h2>Late orders</h2>
          <table>
            <thead><tr><th>Order #</th><th>Date</th><th>Period</th><th>Patient</th><th>Ward</th><th>Reason</th><th>Status</th></tr></thead>
            <tbody>
              ${filteredOrders.filter(o => o.isLate).map(o => `
                <tr>
                  <td>${escapeHtml(o.orderNumber)}</td>
                  <td>${escapeHtml(o.orderDate)}</td>
                  <td>${escapeHtml(PERIOD_LABEL[o.mealPeriod] || o.mealPeriod || "")}</td>
                  <td>${escapeHtml(o.patientName)}</td>
                  <td>${escapeHtml(o.wardName)}</td>
                  <td>${escapeHtml(LATE_REASONS[o.lateReason] || o.lateReason || "")}</td>
                  <td>${escapeHtml(o.status)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </section>
      `,
      trends: `
        <section class="section">
          <h2>Daily trends</h2>
          <table>
            <thead><tr><th>Date</th><th>Total</th><th>Delivered</th><th>Late</th><th>Rate</th></tr></thead>
            <tbody>
              ${dailyRows.map(([date, data]) => {
                const rate = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0;
                return `
                  <tr>
                    <td>${escapeHtml(date)}</td>
                    <td>${data.total}</td>
                    <td>${data.delivered}</td>
                    <td>${data.late}</td>
                    <td>${rate}%</td>
                  </tr>
                `;
              }).join("")}
            </tbody>
          </table>
        </section>
      `,
    };

    const printHtml = `<!doctype html>
      <html>
        <head>
          <title>Kitchen Meal Report</title>
          <meta charset="utf-8" />
          <style>
            @page { size: A4 portrait; margin: 18mm; }
            body {
              font-family: Inter, Arial, sans-serif;
              color: #0f172a;
              margin: 0;
              background: #fff;
            }
            .page {
              max-width: 100%;
            }
            .header {
              display: flex;
              justify-content: space-between;
              align-items: flex-end;
              border-bottom: 1px solid #e2e8f0;
              padding-bottom: 14px;
              margin-bottom: 16px;
            }
            .eyebrow {
              color: #ea580c;
              font-size: 11px;
              font-weight: 700;
              letter-spacing: .18em;
              text-transform: uppercase;
              margin-bottom: 6px;
            }
            h1 {
              margin: 0;
              font-size: 24px;
              line-height: 1.1;
            }
            .meta {
              color: #64748b;
              font-size: 12px;
              margin-top: 6px;
            }
            .stamp {
              color: #64748b;
              font-size: 11px;
              text-align: right;
            }
            .section {
              margin-top: 16px;
              break-inside: avoid;
            }
            .section h2 {
              margin: 0 0 10px;
              font-size: 14px;
              letter-spacing: .04em;
              text-transform: uppercase;
              color: #ea580c;
            }
            .summary-grid {
              display: grid;
              grid-template-columns: repeat(5, minmax(0, 1fr));
              gap: 8px;
              margin-bottom: 14px;
            }
            .metric {
              border: 1px solid #e2e8f0;
              border-top: 2px solid #ea580c;
              border-radius: 10px;
              padding: 8px 10px;
            }
            .metric strong {
              display: block;
              font-size: 18px;
              line-height: 1;
              margin-bottom: 4px;
            }
            .metric span {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: .14em;
              color: #64748b;
            }
            .two-col {
              display: grid;
              grid-template-columns: repeat(2, minmax(0, 1fr));
              gap: 14px;
            }
            h3 {
              margin: 0 0 8px;
              font-size: 13px;
              color: #0f172a;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 11px;
            }
            th, td {
              border-bottom: 1px solid #e2e8f0;
              padding: 7px 6px;
              text-align: left;
              vertical-align: top;
            }
            th {
              font-size: 10px;
              text-transform: uppercase;
              letter-spacing: .1em;
              color: #94a3b8;
            }
            tbody tr:nth-child(even) td {
              background: #fafafa;
            }
            .footer {
              margin-top: 16px;
              padding-top: 10px;
              border-top: 1px solid #e2e8f0;
              color: #94a3b8;
              font-size: 10px;
            }
          </style>
        </head>
        <body>
          <div class="page">
            <div class="header">
              <div>
                <div class="eyebrow">Kitchen Reporting</div>
                <h1>Meal Reports</h1>
                <div class="meta">${escapeHtml(dateFrom)} to ${escapeHtml(dateTo)} · ${totalOrders} orders · ${lateCount} late · ${specialCount} special diet</div>
              </div>
              <div class="stamp">
                <div>Generated ${escapeHtml(printDate)}</div>
                <div>Ward: ${escapeHtml(labelForFilter(wardFilter, "All Wards"))}</div>
                <div>Period: ${escapeHtml(labelForFilter(periodFilter, "All Periods", PERIOD_LABEL))}</div>
                <div>Status: ${escapeHtml(labelForFilter(statusFilter, "All Statuses"))}</div>
              </div>
            </div>
            ${reportSections[reportTab] || reportSections.overview}
            <div class="footer">Mayrit Cuisines kitchen report</div>
          </div>
        </body>
      </html>`;

    const printFrame = document.createElement("iframe");
    printFrame.style.position = "fixed";
    printFrame.style.right = "0";
    printFrame.style.bottom = "0";
    printFrame.style.width = "0";
    printFrame.style.height = "0";
    printFrame.style.border = "0";
    printFrame.style.visibility = "hidden";
    printFrame.srcdoc = printHtml;

    const cleanup = () => {
      if (printFrame.parentNode) {
        printFrame.parentNode.removeChild(printFrame);
      }
    };

    printFrame.onload = () => {
      const frameWindow = printFrame.contentWindow;
      if (!frameWindow) {
        cleanup();
        return;
      }

      frameWindow.focus();
      frameWindow.print();
      setTimeout(cleanup, 1000);
    };

    document.body.appendChild(printFrame);
  }

  function toggleSection(section) {
    setExpandedSections(prev => ({ ...prev, [section]: !prev[section] }));
  }

  const filteredOrders = orders.filter(o =>
    (wardFilter === "ALL" || o.wardName === wardFilter) &&
    (periodFilter === "ALL" || o.mealPeriod === periodFilter) &&
    (statusFilter === "ALL" || o.status === statusFilter)
  );

  const wards = [...new Set(orders.map(o => o.wardName).filter(Boolean))].sort();
  const totalOrders = filteredOrders.length;
  const deliveredCount = filteredOrders.filter(o => o.status === "DELIVERED").length;
  const cancelledCount = filteredOrders.filter(o => o.status === "CANCELLED").length;
  const lateCount = filteredOrders.filter(o => o.isLate).length;
  const specialCount = filteredOrders.filter(o => o.isSpecialPatient).length;
  const pendingCount = filteredOrders.filter(o => ["REQUESTED", "PREPARING"].includes(o.status)).length;
  const activeOrders = totalOrders - cancelledCount;

  const wardData = {};
  filteredOrders.forEach(o => {
    if (!wardData[o.wardName]) wardData[o.wardName] = { total: 0, delivered: 0, cancelled: 0, late: 0, special: 0 };
    const w = wardData[o.wardName];
    w.total++;
    if (o.status === "DELIVERED") w.delivered++;
    if (o.status === "CANCELLED") w.cancelled++;
    if (o.isLate) w.late++;
    if (o.isSpecialPatient) w.special++;
  });
  const wardRows = Object.entries(wardData).sort((a, b) => b[1].total - a[1].total);

  const mealData = {};
  filteredOrders.filter(o => o.status !== "CANCELLED").forEach(o => {
    const name = o.mainMeal?.name || "Unknown";
    if (!mealData[name]) mealData[name] = { count: 0, special: 0, wards: new Set(), byPeriod: {} };
    mealData[name].count++;
    if (o.isSpecialPatient) mealData[name].special++;
    mealData[name].wards.add(o.wardName);
    const p = o.mealPeriod || "UNKNOWN";
    mealData[name].byPeriod[p] = (mealData[name].byPeriod[p] || 0) + 1;
  });

  function sortMealRows() {
    const entries = Object.entries(mealData);
    entries.sort((a, b) => {
      let va, vb;
      if (mealSortField === "count") { va = a[1].count; vb = b[1].count; }
      else if (mealSortField === "special") { va = a[1].special; vb = b[1].special; }
      else if (mealSortField === "wards") { va = a[1].wards.size; vb = b[1].wards.size; }
      else { va = a[0]; vb = b[0]; }
      if (typeof va === "string") return mealSortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      return mealSortDir === "asc" ? va - vb : vb - va;
    });
    return entries;
  }
  const mealRows = sortMealRows();
  const maxMealCount = mealRows[0]?.[1].count || 1;

  function toggleMealSort(field) {
    if (mealSortField === field) {
      setMealSortDir(d => d === "desc" ? "asc" : "desc");
    } else {
      setMealSortField(field);
      setMealSortDir("desc");
    }
  }

  function SortIcon({ field }) {
    if (mealSortField !== field) return <ChevronDown size={12} className="text-slate-300 inline ml-0.5" />;
    return mealSortDir === "asc"
      ? <ArrowUp size={12} className="text-primary-600 inline ml-0.5" />
      : <ArrowDown size={12} className="text-primary-600 inline ml-0.5" />;
  }

  const periodData = {};
  PERIODS.forEach(p => {
    const periodOrders = filteredOrders.filter(o => o.mealPeriod === p);
    periodData[p] = {
      total: periodOrders.length,
      delivered: periodOrders.filter(o => o.status === "DELIVERED").length,
      late: periodOrders.filter(o => o.isLate).length,
    };
  });

  const lateReasons = {};
  filteredOrders.filter(o => o.isLate).forEach(o => {
    const reason = o.lateReason || "OTHER";
    lateReasons[reason] = (lateReasons[reason] || 0) + 1;
  });
  const lateReasonRows = Object.entries(lateReasons).sort((a, b) => b[1] - a[1]);

  const classData = {};
  filteredOrders.forEach(o => {
    const cls = o.patientClass || "GENERAL";
    classData[cls] = (classData[cls] || 0) + 1;
  });
  const classRows = Object.entries(classData).sort((a, b) => b[1] - a[1]);

  const dailyData = {};
  filteredOrders.forEach(o => {
    if (!dailyData[o.orderDate]) dailyData[o.orderDate] = { total: 0, delivered: 0, late: 0 };
    dailyData[o.orderDate].total++;
    if (o.status === "DELIVERED") dailyData[o.orderDate].delivered++;
    if (o.isLate) dailyData[o.orderDate].late++;
  });
  const dailyRows = Object.entries(dailyData).sort((a, b) => a[0].localeCompare(b[0]));

  const tabs = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "wards", label: "By Ward", icon: Users },
    { id: "meals", label: "By Meal", icon: UtensilsCrossed },
    { id: "periods", label: "By Period", icon: Clock },
    { id: "late", label: "Late Orders", icon: AlertTriangle },
    { id: "trends", label: "Daily Trends", icon: Calendar },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-4 py-2.5">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 space-y-1">
              <p className="text-[9px] font-semibold uppercase tracking-[0.3em] text-primary-600">Kitchen reporting</p>
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h1 className="text-[28px] font-semibold tracking-tight text-slate-900">Meal Reports</h1>
                <p className="text-[12px] text-slate-500">
                  {dateFrom} to {dateTo}
                </p>
              </div>
              <p className="text-[12px] text-slate-500">
                {totalOrders} orders · {deliveredCount} delivered · {pendingCount} pending · {lateCount} late · {specialCount} special diet
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
              <span className="rounded-full border border-primary-200 bg-primary-50 px-2.5 py-0.5 text-primary-700">Pending {pendingCount}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5">Delivered {deliveredCount}</span>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5">Late {lateCount}</span>
            </div>
          </div>
        </div>

        <div className="space-y-2.5 px-4 py-3 sm:px-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50/55 p-2.5">
            <div className="flex flex-col gap-2.5 xl:flex-row xl:items-end xl:justify-between">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <div>
                  <label className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-400">From</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-700 outline-none transition focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-400">To</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-700 outline-none transition focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-100"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-400">Ward</label>
                  <select
                    value={wardFilter}
                    onChange={e => setWardFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-700 outline-none transition focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-100"
                  >
                    <option value="ALL">All Wards</option>
                    {wards.map(w => <option key={w} value={w}>{w}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-[8px] font-semibold uppercase tracking-[0.22em] text-slate-400">Status</label>
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] text-slate-700 outline-none transition focus:border-primary-300 focus:bg-white focus:ring-2 focus:ring-primary-100"
                  >
                    {STATUSES.map(s => <option key={s} value={s}>{s === "ALL" ? "All Statuses" : s}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={printCurrentReport}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-primary-700"
                >
                  <Download size={14} /> Export CSV
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-2">
            <div className="flex flex-wrap gap-1.5">
              {tabs.map(t => {
                const active = reportTab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setReportTab(t.id)}
                    className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                      active
                        ? "bg-slate-900 text-white shadow-sm"
                        : "bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    <t.icon size={12} />
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400 text-sm shadow-sm">Loading report data&hellip;</div>
      ) : (
        <>
          {reportTab === "overview" && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-[12px] text-slate-600 shadow-sm">
                <span className="font-semibold text-slate-900">{totalOrders}</span> total orders
                <span className="mx-2 text-slate-300">•</span>
                <span className="font-semibold text-emerald-700">{deliveredCount}</span> delivered
                <span className="mx-2 text-slate-300">•</span>
                <span className="font-semibold text-primary-700">{pendingCount}</span> pending
                <span className="mx-2 text-slate-300">•</span>
                <span className="font-semibold text-red-600">{lateCount}</span> late
                <span className="mx-2 text-slate-300">•</span>
                <span className="font-semibold text-amber-700">{specialCount}</span> special diet
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <button onClick={() => toggleSection("overviewWards")}
                    className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedSections.overviewWards ? "rotate-0" : "-rotate-90"}`} />
                      <h3 className="text-sm font-semibold text-slate-900">Ward Summary</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{wardRows.length} wards</span>
                  </button>
                  {expandedSections.overviewWards && (
                    <div className="border-t border-slate-100">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100">
                            <th className="px-4 py-2 text-left text-[10px] font-semibold text-slate-500 uppercase">Ward</th>
                            <th className="px-4 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">Total</th>
                            <th className="px-4 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">Delivered</th>
                            <th className="px-4 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">Cancelled</th>
                            <th className="px-4 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">Late</th>
                            <th className="px-4 py-2 text-center text-[10px] font-semibold text-slate-500 uppercase">Special</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {wardRows.map(([ward, data]) => (
                            <tr key={ward} className="hover:bg-slate-50">
                              <td className="px-4 py-2 font-medium text-slate-800">{ward}</td>
                              <td className="px-4 py-2 text-center font-semibold">{data.total}</td>
                              <td className="px-4 py-2 text-center text-emerald-600">{data.delivered}</td>
                              <td className="px-4 py-2 text-center text-red-600">{data.cancelled}</td>
                              <td className="px-4 py-2 text-center text-primary-600">{data.late}</td>
                              <td className="px-4 py-2 text-center text-slate-600">{data.special}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                  <button onClick={() => toggleSection("overviewMeals")}
                    className="flex w-full items-center justify-between px-4 py-3 transition-colors hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <ChevronDown size={14} className={`text-slate-400 transition-transform ${expandedSections.overviewMeals ? "rotate-0" : "-rotate-90"}`} />
                      <h3 className="text-sm font-semibold text-slate-900">Top Meals</h3>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600">{mealRows.length} items</span>
                  </button>
                  {expandedSections.overviewMeals && (
                    <div className="space-y-3 border-t border-slate-100 p-4">
                      {mealRows.slice(0, 10).map(([name, data]) => (
                        <div key={name} className="flex items-center gap-3">
                          <span className="w-40 truncate text-xs font-medium text-slate-700">{name}</span>
                          <div className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-primary-600 transition-all" style={{ width: `${(data.count / maxMealCount) * 100}%` }} />
                          </div>
                          <span className="w-8 text-right text-xs font-semibold tabular-nums text-slate-800">{data.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {reportTab === "wards" && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <SectionHeader title="Ward Breakdown" count={wardRows.length} icon={Users} />
              {wardRows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No data for selected filters.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Ward</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Total</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Delivered</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Cancelled</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Late</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Special Diet</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {wardRows.map(([ward, data]) => {
                      const rate = data.total > 0 ? Math.round((data.delivered / (data.total - data.cancelled)) * 100) : 0;
                      return (
                        <tr key={ward} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{ward}</td>
                          <td className="px-4 py-2.5 text-center font-bold tabular-nums">{data.total}</td>
                          <td className="px-4 py-2.5 text-center text-emerald-600 font-medium tabular-nums">{data.delivered}</td>
                          <td className="px-4 py-2.5 text-center text-red-600 tabular-nums">{data.cancelled}</td>
                          <td className="px-4 py-2.5 text-center text-primary-600 tabular-nums">{data.late}</td>
                          <td className="px-4 py-2.5 text-center text-slate-600 tabular-nums">{data.special}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-bold ${rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-600"}`}>{rate}%</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {reportTab === "meals" && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-slate-100 bg-slate-50/60 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <UtensilsCrossed size={14} className="text-slate-400" />
                  <h2 className="text-sm font-semibold text-slate-800">Meal Analysis</h2>
                </div>
                <span className="text-[10px] text-slate-500">{mealRows.length} meals &middot; {totalOrders - cancelledCount} orders</span>
              </div>
              {mealRows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No data for selected filters.</div>
              ) : (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase w-10">#</th>
                          <th
                            className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                            onClick={() => toggleMealSort("name")}
                          >
                            Meal Name<SortIcon field="name" />
                          </th>
                          <th
                            className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                            onClick={() => toggleMealSort("count")}
                          >
                            Orders<SortIcon field="count" />
                          </th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase w-48">Share</th>
                          <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">% of Total</th>
                          <th
                            className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                            onClick={() => toggleMealSort("special")}
                          >
                            Special<SortIcon field="special" />
                          </th>
                          <th
                            className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase cursor-pointer hover:text-slate-700 select-none"
                            onClick={() => toggleMealSort("wards")}
                          >
                            Wards<SortIcon field="wards" />
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {mealRows.map(([name, data], idx) => {
                          const pct = activeOrders > 0 ? Math.round((data.count / activeOrders) * 100) : 0;
                          return (
                            <tr key={name} className="hover:bg-slate-50">
                              <td className="px-4 py-2.5 text-center text-slate-400 font-mono tabular-nums">{idx + 1}</td>
                              <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[200px] truncate">{name}</td>
                              <td className="px-4 py-2.5 text-center font-bold tabular-nums">{data.count}</td>
                              <td className="px-4 py-2.5">
                                <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                                  <div
                                    className="h-full bg-primary-600 rounded transition-all"
                                    style={{ width: `${(data.count / maxMealCount) * 100}%` }}
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums">
                                <span className="text-slate-700 font-medium">{pct}%</span>
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums">
                                {data.special > 0 ? (
                                  <span className="text-primary-600 font-medium">{data.special}</span>
                                ) : (
                                  <span className="text-slate-300">&mdash;</span>
                                )}
                              </td>
                              <td className="px-4 py-2.5 text-center tabular-nums">
                                <span className="text-slate-600">{data.wards.size}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-50 border-t border-slate-200">
                          <td className="px-4 py-2" colSpan={2}>
                            <span className="text-[10px] font-semibold text-slate-500 uppercase">Total</span>
                          </td>
                          <td className="px-4 py-2 text-center font-bold tabular-nums">{activeOrders}</td>
                          <td className="px-4 py-2" colSpan={3}></td>
                          <td className="px-4 py-2 text-center tabular-nums text-slate-500">
                            {[...new Set(filteredOrders.filter(o => o.status !== "CANCELLED").map(o => o.wardName))].length}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="md:hidden divide-y divide-slate-100">
                    {mealRows.map(([name, data], idx) => {
                      const pct = activeOrders > 0 ? Math.round((data.count / activeOrders) * 100) : 0;
                      return (
                        <div key={name} className="px-4 py-3 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-mono text-slate-400 tabular-nums">{idx + 1}</span>
                                <p className="text-xs font-medium text-slate-800 truncate">{name}</p>
                              </div>
                              <div className="mt-1.5 h-2 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-primary-600 rounded" style={{ width: `${(data.count / maxMealCount) * 100}%` }} />
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-sm font-bold text-slate-900 tabular-nums">{data.count}</p>
                              <p className="text-[10px] text-slate-500">{pct}%</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-slate-500">
                            {data.special > 0 && <span className="text-primary-600">{data.special} special</span>}
                            <span>{data.wards.size} wards</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {reportTab === "periods" && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <SectionHeader title="Period Breakdown" icon={Clock} />
              {PERIODS.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No data.</div>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Period</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Total</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Delivered</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Late</th>
                      <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Rate</th>
                      <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase w-40">Volume</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PERIODS.map(p => {
                      const data = periodData[p];
                      const rate = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0;
                      const maxPeriodTotal = Math.max(...PERIODS.map(pp => periodData[pp]?.total || 0), 1);
                      return (
                        <tr key={p} className="hover:bg-slate-50">
                          <td className="px-4 py-2.5 font-semibold text-slate-800">{PERIOD_LABEL[p]}</td>
                          <td className="px-4 py-2.5 text-center font-bold tabular-nums">{data.total}</td>
                          <td className="px-4 py-2.5 text-center text-emerald-600 font-medium tabular-nums">{data.delivered}</td>
                          <td className="px-4 py-2.5 text-center text-primary-600 tabular-nums">{data.late}</td>
                          <td className="px-4 py-2.5 text-center">
                            <span className={`text-xs font-bold ${rate >= 80 ? "text-emerald-600" : rate >= 50 ? "text-amber-600" : "text-red-600"}`}>{rate}%</span>
                          </td>
                          <td className="px-4 py-2.5">
                            <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                              <div className="h-full bg-primary-600 rounded transition-all" style={{ width: `${(data.total / maxPeriodTotal) * 100}%` }} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {reportTab === "late" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <SectionHeader title="Late Order Reasons" count={lateCount} icon={AlertTriangle} />
                {lateReasonRows.length === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No late orders in range.</div>
                ) : (
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Reason</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Count</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase w-48">Share</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">% of Late</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {lateReasonRows.map(([reason, count]) => {
                        const pct = lateCount > 0 ? Math.round((count / lateCount) * 100) : 0;
                        return (
                          <tr key={reason} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{LATE_REASONS[reason] || reason}</td>
                            <td className="px-4 py-2.5 text-center font-bold tabular-nums">{count}</td>
                            <td className="px-4 py-2.5">
                              <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-red-500 rounded transition-all" style={{ width: `${pct}%` }} />
                              </div>
                            </td>
                            <td className="px-4 py-2.5 text-center tabular-nums">
                              <span className="text-slate-700 font-medium">{pct}%</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>

              <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                <SectionHeader title="Late Orders Detail" count={lateCount} />
                {lateCount === 0 ? (
                  <div className="p-8 text-center text-slate-400 text-sm">No late orders in range.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100">
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Order #</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Date</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Period</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Patient</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Ward</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Reason</th>
                          <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredOrders.filter(o => o.isLate).map(o => (
                          <tr key={o.id} className="hover:bg-slate-50">
                            <td className="px-4 py-2 font-mono text-[10px] text-slate-500">{o.orderNumber}</td>
                            <td className="px-4 py-2 text-slate-600">{o.orderDate}</td>
                            <td className="px-4 py-2 text-slate-600">{PERIOD_LABEL[o.mealPeriod]}</td>
                            <td className="px-4 py-2 font-medium text-slate-800">{o.patientName}</td>
                            <td className="px-4 py-2 text-slate-600">{o.wardName}</td>
                            <td className="px-4 py-2 text-primary-600">{LATE_REASONS[o.lateReason] || o.lateReason}</td>
                            <td className="px-4 py-2"><StatusBadge status={o.status} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {reportTab === "trends" && (
            <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
              <SectionHeader title="Daily Order Trends" count={dailyRows.length} icon={TrendingUp} />
              {dailyRows.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">No data for selected range.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-100">
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase">Date</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Total</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Delivered</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Late</th>
                        <th className="px-4 py-2.5 text-center text-[10px] font-semibold text-slate-500 uppercase">Rate</th>
                        <th className="px-4 py-2.5 text-left text-[10px] font-semibold text-slate-500 uppercase w-40">Volume</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dailyRows.map(([date, data]) => {
                        const rate = data.total > 0 ? Math.round((data.delivered / data.total) * 100) : 0;
                        const maxTotal = Math.max(...dailyRows.map(([, d]) => d.total), 1);
                        return (
                          <tr key={date} className="hover:bg-slate-50">
                            <td className="px-4 py-2.5 font-medium text-slate-800">{date}</td>
                            <td className="px-4 py-2.5 text-center font-bold tabular-nums">{data.total}</td>
                            <td className="px-4 py-2.5 text-center text-emerald-600 tabular-nums">{data.delivered}</td>
                            <td className="px-4 py-2.5 text-center text-primary-600 tabular-nums">{data.late}</td>
                            <td className="px-4 py-2.5 text-center">
                              <span className={`text-xs font-bold ${rate >= 80 ? "text-emerald-600" : "text-amber-600"}`}>{rate}%</span>
                            </td>
                            <td className="px-4 py-2.5">
                              <div className="h-2.5 bg-slate-100 rounded overflow-hidden">
                                <div className="h-full bg-primary-600 rounded transition-all" style={{ width: `${(data.total / maxTotal) * 100}%` }} />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
