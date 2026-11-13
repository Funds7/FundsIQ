import { auth, db } from "./firebase.js";
import { showModal } from "./modals.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    increment,
    runTransaction
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


// ==========================================
// GET USER COINS
// ==========================================

async function getCoins() {

    const user = auth.currentUser;

    if (!user) return 0;

    try {

        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) return 0;

        const coins = Number(snap.data().coins ?? 0);

        return Number.isFinite(coins) ? coins : 0;

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

async function spendCoins(amount, reason = "Purchase") {

    const user = auth.currentUser;

    if (!user) {

        await showModal({
            type: "warning",
            title: "Login Required",
            message: "Please log in to use your coins."
        });

        return false;
    }

    amount = Number(amount);

    if (!Number.isFinite(amount) || amount <= 0) {

        await showModal({
            type: "error",
            title: "Invalid Amount",
            message: "The coin amount is not valid."
        });

        return false;
    }

    const userRef = doc(db, "users", user.uid);

    try {

        const result = await runTransaction(db, async (transaction) => {

            const snap = await transaction.get(userRef);

            if (!snap.exists()) {

                return {
                    success: false,
                    message: "Your user profile could not be found."
                };
            }

            const currentCoins = Number(snap.data().coins ?? 0);

            if (!Number.isFinite(currentCoins) || currentCoins < amount) {

                return {
                    success: false,
                    message: `You need ${amount} coins, but your current balance is ${currentCoins} coins.`
                };
            }

            transaction.update(userRef, {
                coins: increment(-amount)
            });

            return {
                success: true
            };

        });

        if (!result.success) {

            await showModal({
                type: "warning",
                title: "Insufficient Coins",
                message: result.message,
                details: "Earn more coins by watching rewarded ads or inviting friends."
            });

            return false;
        }

        updateCoinDisplay().catch(error => {
            console.error("Coin display refresh error:", error);
        });

        console.log(`${amount} coins spent: ${reason}`);

        return true;

    } catch (error) {

        console.error("Spend coins error:", error);

        await showModal({
            type: "error",
            title: "Payment Failed",
            message: "Unable to complete your coin payment.",
            details: "Please check your internet connection and try again."
        });

        return false;
    }
}


// ==========================================
// ADD COINS
// ==========================================

async function rewardCoins(amount, reason = "Reward") {

    const user = auth.currentUser;

    if (!user) return false;

    amount = Number(amount);

    if (!Number.isFinite(amount) || amount <= 0) {

        console.error("Invalid reward amount.");

        return false;
    }

    const userRef = doc(db, "users", user.uid);

    try {

        const snap = await getDoc(userRef);

        if (!snap.exists()) {

            await showModal({
                type: "error",
                title: "Profile Not Found",
                message: "Your FundsIQ profile could not be found."
            });

            return false;
        }

        await updateDoc(userRef, {
            coins: increment(amount)
        });

        updateCoinDisplay().catch(error => {
            console.error("Coin display refresh error:", error);
        });

        await showModal({
            type: "success",
            title: "Coins Received!",
            message: `You've received ${amount} coins.`,
            details: reason
        });

        return true;

    } catch (error) {

        console.error("Reward coins error:", error);

        await showModal({
            type: "error",
            title: "Reward Failed",
            message: "Unable to add coins to your account.",
            details: "Please check your internet connection and try again."
        });

        return false;
    }
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
// LEADERBOARD UNLOCK
// ==========================================

async function unlockWithCoins() {

    const paid = await spendCoins(50, "Leaderboard Access");

    if (paid) {

        localStorage.setItem("leaderboardAccess", "true");

        await showModal({
            type: "success",
            title: "Leaderboard Activated!",
            message: "You have successfully unlocked leaderboard access."
        });

        location.reload();
    }
}


// ==========================================
// PREMIUM UNLOCK
// ==========================================

async function premiumUnlock() {

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

window.unlockWithCoins = unlockWithCoins;

window.premiumUnlock = premiumUnlock;