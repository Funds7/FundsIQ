import { auth, db } from "./firebase.js";

import {
    collection,
    query,
    orderBy,
    getDocs
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";


let allUsers = [];
let currentField = "totalScore";

const FREE_USER_LIMIT = 10;


// ========================================
// LOAD LEADERBOARD
// ========================================

async function loadLeaderboard() {

    try {

        const q = query(
            collection(db, "users"),
            orderBy(currentField, "desc")
        );

        const snap = await getDocs(q);

        allUsers = [];

        snap.forEach(doc => {

            allUsers.push({
                id: doc.id,
                ...doc.data()
            });

        });

        if (allUsers.length === 0) {
            showEmptyLeaderboard();
            return;
        }

        const user = auth.currentUser;

        const currentUser = user
            ? allUsers.find(u => u.id === user.uid)
            : null;

        const isPremium = isPremiumUser(currentUser);


        // Top 3
        showTopThree(currentUser);


        // Rankings
        showLeaderboard(currentUser, isPremium);


        // Personal ranking
        showPersonalRank(currentUser, isPremium);

    } catch (error) {

        console.error("Leaderboard error:", error);

        const list =
            document.getElementById("leaderboard-list");

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
// PREMIUM CHECK
// ========================================

function isPremiumUser(user) {

    if (!user) return false;

    return (
        user.premium === true ||
        user.premium === "true"
    );
}


// ========================================
// TOP THREE
// ========================================

function showTopThree(currentUser) {

    const first = allUsers[0];
    const second = allUsers[1];
    const third = allUsers[2];

    setPodium("first", first, currentUser);
    setPodium("second", second, currentUser);
    setPodium("third", third, currentUser);
}


function setPodium(position, user, currentUser) {

    const nameElement =
        document.getElementById(`${position}-name`);

    const scoreElement =
        document.getElementById(`${position}-score`);

    if (!nameElement || !scoreElement) return;


    if (!user) {

        nameElement.innerText = "—";
        scoreElement.innerText = "0 Points";

        return;
    }


    // Free users must not see themselves,
    // even if they are in the Top 3.
    if (
        currentUser &&
        user.id === currentUser.id &&
        !isPremiumUser(currentUser)
    ) {

        nameElement.innerText = "Private";
        scoreElement.innerText = "Ranking hidden";

        return;
    }


    nameElement.innerText =
        user.name || "Anonymous";

    scoreElement.innerText =
        `${user[currentField] || 0} Points`;
}


// ========================================
// PUBLIC RANKINGS
// ========================================

function showLeaderboard(currentUser, isPremium) {

    const list =
        document.getElementById("leaderboard-list");

    if (!list) return;

    list.innerHTML = "";


    let visibleUsers;


    if (isPremium) {

        // Premium users see the full leaderboard
        // after the Top 3.
        visibleUsers = allUsers.slice(3);

    } else {

        // Free users see only a limited number
        // and can never see themselves.
        visibleUsers = allUsers
            .slice(3)
            .filter(user => {

                return !currentUser ||
                    user.id !== currentUser.id;

            })
            .slice(0, FREE_USER_LIMIT);
    }


    if (visibleUsers.length === 0) {

        list.innerHTML = `
            <div class="leader-empty">
                No more rankings to display.
            </div>
        `;

    } else {

        visibleUsers.forEach(user => {

            const realRank =
                allUsers.findIndex(
                    u => u.id === user.id
                ) + 1;


            const card =
                document.createElement("div");

            card.className = "leader-card";


            card.innerHTML = `

                <div class="rank-number">
                    ${realRank}
                </div>

                <div class="leader-info">

                    <div class="leader-name">
                        ${escapeHTML(
                            user.name || "Anonymous"
                        )}
                    </div>

                    <div class="leader-score">
                        ${user[currentField] || 0} Points
                    </div>

                </div>

            `;


            list.appendChild(card);

        });
    }


    // Free user message
    if (!isPremium) {

        const premiumMessage =
            document.createElement("div");

        premiumMessage.className =
            "premium-hint";

        premiumMessage.innerHTML = `

            <strong>
                Premium required for your ranking
            </strong>

            <span>
                Upgrade to Premium to see your own
                position and access the full leaderboard.
            </span>

        `;

        list.appendChild(premiumMessage);
    }
}


// ========================================
// PERSONAL RANKING
// ========================================

function showPersonalRank(currentUser, isPremium) {

    const box =
        document.querySelector(".activate-box");

    if (!box) return;


    // Not logged in
    if (!currentUser) {

        box.innerHTML = `
            <div class="activate-content">

                <div class="activate-icon">
                    🔒
                </div>

                <div>
                    <h2>Premium Required</h2>

                    <p>
                        Sign in and purchase Premium
                        to access your ranking.
                    </p>
                </div>

            </div>
        `;

        return;
    }


    const index =
        allUsers.findIndex(
            u => u.id === currentUser.id
        );


    // ========================================
    // PREMIUM USER
    // ========================================

    if (isPremium && index !== -1) {

        box.classList.add("personal-ranking");

        box.innerHTML = `

            <div class="personal-header">

                <span class="personal-icon">
                    ✓
                </span>

                <div>

                    <h2>Your Ranking</h2>

                    <p>
                        Premium leaderboard access
                    </p>

                </div>

            </div>


            <div class="personal-rank">

                <span>
                    Rank
                </span>

                <strong>
                    ${index + 1}
                </strong>

            </div>


            <div class="personal-details">

                <strong>
                    ${escapeHTML(
                        currentUser.name || "Anonymous"
                    )}
                </strong>

                <span>
                    ${currentUser[currentField] || 0} Points
                </span>

            </div>

        `;

        return;
    }


    // ========================================
    // FREE USER
    // ========================================

    box.classList.remove("personal-ranking");

    box.innerHTML = `

        <div class="activate-content">

            <div class="activate-icon">
                🔒
            </div>

            <div>

                <h2>
                    Premium Required
                </h2>

                <p>
                    Purchase Premium to see your
                    exact ranking and access the
                    full leaderboard.
                </p>

            </div>

        </div>


        <button
            class="premium-button"
            onclick="premiumUnlock()"
        >
            💎 Get Premium
        </button>

    `;
}


// ========================================
// COURSE SELECTOR
// ========================================

window.loadCourseLeaderboard =
function(course, button) {

    document
        .querySelectorAll(
            ".course-filter button"
        )
        .forEach(btn => {

            btn.classList.remove("active");

        });


    if (button) {

        button.classList.add("active");


        // Automatically shift the selected
        // course into the visible center.
        button.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "center"
        });
    }


    if (course === "overall") {

        currentField = "totalScore";

    } else {

        currentField = course + "Score";
    }


    loadLeaderboard();
};


// ========================================
// HTML ESCAPE
// ========================================

function escapeHTML(value) {

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ========================================
// EMPTY LEADERBOARD
// ========================================

function showEmptyLeaderboard() {

    const list =
        document.getElementById(
            "leaderboard-list"
        );

    if (list) {

        list.innerHTML = `
            <div class="leader-empty">
                No leaderboard results yet.
            </div>
        `;
    }
}


// ========================================
// START
// ========================================

window.addEventListener(
    "DOMContentLoaded",
    () => {

        onAuthStateChanged(
            auth,
            (user) => {

                const firstButton =
                    document.querySelector(
                        ".course-filter button"
                    );

                if (firstButton) {

                    firstButton.classList.add(
                        "active"
                    );
                }


                if (user) {

                    loadLeaderboard();

                }

            }
        );

    }
);
