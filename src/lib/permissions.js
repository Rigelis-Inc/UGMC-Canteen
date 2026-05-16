import { APP_PATHS } from "./routes.js";

export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  STORE_MANAGER: "STORE_MANAGER",
  STORE_OFFICER: "STORE_OFFICER",
  SUPERVISOR: "SUPERVISOR",
  AUDITOR: "AUDITOR",
  NURSE: "NURSE",
  KITCHEN_STAFF: "KITCHEN_STAFF",
};

export const ROLE_LABELS = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Admin",
  STORE_MANAGER: "Store Manager",
  STORE_OFFICER: "Store Officer",
  SUPERVISOR: "Supervisor",
  AUDITOR: "Auditor",
  NURSE: "Nurse",
  KITCHEN_STAFF: "Kitchen Staff",
};

// Which roles belong to the inventory/admin side (see the admin shell)
export const INVENTORY_ROLES = ["SUPER_ADMIN", "ADMIN", "STORE_MANAGER", "STORE_OFFICER", "SUPERVISOR", "AUDITOR"];
// Which roles belong to the ward/meal ordering side
export const MEAL_ROLES = ["NURSE", "KITCHEN_STAFF"];
// Portal access groups
export const NURSE_PORTAL_ROLES = ["NURSE", "SUPER_ADMIN", "ADMIN"];
export const KITCHEN_PORTAL_ROLES = ["KITCHEN_STAFF", "SUPER_ADMIN", "ADMIN"];

export const KITCHEN_ACCESS_OPTIONS = [
  {
    key: "dashboard",
    label: "All Orders",
    description: "Live order queue and ward overview",
    path: APP_PATHS.kitchen.dashboard,
    adminOnly: false,
  },
  {
    key: "patients",
    label: "Patients",
    description: "Patient records and ward assignments",
    path: APP_PATHS.kitchen.patients,
    adminOnly: false,
  },
  {
    key: "menus",
    label: "Meal Menus",
    description: "View meal menus used by the nurses",
    path: APP_PATHS.kitchen.menus,
    adminOnly: false,
  },
  {
    key: "reports",
    label: "Reports",
    description: "Kitchen reporting and trends",
    path: APP_PATHS.kitchen.reports,
    adminOnly: false,
  },
  {
    key: "wards",
    label: "Wards",
    description: "Manage wards and service areas",
    path: APP_PATHS.kitchen.wards,
    adminOnly: true,
  },
  {
    key: "menusAdmin",
    label: "Meal Menus Admin",
    description: "Edit menus and included items",
    path: APP_PATHS.kitchen.menusAdmin,
    adminOnly: true,
  },
  {
    key: "staff",
    label: "Staff Accounts",
    description: "Create and manage kitchen staff accounts",
    path: APP_PATHS.kitchen.staff,
    adminOnly: true,
  },
  {
    key: "settings",
    label: "Meal Settings",
    description: "Meal cutoff times and service settings",
    path: APP_PATHS.kitchen.settings,
    adminOnly: true,
  },
];

export const KITCHEN_ACCESS_KEYS = KITCHEN_ACCESS_OPTIONS.map((option) => option.key);

export function hasKitchenAdminAccess(profile) {
  if (!profile) return false;
  if (profile.role === ROLES.SUPER_ADMIN || profile.role === ROLES.ADMIN) return true;
  return profile.kitchenAccess?.admin === true;
}

export function getKitchenAccessKeys(profile) {
  if (!profile) return [];
  if (hasKitchenAdminAccess(profile)) return [...KITCHEN_ACCESS_KEYS];
  if (profile.role === ROLES.KITCHEN_STAFF && !profile.kitchenAccess) {
    return [...KITCHEN_ACCESS_KEYS];
  }
  const access = profile.kitchenAccess;
  if (Array.isArray(access)) {
    return [...new Set(access.filter((key) => KITCHEN_ACCESS_KEYS.includes(key)))];
  }
  if (access && typeof access === "object") {
    const sections = Array.isArray(access.sections) ? access.sections : Array.isArray(access.items) ? access.items : [];
    return [...new Set(sections.filter((key) => KITCHEN_ACCESS_KEYS.includes(key)))];
  }
  return [];
}

export function hasKitchenSectionAccess(profile, sectionKey) {
  if (!profile) return false;
  if (hasKitchenAdminAccess(profile)) return true;
  const allowed = new Set(getKitchenAccessKeys(profile));
  if (sectionKey === "orders" || sectionKey === "wardOrders") {
    return allowed.has("dashboard");
  }
  return allowed.has(sectionKey);
}

export function getKitchenHomePath(profile) {
  if (!profile) return APP_PATHS.kitchen.dashboard;
  if (hasKitchenAdminAccess(profile)) return APP_PATHS.kitchen.dashboard;
  for (const option of KITCHEN_ACCESS_OPTIONS) {
    if (hasKitchenSectionAccess(profile, option.key)) {
      return option.path;
    }
  }
  return APP_PATHS.kitchen.dashboard;
}

export function isInventoryRole(role) {
  return INVENTORY_ROLES.includes(role);
}

export function isMealRole(role) {
  return MEAL_ROLES.includes(role);
}

export function canAccessNursePortal(role) {
  return NURSE_PORTAL_ROLES.includes(role);
}

export function canAccessKitchenPortal(role) {
  return KITCHEN_PORTAL_ROLES.includes(role);
}

export function getRoleHomePath(role) {
  if (role === "NURSE") return "/nurse/dashboard";
  if (role === "KITCHEN_STAFF") return "/kitchen/dashboard";
  if (isInventoryRole(role)) return "/admin/dashboard";
  return "/";
}

export function getNurseLoginRedirectPath(role) {
  if (role === "KITCHEN_STAFF" || isInventoryRole(role)) {
    return "/kitchen/dashboard";
  }
  return "/nurse/dashboard";
}

export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    viewDashboard: true,
    manageUsers: true,
    manageStores: true,
    manageProducts: "all",
    receiveStock: "all",
    issueStock: "all",
    adjustStock: "all",
    transferStock: "all",
    manageSuppliers: true,
    manageRecipients: true,
    viewReports: "all",
    exportReports: true,
    viewAuditLogs: true,
    manageSettings: true,
    manageMenuItems: true,
    manageFoodOrders: true,
    manageOrderSettings: true,
  },
  [ROLES.ADMIN]: {
    viewDashboard: true,
    manageUsers: "limited",
    manageStores: true,
    manageProducts: "all",
    receiveStock: "all",
    issueStock: "all",
    adjustStock: "all",
    transferStock: "all",
    manageSuppliers: true,
    manageRecipients: true,
    viewReports: "all",
    exportReports: true,
    viewAuditLogs: true,
    manageSettings: "limited",
    manageMenuItems: true,
    manageFoodOrders: true,
    manageOrderSettings: true,
  },
  [ROLES.STORE_MANAGER]: {
    viewDashboard: true,
    manageUsers: false,
    manageStores: false,
    manageProducts: "assigned",
    receiveStock: "assigned",
    issueStock: "assigned",
    adjustStock: "request_approve",
    transferStock: "assigned",
    manageSuppliers: "assigned",
    manageRecipients: true,
    viewReports: "assigned",
    exportReports: true,
    viewAuditLogs: "limited",
    manageSettings: false,
    manageMenuItems: "limited",
    manageFoodOrders: true,
    manageOrderSettings: false,
  },
  [ROLES.STORE_OFFICER]: {
    viewDashboard: true,
    manageUsers: false,
    manageStores: false,
    manageProducts: "assigned",
    receiveStock: "assigned",
    issueStock: "assigned",
    adjustStock: "request",
    transferStock: "assigned",
    manageSuppliers: "limited",
    manageRecipients: "limited",
    viewReports: "limited",
    exportReports: "limited",
    viewAuditLogs: false,
    manageSettings: false,
    manageMenuItems: false,
    manageFoodOrders: true,
    manageOrderSettings: false,
  },
  [ROLES.SUPERVISOR]: {
    viewDashboard: true,
    manageUsers: false,
    manageStores: false,
    manageProducts: "view",
    receiveStock: "limited",
    issueStock: "limited",
    adjustStock: "approve",
    transferStock: "view",
    manageSuppliers: "view",
    manageRecipients: "view",
    viewReports: "all",
    exportReports: true,
    viewAuditLogs: true,
    manageSettings: false,
    manageMenuItems: false,
    manageFoodOrders: true,
    manageOrderSettings: false,
  },
  [ROLES.AUDITOR]: {
    viewDashboard: true,
    manageUsers: false,
    manageStores: false,
    manageProducts: "view",
    receiveStock: false,
    issueStock: false,
    adjustStock: "view",
    transferStock: "view",
    manageSuppliers: "view",
    manageRecipients: "view",
    viewReports: "all",
    exportReports: true,
    viewAuditLogs: true,
    manageSettings: false,
    manageMenuItems: false,
    manageFoodOrders: "view",
    manageOrderSettings: false,
    // Meal ordering
    manageWards: false,
    managePatients: false,
    createMealOrders: false,
    viewWardMealOrders: false,
    manageMealMenus: false,
    manageMealOrders: false,
    processKitchenOrders: false,
    viewKitchenDashboard: false,
    viewMealReports: false,
    manageMealSettings: false,
  },
};

// ── Meal ordering permissions for new roles ─────────────────────────────────
// Merged into ROLE_PERMISSIONS after initial definition
const MEAL_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: {
    manageWards: true,
    managePatients: true,
    createMealOrders: true,
    viewWardMealOrders: true,
    manageMealMenus: true,
    manageMealOrders: true,
    processKitchenOrders: true,
    viewKitchenDashboard: true,
    viewMealReports: true,
    manageMealSettings: true,
  },
  [ROLES.ADMIN]: {
    manageWards: true,
    managePatients: true,
    createMealOrders: true,
    viewWardMealOrders: true,
    manageMealMenus: true,
    manageMealOrders: true,
    processKitchenOrders: true,
    viewKitchenDashboard: true,
    viewMealReports: true,
    manageMealSettings: true,
  },
  [ROLES.AUDITOR]: {
    manageWards: false,
    managePatients: "view",
    createMealOrders: false,
    viewWardMealOrders: true,
    manageMealMenus: "view",
    manageMealOrders: "view",
    processKitchenOrders: false,
    viewKitchenDashboard: true,
    viewMealReports: true,
    manageMealSettings: false,
  },
};

Object.keys(MEAL_PERMISSIONS).forEach((role) => {
  Object.assign(ROLE_PERMISSIONS[role], MEAL_PERMISSIONS[role]);
});

// ── New roles: NURSE and KITCHEN_STAFF ──────────────────────────────────────
ROLE_PERMISSIONS[ROLES.NURSE] = {
  viewDashboard: false,
  manageUsers: false,
  manageStores: false,
  manageProducts: false,
  receiveStock: false,
  issueStock: false,
  adjustStock: false,
  transferStock: false,
  manageSuppliers: false,
  manageRecipients: false,
  viewReports: false,
  exportReports: false,
  viewAuditLogs: false,
  manageSettings: false,
  manageMenuItems: false,
  manageFoodOrders: false,
  manageOrderSettings: false,
  // Meal ordering
  manageWards: false,
  managePatients: "assigned",  // only their ward
  createMealOrders: "assigned",
  viewWardMealOrders: "assigned",
  manageMealMenus: "view",
  manageMealOrders: false,
  processKitchenOrders: false,
  viewKitchenDashboard: false,
  viewMealReports: "assigned",
  manageMealSettings: false,
};

ROLE_PERMISSIONS[ROLES.KITCHEN_STAFF] = {
  viewDashboard: false,
  manageUsers: false,
  manageStores: false,
  manageProducts: false,
  receiveStock: false,
  issueStock: false,
  adjustStock: false,
  transferStock: false,
  manageSuppliers: false,
  manageRecipients: false,
  viewReports: false,
  exportReports: false,
  viewAuditLogs: false,
  manageSettings: false,
  manageMenuItems: false,
  manageFoodOrders: false,
  manageOrderSettings: false,
  // Meal ordering
  manageWards: false,
  managePatients: false,
  createMealOrders: false,
  viewWardMealOrders: true,
  manageMealMenus: "view",
  manageMealOrders: true,
  processKitchenOrders: true,
  viewKitchenDashboard: true,
  viewMealReports: "limited",
  manageMealSettings: false,
};

export function hasPermission(userRole, permission) {
  if (!userRole || !ROLE_PERMISSIONS[userRole]) return false;
  const perms = ROLE_PERMISSIONS[userRole];
  const val = perms[permission];
  return val === true || val === "all" || val === "assigned" || val === "limited" || val === "request_approve" || val === "request" || val === "approve" || val === "view";
}

export function getAccessLevel(userRole, permission) {
  if (!userRole || !ROLE_PERMISSIONS[userRole]) return false;
  return ROLE_PERMISSIONS[userRole][permission] || false;
}
