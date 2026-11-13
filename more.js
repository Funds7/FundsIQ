import { auth, db } from "./firebase.js";
import { showModal } from "./modals.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    doc,
    getDoc,
    updateDoc,
    increment
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


/* =========================================================================
FUNDSIQ API
========================================================================= */

const API_URL = "https://fundsiq-api.onrender.com";


/* =========================================================================
GET USER DATA
========================================================================= */

async function getUserData() {
    const user = auth.currentUser;

    if (!user) return null;

    try {
        const userRef = doc(db, "users", user.uid);
        const snap = await getDoc(userRef);

        if (!snap.exists()) return null;

        return snap.data();

    } catch (error) {
        console.error("Error getting user data:", error);
        return null;
    }
}


/* =========================================================================
CHECK PREMIUM STATUS
========================================================================= */

async function isPremiumUser() {
    const userData = await getUserData();
    return userData?.premium === true;
}


/* =========================================================================
UPDATE PREMIUM DISPLAY
========================================================================= */

async function updatePremiumDisplay() {
    const status = document.getElementById("premiumStatus");
    const upgradeBtn = document.getElementById("upgradeBtn");

    if (!status) return;

    const premium = await isPremiumUser();

    if (premium) {
        status.innerText = "💎 Premium Active";
        status.classList.add("premium-active");

        if (upgradeBtn) {
            upgradeBtn.innerHTML = "💎 Premium Active";
        }

    } else {
        status.innerText = "Free Account";
        status.classList.remove("premium-active");

        if (upgradeBtn) {
            upgradeBtn.innerHTML = "👑 Upgrade Now";
        }
    }

    document.body.classList.toggle("is-premium", premium);
}


/* =========================================================================
GET COINS
========================================================================= */

async function getCoins() {
    const userData = await getUserData();

    if (!userData) return 0;

    return userData.coins ?? 0;
}


/* =========================================================================
UPDATE COIN DISPLAY
========================================================================= */

async function updateCoinDisplay() {
    const coin = document.getElementById("coinBalance");

    if (!coin) return;

    const balance = await getCoins();
    coin.innerText = balance;
}


/* =========================================================================
SPEND COINS
========================================================================= */

async function spendCoins(amount, reason = "Purchase") {
    const user = auth.currentUser;

    if (!user) {

        await showModal({
            type: "warning",
            title: "Login Required",
            message: "Please login to continue."
        });

        return false;
    }

    const premium = await isPremiumUser();

    if (premium) return true;

    const userRef = doc(db, "users", user.uid);
    const snap = await getDoc(userRef);

    if (!snap.exists()) {

        await showModal({
            type: "error",
            title: "Profile Not Found",
            message: "We couldn't find your FundsIQ account profile."
        });

        return false;
    }

    const currentCoins = snap.data().coins ?? 0;

    if (currentCoins < amount) {

        await showModal({
            type: "warning",
            title: "Insufficient Coins",
            message: "You don't have enough coins to complete this action.",
            details: `Required: ${amount} coins\nYour balance: ${currentCoins} coins`,
            buttonText: "Okay"
        });

        return false;
    }

    await updateDoc(userRef, {
        coins: increment(-amount)
    });

    await updateCoinDisplay();

    return true;
}


/* =========================================================================
REWARD COINS
========================================================================= */

async function rewardCoins(amount, reason = "Reward") {
    const user = auth.currentUser;

    if (!user) {

        await showModal({
            type: "warning",
            title: "Login Required",
            message: "Please login to receive your reward."
        });

        return false;
    }

    try {
        const userRef = doc(db, "users", user.uid);

        await updateDoc(userRef, {
            coins: increment(amount)
        });

        await updateCoinDisplay();

        await showModal({
            type: "success",
            title: "Coins Received!",
            message: `Congratulations! You received ${amount} coins.`,
            details: reason,
            buttonText: "Awesome!"
        });

        return true;

    } catch (error) {
        console.error("Reward coins error:", error);

        await showModal({
            type: "error",
            title: "Reward Failed",
            message: "We couldn't add your coins. Please try again."
        });

        return false;
    }
}


/* =========================================================================
PREMIUM MODAL
========================================================================= */

function openPremiumModal() {
    const modal = document.getElementById("premiumModal");

    if (!modal) {
        console.warn("premiumModal was not found.");
        return;
    }

    modal.classList.add("show");
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}


function closePremiumModal() {
    const modal = document.getElementById("premiumModal");

    if (!modal) return;

    modal.classList.remove("show");
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}


/* =========================================================================
PREMIUM MODAL EVENTS
========================================================================= */

function setupPremiumModal() {
    const closeBtn = document.getElementById("premiumModalClose");
    const okBtn = document.getElementById("premiumModalOk");
    const overlay = document.getElementById("premiumModalOverlay");

    if (closeBtn) {
        closeBtn.addEventListener("click", closePremiumModal);
    }

    if (okBtn) {
        okBtn.addEventListener("click", closePremiumModal);
    }

    if (overlay) {
        overlay.addEventListener("click", closePremiumModal);
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closePremiumModal();
        }
    });
}


/* =========================================================================
PREMIUM PAYMENT
========================================================================= */

async function startPremiumPayment() {
    console.log("Premium button clicked");

    const user = auth.currentUser;

    if (!user) {

        await showModal({
            type: "warning",
            title: "Login Required",
            message: "Please login before upgrading to Premium."
        });

        return;
    }

    try {
        const idToken = await user.getIdToken(true);

        const response = await fetch(
            `${API_URL}/api/payments/premium/initialize`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${idToken}`
                }
            }
        );

        const data = await response.json();

        console.log("Premium API response:", data);

        if (!response.ok) {
            throw new Error(
                data.message ||
                data.error ||
                "Unable to initialize payment."
            );
        }

        if (!data.authorization_url) {
            throw new Error("Paystack checkout URL was not returned.");
        }

        window.location.href = data.authorization_url;

    } catch (error) {
        console.error("Premium payment error:", error);

        await showModal({
            type: "error",
            title: "Payment Could Not Start",
            message: "We couldn't connect to the payment service.",
            details: error.message,
            buttonText: "Okay"
        });
    }
}


/* =========================================================================
PREMIUM BUTTON
========================================================================= */

function setupPremiumButton() {
    const upgradeBtn = document.getElementById("upgradeBtn");

    if (!upgradeBtn) {
        console.warn("upgradeBtn was not found.");
        return;
    }

    upgradeBtn.addEventListener("click", async () => {
        upgradeBtn.disabled = true;

        try {
            const premium = await isPremiumUser();

            if (premium) {
                openPremiumModal();
            } else {
                await startPremiumPayment();
            }

        } finally {
            upgradeBtn.disabled = false;
        }
    });
}


/* =========================================================================
CBT PRACTICE
========================================================================= */

async function startPractice() {
    const premium = await isPremiumUser();

    if (premium) {
        window.location.href = "exam.html";
        return;
    }

    const paid = await spendCoins(10, "GST CBT Practice");

    if (paid) {
        window.location.href = "exam.html";
    }
}


/* =========================================================================
LEADERBOARD
========================================================================= */

async function unlockWithCoins() {
    const premium = await isPremiumUser();

    if (premium) {
        localStorage.setItem("leaderboardAccess", "true");

        await showModal({
            type: "success",
            title: "Premium Access Activated!",
            message: "Your Premium account gives you leaderboard access."
        });

        location.reload();
        return;
    }

    const paid = await spendCoins(50, "Leaderboard Access");

    if (paid) {
        localStorage.setItem("leaderboardAccess", "true");

        await showModal({
            type: "success",
            title: "Leaderboard Unlocked!",
            message: "You can now access the leaderboard."
        });

        location.reload();
    }
}


/* =========================================================================
PREMIUM UNLOCK
========================================================================= */

async function premiumUnlock() {
    const premium = await isPremiumUser();

    if (premium) {
        openPremiumModal();
        return;
    }

    await startPremiumPayment();
}


/* =========================================================================
MORE PAGE CARDS
========================================================================= */

function setupMorePageCards() {

    const topReferralsBtn = document.getElementById("top-referrals-btn");

    if (topReferralsBtn) {
        topReferralsBtn.addEventListener("click", () => {
            window.location.href = "top-referrals.html";
        });
    }


    const myReferralsBtn = document.getElementById("my-referrals-btn");

    if (myReferralsBtn) {
        myReferralsBtn.addEventListener("click", () => {
            window.location.href = "marketer-dashboard.html";
        });
    }


    const bookmarksBtn = document.getElementById("bookmarks-btn");

    if (bookmarksBtn) {
        bookmarksBtn.addEventListener("click", () => {
            window.location.href = "bookmarks.html";
        });
    }


    const shareBtn = document.getElementById("share-app-btn");

    if (shareBtn) {
        shareBtn.addEventListener("click", async () => {

            const shareData = {
                title: "FundsIQ",
                text: "Study smart and score higher with FundsIQ!",
                url: "https://fundsiq.com.ng"
            };

            try {

                if (navigator.share) {

                    await navigator.share(shareData);

                } else if (navigator.clipboard) {

                    await navigator.clipboard.writeText(shareData.url);

                    await showModal({
                        type: "success",
                        title: "Link Copied!",
                        message: "Your FundsIQ sharing link has been copied."
                    });

                } else {

                    await showModal({
                        type: "info",
                        title: "Share FundsIQ",
                        message: "Copy this link and share it with your friends.",
                        details: shareData.url
                    });
                }

            } catch (error) {

                if (error.name !== "AbortError") {

                    console.error("Share error:", error);

                    await showModal({
                        type: "info",
                        title: "Share FundsIQ",
                        message: "You can copy and share this link:",
                        details: shareData.url
                    });
                }
            }
        });
    }
}


/* =========================================================================
AUTH STATE
========================================================================= */

onAuthStateChanged(auth, async (user) => {
    const status = document.getElementById("premiumStatus");

    if (!user) {

        if (status) {
            status.innerText = "Free Account";
        }

        document.body.classList.remove("is-premium");
        return;
    }

    if (status) {
        status.innerText = "Loading your account...";
    }

    await updateCoinDisplay();
    await updatePremiumDisplay();
});


/* =========================================================================
PAGE LOAD
========================================================================= */

document.addEventListener("DOMContentLoaded", () => {
    setupPremiumButton();
    setupPremiumModal();
    setupMorePageCards();
});


/* =========================================================================
GLOBAL EXPORTS
========================================================================= */

window.startPractice = startPractice;
window.rewardCoins = rewardCoins;
window.spendCoins = spendCoins;
window.updateCoinDisplay = updateCoinDisplay;
window.unlockWithCoins = unlockWithCoins;
window.premiumUnlock = premiumUnlock;
window.isPremiumUser = isPremiumUser;
window.updatePremiumDisplay = updatePremiumDisplay;
window.startPremiumPayment = startPremiumPayment;
window.openPremiumModal = openPremiumModal;
window.closePremiumModal = closePremiumModal;