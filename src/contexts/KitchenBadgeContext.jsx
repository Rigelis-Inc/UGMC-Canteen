import { createContext, useContext } from "react";

export const KitchenBadgeContext = createContext(0);

export function useKitchenBadge() {
  return useContext(KitchenBadgeContext);
}
