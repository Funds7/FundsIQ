import { auth } from "./firebase.js";
import { showModal } from "./modals.js";

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


// BECOME MARKETER — registration is performed by the trusted backend.

const becomeBtn = document.getElementById("become-marketer-btn");

if (becomeBtn) {
  becomeBtn.addEventListener("click", async () => {
    const originalText = becomeBtn.textContent;
    becomeBtn.disabled = true;
    becomeBtn.textContent = "Creating Account...";

    try {
      const user = auth.currentUser;
      if (!user) {
        await showModal({
          type: "warning",
          title: "Login Required",
          message: "Please log in to become a FundsIQ Marketer.",
          buttonText: "Continue"
        });
        return;
      }

      const token = await user.getIdToken();
      const response = await fetch("https://fundsiq-api-staging.onrender.com/api/marketer/register", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({})
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.success !== true) {
        throw new Error(data.msg || data.message || "Registration failed. Please try again.");
      }

      await showModal({
        type: data.alreadyRegistered ? "info" : "success",
        title: data.alreadyRegistered ? "Already Registered" : "Congratulations!",
        message: data.alreadyRegistered
          ? "You are already a FundsIQ Marketer."
          : "You are now a FundsIQ Marketer.",
        buttonText: "Open Dashboard"
      });

      window.location.href = "marketer-dashboard.html";
    } catch (error) {
      console.error("Marketer registration error:", error);
      await showModal({
        type: "error",
        title: "Registration Failed",
        message: error.message || "Something went wrong. Please try again.",
        buttonText: "Continue"
      });
    } finally {
      becomeBtn.disabled = false;
      becomeBtn.textContent = originalText || "Become a Marketer";
    }
  });
}
