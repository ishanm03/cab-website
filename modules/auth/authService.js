// modules/auth/authService.js

import { auth } from "../shared/firebase.js";
import { 
    GoogleAuthProvider, 
    signInWithPopup, 
    RecaptchaVerifier, 
    signInWithPhoneNumber,
    signOut,
    signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Global handle to hold the verification confirmationResult for Phone OTP
let confirmationResult = null;

const authService = {
    /**
     * Checks if the app is currently running as a packaged native mobile app
     */
    isNativeApp() {
        return window.Capacitor !== undefined;
    },

    /**
     * Triggers Google Authentication
     * Handles browser popups natively, and provides clear hook points for Capacitor native API
     */
    async loginWithGoogle() {
        if (!auth) throw new Error("Firebase Auth is not initialized.");

        if (this.isNativeApp()) {
            // Placeholder: When wrapping as APK, integrate native Capacitor Google plugin here:
            // e.g. return await CapacitorFirebase.GoogleAuth.signIn();
            console.log("IshanCabs APK: Trigger native Capacitor Google Sign-In");
            throw new Error("Native mobile Google login requires Capacitor native plugins to be compiled.");
        }

        try {
            const provider = new GoogleAuthProvider();
            const result = await signInWithPopup(auth, provider);
            return result.user;
        } catch (error) {
            console.error("IshanCabs: Google Login Error:", error);
            throw error;
        }
    },

    /**
     * Triggers Email & Password Authentication
     * Includes a robust fallback mechanism for PoC admin credentials
     */
    async loginWithEmail(email, password) {
        if (!auth) throw new Error("Firebase Auth is not initialized.");

        // For the PoC Admin credentials: admin@ishancabs.com / admin1234
        if (email.trim() === "admin@ishancabs.com" && password.trim() === "admin1234") {
            console.log("IshanCabs PoC Override: Admin credentials verified successfully.");
            // Store fallback token/session in localStorage to ensure persistence across refreshes
            localStorage.setItem("admin_poc_session", "true");
            return {
                uid: "admin_poc_uid",
                email: "admin@ishancabs.com",
                displayName: "Admin Manager",
                phoneNumber: "+919999999999",
                providerData: [{ providerId: "password" }]
            };
        }

        try {
            const result = await signInWithEmailAndPassword(auth, email, password);
            return result.user;
        } catch (error) {
            console.error("IshanCabs: Email/Password Login Error:", error);
            throw error;
        }
    },

    /**
     * Prepares and initializes the invisible reCAPTCHA verifier for Phone Auth
     * @param {string} containerId - DOM ID of the captcha container div
     */
    initRecaptcha(containerId) {
        if (!auth) throw new Error("Firebase Auth is not initialized.");
        if (this.isNativeApp()) {
            console.log("IshanCabs APK: Initializing native recaptcha.");
        }
        
        return new RecaptchaVerifier(auth, containerId, {
            size: "invisible",
            callback: (response) => {
                console.log("reCAPTCHA solved");
            },
            "expired-callback": () => {
                console.warn("reCAPTCHA expired. Please try again.");
            }
        });
    },

    /**
     * Dispatches an SMS verification code (OTP) to the provided E.164 phone number
     * @param {string} formattedPhone - E.164 phone number (e.g. +91XXXXXXXXXX)
     * @param {object} appVerifier - Initialized RecaptchaVerifier instance
     */
    async sendSmsOtp(formattedPhone, appVerifier) {
        if (!auth) throw new Error("Firebase Auth is not initialized.");

        try {
            confirmationResult = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
            console.log("IshanCabs: Verification SMS dispatched successfully to", formattedPhone);
            return true;
        } catch (error) {
            console.error("IshanCabs: Phone OTP SMS dispatch failed:", error);
            throw error;
        }
    },

    /**
     * Verifies the 6-digit OTP code input by the customer
     * @param {string} code - 6-digit verification code
     */
    async verifySmsOtp(code) {
        if (!confirmationResult) {
            throw new Error("No active verification session found. Request a new OTP.");
        }

        try {
            const result = await confirmationResult.confirm(code);
            console.log("IshanCabs: Phone OTP verification succeeded!");
            return result.user;
        } catch (error) {
            console.error("IshanCabs: OTP Code verification failed:", error);
            throw error;
        }
    },

    /**
     * Logs the customer out of the application
     */
    async logout() {
        localStorage.removeItem("admin_poc_session");
        if (!auth) return;
        try {
            await signOut(auth);
            console.log("IshanCabs: User successfully signed out.");
        } catch (error) {
            console.error("IshanCabs: Error during sign out:", error);
        }
    }
};

export { authService };
