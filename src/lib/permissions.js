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
