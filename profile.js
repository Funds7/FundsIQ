import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";

import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";


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

    profileName.textContent = "Loading...";
    profileEmail.textContent = "";
    profileCoins.textContent = "0";

    const userRef = doc(db, "users", user.uid);

    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {

      const data = userSnap.data();

      profileName.textContent = data.name || "FundsIQ Student";

      profileEmail.textContent = data.email || user.email || "";

      profileCoins.textContent = data.coins ?? 0;

    } else {

      profileName.textContent = "Profile not found";
      profileEmail.textContent = user.email || "";

    }

  } catch (error) {

    console.error("Profile loading error:", error);

    profileName.textContent = "Unable to load profile";
    profileEmail.textContent = "Please check your internet connection.";

  }

});


// LOGOUT FUNCTION

logoutBtn.addEventListener("click", async () => {

  try {

    logoutBtn.disabled = true;
    logoutBtn.textContent = "Logging out...";

    await signOut(auth);

    window.location.replace("login.html");

  } catch (error) {

    console.error("Logout error:", error);

    alert("Unable to log out. Please try again.");

    logoutBtn.disabled = false;
    logoutBtn.textContent = "Logout";

  }

});