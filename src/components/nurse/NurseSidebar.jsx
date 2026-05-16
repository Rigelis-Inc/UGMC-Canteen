import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../contexts/AuthContext";
import { APP_PATHS } from "../../lib/routes";
import ConfirmActionModal from "../common/ConfirmActionModal";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  History,
  LogOut,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: APP_PATHS.nurse.dashboard },
  { label: "Patients", icon: Users, path: APP_PATHS.nurse.patients },
  { label: "Place Orders", icon: ClipboardList, path: APP_PATHS.nurse.orders },
  { label: "Order History", icon: History, path: APP_PATHS.nurse.history },
];

export default function NurseSidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [wardNames, setWardNames] = useState([]);
  const [wardNamesLoading, setWardNamesLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadWardNames() {
      const assignedWards = userProfile?.assignedWards || [];
      if (assignedWards.length === 0) {
        if (active) {
          setWardNames([]);
          setWardNamesLoading(false);
        }
        return;
      }

      if (active) setWardNamesLoading(true);
      try {
        const snap = await getDocs(collection(db, "wards"));
        const wardMap = new Map();
        snap.docs.forEach((wardDoc) => {
          const ward = wardDoc.data();
          wardMap.set(wardDoc.id, ward?.name || wardDoc.id);
          if (ward?.name) {
            wardMap.set(ward.name, ward.name);
          }
        });
        const nextWardNames = assignedWards.map((ward) => wardMap.get(ward) || ward);
        if (active) setWardNames(nextWardNames);
      } catch {
        if (active) setWardNames([]);
      }
      if (active) setWardNamesLoading(false);
    }

    loadWardNames();
    return () => {
      active = false;
    };
  }, [userProfile?.assignedWards]);

  async function confirmLogout() {
    setShowLogoutModal(false);
    await logout();
    navigate(APP_PATHS.root);
  }

  return (
    <>
    <aside
      className={`fixed top-0 left-0 h-full z-40 w-60 transition-transform duration-300 ease-in-out
        bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
    >
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-16 flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/favicon_48.png" alt="Mayrit" className="w-8 h-8 rounded-lg" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Mayrit Cuisines</p>
              <p className="text-slate-400 text-[11px] leading-tight">Nurse Portal</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen?.(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="lg:hidden flex flex-1 flex-col min-h-0">
            {/* Ward badge */}
            {userProfile?.assignedWards?.length > 0 && (
              <div className="mx-4 mt-3 rounded-2xl bg-gradient-to-br from-primary-600/15 to-primary-500/10 border border-primary-500/25 p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-primary-300 text-[11px] font-semibold uppercase tracking-[0.16em]">Assigned Wards</p>
                  <span className="text-[10px] font-medium text-primary-200/80 bg-primary-500/10 px-2 py-0.5 rounded-full border border-primary-500/20">
                    {wardNames.length || userProfile.assignedWards.length}
                  </span>
                </div>
                {wardNamesLoading ? (
                  <div className="flex flex-wrap gap-2">
                    <span className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-slate-950/20 text-slate-400 text-[11px] font-medium border border-white/5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary-300/80 animate-pulse flex-shrink-0" />
                      Resolving wards...
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {(wardNames.length > 0 ? wardNames : userProfile.assignedWards).map((ward) => (
                      <span
                        key={ward}
                        className="inline-flex items-center gap-1.5 max-w-full px-2.5 py-1 rounded-full bg-slate-950/40 text-white text-xs font-medium border border-white/10 shadow-sm"
                      >
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-300 flex-shrink-0" />
                        <span className="truncate">{ward}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="mt-auto px-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3">
              <div className="space-y-2">
                <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-2.5 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white text-[13px] font-medium truncate">{userProfile?.fullName || "Nurse"}</p>
                      <p className="text-slate-500 text-[11px] truncate">{userProfile?.email}</p>
                    </div>
                    <button
                      onClick={() => setShowLogoutModal(true)}
                      className="flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-red-300 transition-all hover:bg-red-500/20"
                    >
                      <LogOut size={13} />
                      <span>Sign out</span>
                    </button>
                  </div>
                </div>

                <nav className="space-y-1.5">
                  {navItems.map(({ label, icon: Icon, path }) => {
                    const active = location.pathname === path || location.pathname.startsWith(path + "/");
                    return (
                      <Link
                        key={path}
                        to={path}
                        onClick={() => setMobileOpen?.(false)}
                        className={`flex w-full items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all ${
                          active
                            ? "bg-primary-600 text-white font-medium shadow-md shadow-primary-600/30"
                            : "bg-slate-950/40 text-slate-400 hover:text-white hover:bg-slate-800/60"
                        }`}
                      >
                        <Icon size={15} className="flex-shrink-0" />
                        <span>{label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            </div>
          </div>

          {/* Desktop nav */}
          <nav className="hidden lg:block flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
            {navItems.map(({ label, icon: Icon, path }) => {
              const active = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
              <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen?.(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    active
                      ? "bg-primary-600 text-white font-medium shadow-md shadow-primary-600/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
          {/* Footer */}
          <div className="hidden lg:block flex-shrink-0 px-3 py-4 border-t border-slate-800 space-y-1">
            <div className="px-3 py-2 mb-1">
              <p className="text-white text-sm font-medium truncate">{userProfile?.fullName || "Nurse"}</p>
              <p className="text-slate-500 text-[11px] truncate">{userProfile?.email}</p>
            </div>
            <button
              onClick={() => setShowLogoutModal(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
            >
              <LogOut size={16} />
              <span>Sign out</span>
            </button>
          </div>
        </div>
      </div>
    </aside>

      <ConfirmActionModal
        open={showLogoutModal}
        title="Sign out?"
        description="You will be returned to the login page. Any unsaved changes will be lost."
        confirmLabel="Sign out"
        cancelLabel="Cancel"
        tone="brand"
        icon={LogOut}
        onConfirm={confirmLogout}
        onCancel={() => setShowLogoutModal(false)}
      />
    </>
  );
}
