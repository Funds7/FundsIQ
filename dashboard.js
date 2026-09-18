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

/**
 * FundsIQ Dashboard
 * Developed by Odigwe Joshua
 */

// ==========================================
// GLOBAL NOTIFICATION STATE
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

    else if (hour >= 12 && hour < 17) {
        return "☀️ Good afternoon";
    }

    else if (hour >= 17 && hour < 21) {
        return "🌇 Good evening";
    }

    else {
        return "🌙 Good night";
    }

}


// ==========================================
// LOAD USER FROM FIREBASE
// ==========================================

function loadUser() {

    onAuthStateChanged(auth, async (user) => {

        if (!user) {
            window.location.href = "login.html";
            return;
        }

        try {

            const userRef = doc(db, "users", user.uid);

            const userSnap = await getDoc(userRef);

            if (userSnap.exists()) {

                const data = userSnap.data();

                // ==================================
                // GREETING
                // ==================================

                const greeting =
                    document.getElementById("dynamic-greeting");

                if (greeting) {

                    const safeName =
                        data.name || "Student";

                    greeting.innerHTML = `
                        ${getGreeting()},
                        <span style="color:#8b5cf6;">
                            ${safeName}
                        </span> 👋
                    `;

                }


                // ==================================
                // COINS
                // ==================================

                const coin =
                    document.getElementById("coinBalance");

                if (coin) {

                    coin.innerText =
                        data.coins ?? 20;

                }


                // ==================================
                // START NOTIFICATIONS
                // ==================================

                setupNotifications(user.uid);

            }

            else {

                console.warn("User profile not found.");

            }

        }

        catch (error) {

            console.error(
                "Error loading user:",
                error
            );

        }

    });

}


// ==========================================
// NOTIFICATION PANEL
// ==========================================

function createNotificationPanel() {

    if (document.getElementById("notifications-panel")) {
        return;
    }

    const panel =
        document.createElement("div");

    panel.id =
        "notifications-panel";

    panel.className =
        "notifications-panel";

    panel.innerHTML = `

        <div class="notifications-header">

            <strong>
                Notifications
            </strong>

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


    // Close button

    const closeBtn =
        document.getElementById(
            "notifications-close"
        );

    if (closeBtn) {

        closeBtn.addEventListener(
            "click",
            () => {

                panel.classList.remove(
                    "show"
                );

            }
        );

    }


    // Close when tapping outside

    document.addEventListener(
        "click",
        (event) => {

            const notificationBtn =
                document.getElementById(
                    "notification-btn"
                );

            if (
                panel.classList.contains("show") &&
                !panel.contains(event.target) &&
                !notificationBtn?.contains(event.target)
            ) {

                panel.classList.remove(
                    "show"
                );

            }

        }
    );

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

        const now =
            new Date();

        const difference =
            now - date;

        const seconds =
            Math.floor(
                difference / 1000
            );

        if (seconds < 60) {
            return "Just now";
        }

        const minutes =
            Math.floor(
                seconds / 60
            );

        if (minutes < 60) {
            return `${minutes}m ago`;
        }

        const hours =
            Math.floor(
                minutes / 60
            );

        if (hours < 24) {
            return `${hours}h ago`;
        }

        const days =
            Math.floor(
                hours / 24
            );

        if (days < 7) {
            return `${days}d ago`;
        }

        return date.toLocaleDateString();

    }

    catch (error) {

        return "";

    }

}


// ==========================================
// DISPLAY NOTIFICATIONS
// ==========================================

function displayNotifications(
    notifications
) {

    const list =
        document.getElementById(
            "notifications-list"
        );

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


    notifications.forEach(
        (notification) => {

            const item =
                document.createElement("div");

            item.className =
                "notification-item" +
                (
                    notification.read
                        ? ""
                        : " unread"
                );


            const title =
                notification.title ||
                "FundsIQ Notification";

            const message =
                notification.message ||
                "";


            item.innerHTML = `

                <div class="notification-title">
                    ${escapeHTML(title)}
                </div>

                <div class="notification-message">
                    ${escapeHTML(message)}
                </div>

                <div class="notification-time">
                    ${formatNotificationTime(
                        notification.createdAt
                    )}
                </div>

            `;


            // Mark notification as read

            item.addEventListener(
                "click",
                async () => {

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

                        }

                        catch (error) {

                            console.error(
                                "Could not mark notification as read:",
                                error
                            );

                        }

                    }


                    // Optional notification link

                    if (
                        notification.link &&
                        typeof notification.link === "string"
                    ) {

                        window.location.href =
                            notification.link;

                    }

                }
            );


            list.appendChild(item);

        }
    );

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
// SET NOTIFICATION BADGE
// ==========================================

function updateNotificationBadge(
    unreadCount
) {

    const badge =
        document.getElementById(
            "notif-badge"
        );

    if (!badge) {
        return;
    }


    if (unreadCount > 0) {

        badge.style.display =
            "flex";

        badge.textContent =
            unreadCount > 99
                ? "99+"
                : unreadCount;

    }

    else {

        badge.style.display =
            "none";

        badge.textContent =
            "0";

    }

}


// ==========================================
// REAL-TIME NOTIFICATIONS
// ==========================================

function setupNotifications(uid) {

    createNotificationPanel();


    const button =
        document.getElementById(
            "notification-btn"
        );

    const panel =
        document.getElementById(
            "notifications-panel"
        );


    if (!button || !panel) {
        return;
    }


    // Prevent duplicate listener

    if (!button.dataset.ready) {

        button.dataset.ready =
            "true";

        button.addEventListener(
            "click",
            (event) => {

                event.stopPropagation();

                panel.classList.toggle(
                    "show"
                );

            }
        );

    }


    // Remove previous Firestore listener

    if (notificationUnsubscribe) {

        notificationUnsubscribe();

        notificationUnsubscribe =
            null;

    }


    // ==================================
    // FIRESTORE NOTIFICATION QUERY
    // ==================================

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
            orderBy(
                "createdAt",
                "desc"
            ),
            limit(30)
        );


    notificationUnsubscribe =
        onSnapshot(
            notificationsQuery,

            (snapshot) => {

                const notifications = [];

                let unreadCount = 0;


                snapshot.forEach(
                    (notificationDoc) => {

                        const data =
                            notificationDoc.data();


                        const notification = {

                            id:
                                notificationDoc.id,

                            uid:
                                uid,

                            title:
                                data.title ||
                                "FundsIQ Notification",

                            message:
                                data.message ||
                                "",

                            read:
                                data.read === true,

                            createdAt:
                                data.createdAt ||
                                null,

                            link:
                                data.link ||
                                null

                        };


                        notifications.push(
                            notification
                        );


                        if (
                            !notification.read
                        ) {

                            unreadCount++;

                        }

                    }
                );


                updateNotificationBadge(
                    unreadCount
                );


                displayNotifications(
                    notifications
                );

            },

            (error) => {

                console.error(
                    "Notification listener error:",
                    error
                );

                updateNotificationBadge(
                    0
                );

            }
        );

}


// ==========================================
// SHARE APP
// ==========================================

function setupShare() {

    const shareBtn =
        document.getElementById(
            "share-app-btn"
        );

    if (!shareBtn) {
        return;
    }


    shareBtn.addEventListener(
        "click",
        async () => {

            if (navigator.share) {

                try {

                    await navigator.share({

                        title:
                            "FundsIQ CBT",

                        text:
                            "Study GST courses smarter with FundsIQ",

                        url:
                            window.location.origin

                    });

                }

                catch (error) {

                    console.log(error);

                }

            }

            else {

                alert(
                    "FundsIQ link: " +
                    window.location.origin
                );

            }

        }
    );

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


        if (
            !localStorage.getItem(
                "selectedCourse"
            )
        ) {

            localStorage.setItem(
                "selectedCourse",
                "gst101"
            );

        }

    }

    catch (error) {

        console.warn(error);

    }

}


// ==========================================
// START APP
// ==========================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        loadUser();

        setupShare();

        setupStorage();

    }
);
