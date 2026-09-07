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


// Auto-fill referral code from URL
document.addEventListener("DOMContentLoaded", () => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref");

    const referralInput =
        document.getElementById("referralCode");

    if (ref && referralInput) {
        referralInput.value = ref.toUpperCase();
    }
});


// Signup
const signupBtn =
    document.getElementById("signupBtn");

signupBtn.addEventListener("click", async () => {

    const name =
        document.getElementById("name").value.trim();

    const email =
        document.getElementById("email").value.trim();

    const password =
        document.getElementById("password").value;

    const referralCode =
        document
            .getElementById("referralCode")
            .value
            .trim()
            .toUpperCase();


    // Validation
    if (!name || !email || !password) {
        alert("Please fill in all required fields.");
        return;
    }

    if (password.length < 6) {
        alert("Password must be at least 6 characters.");
        return;
    }


    signupBtn.disabled = true;
    signupBtn.textContent = "Creating Account...";


    try {

        // Create Firebase Auth account
        const userCredential =
            await createUserWithEmailAndPassword(
                auth,
                email,
                password
            );

        const user = userCredential.user;


        // Find referrer
        let referrerUid = null;
        let validReferralCode = "";


        if (referralCode) {

            const usersRef =
                collection(db, "users");

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
                await getDocs(referralQuery);


            if (!referralSnapshot.empty) {

                const referrerDoc =
                    referralSnapshot.docs[0];

                // Prevent self-referral
                if (referrerDoc.id !== user.uid) {
                    referrerUid = referrerDoc.id;
                    validReferralCode = referralCode;
                }
            }
        }


        // Firestore transaction
        await runTransaction(
            db,
            async (transaction) => {

                const newUserRef =
                    doc(
                        db,
                        "users",
                        user.uid
                    );


                // Create new user
                transaction.set(
                    newUserRef,
                    {
                        uid: user.uid,

                        name: name,

                        email: email,

                        // Welcome reward
                        coins: 20,

                        role: "student",

                        completedTests: 0,

                        totalScore: 0,

                        studyStreak: 0,

                        // Standard referral field
                        totalReferrals: 0,

                        referredBy:
                            validReferralCode,

                        // Cash earnings
                        totalEarnings: 0,

                        commissionBalance: 0,

                        createdAt:
                            serverTimestamp()
                    }
                );


                // Reward referrer
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
                            // Referral reward
                            coins: increment(20),

                            // Referral count
                            totalReferrals:
                                increment(1)
                        }
                    );


                    // Referral activity
                    const activityRef =
                        doc(
                            collection(
                                db,
                                "users",
                                referrerUid,
                                "referrals"
                            )
                        );


                    transaction.set(
                        activityRef,
                        {
                            friendName: name,

                            value: "+20 🪙",

                            type: "coin_referral",

                            referredUserId:
                                user.uid,

                            timestamp:
                                serverTimestamp()
                        }
                    );
                }
            }
        );


        // Success
        if (referrerUid) {

            alert(
                "🎉 Account created!\n\n" +
                "You received 20 coins 🪙\n\n" +
                "Your referral was successfully recorded!\n\n" +
                "The person who referred you earned 20 coins 🪙"
            );

        } else {

            alert(
                "🎉 Account created!\n\n" +
                "You received 20 coins 🪙"
            );
        }


        // Go to login
        window.location.href = "login.html";


    } catch (error) {

        console.error("Signup error:", error);


        if (
            error.code ===
            "auth/email-already-in-use"
        ) {

            alert("Email already registered.");

        } else if (
            error.code ===
            "auth/weak-password"
        ) {

            alert(
                "Password must be at least 6 characters."
            );

        } else if (
            error.code ===
            "auth/invalid-email"
        ) {

            alert(
                "Please enter a valid email address."
            );

        } else {

            alert(
                "Signup failed: " +
                error.message
            );
        }

    } finally {

        signupBtn.disabled = false;
        signupBtn.textContent = "Create Account";
    }
});
