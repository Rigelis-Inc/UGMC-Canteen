import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
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
const ReportsPage = lazy(() => import("./pages/reports/ReportsPage"));
const AuditLogsPage = lazy(() => import("./pages/audit-logs/AuditLogsPage"));
const UsersPage = lazy(() => import("./pages/users/UsersPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));

function ShellLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
        <span className="text-sm font-medium text-slate-600">Loading workspace...</span>
      </div>
    </div>
  );
}

export default function AppShell() {
  return (
    <AuthProvider>
      <Suspense fallback={<ShellLoader />}>
        <Routes>
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <DashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores"
            element={
              <ProtectedRoute>
                <StoresPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stores/:storeId"
            element={
              <ProtectedRoute>
                <StoreDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/products"
            element={
              <ProtectedRoute>
                <ProductsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/receive-stock"
            element={
              <ProtectedRoute>
                <ReceiveStockPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/issue-stock"
            element={
              <ProtectedRoute>
                <IssueStockPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/stock-movements"
            element={
              <ProtectedRoute>
                <StockMovementsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/suppliers"
            element={
              <ProtectedRoute>
                <SuppliersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/recipients"
            element={
              <ProtectedRoute>
                <RecipientsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/audit-logs"
            element={
              <ProtectedRoute>
                <AuditLogsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <UsersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <SettingsPage />
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}
