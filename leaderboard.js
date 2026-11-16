import { auth } from "./firebase.js";
import { showModal } from "./modals.js";
import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const API_URL = "https://fundsiq-api-staging.onrender.com";


// ========================================
// PREMIUM UPGRADE FROM LEADERBOARD
// ========================================

async function premiumUnlock() {
    const user = auth.currentUser;

    if (!user) {
        await showModal({
            type: "warning",
            title: "Login Required",
            message: "Please sign in before upgrading to Premium."
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
        if (!response.ok || !data.authorization_url) {
            throw new Error(data.msg || data.message || "Unable to start Premium payment.");
        }

        window.location.href = data.authorization_url;
    } catch (error) {
        console.error("Leaderboard Premium payment error:", error);
        await showModal({
            type: "error",
            title: "Payment Could Not Start",
            message: "We couldn't connect to the payment service.",
            details: error.message || "Please try again."
        });
    }
}

window.premiumUnlock = premiumUnlock;
const FREE_USER_LIMIT = 10;
let currentField = "totalScore";
let latestLeaderboard = null;


// ========================================
// LOAD LEADERBOARD SECURELY
// ========================================

async function loadLeaderboard() {
    const list = document.getElementById("leaderboard-list");
    if (list) {
        list.innerHTML = '<div class="leader-empty">Loading leaderboard...</div>';
    }

    try {
        const user = auth.currentUser;
        if (!user) {
            showSignedOutState();
            return;
        }

        const token = await user.getIdToken();
        const response = await fetch(
            `${API_URL}/api/leaderboard?field=${encodeURIComponent(currentField)}`,
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();
        if (!response.ok || data.success !== true) {
            throw new Error(data.msg || "Unable to load leaderboard.");
        }

        latestLeaderboard = data;
        showTopThree(data.topThree || []);
        showLeaderboard(data.rankings || [], data.premium === true);
        showPersonalRank(data.personalRank, data.premium === true);
    } catch (error) {
        console.error("Leaderboard error:", error);
        if (list) {
            list.innerHTML = `
                <div class="leader-empty">
                    Unable to load leaderboard.
                    <br>
                    Please try again.
                </div>
            `;
        }
    }
}


// ========================================
// TOP THREE
// ========================================

function showTopThree(topThree) {
    setPodium("first", topThree[0]);
    setPodium("second", topThree[1]);
    setPodium("third", topThree[2]);
}

function setPodium(position, entry) {
    const nameElement = document.getElementById(`${position}-name`);
    const scoreElement = document.getElementById(`${position}-score`);
    if (!nameElement || !scoreElement) return;

    if (!entry) {
        nameElement.innerText = "—";
        scoreElement.innerText = "0 Points";
        return;
    }

    if (entry.private === true) {
        nameElement.innerText = "Private";
        scoreElement.innerText = "Ranking hidden";
        return;
    }

    nameElement.innerText = entry.name || "Anonymous";
    scoreElement.innerText = `${Number(entry.score) || 0} Points`;
}


// ========================================
// PUBLIC RANKINGS
// ========================================

function showLeaderboard(rankings, isPremium) {
    const list = document.getElementById("leaderboard-list");
    if (!list) return;

    list.innerHTML = "";

    if (rankings.length === 0) {
        list.innerHTML = `
            <div class="leader-empty">
                No more rankings to display.
            </div>
        `;
    } else {
        rankings.forEach(user => {
            const card = document.createElement("div");
            card.className = "leader-card";

            const rank = document.createElement("div");
            rank.className = "rank-number";
            rank.textContent = String(user.rank);

            const info = document.createElement("div");
            info.className = "leader-info";

            const name = document.createElement("div");
            name.className = "leader-name";
            name.textContent = user.name || "Anonymous";

            const score = document.createElement("div");
            score.className = "leader-score";
            score.textContent = `${Number(user.score) || 0} Points`;

            info.append(name, score);
            card.append(rank, info);
            list.appendChild(card);
        });
    }

    if (!isPremium) {
        const premiumMessage = document.createElement("div");
        premiumMessage.className = "premium-hint";
        premiumMessage.innerHTML = `
            <strong>Premium required for your ranking</strong>
            <span>
                Upgrade to Premium to see your own position and access
                the complete leaderboard.
            </span>
        `;
        list.appendChild(premiumMessage);
    }
}


// ========================================
// PERSONAL RANKING
// ========================================

function showPersonalRank(personalRank, isPremium) {
    const box = document.querySelector(".activate-box");
    if (!box) return;

    if (!auth.currentUser) {
        box.innerHTML = `
            <div class="activate-content">
                <div class="activate-icon">🔒</div>
                <div>
                    <h2>Sign in required</h2>
                    <p>Sign in and purchase Premium to access your ranking.</p>
                </div>
            </div>
        `;
        return;
    }

    if (isPremium && personalRank) {
        box.classList.add("personal-ranking");
        box.innerHTML = `
            <div class="personal-header">
                <span class="personal-icon">✓</span>
                <div>
                    <h2>Your Ranking</h2>
                    <p>Premium leaderboard access</p>
                </div>
            </div>
            <div class="personal-rank">
                <span>Rank</span>
                <strong>${Number(personalRank.rank)}</strong>
            </div>
            <div class="personal-details">
                <strong>${escapeHTML(personalRank.name || "Anonymous")}</strong>
                <span>${Number(personalRank.score) || 0} Points</span>
            </div>
        `;
        return;
    }

    box.classList.remove("personal-ranking");
    box.innerHTML = `
        <div class="activate-content">
            <div class="activate-icon">🔒</div>
            <div>
                <h2>Premium Required</h2>
                <p>
                    Purchase Premium to see your exact ranking and access
                    the complete leaderboard.
                </p>
            </div>
        </div>
        <button class="premium-button" id="leaderboard-premium-button">
            💎 Get Premium
        </button>
    `;

    const premiumButton = document.getElementById("leaderboard-premium-button");
    if (premiumButton) {
        premiumButton.addEventListener("click", () => {
            if (typeof window.premiumUnlock === "function") {
                window.premiumUnlock();
            }
        });
    }
}


// ========================================
// COURSE SELECTOR
// ========================================

window.loadCourseLeaderboard = function(course, button) {
    document.querySelectorAll(".course-filter button").forEach(btn => {
        btn.classList.remove("active");
    });

    if (button) {
        button.classList.add("active");
        button.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center"
        });
    }

    currentField = course === "overall" ? "totalScore" : course + "Score";
    loadLeaderboard();
};


// ========================================
// HELPERS
// ========================================

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function showSignedOutState() {
    const list = document.getElementById("leaderboard-list");
    if (list) {
        list.innerHTML = '<div class="leader-empty">Please sign in to view the leaderboard.</div>';
    }
    showPersonalRank(null, false);
}


// ========================================
// START
// ========================================

window.addEventListener("DOMContentLoaded", () => {
    const firstButton = document.querySelector(".course-filter button");
    if (firstButton) firstButton.classList.add("active");

    onAuthStateChanged(auth, user => {
        if (user) loadLeaderboard();
        else showSignedOutState();
    });
});
