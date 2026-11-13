import { auth } from "./firebase.js";
import { showModal } from "./modals.js";

import {
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";


const loginForm = document.getElementById("loginForm");
const loginBtn = document.querySelector(".login-btn");


loginForm.addEventListener("submit", async (e) => {

    e.preventDefault();

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!email || !password) {

        await showModal({
            type: "warning",
            title: "Missing Information",
            message: "Please enter your email address and password."
        });

        return;
    }

    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";

    try {

        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );

        await showModal({
            type: "success",
            title: "Welcome Back!",
            message: "You have successfully logged into FundsIQ.",
            details: "Taking you to your dashboard...",
            buttonText: "Continue"
        });

        window.location.href = "dashboard.html";

    } catch (error) {

        console.error("Login error:", error);

        let title = "Login Failed";
        let message = "Something went wrong. Please try again.";

        if (
            error.code === "auth/invalid-credential" ||
            error.code === "auth/wrong-password" ||
            error.code === "auth/user-not-found"
        ) {

            title = "Incorrect Details";
            message = "Your email or password is incorrect. Please check and try again.";

        } else if (error.code === "auth/invalid-email") {

            title = "Invalid Email";
            message = "Please enter a valid email address.";

        } else if (error.code === "auth/too-many-requests") {

            title = "Too Many Attempts";
            message = "Too many login attempts. Please wait a little before trying again.";

        } else if (error.code === "auth/network-request-failed") {

            title = "Connection Problem";
            message = "Please check your internet connection and try again.";

        } else {

            message = error.message || message;

        }

        await showModal({
            type: "error",
            title,
            message,
            buttonText: "Try Again"
        });

    } finally {

        loginBtn.disabled = false;
        loginBtn.textContent = "Login";

    }

});