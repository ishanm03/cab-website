// modules/auth/authUI.js

import { authService } from "./authService.js";
import { dbService } from "../shared/dbService.js";
import { utils } from "../shared/utils.js";
import { auth as firebaseAuth } from "../shared/firebase.js";
import { onAuthStateChanged, getRedirectResult } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Element Handles
const tabGoogle = document.getElementById("tab-google");
const tabPhone = document.getElementById("tab-phone");
const panelGoogle = document.getElementById("panel-google");
const panelPhone = document.getElementById("panel-phone");
const btnGoogleLogin = document.getElementById("btn-google-login");

const phoneNumberForm = document.getElementById("phone-number-form");
const phoneInput = document.getElementById("phone-input");
const otpVerificationForm = document.getElementById("otp-verification-form");
const otpInput = document.getElementById("otp-input");
const btnChangeNumber = document.getElementById("btn-change-number");

const profileCompletionPanel = document.getElementById("profile-completion-panel");
const profileCompletionForm = document.getElementById("profile-completion-form");
const profileName = document.getElementById("profile-name");
const profileCity = document.getElementById("profile-city");
const profilePhoneContainer = document.getElementById("profile-phone-container");
const profilePhone = document.getElementById("profile-phone");

const authAlert = document.getElementById("auth-alert");
const authLoader = document.getElementById("auth-loader");
const loaderText = document.getElementById("loader-text");
const authMethodsPanel = document.getElementById("auth-methods-panel");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");

// State Variables
let currentUser = null;
let recaptchaVerifier = null;

// Initialize Event Listeners
document.addEventListener("DOMContentLoaded", () => {
    initUI();
});

function initUI() {
    // 1. Tab Navigation Toggles
    tabGoogle.addEventListener("click", () => {
        toggleTabs("google");
    });
    tabPhone.addEventListener("click", () => {
        toggleTabs("phone");
    });

    // 2. Google Login Action
    btnGoogleLogin.addEventListener("click", handleGoogleLogin);

    // 3. Phone Number Submission
    phoneNumberForm.addEventListener("submit", handlePhoneSubmit);

    // 4. OTP Code Verification
    otpVerificationForm.addEventListener("submit", handleOtpVerify);

    // 5. Change Number Action
    btnChangeNumber.addEventListener("click", () => {
        utils.hideElement(otpVerificationForm);
        utils.showElement(phoneNumberForm);
        utils.hideElement(authAlert);
    });

    // 6. Complete Profile Submission
    profileCompletionForm.addEventListener("submit", handleProfileCompletionSubmit);

    // 7. Track User Authentication State Change & Resolve Redirect results
    if (firebaseAuth) {
        onAuthStateChanged(firebaseAuth, handleAuthStateChange);
        
        // Resolve pending redirect credentials
        getRedirectResult(firebaseAuth)
            .then((result) => {
                if (result) {
                    console.log("IshanCabs: Redirect sign-in succeeded for user:", result.user.uid);
                }
            })
            .catch((error) => {
                console.error("IshanCabs: Redirect sign-in failed:", error);
                utils.showAlert(authAlert, "Authentication failed: " + error.message);
            });
    }
}

// Switches visually between Auth Method Tabs
function toggleTabs(activeTab) {
    utils.hideElement(authAlert);
    if (activeTab === "google") {
        tabGoogle.className = "flex-1 py-3 text-sm font-semibold rounded-xl text-amber-500 bg-slate-900 transition-all duration-300";
        tabPhone.className = "flex-1 py-3 text-sm font-semibold rounded-xl text-slate-400 hover:text-white transition-all duration-300";
        utils.showElement(panelGoogle);
        utils.hideElement(panelPhone);
    } else {
        tabPhone.className = "flex-1 py-3 text-sm font-semibold rounded-xl text-amber-500 bg-slate-900 transition-all duration-300";
        tabGoogle.className = "flex-1 py-3 text-sm font-semibold rounded-xl text-slate-400 hover:text-white transition-all duration-300";
        utils.showElement(panelPhone);
        utils.hideElement(panelGoogle);
    }
}

// Global Loader controls
function showLoader(message) {
    loaderText.textContent = message;
    utils.showElement(authLoader);
    utils.hideElement(authMethodsPanel);
    utils.hideElement(profileCompletionPanel);
    utils.hideElement(authAlert);
}

function hideLoader(showMethods = true) {
    utils.hideElement(authLoader);
    if (showMethods) {
        utils.showElement(authMethodsPanel);
    }
}

// Listener for Firebase State Checks
async function handleAuthStateChange(user) {
    if (user) {
        currentUser = user;
        showLoader("Checking user profile details...");
        try {
            const profile = await dbService.getUserProfile(user.uid);
            if (profile && profile.name && profile.city && profile.phone) {
                // User already completed profile -> redirect back
                utils.showAlert(authAlert, "Successfully logged in! Redirecting...", "success");
                setTimeout(() => {
                    window.location.href = "../../index.html";
                }, 1200);
            } else {
                // First-time user, must capture missing profile info
                hideLoader(false);
                showProfileCompletionPanel(user);
            }
        } catch (error) {
            hideLoader(true);
            utils.showAlert(authAlert, "Failed to load user credentials: " + error.message);
        }
    } else {
        currentUser = null;
        hideLoader(true);
        utils.hideElement(profileCompletionPanel);
    }
}

// Google Login handler
async function handleGoogleLogin() {
    showLoader("Connecting to Google Account...");
    try {
        await authService.loginWithGoogle();
        // The handleAuthStateChange trigger will take care of Firestore checks!
    } catch (error) {
        hideLoader(true);
        utils.showAlert(authAlert, error.message);
    }
}

// SMS OTP transmitter handler
async function handlePhoneSubmit(e) {
    e.preventDefault();
    const phoneVal = phoneInput.value.trim();
    
    if (!utils.validateIndianPhone(phoneVal)) {
        utils.showAlert(authAlert, "Please enter a valid 10-digit Indian phone number.");
        return;
    }

    const formattedPhone = utils.formatE164Phone(phoneVal);
    showLoader("Initiating SMS Dispatch...");

    try {
        // Initialize reCAPTCHA silently on the invisible container
        if (!recaptchaVerifier) {
            recaptchaVerifier = authService.initRecaptcha("recaptcha-container");
        }

        await authService.sendSmsOtp(formattedPhone, recaptchaVerifier);
        
        // Success
        hideLoader(true);
        utils.hideElement(phoneNumberForm);
        utils.showElement(otpVerificationForm);
        utils.showAlert(authAlert, "Verification code sent successfully to " + phoneVal, "success");
    } catch (error) {
        hideLoader(true);
        utils.showAlert(authAlert, "SMS transmission failed: " + error.message);
        if (recaptchaVerifier) {
            recaptchaVerifier.clear();
            recaptchaVerifier = null;
            document.getElementById("recaptcha-container").innerHTML = "";
        }
    }
}

// Verification of code
async function handleOtpVerify(e) {
    e.preventDefault();
    const code = otpInput.value.trim();
    
    if (code.length !== 6 || isNaN(code)) {
        utils.showAlert(authAlert, "Please enter a valid 6-digit OTP code.");
        return;
    }

    showLoader("Verifying code...");
    try {
        await authService.verifySmsOtp(code);
        // The handleAuthStateChange trigger handles profile checks!
    } catch (error) {
        hideLoader(true);
        utils.showAlert(authAlert, "Invalid OTP code: " + error.message);
    }
}

// Opens the secondary form to collect missing profile fields
function showProfileCompletionPanel(user) {
    authTitle.textContent = "Almost Ready";
    authSubtitle.textContent = "Please finalize your rider profile details";
    utils.hideElement(authMethodsPanel);
    utils.showElement(profileCompletionPanel);

    // If signed up via Google, phone is missing -> collect it
    if (user.phoneNumber) {
        // Phone Auth - we already verified phone
        utils.hideElement(profilePhoneContainer);
        profilePhone.required = false;
    } else {
        // Google Auth - collect and confirm phone
        utils.showElement(profilePhoneContainer);
        profilePhone.required = true;
    }
}

// Write details to Firestore Database
async function handleProfileCompletionSubmit(e) {
    e.preventDefault();
    if (!currentUser) {
        utils.showAlert(authAlert, "Session expired. Please log in again.");
        return;
    }

    const name = profileName.value.trim();
    const city = profileCity.value;
    let phone = currentUser.phoneNumber || "";

    // If Google login, read and validate input phone
    if (!phone) {
        const inputPhone = profilePhone.value.trim();
        if (!utils.validateIndianPhone(inputPhone)) {
            utils.showAlert(authAlert, "Please enter a valid 10-digit Indian phone number.");
            return;
        }
        phone = utils.formatE164Phone(inputPhone);
    }

    showLoader("Finalizing your profile details...");

    const profileData = {
        name: name,
        city: city,
        phone: phone,
        email: currentUser.email || null,
        auth_provider: currentUser.providerData[0]?.providerId || "phone"
    };

    try {
        await dbService.saveUserProfile(currentUser.uid, profileData);
        
        utils.hideElement(authLoader);
        utils.showElement(profileCompletionPanel);
        utils.showAlert(authAlert, "Registration successful! Welcome to IshanCabs.", "success");
        
        setTimeout(() => {
            window.location.href = "../../index.html";
        }, 1500);
    } catch (error) {
        hideLoader(false);
        utils.showElement(profileCompletionPanel);
        utils.showAlert(authAlert, "Profile finalization failed: " + error.message);
    }
}
