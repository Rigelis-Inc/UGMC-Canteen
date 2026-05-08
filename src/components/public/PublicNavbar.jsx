import { useState, useEffect, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { Link, useLocation } from "react-router-dom";
import { useCart } from "../../contexts/CartContext";
import { db } from "../../config/firebase";
import { ShoppingCart, Menu, X, Home, UtensilsCrossed, ClipboardList } from "lucide-react";
import { getCustomerOrderRefs, isActiveCustomerOrderStatus } from "../../lib/publicOrderTracking";

export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [activeOrderCount, setActiveOrderCount] = useState(0);
  const { totalItems } = useCart();
  const location = useLocation();
  const badgeRef = useRef(null);
  const prevTotalRef = useRef(0);

  useEffect(() => {
    if (totalItems > prevTotalRef.current && badgeRef.current) {
      badgeRef.current.animate(
        [{ transform: "scale(1)" }, { transform: "scale(1.4)" }, { transform: "scale(1)" }],
        { duration: 400, easing: "cubic-bezier(0.34, 1.56, 0.64, 1)" }
      );
    }
    prevTotalRef.current = totalItems;
  }, [totalItems]);

  useEffect(() => setMobileOpen(false), [location.pathname]);

  useEffect(() => {
    let unsubscribers = [];
    const syncActiveOrders = () => {
      unsubscribers.forEach((unsub) => unsub());
      unsubscribers = [];
      const refs = getCustomerOrderRefs();
      if (refs.length === 0) { setActiveOrderCount(0); return; }
      let alive = true;
      const statuses = {};
      const updateCount = () => {
        if (!alive) return;
        setActiveOrderCount(Object.values(statuses).filter((s) => isActiveCustomerOrderStatus(s)).length);
      };
      refs.forEach((ref) => {
        const unsub = onSnapshot(doc(db, "publicOrderTracking", ref.id), (snap) => {
          statuses[ref.id] = snap.exists() ? snap.data()?.status : null;
          updateCount();
        });
        unsubscribers.push(unsub);
      });
    };
    syncActiveOrders();
    window.addEventListener("customer-orders-changed", syncActiveOrders);
    window.addEventListener("storage", syncActiveOrders);
    return () => {
      unsubscribers.forEach((unsub) => unsub());
      window.removeEventListener("customer-orders-changed", syncActiveOrders);
      window.removeEventListener("storage", syncActiveOrders);
    };
  }, []);

  const isActive = (path) => location.pathname === path;

  const navLinks = [
    { label: "Home", path: "/", icon: Home },
    { label: "Menu", path: "/menu", icon: UtensilsCrossed },
    { label: "Orders", path: "/orders", icon: ClipboardList },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 bg-gray-950/80 backdrop-blur-xl border-b border-gray-800">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="flex items-center justify-between h-[68px]">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2.5">
              <img src="/mayrit_logo.png" alt="Mayrit Cuisines" className="w-11 h-11 rounded-xl object-contain flex-shrink-0 shadow-md shadow-orange-500/10" />
              <span className="text-base font-black text-white leading-none tracking-tight">
                Mayrit<span className="text-orange-500"> Cuisines</span>
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                    isActive(link.path)
                      ? "bg-orange-500 text-white shadow-sm shadow-orange-500/20"
                      : "text-gray-400 hover:text-orange-400 hover:bg-gray-800"
                  }`}
                >
                  <link.icon size={15} />
                  {link.label}
                  {link.path === "/orders" && activeOrderCount > 0 && (
                    <span className={`min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold ${
                      isActive(link.path) ? "bg-white/20 text-white" : "bg-orange-500 text-white"
                    }`}>
                      {activeOrderCount > 9 ? "9+" : activeOrderCount}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Right side */}
            <div className="flex items-center gap-2">
              <Link
                to="/cart"
                data-cart-button="true"
                className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 transition-all"
              >
                <ShoppingCart size={18} className="text-gray-400" />
                {totalItems > 0 && (
                  <span ref={badgeRef} className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-orange-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 shadow-sm">
                    {totalItems > 9 ? "9+" : totalItems}
                  </span>
                )}
              </Link>
              <button
                type="button"
                className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-gray-800 hover:bg-gray-700 active:scale-90 transition-all"
                onClick={() => setMobileOpen((v) => !v)}
              >
                {mobileOpen ? <X size={18} className="text-gray-400" /> : <Menu size={18} className="text-gray-400" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu dropdown */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
          <div className="absolute top-[77px] left-3 right-3 bg-gray-900 rounded-2xl shadow-2xl shadow-orange-500/10 border border-gray-800 overflow-hidden animate-slideDown" onClick={(e) => e.stopPropagation()}>
            <div className="p-2">
              {navLinks.map((link) => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-4 py-3.5 text-sm font-semibold transition-all ${
                    isActive(link.path)
                      ? "bg-orange-500 text-white"
                      : "text-gray-300 hover:bg-gray-800 hover:text-orange-400"
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <link.icon size={17} />
                    {link.label}
                  </span>
                  {link.path === "/orders" && activeOrderCount > 0 && (
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isActive(link.path) ? "bg-white/25 text-white" : "bg-orange-500 text-white"
                    }`}>
                      {activeOrderCount > 9 ? "9+" : activeOrderCount}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
