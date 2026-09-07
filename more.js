import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


// ==========================================
// FUNDSIQ API
// ==========================================

const API_URL =
    "https://fundsiq-api.onrender.com";


// ==========================================
// GET USER DATA
// ==========================================

async function getUserData() {

    const user = auth.currentUser;

    if (!user) return null;

    try {

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );

        const snap =
            await getDoc(userRef);

        if (!snap.exists()) {
            return null;
        }

        return snap.data();

    } catch (error) {

        console.error(
            "Error getting user data:",
            error
        );

        return null;
    }
}


// ==========================================
// CHECK PREMIUM STATUS
// ==========================================

async function isPremiumUser() {

    const userData =
        await getUserData();

    return userData?.premium === true;
}


// ==========================================
// UPDATE PREMIUM DISPLAY
// ==========================================

async function updatePremiumDisplay() {

    const status =
        document.getElementById(
            "premiumStatus"
        );

    if (!status) return;

    const premium =
        await isPremiumUser();

    if (premium) {

        status.innerText =
            "💎 Premium Active";

        status.classList.add(
            "premium-active"
        );

    } else {

        status.innerText =
            "Free Account";

        status.classList.remove(
            "premium-active"
        );
    }

    document.body.classList.toggle(
        "is-premium",
        premium
    );
}


// ==========================================
// GET COINS
// ==========================================

async function getCoins() {

    const userData =
        await getUserData();

    if (!userData) return 0;

    return userData.coins ?? 0;
}


// ==========================================
// UPDATE COIN DISPLAY
// ==========================================

async function updateCoinDisplay() {

    const coin =
        document.getElementById(
            "coinBalance"
        );

    if (!coin) return;

    const balance =
        await getCoins();

    coin.innerText =
        balance;
}


// ==========================================
// SPEND COINS
// ==========================================

async function spendCoins(
    amount,
    reason = "Purchase"
) {

    const user =
        auth.currentUser;

    if (!user) {

        alert(
            "Please login first."
        );

        return false;
    }

    const premium =
        await isPremiumUser();

    if (premium) {
        return true;
    }

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );

    const snap =
        await getDoc(userRef);

    if (!snap.exists()) {

        alert(
            "User profile not found."
        );

        return false;
    }

    const currentCoins =
        snap.data().coins ?? 0;

    if (currentCoins < amount) {

        alert(

`❌ Not enough coins 🪙

Need: ${amount} coins

Your balance:
${currentCoins} 🪙`

        );

        return false;
    }

    await updateDoc(
        userRef,
        {
            coins:
                increment(-amount)
        }
    );

    await updateCoinDisplay();

    return true;
}


// ==========================================
// ADD COINS
// ==========================================

async function rewardCoins(
    amount,
    reason = "Reward"
) {

    const user =
        auth.currentUser;

    if (!user) return false;

    try {

        const userRef =
            doc(
                db,
                "users",
                user.uid
            );

        await updateDoc(
            userRef,
            {
                coins:
                    increment(amount)
            }
        );

        await updateCoinDisplay();

        alert(
`🎉 +${amount} Coins

${reason}`
        );

        return true;

    } catch (error) {

        console.error(
            "Reward coins error:",
            error
        );

        return false;
    }
}


// ==========================================
// PREMIUM ACTIVE MODAL
// ==========================================

function openPremiumModal() {

    const modal =
        document.getElementById(
            "premiumModal"
        );

    if (!modal) {

        console.warn(
            "premiumModal was not found."
        );

        return;
    }

    modal.classList.add(
        "show"
    );

    modal.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "modal-open"
    );
}


function closePremiumModal() {

    const modal =
        document.getElementById(
            "premiumModal"
        );

    if (!modal) return;

    modal.classList.remove(
        "show"
    );

    modal.setAttribute(
        "aria-hidden",
        "true"
    );

    document.body.classList.remove(
        "modal-open"
    );
}


function setupPremiumModal() {

    const closeBtn =
        document.getElementById(
            "premiumModalClose"
        );

    const okBtn =
        document.getElementById(
            "premiumModalOk"
        );

    const overlay =
        document.getElementById(
            "premiumModalOverlay"
        );

    if (closeBtn) {

        closeBtn.addEventListener(
            "click",
            closePremiumModal
        );
    }

    if (okBtn) {

        okBtn.addEventListener(
            "click",
            closePremiumModal
        );
    }

    if (overlay) {

        overlay.addEventListener(
            "click",
            closePremiumModal
        );
    }

    document.addEventListener(
        "keydown",
        (event) => {

            if (event.key === "Escape") {

                closePremiumModal();
            }
        }
    );
}


// ==========================================
// PREMIUM PAYMENT
// ==========================================

async function startPremiumPayment() {

    console.log(
        "Premium button clicked"
    );

    // Check Firebase login
    const user =
        auth.currentUser;

    if (!user) {

        alert(
            "Please login first before upgrading to Premium."
        );

        return;
    }

    try {

        // Get fresh Firebase ID token
        const idToken =
            await user.getIdToken(true);

        console.log(
            "Calling FundsIQ Premium API..."
        );

        const response =
            await fetch(
                `${API_URL}/api/payments/premium/initialize`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json",

                        "Authorization":
                            `Bearer ${idToken}`
                    }
                }
            );

        const data =
            await response.json();

        console.log(
            "Premium API response:",
            data
        );

        if (!response.ok) {

            throw new Error(
                data.message ||
                data.error ||
                "Unable to initialize payment."
            );
        }

        if (!data.authorization_url) {

            throw new Error(
                "Paystack checkout URL was not returned."
            );
        }

        // Open Paystack checkout
        window.location.href =
            data.authorization_url;

    } catch (error) {

        console.error(
            "Premium payment error:",
            error
        );

        alert(
`❌ Premium payment could not start.

${error.message}`
        );
    }
}


// ==========================================
// CONNECT UPGRADE BUTTON
// ==========================================

function setupPremiumButton() {

    const upgradeBtn =
        document.getElementById(
            "upgradeBtn"
        );

    if (!upgradeBtn) {

        console.warn(
            "upgradeBtn was not found."
        );

        return;
    }

    upgradeBtn.addEventListener(
        "click",
        async () => {

            const premium =
                await isPremiumUser();

            if (premium) {

                // Custom FundsIQ modal
                openPremiumModal();

                return;
            }

            await startPremiumPayment();

        }
    );

    console.log(
        "Premium upgrade button connected."
    );
}


// ==========================================
// CBT PRACTICE
// ==========================================

async function startPractice() {

    const premium =
        await isPremiumUser();

    if (premium) {

        window.location.href =
            "exam.html";

        return;
    }

    const paid =
        await spendCoins(
            10,
            "GST CBT Practice"
        );

    if (paid) {

        window.location.href =
            "exam.html";
    }
}


// ==========================================
// LEADERBOARD
// ==========================================

async function unlockWithCoins() {

    const premium =
        await isPremiumUser();

    if (premium) {

        localStorage.setItem(
            "leaderboardAccess",
            "true"
        );

        alert(
            "💎 Premium Leaderboard Access Activated!"
        );

        location.reload();

        return;
    }

    const paid =
        await spendCoins(
            50,
            "Leaderboard Access"
        );

    if (paid) {

        localStorage.setItem(
            "leaderboardAccess",
            "true"
        );

        alert(
            "🏆 Leaderboard Activated!"
        );

        location.reload();
    }
}


// ==========================================
// PREMIUM UNLOCK
// ==========================================

async function premiumUnlock() {

    const premium =
        await isPremiumUser();

    if (premium) {

        // Use the same professional modal
        openPremiumModal();

        return;
    }

    await startPremiumPayment();
}


// ==========================================
// AUTH STATE
// ==========================================

onAuthStateChanged(
    auth,
    async (user) => {

        if (user) {

            await updateCoinDisplay();

            await updatePremiumDisplay();

        } else {

            const status =
                document.getElementById(
                    "premiumStatus"
                );

            if (status) {

                status.innerText =
                    "Free Account";
            }
        }
    }
);


// ==========================================
// PAGE LOAD
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        setupPremiumButton();

        setupPremiumModal();

    }
);


// ==========================================
// GLOBAL EXPORTS
// ==========================================

window.startPractice =
    startPractice;

window.rewardCoins =
    rewardCoins;

window.spendCoins =
    spendCoins;

window.updateCoinDisplay =
    updateCoinDisplay;

window.unlockWithCoins =
    unlockWithCoins;

window.premiumUnlock =
    premiumUnlock;

window.isPremiumUser =
    isPremiumUser;

window.updatePremiumDisplay =
    updatePremiumDisplay;

window.startPremiumPayment =
    startPremiumPayment;

window.openPremiumModal =
    openPremiumModal;

window.closePremiumModal =
    closePremiumModal;
