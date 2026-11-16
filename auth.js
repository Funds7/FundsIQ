import { auth } from "./firebase.js";
import { showModal } from "./modals.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

const API_URL = "https://fundsiq-api-staging.onrender.com";

"use strict";


// ==========================================
// AUTO-FILL REFERRAL CODE FROM URL
// ==========================================

document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");
    const referralInput = document.getElementById("referralCode");

    if (ref && referralInput) {
        referralInput.value = ref.trim().toUpperCase();
    }
});


// ==========================================
// SIGNUP
// ==========================================

const signupBtn = document.getElementById("signupBtn");

if (signupBtn) {

    signupBtn.addEventListener("click", async () => {

        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim().toLowerCase();
        const password = document.getElementById("password").value;

        const referralCode = document
            .getElementById("referralCode")
            .value.trim()
            .toUpperCase();


        // ======================================
        // VALIDATION
        // ======================================

        if (!name || !email || !password) {
            await showModal({
                type: "warning",
                title: "Missing Information",
                message: "Please fill in all required fields."
            });
            return;
        }

        if (password.length < 6) {
            await showModal({
                type: "warning",
                title: "Password Too Short",
                message: "Your password must be at least 6 characters."
            });
            return;
        }


        signupBtn.disabled = true;
        signupBtn.textContent = "Creating Account...";


        try {

            // ==================================
            // CREATE FIREBASE AUTH ACCOUNT
            // ==================================

            const userCredential =
                await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

            const user = userCredential.user;


            // ==================================
            // CREATE PROFILE AND ISSUE COINS SECURELY
            // ==================================

            const idToken = await user.getIdToken(true);
            const profileResponse = await fetch(
                `${API_URL}/api/auth/profile/initialize`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${idToken}`
                    },
                    body: JSON.stringify({
                        name,
                        referralCode
                    })
                }
            );

            const profileData = await profileResponse.json();

            if (!profileResponse.ok || profileData.success !== true) {
                throw new Error(
                    profileData.msg || "Your FundsIQ profile could not be created."
                );
            }

            await showModal({
                type: "success",
                title: "Account Created!",
                message: "Welcome to FundsIQ! Your account is ready.",
                details: profileData.referralApplied
                    ? "You received 20 welcome coins 🪙\n\nYour referral was successfully recorded. Your referrer earned 10 coins 🪙"
                    : "You received 20 welcome coins 🪙",
                buttonText: "Continue to Login"
            });


            // ==================================
            // GO TO LOGIN
            // ==================================

            window.location.href = "login.html";


        } catch (error) {

            console.error("Signup error:", error);

            // FIREBASE ERROR HANDLING

            if (error.code === "auth/email-already-in-use") {

                await showModal({
                    type: "error",
                    title: "Email Already Registered",
                    message: "An account already exists with this email address."
                });

            } else if (error.code === "auth/weak-password") {

                await showModal({
                    type: "error",
                    title: "Weak Password",
                    message: "Please use a password with at least 6 characters."
                });

            } else if (error.code === "auth/invalid-email") {

                await showModal({
                    type: "error",
                    title: "Invalid Email",
                    message: "Please enter a valid email address."
                });

            } else {

                await showModal({
                    type: "error",
                    title: "Signup Failed",
                    message: error.message || "Something went wrong. Please try again."
                });

            }

        } finally {

            signupBtn.disabled = false;
            signupBtn.textContent = "Create Account";

        }

    });

    }
