import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

test("firestore rules are not open to any authenticated user", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /match \/users\/\{userId\}/);
  assert.match(rules, /match \/stockMovements\/\{movementId\}/);
  assert.match(rules, /match \/auditLogs\/\{logId\}/);
  assert.doesNotMatch(rules, /allow read, write:\s*if request\.auth != null;/);
  assert.match(rules, /allow read, write:\s*if false;/);
});

test("firestore rules keep collection-specific access constraints", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /allow read: if signedIn\(\) && \(isAdmin\(\) \|\| request\.auth\.uid == userId\)/);
  assert.match(rules, /allow create: if signedIn\(\) && canManageStock\(\)/);
  assert.match(rules, /allow read: if signedIn\(\) && \(/);
  assert.match(rules, /canReadAuditLogs\(\) \|\|/);
});

test("storage rules deny access by default", async () => {
  const rules = await readProjectFile("storage.rules");
  assert.match(rules, /allow read, write:\s*if false;/);
  assert.doesNotMatch(rules, /allow read, write:\s*if request\.auth != null;/);
});

test("firestore rules allow public read of active menu items", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /match \/menuItems\/\{itemId\}/);
  assert.match(rules, /resource\.data\.isActive == true/);
  assert.match(rules, /canManageMenu\(\)/);
});

test("firestore rules allow public create of food orders and signed-in order management", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /match \/foodOrders\/\{orderId\}/);
  assert.match(rules, /allow create: if validFoodOrderData\(\);/);
  assert.match(rules, /allow read: if signedIn\(\) && canViewOrders\(\)/);
  assert.match(rules, /allow update: if signedIn\(\) && canManageOrders\(\)/);
});

test("firestore rules protect orderStatusLogs from modification", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /match \/orderStatusLogs\/\{logId\}/);
  assert.match(rules, /allow create: if signedIn\(\) && canManageOrders\(\)/);
  assert.match(rules, /allow update, delete: if false;/);
});

test("firestore rules allow public read of order settings", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /settingId == "orderSettings"/);
});

test("firestore rules allow public read of publicOrderTracking", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /match \/publicOrderTracking\/\{trackingId\}/);
  assert.match(rules, /allow read: if true;/);
  assert.match(rules, /allow create: if validPublicTrackingData\(\);/);
});

test("firestore rules validate nurse patient documents using patientName", async () => {
  const rules = await readProjectFile("firestore.rules");
  assert.match(rules, /match \/patients\/\{patientId\}/);
  assert.match(rules, /allow create: if signedIn\(\) && isMealRole\(\)[\s\S]*request\.resource\.data\.patientName is string/);
  assert.match(rules, /allow update: if signedIn\(\) && isMealRole\(\)[\s\S]*request\.resource\.data\.patientName is string/);
  assert.match(rules, /request\.resource\.data\.patientClass is string/);
  assert.match(rules, /request\.resource\.data\.status is string/);
});

test("storage rules allow public read of menu item images", async () => {
  const rules = await readProjectFile("storage.rules");
  assert.match(rules, /match \/uploads\/menu-items\/\{itemId\}\/\{fileName\}/);
  assert.match(rules, /allow read: if true;/);
  assert.match(rules, /allow write: if request\.auth != null;/);
});
