export const ROLES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  STORE_MANAGER: "STORE_MANAGER",
  STORE_OFFICER: "STORE_OFFICER",
  SUPERVISOR: "SUPERVISOR",
  AUDITOR: "AUDITOR",
};

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
  },
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
