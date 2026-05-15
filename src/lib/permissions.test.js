import test from "node:test";
import assert from "node:assert/strict";
import {
  canAccessKitchenPortal,
  canAccessNursePortal,
  getKitchenAccessKeys,
  getKitchenHomePath,
  getNurseLoginRedirectPath,
  getRoleHomePath,
  hasKitchenAdminAccess,
  hasKitchenSectionAccess,
  isInventoryRole,
  isMealRole,
} from "./permissions.js";

test("role helpers map users to the correct home routes", () => {
  assert.equal(getRoleHomePath("NURSE"), "/nurse/dashboard");
  assert.equal(getRoleHomePath("KITCHEN_STAFF"), "/kitchen/dashboard");
  assert.equal(getRoleHomePath("ADMIN"), "/admin/dashboard");
  assert.equal(getRoleHomePath("UNKNOWN"), "/");
});

test("nurse login redirects inventory and kitchen staff to kitchen dashboard", () => {
  assert.equal(getNurseLoginRedirectPath("KITCHEN_STAFF"), "/kitchen/dashboard");
  assert.equal(getNurseLoginRedirectPath("ADMIN"), "/kitchen/dashboard");
  assert.equal(getNurseLoginRedirectPath("NURSE"), "/nurse/dashboard");
});

test("portal access helpers stay aligned with the role model", () => {
  assert.equal(canAccessNursePortal("NURSE"), true);
  assert.equal(canAccessNursePortal("ADMIN"), true);
  assert.equal(canAccessNursePortal("STORE_MANAGER"), false);
  assert.equal(canAccessKitchenPortal("KITCHEN_STAFF"), true);
  assert.equal(canAccessKitchenPortal("NURSE"), false);
});

test("inventory and meal role helpers classify roles consistently", () => {
  assert.equal(isInventoryRole("AUDITOR"), true);
  assert.equal(isInventoryRole("KITCHEN_STAFF"), false);
  assert.equal(isMealRole("NURSE"), true);
  assert.equal(isMealRole("ADMIN"), false);
});

test("kitchen access helpers respect admin and section selections", () => {
  const adminProfile = { role: "KITCHEN_STAFF", kitchenAccess: { admin: true, sections: [] } };
  const limitedProfile = { role: "KITCHEN_STAFF", kitchenAccess: { admin: false, sections: ["patients", "reports"] } };

  assert.equal(hasKitchenAdminAccess(adminProfile), true);
  assert.equal(hasKitchenAdminAccess(limitedProfile), false);
  assert.equal(hasKitchenSectionAccess(adminProfile, "settings"), true);
  assert.equal(hasKitchenSectionAccess(limitedProfile, "patients"), true);
  assert.equal(hasKitchenSectionAccess(limitedProfile, "settings"), false);
  assert.deepEqual(getKitchenAccessKeys(limitedProfile), ["patients", "reports"]);
  assert.equal(getKitchenHomePath(limitedProfile), "/kitchen/patients");
});
