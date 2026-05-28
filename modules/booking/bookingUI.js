// modules/booking/bookingUI.js

import { auth } from "../shared/firebase.js";
import { dbService } from "../shared/dbService.js";
import { utils } from "../shared/utils.js";
import { routesMatrix, getPickupLocations, getDropDestinations, getRouteMetrics } from "../shared/routesMatrix.js";
import { bookingService } from "./bookingService.js";
import { authService } from "../auth/authService.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// DOM Selector Handles
const riderWelcome = document.getElementById("rider-welcome");
const btnRiderLogout = document.getElementById("btn-rider-logout");

const bookingProgressBar = document.getElementById("booking-progress-bar");
const stepDot1 = document.getElementById("step-dot-1");
const stepDot2 = document.getElementById("step-dot-2");
const stepDot3 = document.getElementById("step-dot-3");
const stepText1 = document.getElementById("step-text-1");
const stepText2 = document.getElementById("step-text-2");
const stepText3 = document.getElementById("step-text-3");

const bookingAlert = document.getElementById("booking-alert");
const bookingLoader = document.getElementById("booking-loader");
const bookingLoaderText = document.getElementById("booking-loader-text");

// Panels
const panelStep1 = document.getElementById("panel-step-1");
const panelStep2 = document.getElementById("panel-step-2");
const panelStep3 = document.getElementById("panel-step-3");

// Step 1 Form elements
const formStep1 = document.getElementById("form-step-1");
const pickupSelect = document.getElementById("pickup-select");
const dropSelect = document.getElementById("drop-select");
const pickupDate = document.getElementById("pickup-date");
const pickupTime = document.getElementById("pickup-time");
const categoryRadios = document.getElementsByName("ride-category");
const outstationDaysContainer = document.getElementById("outstation-days-container");
const outstationDaysInput = document.getElementById("outstation-days");

// Step 2 elements
const routeKmBadge = document.getElementById("route-km-badge");
const fleetListContainer = document.getElementById("fleet-list-container");
const carCards = document.querySelectorAll(".car-card");
const btnBackTo1 = document.getElementById("btn-back-to-1");
const btnSubmitStep2 = document.getElementById("btn-submit-step-2");

// Step 3 elements
const summaryPickup = document.getElementById("summary-pickup");
const summaryDrop = document.getElementById("summary-drop");
const summaryDatetime = document.getElementById("summary-datetime");
const summaryCategory = document.getElementById("summary-category");
const summaryDaysRow = document.getElementById("summary-days-row");
const summaryDays = document.getElementById("summary-days");
const summaryTier = document.getElementById("summary-tier");
const summaryGrandTotal = document.getElementById("summary-grand-total");
const btnBackTo2 = document.getElementById("btn-back-to-2");
const btnConfirmBooking = document.getElementById("btn-confirm-booking");

// Active Session Context State Variables
let currentUser = null;
let currentProfile = null;
let currentRouteData = {
    pickup: "",
    drop: "",
    dateString: "",
    timeString: "",
    category: "",
    days: 1,
    km: 0,
    flatMetrics: null
};
let selectedVehicleTier = null;
let selectedVehicleFare = 0;

// Initialize setup listeners
document.addEventListener("DOMContentLoaded", () => {
    initBookingUI();
});

function initBookingUI() {
    // 1. Session State Observer
    if (auth) {
        onAuthStateChanged(auth, handleUserSessionChange);
    }
    
    // 2. Logout trigger
    btnRiderLogout.addEventListener("click", handleLogout);

    // 3. Hydrate routes and time dropdowns
    hydratePickupLocations();
    populateTimeDropdown();

    // 4. Change pickups and populate drop options
    pickupSelect.addEventListener("change", handlePickupChange);

    // 5. Ride Category change to show/hide days selector
    categoryRadios.forEach(radio => {
        radio.addEventListener("change", handleCategoryChange);
    });

    // 6. Set calendar date restrictions (Lead Time Constraints) and trigger overlay on focus/click
    restrictDateInputs();
    setupDatepickerTrigger();

    // 7. Form Step 1 Submission
    formStep1.addEventListener("submit", handleStep1Submit);

    // 8. Vehicle Car Card Click handler
    setupCarSelection();

    // 9. Back buttons
    btnBackTo1.addEventListener("click", navigateBackTo1);
    btnBackTo2.addEventListener("click", navigateBackTo2);

    // 10. Step 2 click checkout trigger
    btnSubmitStep2.addEventListener("click", navigateToStep3);

    // 11. Final Confirm booking & WhatsApp redirect
    btnConfirmBooking.addEventListener("click", handleFinalConfirm);
}

// Redirect unauthenticated sessions
async function handleUserSessionChange(user) {
    if (user) {
        currentUser = user;
        try {
            const profile = await dbService.getUserProfile(user.uid);
            if (profile) {
                currentProfile = profile;
                riderWelcome.textContent = `Welcome, ${profile.name || "Rider"}`;
                utils.showElement(riderWelcome);
            } else {
                // Authed but lacks a profile entry -> redirect to register form
                window.location.href = "../auth/auth.html";
            }
        } catch (error) {
            console.error("Failed to read user profile:", error);
            riderWelcome.textContent = "Welcome, Rider";
            utils.showElement(riderWelcome);
        }
    } else {
        currentUser = null;
        currentProfile = null;
        // User not logged in -> redirect back to login page
        window.location.href = "../auth/auth.html";
    }
}

// Header Log-off handler
async function handleLogout() {
    const confirmSignout = confirm("Are you sure you want to log out?");
    if (confirmSignout) {
        await authService.logout();
    }
}

// Hydrates select with available locations
function hydratePickupLocations() {
    pickupSelect.innerHTML = `<option value="" disabled selected>Select Pickup Node</option>`;
    const pickups = getPickupLocations();
    pickups.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc;
        opt.textContent = loc;
        pickupSelect.appendChild(opt);
    });
}

// Repopulates Dropdown options based on active Pickup choice
function handlePickupChange() {
    utils.hideElement(bookingAlert);
    const pickupVal = pickupSelect.value;
    
    // Clear and enable drop dropdown
    dropSelect.innerHTML = `<option value="" disabled selected>Select Destination</option>`;
    dropSelect.disabled = false;
    dropSelect.className = "w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-white px-4 py-4 rounded-2xl outline-none transition-all duration-300 font-medium appearance-none";

    const drops = getDropDestinations(pickupVal);
    drops.forEach(dest => {
        const opt = document.createElement("option");
        opt.value = dest;
        opt.textContent = dest;
        dropSelect.appendChild(opt);
    });
}

// Shows/Hides outstation days
function handleCategoryChange(e) {
    utils.hideElement(bookingAlert);
    const category = e.target.value;
    if (category === "outstation") {
        utils.showElement(outstationDaysContainer);
        outstationDaysInput.required = true;
    } else {
        utils.hideElement(outstationDaysContainer);
        outstationDaysInput.required = false;
        outstationDaysInput.value = 1;
    }
}

// Restricts calendar inputs to require minimum 2 hours lead scheduling time
function restrictDateInputs() {
    const today = new Date();
    // Enforce tomorrow if time boundaries are met, or set minimum to today
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    pickupDate.min = `${yyyy}-${mm}-${dd}`;
}

// Populate the pickup time select dropdown with 30-minute intervals
function populateTimeDropdown() {
    if (!pickupTime) return;
    pickupTime.innerHTML = `<option value="" disabled selected>Select Pickup Time</option>`;
    
    for (let hour = 0; hour < 24; hour++) {
        for (let min of [0, 30]) {
            const h24 = String(hour).padStart(2, '0');
            const m = String(min).padStart(2, '0');
            const timeVal = `${h24}:${m}`;
            
            // Format 12-hour display string
            const period = hour >= 12 ? "PM" : "AM";
            const h12 = hour % 12 === 0 ? 12 : hour % 12;
            const displayTime = `${h12}:${m} ${period}`;
            
            const opt = document.createElement("option");
            opt.value = timeVal;
            opt.textContent = displayTime;
            pickupTime.appendChild(opt);
        }
    }
}

// Binds native calendar overlay trigger on input click & focus for extreme reliability
function setupDatepickerTrigger() {
    if (!pickupDate) return;
    
    const triggerPicker = () => {
        try {
            pickupDate.showPicker();
        } catch (e) {
            console.warn("showPicker not supported on this browser:", e);
        }
    };
    
    pickupDate.addEventListener("click", triggerPicker);
    pickupDate.addEventListener("focus", triggerPicker);
}

// Global loader controllers
function showLoader(msg) {
    bookingLoaderText.textContent = msg;
    utils.showElement(bookingLoader);
    utils.hideElement(panelStep1);
    utils.hideElement(panelStep2);
    utils.hideElement(panelStep3);
    utils.hideElement(bookingAlert);
}

function hideLoader(targetPanel) {
    utils.hideElement(bookingLoader);
    utils.showElement(targetPanel);
}

// Form Step 1 Submission: pricing calculations and overbooking verification
async function handleStep1Submit(e) {
    e.preventDefault();
    utils.hideElement(bookingAlert);

    const pickup = pickupSelect.value;
    const drop = dropSelect.value;
    const dateVal = pickupDate.value;
    const timeVal = pickupTime.value;
    const category = document.querySelector('input[name="ride-category"]:checked').value;
    const days = parseInt(outstationDaysInput.value) || 1;

    // Validate 2-hour scheduling constraint
    const now = new Date();
    const selectedDatetime = new Date(`${dateVal}T${timeVal}`);
    const timeDifferenceMs = selectedDatetime - now;
    const timeDifferenceHours = timeDifferenceMs / (1000 * 60 * 60);

    if (timeDifferenceHours < 2) {
        utils.showAlert(bookingAlert, "Scheduling Warning: All rides must be booked at least 2 hours in advance.");
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
    }

    showLoader("Querying fleet inventory & calculating rates...");

    // Retrieve distance and base flat rates from Routes Matrix
    const metrics = getRouteMetrics(pickup, drop);
    if (!metrics) {
        hideLoader(panelStep1);
        utils.showAlert(bookingAlert, "Selected route configuration is invalid.");
        return;
    }

    // Save configuration parameters globally
    currentRouteData = {
        pickup: pickup,
        drop: drop,
        dateString: dateVal,
        timeString: timeVal,
        category: category,
        days: days,
        km: metrics.km,
        flatMetrics: metrics
    };

    // Update Step 2 badge distance total
    routeKmBadge.textContent = `Estimated: ${metrics.km} km`;

    // Process rates and time-aware inventory availability check for each category (Sedan, SUV, MUV)
    try {
        const tiers = ["sedan", "suv", "muv"];
        
        for (const tier of tiers) {
            const card = document.querySelector(`.car-card[data-tier="${tier}"]`);
            const fareDisplay = card.querySelector(".car-fare-display");
            const soldOutOverlay = card.querySelector(".sold-out-overlay");

            // 1. Calculate fare dynamically
            const fare = bookingService.calculateFare(category, metrics.km, days, tier, metrics);
            fareDisplay.textContent = `₹${fare.toLocaleString("en-IN")}`;
            card.dataset.computedFare = fare;

            // 2. Overbooking inventory check
            const isAvailable = await bookingService.checkAvailability(tier, dateVal);
            
            if (isAvailable) {
                utils.hideElement(soldOutOverlay);
                card.classList.remove("opacity-40", "pointer-events-none");
            } else {
                utils.showElement(soldOutOverlay);
                card.classList.add("opacity-40", "pointer-events-none");
                card.classList.remove("selected-card");
            }
        }

        // Navigate visual steps to Step 2
        hideLoader(panelStep2);
        updateProgressSteps(2);
    } catch (err) {
        hideLoader(panelStep1);
        utils.showAlert(bookingAlert, "Error fetching rates: " + err.message);
    }
}

// Binds clicks to the vehicle selection cards
function setupCarSelection() {
    carCards.forEach(card => {
        card.addEventListener("click", () => {
            // Prevent clicks on inactive/sold-out cards
            if (card.classList.contains("pointer-events-none")) return;

            // Remove highlighted states from other cards
            carCards.forEach(c => c.classList.remove("selected-card"));
            
            // Add highlighted active state to selected card
            card.classList.add("selected-card");

            selectedVehicleTier = card.dataset.tier;
            selectedVehicleFare = parseInt(card.dataset.computedFare) || 0;

            // Enable submit step button
            btnSubmitStep2.disabled = false;
        });
    });
}

// Progress Dot state coordinators
function updateProgressSteps(step) {
    if (step === 1) {
        bookingProgressBar.style.width = "0%";
        
        stepDot2.className = "w-8 h-8 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center text-sm shadow-md transition-all duration-300";
        stepText2.className = "text-xs font-semibold text-slate-500 mt-2";
        
        stepDot3.className = "w-8 h-8 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center text-sm shadow-md transition-all duration-300";
        stepText3.className = "text-xs font-semibold text-slate-500 mt-2";
    } 
    else if (step === 2) {
        bookingProgressBar.style.width = "50%";
        
        stepDot2.className = "w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md transition-all duration-300 ring-4 ring-amber-500/20";
        stepText2.className = "text-xs font-semibold text-amber-500 mt-2";
        
        stepDot3.className = "w-8 h-8 rounded-full bg-slate-800 text-slate-400 font-bold flex items-center justify-center text-sm shadow-md transition-all duration-300";
        stepText3.className = "text-xs font-semibold text-slate-500 mt-2";
    } 
    else if (step === 3) {
        bookingProgressBar.style.width = "100%";
        
        stepDot2.className = "w-8 h-8 rounded-full bg-amber-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md transition-all duration-300 ring-4 ring-amber-500/20";
        stepText2.className = "text-xs font-semibold text-amber-500 mt-2";
        
        stepDot3.className = "w-8 h-8 rounded-full bg-emerald-500 text-slate-950 font-bold flex items-center justify-center text-sm shadow-md transition-all duration-300 ring-4 ring-emerald-500/20";
        stepText3.className = "text-xs font-semibold text-emerald-500 mt-2";
    }
}

// Navigates backwards
function navigateBackTo1() {
    utils.hideElement(bookingAlert);
    utils.hideElement(panelStep2);
    utils.showElement(panelStep1);
    updateProgressSteps(1);
    // Reset selection triggers
    btnSubmitStep2.disabled = true;
    carCards.forEach(c => c.classList.remove("selected-card"));
}

function navigateBackTo2() {
    utils.hideElement(bookingAlert);
    utils.hideElement(panelStep3);
    utils.showElement(panelStep2);
    updateProgressSteps(2);
}

// Switches from Step 2 to checkout summary panel (Step 3)
function navigateToStep3() {
    if (!selectedVehicleTier) return;
    utils.hideElement(bookingAlert);

    // Populate billing values
    summaryPickup.textContent = currentRouteData.pickup;
    summaryDrop.textContent = currentRouteData.drop;
    summaryDatetime.textContent = `${currentRouteData.dateString} at ${currentRouteData.timeString}`;
    summaryCategory.textContent = currentRouteData.category.charAt(0).toUpperCase() + currentRouteData.category.slice(1);
    summaryTier.textContent = selectedVehicleTier.toUpperCase();
    summaryGrandTotal.textContent = `₹${selectedVehicleFare.toLocaleString("en-IN")}`;

    if (currentRouteData.category === "outstation") {
        summaryDays.textContent = `${currentRouteData.days} Day(s)`;
        utils.showElement(summaryDaysRow);
    } else {
        utils.hideElement(summaryDaysRow);
    }

    utils.hideElement(panelStep2);
    utils.showElement(panelStep3);
    updateProgressSteps(3);
}

// Final execution loop (saves to Firestore, then opens WhatsApp redirect window)
async function handleFinalConfirm() {
    if (!currentUser || !currentProfile) {
        utils.showAlert(bookingAlert, "Your session has expired. Please reload and log in again.");
        return;
    }

    showLoader("Registering booking & compiling invoice details...");

    const bookingPayload = {
        customer_id: currentUser.uid,
        customer_details: {
            name: currentProfile.name || "Rider",
            phone: currentProfile.phone || ""
        },
        trip_details: {
            ride_type: currentRouteData.category,
            pickup_location: currentRouteData.pickup,
            drop_location: currentRouteData.drop,
            pickup_date: currentRouteData.dateString,
            pickup_time: currentRouteData.timeString,
            outstation_days: currentRouteData.category === "outstation" ? currentRouteData.days : null
        },
        fare_details: {
            vehicle_tier: selectedVehicleTier,
            estimated_km: currentRouteData.km,
            estimated_fare: selectedVehicleFare
        }
    };

    try {
        // 1. Commit record to Cloud Firestore DB
        const bookingId = await bookingService.createBooking(bookingPayload);
        bookingPayload.booking_id = bookingId;

        // 2. Compile pre-filled WhatsApp API trigger
        const redirectUrl = bookingService.compileWhatsAppLink(bookingPayload);

        // Success Alert and redirection
        utils.hideElement(bookingLoader);
        utils.showElement(panelStep3);
        utils.showAlert(bookingAlert, "Booking successful! Redirecting to WhatsApp...", "success");

        // 3. Open WhatsApp trigger in a new browser tab
        window.open(redirectUrl, "_blank");

        // 4. Smoothly route rider back to primary homepage landing
        setTimeout(() => {
            window.location.href = "../../index.html";
        }, 1800);
    } catch (error) {
        hideLoader(panelStep3);
        utils.showAlert(bookingAlert, "Booking transaction failed: " + error.message);
    }
}
