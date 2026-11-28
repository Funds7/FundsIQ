// ==========================================
// FUNDSIQ FIREBASE CONFIGURATION
// ==========================================

import {
    initializeApp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";


import {
    initializeAuth,
    browserLocalPersistence,
    onAuthStateChanged
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
// AUTHENTICATED ACTIVITY TRACKING
// ==========================================

// One heartbeat per signed-in session, then every five minutes while active.
let activityTimer = null;

onAuthStateChanged(auth, (user) => {
    if (activityTimer) {
        clearInterval(activityTimer);
        activityTimer = null;
    }

    if (!user) return;

    // A sessionStorage ID distinguishes separate visits while remaining stable
    // for this browser tab. Older visits cannot be reconstructed retroactively.
    let sessionId = sessionStorage.getItem("fundsiq_visit_session");
    if (!sessionId) {
        sessionId = (crypto.randomUUID ? crypto.randomUUID() : (
            Date.now().toString(16) + "-" + Math.random().toString(16).slice(2) + "-" + Math.random().toString(16).slice(2)
        ));
        sessionStorage.setItem("fundsiq_visit_session", sessionId);
    }

    const recordActivity = async () => {
        if (document.visibilityState !== "visible") return;

        try {
            const token = await user.getIdToken();
            await fetch("https://fundsiq-api.onrender.com/api/activity/heartbeat", {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + token,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ sessionId })
            });
        } catch (error) {
            console.warn("FundsIQ activity tracking unavailable:", error);
        }
    };

    recordActivity();
    activityTimer = setInterval(recordActivity, 5 * 60 * 1000);
    document.addEventListener("visibilitychange", recordActivity);
    window.addEventListener("focus", recordActivity);
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