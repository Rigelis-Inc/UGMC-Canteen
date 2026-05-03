import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyBUEd99HG9M3ed2f22Rw2JF3ElHtgT4f2A",
  authDomain: "ugmc-stores.firebaseapp.com",
  projectId: "ugmc-stores",
  storageBucket: "ugmc-stores.firebasestorage.app",
  messagingSenderId: "754702783833",
  appId: "1:754702783833:web:804887ec1cdbe2cbea2848",
  measurementId: "G-BEMXB5GHH4"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

export default app;
