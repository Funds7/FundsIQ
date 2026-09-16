/**
 * FundsIQ Affiliate & Marketer Dashboard
 * Full version:
 * - Referral counter repair
 * - Firebase Modular SDK v12
 * - Paystack bank loading
 * - Bank account verification
 * - Real backend withdrawal
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
    query,
    orderBy,
    onSnapshot
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

"use strict";


// ============================================================================
// 2. CONFIGURATION
// ============================================================================

const API_BASE =
    "https://fundsiq-api.onrender.com";

const MINIMUM_WITHDRAWAL =
    2000;


// ============================================================================
// 3. RUNTIME STATE
// ============================================================================

const State = {

    user: null,

    activeTab: "overview",

    banks: [],

    accountVerified: false,

    verifiedAccountName: "",

    verifiedAccountNumber: "",

    verifiedBankCode: "",

    verifiedBankName: "",

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

        status: "Inactive",

        withdrawalStatus: ""

    },

    activityLogs: [],

    unsubscribes: []

};


// ============================================================================
// 4. TOAST
// ============================================================================

function showToast(
    message,
    type = "success"
) {

    const container =
        document.getElementById(
            "toast-container"
        );

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
// 5. ESCAPE HTML
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
// 6. GET FIREBASE ID TOKEN
// ============================================================================

async function getFirebaseToken() {

    if (!State.user) {

        throw new Error(
            "You must be logged in."
        );
    }

    return await State.user.getIdToken(
        true
    );
}


// ============================================================================
// 7. BACKEND REQUEST HELPER
// ============================================================================

async function apiRequest(
    endpoint,
    options = {}
) {

    const token =
        await getFirebaseToken();

    const headers = {

        Authorization:
            `Bearer ${token}`,

        "Content-Type":
            "application/json",

        ...(options.headers || {})

    };


    const response =
        await fetch(
            `${API_BASE}${endpoint}`,
            {
                ...options,
                headers
            }
        );


    let data = null;

    try {

        data =
            await response.json();

    } catch (error) {

        data = null;

    }


    if (!response.ok) {

        throw new Error(

            data?.msg ||
            data?.message ||
            "Request failed."

        );

    }


    return data;
}


// ============================================================================
// 8. FIRESTORE DATA SUBSCRIPTION
// ============================================================================

function subscribeToMarketerData(user) {

    // ------------------------------------------------------------------------
    // CLEAN OLD LISTENERS
    // ------------------------------------------------------------------------

    State.unsubscribes.forEach(
        unsub => {

            try {

                unsub();

            } catch (error) {

                console.error(
                    "Listener cleanup error:",
                    error
                );

            }

        }
    );

    State.unsubscribes = [];


    // ------------------------------------------------------------------------
    // USER PROFILE
    // ------------------------------------------------------------------------

    const userRef =
        doc(
            db,
            "users",
            user.uid
        );


    toggleSkeleton(true);


    // =========================================================================
    // USER PROFILE SNAPSHOT
    // =========================================================================

    const unsubUser =
        onSnapshot(

            userRef,

            docSnap => {

                if (!docSnap.exists()) {

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

                        status: "Inactive",

                        withdrawalStatus: ""

                    };


                    syncUI();

                    toggleSkeleton(false);

                    return;
                }


                const data =
                    docSnap.data();


                // =============================================================
                // REFERRAL CODE
                // =============================================================

                const referralCode =
                    data.referralCode || "";


                // =============================================================
                // CORRECT FUNDSIQ REFERRAL LINK
                // =============================================================

                const referralLink =
    referralCode
        ? `https://fundsiq.com.ng/signup.html?ref=${encodeURIComponent(referralCode)}`
        : "";


                // =============================================================
                // REPAIR OLD REFERRAL LINK
                // =============================================================

                if (
                    referralCode &&
                    data.referralLink !== referralLink
                ) {

                    updateDoc(
                        userRef,
                        {
                            referralLink:
                                referralLink
                        }
                    ).catch(error => {

                        console.error(
                            "Referral link repair failed:",
                            error
                        );

                    });

                }


                // =============================================================
                // PROFILE REFERRAL COUNT
                // =============================================================

                const profileReferralCount =
                    Number(
                        data.totalReferrals ??
                        data.referralCount ??
                        0
                    ) || 0;


                // =============================================================
                // STORE PROFILE DATA
                // =============================================================

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
                        profileReferralCount,

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
                            : "Inactive",

                    withdrawalStatus:
                        data.withdrawalStatus || ""

                };


                syncUI();

                toggleSkeleton(false);


                // Load banks after authentication/profile
                loadBanksIfNeeded();

            },

            error => {

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


    // =========================================================================
    // REFERRAL ACTIVITY
    // =========================================================================

    const activityRef =
        collection(
            db,
            "users",
            user.uid,
            "referrals"
        );


    const qActivity =
        query(
            activityRef,
            orderBy(
                "timestamp",
                "desc"
            )
        );


    const unsubActivity =
        onSnapshot(

            qActivity,

            async snapshot => {

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


                // =============================================================
                // REFERRAL COUNTER FIX
                // =============================================================

                const activityReferralCount =
                    snapshot.size;


                const profileReferralCount =
                    Number(
                        State.marketerData.totalReferrals
                    ) || 0;


                const correctReferralCount =
                    Math.max(
                        profileReferralCount,
                        activityReferralCount
                    );


                State.marketerData.totalReferrals =
                    correctReferralCount;


                // =============================================================
                // REPAIR FIRESTORE COUNTER
                // =============================================================

                if (
                    correctReferralCount !==
                    profileReferralCount
                ) {

                    try {

                        await updateDoc(
                            userRef,
                            {
                                totalReferrals:
                                    correctReferralCount
                            }
                        );

                        console.log(
                            "FundsIQ referral counter repaired:",
                            correctReferralCount
                        );

                    } catch (error) {

                        console.error(
                            "Could not repair totalReferrals:",
                            error
                        );

                    }

                }


                syncUI();

                renderActivityLogs();

            },

            error => {

                console.error(
                    "Referral activity subscription error:",
                    error
                );

                syncUI();

            }

        );


    State.unsubscribes.push(
        unsubActivity
    );

}


// ============================================================================
// 9. SYNCHRONIZE UI
// ============================================================================

function syncUI() {

    const data =
        State.marketerData;


    // =========================================================================
    // BALANCE
    // =========================================================================

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


    // =========================================================================
    // TOTAL EARNINGS
    // =========================================================================

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


    // =========================================================================
    // TOTAL REFERRALS
    // =========================================================================

    const totalRefs =
        document.getElementById(
            "stat-total-referrals"
        );


    if (totalRefs) {

        totalRefs.textContent =
            String(
                Number(
                    data.totalReferrals
                ) || 0
            );

    }


    // =========================================================================
    // PREMIUM REFERRALS
    // =========================================================================

    const premRefs =
        document.getElementById(
            "stat-premium-referrals"
        );


    if (premRefs) {

        premRefs.textContent =
            String(
                Number(
                    data.premiumReferrals
                ) || 0
            );

    }


    // =========================================================================
    // REFERRAL CODE
    // =========================================================================

    const codeDisplay =
        document.getElementById(
            "referral-code-display"
        );


    if (codeDisplay) {

        codeDisplay.textContent =
            data.referralCode ||
            "No referral code";

    }


    // =========================================================================
    // REFERRAL LINK
    // =========================================================================

    const linkDisplay =
        document.getElementById(
            "referral-link-display"
        );


    if (linkDisplay) {

        linkDisplay.textContent =
            data.referralLink ||
            "No referral link";

    }


    // =========================================================================
    // WITHDRAW BALANCE
    // =========================================================================

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


    // =========================================================================
    // BANK DETAILS
    // =========================================================================

    const aNum =
        document.getElementById(
            "draw-account-number"
        );


    const aName =
        document.getElementById(
            "draw-account-name"
        );


    if (aNum) {

        aNum.value =
            data.accountNumber || "";

    }


    if (aName) {

        aName.value =
            data.accountName || "";

    }


    // =========================================================================
    // BANK SELECT
    // =========================================================================

    const bankField =
        document.getElementById(
            "draw-bank-name"
        );


    if (
        bankField &&
        bankField.tagName === "SELECT"
    ) {

        if (data.bankName) {

            const option =
                Array.from(
                    bankField.options
                ).find(
                    item =>
                        item.textContent.trim()
                            .toLowerCase() ===
                        data.bankName
                            .trim()
                            .toLowerCase()
                );


            if (option) {

                bankField.value =
                    option.value;

            }

        }

    }


    // =========================================================================
    // WITHDRAW BUTTON
    // =========================================================================

    const submitBtn =
        document.getElementById(
            "btn-execute-withdrawal"
        );


    const warningText =
        document.getElementById(
            "withdraw-restriction-sub"
        );


    const isProcessing =
        data.withdrawalStatus ===
            "Initiating" ||
        data.withdrawalStatus ===
            "Processing";


    if (isProcessing) {

        if (submitBtn) {

            submitBtn.disabled =
                true;

        }


        if (warningText) {

            warningText.textContent =
                "Your previous withdrawal is still being processed.";

            warningText.style.color =
                "var(--danger)";

        }

    }

    else if (
        data.balance >=
        MINIMUM_WITHDRAWAL
    ) {

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

    }

    else {

        if (submitBtn) {

            submitBtn.disabled =
                true;

        }


        if (warningText) {

            const needed =
                MINIMUM_WITHDRAWAL -
                data.balance;


            warningText.textContent =
                `You need ${formatCurrency(needed)} more to withdraw.`;

            warningText.style.color =
                "var(--danger)";

        }

    }


    renderActivityLogs();

}


// ============================================================================
// 10. LOAD BANKS
// ============================================================================

async function loadBanksIfNeeded() {

    if (
        State.banks.length > 0
    ) {

        populateBankField();

        return;

    }


    try {

        const data =
            await apiRequest(
                "/api/withdrawal/banks"
            );


        if (
            !data ||
            !Array.isArray(
                data.banks
            )
        ) {

            throw new Error(
                "Bank list was not returned."
            );

        }


        State.banks =
            data.banks;


        populateBankField();

    } catch (error) {

        console.error(
            "Bank loading error:",
            error
        );

        showToast(
            "Unable to load Nigerian banks.",
            "error"
        );

    }

}


// ============================================================================
// 11. POPULATE BANK FIELD
// ============================================================================

function populateBankField() {

    const field =
        document.getElementById(
            "draw-bank-name"
        );


    if (!field) {

        console.warn(
            "draw-bank-name field not found."
        );

        return;

    }


    // =========================================================
    // IF ALREADY A SELECT
    // =========================================================

    if (
        field.tagName ===
        "SELECT"
    ) {

        fillBankSelect(
            field
        );

        return;

    }


    // =========================================================
    // IF OLD HTML USES INPUT
    // =========================================================

    const select =
        document.createElement(
            "select"
        );


    select.id =
        "draw-bank-name";


    select.name =
        field.name ||
        "bankName";


    select.className =
        field.className;


    select.required =
        true;


    select.innerHTML = `

        <option value="">
            Select your bank
        </option>

    `;


    State.banks.forEach(
        bank => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                bank.code;


            option.textContent =
                bank.name;


            select.appendChild(
                option
            );

        }
    );


    field.replaceWith(
        select
    );


    // Restore previous bank selection
    if (
        State.marketerData.bankName
    ) {

        const matchingBank =
            State.banks.find(
                bank =>
                    bank.name
                        .toLowerCase() ===
                    State.marketerData
                        .bankName
                        .toLowerCase()
            );


        if (matchingBank) {

            select.value =
                matchingBank.code;

        }

    }


    select.addEventListener(
        "change",
        () => {

            resetAccountVerification();

        }
    );

}


// ============================================================================
// 12. FILL EXISTING SELECT
// ============================================================================

function fillBankSelect(
    select
) {

    const currentValue =
        select.value;


    select.innerHTML = `

        <option value="">
            Select your bank
        </option>

    `;


    State.banks.forEach(
        bank => {

            const option =
                document.createElement(
                    "option"
                );


            option.value =
                bank.code;


            option.textContent =
                bank.name;


            select.appendChild(
                option
            );

        }
    );


    if (
        currentValue
    ) {

        select.value =
            currentValue;

    }


    if (
        State.marketerData.bankName
    ) {

        const matchingBank =
            State.banks.find(
                bank =>
                    bank.name
                        .toLowerCase() ===
                    State.marketerData
                        .bankName
                        .toLowerCase()
            );


        if (
            matchingBank &&
            !select.value
        ) {

            select.value =
                matchingBank.code;

        }

    }


    select.addEventListener(
        "change",
        resetAccountVerification
    );

}


// ============================================================================
// 13. RESET ACCOUNT VERIFICATION
// ============================================================================

function resetAccountVerification() {

    State.accountVerified =
        false;

    State.verifiedAccountName =
        "";

    State.verifiedAccountNumber =
        "";

    State.verifiedBankCode =
        "";

    State.verifiedBankName =
        "";


    const accountName =
        document.getElementById(
            "draw-account-name"
        );


    if (accountName) {

        accountName.value =
            "";

    }


    setAccountVerificationMessage(
        "",
        ""
    );

}


// ============================================================================
// 14. VERIFY BANK ACCOUNT
// ============================================================================

async function verifyBankAccount() {

    const bankField =
        document.getElementById(
            "draw-bank-name"
        );


    const accountField =
        document.getElementById(
            "draw-account-number"
        );


    const accountNameField =
        document.getElementById(
            "draw-account-name"
        );


    const bankCode =
        bankField?.value?.trim() ||
        "";


    const accountNumber =
        accountField?.value?.trim() ||
        "";


    if (!bankCode) {

        throw new Error(
            "Please select your bank."
        );

    }


    if (
        !/^\d{10}$/.test(
            accountNumber
        )
    ) {

        throw new Error(
            "Enter a valid 10-digit account number."
        );

    }


    setAccountVerificationMessage(
        "Verifying bank account...",
        "loading"
    );


    const data =
        await apiRequest(
            "/api/withdrawal/verify-account",
            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        accountNumber,

                        bankCode

                    })

            }
        );


    if (
        !data ||
        !data.status ||
        !data.accountName
    ) {

        throw new Error(
            "Bank account could not be verified."
        );

    }


    const selectedBank =
        State.banks.find(
            bank =>
                bank.code ===
                bankCode
        );


    State.accountVerified =
        true;

    State.verifiedAccountName =
        data.accountName;

    State.verifiedAccountNumber =
        data.accountNumber ||
        accountNumber;

    State.verifiedBankCode =
        bankCode;

    State.verifiedBankName =
        selectedBank?.name ||
        "";


    if (accountNameField) {

        accountNameField.value =
            data.accountName;

    }


    setAccountVerificationMessage(
        `✓ Account verified: ${data.accountName}`,
        "success"
    );


    return data;

}


// ============================================================================
// 15. ACCOUNT VERIFICATION MESSAGE
// ============================================================================

function setAccountVerificationMessage(
    message,
    type
) {

    let element =
        document.getElementById(
            "fundsiq-account-verification-message"
        );


    const accountField =
        document.getElementById(
            "draw-account-name"
        );


    if (!element) {

        element =
            document.createElement(
                "div"
            );


        element.id =
            "fundsiq-account-verification-message";


        element.style.marginTop =
            "8px";


        element.style.fontSize =
            "13px";


        element.style.fontWeight =
            "600";


        if (accountField) {

            accountField.parentNode
                ?.appendChild(
                    element
                );

        }

    }


    element.textContent =
        message || "";


    if (
        type ===
        "success"
    ) {

        element.style.color =
            "var(--green, #16a34a)";

    }

    else if (
        type ===
        "loading"
    ) {

        element.style.color =
            "var(--text-muted, #777)";

    }

    else {

        element.style.color =
            "var(--danger, #dc2626)";

    }

}


// ============================================================================
// 16. ACTIVITY RENDERER
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
// 17. CURRENCY
// ============================================================================

function formatCurrency(
    num
) {

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
// 18. COPY TO CLIPBOARD
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

        }

        else {

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
// 19. REFERRAL MESSAGE
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
// 20. WHATSAPP
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
        `https://wa.me/?text=${encodeURIComponent(
            message
        )}`;


    window.open(
        whatsappUrl,
        "_blank",
        "noopener,noreferrer"
    );

}


// ============================================================================
// 21. WHATSAPP BUSINESS
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


    const businessUrl =
        `whatsapp://send?text=${encodeURIComponent(
            message
        )}`;


    const normalUrl =
        `https://wa.me/?text=${encodeURIComponent(
            message
        )}`;


    try {

        window.location.href =
            businessUrl;

    } catch (error) {

        console.warn(
            "WhatsApp Business deep link failed:",
            error
        );

    }


    setTimeout(
        () => {

            if (!document.hidden) {

                window.open(
                    normalUrl,
                    "_blank",
                    "noopener,noreferrer"
                );

            }

        },
        800
    );

}


// ============================================================================
// 22. UNIVERSAL SHARE
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


    if (navigator.share) {

        try {

            await navigator.share({

                title:
                    "Join FundsIQ",

                text:
                    message,

                url:
                    State.marketerData
                        .referralLink

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
// 23. TAB NAVIGATION
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
// 24. EDIT BANK DETAILS
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
// 25. GLOBAL FUNCTIONS
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
// 26. SKELETON
// ============================================================================

function toggleSkeleton(
    show
) {

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
// 27. REAL PAYSTACK WITHDRAWAL
// ============================================================================

async function executeRealWithdrawal() {

    if (!State.user) {

        throw new Error(
            "Please log in to withdraw."
        );

    }


    const balance =
        Number(
            State.marketerData.balance
        ) || 0;


    if (
        balance <
        MINIMUM_WITHDRAWAL
    ) {

        throw new Error(
            `Minimum withdrawal is ${formatCurrency(
                MINIMUM_WITHDRAWAL
            )}.`
        );

    }


    const bankField =
        document.getElementById(
            "draw-bank-name"
        );


    const accountField =
        document.getElementById(
            "draw-account-number"
        );


    const accountNameField =
        document.getElementById(
            "draw-account-name"
        );


    const bankCode =
        bankField?.value?.trim() ||
        "";


    const accountNumber =
        accountField?.value?.trim() ||
        "";


    if (!bankCode) {

        throw new Error(
            "Please select your bank."
        );

    }


    if (
        !/^\d{10}$/.test(
            accountNumber
        )
    ) {

        throw new Error(
            "Enter a valid 10-digit account number."
        );

    }


    // =========================================================
    // VERIFY ACCOUNT FIRST
    // =========================================================

    const verification =
        await verifyBankAccount();


    if (
        !verification ||
        !verification.accountName
    ) {

        throw new Error(
            "Bank account verification failed."
        );

    }


    // =========================================================
    // CONFIRM OFFICIAL ACCOUNT NAME
    // =========================================================

    const officialName =
        verification.accountName;


    if (accountNameField) {

        accountNameField.value =
            officialName;

    }


    const bank =
        State.banks.find(
            item =>
                item.code ===
                bankCode
        );


    const bankName =
        bank?.name ||
        "";


    // =========================================================
    // FINAL CONFIRMATION
    // =========================================================

    const confirmed =
        window.confirm(

            `Confirm your withdrawal:\n\n` +

            `Amount: ${formatCurrency(
                balance
            )}\n` +

            `Bank: ${bankName}\n` +

            `Account: ${accountNumber}\n` +

            `Account name: ${officialName}\n\n` +

            `Do you want to continue?`

        );


    if (!confirmed) {

        return null;

    }


    // =========================================================
    // SEND TO SECURE BACKEND
    // =========================================================

    const result =
        await apiRequest(
            "/api/withdrawal/request",
            {

                method:
                    "POST",

                body:
                    JSON.stringify({

                        accountNumber,

                        bankCode,

                        bankName

                    })

            }
        );


    return result;

}


// ============================================================================
// 28. DOM BOOTSTRAP
// ============================================================================

document.addEventListener(
    "DOMContentLoaded",
    () => {

        initTabNavigation();

        toggleSkeleton(false);


        // =====================================================================
        // AUTH STATE
        // =====================================================================

        onAuthStateChanged(
            auth,
            user => {

                if (user) {

                    State.user =
                        user;


                    subscribeToMarketerData(
                        user
                    );

                }

                else {

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

                        status: "Inactive",

                        withdrawalStatus: ""

                    };


                    toggleSkeleton(false);

                    syncUI();

                }

            }
        );


        // =====================================================================
        // COPY CODE
        // =====================================================================

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


        // =====================================================================
        // COPY LINK
        // =====================================================================

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


        // =====================================================================
        // WHATSAPP
        // =====================================================================

        document
            .getElementById(
                "btn-whatsapp-share"
            )
            ?.addEventListener(
                "click",
                shareToWhatsApp
            );


        // =====================================================================
        // WHATSAPP BUSINESS
        // =====================================================================

        document
            .getElementById(
                "btn-whatsapp-business-share"
            )
            ?.addEventListener(
                "click",
                shareToWhatsAppBusiness
            );


        // =====================================================================
        // UNIVERSAL SHARE
        // =====================================================================

        document
            .getElementById(
                "btn-share-referral"
            )
            ?.addEventListener(
                "click",
                shareReferral
            );


        // =====================================================================
        // QUICK WITHDRAW
        // =====================================================================

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


        // =====================================================================
        // ACCOUNT NUMBER CHANGE
        // =====================================================================

        document
            .getElementById(
                "draw-account-number"
            )
            ?.addEventListener(
                "input",
                () => {

                    resetAccountVerification();

                }
            );


        // =====================================================================
        // WITHDRAWAL FORM
        // =====================================================================

        const withdrawForm =
            document.getElementById(
                "withdrawal-form"
            );


        if (withdrawForm) {

            withdrawForm.addEventListener(
                "submit",
                async e => {

                    e.preventDefault();


                    if (!State.user) {

                        showToast(
                            "Please log in to request a payout.",
                            "error"
                        );

                        return;

                    }


                    const submitBtn =
                        document.getElementById(
                            "btn-execute-withdrawal"
                        );


                    if (submitBtn) {

                        submitBtn.disabled =
                            true;

                        submitBtn.innerHTML =
                            `<span>⏳</span> Verifying & Processing...`;

                    }


                    try {

                        const result =
                            await executeRealWithdrawal();


                        if (!result) {

                            return;

                        }


                        if (
                            result.transferStatus ===
                            "success"
                        ) {

                            showToast(
                                `Withdrawal of ${formatCurrency(
                                    result.amount
                                )} was sent successfully!`
                            );

                        }

                        else {

                            showToast(
                                `Withdrawal of ${formatCurrency(
                                    result.amount
                                )} is being processed.`
                            );

                        }


                        // Reset local verification state
                        resetAccountVerification();


                    } catch (error) {

                        console.error(
                            "Real withdrawal failed:",
                            error
                        );


                        showToast(
                            error.message ||
                            "Withdrawal failed. Your balance was not intentionally deducted.",
                            "error"
                        );

                    } finally {

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
