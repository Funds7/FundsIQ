import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import {
    doc,
    writeBatch,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

// Prevent the login and "online" events from syncing the same queue twice.
let syncInProgress = false;

// Retry locally queued exam results whenever the signed-in student returns online.
async function syncPendingExamResults(user) {
    if (!user || !navigator.onLine || syncInProgress) return;

    syncInProgress = true;

    try {
        const key = "fundsiq_pending_exam_results_v1:" + user.uid;
        let pending;

        try {
            pending = JSON.parse(localStorage.getItem(key) || "[]");
        } catch (error) {
            console.warn("FundsIQ pending exam results could not be read:", error);
            return;
        }

        if (!Array.isArray(pending) || pending.length === 0) return;

        const validItems = pending.filter(item =>
            item &&
            item.uid === user.uid &&
            item.sessionId &&
            item.result
        );

        const remaining = [];
        // Two Firestore writes are made per exam result. Keep each batch below
        // Firestore's 500-write limit and commit once per group instead of
        // waiting for two separate network round trips for every result.
        const chunkSize = 200;

        for (let index = 0; index < validItems.length; index += chunkSize) {
            const chunk = validItems.slice(index, index + chunkSize);
            const batch = writeBatch(db);

            for (const item of chunk) {
                batch.set(
                    doc(db, "users", user.uid, "results", item.sessionId),
                    {
                        ...item.result,
                        date: serverTimestamp()
                    },
                    { merge: true }
                );

                batch.set(
                    doc(db, "users", user.uid, "examHistory", item.sessionId),
                    {
                        ...item.result,
                        completedAt: serverTimestamp()
                    },
                    { merge: true }
                );
            }

            try {
                await batch.commit();
            } catch (error) {
                console.warn("FundsIQ will retry this exam-result batch later:", error);
                remaining.push(...chunk);
            }
        }

        localStorage.setItem(key, JSON.stringify(remaining));
    } finally {
        syncInProgress = false;
    }
}

onAuthStateChanged(auth, user => {
    if (user) syncPendingExamResults(user);
});

window.addEventListener("online", () => {
    if (auth.currentUser) syncPendingExamResults(auth.currentUser);
});
