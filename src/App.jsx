import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AppErrorBoundary from "./components/common/AppErrorBoundary";

const NurseLoginPage = lazy(() => import("./pages/auth/NurseLoginPage"));
const AdminLoginPage = lazy(() => import("./pages/auth/LoginPage"));
const AppShell = lazy(() => import("./AppShell"));
const KitchenShell = lazy(() => import("./KitchenShell"));
const NurseShell = lazy(() => import("./NurseShell"));

function AppLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
        <span className="text-sm font-medium text-slate-600">Loading app...</span>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppErrorBoundary>
          <Suspense fallback={<AppLoader />}>
            <Routes>
              {/* Main entry - nurse / ward meal ordering */}
              <Route path="/" element={<NurseLoginPage />} />
              <Route path="/login" element={<NurseLoginPage />} />

              {/* Admin / Inventory portal */}
              <Route path="/admin/login" element={<AdminLoginPage />} />
              <Route path="/admin/*" element={<AppShell />} />

              {/* Kitchen portal */}
              <Route path="/kitchen" element={<Navigate to="/kitchen/dashboard" replace />} />
              <Route path="/kitchen/*" element={<KitchenShell />} />

              {/* Nurse ward-ordering routes */}
              <Route path="/nurse/*" element={<NurseShell />} />

              {/* Legacy redirects */}
              <Route path="/dashboard" element={<Navigate to="/nurse/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppErrorBoundary>
      </BrowserRouter>
    </AuthProvider>
  );
}
