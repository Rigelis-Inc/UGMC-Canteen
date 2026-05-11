/**
 * seed-meal-data.js
 * Seeds wards and a full weekly meal menu into Firestore.
 *
 * Usage:
 *   node seed-meal-data.js
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS or the serviceAccountKey.json in the
 * same directory.
 */

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// ---------------------------------------------------------------------------
// WARDS
// ---------------------------------------------------------------------------
const WARDS = [
  { name: "Accident & Emergency",     code: "AE",   category: "EMERGENCY",  isVipEligible: false, isVvipEligible: false },
  { name: "Medical Ward A",           code: "MWA",  category: "GENERAL",    isVipEligible: false, isVvipEligible: false },
  { name: "Medical Ward B",           code: "MWB",  category: "GENERAL",    isVipEligible: false, isVvipEligible: false },
  { name: "Surgical Ward A",          code: "SWA",  category: "SURGERY",    isVipEligible: false, isVvipEligible: false },
  { name: "Surgical Ward B",          code: "SWB",  category: "SURGERY",    isVipEligible: false, isVvipEligible: false },
  { name: "Paediatric Ward",          code: "PAED", category: "PEDIATRIC",  isVipEligible: false, isVvipEligible: false },
  { name: "Obstetrics & Gynaecology", code: "OBG",  category: "OBGYN",      isVipEligible: false, isVvipEligible: false },
  { name: "Neonatal Intensive Care",  code: "NICU", category: "ICU",        isVipEligible: false, isVvipEligible: false },
  { name: "Intensive Care Unit",      code: "ICU",  category: "ICU",        isVipEligible: false, isVvipEligible: false },
  { name: "Orthopaedic Ward",         code: "ORTH", category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Urology Ward",             code: "URO",  category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Neurology Ward",           code: "NEUR", category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Oncology Ward",            code: "ONC",  category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Ear Nose & Throat",        code: "ENT",  category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Eye Ward",                 code: "EYE",  category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Psychiatric Ward",         code: "PSY",  category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Renal / Dialysis Unit",    code: "REN",  category: "SPECIALTY",  isVipEligible: false, isVvipEligible: false },
  { name: "Private Ward (VIP)",       code: "PVT",  category: "PRIVATE",    isVipEligible: true,  isVvipEligible: false },
  { name: "Executive Suite (VVIP)",   code: "VIP",  category: "PRIVATE",    isVipEligible: true,  isVvipEligible: true  },
  { name: "High Dependency Unit",     code: "HDU",  category: "ICU",        isVipEligible: false, isVvipEligible: false },
];

// ---------------------------------------------------------------------------
// MENU DATA
// ---------------------------------------------------------------------------
const DAYS = ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY","SATURDAY","SUNDAY"];

// Base menu items per period (same across all days for simplicity; admins can customise)
const BASE_MENUS = {
  BREAKFAST: {
    GENERAL: {
      title: "Standard Breakfast",
      items: [
        { name: "Porridge (Oat / Corn)", category: "MAIN",    defaultIncluded: true,  description: "Smooth porridge served with sugar",           price: 0 },
        { name: "Bread",                 category: "SIDE",    defaultIncluded: true,  description: "Two slices of white or brown bread",          price: 0 },
        { name: "Boiled Egg",            category: "SIDE",    defaultIncluded: true,  description: "One hard-boiled egg",                         price: 0 },
        { name: "Tea / Cocoa",           category: "DRINK",   defaultIncluded: true,  description: "Hot beverage of choice",                      price: 0 },
      ],
    },
    VIP: {
      title: "VIP Breakfast",
      items: [
        { name: "Oat Porridge",          category: "MAIN",      defaultIncluded: true,  description: "Creamy oat porridge with honey and nuts",   price: 0 },
        { name: "Scrambled Eggs",        category: "SIDE",      defaultIncluded: true,  description: "Fluffy scrambled eggs on toast",            price: 0 },
        { name: "Fresh Fruit Platter",   category: "APPETISER", defaultIncluded: true,  description: "Seasonal fresh fruit",                      price: 0 },
        { name: "Fruit Juice",           category: "DRINK",     defaultIncluded: true,  description: "Fresh orange or mango juice",               price: 0 },
        { name: "Tea / Coffee",          category: "DRINK",     defaultIncluded: true,  description: "Hot beverage of choice",                    price: 0 },
      ],
    },
    VVIP: {
      title: "Executive Breakfast",
      items: [
        { name: "Eggs Benedict",         category: "MAIN",      defaultIncluded: true,  description: "Poached eggs on English muffin with hollandaise", price: 0 },
        { name: "Smoked Salmon",         category: "APPETISER", defaultIncluded: true,  description: "Thinly sliced smoked salmon with capers",    price: 0 },
        { name: "Assorted Pastries",     category: "SIDE",      defaultIncluded: true,  description: "Croissants, muffins, and Danish pastries",   price: 0 },
        { name: "Fresh Fruit Platter",   category: "DESSERT",   defaultIncluded: true,  description: "Premium seasonal fruits",                    price: 0 },
        { name: "Freshly Squeezed Juice",category: "DRINK",     defaultIncluded: true,  description: "Orange, apple, or tropical blend",           price: 0 },
        { name: "Barista Coffee / Tea",  category: "DRINK",     defaultIncluded: true,  description: "Espresso, cappuccino, or premium tea",       price: 0 },
      ],
    },
    PUREE: {
      title: "Pureed Breakfast",
      items: [
        { name: "Smooth Porridge",       category: "MAIN",    defaultIncluded: true,  description: "Fully smooth porridge, no lumps",             price: 0 },
        { name: "Pureed Egg",            category: "SIDE",    defaultIncluded: true,  description: "Blended soft-boiled egg",                     price: 0 },
        { name: "Milk / Cocoa",          category: "DRINK",   defaultIncluded: true,  description: "Warm milk or cocoa",                          price: 0 },
      ],
    },
    NG_TUBE: {
      title: "NG Tube Breakfast Feed",
      items: [
        { name: "Nasogastric Formulary Feed", category: "MAIN", defaultIncluded: true, description: "Standard hospital formulary enteral feed", price: 0 },
      ],
    },
  },
  LUNCH: {
    GENERAL: {
      title: "Standard Lunch",
      items: [
        { name: "Rice",                  category: "MAIN",    defaultIncluded: true,  description: "Steamed white rice",                          price: 0 },
        { name: "Light Soup",            category: "SIDE",    defaultIncluded: true,  description: "Light pepper soup with choice of protein",    price: 0 },
        { name: "Stew",                  category: "SIDE",    defaultIncluded: false, description: "Tomato-based stew with chicken or fish",      price: 0 },
        { name: "Banku",                 category: "MAIN",    defaultIncluded: false, description: "Fermented corn and cassava banku",            price: 0 },
        { name: "Okro Soup",             category: "SIDE",    defaultIncluded: false, description: "Fresh okro soup with smoked fish",            price: 0 },
        { name: "Water",                 category: "DRINK",   defaultIncluded: true,  description: "Chilled drinking water",                      price: 0 },
      ],
    },
    VIP: {
      title: "VIP Lunch",
      items: [
        { name: "Jollof Rice",           category: "MAIN",      defaultIncluded: true,  description: "Party-style jollof rice",                  price: 0 },
        { name: "Grilled Chicken",       category: "SIDE",      defaultIncluded: true,  description: "Herb-marinated grilled chicken",           price: 0 },
        { name: "Garden Salad",          category: "APPETISER", defaultIncluded: true,  description: "Mixed greens with vinaigrette",             price: 0 },
        { name: "Fruit Juice",           category: "DRINK",     defaultIncluded: true,  description: "Chilled fruit juice",                      price: 0 },
        { name: "Fruit Dessert",         category: "DESSERT",   defaultIncluded: true,  description: "Fresh fruit cup",                          price: 0 },
      ],
    },
    VVIP: {
      title: "Executive Lunch",
      items: [
        { name: "Choice of Main Course", category: "MAIN",      defaultIncluded: true,  description: "Grilled tilapia, chicken breast, or beef medallion", price: 0 },
        { name: "Herbed Rice / Pasta",   category: "SIDE",      defaultIncluded: true,  description: "Buttered herbed rice or creamy pasta",     price: 0 },
        { name: "Soup of the Day",       category: "APPETISER", defaultIncluded: true,  description: "Chef's daily soup selection",               price: 0 },
        { name: "Premium Dessert",       category: "DESSERT",   defaultIncluded: true,  description: "Cheesecake, tart, or ice cream",            price: 0 },
        { name: "Still / Sparkling Water",category: "DRINK",    defaultIncluded: true,  description: "Bottled water of choice",                   price: 0 },
      ],
    },
    PUREE: {
      title: "Pureed Lunch",
      items: [
        { name: "Pureed Banku & Soup",   category: "MAIN",    defaultIncluded: true,  description: "Smooth blended banku with strained soup",     price: 0 },
        { name: "Blended Protein",       category: "SIDE",    defaultIncluded: true,  description: "Finely pureed chicken or fish",               price: 0 },
        { name: "Water / Juice",         category: "DRINK",   defaultIncluded: true,  description: "Water or strained juice",                     price: 0 },
      ],
    },
    NG_TUBE: {
      title: "NG Tube Lunch Feed",
      items: [
        { name: "Nasogastric Formulary Feed", category: "MAIN", defaultIncluded: true, description: "Standard hospital formulary enteral feed", price: 0 },
      ],
    },
  },
  SUPPER: {
    GENERAL: {
      title: "Standard Supper",
      items: [
        { name: "Rice",                  category: "MAIN",    defaultIncluded: false, description: "Steamed white rice",                          price: 0 },
        { name: "Waakye",                category: "MAIN",    defaultIncluded: true,  description: "Rice and beans (waakye)",                     price: 0 },
        { name: "Stew",                  category: "SIDE",    defaultIncluded: true,  description: "Tomato stew with fish or chicken",            price: 0 },
        { name: "Kenkey",                category: "MAIN",    defaultIncluded: false, description: "Fermented corn kenkey",                       price: 0 },
        { name: "Fried Fish",            category: "SIDE",    defaultIncluded: true,  description: "Crispy fried tilapia",                        price: 0 },
        { name: "Water",                 category: "DRINK",   defaultIncluded: true,  description: "Chilled drinking water",                      price: 0 },
      ],
    },
    VIP: {
      title: "VIP Supper",
      items: [
        { name: "Fried Rice",            category: "MAIN",      defaultIncluded: true,  description: "Vegetable fried rice",                     price: 0 },
        { name: "Grilled Fish",          category: "SIDE",      defaultIncluded: true,  description: "Seasoned grilled tilapia",                 price: 0 },
        { name: "Coleslaw",              category: "APPETISER", defaultIncluded: true,  description: "Creamy coleslaw",                          price: 0 },
        { name: "Fruit Juice / Water",   category: "DRINK",     defaultIncluded: true,  description: "Chilled beverage",                         price: 0 },
        { name: "Panna Cotta / Yoghurt", category: "DESSERT",   defaultIncluded: true,  description: "Chilled dessert",                          price: 0 },
      ],
    },
    VVIP: {
      title: "Executive Supper",
      items: [
        { name: "Grilled Protein",       category: "MAIN",      defaultIncluded: true,  description: "Beef, chicken, or fish — chef's preparation", price: 0 },
        { name: "Roasted Vegetables",    category: "SIDE",      defaultIncluded: true,  description: "Seasonal roasted vegetables",               price: 0 },
        { name: "Cheese & Crackers",     category: "APPETISER", defaultIncluded: true,  description: "Assorted cheese board",                     price: 0 },
        { name: "Dessert Platter",       category: "DESSERT",   defaultIncluded: true,  description: "Mini desserts — tart, mousse, fruit",       price: 0 },
        { name: "Still / Sparkling Water",category: "DRINK",    defaultIncluded: true,  description: "Bottled water of choice",                   price: 0 },
      ],
    },
    PUREE: {
      title: "Pureed Supper",
      items: [
        { name: "Smooth Porridge",       category: "MAIN",    defaultIncluded: true,  description: "Light smooth porridge",                       price: 0 },
        { name: "Blended Protein",       category: "SIDE",    defaultIncluded: true,  description: "Finely pureed protein",                       price: 0 },
        { name: "Milk / Juice",          category: "DRINK",   defaultIncluded: true,  description: "Warm milk or strained juice",                 price: 0 },
      ],
    },
    NG_TUBE: {
      title: "NG Tube Supper Feed",
      items: [
        { name: "Nasogastric Formulary Feed", category: "MAIN", defaultIncluded: true, description: "Standard hospital formulary enteral feed", price: 0 },
      ],
    },
  },
};

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------
async function seedWards() {
  console.log("Seeding wards…");
  const col = db.collection("wards");
  for (const ward of WARDS) {
    const existing = await col.where("code", "==", ward.code).limit(1).get();
    if (!existing.empty) {
      console.log(`  skip: ${ward.code} (${ward.name}) — already exists`);
      continue;
    }
    await col.add({ ...ward, isActive: true, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
    console.log(`  added: ${ward.code} — ${ward.name}`);
  }
  console.log("Wards done.\n");
}

async function seedMenus() {
  console.log("Seeding meal menus…");
  const col = db.collection("mealMenus");
  const classes = Object.keys(BASE_MENUS.BREAKFAST); // GENERAL, VIP, VVIP, PUREE, NG_TUBE

  for (const day of DAYS) {
    for (const period of Object.keys(BASE_MENUS)) {
      for (const patientClass of classes) {
        const menuData = BASE_MENUS[period][patientClass];
        if (!menuData) continue;

        const existing = await col
          .where("dayOfWeek", "==", day)
          .where("mealPeriod", "==", period)
          .where("patientClass", "==", patientClass)
          .limit(1)
          .get();

        if (!existing.empty) {
          console.log(`  skip: ${day} ${period} ${patientClass}`);
          continue;
        }

        await col.add({
          dayOfWeek: day,
          mealPeriod: period,
          patientClass,
          title: menuData.title,
          items: menuData.items,
          isActive: true,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        console.log(`  added: ${day} ${period} ${patientClass}`);
      }
    }
  }
  console.log("Meal menus done.\n");
}

// ---------------------------------------------------------------------------
// MAIN
// ---------------------------------------------------------------------------
(async () => {
  try {
    await seedWards();
    await seedMenus();
    console.log("All done!");
    process.exit(0);
  } catch (err) {
    console.error("Seed failed:", err);
    process.exit(1);
  }
})();
