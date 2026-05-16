import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import NurseSidebar from "./NurseSidebar";
import { useAuth } from "../../contexts/AuthContext";
import { APP_PATHS } from "../../lib/routes";
import ConfirmActionModal from "../common/ConfirmActionModal";
import { ClipboardList, History, LayoutDashboard, LogOut, Users } from "lucide-react";

const mobileNavItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: APP_PATHS.nurse.dashboard },
  { label: "Patients", icon: Users, path: APP_PATHS.nurse.patients },
  { label: "Orders", icon: ClipboardList, path: APP_PATHS.nurse.orders },
  { label: "History", icon: History, path: APP_PATHS.nurse.history },
];

export default function NurseLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  async function confirmLogout() {
    setShowLogoutModal(false);
    await logout();
    navigate(APP_PATHS.root);
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <NurseSidebar />

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        {/* Mobile top bar */}
        <div className="lg:hidden flex items-center justify-between gap-3 px-4 h-14 bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <img src="/favicon_48.png" alt="Mayrit" className="w-7 h-7 rounded-md" />
            <span className="font-semibold text-slate-800 text-sm">Nurse Portal</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowLogoutModal(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600"
            >
              <LogOut size={13} />
              <span>Sign out</span>
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-primary-700 text-[12px] font-semibold uppercase">
              {(userProfile?.fullName?.trim()?.[0] || "N").toUpperCase()}
            </div>
          </div>
        </div>

        <main className="flex-1 p-4 pb-24 lg:p-6 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <nav className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
          <div className="grid grid-cols-4 gap-1 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] pt-2">
            {mobileNavItems.map(({ label, icon: Icon, path }) => {
              const active = location.pathname === path || location.pathname.startsWith(path + "/");
              return (
                <Link
                  key={path}
                  to={path}
                  className={`flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2 text-[11px] font-medium transition-colors ${
                    active ? "text-primary-600" : "text-slate-500"
                  }`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>

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
    </div>
  );
}
