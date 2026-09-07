import { auth, db } from "./firebase.js";

import {
    createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
    doc,
    setDoc,
    serverTimestamp,
    collection,
    query,
    where,
    getDocs,
    runTransaction,
    increment
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


// ==========================================
// AUTO-FILL REFERRAL CODE FROM URL
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    const params =
        new URLSearchParams(window.location.search);

    const ref =
        params.get("ref");

    if (ref) {

        const referralInput =
            document.getElementById("referralCode");

        if (referralInput) {

            referralInput.value =
                ref.toUpperCase();

        }

    }

});


// ==========================================
// SIGNUP
// ==========================================

const signupBtn =
    document.getElementById("signupBtn");


signupBtn.addEventListener("click", async () => {

    const name =
        document
            .getElementById("name")
            .value
            .trim();


    const email =
        document
            .getElementById("email")
            .value
            .trim();


    const password =
        document
            .getElementById("password")
            .value;


    const referralCode =
        document
            .getElementById("referralCode")
            .value
            .trim()
            .toUpperCase();


    // ==========================================
    // VALIDATION
    // ==========================================

    if (!name || !email || !password) {

        alert(
            "Please fill in all required fields."
        );

        return;

    }


    signupBtn.disabled = true;

    signupBtn.textContent =
        "Creating Account...";


    try {

        // ==========================================
        // CREATE FIREBASE AUTH ACCOUNT
        // ==========================================

        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );


        const user =
            userCredential.user;


        // ==========================================
        // FIND REFERRER
        // ==========================================

        let referrerUid = null;

        let validReferralCode = "";


        if (referralCode) {

            const usersRef =
                collection(
                    db,
                    "users"
                );


            const referralQuery =
                query(
                    usersRef,
                    where(
                        "referralCode",
                        "==",
                        referralCode
                    )
                );


            const referralSnapshot =
                await getDocs(
                    referralQuery
                );


            if (
                !referralSnapshot.empty
            ) {

                const referrerDoc =
                    referralSnapshot.docs[0];


                // ----------------------------------
                // PREVENT SELF REFERRAL
                // ----------------------------------

                if (
                    referrerDoc.id !==
                    user.uid
                ) {

                    referrerUid =
                        referrerDoc.id;

                    validReferralCode =
                        referralCode;

                }

            }

        }


        // ==========================================
        // FIRESTORE TRANSACTION
        // ==========================================

        await runTransaction(
            db,
            async (transaction) => {

                // ----------------------------------
                // NEW USER PROFILE
                // ----------------------------------

                const newUserRef =
                    doc(
                        db,
                        "users",
                        user.uid
                    );


                transaction.set(
                    newUserRef,
                    {

                        // --------------------------
                        // BASIC USER INFORMATION
                        // --------------------------

                        uid:
                            user.uid,

                        name:
                            name,

                        email:
                            email,


                        // --------------------------
                        // WELCOME COINS
                        // --------------------------

                        coins:
                            20,


                        // --------------------------
                        // STUDENT INFORMATION
                        // --------------------------

                        role:
                            "student",

                        completedTests:
                            0,

                        totalScore:
                            0,

                        studyStreak:
                            0,


                        // --------------------------
                        // REFERRAL INFORMATION
                        // --------------------------

                        referralCount:
                            0,

                        referredBy:
                            validReferralCode,


                        // --------------------------
                        // CASH EARNINGS
                        // --------------------------
                        //
                        // Premium commissions are
                        // CASH and must NOT be mixed
                        // with coins.
                        //
                        // Example:
                        // Premium purchase = ₦2,000
                        // Commission = ₦400
                        //
                        // That ₦400 will be handled
                        // separately by the Premium
                        // payment system.
                        //

                        totalEarnings:
                            0,

                        commissionBalance:
                            0,


                        // --------------------------
                        // ACCOUNT CREATION
                        // --------------------------

                        createdAt:
                            serverTimestamp()

                    }
                );


                // ==================================
                // REWARD REFERRER
                // ==================================

                if (referrerUid) {

                    const referrerRef =
                        doc(
                            db,
                            "users",
                            referrerUid
                        );


                    transaction.update(
                        referrerRef,
                        {

                            // EVERY successful
                            // referral = 10 coins

                            coins:
                                increment(10),


                            // Increase referral
                            // count by 1

                            referralCount:
                                increment(1)

                        }
                    );

                }

            }
        );


        // ==========================================
        // SUCCESS MESSAGE
        // ==========================================

        if (referrerUid) {

            alert(
                "🎉 Account created!\n\n" +
                "You received 20 coins 🪙\n\n" +
                "Your referral was successfully recorded!\n\n" +
                "The person who referred you earned " +
                "10 coins 🪙"
            );

        } else {

            alert(
                "🎉 Account created!\n\n" +
                "You received 20 coins 🪙"
            );

        }


        // ==========================================
        // GO TO LOGIN
        // ==========================================

        window.location.href =
            "login.html";


    } catch (error) {

        console.error(
            "Signup error:",
            error
        );


        // ==========================================
        // FIREBASE AUTH ERRORS
        // ==========================================

        if (
            error.code ===
            "auth/email-already-in-use"
        ) {

            alert(
                "Email already registered."
            );

        }


        else if (
            error.code ===
            "auth/weak-password"
        ) {

            alert(
                "Password must be at least 6 characters."
            );

        }


        else if (
            error.code ===
            "auth/invalid-email"
        ) {

            alert(
                "Please enter a valid email address."
            );

        }


        else {

            alert(
                "Signup failed: " +
                error.message
            );

        }

    }


    // ==========================================
    // RESTORE BUTTON
    // ==========================================

    signupBtn.disabled = false;

    signupBtn.textContent =
        "Create Account";

});
