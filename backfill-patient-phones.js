/**
 * backfill-patient-phones.js
 *
 * Populates existing patient documents with alternating phone numbers.
 *
 * Usage:
 *   node backfill-patient-phones.js
 */

import { initializeApp, cert } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const serviceAccount = require("./serviceAccountKey.json");

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const PHONE_POOL = ["0556007486", "0535605682"];
const BATCH_SIZE = 400;

function patientSort(a, b) {
  const aTime = a.createdAt?.seconds ?? 0;
  const bTime = b.createdAt?.seconds ?? 0;
  if (aTime !== bTime) return aTime - bTime;

  const aName = String(a.patientName || "").toLowerCase();
  const bName = String(b.patientName || "").toLowerCase();
  if (aName !== bName) return aName.localeCompare(bName);

  return String(a.id).localeCompare(String(b.id));
}

async function main() {
  const snap = await db.collection("patients").get();
  const patients = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })).sort(patientSort);

  if (patients.length === 0) {
    console.log("No patient documents found.");
    return;
  }

  let updated = 0;

  for (let i = 0; i < patients.length; i += BATCH_SIZE) {
    const batch = db.batch();
    const slice = patients.slice(i, i + BATCH_SIZE);

    slice.forEach((patient, offset) => {
      const phone = PHONE_POOL[(i + offset) % PHONE_POOL.length];
      batch.update(db.collection("patients").doc(patient.id), {
        phone,
        updatedAt: FieldValue.serverTimestamp(),
      });
      updated += 1;
    });

    await batch.commit();
    console.log(`Updated ${Math.min(i + BATCH_SIZE, patients.length)} / ${patients.length} patients`);
  }

  console.log(`Done. Populated ${updated} patient phone numbers.`);
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
