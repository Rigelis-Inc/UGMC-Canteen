/**
 * seed-ugmc-data.js
 * Seeds REAL UGMC data: wards, weekly meal menus, and VIP menu items.
 *
 * Usage:  node seed-ugmc-data.js
 *
 * CAUTION: Deletes ALL existing wards and mealMenus before re-seeding.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// UGMC ACTUAL WARDS
// isVip = patients here receive VIP menu (appetisers + desserts)
// isVvip = patients here receive VVIP menu (extra premium options)
// ---------------------------------------------------------------------------
const WARDS = [
  { code: "AE",      name: "Accident & Emergency",        category: "EMERGENCY",  isVip: false, isVvip: false },
  { code: "GICU",    name: "General ICU",                 category: "ICU",        isVip: false, isVvip: false },
  { code: "PSURG",   name: "Pediatric Surgery",           category: "PEDIATRIC",  isVip: false, isVvip: false },
  { code: "PED_EM",  name: "Pediatric Emergency",         category: "PEDIATRIC",  isVip: false, isVvip: false },
  { code: "PED_MED", name: "Pediatric Medical",           category: "PEDIATRIC",  isVip: false, isVvip: false },
  { code: "OBG_EM",  name: "OBS & Gynae Emergency",       category: "OBGYN",      isVip: false, isVvip: false },
  { code: "OBS",     name: "Obstetrics",                  category: "OBGYN",      isVip: false, isVvip: false },
  { code: "GYN",     name: "Gynaecology",                 category: "OBGYN",      isVip: false, isVvip: false },
  { code: "IMA",     name: "Internal Medicine A",         category: "GENERAL",    isVip: false, isVvip: false },
  { code: "IMB",     name: "Internal Medicine B",         category: "GENERAL",    isVip: false, isVvip: false },
  { code: "CARD",    name: "Cardiology",                  category: "SPECIALTY",  isVip: false, isVvip: false },
  { code: "CICU",    name: "Cardio ICU",                  category: "ICU",        isVip: false, isVvip: false },
  { code: "CTHOR",   name: "Cardio Thoracic",             category: "SPECIALTY",  isVip: true,  isVvip: true  },
  { code: "GSURG",   name: "General Surgery",             category: "SURGERY",    isVip: false, isVvip: false },
  { code: "ORTH",    name: "Orthopaedic",                 category: "SURGERY",    isVip: false, isVvip: false },
  { code: "ALLIED",  name: "Allied Health",               category: "SPECIALTY",  isVip: false, isVvip: false },
  { code: "URO",     name: "Urology",                     category: "SPECIALTY",  isVip: false, isVvip: false },
  { code: "ONC",     name: "Oncology",                    category: "SPECIALTY",  isVip: false, isVvip: false },
  { code: "NEUR",    name: "Neurology",                   category: "SPECIALTY",  isVip: false, isVvip: false },
  { code: "PVT",     name: "Private Ward",                category: "PRIVATE",    isVip: true,  isVvip: true  },
];

// ---------------------------------------------------------------------------
// REAL UGMC STANDARD MENU (from the actual laminated menu board)
// One document per day+period — applies to ALL standard patients
// category: MAIN = numbered food options the nurse picks from
//           SIDE = automatically included with the meal (no choice needed)
//           DRINK = beverages
// ---------------------------------------------------------------------------
const STANDARD_MENU = {
  MONDAY: {
    BREAKFAST: [
      { name: "Oats Porridge",                    category: "MAIN" },
      { name: "Decaf Tea / Coffee",               category: "MAIN" },
      { name: "Tom Brown",                        category: "MAIN" },
      { name: "Pawpaw / Watermelon Juice",        category: "DRINK" },
      { name: "Green Salad / Boiled Egg",         category: "SIDE" },
    ],
    LUNCH: [
      { name: "Boiled Yam/Potatoes & Fish/Chicken Soup",  category: "MAIN" },
      { name: "Vegetable Rice & Grilled Chicken",         category: "MAIN" },
      { name: "Fried Plantain & Beans Stew",              category: "MAIN" },
    ],
    SUPPER: [
      { name: "Banku & Fish/Chicken Soup",                        category: "MAIN" },
      { name: "Boiled Rice/Bread & Vegetable Salad & Fish Soup",  category: "MAIN" },
      { name: "Banku & Fante Fante",                              category: "MAIN" },
    ],
  },
  TUESDAY: {
    BREAKFAST: [
      { name: "Wheat Porridge",                   category: "MAIN" },
      { name: "Corn Porridge",                    category: "MAIN" },
      { name: "Royale Cocoa Tea",                 category: "MAIN" },
      { name: "Pineapple Juice / Tangerine",      category: "DRINK" },
      { name: "Tomato Cucumber Salad",            category: "SIDE" },
    ],
    LUNCH: [
      { name: "Fufu & Goat Light Soup",           category: "MAIN" },
      { name: "Plain Rice & Fish/Chicken Soup",   category: "MAIN" },
      { name: "Banku & Okro Stew",                category: "MAIN" },
    ],
    SUPPER: [
      { name: "Boiled Wheat & Fish Soup",                     category: "MAIN" },
      { name: "Mpotompoto",                                   category: "MAIN" },
      { name: "Boiled Yam/Plantain & Garden Eggs Stew",       category: "MAIN" },
    ],
  },
  WEDNESDAY: {
    BREAKFAST: [
      { name: "Rice-Soy / Rice Porridge",         category: "MAIN" },
      { name: "Oblayo",                           category: "MAIN" },
      { name: "Tom Brown",                        category: "MAIN" },
      { name: "Orange Juice / Pawpaw",            category: "DRINK" },
      { name: "Cooked Vegetables / Scrambled Egg",category: "SIDE" },
    ],
    LUNCH: [
      { name: "Vegetable Rice & Grilled Chicken",                       category: "MAIN" },
      { name: "Jollof & Vegetable Salad",                               category: "MAIN" },
      { name: "Boiled Yam/Cocoyam/Potatoes & Fish/Chicken Light Soup",  category: "MAIN" },
    ],
    SUPPER: [
      { name: "Ga/Fante Kenkey & Fish/Chicken Gravy",  category: "MAIN" },
      { name: "Plain Rice & Dry Fish Soup",            category: "MAIN" },
      { name: "Ga/Fante Kenkey & Fish Light Soup",     category: "MAIN" },
    ],
  },
  THURSDAY: {
    BREAKFAST: [
      { name: "Ekuegbemi",                        category: "MAIN" },
      { name: "Decaf Tea / Coffee",               category: "MAIN" },
      { name: "Corn Porridge",                    category: "MAIN" },
      { name: "Watermelon Juice / Banana",        category: "DRINK" },
      { name: "Green Salad",                      category: "SIDE" },
    ],
    LUNCH: [
      { name: "TZ & Fish/Meat Green Soup",                        category: "MAIN" },
      { name: "Fried Plantain & Beans Stew",                      category: "MAIN" },
      { name: "Waakye & Vegetable Salad & Fish/Chicken Stew",     category: "MAIN" },
    ],
    SUPPER: [
      { name: "Boiled Potatoes/Plantain & Kontomire Stew",    category: "MAIN" },
      { name: "Plain/Brown Rice & Fish/Chicken Soup",         category: "MAIN" },
      { name: "Banku/Kafa & Okro Stew",                       category: "MAIN" },
    ],
  },
  FRIDAY: {
    BREAKFAST: [
      { name: "Tom Brown",                        category: "MAIN" },
      { name: "Oat Porridge",                     category: "MAIN" },
      { name: "Royale Cocoa Tea",                 category: "MAIN" },
      { name: "Pineapple Juice / Tangerine",      category: "DRINK" },
      { name: "Cucumber Tomatoes Salad",          category: "SIDE" },
    ],
    LUNCH: [
      { name: "Fufu & Fish Green Soup",               category: "MAIN" },
      { name: "Vegetable Rice & Fish/Chicken Soup",   category: "MAIN" },
      { name: "Banku/Kafa & Okro Stew",               category: "MAIN" },
    ],
    SUPPER: [
      { name: "Jollof & Vegetable Salad & Grilled Fish/Chicken",      category: "MAIN" },
      { name: "Boiled Yam/Cocoyam & Fish/Chicken Light Soup",         category: "MAIN" },
      { name: "Baked Potatoes & Vegetable Salad & Fish/Chicken",      category: "MAIN" },
    ],
  },
  SATURDAY: {
    BREAKFAST: [
      { name: "Wheat Porridge",                       category: "MAIN" },
      { name: "Corn Porridge",                        category: "MAIN" },
      { name: "Decaf Tea / Coffee",                   category: "MAIN" },
      { name: "Orange Juice / Mango",                 category: "DRINK" },
      { name: "Cooked Vegetables / Poached Egg",      category: "SIDE" },
    ],
    LUNCH: [
      { name: "Boiled Yam/Plantain & Fish/Chicken Soup",              category: "MAIN" },
      { name: "Waakye & Vegetable Salad & Grilled Fish/Chicken",      category: "MAIN" },
      { name: "Boiled Cocoyam/Potatoes & Palava Sauce",               category: "MAIN" },
    ],
    SUPPER: [
      { name: "Ga/Fante Kenkey & Fish/Chicken Light Soup",    category: "MAIN" },
      { name: "Vegetable Rice & Fish/Chicken Stew",           category: "MAIN" },
      { name: "Banku/Kafa & Okro Stew",                       category: "MAIN" },
    ],
  },
  SUNDAY: {
    BREAKFAST: [
      { name: "Rice Soy / Rice Porridge",         category: "MAIN" },
      { name: "Oblayo",                           category: "MAIN" },
      { name: "Royale Cocoa Tea",                 category: "MAIN" },
      { name: "Pawpaw / Watermelon Juice",        category: "DRINK" },
      { name: "Vegetables Salad",                 category: "SIDE" },
    ],
    LUNCH: [
      { name: "Mpotompoto",                           category: "MAIN" },
      { name: "Banku/Kafa & Okro Soup",               category: "MAIN" },
      { name: "Vegetable Rice & Fish/Chicken Soup",   category: "MAIN" },
    ],
    SUPPER: [
      { name: "Plain Rice/Wheat & Fish/Chicken Light Soup",   category: "MAIN" },
      { name: "Boiled Yam/Potatoes & Fish/Chicken Light Soup",category: "MAIN" },
      { name: "Plain Rice & Fish/Chicken Stew",               category: "MAIN" },
    ],
  },
};

// ---------------------------------------------------------------------------
// VIP MENU — fixed appetisers and desserts (from the Mayrit VIP Food Menu board)
// These do NOT change by day. VIP/VVIP patients choose from these IN ADDITION
// to the standard main meals above.
// ---------------------------------------------------------------------------
const VIP_MENU = {
  appetisers: [
    { code: "A1", name: "Garden Salad",   description: "Lettuce, tomatoes, cucumber, green pepper and spinach" },
    { code: "A2", name: "Tuna Salad",     description: "Lettuce, tomatoes, cucumber, green pepper and tuna" },
    { code: "A3", name: "French Salad",   description: "Lettuce, tomatoes, onion, cucumber, green pepper and French beans" },
    { code: "A4", name: "Mixed Salad",    description: "Lettuce, tomatoes, onion, cucumber, green pepper and carrot" },
    { code: "A5", name: "Chicken Salad",  description: "Lettuce, tomatoes, onion, cucumber, green pepper and chicken" },
  ],
  desserts: [
    { code: "D1", name: "Yoghurt",                        description: "" },
    { code: "D2", name: "Fruit Salad",                    description: "" },
    { code: "D3", name: "Coupe Jack",                     description: "" },
    { code: "D4", name: "Pancake",                        description: "" },
    { code: "D5", name: "Beetroot, Banana & Ginger Smoothie",  description: "" },
    { code: "D6", name: "Orange, Carrot & Mango Smoothie",     description: "" },
    { code: "D7", name: "Tropical Green",                 description: "Lettuce and pineapple" },
  ],
};

// ---------------------------------------------------------------------------
// HELPERS — delete all docs in a collection
// ---------------------------------------------------------------------------
async function deleteCollection(collectionPath) {
  const col = db.collection(collectionPath);
  let deleted = 0;
  while (true) {
    const snap = await col.limit(100).get();
    if (snap.empty) break;
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += snap.size;
  }
  console.log(`  deleted ${deleted} docs from ${collectionPath}`);
}

// ---------------------------------------------------------------------------
// SEED WARDS
// ---------------------------------------------------------------------------
async function seedWards() {
  console.log("\n── Seeding wards ──────────────────────────────────────────");
  await deleteCollection("wards");
  const col = db.collection("wards");
  const batch = db.batch();
  for (const ward of WARDS) {
    const ref = col.doc();
    batch.set(ref, {
      ...ward,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    console.log(`  + ${ward.code.padEnd(8)} ${ward.name}`);
  }
  await batch.commit();
  console.log(`  ✓ ${WARDS.length} wards created.`);
}

// ---------------------------------------------------------------------------
// SEED MEAL MENUS (one document per day+period, no patient class)
// ---------------------------------------------------------------------------
async function seedMenus() {
  console.log("\n── Seeding meal menus ─────────────────────────────────────");
  await deleteCollection("mealMenus");
  const col = db.collection("mealMenus");
  let count = 0;
  const days = Object.keys(STANDARD_MENU);
  const periods = ["BREAKFAST", "LUNCH", "SUPPER"];

  for (const day of days) {
    for (const period of periods) {
      const items = STANDARD_MENU[day][period];
      const ref = col.doc();
      await ref.set({
        dayOfWeek: day,
        mealPeriod: period,
        items,
        isActive: true,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });
      count++;
      console.log(`  + ${day} ${period} (${items.filter(i => i.category === "MAIN").length} main options)`);
    }
  }
  console.log(`  ✓ ${count} menu documents created.`);
}

// ---------------------------------------------------------------------------
// SEED VIP MENU (stored in settings/vipMenu)
// ---------------------------------------------------------------------------
async function seedVipMenu() {
  console.log("\n── Seeding VIP menu ───────────────────────────────────────");
  const ref = db.collection("settings").doc("vipMenu");
  await ref.set({
    ...VIP_MENU,
    updatedAt: FieldValue.serverTimestamp(),
  });
  console.log(`  ✓ ${VIP_MENU.appetisers.length} appetisers, ${VIP_MENU.desserts.length} desserts stored in settings/vipMenu.`);
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
(async () => {
  try {
    console.log("UGMC Seed Script — starting…\n");
    await seedWards();
    await seedMenus();
    await seedVipMenu();
    console.log("\n✅ All done! Firestore is populated with real UGMC data.");
    process.exit(0);
  } catch (err) {
    console.error("\n❌ Seed failed:", err);
    process.exit(1);
  }
})();
