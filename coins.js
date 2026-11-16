import { auth } from "./firebase.js";
import { getServerCoinBalance, spendCoinsOnServer } from "./coin-api.js";
import { showModal } from "./modals.js";
import { isPremiumUser } from "./premium-access.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";




// ==========================================
// GET USER COINS
// ==========================================

async function getCoins() {
    if (!auth.currentUser) return 0;
    try {
        return await getServerCoinBalance();
    } catch (error) {
        console.error("Get coins error:", error);
        return 0;
    }
}


// ==========================================
// UPDATE COIN DISPLAY
// ==========================================

async function updateCoinDisplay() {

    const coin = document.getElementById("coinBalance");

    if (!coin) return;

    try {

        const balance = await getCoins();

        coin.innerText = balance;

    } catch (error) {

        console.error("Coin display error:", error);
    }
}


// ==========================================
// SPEND COINS
// ==========================================

async function spendCoins(amount, reason = "Exam attempt") {
    const user = auth.currentUser;

    if (!user) {
        await showModal({
            type: "warning",
            title: "Login Required",
            message: "Please log in to use your coins."
        });
        return false;
    }

    // Online spending is always decided by the backend. The cached Premium
    // entitlement is used only for the previously verified offline Premium path.
    try {
        const result = await spendCoinsOnServer(amount, reason);
        updateCoinDisplay().catch(error => console.error("Coin display refresh error:", error));
        console.log(result.premium ? "Premium exam access granted." : "10 coins spent for an exam attempt.");
        return true;
    } catch (error) {
        let premiumOffline = false;
        if (!navigator.onLine) {
            try {
                premiumOffline = await isPremiumUser();
            } catch (_) {}
        }

        if (premiumOffline) {
            console.log("Previously verified Premium access granted offline.");
            return true;
        }

        await showModal({
            type: error.status === 402 ? "warning" : "error",
            title: error.status === 402 ? "Insufficient Coins" : "Coin Payment Failed",
            message: error.status === 402
                ? "You do not have enough coins for this exam attempt."
                : (error.message || "Unable to verify your coin balance."),
            details: error.status === 402
                ? `Required: ${error.required || 10} coins. Balance: ${error.balance ?? "Unavailable"} coins.`
                : "Please check your internet connection and try again."
        });
        return false;
    }
}


// ==========================================
// ADD COINS
// ==========================================

// Client-side reward amounts are no longer accepted. Welcome, referral and
// rewarded-ad credits must be issued by their verified server-side events.
async function rewardCoins() {
    await showModal({
        type: "info",
        title: "Rewards Temporarily Unavailable",
        message: "Coin rewards are being moved to verified server-side processing. Your balance cannot be changed from this screen."
    });
    return false;
}


// ==========================================
// CBT PRACTICE
// ==========================================

async function startPractice() {

    const paid = await spendCoins(10, "GST CBT Practice");

    if (paid) {

        window.location.href = "exam.html";
    }
}


// ==========================================
// LEADERBOARD ACCESS
// ==========================================

async function unlockWithCoins() {
    const premium = await isPremiumUser();

    if (premium) {
        localStorage.setItem("leaderboardAccess", "true");
        location.reload();
        return;
    }

    await showModal({
        type: "info",
        title: "Premium Required",
        message: "Free accounts can view the limited leaderboard. Premium members can view the complete leaderboard and their exact rank."
    });
}


// ==========================================
// PREMIUM UNLOCK
// ==========================================

async function premiumUnlock() {

    const premium = await isPremiumUser();

    if (premium) {

        await showModal({
            type: "success",
            title: "Premium Active",
            message: "Your Premium account is already active."
        });

        return;
    }

    await showModal({
        type: "info",
        title: "Premium Leaderboard",
        message: "Premium leaderboard access is coming soon."
    });
}


// ==========================================
// LOGIN CHECK
// ==========================================

onAuthStateChanged(auth, (user) => {

    if (user) {

        // Refresh the verified Premium cache as soon as a signed-in user opens the exam page.
        isPremiumUser().catch(error => {
            console.warn("Premium status refresh failed:", error);
        });

        updateCoinDisplay();
    }
});


// ==========================================
// GLOBAL EXPORTS
// ==========================================

window.getCoins = getCoins;

window.startPractice = startPractice;

window.rewardCoins = rewardCoins;

window.spendCoins = spendCoins;

window.updateCoinDisplay = updateCoinDisplay;
