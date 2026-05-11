import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import NurseLayout from "./components/nurse/NurseLayout";

const NurseDashboardPage = lazy(() => import("./pages/nurse/NurseDashboardPage"));
const NursePatientsPage = lazy(() => import("./pages/nurse/NursePatientsPage"));
const NurseMealOrdersPage = lazy(() => import("./pages/nurse/NurseMealOrdersPage"));
const NurseOrderHistoryPage = lazy(() => import("./pages/nurse/NurseOrderHistoryPage"));

function ShellLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-primary-600" />
        <span className="text-sm font-medium text-slate-600">Loading...</span>
      </div>
    </div>
  );
}

function NurseGuard({ children }) {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading) return <ShellLoader />;
  if (!currentUser || !userProfile) return <Navigate to="/admin/login" replace />;
  const role = userProfile.role;
  // Nurses and kitchen staff use this shell; admins can also access for supervision
  const allowed = ["NURSE", "KITCHEN_STAFF", "SUPER_ADMIN", "ADMIN"].includes(role);
  if (!allowed) return <Navigate to="/admin/dashboard" replace />;
  return children;
}

export default function NurseShell() {
  return (
    <NurseGuard>
      <NurseLayout>
        <Suspense fallback={<ShellLoader />}>
          <Routes>
            <Route path="dashboard" element={<NurseDashboardPage />} />
            <Route path="patients" element={<NursePatientsPage />} />
            <Route path="orders" element={<NurseMealOrdersPage />} />
            <Route path="history" element={<NurseOrderHistoryPage />} />
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="*" element={<Navigate to="dashboard" replace />} />
          </Routes>
        </Suspense>
      </NurseLayout>
    </NurseGuard>
  );
}
