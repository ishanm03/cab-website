// modules/booking/bookingUI.js

import { auth, db } from "../shared/firebase.js";
import { dbService } from "../shared/dbService.js";
import { utils } from "../shared/utils.js";
import { routesMatrix, getRouteMetrics, terminalCoordinates } from "../shared/routesMatrix.js";
import { bookingService } from "./bookingService.js?v=20260603";
import { authService } from "../auth/authService.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    orderBy 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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
const rentalHoursContainer = document.getElementById("rental-hours-container");
const rentalHoursSelect = document.getElementById("rental-hours");

// Custom Address inputs
const customPickupContainer = document.getElementById("custom-pickup-container");
const customPickupAddress = document.getElementById("custom-pickup-address");
const customDropContainer = document.getElementById("custom-drop-container");
const customDropAddress = document.getElementById("custom-drop-address");
const customFareNotice = document.getElementById("custom-fare-notice");

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
const summaryBaseFare = document.getElementById("summary-base-fare");
const summaryDiscountRow = document.getElementById("summary-discount-row");
const summaryPromoCodeName = document.getElementById("summary-promo-code-name");
const summaryDiscountAmount = document.getElementById("summary-discount-amount");
const promoCodeInput = document.getElementById("promo-code-input");
const btnApplyPromo = document.getElementById("btn-apply-promo");
const promoStatusMsg = document.getElementById("promo-status-msg");
const availableOffersContainer = document.getElementById("available-offers-container");
const offersChipsList = document.getElementById("offers-chips-list");
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
    flatMetrics: null,
    pickupCoords: null,
    dropCoords: null,
    polyline: null
};
let selectedVehicleTier = null;
let selectedVehicleFare = 0; // Represents base fare before discounts
let appliedPromo = null; // { code: string, discount: number }
let activeRatesVersionId = null; // Tracks rates_history document for auditing

// Map & Geocoding State Variables
const bookingMapWrapper = document.getElementById("booking-map-wrapper");

let mapInstance = null;
let pickupMarker = null;
let dropMarker = null;
let mapPickupCoords = null; // [lat, lng]
let mapDropCoords = null;   // [lat, lng]
let mapPickupAddress = "";
let mapDropAddress = "";

let dbLocations = []; // Loaded dynamically from Firestore

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

    // 3. Hydrate routes and time dropdowns dynamically from database
    loadDynamicLocations();
    populateTimeDropdown();

    // 4. Change pickups and populate drop options
    pickupSelect.addEventListener("change", handlePickupChange);
    dropSelect.addEventListener("change", handleDropChange);

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

    // 12. Apply Promo Code
    btnApplyPromo.addEventListener("click", handleApplyPromo);
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

// Loads predefined locations from Firestore
async function loadDynamicLocations() {
    try {
        if (!db) throw new Error("Firestore not initialized.");
        const snap = await getDocs(query(collection(db, "locations"), orderBy("name")));
        dbLocations = snap.docs.map(doc => doc.data());
        console.log(`Loaded ${dbLocations.length} predefined locations from Firestore.`);
        hydratePickupLocations();
    } catch (error) {
        console.error("Failed to load locations, using fallback coordinates:", error);
        dbLocations = Object.entries(terminalCoordinates).map(([name, coords]) => ({
            id: name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, ""),
            name: name,
            lat: coords[0],
            lng: coords[1],
            type: "both"
        }));
        hydratePickupLocations();
    }
}

// Hydrates select with available locations
function hydratePickupLocations() {
    pickupSelect.innerHTML = `<option value="" disabled selected>Select Pickup Node</option>
                              <option value="Custom Location">Custom Location</option>`;
    const pickups = dbLocations.filter(loc => loc.type === "pickup" || loc.type === "both");
    pickups.forEach(loc => {
        const opt = document.createElement("option");
        opt.value = loc.name;
        opt.textContent = loc.name;
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

    // Add Custom Location choice
    const customOpt = document.createElement("option");
    customOpt.value = "Custom Location";
    customOpt.textContent = "Custom Location";
    dropSelect.appendChild(customOpt);

    let drops = [];
    if (pickupVal === "Custom Location") {
        drops = dbLocations.filter(loc => loc.type === "drop" || loc.type === "both");
    } else {
        drops = dbLocations.filter(loc => (loc.type === "drop" || loc.type === "both") && loc.name !== pickupVal);
    }
    drops.forEach(dest => {
        const opt = document.createElement("option");
        opt.value = dest.name;
        opt.textContent = dest.name;
        dropSelect.appendChild(opt);
    });

    toggleCustomAddressFields();
    toggleMapVisibility();
}

function handleDropChange() {
    utils.hideElement(bookingAlert);
    toggleCustomAddressFields();
    toggleMapVisibility();
}

function toggleCustomAddressFields() {
    const isPickupCustom = pickupSelect.value === "Custom Location";
    const isDropCustom = dropSelect.value === "Custom Location";
    const category = document.querySelector('input[name="ride-category"]:checked')?.value || "local";

    if (isPickupCustom) {
        utils.showElement(customPickupContainer);
        customPickupAddress.required = true;
    } else {
        utils.hideElement(customPickupContainer);
        customPickupAddress.required = false;
        customPickupAddress.value = "";
    }

    if (isDropCustom && category !== "rental") {
        utils.showElement(customDropContainer);
        customDropAddress.required = true;
    } else {
        utils.hideElement(customDropContainer);
        customDropAddress.required = false;
        customDropAddress.value = "";
    }
}

function toggleMapVisibility() {
    const pickupVal = pickupSelect.value;
    const dropVal = dropSelect.value;
    const category = document.querySelector('input[name="ride-category"]:checked')?.value || "local";

    const isPickupPredefined = pickupVal && pickupVal !== "Custom Location";
    const isDropPredefined = dropVal && dropVal !== "Custom Location";

    if (category === "rental" && isPickupPredefined) {
        utils.showElement(bookingMapWrapper);
        initOrUpdateMap();
    } else if (category !== "rental" && isPickupPredefined && isDropPredefined) {
        utils.showElement(bookingMapWrapper);
        initOrUpdateMap();
    } else {
        utils.hideElement(bookingMapWrapper);
    }
}

function initOrUpdateMap() {
    const kolkataCenter = [22.5726, 88.3639];

    if (!mapInstance) {
        // Initialize Leaflet map as read-only preview
        mapInstance = L.map('booking-map', {
            dragging: false,
            touchZoom: false,
            scrollWheelZoom: false,
            doubleClickZoom: false,
            boxZoom: false,
            keyboard: false,
            zoomControl: true
        }).setView(kolkataCenter, 12);
        
        // Add OpenStreetMap Standard tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(mapInstance);
    }

    const pickupVal = pickupSelect.value;
    const dropVal = dropSelect.value;
    const category = document.querySelector('input[name="ride-category"]:checked')?.value || "local";

    // Find predefined coordinates in dbLocations
    const pickupLoc = dbLocations.find(l => l.name === pickupVal);
    mapPickupCoords = pickupLoc ? [pickupLoc.lat, pickupLoc.lng] : null;
    mapPickupAddress = pickupVal || "";

    const dropLoc = dbLocations.find(l => l.name === dropVal);
    mapDropCoords = (category !== "rental" && dropLoc) ? [dropLoc.lat, dropLoc.lng] : null;
    mapDropAddress = dropVal || "";

    // Draw/update Pickup Marker
    if (mapPickupCoords) {
        if (pickupMarker) {
            pickupMarker.setLatLng(mapPickupCoords);
        } else {
            pickupMarker = L.marker(mapPickupCoords, {
                title: "Pickup Location"
            }).addTo(mapInstance);
        }
        updateMarkerPopup(pickupMarker, "Pickup: " + mapPickupAddress);
    } else {
        if (pickupMarker) {
            mapInstance.removeLayer(pickupMarker);
            pickupMarker = null;
        }
    }

    // Draw/update Drop Marker
    if (mapDropCoords) {
        if (dropMarker) {
            dropMarker.setLatLng(mapDropCoords);
        } else {
            dropMarker = L.marker(mapDropCoords, {
                title: "Drop Location"
            }).addTo(mapInstance);
        }
        updateMarkerPopup(dropMarker, "Drop: " + mapDropAddress);
    } else {
        if (dropMarker) {
            mapInstance.removeLayer(dropMarker);
            dropMarker = null;
        }
    }

    // Draw/update polyline if both are present
    if (mapPickupCoords && mapDropCoords) {
        fetchOSRMRoute(mapPickupCoords, mapDropCoords).then(routeData => {
            const coords = routeData.geometry.coordinates;
            const polylinePoints = coords.map(coord => [coord[1], coord[0]]);
            
            if (window.bookingPolyline) {
                mapInstance.removeLayer(window.bookingPolyline);
            }
            window.bookingPolyline = L.polyline(polylinePoints, { color: '#f59e0b', weight: 4, opacity: 0.8 }).addTo(mapInstance);
            
            const group = new L.featureGroup([pickupMarker, dropMarker]);
            mapInstance.fitBounds(group.getBounds().pad(0.15));
        }).catch(err => {
            console.warn("OSRM route fetch failed for preview:", err);
            // Draw straight line fallback
            if (window.bookingPolyline) {
                mapInstance.removeLayer(window.bookingPolyline);
            }
            window.bookingPolyline = L.polyline([mapPickupCoords, mapDropCoords], { color: '#f59e0b', weight: 3, opacity: 0.8, dashArray: '5, 5' }).addTo(mapInstance);
            const group = new L.featureGroup([pickupMarker, dropMarker]);
            mapInstance.fitBounds(group.getBounds().pad(0.15));
        });
    } else {
        if (window.bookingPolyline) {
            mapInstance.removeLayer(window.bookingPolyline);
            window.bookingPolyline = null;
        }
        if (mapPickupCoords) {
            mapInstance.setView(mapPickupCoords, 14);
        }
    }

    // Adjust view size
    setTimeout(() => {
        if (mapInstance) {
            mapInstance.invalidateSize();
        }
    }, 100);
}

function updateMarkerPopup(marker, text) {
    if (!marker) return;
    marker.bindPopup(text).openPopup();
}

async function fetchOSRMRoute(pickupCoords, dropCoords) {
    const pickupLng = pickupCoords[1];
    const pickupLat = pickupCoords[0];
    const dropLng = dropCoords[1];
    const dropLat = dropCoords[0];

    const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropLng},${dropLat}?overview=full&geometries=geojson`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error("Failed to fetch route from OSRM");
    }
    const data = await response.json();
    if (!data.routes || data.routes.length === 0) {
        throw new Error("No route found between selected coordinates");
    }
    return data.routes[0];
}

function getHaversineDistance(coords1, coords2) {
    const R = 6371; // Earth's radius in km
    const dLat = (coords2[0] - coords1[0]) * Math.PI / 180;
    const dLng = (coords2[1] - coords1[1]) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(coords1[0] * Math.PI / 180) * Math.cos(coords2[0] * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.ceil(R * c * 1.3); // Apply 30% routing overhead to approximate actual driving distance
}

// Shows/Hides outstation days and rental hours
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

    if (category === "rental") {
        utils.showElement(rentalHoursContainer);
        rentalHoursSelect.required = true;
        
        utils.hideElement(dropSelect.parentElement);
        dropSelect.required = false;
        dropSelect.value = "";
    } else {
        utils.hideElement(rentalHoursContainer);
        rentalHoursSelect.required = false;
        
        utils.showElement(dropSelect.parentElement);
        if (pickupSelect.value) {
            dropSelect.required = true;
        }
    }

    toggleMapVisibility();
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

    // Resolve coordinates and names
    let pickupCoords = null;
    let dropCoords = null;
    let resolvedPickupName = pickup;
    let resolvedDropName = drop;
    const isCustomBooking = (pickup === "Custom Location") || (category !== "rental" && drop === "Custom Location");

    if (pickup === "Custom Location") {
        const customText = customPickupAddress.value.trim();
        if (!customText) {
            utils.showAlert(bookingAlert, "Please type a custom pickup address.");
            window.scrollTo({ top: 0, behavior: 'smooth' });
            return;
        }
        resolvedPickupName = customText;
    } else {
        const pickupLoc = dbLocations.find(l => l.name === pickup);
        if (pickupLoc) {
            pickupCoords = [pickupLoc.lat, pickupLoc.lng];
        }
    }

    if (category === "rental") {
        resolvedDropName = "Rental Service (No Drop)";
    } else {
        if (drop === "Custom Location") {
            const customText = customDropAddress.value.trim();
            if (!customText) {
                utils.showAlert(bookingAlert, "Please type a custom drop address.");
                window.scrollTo({ top: 0, behavior: 'smooth' });
                return;
            }
            resolvedDropName = customText;
        } else {
            const dropLoc = dbLocations.find(l => l.name === drop);
            if (dropLoc) {
                dropCoords = [dropLoc.lat, dropLoc.lng];
            }
        }
    }

    showLoader("Querying fleet inventory & calculating rates...");

    let distanceKm = 0;
    let polyline = null;

    if (category === "rental" || isCustomBooking) {
        distanceKm = 0;
        polyline = null;
    } else {
        if (pickupCoords && dropCoords) {
            try {
                // Query OSRM
                const routeData = await fetchOSRMRoute(pickupCoords, dropCoords);
                distanceKm = Math.round(routeData.distance / 1000) || 1;
                const coords = routeData.geometry.coordinates; // array of [lng, lat]
                polyline = coords.map(coord => [coord[1], coord[0]]); // convert to [lat, lng]
            } catch (err) {
                console.warn("Routing API failed, using fallback metrics:", err.message);
                
                // Fallback to Haversine distance
                distanceKm = getHaversineDistance(pickupCoords, dropCoords);
                polyline = [pickupCoords, dropCoords]; // Straight-line polyline fallback
            }
        }
    }

    // Check if flat metrics are applicable (only if BOTH are NOT custom and we have a matrix match in Firestore)
    let metrics = null;
    if (category !== "rental" && !isCustomBooking) {
        try {
            const flatFareQuery = query(
                collection(db, "flat_fares"),
                where("pickup_name", "==", pickup),
                where("drop_name", "==", drop)
            );
            const flatFareSnap = await getDocs(flatFareQuery);
            if (!flatFareSnap.empty) {
                const flatFareData = flatFareSnap.docs[0].data();
                metrics = {
                    km: flatFareData.km || distanceKm,
                    base_fare_compact: flatFareData.fares.compact,
                    base_fare_premium: flatFareData.fares.premium,
                    base_fare_suv: flatFareData.fares.suv,
                    base_fare_muv: flatFareData.fares.muv
                };
            }
        } catch (err) {
            console.warn("Flat fares query failed, falling back to static/dynamic calculation:", err);
            // Fallback check static routesMatrix (only for non-local categories like intercity)
            if (category !== "local") {
                metrics = getRouteMetrics(pickup, drop);
            }
        }
    }

    // Save configuration parameters globally
    currentRouteData = {
        pickup: resolvedPickupName,
        drop: resolvedDropName,
        dateString: dateVal,
        timeString: timeVal,
        category: category,
        days: days,
        hours: category === "rental" ? parseInt(rentalHoursSelect.value) : 0,
        km: category === "rental" ? 0 : (metrics ? metrics.km : distanceKm),
        flatMetrics: metrics,
        pickupCoords: pickupCoords,
        dropCoords: dropCoords,
        polyline: polyline,
        isCustomBooking: isCustomBooking
    };

    // Update Step 2 badge distance total
    if (isCustomBooking) {
        routeKmBadge.textContent = "Estimated: -- km (Custom Route)";
    } else {
        routeKmBadge.textContent = `Estimated: ${currentRouteData.km} km`;
    }

    // Process rates and time-aware inventory availability check for each category (Compact, Premium, SUV, MUV)
    try {
        const ratesResponse = await bookingService.fetchRates();
        const activeRates = ratesResponse.rates;
        activeRatesVersionId = ratesResponse.version_id;
        const tiers = ["compact", "premium", "suv", "muv"];
        
        for (const tier of tiers) {
            const card = document.querySelector(`.car-card[data-tier="${tier}"]`);
            const fareDisplay = card.querySelector(".car-fare-display");
            const soldOutOverlay = card.querySelector(".sold-out-overlay");

            // Calculate fare dynamically
            const fare = bookingService.calculateFare(category, currentRouteData.km, days, tier, metrics, currentRouteData.hours, activeRates, currentRouteData.timeString);
            
            if (isCustomBooking) {
                fareDisplay.innerHTML = `₹${fare.toLocaleString("en-IN")}<span class="block text-[10px] text-slate-500 font-normal">Base Rate</span>`;
            } else {
                fareDisplay.textContent = `₹${fare.toLocaleString("en-IN")}`;
            }
            card.dataset.computedFare = fare;

            // Overbooking inventory check
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

async function loadVisiblePromoChips() {
    utils.hideElement(availableOffersContainer);
    offersChipsList.innerHTML = "";
    
    try {
        const promos = await bookingService.fetchVisiblePromos();
        // Filter by eligibility (estimated base fare >= min threshold)
        const eligiblePromos = promos.filter(p => selectedVehicleFare >= (parseFloat(p.min_fare_threshold) || 0));
        
        if (eligiblePromos.length > 0) {
            eligiblePromos.forEach(p => {
                const btn = document.createElement("button");
                btn.type = "button";
                // Glassmorphic chip styling
                btn.className = "bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-400 hover:text-amber-300 font-bold px-3 py-1.5 rounded-xl text-xs transition-all duration-200 transform active:scale-95 cursor-pointer flex items-center gap-1.5";
                
                const typeLabel = p.discount_type === "percentage" ? `${p.discount_value}%` : `₹${p.discount_value}`;
                btn.textContent = `${p.code} (Save ${typeLabel})`;
                
                btn.addEventListener("click", () => {
                    promoCodeInput.value = p.code;
                    handleApplyPromo();
                });
                
                offersChipsList.appendChild(btn);
            });
            utils.showElement(availableOffersContainer);
        }
    } catch (err) {
        console.error("Failed to load visible promo chips:", err);
    }
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
    
    // Set base fare & reset promo state
    if (currentRouteData.isCustomBooking) {
        summaryBaseFare.textContent = `₹${selectedVehicleFare.toLocaleString("en-IN")} (Base Cost)`;
        utils.showElement(customFareNotice);
    } else {
        summaryBaseFare.textContent = `₹${selectedVehicleFare.toLocaleString("en-IN")}`;
        utils.hideElement(customFareNotice);
    }
    
    summaryGrandTotal.textContent = `₹${selectedVehicleFare.toLocaleString("en-IN")}`;
    appliedPromo = null;
    promoCodeInput.value = "";
    utils.hideElement(summaryDiscountRow);
    utils.hideElement(promoStatusMsg);
    promoStatusMsg.className = "text-xs font-semibold text-center hidden";
    promoStatusMsg.textContent = "";

    // Load visible offers for rider selection
    loadVisiblePromoChips();

    if (currentRouteData.category === "outstation") {
        summaryDaysRow.firstElementChild.textContent = "Outstation Duration";
        summaryDays.textContent = `${currentRouteData.days} Day(s)`;
        utils.showElement(summaryDaysRow);
    } else if (currentRouteData.category === "rental") {
        summaryDaysRow.firstElementChild.textContent = "Rental Duration";
        summaryDays.textContent = `${currentRouteData.hours} Hour(s)`;
        utils.showElement(summaryDaysRow);
    } else {
        utils.hideElement(summaryDaysRow);
    }

    utils.hideElement(panelStep2);
    utils.showElement(panelStep3);
    updateProgressSteps(3);
}

async function handleApplyPromo() {
    utils.hideElement(promoStatusMsg);
    const code = promoCodeInput.value.trim();
    if (!code) {
        promoStatusMsg.textContent = "Please enter a promo code.";
        promoStatusMsg.className = "text-xs font-semibold text-center mt-2 text-rose-500 block";
        utils.showElement(promoStatusMsg);
        return;
    }
    
    btnApplyPromo.disabled = true;
    btnApplyPromo.textContent = "Applying...";
    
    try {
        const result = await bookingService.verifyPromoCode(code, selectedVehicleFare);
        if (result.valid) {
            appliedPromo = {
                code: result.code,
                discount: result.discount
            };
            
            // Show discount line in billing breakdown
            summaryPromoCodeName.textContent = result.code;
            summaryDiscountAmount.textContent = `-₹${result.discount.toLocaleString("en-IN")}`;
            utils.showElement(summaryDiscountRow);
            
            // Calculate final grand total
            const finalFare = selectedVehicleFare - result.discount;
            summaryGrandTotal.textContent = `₹${finalFare.toLocaleString("en-IN")}`;
            
            // Show status success message
            promoStatusMsg.textContent = result.message;
            promoStatusMsg.className = "text-xs font-semibold text-center mt-2 text-emerald-500 block";
            utils.showElement(promoStatusMsg);
        } else {
            appliedPromo = null;
            utils.hideElement(summaryDiscountRow);
            summaryGrandTotal.textContent = `₹${selectedVehicleFare.toLocaleString("en-IN")}`;
            
            promoStatusMsg.textContent = result.message;
            promoStatusMsg.className = "text-xs font-semibold text-center mt-2 text-rose-500 block";
            utils.showElement(promoStatusMsg);
        }
    } catch (err) {
        console.error("Error applying promo:", err);
        promoStatusMsg.textContent = "Failed to apply promo code.";
        promoStatusMsg.className = "text-xs font-semibold text-center mt-2 text-rose-500 block";
        utils.showElement(promoStatusMsg);
    } finally {
        btnApplyPromo.disabled = false;
        btnApplyPromo.textContent = "Apply";
    }
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
        booking_channel: "website",
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
            outstation_days: currentRouteData.category === "outstation" ? currentRouteData.days : null,
            rental_hours: currentRouteData.category === "rental" ? currentRouteData.hours : null,
            pickup_coords: currentRouteData.pickupCoords || null,
            drop_coords: currentRouteData.dropCoords || null,
            route_polyline: currentRouteData.polyline ? JSON.stringify(currentRouteData.polyline) : null
        },
        fare_details: {
            vehicle_tier: selectedVehicleTier,
            estimated_km: currentRouteData.km,
            base_fare: selectedVehicleFare,
            discount_amount: appliedPromo ? appliedPromo.discount : 0,
            promo_code: appliedPromo ? appliedPromo.code : null,
            estimated_fare: appliedPromo ? (selectedVehicleFare - appliedPromo.discount) : selectedVehicleFare,
            rates_version_id: activeRatesVersionId
        }
    };

    try {
        // 1. Commit record to Cloud Firestore DB
        const bookingId = await bookingService.createBooking(bookingPayload);
        bookingPayload.booking_id = bookingId;

        // Success Alert and redirection
        utils.hideElement(bookingLoader);
        utils.showElement(panelStep3);
        utils.showAlert(bookingAlert, "Booking successful! Your ride has been registered and is pending approval.", "success");

        // Smoothly route rider back to primary homepage landing
        setTimeout(() => {
            window.location.href = "../../index.html";
        }, 3000);
    } catch (error) {
        hideLoader(panelStep3);
        utils.showAlert(bookingAlert, "Booking transaction failed: " + error.message);
    }
}
