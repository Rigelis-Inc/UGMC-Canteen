import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { CartProvider } from "./contexts/CartContext";

const LoginPage = lazy(() => import("./pages/auth/LoginPage"));
const AppShell = lazy(() => import("./AppShell"));
const PublicLayout = lazy(() => import("./components/public/PublicLayout"));
const LandingPage = lazy(() => import("./pages/public/LandingPage"));
const MenuPage = lazy(() => import("./pages/public/MenuPage"));
const CartPage = lazy(() => import("./pages/public/CartPage"));
const CheckoutPage = lazy(() => import("./pages/public/CheckoutPage"));
const OrderConfirmationPage = lazy(() => import("./pages/public/OrderConfirmationPage"));
const TrackOrderPage = lazy(() => import("./pages/public/TrackOrderPage"));

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
      <CartProvider>
        <BrowserRouter>
          <Suspense fallback={<AppLoader />}>
            <Routes>
              {/* Public routes */}
              <Route element={<PublicLayout />}>
                <Route index element={<LandingPage />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/cart" element={<CartPage />} />
                <Route path="/checkout" element={<CheckoutPage />} />
                <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
                <Route path="/orders/:orderId?" element={<TrackOrderPage />} />
                <Route path="/track-order/:orderId?" element={<Navigate to="/orders" replace />} />
              </Route>

              {/* Admin routes */}
              <Route path="/admin/login" element={<LoginPage />} />
              <Route path="/admin/*" element={<AppShell />} />

              {/* Legacy redirects */}
              <Route path="/login" element={<Navigate to="/admin/login" replace />} />
              <Route path="/dashboard" element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </CartProvider>
    </AuthProvider>
  );
}
