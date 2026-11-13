import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

import { showModal } from "./modals.js";


// PROFILE ELEMENTS

const profileName = document.getElementById("profileName");
const profileEmail = document.getElementById("profileEmail");
const profileCoins = document.getElementById("profileCoins");
const logoutBtn = document.getElementById("logoutBtn");


// AUTHENTICATION CHECK

onAuthStateChanged(auth, async (user) => {

  if (!user) {
    window.location.replace("login.html");
    return;
  }

  try {

    if (profileName) profileName.textContent = "Loading...";
    if (profileEmail) profileEmail.textContent = "";
    if (profileCoins) profileCoins.textContent = "0";

    const userRef = doc(db, "users", user.uid);

    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {

      const data = userSnap.data();

      if (profileName) {
        profileName.textContent = data.name || "FundsIQ Student";
      }

      if (profileEmail) {
        profileEmail.textContent = data.email || user.email || "";
      }

      if (profileCoins) {
        profileCoins.textContent = data.coins ?? 0;
      }

    } else {

      if (profileName) {
        profileName.textContent = "Profile not found";
      }

      if (profileEmail) {
        profileEmail.textContent = user.email || "";
      }

    }

  } catch (error) {

    console.error("Profile loading error:", error);

    if (profileName) {
      profileName.textContent = "Unable to load profile";
    }

    if (profileEmail) {
      profileEmail.textContent = "Please check your internet connection.";
    }

  }

});


// LOGOUT FUNCTION

if (logoutBtn) {

  logoutBtn.addEventListener("click", async () => {

    try {

      logoutBtn.disabled = true;
      logoutBtn.textContent = "Logging out...";

      await signOut(auth);

      window.location.replace("login.html");

    } catch (error) {

      console.error("Logout error:", error);

      await showModal({
        type: "error",
        title: "Logout Failed",
        message: "Unable to log out. Please try again.",
        buttonText: "Continue"
      });

      logoutBtn.disabled = false;
      logoutBtn.textContent = "Logout";

    }

  });

}
