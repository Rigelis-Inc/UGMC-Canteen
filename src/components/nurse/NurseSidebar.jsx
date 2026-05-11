import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  History,
  LogOut,
  X,
} from "lucide-react";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, path: "/nurse/dashboard" },
  { label: "Patients", icon: Users, path: "/nurse/patients" },
  { label: "Place Orders", icon: ClipboardList, path: "/nurse/orders" },
  { label: "Order History", icon: History, path: "/nurse/history" },
];

export default function NurseSidebar({ mobileOpen, setMobileOpen }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login");
  };

  return (
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
            onClick={() => setMobileOpen(false)}
            className="lg:hidden p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {/* Ward badge */}
        {userProfile?.assignedWards?.length > 0 && (
          <div className="mx-4 mt-3 px-3 py-2 rounded-lg bg-primary-600/15 border border-primary-500/30">
            <p className="text-primary-400 text-[11px] font-medium uppercase tracking-wide">Assigned Ward(s)</p>
            <p className="text-white text-xs mt-0.5 leading-snug">
              {userProfile.assignedWards.join(", ")}
            </p>
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-0.5">
          {navItems.map(({ label, icon: Icon, path }) => {
            const active = location.pathname === path || location.pathname.startsWith(path + "/");
            return (
              <Link
                key={path}
                to={path}
                onClick={() => setMobileOpen(false)}
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
        <div className="flex-shrink-0 px-3 py-4 border-t border-slate-800 space-y-1">
          <div className="px-3 py-2 mb-1">
            <p className="text-white text-sm font-medium truncate">{userProfile?.fullName || "Nurse"}</p>
            <p className="text-slate-500 text-[11px] truncate">{userProfile?.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
          >
            <LogOut size={16} />
            <span>Log out</span>
          </button>
        </div>
      </div>
    </aside>
  );
}
