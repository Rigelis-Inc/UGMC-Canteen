import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useKitchenBadge } from "../../contexts/KitchenBadgeContext";
import { APP_PATHS } from "../../lib/routes";
import { hasKitchenAdminAccess, hasKitchenSectionAccess } from "../../lib/permissions";
import ConfirmActionModal from "../common/ConfirmActionModal";
import {
  ClipboardList,
  BookOpen,
  FileBarChart,
  LogOut,
  X,
  ArrowLeft,
  Building2,
  Users,
  Settings,
  Crown,
  UserRound,
} from "lucide-react";

const navItems = [
  { key: "dashboard", label: "All Orders", icon: ClipboardList, path: APP_PATHS.kitchen.dashboard },
  { key: "patients", label: "Patients", icon: UserRound, path: APP_PATHS.kitchen.patients },
  { key: "menus", label: "Meal Menus", icon: BookOpen, path: APP_PATHS.kitchen.menus },
  { key: "reports", label: "Reports", icon: FileBarChart, path: APP_PATHS.kitchen.reports },
];

const adminNavItems = [
  { key: "wards", label: "Wards", icon: Building2, path: APP_PATHS.kitchen.wards },
  { key: "menusAdmin", label: "Meal Menus Admin", icon: Crown, path: APP_PATHS.kitchen.menusAdmin },
  { key: "staff", label: "Staff Accounts", icon: Users, path: APP_PATHS.kitchen.staff },
  { key: "settings", label: "Meal Settings", icon: Settings, path: APP_PATHS.kitchen.settings },
];

export default function KitchenSidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout, isAdmin } = useAuth();
  const { requested, preparing } = useKitchenBadge();
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const kitchenAdmin = hasKitchenAdminAccess(userProfile);

  // Total active = needs attention (requested) + in-flight (preparing)
  const activeCount = requested + preparing;

  async function confirmLogout() {
    setShowLogoutModal(false);
    await logout();
    navigate(APP_PATHS.root);
  }

  return (
    <>
      <aside
        className={`fixed top-0 left-0 h-full z-40 w-60 flex flex-col
        bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950
        transition-transform duration-300 ease-in-out
        ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex items-center justify-between px-4 h-16 flex-shrink-0 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <img src="/favicon_48.png" alt="Mayrit Cuisines" className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Mayrit Cuisines</p>
              <p className="text-primary-400/80 text-[11px] leading-tight">Kitchen Portal</p>
            </div>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {userProfile && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-slate-800/60 border border-slate-700/50">
            <p className="text-slate-400 text-[11px] font-medium uppercase tracking-wide">Signed in as</p>
            <p className="text-white text-xs mt-0.5 font-medium leading-snug">{userProfile.fullName}</p>
            <p className="text-slate-500 text-[11px]">{userProfile.email}</p>
          </div>
        )}

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems
            .filter(({ key, path }) => {
              if (kitchenAdmin && key === "menus") return false;
              return hasKitchenSectionAccess(userProfile, key) && path;
            })
            .map(({ label, icon: Icon, path }) => {
              const active = location.pathname === path || location.pathname.startsWith(path + "/");
              const isDashboard = path === APP_PATHS.kitchen.dashboard;
              return (
                <Link
                  key={path}
                  to={path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                    active
                      ? "bg-primary-500 text-white font-medium shadow-md shadow-primary-500/30"
                      : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                  }`}
                >
                  <Icon size={16} className="flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isDashboard && activeCount > 0 && (
                    <span
                      className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center tabular-nums ${
                        active
                          ? "bg-white/25 text-white"
                          : requested > 0
                          ? "bg-amber-400 text-slate-900"
                          : "bg-slate-600 text-slate-200"
                      }`}
                    >
                      {activeCount > 99 ? "99+" : activeCount}
                    </span>
                  )}
                </Link>
              );
            })}

          {adminNavItems.some(({ key }) => hasKitchenSectionAccess(userProfile, key)) && (
            <>
              <div className="pt-3 pb-1 px-3">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-600">Administration</p>
              </div>
              {adminNavItems
                .filter(({ key }) => hasKitchenSectionAccess(userProfile, key))
                .map(({ label, icon: Icon, path }) => {
                const active = location.pathname === path || location.pathname.startsWith(path + "/");
                return (
                  <Link
                    key={path}
                    to={path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                      active
                        ? "bg-primary-500 text-white font-medium shadow-md shadow-primary-500/30"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/60"
                    }`}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <span>{label}</span>
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="p-3 border-t border-slate-800 flex-shrink-0 space-y-1">
          {isAdmin && (
            <Link
              to={APP_PATHS.adminHome}
              className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-primary-400 hover:text-white hover:bg-primary-500/20 transition-all border border-primary-500/20"
            >
              <ArrowLeft size={16} className="flex-shrink-0" />
              <span>Back to Admin</span>
            </Link>
          )}
          <button
            onClick={() => setShowLogoutModal(true)}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={16} className="flex-shrink-0" />
            <span>Sign out</span>
          </button>
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
