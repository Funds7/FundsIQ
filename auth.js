import { auth, db } from "./firebase.js";
import { showModal } from "./modals.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    doc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    increment
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

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
            // FIND REFERRER
            // ==================================

            let referrerUid = null;
            let validReferralCode = "";

            if (referralCode) {

                const usersRef = collection(db, "users");

                const referralQuery = query(
                    usersRef,
                    where("referralCode", "==", referralCode)
                );

                const referralSnapshot = await getDocs(referralQuery);

                if (!referralSnapshot.empty) {

                    const referrerDoc = referralSnapshot.docs[0];

                    if (referrerDoc.id !== user.uid) {
                        referrerUid = referrerDoc.id;
                        validReferralCode = referralCode;
                    }
                }
            }


            // ==================================
            // FIRESTORE TRANSACTION
            // ==================================

            await runTransaction(db, async (transaction) => {

                const newUserRef = doc(db, "users", user.uid);

                // CREATE NEW USER

                transaction.set(newUserRef, {

                    uid: user.uid,
                    name: name,
                    email: email,

                    // WELCOME BONUS
                    coins: 20,

                    role: "student",
                    completedTests: 0,
                    totalScore: 0,
                    studyStreak: 0,

                    // REFERRAL INFORMATION
                    totalReferrals: 0,
                    referredBy: validReferralCode,

                    // PREMIUM / COMMISSION
                    totalEarnings: 0,
                    commissionBalance: 0,
                    premiumReferrals: 0,

                    createdAt: serverTimestamp()

                });


                // REWARD REFERRER

                if (referrerUid) {

                    const referrerRef = doc(db, "users", referrerUid);

                    transaction.update(referrerRef, {

                        coins: increment(10),
                        totalReferrals: increment(1)

                    });


                    // REFERRAL ACTIVITY

                    const activityRef = doc(
                        collection(db, "users", referrerUid, "referrals")
                    );

                    transaction.set(activityRef, {

                        friendName: name,
                        value: "+10 🪙",
                        type: "coin_referral",
                        referredUserId: user.uid,
                        referralCode: validReferralCode,
                        timestamp: serverTimestamp()

                    });

                }

            });


            // ==================================
            // SUCCESS MESSAGE
            // ==================================

            if (referrerUid) {

                await showModal({
                    type: "success",
                    title: "Account Created!",
                    message: "Welcome to FundsIQ! Your account is ready.",
                    details:
                        "You received 20 welcome coins 🪙\n\n" +
                        "Your referral was successfully recorded.\n" +
                        "Your referrer earned 10 coins 🪙",
                    buttonText: "Continue to Login"
                });

            } else {

                await showModal({
                    type: "success",
                    title: "Account Created!",
                    message: "Welcome to FundsIQ! Your account is ready.",
                    details: "You received 20 welcome coins 🪙",
                    buttonText: "Continue to Login"
                });

            }


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
