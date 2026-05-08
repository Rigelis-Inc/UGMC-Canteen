import { useState, useEffect, createContext, useContext } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import PublicNavbar from "./PublicNavbar";
import PublicFooter from "./PublicFooter";

const SiteStatusContext = createContext({ orderingEnabled: true });
export function useSiteStatus() { return useContext(SiteStatusContext); }

export default function PublicLayout() {
  const [orderingEnabled, setOrderingEnabled] = useState(true);
  const location = useLocation();
  const showFooter =
    location.pathname !== "/" &&
    !location.pathname.startsWith("/menu") &&
    !location.pathname.startsWith("/orders") &&
    !location.pathname.startsWith("/cart") &&
    !location.pathname.startsWith("/checkout") &&
    !location.pathname.startsWith("/order-confirmation");

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "settings", "orderSettings"),
      (snap) => {
        if (snap.exists()) setOrderingEnabled(snap.data().orderingEnabled !== false);
        else setOrderingEnabled(true);
      },
      () => {
        setOrderingEnabled(true);
      }
    );
    return () => unsub();
  }, []);

  return (
    <SiteStatusContext.Provider value={{ orderingEnabled }}>
      <div className="min-h-screen flex flex-col bg-gray-950">
        {!orderingEnabled && (
          <div className="bg-amber-900/20 border-b border-amber-800/60 text-amber-400 text-center text-xs font-medium py-2 px-4">
            Ordering is currently closed. We'll be back soon!
          </div>
        )}
        <PublicNavbar />
        <main className="flex-1">
          <Outlet />
        </main>
        {showFooter && <PublicFooter />}
      </div>
    </SiteStatusContext.Provider>
  );
}
