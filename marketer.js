import { auth, db } from "./firebase.js";
import { showModal } from "./modals.js";

import {
  doc,
  getDoc,
  setDoc,
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


// TAB NAVIGATION

const TabRouter = {

  init() {

    const tabs = document.querySelectorAll("#marketer-tab-bar .tab-btn");

    tabs.forEach(tab => {

      tab.addEventListener("click", () => {

        tabs.forEach(t => t.classList.remove("active"));

        tab.classList.add("active");

        const targetTabId = tab.getAttribute("data-tab");
        const targetViewId = `view-${targetTabId}`;

        document.querySelectorAll(".tab-view").forEach(view => {
          view.classList.remove("active-view");
        });

        const targetView = document.getElementById(targetViewId);

        if (targetView) {
          targetView.classList.add("active-view");
          targetView.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
          });
        }

      });

    });

  }

};


// ACCORDION MANAGER

const AccordionManager = {

  init() {

    const triggers = document.querySelectorAll(".accordion-trigger");

    triggers.forEach(trigger => {

      trigger.addEventListener("click", () => {

        const isExpanded =
          trigger.getAttribute("aria-expanded") === "true";

        const panel = trigger.nextElementSibling;

        triggers.forEach(t => {

          t.setAttribute("aria-expanded", "false");

          const activePanel = t.nextElementSibling;

          if (activePanel) {
            activePanel.style.maxHeight = null;
          }

        });

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


// RIPPLE EFFECT

const RippleEngine = {

  init() {

    const rippleButtons = document.querySelectorAll(".ripple-btn");

    rippleButtons.forEach(btn => {

      btn.addEventListener("click", function (e) {

        const rect = btn.getBoundingClientRect();

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const ripple = document.createElement("span");

        ripple.className = "ripple";
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;

        btn.appendChild(ripple);

        setTimeout(() => {
          ripple.remove();
        }, 550);

      });

    });

  }

};


// FIREBASE BRIDGE

const FirebaseBridge = {

  async checkMarketerStatus(userId) {

    console.log(
      "Validating marketer status in Firestore path: users/" + userId
    );

  },

  async registerNewMarketer(userId, customReferralCode) {

    console.log(
      `Writing marketer credentials to Firestore users/${userId} and referralCodes/${customReferralCode}`
    );

  }

};


// INITIALIZE SYSTEM

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


// BECOME MARKETER

const becomeBtn = document.getElementById("become-marketer-btn");

if (becomeBtn) {

  becomeBtn.addEventListener("click", async () => {

    becomeBtn.disabled = true;
    becomeBtn.textContent = "Creating Account...";

    try {

      const user = auth.currentUser;

      // CHECK LOGIN

      if (!user) {

        await showModal({
          type: "warning",
          title: "Login Required",
          message: "Please log in to become a FundsIQ Marketer.",
          buttonText: "Continue"
        });

        return;
      }


      const userRef = doc(db, "users", user.uid);

      const userSnap = await getDoc(userRef);


      // CHECK EXISTING MARKETER

      if (
        userSnap.exists() &&
        userSnap.data().isMarketer === true
      ) {

        await showModal({
          type: "info",
          title: "Already Registered",
          message: "You are already a FundsIQ Marketer.",
          buttonText: "Open Dashboard"
        });

        window.location.href = "marketer-dashboard.html";

        return;
      }


      // GENERATE REFERRAL CODE

      const referralCode = generateReferralCode();

      const referralLink =
        `https://funds7.github.io/FundsIQ/signup.html?ref=${referralCode}`;


      // CREATE REFERRAL PROFILE

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


      // UPDATE USER MARKETER STATUS

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


      await showModal({
        type: "success",
        title: "Congratulations!",
        message: "You are now a FundsIQ Marketer.",
        buttonText: "Continue"
      });


      window.location.href = "marketer-dashboard.html";


    } catch (error) {

      console.error(
        "Marketer registration error:",
        error
      );


      await showModal({
        type: "error",
        title: "Registration Failed",
        message: "Something went wrong while creating your marketer account. Please try again.",
        buttonText: "Continue"
      });


    } finally {

      becomeBtn.disabled = false;
      becomeBtn.textContent = "Become a Marketer";

    }

  });

  }
