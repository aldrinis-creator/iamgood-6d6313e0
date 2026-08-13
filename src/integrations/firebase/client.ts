import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBp6JXeJshCklTyHAvncBgiz-Wi6SFTXNw",
  authDomain: "check-in-6b822.firebaseapp.com",
  projectId: "check-in-6b822",
  storageBucket: "check-in-6b822.firebasestorage.app",
  messagingSenderId: "1088586097658",
  appId: "1:1088586097658:web:a19b5a0221d4959a37ba43",
  measurementId: "G-028JWVM8KR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
