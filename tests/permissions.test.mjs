import test from "node:test";
import assert from "node:assert/strict";
import { getAccessLevel, hasPermission } from "../src/lib/permissions.js";

test("super admin can manage users", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "manageUsers"), true);
  assert.equal(getAccessLevel("SUPER_ADMIN", "manageUsers"), true);
});

test("store officer can request stock adjustment", () => {
  assert.equal(hasPermission("STORE_OFFICER", "adjustStock"), true);
  assert.equal(getAccessLevel("STORE_OFFICER", "adjustStock"), "request");
});

test("auditors cannot receive or issue stock", () => {
  assert.equal(hasPermission("AUDITOR", "receiveStock"), false);
  assert.equal(hasPermission("AUDITOR", "issueStock"), false);
});
