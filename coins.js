import { auth, db } from "./firebase.js";

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

        alert("Please login first.");

        return false;
    }

    amount = Number(amount);

    if (!Number.isFinite(amount) || amount <= 0) {

        alert("Invalid coin amount.");

        return false;
    }

    const userRef = doc(db, "users", user.uid);

    try {

        const result = await runTransaction(db, async (transaction) => {

            const snap = await transaction.get(userRef);

            if (!snap.exists()) {

                return {
                    success: false,
                    message: "User profile not found."
                };
            }

            const currentCoins = Number(snap.data().coins ?? 0);

            if (!Number.isFinite(currentCoins) || currentCoins < amount) {

                return {
                    success: false,
                    message: `❌ Not enough coins 🪙

Need: ${amount} coins

Your balance:
${currentCoins} 🪙`
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

            alert(result.message);

            return false;
        }

        // Refresh display without undoing a successful payment
        updateCoinDisplay().catch(error => {
            console.error("Coin display refresh error:", error);
        });

        console.log(`${amount} coins spent: ${reason}`);

        return true;

    } catch (error) {

        console.error("Spend coins error:", error);

        alert(
            "Unable to complete coin payment.\n\n" +
            "Please check your internet connection and try again."
        );

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

            alert("User profile not found.");

            return false;
        }

        await updateDoc(userRef, {
            coins: increment(amount)
        });

        updateCoinDisplay().catch(error => {
            console.error("Coin display refresh error:", error);
        });

        alert(`🎉 +${amount} Coins

${reason}`);

        return true;

    } catch (error) {

        console.error("Reward coins error:", error);

        alert(
            "Unable to add coins.\n\n" +
            "Please check your internet connection and try again."
        );

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

        alert("🏆 Leaderboard Activated!");

        location.reload();
    }
}


// ==========================================
// PREMIUM UNLOCK
// ==========================================

function premiumUnlock() {

    alert("💎 Premium Leaderboard coming soon");
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