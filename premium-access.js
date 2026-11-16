import { auth } from "./firebase.js";

const API_URL = "https://fundsiq-api.onrender.com";
const STORAGE_KEY = "fundsiq_premium_entitlement_v1";

// This cache is written ONLY after the FundsIQ server confirms Premium.
// It is tied to the signed-in Firebase UID so accounts cannot share it.
function readVerifiedPremiumCache(uid) {
    try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        return cached?.uid === uid && cached?.premium === true;
    } catch (error) {
        console.warn("Premium cache could not be read:", error);
        return false;
    }
}

function saveVerifiedPremiumCache(uid) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            uid,
            premium: true,
            verifiedAt: Date.now()
        }));
    } catch (error) {
        console.warn("Premium cache could not be saved:", error);
    }
}

function clearVerifiedPremiumCache(uid) {
    try {
        const cached = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (!uid || cached?.uid === uid) {
            localStorage.removeItem(STORAGE_KEY);
        }
    } catch (error) {
        localStorage.removeItem(STORAGE_KEY);
    }
}

export async function isPremiumUser() {
    const user = auth.currentUser;
    if (!user) return false;

    const cachedPremium = readVerifiedPremiumCache(user.uid);

    try {
        const idToken = await user.getIdToken();

        const response = await fetch(`${API_URL}/api/premium/status`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${idToken}`,
                "Accept": "application/json"
            },
            cache: "no-store"
        });

        if (response.status === 404) {
            clearVerifiedPremiumCache(user.uid);
            return false;
        }

        if (!response.ok) {
            throw new Error(`Premium verification failed (HTTP ${response.status}).`);
        }

        const data = await response.json();
        const premium = data?.premium === true;

        if (premium) {
            saveVerifiedPremiumCache(user.uid);
        } else {
            // A successful online "not Premium" response overrides old cache.
            clearVerifiedPremiumCache(user.uid);
        }

        return premium;
    } catch (error) {
        console.warn("Online Premium verification unavailable:", error);

        // Offline fallback is allowed only after this UID was verified Premium online.
        return cachedPremium;
    }
}
