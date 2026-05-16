import { signOut } from "firebase/auth";

function clearStorage(storage) {
  if (!storage) return;
  try {
    storage.clear();
  } catch {
    // Ignore storage cleanup errors.
  }
}

function deleteIndexedDb(name) {
  return new Promise((resolve) => {
    try {
      const request = indexedDB.deleteDatabase(name);
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    } catch {
      resolve();
    }
  });
}

async function clearFirebaseDatabases() {
  if (typeof indexedDB === "undefined" || typeof indexedDB.databases !== "function") {
    return;
  }

  try {
    const databases = await indexedDB.databases();
    const firebaseDatabases = databases
      .map((database) => database?.name)
      .filter((name) => typeof name === "string" && name.toLowerCase().startsWith("firebase"));

    await Promise.all(firebaseDatabases.map((name) => deleteIndexedDb(name)));
  } catch {
    // Best-effort cleanup only.
  }
}

function clearCookies() {
  if (typeof document === "undefined") return;

  try {
    const expires = new Date(0).toUTCString();
    document.cookie.split(";").forEach((cookie) => {
      const name = cookie.split("=")[0]?.trim();
      if (!name) return;
      document.cookie = `${name}=; expires=${expires}; path=/`;
      document.cookie = `${name}=; expires=${expires}; path=/; domain=${window.location.hostname}`;
    });
  } catch {
    // Ignore cookie cleanup errors.
  }
}

export async function resetBrowserSession(authInstance) {
  if (authInstance) {
    try {
      await signOut(authInstance);
    } catch {
      // Ignore sign-out cleanup errors.
    }
  }

  if (typeof window === "undefined") return;

  clearStorage(window.localStorage);
  clearStorage(window.sessionStorage);
  clearCookies();
  await clearFirebaseDatabases();
}
