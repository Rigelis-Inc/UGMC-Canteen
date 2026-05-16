import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBUEd99HG9M3ed2f22Rw2JF3ElHtgT4f2A",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ugmc-stores.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ugmc-stores",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ugmc-stores.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "754702783833",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:754702783833:web:804887ec1cdbe2cbea2848",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-BEMXB5GHH4",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
