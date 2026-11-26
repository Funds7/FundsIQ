import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    doc,
    getDoc,
    collection,
    query,
    orderBy,
    limit,
    onSnapshot,
    updateDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

console.log("Dashboard.js connected");


// ==========================================
// GLOBAL STATE
// ==========================================

let notificationUnsubscribe = null;


// ==========================================
// TIME GREETING
// ==========================================

function getGreeting() {

    const hour = new Date().getHours();

    if (hour >= 5 && hour < 12) {
        return "🌅 Good morning";
    }

    if (hour >= 12 && hour < 17) {
        return "☀️ Good afternoon";
    }

    if (hour >= 17 && hour < 21) {
        return "🌇 Good evening";
    }

    return "🌙 Good night";
}


// ==========================================
// DISPLAY USER PROFILE
// ==========================================

function displayUserProfile(data, uid) {

    const greeting =
        document.getElementById("dynamic-greeting");

    const coin =
        document.getElementById("coinBalance");

    const safeName = data.name || "Student";

    if (greeting) {

        greeting.textContent =
            `${getGreeting()}, ${safeName} 👋`;

    }

    if (coin) {

        coin.textContent =
            data.coins ?? 20;

    }

    // Save the latest available profile locally

    try {

        localStorage.setItem(
            `fundsiq_profile_${uid}`,
            JSON.stringify({
                name: safeName,
                coins: data.coins ?? 20
            })
        );

    } catch (error) {

        console.warn(
            "Could not save profile locally:",
            error
        );

    }

}


// ==========================================
// LOAD USER
// ==========================================

function loadUser() {

    onAuthStateChanged(auth, async (user) => {

        if (!user) {

            if (notificationUnsubscribe) {
                notificationUnsubscribe();
                notificationUnsubscribe = null;
            }

            window.location.replace("login.html");
            return;

        }

        const uid = user.uid;

        // Load locally saved profile immediately

        try {

            const savedProfile =
                localStorage.getItem(
                    `fundsiq_profile_${uid}`
                );

            if (savedProfile) {

                displayUserProfile(
                    JSON.parse(savedProfile),
                    uid
                );

            }

        } catch (error) {

            console.warn(
                "Local profile unavailable:",
                error
            );

        }


        // Retrieve the latest available Firestore profile

        try {

            const userRef =
                doc(db, "users", uid);

            const userSnap =
                await getDoc(userRef);

            if (userSnap.exists()) {

                displayUserProfile(
                    userSnap.data(),
                    uid
                );

            } else {

                console.warn(
                    "User profile not found."
                );

            }

        } catch (error) {

            console.warn(
                "Using available offline profile:",
                error
            );

        }


        // Start notifications independently

        setupNotifications(uid);

    });

}


// ==========================================
// NOTIFICATION PANEL
// ==========================================

function createNotificationPanel() {

    if (
        document.getElementById("notifications-panel")
    ) {
        return;
    }

    const panel =
        document.createElement("div");

    panel.id = "notifications-panel";

    panel.className = "notifications-panel";

    panel.innerHTML = `

        <div class="notifications-header">

            <strong>Notifications</strong>

            <button
                type="button"
                class="notifications-close"
                id="notifications-close">

                ×

            </button>

        </div>

        <div
            class="notifications-list"
            id="notifications-list">

            <div class="notification-empty">
                No notifications yet.
            </div>

        </div>

    `;

    document.body.appendChild(panel);


    const closeBtn =
        document.getElementById("notifications-close");

    if (closeBtn) {

        closeBtn.addEventListener("click", () => {

            panel.classList.remove("show");

        });

    }


    document.addEventListener("click", (event) => {

        const notificationBtn =
            document.getElementById("notification-btn");

        if (
            panel.classList.contains("show") &&
            !panel.contains(event.target) &&
            !notificationBtn?.contains(event.target)
        ) {

            panel.classList.remove("show");

        }

    });

}


// ==========================================
// FORMAT NOTIFICATION TIME
// ==========================================

function formatNotificationTime(timestamp) {

    if (!timestamp) {
        return "";
    }

    try {

        const date =
            timestamp.toDate
                ? timestamp.toDate()
                : new Date(timestamp);

        const difference =
            new Date() - date;

        const seconds =
            Math.floor(difference / 1000);

        if (seconds < 60) {
            return "Just now";
        }

        const minutes =
            Math.floor(seconds / 60);

        if (minutes < 60) {
            return `${minutes}m ago`;
        }

        const hours =
            Math.floor(minutes / 60);

        if (hours < 24) {
            return `${hours}h ago`;
        }

        const days =
            Math.floor(hours / 24);

        if (days < 7) {
            return `${days}d ago`;
        }

        return date.toLocaleDateString();

    } catch (error) {

        return "";

    }

}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapeHTML(value) {

    const div =
        document.createElement("div");

    div.textContent =
        String(value ?? "");

    return div.innerHTML;

}


// ==========================================
// DISPLAY NOTIFICATIONS
// ==========================================

function displayNotifications(notifications) {

    const list =
        document.getElementById("notifications-list");

    if (!list) {
        return;
    }

    if (!notifications.length) {

        list.innerHTML = `
            <div class="notification-empty">
                🔔<br>
                No notifications yet.
            </div>
        `;

        return;

    }

    list.innerHTML = "";

    notifications.forEach((notification) => {

        const item =
            document.createElement("div");

        item.className =
            "notification-item" +
            (notification.read ? "" : " unread");

        item.innerHTML = `

            <div class="notification-title">
                ${escapeHTML(notification.title)}
            </div>

            <div class="notification-message">
                ${escapeHTML(notification.message)}
            </div>

            <div class="notification-time">
                ${formatNotificationTime(
                    notification.createdAt
                )}
            </div>

        `;


        item.addEventListener("click", async () => {

            if (!notification.read) {

                try {

                    await updateDoc(
                        doc(
                            db,
                            "users",
                            notification.uid,
                            "notifications",
                            notification.id
                        ),
                        {
                            read: true
                        }
                    );

                } catch (error) {

                    console.error(
                        "Could not mark notification as read:",
                        error
                    );

                }

            }

            if (
                notification.link &&
                typeof notification.link === "string"
            ) {

                window.location.href =
                    notification.link;

            }

        });

        list.appendChild(item);

    });

}


// ==========================================
// NOTIFICATION BADGE
// ==========================================

function updateNotificationBadge(unreadCount) {

    const badge =
        document.getElementById("notif-badge");

    if (!badge) {
        return;
    }

    if (unreadCount > 0) {

        badge.style.display = "flex";

        badge.textContent =
            unreadCount > 99
                ? "99+"
                : unreadCount;

    } else {

        badge.style.display = "none";

        badge.textContent = "0";

    }

}


// ==========================================
// REAL-TIME NOTIFICATIONS
// ==========================================

function setupNotifications(uid) {

    createNotificationPanel();

    const button =
        document.getElementById("notification-btn");

    const panel =
        document.getElementById("notifications-panel");

    if (!button || !panel) {
        return;
    }


    if (!button.dataset.ready) {

        button.dataset.ready = "true";

        button.addEventListener("click", (event) => {

            event.stopPropagation();

            panel.classList.toggle("show");

        });

    }


    if (notificationUnsubscribe) {

        notificationUnsubscribe();

        notificationUnsubscribe = null;

    }


    const notificationsRef =
        collection(
            db,
            "users",
            uid,
            "notifications"
        );

    const notificationsQuery =
        query(
            notificationsRef,
            orderBy("createdAt", "desc"),
            limit(30)
        );


    notificationUnsubscribe =
        onSnapshot(
            notificationsQuery,

            (snapshot) => {

                const notifications = [];

                let unreadCount = 0;

                snapshot.forEach((notificationDoc) => {

                    const data =
                        notificationDoc.data();

                    const notification = {

                        id: notificationDoc.id,

                        uid: uid,

                        title:
                            data.title ||
                            "FundsIQ Notification",

                        message:
                            data.message || "",

                        read:
                            data.read === true,

                        createdAt:
                            data.createdAt || null,

                        link:
                            data.link || null

                    };

                    notifications.push(notification);

                    if (!notification.read) {
                        unreadCount++;
                    }

                });

                updateNotificationBadge(unreadCount);

                displayNotifications(notifications);

            },

            (error) => {

                console.error(
                    "Notification listener error:",
                    error
                );

                // Don't erase previously displayed cached data.

            }
        );

}


// ==========================================
// SHARE APP
// ==========================================

function setupShare() {

    const shareBtn =
        document.getElementById("share-app-btn");

    if (!shareBtn) {
        return;
    }

    shareBtn.addEventListener("click", async () => {

        if (navigator.share) {

            try {

                await navigator.share({

                    title: "FundsIQ CBT",

                    text:
                        "Study GST courses smarter with FundsIQ",

                    url: window.location.origin

                });

            } catch (error) {

                console.log(error);

            }

        } else {

            alert(
                "FundsIQ link: " +
                window.location.origin
            );

        }

    });

}


// ==========================================
// LOCAL STORAGE
// ==========================================

function setupStorage() {

    try {

        if (!localStorage.getItem("course")) {

            localStorage.setItem(
                "course",
                "gst101"
            );

        }

        if (!localStorage.getItem("selectedCourse")) {

            localStorage.setItem(
                "selectedCourse",
                "gst101"
            );

        }

    } catch (error) {

        console.warn(error);

    }

}


// ==========================================
// START DASHBOARD
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    loadUser();

    setupShare();

    setupStorage();

});