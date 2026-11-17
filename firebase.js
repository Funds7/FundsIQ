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

    apiKey: "AIzaSyDaURbisisWcSvL9pLeOeNCw43i8chm1Ds",

    authDomain: "fundsiq-staging.firebaseapp.com",

    projectId: "fundsiq-staging",

    storageBucket: "fundsiq-staging.firebasestorage.app",

    messagingSenderId: "937858572135",

    appId: "1:937858572135:web:d8ad2b1487752c5344d9c2"

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