// 1. Imports
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";       // <--- MISSING?
import { getFirestore } from "firebase/firestore"; // <--- MISSING?

// 2. Your Configuration (KEEP YOUR REAL KEYS HERE)
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

// 4. EXPORTS - The rest of your app needs these lines!
export const auth = getAuth(app);
export const db = getFirestore(app);