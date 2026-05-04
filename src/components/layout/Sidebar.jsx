import { useState, useCallback, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { hasPermission } from "../../lib/permissions";
import {
  LayoutDashboard,
  Warehouse,
  Package,
  ArrowDownToLine,
  ArrowUpToLine,
  Truck,
  Users,
  BarChart3,
  ShieldCheck,
  Settings,
  LogOut,
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Activity,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

const dashboardItem = { label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", permission: "viewDashboard" };

const navGroups = [
  {
    id: "inventory",
    label: "Inventory",
    icon: Warehouse,
    items: [
      { label: "Stores", icon: Warehouse, path: "/stores", permission: "viewDashboard" },
      { label: "Products", icon: Package, path: "/products", permission: "manageProducts" },
      { label: "Receive Stock", icon: ArrowDownToLine, path: "/receive-stock", permission: "receiveStock" },
      { label: "Issue Stock", icon: ArrowUpToLine, path: "/issue-stock", permission: "issueStock" },
      { label: "Movements", icon: Activity, path: "/stock-movements", permission: "viewReports" },
    ],
  },
  {
    id: "management",
    label: "Management",
    icon: Truck,
    items: [
      { label: "Suppliers", icon: Truck, path: "/suppliers", permission: "manageSuppliers" },
      { label: "Recipients", icon: Users, path: "/recipients", permission: "manageRecipients" },
    ],
  },
  {
    id: "administration",
    label: "Administration",
    icon: Settings,
    items: [
      { label: "Reports", icon: BarChart3, path: "/reports", permission: "viewReports" },
      { label: "Audit Logs", icon: ShieldCheck, path: "/audit-logs", permission: "viewAuditLogs" },
      { label: "Users", icon: Users, path: "/users", permission: "manageUsers" },
      { label: "Settings", icon: Settings, path: "/settings", permission: "manageSettings" },
    ],
  },
];

function NavGroup({ group, collapsed, isOpen, onToggle, location, onNav }) {
  const hasActive = group.items.some(
    (item) =>
      location.pathname === item.path ||
      (item.path !== "/dashboard" && location.pathname.startsWith(item.path + "/"))
  );

  if (collapsed) {
    return (
      <div className="space-y-1 mb-3">
        {group.items.map((item) => {
          const isActive =
            location.pathname === item.path ||
            (item.path !== "/dashboard" && location.pathname.startsWith(item.path + "/"));
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onNav}
              title={item.label}
              className={`group relative flex items-center justify-center w-full px-2 py-2.5 rounded-lg transition-all duration-200 ${
                isActive
                  ? "text-white"
                  : "text-slate-500 hover:text-slate-200"
              }`}
            >
              {isActive && (
                <span className="absolute inset-0 bg-gradient-to-r from-primary-600 to-primary-500 rounded-lg shadow-lg shadow-primary-600/20" />
              )}
              <item.icon size={16} className="relative flex-shrink-0" />
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-2">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-[11px] font-semibold uppercase tracking-[0.1em] transition-all duration-200 ${
          hasActive
            ? "text-primary-400"
            : "text-slate-600 hover:text-slate-300"
        }`}
      >
        <group.icon size={13} className="flex-shrink-0 opacity-70" />
        <span className="flex-1 text-left">{group.label}</span>
        {isOpen ? (
          <ChevronDown size={13} className="text-slate-600 flex-shrink-0 transition-transform duration-200" />
        ) : (
          <ChevronRight size={13} className="text-slate-600 flex-shrink-0 transition-transform duration-200" />
        )}
      </button>

      {isOpen && (
        <div className="mt-1 ml-3 pl-3.5 border-l border-slate-700/50 space-y-0.5">
          {group.items.map((item) => {
            const isActive =
              location.pathname === item.path ||
              (item.path !== "/dashboard" && location.pathname.startsWith(item.path + "/"));
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onNav}
                className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-all duration-200 ${
                  isActive
                    ? "text-white"
                    : "text-slate-500 hover:text-slate-200"
                }`}
              >
                {isActive && (
                  <>
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-primary-500 rounded-full" />
                    <span className="absolute inset-0 bg-slate-700/40 rounded-md" />
                  </>
                )}
                <item.icon size={14} className="relative flex-shrink-0 opacity-70" />
                <span className="relative truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function Sidebar({ collapsed, onToggle }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [openGroup, setOpenGroup] = useState("inventory");
  const location = useLocation();
  const navigate = useNavigate();
  const { userProfile, logout } = useAuth();
  const role = userProfile?.role;

  const filteredGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => hasPermission(role, item.permission)),
    }))
    .filter((group) => group.items.length > 0);

  const canViewDashboard = hasPermission(role, "viewDashboard");

  useEffect(() => {
    const activeGroup = filteredGroups.find((group) =>
      group.items.some(
        (item) =>
          location.pathname === item.path ||
          (item.path !== "/dashboard" && location.pathname.startsWith(item.path + "/"))
      )
    );
    if (activeGroup) {
      setOpenGroup(activeGroup.id);
    }
  }, [location.pathname]);

  const handleToggle = useCallback((groupId) => {
    setOpenGroup((prev) => (prev === groupId ? null : groupId));
  }, []);

  const handleNav = useCallback(() => {
    setMobileOpen(false);
  }, []);

  const requestLogout = useCallback(() => {
    setShowLogoutModal(true);
  }, []);

  const confirmLogout = useCallback(async () => {
    setShowLogoutModal(false);
    try {
      await logout();
      navigate("/login");
    } catch {
      console.error("Failed to log out");
    }
  }, [logout, navigate]);

  const isDashboardActive = location.pathname === "/dashboard";

  return (
    <>
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white shadow-lg transition-all"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity duration-200 ${
          mobileOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed top-0 left-0 h-full z-40 transition-all duration-300 ease-in-out bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950 ${
          collapsed ? "w-[72px]" : "w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Header */}
          <div className={`flex items-center px-4 h-[60px] flex-shrink-0 ${collapsed ? "justify-center" : "justify-between"}`}>
            <div className="flex items-center gap-3 min-w-0 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 shadow-lg shadow-primary-600/30">
                <span className="text-white font-bold text-[11px] tracking-wider">UG</span>
              </div>
              {!collapsed && (
                <div className="min-w-0 overflow-hidden">
                  <p className="text-white font-semibold text-sm leading-tight truncate">UGMC Canteen</p>
                  <p className="text-slate-500 text-[11px] leading-tight">Inventory Management</p>
                </div>
              )}
            </div>
            {!collapsed && (
              <button onClick={onToggle} className="hidden lg:flex p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-all flex-shrink-0" title="Collapse sidebar">
                <PanelLeftClose size={15} />
              </button>
            )}
            <button onClick={() => setMobileOpen(false)} className="lg:hidden p-1.5 rounded-md text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-all">
              <X size={15} />
            </button>
          </div>

          {collapsed && (
            <div className="flex justify-center py-2 flex-shrink-0">
              <button onClick={onToggle} className="p-2 rounded-lg text-slate-600 hover:text-slate-300 hover:bg-slate-800/50 transition-all" title="Expand sidebar">
                <PanelLeftOpen size={15} />
              </button>
            </div>
          )}

          {/* Nav */}
          <div className="flex-1 overflow-y-auto px-3 py-3">
            {/* Dashboard */}
            {canViewDashboard && (
              <div className="mb-3">
                <Link
                  to="/dashboard"
                  onClick={handleNav}
                  className={`group relative flex items-center gap-2.5 px-2.5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isDashboardActive
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {isDashboardActive ? (
                    <span className="absolute inset-0 bg-gradient-to-r from-primary-600/90 to-primary-500/90 rounded-lg shadow-lg shadow-primary-600/20" />
                  ) : (
                    <span className="absolute inset-0 bg-slate-800/30 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                  )}
                  <LayoutDashboard size={15} className="relative flex-shrink-0" />
                  {!collapsed && <span className="relative truncate">Dashboard</span>}
                </Link>
              </div>
            )}

            {/* Divider */}
            {!collapsed && (
              <div className="flex items-center gap-3 px-2 mb-3">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent"></div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.15em] text-slate-600">Menu</span>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-slate-700/50 to-transparent"></div>
              </div>
            )}
            {collapsed && (
              <div className="border-t border-slate-800/50 mx-2 mb-3"></div>
            )}

            {/* Groups */}
            {filteredGroups.map((group) => (
              <NavGroup
                key={group.id}
                group={group}
                collapsed={collapsed}
                isOpen={openGroup === group.id}
                onToggle={() => handleToggle(group.id)}
                location={location}
                onNav={handleNav}
              />
            ))}
          </div>

          {/* User */}
          <div className="flex-shrink-0 border-t border-slate-800/50 p-3 space-y-2">
            {collapsed ? (
              <div className="flex justify-center">
                <button onClick={requestLogout} className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all" title="Sign out">
                  <LogOut size={15} />
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 px-2 py-2 rounded-lg bg-slate-800/30">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center flex-shrink-0 ring-2 ring-slate-700/50 shadow-md shadow-primary-600/20">
                    <span className="text-xs font-semibold text-white">{userProfile?.fullName?.charAt(0)?.toUpperCase() || "U"}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-slate-200 leading-tight truncate">{userProfile?.fullName || "User"}</p>
                    <p className="text-[11px] text-slate-500 leading-tight truncate mt-0.5">{role?.replace(/_/g, " ")}</p>
                  </div>
                </div>
                <button onClick={requestLogout} className="flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg text-[13px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all">
                  <LogOut size={15} />
                  Sign out
                </button>
              </>
            )}
          </div>
        </div>
      </aside>

      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="px-6 pt-8 pb-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center mx-auto mb-5 shadow-inner">
                <LogOut size={24} className="text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900">Sign out</h3>
              <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">Are you sure you want to sign out? You will need to log in again to access the system.</p>
            </div>
            <div className="flex gap-3 p-6 pt-2">
              <button onClick={() => setShowLogoutModal(false)} className="flex-1 px-4 py-3 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">Cancel</button>
              <button onClick={confirmLogout} className="flex-1 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-primary-600 to-primary-500 hover:from-primary-700 hover:to-primary-600 rounded-xl transition-all shadow-lg shadow-primary-600/25">Sign out</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
