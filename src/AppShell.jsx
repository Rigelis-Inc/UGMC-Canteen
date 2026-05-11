import { lazy, Suspense, useState, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "./config/firebase";
import ProtectedRoute from "./components/common/ProtectedRoute";
import { KitchenBadgeContext } from "./contexts/KitchenBadgeContext";

const DashboardPage = lazy(() => import("./pages/dashboard/DashboardPage"));
const StoresPage = lazy(() => import("./pages/stores/StoresPage"));
const StoreDetailPage = lazy(() => import("./pages/stores/StoreDetailPage"));
const ProductsPage = lazy(() => import("./pages/products/ProductsPage"));
const SuppliersPage = lazy(() => import("./pages/suppliers/SuppliersPage"));
const RecipientsPage = lazy(() => import("./pages/recipients/RecipientsPage"));
const StockMovementsPage = lazy(() => import("./pages/stock-movements/StockMovementsPage"));
const ReceiveStockPage = lazy(() => import("./pages/stock-operations/ReceiveStockPage"));
const IssueStockPage = lazy(() => import("./pages/stock-operations/IssueStockPage"));
const TransferStockPage = lazy(() => import("./pages/stock-operations/TransferStockPage"));
const AdjustStockPage = lazy(() => import("./pages/stock-operations/AdjustStockPage"));
const DamageExpiryPage = lazy(() => import("./pages/stock-operations/DamageExpiryPage"));
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const AuditLogsPage = lazy(() => import("./pages/audit-logs/AuditLogsPage"));
const UsersPage = lazy(() => import("./pages/users/UsersPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const WardsPage = lazy(() => import("./pages/admin-meal/WardsPage"));
const MealMenusPage = lazy(() => import("./pages/admin-meal/MealMenusPage"));
const KitchenDashboardPage = lazy(() => import("./pages/admin-meal/KitchenDashboardPage"));
const MealOrdersPage = lazy(() => import("./pages/admin-meal/MealOrdersPage"));
const MealReportsPage = lazy(() => import("./pages/admin-meal/MealReportsPage"));
const MealSettingsPage = lazy(() => import("./pages/admin-meal/MealSettingsPage"));

function ShellLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
        <span className="text-sm font-medium text-slate-600">Loading workspace...</span>
      </div>
    </div>
  );
}

export default function AppShell() {
  const [pendingOrders, setPendingOrders] = useState(0);

  useEffect(() => {
    const q = query(collection(db, "wardMealOrders"), where("status", "==", "REQUESTED"));
    const unsub = onSnapshot(q, (snap) => setPendingOrders(snap.size), () => setPendingOrders(0));
    return () => unsub();
  }, []);

  return (
    <KitchenBadgeContext.Provider value={pendingOrders}>
    <Suspense fallback={<ShellLoader />}>
      <Routes>
        {/* Inventory */}
        <Route
          path="dashboard"
          element={
            <ProtectedRoute requiredPermission="viewDashboard">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stores"
          element={
            <ProtectedRoute requiredPermission="viewDashboard">
              <StoresPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stores/:storeId"
          element={
            <ProtectedRoute requiredPermission="viewDashboard">
              <StoreDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="products"
          element={
            <ProtectedRoute requiredPermission="manageProducts">
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock/receive"
          element={
            <ProtectedRoute requiredPermission="receiveStock">
              <ReceiveStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock/issue"
          element={
            <ProtectedRoute requiredPermission="issueStock">
              <IssueStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock/transfer"
          element={
            <ProtectedRoute requiredPermission="transferStock">
              <TransferStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock/adjust"
          element={
            <ProtectedRoute requiredPermission="adjustStock">
              <AdjustStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock/damage-expiry"
          element={
            <ProtectedRoute requiredPermission="adjustStock">
              <DamageExpiryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="stock-movements"
          element={
            <ProtectedRoute requiredPermission="viewReports">
              <StockMovementsPage />
            </ProtectedRoute>
          }
        />
        {/* Management */}
        <Route
          path="suppliers"
          element={
            <ProtectedRoute requiredPermission="manageSuppliers">
              <SuppliersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="recipients"
          element={
            <ProtectedRoute requiredPermission="manageRecipients">
              <RecipientsPage />
            </ProtectedRoute>
          }
        />
        {/* Administration */}
        <Route
          path="reports"
          element={
            <ProtectedRoute requiredPermission="viewReports">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="audit-logs"
          element={
            <ProtectedRoute requiredPermission="viewAuditLogs">
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="users"
          element={
            <ProtectedRoute requiredPermission="manageUsers">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="settings"
          element={
            <ProtectedRoute requiredPermission="manageSettings">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        {/* Meal Ordering */}
        <Route
          path="wards"
          element={
            <ProtectedRoute requiredPermission="manageWards">
              <WardsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="meal-menus"
          element={
            <ProtectedRoute requiredPermission="manageMealMenus">
              <MealMenusPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="kitchen"
          element={
            <ProtectedRoute requiredPermission="viewKitchenDashboard">
              <KitchenDashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="meal-orders"
          element={
            <ProtectedRoute requiredPermission="manageMealOrders">
              <MealOrdersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="meal-reports"
          element={
            <ProtectedRoute requiredPermission="viewMealReports">
              <MealReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="meal-settings"
          element={
            <ProtectedRoute requiredPermission="manageMealSettings">
              <MealSettingsPage />
            </ProtectedRoute>
          }
        />

        {/* Legacy path redirects */}
        <Route path="receive-stock" element={<Navigate to="/admin/stock/receive" replace />} />
        <Route path="issue-stock" element={<Navigate to="/admin/stock/issue" replace />} />
        <Route path="transfer-stock" element={<Navigate to="/admin/stock/transfer" replace />} />
        <Route path="adjust-stock" element={<Navigate to="/admin/stock/adjust" replace />} />
        <Route path="damage-expiry" element={<Navigate to="/admin/stock/damage-expiry" replace />} />

        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
      </Routes>
    </Suspense>
    </KitchenBadgeContext.Provider>
  );
}
