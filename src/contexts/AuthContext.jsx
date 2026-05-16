import { createContext, useContext, useEffect, useState } from "react";
import { auth, db } from "../config/firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import {
  canAccessKitchenPortal,
  canAccessNursePortal,
  isInventoryRole,
  isMealRole,
} from "../lib/permissions";

const AuthContext = createContext();
const PROFILE_LOAD_TIMEOUT_MS = 7000;

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      requestId += 1;
      const currentRequestId = requestId;

      if (!user) {
        if (active) {
          setCurrentUser(null);
          setUserProfile(null);
          setLoading(false);
        }
        return;
      }

      if (active) {
        setCurrentUser(user);
        setUserProfile(null);
        setLoading(true);
      }

      const timeoutId = window.setTimeout(() => {
        if (!active || currentRequestId !== requestId) return;
        setLoading(false);
      }, PROFILE_LOAD_TIMEOUT_MS);

      (async () => {
        try {
          const profileRef = doc(db, "users", user.uid);
          const profileSnap = await getDoc(profileRef);

          if (!active || currentRequestId !== requestId) return;

          if (profileSnap.exists()) {
            setUserProfile(profileSnap.data());
          } else {
            console.warn("No Firestore profile found for user:", user.uid);
            setUserProfile(null);
          }
        } catch (err) {
          if (!active || currentRequestId !== requestId) return;
          console.error("Error fetching user profile:", err);
          setUserProfile(null);
        } finally {
          if (!active || currentRequestId !== requestId) return;
          window.clearTimeout(timeoutId);
          setLoading(false);
        }
      })();
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  async function logout() {
    return signOut(auth);
  }

  const value = {
    currentUser,
    userProfile,
    loading,
    logout,
    isAdmin: ["SUPER_ADMIN", "ADMIN"].includes(userProfile?.role),
    isInventoryRole: isInventoryRole(userProfile?.role),
    isStoreLevel: ["STORE_MANAGER", "STORE_OFFICER"].includes(userProfile?.role),
    isNurse: userProfile?.role === "NURSE",
    isKitchenStaff: userProfile?.role === "KITCHEN_STAFF",
    isMealRole: isMealRole(userProfile?.role),
    canAccessNursePortal: canAccessNursePortal(userProfile?.role),
    canAccessKitchenPortal: canAccessKitchenPortal(userProfile?.role),
    assignedStores: userProfile?.assignedStores || [],
    assignedWards: userProfile?.assignedWards || [],
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
