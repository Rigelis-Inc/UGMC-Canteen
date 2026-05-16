import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../config/firebase";
import { format } from "date-fns";

const KitchenBadgeContext = createContext({ requested: 0, preparing: 0 });

export function useKitchenBadge() {
  return useContext(KitchenBadgeContext);
}

const POLL_INTERVAL_MS = 30_000;

export function KitchenBadgeProvider({ children }) {
  const [counts, setCounts] = useState({ requested: 0, preparing: 0 });

  const refresh = useCallback(async () => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const snap = await getDocs(
        query(collection(db, "wardMealOrders"), where("orderDate", "==", today))
      );
      let requested = 0;
      let preparing = 0;
      snap.forEach((d) => {
        const s = d.data().status;
        if (s === "REQUESTED") requested++;
        else if (s === "PREPARING") preparing++;
      });
      setCounts({ requested, preparing });
    } catch {
      // silently ignore — badge is non-critical
    }
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <KitchenBadgeContext.Provider value={counts}>
      {children}
    </KitchenBadgeContext.Provider>
  );
}
