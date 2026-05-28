// app.js

import { auth } from "./modules/shared/firebase.js";
import { authService } from "./modules/auth/authService.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

document.addEventListener('DOMContentLoaded', function() {
    console.log('IshanCabs app initialized');
    initAuthObserver();
});

// Coordinate Header Login / Logout Button dynamically
function initAuthObserver() {
    const authNavBtn = document.getElementById("auth-nav-btn");
    const authNavText = document.getElementById("auth-nav-text");
    const authNavIcon = document.getElementById("auth-nav-icon");
    const heroBookBtn = document.getElementById("hero-book-btn");

    if (!authNavBtn || !auth || !authService) return;

    let isUserLoggedIn = false;

    // Listen to Firebase Auth state updates
    onAuthStateChanged(auth, (user) => {
        if (user) {
            isUserLoggedIn = true;
            // Update button UI for Logout State
            authNavText.textContent = "Logout";
            authNavBtn.classList.remove("hover:border-amber-400");
            authNavBtn.classList.add("hover:border-rose-500");
            
            // Set SVG to Sign-Out icon
            authNavIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            `;
            authNavIcon.setAttribute("class", "w-4 h-4 text-rose-400");
        } else {
            isUserLoggedIn = false;
            // Update button UI for Login / Sign Up State
            authNavText.textContent = "Rider Login / Sign Up";
            authNavBtn.classList.remove("hover:border-rose-500");
            authNavBtn.classList.add("hover:border-amber-400");
            
            // Set SVG back to default User Icon
            authNavIcon.innerHTML = `
                <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
            `;
            authNavIcon.setAttribute("class", "w-4 h-4 text-amber-400");
        }
    });

    // Intercept clicks on the auth status button
    authNavBtn.addEventListener("click", async (e) => {
        if (isUserLoggedIn) {
            e.preventDefault(); // Stop routing to modules/auth/auth.html
            
            const confirmLogout = confirm("Are you sure you want to log out of IshanCabs?");
            if (confirmLogout) {
                try {
                    await authService.logout();
                    alert("Successfully logged out!");
                } catch (error) {
                    console.error("IshanCabs: Error during header logout:", error);
                    alert("Sign out failed: " + error.message);
                }
            }
        }
    });

    // Intercept clicks on the Book Cab button if logged off
    if (heroBookBtn) {
        heroBookBtn.addEventListener("click", (e) => {
            if (!isUserLoggedIn) {
                e.preventDefault(); // Stop navigating to booking.html
                alert("Please sign up or log in first to book a cab.");
                window.location.href = "./modules/auth/auth.html";
            }
        });
    }
}
