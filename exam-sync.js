import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
    doc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Retry locally queued exam results whenever the signed-in student returns online.
async function syncPendingExamResults(user) {
    if (!user || !navigator.onLine) return;

    const key = "fundsiq_pending_exam_results_v1:" + user.uid;
    let pending;

    try {
        pending = JSON.parse(localStorage.getItem(key) || "[]");
    } catch (error) {
        console.warn("FundsIQ pending exam results could not be read:", error);
        return;
    }

    if (!Array.isArray(pending) || pending.length === 0) return;

    const remaining = [];
    for (const item of pending) {
        if (!item || item.uid !== user.uid || !item.sessionId || !item.result) continue;

        try {
            await setDoc(doc(db, "users", user.uid, "results", item.sessionId), {
                ...item.result,
                date: serverTimestamp()
            }, { merge: true });

            await setDoc(doc(db, "users", user.uid, "examHistory", item.sessionId), {
                ...item.result,
                completedAt: serverTimestamp()
            }, { merge: true });
        } catch (error) {
            console.warn("FundsIQ will retry this exam result later:", error);
            remaining.push(item);
        }
    }

    localStorage.setItem(key, JSON.stringify(remaining));
}

onAuthStateChanged(auth, user => {
    if (user) syncPendingExamResults(user);
});

window.addEventListener("online", () => {
    if (auth.currentUser) syncPendingExamResults(auth.currentUser);
});
