import { auth, db } from "./firebase.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

"use strict";

// Generate a unique referral code
function generateReferralCode() {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "FUNDS-";

    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    return code;
}

/**
 * FundsIQ Affiliate & Marketer Portals Subsystem
 * Developed by Odigwe Joshua
 */
    // =========================================================================
    // 1. DYNAMIC TAB SUB-NAVIGATION CONTROLLER
    // =========================================================================
    const TabRouter = {
        init() {
            const tabs = document.querySelectorAll("#marketer-tab-bar .tab-btn");
            
            tabs.forEach(tab => {
                tab.addEventListener("click", () => {
                    // Remove active style state from all tab triggers
                    tabs.forEach(t => t.classList.remove("active"));
                    
                    // Activate clicked tab
                    tab.classList.add("active");

                    const targetTabId = tab.getAttribute("data-tab");
                    const targetViewId = `view-${targetTabId}`;

                    // Deactivate all sub-view containers
                    document.querySelectorAll(".tab-view").forEach(view => {
                        view.classList.remove("active-view");
                    });

                    // Activate targeted sub-view container
                    const targetView = document.getElementById(targetViewId);
                    if (targetView) {
                        targetView.classList.add("active-view");
                        // Scroll layout container slightly to align view on small screens
                        targetView.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                    }
                });
            });
        }
    };

    // =========================================================================
    // 2. EXPANDABLE ACCORDION MANAGER (ACCURATE SCROLL HEIGHTS)
    // =========================================================================
    const AccordionManager = {
        init() {
            const triggers = document.querySelectorAll(".accordion-trigger");

            triggers.forEach(trigger => {
                trigger.addEventListener("click", () => {
                    const isExpanded = trigger.getAttribute("aria-expanded") === "true";
                    const panel = trigger.nextElementSibling;

                    // Close all active panels first (Classical Accordion Behavior)
                    triggers.forEach(t => {
                        t.setAttribute("aria-expanded", "false");
                        const activePanel = t.nextElementSibling;
                        if (activePanel) {
                            activePanel.style.maxHeight = null;
                        }
                    });

                    // Toggle clicked panel state using exact scroll heights to prevent jumps
                    if (!isExpanded) {
                        trigger.setAttribute("aria-expanded", "true");
                        if (panel) {
                            panel.style.maxHeight = panel.scrollHeight + "px";
                        }
                    }
                });
            });
        }
    };

    // =========================================================================
    // 3. TACTILE RIPPLE WAVE MATH CONTROLLER
    // =========================================================================
    const RippleEngine = {
        init() {
            const rippleButtons = document.querySelectorAll(".ripple-btn");

            rippleButtons.forEach(btn => {
                btn.addEventListener("click", function (e) {
                    // Extract click coordinate offsets relative to button bounds
                    const rect = btn.getBoundingClientRect();
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;

                    // Generate temporary ripple span
                    const ripple = document.createElement("span");
                    ripple.className = "ripple";
                    ripple.style.left = `${x}px`;
                    ripple.style.top = `${y}px`;

                    btn.appendChild(ripple);

                    // Garbage collection of completed ripple nodes
                    setTimeout(() => {
                        ripple.remove();
                    }, 550);
                });
            });
        }
    };

    // =========================================================================
    // 4. FIREBASE INTERFACE MAPPINGS (FUTURE-PROOF COMPLIANCE)
    // =========================================================================
    const FirebaseBridge = {
        // Scoped functions ready to be connected to Firestore collections later
        async checkMarketerStatus(userId) {
            console.log("Validating marketer status in Firestore path: users/" + userId);
            // Future logic:
            // const userDoc = await getDoc(doc(db, "users", userId));
            // return userDoc.exists() ? userDoc.data().isMarketer : false;
        },

        async registerNewMarketer(userId, customReferralCode) {
            console.log(`Writing marketer credentials to Firestore users/${userId} and referralCodes/${customReferralCode}`);
            // Future logic:
            // await updateDoc(doc(db, "users", userId), { isMarketer: true, referralCode: customReferralCode });
            // await setDoc(doc(db, "referralCodes", customReferralCode), { ownerUid: userId, clicks: 0 });
        }
    };

// =========================================================================
// 5. BOOTSTRAP SYSTEM INITIALIZER
// =========================================================================
const bootstrap = () => {
    TabRouter.init();
    AccordionManager.init();
    RippleEngine.init();
};

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bootstrap);
} else {
    bootstrap();
}
// =============================
// Become Marketer Button
// FundsIQ Affiliate System
// =============================

const becomeBtn = document.getElementById("become-marketer-btn");

if (becomeBtn) {

    becomeBtn.addEventListener("click", async () => {

        // Disable button during process
        becomeBtn.disabled = true;
        becomeBtn.textContent = "Creating Account...";

        try {

            // Check authentication
            const user = auth.currentUser;

            if (!user) {
                alert("Please login first.");
                return;
            }


            // User document reference
            const userRef = doc(db, "users", user.uid);


            // Check existing user data
            const userSnap = await getDoc(userRef);


            if (userSnap.exists() && userSnap.data().isMarketer === true) {

                alert("You are already a FundsIQ Marketer.");

                window.location.href = "marketer-dashboard.html";

                return;
            }

// Generate unique referral code
const referralCode = generateReferralCode();

// Generate referral link
const referralLink =
    `https://funds7.github.io/FundsIQ/signup.html?ref=${referralCode}`;

// Create referral profile
await setDoc(
    doc(db, "referralCodes", referralCode),
    {
        uid: user.uid,
        referralCode,
        referralLink,

        totalReferrals: 0,
        totalPremiumSales: 0,
        totalCommission: 0,

        clicks: 0,
        conversions: 0,

        createdAt: serverTimestamp()
    }
);

// Update user marketer status
await setDoc(
    userRef,
    {
        isMarketer: true,
        referralCode,
        referralLink,

        marketerBalance: 0,
        totalEarnings: 0,
        totalReferrals: 0,
        premiumReferrals: 0,

        marketerJoinedAt: serverTimestamp()
    },
    {
        merge: true
    }
);

            console.log(
                "FundsIQ Marketer Created:",
                referralCode
            );


            alert(
                "🎉 Congratulations!\n\nYou are now a FundsIQ Marketer."
            );


            // Go to dashboard
            window.location.href =
                "marketer-dashboard.html";


        } catch (error) {

            console.error(
                "Marketer registration error:",
                error
            );


            alert(
                "Something went wrong. Please try again."
            );


        } finally {

            // Restore button
            becomeBtn.disabled = false;
            becomeBtn.textContent =
                "Become a Marketer";

        }

    });

}
