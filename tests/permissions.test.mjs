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

test("super admin and admin can manage menu items", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "manageMenuItems"), true);
  assert.equal(hasPermission("ADMIN", "manageMenuItems"), true);
  assert.equal(getAccessLevel("SUPER_ADMIN", "manageMenuItems"), true);
  assert.equal(getAccessLevel("ADMIN", "manageMenuItems"), true);
});

test("store manager has limited menu item access", () => {
  assert.equal(hasPermission("STORE_MANAGER", "manageMenuItems"), true);
  assert.equal(getAccessLevel("STORE_MANAGER", "manageMenuItems"), "limited");
});

test("store officer and supervisor cannot manage menu items", () => {
  assert.equal(hasPermission("STORE_OFFICER", "manageMenuItems"), false);
  assert.equal(hasPermission("SUPERVISOR", "manageMenuItems"), false);
  assert.equal(hasPermission("AUDITOR", "manageMenuItems"), false);
});

test("all roles except auditor can manage food orders", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "manageFoodOrders"), true);
  assert.equal(hasPermission("ADMIN", "manageFoodOrders"), true);
  assert.equal(hasPermission("STORE_MANAGER", "manageFoodOrders"), true);
  assert.equal(hasPermission("STORE_OFFICER", "manageFoodOrders"), true);
  assert.equal(hasPermission("SUPERVISOR", "manageFoodOrders"), true);
  assert.equal(getAccessLevel("AUDITOR", "manageFoodOrders"), "view");
});

test("only super admin and admin can manage order settings", () => {
  assert.equal(hasPermission("SUPER_ADMIN", "manageOrderSettings"), true);
  assert.equal(hasPermission("ADMIN", "manageOrderSettings"), true);
  assert.equal(hasPermission("STORE_MANAGER", "manageOrderSettings"), false);
  assert.equal(hasPermission("STORE_OFFICER", "manageOrderSettings"), false);
  assert.equal(hasPermission("SUPERVISOR", "manageOrderSettings"), false);
  assert.equal(hasPermission("AUDITOR", "manageOrderSettings"), false);
});
