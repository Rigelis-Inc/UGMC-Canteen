import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import ProtectedRoute from "./components/common/ProtectedRoute";
import LoginPage from "./pages/auth/LoginPage";
import DashboardPage from "./pages/dashboard/DashboardPage";
import StoresPage from "./pages/stores/StoresPage";
import StoreDetailPage from "./pages/stores/StoreDetailPage";
import ProductsPage from "./pages/products/ProductsPage";
import SuppliersPage from "./pages/suppliers/SuppliersPage";
import RecipientsPage from "./pages/recipients/RecipientsPage";
import StockMovementsPage from "./pages/stock-movements/StockMovementsPage";
import ReceiveStockPage from "./pages/stock-operations/ReceiveStockPage";
import IssueStockPage from "./pages/stock-operations/IssueStockPage";
import ReportsPage from "./pages/reports/ReportsPage";
import AuditLogsPage from "./pages/audit-logs/AuditLogsPage";
import UsersPage from "./pages/users/UsersPage";
import SettingsPage from "./pages/settings/SettingsPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
      </AuthProvider>
    </BrowserRouter>
  );
}
