import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const AppShell = lazy(() => import("./AppShell"));
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
        <Suspense fallback={<AppLoader />}>
          <Routes>
            {/* Admin / Inventory / Kitchen routes */}
            <Route path="/admin/login" element={<LoginPage />} />
            <Route path="/admin/*" element={<AppShell />} />

            {/* Nurse ward-ordering routes */}
            <Route path="/nurse/*" element={<NurseShell />} />

            {/* Redirects */}
            <Route path="/login" element={<Navigate to="/admin/login" replace />} />
            <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
            <Route path="/" element={<Navigate to="/admin/login" replace />} />
            <Route path="*" element={<Navigate to="/admin/login" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
