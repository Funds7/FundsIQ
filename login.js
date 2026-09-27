import { auth } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    signOut
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";


const loginForm = document.getElementById("loginForm");
const loginBtn = document.querySelector(".login-btn");


loginForm.addEventListener("submit", async (e)=>{


    e.preventDefault();


    const email =
    document.getElementById("email").value.trim();


    const password =
    document.getElementById("password").value;



    loginBtn.disabled = true;
    loginBtn.textContent = "Logging in...";



    try {


        const result =
        await signInWithEmailAndPassword(
            auth,
            email,
            password
        );


        const user = result.user;



        // Remove this section temporarily for testing
        /*
        if(!user.emailVerified){

            await signOut(auth);

            alert(
            "Please verify your email first."
            );

            loginBtn.disabled = false;
            loginBtn.textContent="Login";

            return;
        }
        */


        alert("Login successful 🎉");


        window.location.href="dashboard.html";



    } catch(error){


        console.log(error);


        if(error.code === "auth/invalid-credential"){

            alert(
            "Incorrect email or password."
            );

        }
        else{

            alert(error.message);

        }


    }


    loginBtn.disabled = false;
    loginBtn.textContent="Login";


});
