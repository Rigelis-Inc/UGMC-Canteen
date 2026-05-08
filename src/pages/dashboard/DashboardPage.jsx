import { useState, useEffect } from "react";
import { collection, query, where, getDocs, orderBy, limit, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import Layout from "../../components/layout/Layout";
import { Link } from "react-router-dom";
import {
  Warehouse,
  Package,
  Truck,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpToLine,
  Clock,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  UtensilsCrossed,
  ArrowRight,
  Bell,
} from "lucide-react";

export default function DashboardPage() {
  const { userProfile, assignedStores } = useAuth();
  const [stats, setStats] = useState({
    totalStores: 0,
    totalProducts: 0,
    totalSuppliers: 0,
    totalValue: 0,
    lowStock: 0,
    outOfStock: 0,
    nearExpiry: 0,
    receiptsThisMonth: 0,
    issuesThisMonth: 0,
  });
  const [pendingFoodOrders, setPendingFoodOrders] = useState(0);
  const [recentMovements, setRecentMovements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Real-time pending food orders listener
    const pendingQ = query(collection(db, "foodOrders"), where("status", "==", "PENDING"));
    const unsubPending = onSnapshot(pendingQ, (snap) => setPendingFoodOrders(snap.size));

    async function fetchDashboard() {
      try {
        const storesSnap = await getDocs(collection(db, "stores"));
        const suppliersSnap = await getDocs(collection(db, "suppliers"));

        let storeProductsQuery = collection(db, "storeProducts");
        if (assignedStores.length > 0 && !["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role)) {
          storeProductsQuery = query(collection(db, "storeProducts"), where("storeId", "in", assignedStores));
        }
        const storeProductsSnap = await getDocs(storeProductsQuery);

        let lowStock = 0;
        let outOfStock = 0;
        let nearExpiry = 0;
        let totalValue = 0;
        const now = new Date();
        const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

        storeProductsSnap.forEach((doc) => {
          const data = doc.data();
          if (data.quantityOnHand <= 0) outOfStock++;
          else if (data.reorderLevel && data.quantityOnHand <= data.reorderLevel) lowStock++;
          if (data.expiryDate && data.expiryDate.toDate() <= ninetyDays) nearExpiry++;
          totalValue += data.totalValue || 0;
        });

        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const movementsQuery = query(
          collection(db, "stockMovements"),
          where("createdAt", ">=", startOfMonth),
          orderBy("createdAt", "desc"),
          limit(10)
        );
        const movementsSnap = await getDocs(movementsQuery);

        let receipts = 0;
        let issues = 0;
        const movements = [];
        movementsSnap.forEach((doc) => {
          const data = doc.data();
          if (data.type === "RECEIVE") receipts++;
          if (data.type === "ISSUE") issues++;
          movements.push({ id: doc.id, ...data });
        });

        setStats({
          totalStores: storesSnap.size,
          totalProducts: storeProductsSnap.size,
          totalSuppliers: suppliersSnap.size,
          totalValue,
          lowStock,
          outOfStock,
          nearExpiry,
          receiptsThisMonth: receipts,
          issuesThisMonth: issues,
        });
        setRecentMovements(movements);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();

    return () => unsubPending();
  }, [userProfile, assignedStores]);

  const primaryStats = [
    { label: "Total Products", value: stats.totalProducts, icon: Package, color: "from-primary-500 to-primary-600", bgLight: "bg-primary-50", textColor: "text-primary-600" },
    { label: "Stock Value", value: `GH₵ ${stats.totalValue.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, icon: DollarSign, color: "from-emerald-500 to-emerald-600", bgLight: "bg-emerald-50", textColor: "text-emerald-600" },
    { label: "Total Stores", value: stats.totalStores, icon: Warehouse, color: "from-violet-500 to-violet-600", bgLight: "bg-violet-50", textColor: "text-violet-600" },
    { label: "Suppliers", value: stats.totalSuppliers, icon: Truck, color: "from-amber-500 to-amber-600", bgLight: "bg-amber-50", textColor: "text-amber-600" },
  ];

  const alertStats = [
    { label: "Low Stock", value: stats.lowStock, icon: TrendingDown, color: "text-amber-600", bgColor: "bg-amber-50", borderColor: "border-amber-200" },
    { label: "Out of Stock", value: stats.outOfStock, icon: AlertTriangle, color: "text-red-600", bgColor: "bg-red-50", borderColor: "border-red-200" },
    { label: "Near Expiry", value: stats.nearExpiry, icon: Clock, color: "text-orange-600", bgColor: "bg-orange-50", borderColor: "border-orange-200" },
  ];

  const activityStats = [
    { label: "Receipts (Month)", value: stats.receiptsThisMonth, icon: ArrowDownToLine, color: "text-green-600", bgColor: "bg-green-50" },
    { label: "Issues (Month)", value: stats.issuesThisMonth, icon: ArrowUpToLine, color: "text-primary-600", bgColor: "bg-primary-50" },
  ];

  const typeConfig = {
    RECEIVE: { bg: "bg-green-100", text: "text-green-700", dot: "bg-green-500", icon: ArrowDownToLine },
    ISSUE: { bg: "bg-primary-100", text: "text-primary-700", dot: "bg-primary-500", icon: ArrowUpToLine },
    TRANSFER: { bg: "bg-purple-100", text: "text-purple-700", dot: "bg-purple-500" },
    ADJUSTMENT: { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" },
    DAMAGE: { bg: "bg-red-100", text: "text-red-700", dot: "bg-red-500" },
    EXPIRY: { bg: "bg-orange-100", text: "text-orange-700", dot: "bg-orange-500" },
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <Layout>
      {/* Page header */}
      <div className="mb-7 animate-fadeIn">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-0.5">{greeting()}, {userProfile?.fullName?.split(" ")[0] || "there"}</p>
              <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Dashboard</h1>
            </div>
            <div className="flex items-center gap-2 text-[13px] text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-3.5 py-2 rounded-lg border border-gray-200 dark:border-gray-800 shadow-sm flex-shrink-0">
            <Calendar size={13} className="text-gray-400" />
            <span>{new Date().toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 animate-pulse">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-3.5 bg-gray-100 dark:bg-gray-800 rounded w-20"></div>
                  <div className="h-9 w-9 bg-gray-100 dark:bg-gray-800 rounded-lg"></div>
                </div>
                <div className="h-7 bg-gray-100 dark:bg-gray-800 rounded w-24 mb-1"></div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-5 animate-fadeIn">
          {/* Food ordering shortcut */}
          <Link
            to="/admin/orders"
            className={`block rounded-xl border p-5 transition-all duration-200 hover:shadow-md ${
              pendingFoodOrders > 0
                ? "bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border-amber-200 dark:border-amber-800 hover:border-amber-300 dark:hover:border-amber-700"
                : "bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700"
            }`}
          >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-xl ${pendingFoodOrders > 0 ? "bg-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-400"}`}>
                    <UtensilsCrossed size={22} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Food Orders</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {pendingFoodOrders > 0
                      ? `${pendingFoodOrders} order${pendingFoodOrders !== 1 ? "s" : ""} waiting for attention`
                      : "No pending orders right now"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {pendingFoodOrders > 0 && (
                  <div className="relative">
                    <div className="w-12 h-12 rounded-full bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                      <span className="text-lg font-black text-white">{pendingFoodOrders > 99 ? "99+" : pendingFoodOrders}</span>
                    </div>
                    <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-red-500 rounded-full border-2 border-white animate-pulse" />
                  </div>
                )}
                <ArrowRight size={18} className="text-gray-400 dark:text-gray-500" />
              </div>
            </div>
          </Link>

          {/* Primary stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {primaryStats.map((stat) => (
              <div key={stat.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 hover:shadow-sm hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-200">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-xs font-medium text-gray-500 dark:text-gray-400">{stat.label}</p>
                  <div className={`p-1.5 rounded-md bg-gradient-to-br ${stat.color} shadow-sm`}>
                    <stat.icon size={14} className="text-white" />
                  </div>
                </div>
                <p className="text-xl font-bold text-gray-900 dark:text-white tracking-tight leading-none">{stat.value}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
              <div className="px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">Recent Stock Movements</h2>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Last 10 transactions this month</p>
                </div>
              </div>
              {recentMovements.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="w-12 h-12 rounded-full bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 flex items-center justify-center mx-auto mb-3">
                    <TrendingUp size={18} className="text-gray-300 dark:text-gray-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400">No stock movements yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start by receiving stock from suppliers</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-50 dark:divide-gray-800">
                  {recentMovements.map((movement) => {
                    const config = typeConfig[movement.type] || typeConfig.ADJUSTMENT;
                    const Icon = config.icon || ArrowUpToLine;
                    const isNeg = ["ISSUE","DAMAGE","EXPIRY"].includes(movement.type);
                    return (
                      <div key={movement.id} className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/70 dark:hover:bg-gray-800/50 transition-colors">
                        <div className={`p-1.5 rounded-md ${config.bg} flex-shrink-0`}>
                          <Icon size={14} className={config.text} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-white truncate">{movement.productName}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-400 dark:text-gray-500">{movement.storeName}</span>
                            <span className="text-gray-200 dark:text-gray-700">·</span>
                            <span className="text-[10px] text-gray-400">{movement.createdAt?.toDate?.()?.toLocaleDateString("en-GB") || ""}</span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded-full ${config.bg} ${config.text}`}>
                            {movement.type}
                          </span>
                          <p className={`text-sm font-bold mt-1 ${isNeg ? "text-red-600" : "text-green-600"}`}>
                            {isNeg ? "−" : "+"}{movement.quantity} <span className="font-normal text-xs text-gray-400">{movement.unit}</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-4">
              {/* Alerts */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Stock Alerts</h3>
                <div className="space-y-1.5">
                  {alertStats.map((stat) => (
                    <div key={stat.label} className={`flex items-center justify-between px-3 py-2 rounded-md ${stat.bgColor}`}>
                      <div className="flex items-center gap-2">
                        <stat.icon size={13} className={stat.color} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{stat.label}</span>
                      </div>
                      <span className={`text-sm font-bold tabular-nums ${stat.color}`}>{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* This Month */}
              <div className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4">
                <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">This Month</h3>
                <div className="space-y-2">
                  {activityStats.map((stat) => (
                    <div key={stat.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className={`p-1.5 rounded-md ${stat.bgColor}`}>
                          <stat.icon size={13} className={stat.color} />
                        </div>
                        <span className="text-xs text-gray-600 dark:text-gray-400">{stat.label}</span>
                      </div>
                      <span className="text-lg font-bold text-gray-900 tabular-nums">{stat.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}

