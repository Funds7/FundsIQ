/**
 * FundsIQ Affiliate & Marketer Dashboard Engine
 * Integrates directly with Cloud Firestore (Modular SDK v12)
 * Developed by Odigwe Joshua
 */

// ============================================================================
// 1. FIREBASE IMPORTS
// ============================================================================

import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    doc,
    updateDoc,
    collection,
    addDoc,
    query,
    orderBy,
    onSnapshot,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

"use strict";


// ============================================================================
// 2. RUNTIME STATE
// ============================================================================

const State = {

    user: null,

    activeTab: "overview",

    marketerData: {
        balance: 0,
        totalEarnings: 0,
        totalReferrals: 0,
        premiumReferrals: 0,

        referralCode: "",
        referralLink: "",

        bankName: "",
        accountNumber: "",
        accountName: "",

        status: "Inactive"
    },

    activityLogs: [],

    unsubscribes: []
};


// ============================================================================
// 3. TOAST NOTIFIER
// ============================================================================

function showToast(message, type = "success") {

    const container =
        document.getElementById("toast-container");

    if (!container) return;

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    toast.innerHTML = `
        <span class="toast-indicator"></span>
        <span>${escapeHTML(message)}</span>
    `;

    container.appendChild(toast);

    setTimeout(() => {

        toast.style.animation =
            "toast-slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) reverse";

        setTimeout(() => {
            toast.remove();
        }, 300);

    }, 3000);
}


// ============================================================================
// 4. HTML ESCAPE
// ============================================================================

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================================
// 5. FIRESTORE MARKETER DATA SUBSCRIPTION
// ============================================================================

function subscribeToMarketerData(user) {

    // ------------------------------------------------------------------------
    // CLEAN OLD LISTENERS
    // ------------------------------------------------------------------------

    State.unsubscribes.forEach(unsub => {

        try {
            unsub();
        } catch (error) {
            console.error(
                "Listener cleanup error:",
                error
            );
        }

    });

    State.unsubscribes = [];


    const userRef =
        doc(db, "users", user.uid);


    toggleSkeleton(true);


    // ========================================================================
    // USER PROFILE SNAPSHOT
    // ========================================================================

    const unsubUser = onSnapshot(

        userRef,

        (docSnap) => {

            if (docSnap.exists()) {

                const data =
                    docSnap.data();


                // ============================================================
                // CURRENT REFERRAL CODE
                // ============================================================

                const referralCode =
                    data.referralCode || "";


                // ============================================================
                // ALWAYS USE CURRENT FUNDSIQ SIGNUP URL
                // ============================================================

                const referralLink =
                    referralCode

                        ? `https://funds7.github.io/FundsIQ/signup.html?ref=${encodeURIComponent(referralCode)}`

                        : "";


                // ============================================================
                // AUTOMATICALLY REPAIR OLD REFERRAL LINKS
                // ============================================================

                if (
                    referralCode &&
                    data.referralLink !== referralLink
                ) {

                    updateDoc(userRef, {

                        referralLink:
                            referralLink

                    }).catch(error => {

                        console.error(
                            "Could not update referral link:",
                            error
                        );

                    });
                }


                // ============================================================
                // LOAD REAL FIRESTORE VALUES
                // ============================================================

                State.marketerData = {

                    balance:
                        Number(
                            data.marketerBalance || 0
                        ),

                    totalEarnings:
                        Number(
                            data.totalEarnings || 0
                        ),

                    totalReferrals:
                        Number(
                            data.totalReferrals || 0
                        ),

                    premiumReferrals:
                        Number(
                            data.premiumReferrals || 0
                        ),


                    referralCode:
                        referralCode,

                    referralLink:
                        referralLink,


                    bankName:
                        data.bankName || "",

                    accountNumber:
                        data.accountNumber || "",

                    accountName:
                        data.accountName || "",


                    status:
                        data.isMarketer
                            ? "Active"
                            : "Inactive"
                };


                // ============================================================
                // UPDATE UI
                // ============================================================

                syncUI();

            } else {

                // ============================================================
                // PROFILE DOES NOT EXIST
                // ============================================================

                State.marketerData = {

                    balance: 0,

                    totalEarnings: 0,

                    totalReferrals: 0,

                    premiumReferrals: 0,

                    referralCode: "",

                    referralLink: "",

                    bankName: "",

                    accountNumber: "",

                    accountName: "",

                    status: "Inactive"
                };


                syncUI();
            }


            toggleSkeleton(false);
        },

        (error) => {

            console.error(
                "User profile subscription error:",
                error
            );

            toggleSkeleton(false);

            showToast(
                "Unable to sync your marketer account.",
                "error"
            );
        }
    );


    State.unsubscribes.push(
        unsubUser
    );


    // ========================================================================
    // REFERRAL ACTIVITY SUB-COLLECTION
    // ========================================================================

    const activityRef =
        collection(
            db,
            `users/${user.uid}/referrals`
        );


    const qActivity =
        query(
            activityRef,
            orderBy("timestamp", "desc")
        );


    const unsubActivity =
        onSnapshot(

            qActivity,

            (snapshot) => {

                const tempLogs = [];


                snapshot.forEach(
                    docSnap => {

                        const data =
                            docSnap.data();


                        tempLogs.push({

                            id:
                                docSnap.id,

                            ...data
                        });

                    }
                );


                State.activityLogs =
                    tempLogs;


                renderActivityLogs();
            },

            (error) => {

                console.error(
                    "Referral activity subscription error:",
                    error
                );
            }
        );


    State.unsubscribes.push(
        unsubActivity
    );
}


// ============================================================================
// 6. SYNCHRONIZE UI
// ============================================================================

function syncUI() {

    const data =
        State.marketerData;


    // ------------------------------------------------------------------------
    // OVERVIEW BALANCE
    // ------------------------------------------------------------------------

    const overviewBal =
        document.getElementById(
            "overview-balance"
        );

    if (overviewBal) {

        overviewBal.textContent =
            formatCurrency(
                data.balance
            );
    }


    // ------------------------------------------------------------------------
    // TOTAL EARNINGS
    // ------------------------------------------------------------------------

    const totalEarned =
        document.getElementById(
            "stat-total-earnings"
        );

    if (totalEarned) {

        totalEarned.textContent =
            formatCurrency(
                data.totalEarnings
            );
    }


    // ------------------------------------------------------------------------
    // TOTAL REFERRALS
    // ------------------------------------------------------------------------

    const totalRefs =
        document.getElementById(
            "stat-total-referrals"
        );

    if (totalRefs) {

        totalRefs.textContent =
            data.totalReferrals;
    }


    // ------------------------------------------------------------------------
    // PREMIUM REFERRALS
    // ------------------------------------------------------------------------

    const premRefs =
        document.getElementById(
            "stat-premium-referrals"
        );

    if (premRefs) {

        premRefs.textContent =
            data.premiumReferrals;
    }


    // ------------------------------------------------------------------------
    // REFERRAL CODE
    // ------------------------------------------------------------------------

    const codeDisplay =
        document.getElementById(
            "referral-code-display"
        );

    if (codeDisplay) {

        codeDisplay.textContent =
            data.referralCode ||
            "No referral code";
    }


    // ------------------------------------------------------------------------
    // REFERRAL LINK
    // ------------------------------------------------------------------------

    const linkDisplay =
        document.getElementById(
            "referral-link-display"
        );

    if (linkDisplay) {

        linkDisplay.textContent =
            data.referralLink ||
            "No referral link";
    }


    // ------------------------------------------------------------------------
    // WITHDRAW BALANCE
    // ------------------------------------------------------------------------

    const withdrawBal =
        document.getElementById(
            "withdraw-balance-amount"
        );

    if (withdrawBal) {

        withdrawBal.textContent =
            formatCurrency(
                data.balance
            );
    }


    // ------------------------------------------------------------------------
    // BANK DETAILS
    // ------------------------------------------------------------------------

    const bName =
        document.getElementById(
            "draw-bank-name"
        );

    const aNum =
        document.getElementById(
            "draw-account-number"
        );

    const aName =
        document.getElementById(
            "draw-account-name"
        );


    if (bName) {

        bName.value =
            data.bankName || "";
    }


    if (aNum) {

        aNum.value =
            data.accountNumber || "";
    }


    if (aName) {

        aName.value =
            data.accountName || "";
    }


    // ------------------------------------------------------------------------
    // WITHDRAWAL LIMIT
    // ------------------------------------------------------------------------

    const submitBtn =
        document.getElementById(
            "btn-execute-withdrawal"
        );


    const warningText =
        document.getElementById(
            "withdraw-restriction-sub"
        );


    if (data.balance >= 2000) {

        if (submitBtn) {

            submitBtn.disabled =
                false;
        }


        if (warningText) {

            warningText.textContent =
                "Your balance is eligible for immediate cash out.";

            warningText.style.color =
                "var(--green)";
        }

    } else {

        if (submitBtn) {

            submitBtn.disabled =
                true;
        }


        if (warningText) {

            const needed =
                2000 - data.balance;


            warningText.textContent =
                `You need ${formatCurrency(needed)} more to withdraw.`;

            warningText.style.color =
                "var(--danger)";
        }
    }


    renderActivityLogs();
}


// ============================================================================
// 7. REFERRAL ACTIVITY RENDERER
// ============================================================================

function renderActivityLogs() {

    const listContainer =
        document.getElementById(
            "activity-logs-list"
        );


    const emptyState =
        document.getElementById(
            "activity-empty-state"
        );


    if (
        !listContainer ||
        !emptyState
    ) {
        return;
    }


    if (
        State.activityLogs.length === 0
    ) {

        listContainer.innerHTML =
            "";

        emptyState.style.display =
            "block";

        return;
    }


    emptyState.style.display =
        "none";


    listContainer.innerHTML =
        "";


    const fragment =
        document.createDocumentFragment();


    State.activityLogs.forEach(
        log => {

            const card =
                document.createElement(
                    "div"
                );


            card.className =
                "activity-log-card fade-in";


            const valText =
                log.value || "";


            const labelText =
                log.friendName ||
                "New Referral";


            let dateText =
                log.date || "";


            if (
                !dateText &&
                log.timestamp
            ) {

                try {

                    const timestamp =
                        log.timestamp.toDate
                            ? log.timestamp.toDate()
                            : new Date(
                                log.timestamp
                            );


                    dateText =
                        timestamp.toLocaleDateString(
                            "en-NG",
                            {
                                year:
                                    "numeric",

                                month:
                                    "short",

                                day:
                                    "numeric"
                            }
                        );

                } catch (error) {

                    dateText =
                        "";
                }
            }


            card.innerHTML = `

                <div class="activity-log-details">

                    <h5>
                        ${escapeHTML(labelText)}
                    </h5>

                    <p>
                        ${escapeHTML(dateText)}
                    </p>

                </div>

                <div class="activity-log-value">
                    ${escapeHTML(valText)}
                </div>

            `;


            fragment.appendChild(
                card
            );
        }
    );


    listContainer.appendChild(
        fragment
    );
}


// ============================================================================
// 8. CURRENCY FORMATTER
// ============================================================================

function formatCurrency(num) {

    const amount =
        Number(num) || 0;


    return "₦" +
        amount.toLocaleString(
            "en-NG",
            {
                minimumFractionDigits:
                    2,

                maximumFractionDigits:
                    2
            }
        );
}


// ============================================================================
// 9. COPY TO CLIPBOARD
// ============================================================================

async function copyToClipboard(
    text,
    successMsg
) {

    if (
        !text ||
        text.trim() === ""
    ) {

        showToast(
            "No active code/link available to copy.",
            "error"
        );

        return;
    }


    try {

        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {

            await navigator.clipboard.writeText(
                text
            );

        } else {

            const input =
                document.createElement(
                    "textarea"
                );


            input.value =
                text;


            input.style.position =
                "fixed";


            input.style.opacity =
                "0";


            document.body.appendChild(
                input
            );


            input.focus();
            input.select();


            document.execCommand(
                "copy"
            );


            input.remove();
        }


        showToast(
            successMsg
        );

    } catch (error) {

        console.error(
            "Clipboard error:",
            error
        );


        showToast(
            "Failed to copy. Please select it manually.",
            "error"
        );
    }
}


// ============================================================================
// 10. BUILD REFERRAL MESSAGE
// ============================================================================

function buildReferralMessage() {

    const code =
        State.marketerData.referralCode;


    const link =
        State.marketerData.referralLink;


    if (
        !link ||
        link.trim() === ""
    ) {

        return null;
    }


    return (

        `Hey! 👋\n\n` +

        `Start practicing real DELSU GST CBT exams on FundsIQ and master your courses! 📚🔥\n\n` +

        `Use my invite code *${code || "FUNDS"}* to get your free welcome coins instantly. 🪙\n\n` +

        `Sign up here:\n${link}\n\n` +

        `Join FundsIQ and start practicing today! 🚀`
    );
}


// ============================================================================
// 11. WHATSAPP SHARE
// ============================================================================

function shareToWhatsApp() {

    const message =
        buildReferralMessage();


    if (!message) {

        showToast(
            "No active referral link available to share.",
            "error"
        );

        return;
    }


    const whatsappUrl =
        `https://wa.me/?text=${encodeURIComponent(message)}`;


    window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer"
    );
}


// ============================================================================
// 12. WHATSAPP BUSINESS SHARE
// ============================================================================

function shareToWhatsAppBusiness() {

    const message =
        buildReferralMessage();


    if (!message) {

        showToast(
            "No active referral link available to share.",
            "error"
        );

        return;
    }


    /*
     * WhatsApp Business uses the same WhatsApp
     * sharing protocol.
     *
     * We first attempt the WhatsApp deep link.
     * If the device does not handle it, we fall
     * back to the normal WhatsApp web/share URL.
     */

    const businessUrl =
        `whatsapp://send?text=${encodeURIComponent(message)}`;


    const normalUrl =
        `https://wa.me/?text=${encodeURIComponent(message)}`;


    try {

        window.location.href =
            businessUrl;

    } catch (error) {

        console.warn(
            "WhatsApp Business deep link failed:",
            error
        );
    }


    setTimeout(() => {

        if (!document.hidden) {

            window.open(
                normalUrl,
                "_blank",
                "noopener,noreferrer"
            );
        }

    }, 800);
}


// ============================================================================
// 13. UNIVERSAL SHARE
// ============================================================================

async function shareReferral() {

    const message =
        buildReferralMessage();


    if (!message) {

        showToast(
            "No active referral link available to share.",
            "error"
        );

        return;
    }


    if (
        navigator.share
    ) {

        try {

            await navigator.share({

                title:
                    "Join FundsIQ",

                text:
                    message,

                url:
                    State.marketerData.referralLink
            });


            return;

        } catch (error) {

            if (
                error.name ===
                "AbortError"
            ) {
                return;
            }


            console.warn(
                "Native share failed:",
                error
            );
        }
    }


    shareToWhatsApp();
}


// ============================================================================
// 14. TAB NAVIGATION
// ============================================================================

function initTabNavigation() {

    const tabs =
        document.querySelectorAll(
            "#dashboard-tab-bar .tab-btn"
        );


    tabs.forEach(
        tab => {

            tab.addEventListener(
                "click",
                () => {

                    tabs.forEach(
                        t =>
                            t.classList.remove(
                                "active"
                            )
                    );


                    tab.classList.add(
                        "active"
                    );


                    State.activeTab =
                        tab.getAttribute(
                            "data-tab"
                        );


                    const targetViewId =
                        "view-" +
                        State.activeTab;


                    document
                        .querySelectorAll(
                            ".tab-panel"
                        )
                        .forEach(
                            view => {

                                view.classList.remove(
                                    "active-view"
                                );
                            }
                        );


                    const targetView =
                        document.getElementById(
                            targetViewId
                        );


                    if (targetView) {

                        targetView.classList.add(
                            "active-view"
                        );
                    }
                }
            );
        }
    );
}


// ============================================================================
// 15. EDIT BANK DETAILS
// ============================================================================

function triggerEditBankDetails() {

    const withdrawTabBtn =
        document.querySelector(
            '[data-tab="withdraw"]'
        );


    if (withdrawTabBtn) {

        withdrawTabBtn.click();
    }


    const firstFormInput =
        document.getElementById(
            "draw-bank-name"
        );


    if (firstFormInput) {

        firstFormInput.focus();
    }
}


// ============================================================================
// 16. GLOBAL FUNCTIONS
// ============================================================================

window.triggerEditBankDetails =
    triggerEditBankDetails;

window.shareToWhatsApp =
    shareToWhatsApp;

window.shareToWhatsAppBusiness =
    shareToWhatsAppBusiness;

window.shareReferral =
    shareReferral;


// ============================================================================
// 17. SKELETON LOADER
// ============================================================================

function toggleSkeleton(show) {

    const loader =
        document.getElementById(
            "skeleton-loader"
        );


    const viewport =
        document.querySelector(
            ".tab-viewport"
        );


    if (loader) {

        loader.style.display =
            show
                ? "flex"
                : "none";
    }


    if (viewport) {

        viewport.style.opacity =
            show
                ? "0"
                : "1";
    }
}


// ============================================================================
// 18. DOM BOOTSTRAP
// ============================================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initTabNavigation();

        toggleSkeleton(false);


        // ====================================================================
        // AUTH STATE
        // ====================================================================

        onAuthStateChanged(
            auth,
            user => {

                const dot =
                    document.querySelector(
                        ".status-dot"
                    );


                const txt =
                    document.getElementById(
                        "status-text"
                    );


                if (user) {

                    State.user =
                        user;


                    if (dot) {

                        dot.className =
                            "status-dot online";
                    }


                    if (txt) {

                        txt.textContent =
                            "Cloud Sync";
                    }


                    subscribeToMarketerData(
                        user
                    );

                } else {

                    State.user =
                        null;


                    State.unsubscribes.forEach(
                        unsub => {

                            try {

                                unsub();

                            } catch (error) {

                                console.error(
                                    error
                                );
                            }
                        }
                    );


                    State.unsubscribes =
                        [];


                    if (dot) {

                        dot.className =
                            "status-dot offline";
                    }


                    if (txt) {

                        txt.textContent =
                            "Offline Mode";
                    }


                    toggleSkeleton(
                        false
                    );


                    syncUI();
                }
            }
        );


        // ====================================================================
        // COPY REFERRAL CODE
        // ====================================================================

        document
            .getElementById(
                "btn-copy-code"
            )
            ?.addEventListener(
                "click",
                () => {

                    copyToClipboard(

                        State.marketerData
                            .referralCode,

                        "Referral code copied!"
                    );
                }
            );


        // ====================================================================
        // COPY REFERRAL LINK
        // ====================================================================

        document
            .getElementById(
                "btn-copy-link"
            )
            ?.addEventListener(
                "click",
                () => {

                    copyToClipboard(

                        State.marketerData
                            .referralLink,

                        "Referral link copied!"
                    );
                }
            );


        // ====================================================================
        // WHATSAPP
        // ====================================================================

        document
            .getElementById(
                "btn-whatsapp-share"
            )
            ?.addEventListener(
                "click",
                shareToWhatsApp
            );


        // ====================================================================
        // WHATSAPP BUSINESS
        // ====================================================================

        document
            .getElementById(
                "btn-whatsapp-business-share"
            )
            ?.addEventListener(
                "click",
                shareToWhatsAppBusiness
            );


        // ====================================================================
        // UNIVERSAL SHARE
        // ====================================================================

        document
            .getElementById(
                "btn-share-referral"
            )
            ?.addEventListener(
                "click",
                shareReferral
            );


        // ====================================================================
        // QUICK WITHDRAW BUTTON
        // ====================================================================

        document
            .getElementById(
                "overview-withdraw-trigger-btn"
            )
            ?.addEventListener(
                "click",
                () => {

                    const withdrawTab =
                        document.querySelector(
                            '[data-tab="withdraw"]'
                        );


                    if (withdrawTab) {

                        withdrawTab.click();
                    }
                }
            );


        // ====================================================================
        // WITHDRAWAL FORM
        // ====================================================================

        const withdrawForm =
            document.getElementById(
                "withdrawal-form"
            );


        if (withdrawForm) {

            withdrawForm.addEventListener(
                "submit",
                async e => {

                    e.preventDefault();


                    // --------------------------------------------------------
                    // AUTH CHECK
                    // --------------------------------------------------------

                    if (!State.user) {

                        showToast(
                            "Please log in to request a payout.",
                            "error"
                        );

                        return;
                    }


                    // --------------------------------------------------------
                    // GET FORM VALUES
                    // --------------------------------------------------------

                    const bank =
                        document
                            .getElementById(
                                "draw-bank-name"
                            )
                            ?.value
                            .trim();


                    const accountNo =
                        document
                            .getElementById(
                                "draw-account-number"
                            )
                            ?.value
                            .trim();


                    const accountName =
                        document
                            .getElementById(
                                "draw-account-name"
                            )
                            ?.value
                            .trim();


                    // --------------------------------------------------------
                    // FORM VALIDATION
                    // --------------------------------------------------------

                    if (
                        !bank ||
                        !accountNo ||
                        !accountName
                    ) {

                        showToast(
                            "Please complete all bank details.",
                            "error"
                        );

                        return;
                    }


                    if (
                        !/^\d{10}$/.test(
                            accountNo
                        )
                    ) {

                        showToast(
                            "Enter a valid 10-digit account number.",
                            "error"
                        );

                        return;
                    }


                    // --------------------------------------------------------
                    // GET CURRENT BALANCE
                    // --------------------------------------------------------

                    const balance =
                        Number(
                            State.marketerData
                                .balance
                        ) || 0;


                    if (
                        balance < 2000
                    ) {

                        showToast(
                            "Withdrawal failed. Minimum limit is ₦2,000.",
                            "error"
                        );

                        return;
                    }


                    // --------------------------------------------------------
                    // DISABLE BUTTON
                    // --------------------------------------------------------

                    const submitBtn =
                        document.getElementById(
                            "btn-execute-withdrawal"
                        );


                    if (submitBtn) {

                        submitBtn.disabled =
                            true;


                        submitBtn.innerHTML =
                            `<span>⏳</span> Processing Payout...`;
                    }


                    try {

                        const userRef =
                            doc(
                                db,
                                "users",
                                State.user.uid
                            );


                        // ====================================================
                        // CREATE WITHDRAWAL REQUEST
                        // ====================================================

                        const payoutLogsRef =
                            collection(
                                db,
                                `users/${State.user.uid}/withdrawals`
                            );


                        await addDoc(
                            payoutLogsRef,
                            {

                                bankName:
                                    bank,

                                accountNumber:
                                    accountNo,

                                accountName:
                                    accountName,

                                amount:
                                    balance,

                                status:
                                    "Processing",

                                requestedAt:
                                    serverTimestamp()
                            }
                        );


                        // ====================================================
                        // UPDATE USER PROFILE
                        // ====================================================

                        await updateDoc(
                            userRef,
                            {

                                bankName:
                                    bank,

                                accountNumber:
                                    accountNo,

                                accountName:
                                    accountName,

                                marketerBalance:
                                    0,

                                pendingWithdrawal:
                                    balance,

                                withdrawalStatus:
                                    "Processing",

                                lastWithdrawal:
                                    serverTimestamp()
                            }
                        );


                        showToast(
                            "Payout request submitted successfully!"
                        );


                    } catch (error) {

                        console.error(
                            "Withdrawal transaction failed:",
                            error
                        );


                        showToast(
                            "Payment processing failed. Try again.",
                            "error"
                        );

                    } finally {

                        // ----------------------------------------------------
                        // RESTORE BUTTON
                        // ----------------------------------------------------

                        if (submitBtn) {

                            submitBtn.disabled =
                                false;


                            submitBtn.innerHTML =
                                "📝 Submit Payout Request";
                        }
                    }
                }
            );
        }
    }
);
