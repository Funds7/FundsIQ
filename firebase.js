// ==========================================
// FUNDSIQ FIREBASE CONFIGURATION
// ==========================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";


import {
    initializeAuth,
    browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";


import {
    initializeFirestore,
    persistentLocalCache
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


// ==========================================
// FIREBASE CONFIGURATION
// ==========================================

const firebaseConfig = {

    apiKey: "AIzaSyCDdEVyEk_99psr5D5fFhsipQ0SjsgUov4",

    authDomain: "fundsiq.firebaseapp.com",

    projectId: "fundsiq",

    storageBucket: "fundsiq.firebasestorage.app",

    messagingSenderId: "778280805278",

    appId: "1:778280805278:web:7ab7dd6ce68370e33aac8f",

    measurementId: "G-9QMVJX15TQ"

};


// ==========================================
// INITIALIZE FIREBASE
// ==========================================

const app = initializeApp(firebaseConfig);


// ==========================================
// PERSISTENT AUTHENTICATION
// ==========================================

export const auth = initializeAuth(app, {

    persistence: browserLocalPersistence

});


// ==========================================
// FIRESTORE OFFLINE PERSISTENCE
// ==========================================

export const db = initializeFirestore(app, {

    localCache: persistentLocalCache()

});


console.log(
    "FundsIQ initialized with persistent login and offline database caching."
);