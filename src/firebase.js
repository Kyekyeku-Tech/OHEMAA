// src/firebase.js
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
apiKey: "AIzaSyDDpL4BoLOe82z8NV0tQzcItUKT_m7vxZM",
  authDomain: "kyekyeku-ca8e3.firebaseapp.com",
  projectId: "kyekyeku-ca8e3",
  storageBucket: "kyekyeku-ca8e3.firebasestorage.app",
  messagingSenderId: "107861040313",
  appId: "1:107861040313:web:2cd7e5f1d3c2f3ba9f4f68",
  measurementId: "G-1HTN6JL8YB"
};

const mirrorFirebaseConfig = {
  apiKey: "AIzaSyDaflopUVbx5Gh2FBZAjhzc7l7EUjLttBA",
  authDomain: "kyetech-data.firebaseapp.com",
  projectId: "kyetech-data",
  storageBucket: "kyetech-data.firebasestorage.app",
  messagingSenderId: "795074700634",
  appId: "1:795074700634:web:f1dee28a2868e25243ff63",
  measurementId: "G-G5RMHXWQJ7",
};

// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const mirrorApp = getApps().some((a) => a.name === "mirrorApp")
  ? getApp("mirrorApp")
  : initializeApp(mirrorFirebaseConfig, "mirrorApp");
// console.log("🔗 Frontend connected to Firebase project:", firebaseConfig.projectId);
// Export Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const mirrorDb = getFirestore(mirrorApp);