import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute";

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
  return (
    <Suspense fallback={<ShellLoader />}>
      <Routes>
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute requiredPermission="viewDashboard">
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores"
          element={
            <ProtectedRoute requiredPermission="viewDashboard">
              <StoresPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/:storeId"
          element={
            <ProtectedRoute requiredPermission="viewDashboard">
              <StoreDetailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/products"
          element={
            <ProtectedRoute requiredPermission="manageProducts">
              <ProductsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/receive-stock"
          element={
            <ProtectedRoute requiredPermission="receiveStock">
              <ReceiveStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/issue-stock"
          element={
            <ProtectedRoute requiredPermission="issueStock">
              <IssueStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/transfer-stock"
          element={
            <ProtectedRoute requiredPermission="transferStock">
              <TransferStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/adjust-stock"
          element={
            <ProtectedRoute requiredPermission="adjustStock">
              <AdjustStockPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/damage-expiry"
          element={
            <ProtectedRoute requiredPermission="adjustStock">
              <DamageExpiryPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stock-movements"
          element={
            <ProtectedRoute requiredPermission="viewReports">
              <StockMovementsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/suppliers"
          element={
            <ProtectedRoute requiredPermission="manageSuppliers">
              <SuppliersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/recipients"
          element={
            <ProtectedRoute requiredPermission="manageRecipients">
              <RecipientsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reports"
          element={
            <ProtectedRoute requiredPermission="viewReports">
              <ReportsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/audit-logs"
          element={
            <ProtectedRoute requiredPermission="viewAuditLogs">
              <AuditLogsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/users"
          element={
            <ProtectedRoute requiredPermission="manageUsers">
              <UsersPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute requiredPermission="manageSettings">
              <SettingsPage />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}
