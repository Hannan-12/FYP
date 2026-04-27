// 1. Imports
import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserSessionPersistence, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 2. Your Configuration
const firebaseConfig = {
  apiKey: "AIzaSyD7afZSZTkh6yoc30b4Amqh9EeEd99RG54",
  authDomain: "devskill-fyp.firebaseapp.com",
  projectId: "devskill-fyp",
  storageBucket: "devskill-fyp.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};

// 3. Initialize Firebase
const app = initializeApp(firebaseConfig);

// 4. Auth — session-only persistence (expires when browser/tab is closed)
export const auth = getAuth(app);
setPersistence(auth, browserSessionPersistence);

export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();