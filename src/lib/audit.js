import { addDoc, collection, serverTimestamp } from "firebase/firestore";

export function getAuditActor(currentUser, userProfile) {
  return {
    userId: currentUser?.uid || "",
    userName: userProfile?.fullName || userProfile?.email || "Unknown user",
    userRole: userProfile?.role || "",
  };
}

export async function writeAuditLog(db, payload) {
  try {
    await addDoc(collection(db, "auditLogs"), {
      action: payload.action || "Unknown action",
      entityType: payload.entityType || "",
      entityId: payload.entityId || "",
      description: payload.description || "",
      metadata: payload.metadata || {},
      storeId: payload.storeId || null,
      storeName: payload.storeName || null,
      ...getAuditActor(payload.currentUser, payload.userProfile),
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    console.warn("Failed to write audit log:", error);
  }
}
