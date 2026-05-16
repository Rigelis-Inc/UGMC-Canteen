import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./contexts/AuthContext";
import { KitchenBadgeProvider } from "./contexts/KitchenBadgeContext";
import KitchenLayout from "./components/kitchen/KitchenLayout";
import {
  canAccessKitchenPortal,
  getKitchenHomePath,
  hasKitchenAdminAccess,
  hasKitchenSectionAccess,
  getRoleHomePath,
} from "./lib/permissions";
import { APP_PATHS } from "./lib/routes";

const KitchenOrdersPage = lazy(() => import("./pages/kitchen/KitchenOrdersPage"));
const KitchenMenusPage = lazy(() => import("./pages/kitchen/KitchenMenusPage"));
const KitchenPatientsPage = lazy(() => import("./pages/kitchen/KitchenPatientsPage"));
const KitchenReportsPage = lazy(() => import("./pages/kitchen/KitchenReportsPage"));
const KitchenWardOrdersPage = lazy(() => import("./pages/kitchen/KitchenWardOrdersPage"));

// Admin-only pages (reuse admin-meal pages, Layout already stripped)
const AdminWardsPage = lazy(() => import("./pages/admin-meal/WardsPage"));
const AdminMealUsersPage = lazy(() => import("./pages/admin-meal/MealUsersPage"));
const AdminMealSettingsPage = lazy(() => import("./pages/admin-meal/MealSettingsPage"));
const AdminMealMenusPage = lazy(() => import("./pages/admin-meal/MealMenusPage"));
const AdminMealOrdersPage = lazy(() => import("./pages/admin-meal/MealOrdersPage"));

function ShellLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-amber-500" />
        <span className="text-sm font-medium text-slate-600">Loading kitchen portal...</span>
      </div>
    </div>
  );
}

function KitchenGuard({ children }) {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading) return <ShellLoader />;
  if (!currentUser || !userProfile) return <Navigate to={APP_PATHS.root} replace />;
  // Kitchen staff — also let admins in for supervision
  const allowed = canAccessKitchenPortal(userProfile.role);
  if (!allowed) return <Navigate to={getRoleHomePath(userProfile.role)} replace />;
  return children;
}

function KitchenRoute({ accessKey, children }) {
  const { currentUser, userProfile, loading } = useAuth();
  if (loading) return <ShellLoader />;
  if (!currentUser || !userProfile) return <Navigate to={APP_PATHS.root} replace />;
  if (hasKitchenAdminAccess(userProfile) || hasKitchenSectionAccess(userProfile, accessKey)) {
    return children;
  }
  return <Navigate to={getKitchenHomePath(userProfile)} replace />;
}

export default function KitchenShell() {
  return (
    <KitchenGuard>
      <KitchenBadgeProvider>
        <KitchenLayout>
          <Suspense fallback={<ShellLoader />}>
            <Routes>
              <Route path="dashboard" element={<KitchenRoute accessKey="dashboard"><AdminMealOrdersPage /></KitchenRoute>} />
              <Route path="ward-orders" element={<KitchenRoute accessKey="dashboard"><KitchenWardOrdersPage /></KitchenRoute>} />
              <Route path="orders" element={<KitchenRoute accessKey="dashboard"><KitchenOrdersPage /></KitchenRoute>} />
              <Route path="menus" element={<KitchenRoute accessKey="menus"><KitchenMenusPage /></KitchenRoute>} />
              <Route path="patients" element={<KitchenRoute accessKey="patients"><KitchenPatientsPage /></KitchenRoute>} />
              <Route path="reports" element={<KitchenRoute accessKey="reports"><KitchenReportsPage /></KitchenRoute>} />
              <Route path="wards" element={<KitchenRoute accessKey="wards"><AdminWardsPage /></KitchenRoute>} />
              <Route path="staff" element={<KitchenRoute accessKey="staff"><AdminMealUsersPage /></KitchenRoute>} />
              <Route path="settings" element={<KitchenRoute accessKey="settings"><AdminMealSettingsPage /></KitchenRoute>} />
              <Route path="menus-admin" element={<KitchenRoute accessKey="menusAdmin"><AdminMealMenusPage /></KitchenRoute>} />
              <Route index element={<Navigate to={APP_PATHS.kitchen.dashboard} replace />} />
              <Route path="*" element={<Navigate to={APP_PATHS.kitchen.dashboard} replace />} />
            </Routes>
          </Suspense>
        </KitchenLayout>
      </KitchenBadgeProvider>
    </KitchenGuard>
  );
}
