// Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";

import {
  initializeAuth,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCDdEVyEk_99psr5D5fFhsipQ0SjsgUov4",
  authDomain: "fundsiq.firebaseapp.com",
  projectId: "fundsiq",
  storageBucket: "fundsiq.firebasestorage.app",
  messagingSenderId: "778280805278",
  appId: "1:778280805278:web:7ab7dd6ce68370e33aac8f",
  measurementId: "G-9QMVJX15TQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Authentication with persistent login
export const auth = initializeAuth(app, {
  persistence: browserLocalPersistence
});

// Initialize Firestore
export const db = getFirestore(app);

console.log("FundsIQ Firebase initialized successfully");