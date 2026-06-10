// modules/admin/adminUI.js

import { auth, db } from "../shared/firebase.js";
import { authService } from "../auth/authService.js";
import { utils } from "../shared/utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { terminalCoordinates, routesMatrix } from "../shared/routesMatrix.js";
import { bookingService } from "../booking/bookingService.js";
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc,
    getDoc,
    getDocs,
    setDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Global error catcher for diagnostics
window.addEventListener("error", (e) => {
    console.error("Diagnostic Alert - JS Error: ", e.message, "File: ", e.filename, "Line: ", e.lineno);
});

// DOM Selector Handles
const adminWelcome = document.getElementById("admin-welcome");
const btnAdminLogout = document.getElementById("btn-admin-logout");

// Stats Counters
const statTotal = document.getElementById("stat-total");
const statRequested = document.getElementById("stat-requested");
const statConfirmed = document.getElementById("stat-confirmed");
const statOngoing = document.getElementById("stat-ongoing");
const statCompleted = document.getElementById("stat-completed");

// Tabs
const tabAll = document.getElementById("tab-all");
const tabReq = document.getElementById("tab-req");
const tabConf = document.getElementById("tab-conf");
const tabOng = document.getElementById("tab-ong");
const tabComp = document.getElementById("tab-comp");
const tabRej = document.getElementById("tab-rej");

// Alerts & Loaders
const adminAlert = document.getElementById("admin-alert");
const adminLoader = document.getElementById("admin-loader");
const bookingsListContainer = document.getElementById("bookings-list-container");
const bookingsEmptyState = document.getElementById("bookings-empty-state");

// Modals
const approvalModal = document.getElementById("approval-modal");
const approvalForm = document.getElementById("approval-form");
const approveBookingId = document.getElementById("approve-booking-id");
const approveRosterSelect = document.getElementById("approve-roster-select");
const approveDriverName = document.getElementById("approve-driver-name");
const approveDriverPhone = document.getElementById("approve-driver-phone");
const approveVehicleNumber = document.getElementById("approve-vehicle-number");
const btnCloseApprove = document.getElementById("btn-close-approve");

const rejectionModal = document.getElementById("rejection-modal");
const rejectionForm = document.getElementById("rejection-form");
const rejectBookingId = document.getElementById("reject-booking-id");
const rejectReason = document.getElementById("reject-reason");
const btnCloseReject = document.getElementById("btn-close-reject");

// Workspace View Switchers
const viewBookingsTab = document.getElementById("view-bookings-tab");
const viewFleetTab = document.getElementById("view-fleet-tab");
const viewDriversTab = document.getElementById("view-drivers-tab");
const viewSettingsTab = document.getElementById("view-settings-tab");
const viewLocationsTab = document.getElementById("view-locations-tab");

const panelBookings = document.getElementById("panel-bookings");
const panelFleet = document.getElementById("panel-fleet");
const panelDrivers = document.getElementById("panel-drivers");
const panelSettings = document.getElementById("panel-settings");
const panelLocations = document.getElementById("panel-locations");

// Manage Locations inputs
const addLocationForm = document.getElementById("add-location-form");
const locationName = document.getElementById("location-name");
const locationType = document.getElementById("location-type");
const locationLat = document.getElementById("location-lat");
const locationLng = document.getElementById("location-lng");
const locationMapSearch = document.getElementById("location-map-search");
const btnLocationMapSearch = document.getElementById("btn-location-map-search");
const locationsListTbody = document.getElementById("locations-list-tbody");

const flatFareForm = document.getElementById("flat-fare-form");
const flatFarePickup = document.getElementById("flat-fare-pickup");
const flatFareDrop = document.getElementById("flat-fare-drop");
const flatFareCompact = document.getElementById("flat-fare-compact");
const flatFarePremium = document.getElementById("flat-fare-premium");
const flatFareSuv = document.getElementById("flat-fare-suv");
const flatFareMuv = document.getElementById("flat-fare-muv");
const flatFaresListTbody = document.getElementById("flat-fares-list-tbody");

let locationMapInstance = null;
let locationMapMarker = null;

// Approve Modal Geocoding Elements
const approveMapSection = document.getElementById("approve-map-section");
const approvePickupAddressText = document.getElementById("approve-pickup-address-text");
const approveDropAddressText = document.getElementById("approve-drop-address-text");
const approveMapSearchInput = document.getElementById("approve-map-search-input");
const btnApproveMapSearch = document.getElementById("btn-approve-map-search");
const approvePickupCoordsBadge = document.getElementById("approve-pickup-coords-badge");
const approveDropCoordsBadge = document.getElementById("approve-drop-coords-badge");
const approveSaveCoords = document.getElementById("approve-save-coords");

let approveMapInstance = null;
let approvePickupMarker = null;
let approveDropMarker = null;
let approvePickupCoords = null; // [lat, lng]
let approveDropCoords = null;   // [lat, lng]


// Fleet inventory elements
const vehicleModal = document.getElementById("vehicle-modal");
const btnAddVehicleTrigger = document.getElementById("btn-add-vehicle-trigger");
const btnCloseVehicle = document.getElementById("btn-close-vehicle");
const vehicleForm = document.getElementById("vehicle-form");
const vehicleEditId = document.getElementById("vehicle-edit-id");
const vehicleModel = document.getElementById("vehicle-model");
const vehiclePlate = document.getElementById("vehicle-plate");
const vehicleTier = document.getElementById("vehicle-tier");
const vehiclePassengers = document.getElementById("vehicle-passengers");
const vehicleAddress = document.getElementById("vehicle-address");
const vehicleStatus = document.getElementById("vehicle-status");
const vehicleDriver = document.getElementById("vehicle-driver");
const btnSaveVehicle = document.getElementById("btn-save-vehicle");
const btnCancelVehicle = document.getElementById("btn-cancel-vehicle");
const btnSeedFleet = document.getElementById("btn-seed-fleet");
const fleetInventoryTbody = document.getElementById("fleet-inventory-tbody");

// Driver registry elements
const driverModal = document.getElementById("driver-modal");
const btnAddDriverTrigger = document.getElementById("btn-add-driver-trigger");
const btnCloseDriver = document.getElementById("btn-close-driver");
const driverForm = document.getElementById("driver-form");
const driverEditId = document.getElementById("driver-edit-id");
const driverName = document.getElementById("driver-name");
const driverAddress = document.getElementById("driver-address");
const driverPhone = document.getElementById("driver-phone");
const driverLicense = document.getElementById("driver-license");
const driverStatus = document.getElementById("driver-status");
const driverVehicle = document.getElementById("driver-vehicle");
const btnSaveDriver = document.getElementById("btn-save-driver");
const btnCancelDriver = document.getElementById("btn-cancel-driver");
const driverRegistryTbody = document.getElementById("driver-registry-tbody");

// Fares Configuration Form
const faresMatrixForm = document.getElementById("fares-matrix-form");
const fareCompactBase = document.getElementById("fare-compact-base");
const fareCompactKm = document.getElementById("fare-compact-km");
const fareCompactHour = document.getElementById("fare-compact-hour");
const fareCompactAllowance = document.getElementById("fare-compact-allowance");

const farePremiumBase = document.getElementById("fare-premium-base");
const farePremiumKm = document.getElementById("fare-premium-km");
const farePremiumHour = document.getElementById("fare-premium-hour");
const farePremiumAllowance = document.getElementById("fare-premium-allowance");

const fareSuvBase = document.getElementById("fare-suv-base");
const fareSuvKm = document.getElementById("fare-suv-km");
const fareSuvHour = document.getElementById("fare-suv-hour");
const fareSuvAllowance = document.getElementById("fare-suv-allowance");

const fareMuvBase = document.getElementById("fare-muv-base");
const fareMuvKm = document.getElementById("fare-muv-km");
const fareMuvHour = document.getElementById("fare-muv-hour");
const fareMuvAllowance = document.getElementById("fare-muv-allowance");

// Promo Offer Form
const promoCodeForm = document.getElementById("promo-code-form");
const promoCodeInput = document.getElementById("promo-code");
const promoTypeSelect = document.getElementById("promo-type");
const promoValueInput = document.getElementById("promo-value");
const promoMinFareInput = document.getElementById("promo-min-fare");
const promoVisibleInput = document.getElementById("promo-visible");
const activePromosTbody = document.getElementById("active-promos-tbody");

// Manual Discount Override inside Approve Modal
const approveDiscountOverride = document.getElementById("approve-discount-override");

// State Variables
let bookingsData = [];
let rosterData = {};
let currentStatusFilter = "all"; // "all" | "pending_approval" | "confirmed" | "active" | "completed" | "rejected"
let firebaseAuthUnsubscribe = null;
let firestoreUnsubscribe = null;
let firestoreFleetUnsubscribe = null;
let firestoreDriversUnsubscribe = null;
let vehiclesData = [];
let driversData = [];
let adminMaps = {}; // booking.id -> Leaflet map instance

// Initialize Dashboard
document.addEventListener("DOMContentLoaded", () => {
    initAdminUI();
});

function initAdminUI() {
    // 1. Session state checker
    if (auth) {
        firebaseAuthUnsubscribe = onAuthStateChanged(auth, handleAdminSessionChange);
    }
    
    // Check local storage fallback immediately to prevent flicker
    if (localStorage.getItem("admin_poc_session") === "true") {
        adminWelcome.textContent = "Welcome, Admin Manager";
    }

    // 2. Bind Logout Action
    btnAdminLogout.addEventListener("click", handleLogout);

    // 3. Load Roster Data for Option A
    loadFleetRoster();

    // 4. Bind Roster Change Listener (Option A autofills Option B)
    approveRosterSelect.addEventListener("change", handleRosterSelectionChange);

    // 5. Bind Modal Close buttons
    btnCloseApprove.addEventListener("click", () => utils.hideElement(approvalModal));
    btnCloseReject.addEventListener("click", () => utils.hideElement(rejectionModal));

    // 6. Bind Form Submissions
    approvalForm.addEventListener("submit", handleApprovalFormSubmit);
    rejectionForm.addEventListener("submit", handleRejectionFormSubmit);

    // 7. Bind Status Filtering Tabs
    setupFilterTabs();

    // 8. Bind View Switchers
    setupViewSwitchers();

    // 9. Bind dynamic settings & coupon forms
    faresMatrixForm.addEventListener("submit", handleFaresFormSubmit);
    promoCodeForm.addEventListener("submit", handlePromoFormSubmit);

    // 10. Bind Fleet Inventory and Driver Registry forms and actions
    if (vehicleForm) vehicleForm.addEventListener("submit", handleVehicleFormSubmit);
    if (driverForm) driverForm.addEventListener("submit", handleDriverFormSubmit);
    if (btnCancelVehicle) btnCancelVehicle.addEventListener("click", resetVehicleForm);
    if (btnCancelDriver) btnCancelDriver.addEventListener("click", resetDriverForm);
    if (btnSeedFleet) btnSeedFleet.addEventListener("click", seedDefaultFleet);

    // Bind triggers to show/hide Add/Register modals
    if (btnAddVehicleTrigger) {
        btnAddVehicleTrigger.addEventListener("click", () => {
            resetVehicleForm();
            utils.showElement(vehicleModal);
        });
    }
    if (btnCloseVehicle) {
        btnCloseVehicle.addEventListener("click", () => {
            resetVehicleForm();
        });
    }
    if (btnAddDriverTrigger) {
        btnAddDriverTrigger.addEventListener("click", () => {
            resetDriverForm();
            utils.showElement(driverModal);
        });
    }
    if (btnCloseDriver) {
        btnCloseDriver.addEventListener("click", () => {
            resetDriverForm();
        });
    }
}

// Security: Force rerouting if user is not authorized as Admin
async function handleAdminSessionChange(user) {
    const isAdminSession = localStorage.getItem("admin_poc_session") === "true";
    const loggedInUser = user || (isAdminSession ? { email: "admin@ishancabs.com" } : null);

    if (loggedInUser && loggedInUser.email === "admin@ishancabs.com") {
        adminWelcome.textContent = `Welcome, Admin`;
        utils.showElement(adminWelcome);
        
        // Start streaming bookings data in real-time
        startBookingsSnapshotListener();
        startFleetSnapshotListeners();

        // Prefetch settings and promo configuration arrays
        loadFaresMatrix();
        loadPromoOffers();

        // Run self-healing retrospective schema updates
        runRetrospectiveUpdates();
    } else {
        // Not logged in or not admin -> block access
        console.warn("IshanCabs: Unauthorized admin dashboard access attempt.");
        localStorage.removeItem("admin_poc_session");
        window.location.href = "../auth/auth.html";
    }
}

// Stream bookings data in real-time
function startBookingsSnapshotListener() {
    if (!db) {
        console.error("IshanCabs: Firestore connection is uninitialized.");
        utils.showAlert(adminAlert, "Database connection failure. Please reload page.");
        utils.hideElement(adminLoader);
        return;
    }

    try {
        const bookingsQuery = query(
            collection(db, "bookings"),
            orderBy("creation_ts", "desc")
        );

        firestoreUnsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
            bookingsData = [];
            snapshot.forEach((doc) => {
                bookingsData.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            utils.hideElement(adminLoader);
            updateStatsCounters();
            renderBookings();
        }, (error) => {
            console.error("IshanCabs: Firestore subscription error:", error);
            utils.hideElement(adminLoader);
            utils.showAlert(adminAlert, "Failed to stream live updates from database: " + error.message);
        });
    } catch (err) {
        console.error("IshanCabs: Error initializing snapshot listener:", err);
        utils.hideElement(adminLoader);
        utils.showAlert(adminAlert, "Failed to initialize real-time streaming: " + err.message);
    }
}

// Dynamic fleet roster loader using Firestore active associations
function loadFleetRoster() {
    if (!approveRosterSelect) return;

    const activeRoster = {
        compact: [],
        premium: [],
        suv: [],
        muv: []
    };

    driversData.forEach(driver => {
        if (driver.status === "active" && driver.assigned_vehicle_id) {
            const vehicle = vehiclesData.find(v => v.id === driver.assigned_vehicle_id);
            if (vehicle && vehicle.status === "active" && activeRoster[vehicle.tier]) {
                activeRoster[vehicle.tier].push({
                    driver_id: driver.id,
                    driver_name: driver.name,
                    driver_phone: driver.phone,
                    vehicle_id: vehicle.id,
                    vehicle_number: vehicle.plate_number,
                    vehicle_tier: vehicle.tier,
                    vehicle_model: vehicle.model
                });
            }
        }
    });

    approveRosterSelect.innerHTML = '<option value="" selected>-- Choose dynamic driver & car --</option>';

    Object.keys(activeRoster).forEach(tier => {
        const group = document.createElement("optgroup");
        group.label = tier.toUpperCase() + " Class";
        
        activeRoster[tier].forEach(item => {
            const isBusy = bookingsData.some(b => 
                (b.status === "confirmed" || b.status === "active") && 
                b.driver_assignment && 
                (b.driver_assignment.vehicle_number === item.vehicle_number || b.driver_assignment.driver_phone === item.driver_phone)
            );

            const label = isBusy 
                ? `${item.driver_name} (${item.vehicle_number}) - [Busy - On Ride]` 
                : `${item.driver_name} (${item.vehicle_number})`;

            const option = document.createElement("option");
            option.textContent = label;
            
            option.value = JSON.stringify({
                driver_name: item.driver_name,
                driver_phone: item.driver_phone,
                vehicle_number: item.vehicle_number,
                is_busy: isBusy
            });

            if (isBusy) {
                option.className = "text-slate-500 italic";
            } else {
                option.className = "text-white font-semibold";
            }
            group.appendChild(option);
        });
        approveRosterSelect.appendChild(group);
    });
}

// Option A autofills Option B for seamless speed + flexibility
function handleRosterSelectionChange() {
    const value = approveRosterSelect.value;
    if (value) {
        try {
            const driver = JSON.parse(value);
            approveDriverName.value = driver.driver_name || "";
            approveDriverPhone.value = driver.driver_phone || "";
            approveVehicleNumber.value = driver.vehicle_number || "";

            if (driver.is_busy) {
                utils.showAlert(adminAlert, `Warning: This driver/car is currently assigned to a confirmed or active ride. Confirming this assignment will conflict unless you select another.`);
            }
        } catch (err) {
            console.error("Failed to parse stringified roster data", err);
        }
    } else {
        // Clear manual inputs if reset
        approveDriverName.value = "";
        approveDriverPhone.value = "";
        approveVehicleNumber.value = "";
    }
}

// Accumulate status counts and update dashboard metrics cards
function updateStatsCounters() {
    let total = bookingsData.length;
    let requested = bookingsData.filter(b => b.status === "pending_approval").length;
    let confirmed = bookingsData.filter(b => b.status === "confirmed").length;
    let ongoing = bookingsData.filter(b => b.status === "active").length;
    let completed = bookingsData.filter(b => b.status === "completed").length;

    statTotal.textContent = total;
    statRequested.textContent = requested;
    statConfirmed.textContent = confirmed;
    statOngoing.textContent = ongoing;
    statCompleted.textContent = completed;
}

// Bind tabs clicks
function setupFilterTabs() {
    const tabs = [
        { btn: tabAll, filter: "all" },
        { btn: tabReq, filter: "pending_approval" },
        { btn: tabConf, filter: "confirmed" },
        { btn: tabOng, filter: "active" },
        { btn: tabComp, filter: "completed" },
        { btn: tabRej, filter: "rejected" }
    ];

    tabs.forEach(tab => {
        if (!tab.btn) return;
        tab.btn.addEventListener("click", () => {
            // Swap visual tab active headers
            tabs.forEach(t => {
                if (t.btn) {
                    t.btn.className = "flex-1 min-w-[60px] py-2.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition-all duration-200";
                }
            });
            tab.btn.className = "flex-1 min-w-[60px] py-2.5 text-xs font-bold rounded-xl text-amber-500 bg-slate-900 transition-all duration-200";

            currentStatusFilter = tab.filter;
            renderBookings();
        });
    });
}

// Render filtered card summaries
function renderBookings() {
    destroyAllAdminMaps();
    bookingsListContainer.innerHTML = "";
    utils.hideElement(adminAlert);

    // Apply Filter rules
    const filteredBookings = currentStatusFilter === "all" 
        ? bookingsData 
        : bookingsData.filter(b => b.status === currentStatusFilter);

    if (filteredBookings.length === 0) {
        utils.hideElement(bookingsListContainer);
        utils.showElement(bookingsEmptyState);
        return;
    }

    utils.hideElement(bookingsEmptyState);
    utils.showElement(bookingsListContainer);

    filteredBookings.forEach(booking => {
        const card = document.createElement("div");
        card.className = "admin-card p-6 rounded-3xl border border-slate-800/80 hover:border-slate-700/80 transition-all duration-300 flex flex-col justify-between";

        // Style status badges cleanly
        let statusText = "Requested";
        let badgeClass = "bg-amber-500/10 border-amber-500/20 text-amber-400";
        if (booking.status === "confirmed") {
            statusText = "Confirmed";
            badgeClass = "bg-blue-500/10 border-blue-500/20 text-blue-400";
        } else if (booking.status === "active") {
            statusText = `<span class="inline-flex items-center"><span class="relative flex h-2 w-2 mr-1.5"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>On-Going</span>`;
            badgeClass = "bg-emerald-500/10 border-emerald-500/20 text-emerald-400";
        } else if (booking.status === "completed") {
            statusText = "Completed";
            badgeClass = "bg-slate-800/80 border-slate-700/60 text-slate-400";
        } else if (booking.status === "rejected") {
            statusText = "Rejected";
            badgeClass = "bg-rose-500/10 border-rose-500/20 text-rose-400";
        }

        const dateStr = booking.trip_details.pickup_date || "--";
        const timeStr = booking.trip_details.pickup_time || "--";
        const creationDate = booking.creation_ts ? new Date(booking.creation_ts.seconds * 1000).toLocaleString() : "Recently Added";

        // Compute fare details with discounts/promos
        const finalFare = booking.fare_details.estimated_fare;
        const baseFare = typeof booking.fare_details.base_fare === "number" ? booking.fare_details.base_fare : finalFare;
        const discount = booking.fare_details.discount_amount || 0;
        const promo = booking.fare_details.promo_code;

        let amountHtml = `${booking.fare_details.estimated_km} km • ₹${finalFare.toLocaleString("en-IN")}/-`;
        if (discount > 0) {
            amountHtml = `
                <span class="block">${booking.fare_details.estimated_km} km • ₹${finalFare.toLocaleString("en-IN")}/-</span>
                <span class="text-[9px] text-slate-400 font-normal block mt-0.5 leading-tight">Base: ₹${baseFare.toLocaleString("en-IN")} | Promo: ${promo} (-₹${discount.toLocaleString("en-IN")})</span>
            `;
        }

        // HTML code structure for each card
        card.innerHTML = `
            <div class="space-y-4">
                <!-- Card Header -->
                <div class="flex justify-between items-start border-b border-slate-800 pb-3">
                    <div>
                        <span class="text-[10px] font-black text-slate-500 tracking-wider block uppercase">Booking ID</span>
                        <h4 class="font-bold text-white text-sm tracking-wide mt-0.5">${booking.booking_id}</h4>
                    </div>
                    <span class="border px-2.5 py-1 rounded-xl text-xs font-bold ${badgeClass}">
                        ${statusText}
                    </span>
                </div>

                <!-- Trip Routing Details -->
                <div class="grid grid-cols-2 gap-4 text-xs">
                    <div>
                        <span class="text-slate-500 block">Pickup Location</span>
                        <span class="font-semibold text-slate-200 block mt-0.5">${booking.trip_details.pickup_location}</span>
                    </div>
                    <div>
                        <span class="text-slate-500 block">Destination</span>
                        <span class="font-semibold text-slate-200 block mt-0.5">${booking.trip_details.drop_location}</span>
                    </div>
                </div>

                <!-- Timings & Category -->
                <div class="grid grid-cols-3 gap-2 text-xs border-y border-slate-800/50 py-3">
                    <div>
                        <span class="text-[10px] text-slate-500 block">Pickup Timing</span>
                        <span class="font-semibold text-slate-300 block mt-0.5">${dateStr} ${timeStr}</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-500 block">Tier / Mode</span>
                        <span class="font-semibold text-slate-300 block mt-0.5 uppercase">${booking.fare_details.vehicle_tier} (${booking.trip_details.ride_type})</span>
                    </div>
                    <div>
                        <span class="text-[10px] text-slate-500 block">KM & Amount</span>
                        <span class="font-semibold text-amber-500 block mt-0.5">${amountHtml}</span>
                    </div>
                </div>

                <!-- Rider Info -->
                <div class="text-xs space-y-1">
                    <span class="text-[10px] font-bold text-slate-500 tracking-wider block uppercase">Passenger Details</span>
                    <p class="font-medium text-slate-200">${booking.customer_details.name} • <a href="tel:${booking.customer_details.phone}" class="text-amber-400 hover:underline font-bold">${booking.customer_details.phone}</a></p>
                </div>

                <!-- Driver Allocation Panel -->
                ${(booking.status === "confirmed" || booking.status === "active" || booking.status === "completed") && booking.driver_assignment ? `
                <div class="bg-slate-950/60 border border-slate-800/60 p-3 rounded-2xl text-xs mt-3">
                    <span class="text-[10px] font-bold text-slate-500 tracking-wider block uppercase mb-1.5">Assigned Fleet</span>
                    <div class="grid grid-cols-2 gap-2 text-slate-300">
                        <div>
                            <span class="text-slate-500 block text-[10px]">Driver</span>
                            <span class="font-bold">${booking.driver_assignment.driver_name}</span>
                        </div>
                        <div>
                            <span class="text-slate-500 block text-[10px]">Vehicle Plate</span>
                            <span class="font-bold text-amber-400 uppercase">${booking.driver_assignment.vehicle_number}</span>
                        </div>
                    </div>
                </div>
                ` : ""}

                <!-- Rejection Details -->
                ${booking.status === "rejected" && booking.rejection_reason ? `
                <div class="bg-rose-950/10 border border-rose-500/10 p-3 rounded-2xl text-xs mt-3">
                    <span class="text-[10px] font-bold text-rose-400 tracking-wider block uppercase mb-0.5">Rejection Reason</span>
                    <p class="text-rose-300 leading-relaxed">${booking.rejection_reason}</p>
                </div>
                ` : ""}

                <!-- Rating Review Panel (If Completed and feedback is present) -->
                ${booking.status === "completed" && booking.feedback ? `
                <div class="bg-slate-900/40 border border-slate-800/60 p-3 rounded-2xl text-xs mt-3">
                    <div class="flex justify-between items-center mb-1">
                        <span class="text-[10px] font-bold text-amber-400 tracking-wider uppercase">User Feedback</span>
                        <div class="flex text-amber-500 gap-0.5">
                            ${Array.from({ length: 5 }, (_, i) => `
                                <svg class="w-3 h-3 ${i < booking.feedback.rating ? "fill-current" : "stroke-current text-slate-600 fill-none"}" viewBox="0 0 20 20">
                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                </svg>
                            `).join("")}
                        </div>
                    </div>
                    <p class="text-slate-300 italic">"${booking.feedback.comments || "No comments written."}"</p>
                </div>
                ` : ""}

                <!-- Route Map Preview -->
                <div id="map-admin-${booking.id}" class="h-40 w-full mt-3 rounded-2xl border border-slate-800/80 overflow-hidden relative z-10"></div>
            </div>

            <!-- Action Controllers Panel -->
            <div class="mt-6 border-t border-slate-800/60 pt-4 flex gap-3">
                ${booking.status === "pending_approval" ? `
                    <button type="button" class="btn-approve flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200 transform active:scale-95 shadow-md shadow-emerald-500/10" data-id="${booking.id}">
                        Accept Ride
                    </button>
                    <button type="button" class="btn-reject flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-rose-400 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200 transform active:scale-95" data-id="${booking.id}">
                        Reject
                    </button>
                    <button type="button" class="btn-text-rider flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-amber-400 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200 transform active:scale-95" data-id="${booking.id}">
                        Text Rider
                    </button>
                ` : ""}

                ${booking.status === "confirmed" ? (() => {
                    const pickupDate = booking.trip_details.pickup_date;
                    const pickupTime = booking.trip_details.pickup_time;
                    let hasPassed = true;
                    if (pickupDate && pickupTime) {
                        const pickupDateTime = new Date(`${pickupDate}T${pickupTime}`);
                        if (!isNaN(pickupDateTime.getTime())) {
                            hasPassed = new Date() >= pickupDateTime;
                        }
                    }
                    return `
                        <button type="button" 
                            class="btn-start flex-1 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200 transform active:scale-95 shadow-md ${
                                hasPassed 
                                ? "bg-blue-500 hover:bg-blue-600 text-white shadow-blue-500/10 cursor-pointer" 
                                : "bg-slate-900 text-slate-600 border border-slate-800/80 cursor-not-allowed"
                            }" 
                            data-id="${booking.id}"
                            ${hasPassed ? "" : "disabled"}
                            title="${hasPassed ? "Click to start the ride" : "Ride cannot be started before the pickup time"}"
                        >
                            ${hasPassed ? "Start Ride" : "Start Ride (Locked)"}
                        </button>
                        <button type="button" class="btn-approve flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200" data-id="${booking.id}">
                            Reassign Driver
                        </button>
                    `;
                })() : ""}

                ${booking.status === "active" ? `
                    <button type="button" class="btn-complete flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200 transform active:scale-95 shadow-md shadow-amber-500/10" data-id="${booking.id}">
                        Mark Completed
                    </button>
                    <button type="button" class="btn-text-rider flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-amber-400 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200 transform active:scale-95" data-id="${booking.id}">
                        Text Rider
                    </button>
                ` : ""}

                ${booking.status === "completed" || booking.status === "rejected" ? `
                    <span class="text-slate-600 text-[10px] uppercase font-bold tracking-widest text-center w-full py-1">Archived History Record</span>
                ` : ""}
            </div>
        `;

        bookingsListContainer.appendChild(card);
    });

    // Initialize maps for all rendered bookings
    filteredBookings.forEach(booking => {
        initAdminMap(booking);
    });

    // Bind action events dynamically to injected DOM buttons
    bindCardActionButtonEvents();
}

// Bind action click controllers
function bindCardActionButtonEvents() {
    // 1. Approve modal triggers
    const approveButtons = document.querySelectorAll(".btn-approve");
    approveButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const bookingId = btn.getAttribute("data-id");
            const booking = bookingsData.find(b => b.id === bookingId);
            
            // Populates dialog fields
            approveBookingId.value = bookingId;
            approveRosterSelect.value = "";
            approveDriverName.value = booking.driver_assignment?.driver_name || "";
            approveDriverPhone.value = booking.driver_assignment?.driver_phone || "";
            approveVehicleNumber.value = booking.driver_assignment?.vehicle_number || "";
            approveDiscountOverride.value = booking.fare_details?.discount_amount || "";

            // Initialize geocoding map inside approval modal if it is a custom booking
            initApproveGeocodeMap(booking);

            utils.showElement(approvalModal);
        });
    });

    // 2. Reject modal triggers
    const rejectButtons = document.querySelectorAll(".btn-reject");
    rejectButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const bookingId = btn.getAttribute("data-id");
            rejectBookingId.value = bookingId;
            rejectReason.value = "";

            utils.showElement(rejectionModal);
        });
    });

    // 3. Mark as Completed directly
    const completeButtons = document.querySelectorAll(".btn-complete");
    completeButtons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const bookingId = btn.getAttribute("data-id");
            const confirmComplete = confirm(`Are you sure you want to mark booking ${bookingId} as Completed?`);
            if (confirmComplete) {
                utils.showAlert(adminAlert, "Updating booking status...", "success");
                try {
                    const bookingDocRef = doc(db, "bookings", bookingId);
                    await updateDoc(bookingDocRef, {
                        status: "completed",
                        updated_ts: serverTimestamp()
                    });
                    utils.showAlert(adminAlert, `Booking ${bookingId} marked completed successfully!`, "success");
                } catch (error) {
                    console.error("IshanCabs: Failed to complete ride", error);
                    utils.showAlert(adminAlert, "Status update failed: " + error.message);
                }
            }
        });
    });

    // 3.5. Start Ride trigger
    const startButtons = document.querySelectorAll(".btn-start");
    startButtons.forEach(btn => {
        btn.addEventListener("click", async () => {
            const bookingId = btn.getAttribute("data-id");
            const confirmStart = confirm(`Are you sure you want to start booking ${bookingId}? This will change the status to On-Going.`);
            if (confirmStart) {
                utils.showAlert(adminAlert, "Starting ride...", "success");
                try {
                    const bookingDocRef = doc(db, "bookings", bookingId);
                    await updateDoc(bookingDocRef, {
                        status: "active",
                        updated_ts: serverTimestamp()
                    });
                    utils.showAlert(adminAlert, `Ride ${bookingId} has started!`, "success");
                } catch (error) {
                    console.error("IshanCabs: Failed to start ride", error);
                    utils.showAlert(adminAlert, "Status update failed: " + error.message);
                }
            }
        });
    });

    // 4. Text Rider trigger
    const textButtons = document.querySelectorAll(".btn-text-rider");
    textButtons.forEach(btn => {
        btn.addEventListener("click", () => {
            const bookingId = btn.getAttribute("data-id");
            const booking = bookingsData.find(b => b.id === bookingId);
            if (booking && booking.customer_details && booking.customer_details.phone) {
                const phone = booking.customer_details.phone;
                let cleanNumber = phone.replace(/\D/g, "");
                if (cleanNumber.length === 10) {
                    cleanNumber = "91" + cleanNumber;
                }
                const url = `https://wa.me/${cleanNumber}`;
                window.open(url, "_blank");
            } else {
                utils.showAlert(adminAlert, "Rider phone details are unavailable.");
            }
        });
    });
}

// Approve Allocation handler (Firestore update status: "confirmed")
async function handleApprovalFormSubmit(e) {
    e.preventDefault();
    const bookingId = approveBookingId.value;
    const driverName = approveDriverName.value.trim();
    const driverPhone = approveDriverPhone.value.trim();
    const vehicleNumber = approveVehicleNumber.value.trim().toUpperCase();

    if (!driverName || !driverPhone || !vehicleNumber) {
        utils.showAlert(adminAlert, "Please complete all allocation fields.");
        return;
    }

    // Double-booking conflict checker
    const conflictBooking = bookingsData.find(b => 
        b.id !== bookingId &&
        (b.status === "confirmed" || b.status === "active") &&
        b.driver_assignment &&
        (b.driver_assignment.vehicle_number === vehicleNumber || b.driver_assignment.driver_phone === driverPhone)
    );

    if (conflictBooking) {
        utils.hideElement(approvalModal);
        utils.showAlert(adminAlert, `Assignment Conflict: Driver or Car is already assigned to active Booking ID: ${conflictBooking.booking_id} (Status: ${conflictBooking.status === "active" ? "On-Going" : "Confirmed"}). Please select another driver/car.`);
        return;
    }

    const booking = bookingsData.find(b => b.id === bookingId);
    const isCustom = !booking.trip_details.pickup_coords || !booking.trip_details.drop_coords;

    let geocodedData = null;
    if (isCustom && approveSaveCoords.checked) {
        if (!approvePickupCoords || !approveDropCoords) {
            utils.showAlert(adminAlert, "Please select both pickup and drop pin locations on the map or uncheck 'Configure Map Coordinates'.");
            return;
        }

        // We can fetch OSRM route right here, BEFORE hiding the modal, so we can alert if OSRM fails or show loading
        utils.showAlert(adminAlert, "Recalculating route distance...", "success");

        try {
            const pickupLng = approvePickupCoords[1];
            const pickupLat = approvePickupCoords[0];
            const dropLng = approveDropCoords[1];
            const dropLat = approveDropCoords[0];

            const url = `https://router.project-osrm.org/route/v1/driving/${pickupLng},${pickupLat};${dropLng},${dropLat}?overview=full&geometries=geojson`;
            const response = await fetch(url);
            if (!response.ok) throw new Error("OSRM route fetch failed");
            const data = await response.json();

            let distanceKm = 0;
            let polyline = null;
            if (data.routes && data.routes.length > 0) {
                const routeData = data.routes[0];
                distanceKm = Math.round(routeData.distance / 1000) || 1;
                const coords = routeData.geometry.coordinates;
                polyline = coords.map(coord => [coord[1], coord[0]]);
            } else {
                throw new Error("No route found in OSRM response");
            }

            geocodedData = {
                distanceKm,
                polyline,
                pickupCoords: approvePickupCoords,
                dropCoords: approveDropCoords
            };
        } catch (err) {
            console.warn("OSRM routing failed, using Haversine fallback:", err);
            // Haversine fallback
            const pickupLat = approvePickupCoords[0];
            const pickupLng = approvePickupCoords[1];
            const dropLat = approveDropCoords[0];
            const dropLng = approveDropCoords[1];

            const R = 6371; // Earth's radius in km
            const dLat = (dropLat - pickupLat) * Math.PI / 180;
            const dLng = (dropLng - pickupLng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                      Math.cos(pickupLat * Math.PI / 180) * Math.cos(dropLat * Math.PI / 180) *
                      Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distanceKm = Math.ceil(R * c * 1.3);
            const polyline = [approvePickupCoords, approveDropCoords];

            geocodedData = {
                distanceKm,
                polyline,
                pickupCoords: approvePickupCoords,
                dropCoords: approveDropCoords
            };
        }
    }

    utils.hideElement(approvalModal);
    utils.showAlert(adminAlert, "Allocating driver and confirming ride...", "success");

    try {
        const discountOverride = parseFloat(approveDiscountOverride.value);
        const updatePayload = {
            status: "confirmed",
            driver_assignment: {
                driver_name: driverName,
                driver_phone: driverPhone,
                vehicle_number: vehicleNumber
            },
            updated_ts: serverTimestamp()
        };

        if (geocodedData) {
            // Recalculate fare
            const ratesResponse = await bookingService.fetchRates();
            const activeRates = ratesResponse.rates;
            const calculatedBaseFare = bookingService.calculateFare(
                booking.trip_details.ride_type,
                geocodedData.distanceKm,
                booking.trip_details.outstation_days,
                booking.fare_details.vehicle_tier,
                null,
                booking.trip_details.rental_hours || 0,
                activeRates
            );

            const discount = !isNaN(discountOverride) && discountOverride >= 0 ? discountOverride : (booking.fare_details?.discount_amount || 0);
            const finalEstimatedFare = Math.max(0, calculatedBaseFare - discount);

            updatePayload.trip_details = {
                ...booking.trip_details,
                pickup_coords: geocodedData.pickupCoords,
                drop_coords: geocodedData.dropCoords,
                route_polyline: JSON.stringify(geocodedData.polyline)
            };

            updatePayload.fare_details = {
                ...booking.fare_details,
                base_fare: calculatedBaseFare,
                discount_amount: discount,
                estimated_fare: finalEstimatedFare,
                estimated_km: geocodedData.distanceKm,
                promo_code: discount > 0 ? (discountOverride >= 0 ? "ADMIN_OVERRIDE" : (booking.fare_details?.promo_code || "ADMIN_OVERRIDE")) : (booking.fare_details?.promo_code || null)
            };
        } else {
            // Standard flow without new geocoding
            if (!isNaN(discountOverride) && discountOverride >= 0) {
                const baseFare = (booking.fare_details && typeof booking.fare_details.base_fare === "number")
                    ? booking.fare_details.base_fare
                    : booking.fare_details.estimated_fare;
                const finalEstimatedFare = Math.max(0, baseFare - discountOverride);

                updatePayload.fare_details = {
                    ...booking.fare_details,
                    base_fare: baseFare,
                    discount_amount: discountOverride,
                    estimated_fare: finalEstimatedFare,
                    promo_code: discountOverride > 0 ? "ADMIN_OVERRIDE" : (booking.fare_details?.promo_code || null)
                };
            }
        }

        const bookingDocRef = doc(db, "bookings", bookingId);
        await updateDoc(bookingDocRef, updatePayload);

        utils.showAlert(adminAlert, `Booking ${bookingId} approved and driver assigned successfully!`, "success");
    } catch (error) {
        console.error("IshanCabs: Failed to approve ride", error);
        utils.showAlert(adminAlert, "Approval transaction failed: " + error.message);
    }
}

// Rejection Handler (Firestore update status: "rejected")
async function handleRejectionFormSubmit(e) {
    e.preventDefault();
    const bookingId = rejectBookingId.value;
    const reason = rejectReason.value.trim();

    if (!reason) {
        utils.showAlert(adminAlert, "Please specify a reason.");
        return;
    }

    utils.hideElement(rejectionModal);
    utils.showAlert(adminAlert, "Rejecting booking request...", "success");

    try {
        const bookingDocRef = doc(db, "bookings", bookingId);
        await updateDoc(bookingDocRef, {
            status: "rejected",
            rejection_reason: reason,
            updated_ts: serverTimestamp()
        });

        utils.showAlert(adminAlert, `Booking ${bookingId} rejected successfully.`, "success");
    } catch (error) {
        console.error("IshanCabs: Failed to reject ride", error);
        utils.showAlert(adminAlert, "Rejection transaction failed: " + error.message);
    }
}

// Standard header logout action
async function handleLogout() {
    const confirmLogout = confirm("Are you sure you want to log out of Admin Dashboard?");
    if (confirmLogout) {
        try {
            // Unsubscribe listeners
            if (firestoreUnsubscribe) firestoreUnsubscribe();
            if (firestoreFleetUnsubscribe) firestoreFleetUnsubscribe();
            if (firestoreDriversUnsubscribe) firestoreDriversUnsubscribe();
            if (firebaseAuthUnsubscribe) firebaseAuthUnsubscribe();
            
            await authService.logout();
            window.location.href = "../auth/auth.html";
        } catch (error) {
            console.error("IshanCabs: Admin Logout Error:", error);
            utils.showAlert(adminAlert, "Sign out failed: " + error.message);
        }
    }
}

function initAdminMap(booking) {
    const mapId = `map-admin-${booking.id}`;
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer) return;

    let pickupCoords = booking.trip_details.pickup_coords;
    let dropCoords = booking.trip_details.drop_coords;
    let polyline = booking.trip_details.route_polyline;
    if (typeof polyline === "string") {
        try {
            polyline = JSON.parse(polyline);
        } catch (e) {
            console.error("Failed to parse route_polyline:", e);
            polyline = null;
        }
    }

    // Fallback to predefined coordinates dictionary if not stored
    if (!pickupCoords && booking.trip_details.pickup_location) {
        pickupCoords = terminalCoordinates[booking.trip_details.pickup_location];
    }
    if (booking.trip_details.ride_type !== "rental") {
        if (!dropCoords && booking.trip_details.drop_location) {
            dropCoords = terminalCoordinates[booking.trip_details.drop_location];
        }
    }

    if (!pickupCoords || (booking.trip_details.ride_type !== "rental" && !dropCoords)) {
        console.warn("Could not find coordinates for admin booking map:", booking.id);
        mapContainer.style.display = "block";
        mapContainer.innerHTML = `
            <div class="w-full h-full flex flex-col items-center justify-center bg-slate-950/80 border border-dashed border-slate-800 text-slate-500 rounded-2xl p-4">
                <svg class="w-8 h-8 mb-2 text-slate-600" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <span class="font-bold text-xs text-slate-400">No Map Data</span>
                <span class="text-[10px] text-slate-500 mt-1">Geocoding required to enable route preview.</span>
            </div>
        `;
        return;
    }

    try {
        const map = L.map(mapId, {
            dragging: true,
            touchZoom: true,
            doubleClickZoom: true,
            scrollWheelZoom: false, // Prevents scroll conflicts on panel body
            boxZoom: true,
            keyboard: true,
            zoomControl: true,
            attributionControl: false
        }).setView(pickupCoords, 12);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19
        }).addTo(map);

        const pickupMarker = L.marker(pickupCoords, { title: "Pickup Location" }).addTo(map);
        pickupMarker.bindPopup(`<b>Pickup:</b> ${booking.trip_details.pickup_location}`);

        if (booking.trip_details.ride_type !== "rental") {
            const dropMarker = L.marker(dropCoords, { title: "Drop Location" }).addTo(map);
            dropMarker.bindPopup(`<b>Drop:</b> ${booking.trip_details.drop_location}`);

            if (polyline && polyline.length > 0) {
                L.polyline(polyline, { color: '#f59e0b', weight: 4, opacity: 0.8 }).addTo(map);
            } else {
                L.polyline([pickupCoords, dropCoords], { color: '#f59e0b', weight: 3, opacity: 0.8, dashArray: '5, 5' }).addTo(map);
            }

            const group = new L.featureGroup([pickupMarker, dropMarker]);
            setTimeout(() => {
                map.invalidateSize();
                map.fitBounds(group.getBounds().pad(0.15));
            }, 100);
        } else {
            setTimeout(() => {
                map.invalidateSize();
                map.setView(pickupCoords, 14);
            }, 100);
        }

        adminMaps[booking.id] = map;
    } catch (err) {
        console.error("Failed to initialize admin map:", err);
    }
}

function destroyAllAdminMaps() {
    Object.keys(adminMaps).forEach(id => {
        if (adminMaps[id]) {
            try {
                adminMaps[id].remove();
            } catch (e) {
                console.error("Error removing map instance:", e);
            }
        }
    });
    adminMaps = {};
}

// =========================================================================
// SYSTEM SETTINGS & DYNAMIC FARES CONTROL PANELS
// =========================================================================

function setupViewSwitchers() {
    const tabs = [
        { btn: viewBookingsTab, panel: panelBookings },
        { btn: viewFleetTab, panel: panelFleet },
        { btn: viewDriversTab, panel: panelDrivers },
        { btn: viewSettingsTab, panel: panelSettings },
        { btn: viewLocationsTab, panel: panelLocations }
    ];

    tabs.forEach(tab => {
        if (!tab.btn) return;
        tab.btn.addEventListener("click", () => {
            tabs.forEach(t => {
                if (t.btn) {
                    if (t === tab) {
                        t.btn.className = "pb-4 text-base font-extrabold text-amber-500 border-b-2 border-amber-500 tracking-wide transition-all duration-200";
                        utils.showElement(t.panel);
                    } else {
                        t.btn.className = "pb-4 text-base font-semibold text-slate-400 hover:text-white tracking-wide transition-all duration-200";
                        utils.hideElement(t.panel);
                    }
                }
            });
            if (tab.btn === viewBookingsTab) {
                renderBookings();
            } else if (tab.btn === viewSettingsTab) {
                loadFaresMatrix();
                loadPromoOffers();
            } else if (tab.btn === viewLocationsTab) {
                initLocationFormMap();
                loadLocationsList();
                loadFlatFaresList();
            }
        });
    });
}

// Static default rates mapping fallback configuration
const DEFAULT_RATES = {
    compact: { rate_per_km: 10.00, driver_allowance_per_day: 300.00, rate_per_hour: 120.00, base_cost: 250.00 },
    premium: { rate_per_km: 12.00, driver_allowance_per_day: 300.00, rate_per_hour: 150.00, base_cost: 300.00 },
    suv:     { rate_per_km: 15.00, driver_allowance_per_day: 400.00, rate_per_hour: 200.00, base_cost: 500.00 },
    muv:     { rate_per_km: 18.00, driver_allowance_per_day: 500.00, rate_per_hour: 250.00, base_cost: 700.00 }
};

async function loadFaresMatrix() {
    if (!db) return;
    try {
        const ratesDocRef = doc(db, "settings", "rates");
        const docSnap = await getDoc(ratesDocRef);
        let rates = DEFAULT_RATES;
        
        if (docSnap.exists() && docSnap.data().rates) {
            rates = docSnap.data().rates;
        }
        
        // Hydrate Compact Tier inputs
        fareCompactBase.value = rates.compact?.base_cost ?? 250;
        fareCompactKm.value = rates.compact?.rate_per_km ?? 10.00;
        fareCompactHour.value = rates.compact?.rate_per_hour ?? 120.00;
        fareCompactAllowance.value = rates.compact?.driver_allowance_per_day ?? 300.00;

        // Hydrate Premium Tier inputs
        farePremiumBase.value = rates.premium?.base_cost ?? 300;
        farePremiumKm.value = rates.premium?.rate_per_km ?? 12.00;
        farePremiumHour.value = rates.premium?.rate_per_hour ?? 150.00;
        farePremiumAllowance.value = rates.premium?.driver_allowance_per_day ?? 300.00;

        // Hydrate SUV Tier inputs
        fareSuvBase.value = rates.suv?.base_cost ?? 500;
        fareSuvKm.value = rates.suv?.rate_per_km ?? 15.00;
        fareSuvHour.value = rates.suv?.rate_per_hour ?? 200.00;
        fareSuvAllowance.value = rates.suv?.driver_allowance_per_day ?? 400.00;

        // Hydrate MUV Tier inputs
        fareMuvBase.value = rates.muv?.base_cost ?? 700;
        fareMuvKm.value = rates.muv?.rate_per_km ?? 18.00;
        fareMuvHour.value = rates.muv?.rate_per_hour ?? 250.00;
        fareMuvAllowance.value = rates.muv?.driver_allowance_per_day ?? 500.00;
    } catch (err) {
        console.error("Failed to load fare configurations:", err);
        utils.showAlert(adminAlert, "Error fetching fare configurations: " + err.message);
    }
}

async function handleFaresFormSubmit(e) {
    e.preventDefault();
    if (!db) return;

    utils.showAlert(adminAlert, "Saving fare parameters dynamically...", "success");

    const newRates = {
        compact: {
            base_cost: parseFloat(fareCompactBase.value) || 0,
            rate_per_km: parseFloat(fareCompactKm.value) || 0,
            rate_per_hour: parseFloat(fareCompactHour.value) || 0,
            driver_allowance_per_day: parseFloat(fareCompactAllowance.value) || 0
        },
        premium: {
            base_cost: parseFloat(farePremiumBase.value) || 0,
            rate_per_km: parseFloat(farePremiumKm.value) || 0,
            rate_per_hour: parseFloat(farePremiumHour.value) || 0,
            driver_allowance_per_day: parseFloat(farePremiumAllowance.value) || 0
        },
        suv: {
            base_cost: parseFloat(fareSuvBase.value) || 0,
            rate_per_km: parseFloat(fareSuvKm.value) || 0,
            rate_per_hour: parseFloat(fareSuvHour.value) || 0,
            driver_allowance_per_day: parseFloat(fareSuvAllowance.value) || 0
        },
        muv: {
            base_cost: parseFloat(fareMuvBase.value) || 0,
            rate_per_km: parseFloat(fareMuvKm.value) || 0,
            rate_per_hour: parseFloat(fareMuvHour.value) || 0,
            driver_allowance_per_day: parseFloat(fareMuvAllowance.value) || 0
        }
    };

    try {
        const versionId = "R-" + Date.now();

        // 1. Write the new version to rates_history collection
        const historyDocRef = doc(db, "rates_history", versionId);
        await setDoc(historyDocRef, {
            rates: newRates,
            creation_ts: serverTimestamp()
        });

        // 2. Update settings/rates with active version ID
        const ratesDocRef = doc(db, "settings", "rates");
        await setDoc(ratesDocRef, {
            rates: newRates,
            active_version_id: versionId,
            updated_ts: serverTimestamp()
        });

        utils.showAlert(adminAlert, "Fare matrix saved and history version logged successfully!", "success");
    } catch (err) {
        console.error("Failed to write dynamic settings rates doc:", err);
        utils.showAlert(adminAlert, "Settings updates failed: " + err.message);
    }
}

async function loadPromoOffers() {
    if (!db) return;
    try {
        const offersCol = collection(db, "offers");
        const snap = await getDocs(offersCol);
        activePromosTbody.innerHTML = "";

        if (snap.empty) {
            activePromosTbody.innerHTML = `
                <tr>
                    <td colspan="6" class="py-4 text-center text-slate-500 italic">No coupons active in catalog database.</td>
                </tr>
            `;
            return;
        }

        snap.forEach(docSnap => {
            const offer = docSnap.data();
            const tr = document.createElement("tr");
            tr.className = "border-b border-slate-800/20 hover:bg-slate-900/20 transition-colors";

            const valLabel = offer.discount_type === "percentage" ? `${offer.discount_value}%` : `₹${offer.discount_value}`;
            
            let statusBadge = `<span class="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-2.5 py-1 rounded-xl text-[10px] font-bold">ACTIVE</span>`;
            if (offer.status !== "active") {
                statusBadge = `<span class="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2.5 py-1 rounded-xl text-[10px] font-bold">INACTIVE</span>`;
            }

            const isVisible = offer.visible_to_customer === true;
            let visibleBadge = `<span class="bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">YES</span>`;
            if (!isVisible) {
                visibleBadge = `<span class="bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-lg text-[10px] font-bold">NO</span>`;
            }

            tr.innerHTML = `
                <td class="py-3 px-4 font-bold text-white tracking-wider">${offer.code}</td>
                <td class="py-3 px-4 font-semibold">${valLabel}</td>
                <td class="py-3 px-4 text-slate-400">₹${offer.min_fare_threshold}</td>
                <td class="py-3 px-4">${statusBadge}</td>
                <td class="py-3 px-4">${visibleBadge}</td>
                <td class="py-3 px-4 text-right flex justify-end gap-2">
                    <button type="button" class="btn-toggle-promo bg-slate-850 hover:bg-slate-800 border border-slate-800 text-slate-300 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all" data-code="${offer.code}" data-status="${offer.status || 'active'}">
                        ${offer.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
                    <button type="button" class="btn-delete-promo bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 text-rose-400 text-xs font-semibold px-3 py-1.5 rounded-xl transition-all" data-code="${offer.code}">
                        Delete
                    </button>
                </td>
            `;
            activePromosTbody.appendChild(tr);
        });

        bindPromoActions();
    } catch (err) {
        console.error("Failed to load offers:", err);
        utils.showAlert(adminAlert, "Failed to load active catalog offers: " + err.message);
    }
}

function bindPromoActions() {
    document.querySelectorAll(".btn-toggle-promo").forEach(btn => {
        btn.addEventListener("click", async () => {
            const code = btn.getAttribute("data-code");
            const currentStatus = btn.getAttribute("data-status");
            const nextStatus = currentStatus === "active" ? "inactive" : "active";

            utils.showAlert(adminAlert, `Toggling status of promo ${code}...`, "success");
            try {
                const offerRef = doc(db, "offers", code);
                await updateDoc(offerRef, { status: nextStatus });
                utils.showAlert(adminAlert, `Promo code ${code} status modified to ${nextStatus.toUpperCase()}!`, "success");
                loadPromoOffers();
            } catch (err) {
                console.error("Promo status toggling error:", err);
                utils.showAlert(adminAlert, "Toggling status failed: " + err.message);
            }
        });
    });

    document.querySelectorAll(".btn-delete-promo").forEach(btn => {
        btn.addEventListener("click", async () => {
            const code = btn.getAttribute("data-code");
            if (confirm(`Are you sure you want to permanently delete promo coupon: ${code}?`)) {
                utils.showAlert(adminAlert, `Deleting promo code ${code}...`, "success");
                try {
                    const offerRef = doc(db, "offers", code);
                    await deleteDoc(offerRef);
                    utils.showAlert(adminAlert, `Promo code ${code} deleted successfully.`, "success");
                    loadPromoOffers();
                } catch (err) {
                    console.error("Failed to delete promo doc:", err);
                    utils.showAlert(adminAlert, "Deletion transaction failed: " + err.message);
                }
            }
        });
    });
}

async function handlePromoFormSubmit(e) {
    e.preventDefault();
    if (!db) return;

    const code = promoCodeInput.value.trim().toUpperCase();
    const discountType = promoTypeSelect.value;
    const discountValue = parseFloat(promoValueInput.value) || 0;
    const minFare = parseFloat(promoMinFareInput.value) || 0;
    const visibleToCustomer = promoVisibleInput.checked;

    if (!code) {
        utils.showAlert(adminAlert, "Please specify a promo code name.");
        return;
    }

    utils.showAlert(adminAlert, `Creating new promo offer ${code}...`, "success");
    try {
        const offerRef = doc(db, "offers", code);
        await setDoc(offerRef, {
            code: code,
            discount_type: discountType,
            discount_value: discountValue,
            min_fare_threshold: minFare,
            status: "active",
            visible_to_customer: visibleToCustomer
        });

        utils.showAlert(adminAlert, `Promo coupon code ${code} committed successfully!`, "success");
        promoCodeForm.reset();
        loadPromoOffers();
    } catch (err) {
        console.error("Failed to create offer:", err);
        utils.showAlert(adminAlert, "Offer creation failed: " + err.message);
    }
}

// =========================================================================
// FLEET INVENTORY & DRIVER REGISTRY ACTIONS
// =========================================================================

function startFleetSnapshotListeners() {
    if (!db) return;

    const vehiclesQuery = collection(db, "vehicles");
    firestoreFleetUnsubscribe = onSnapshot(vehiclesQuery, (snapshot) => {
        vehiclesData = [];
        snapshot.forEach(doc => {
            vehiclesData.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort in memory by creation_ts descending, fallback to doc ID
        vehiclesData.sort((a, b) => {
            const tA = a.creation_ts?.seconds || 0;
            const tB = b.creation_ts?.seconds || 0;
            return tB - tA;
        });
        
        renderFleetInventory();
        renderDriverRegistry();
        populateAssociationDropdowns();
        loadFleetRoster();
    }, (error) => {
        console.error("Vehicles stream error:", error);
        utils.showAlert(adminAlert, "Vehicles database stream error: " + error.message);
    });

    const driversQuery = collection(db, "drivers");
    firestoreDriversUnsubscribe = onSnapshot(driversQuery, (snapshot) => {
        driversData = [];
        snapshot.forEach(doc => {
            driversData.push({ id: doc.id, ...doc.data() });
        });
        
        // Sort in memory by creation_ts descending, fallback to doc ID
        driversData.sort((a, b) => {
            const tA = a.creation_ts?.seconds || 0;
            const tB = b.creation_ts?.seconds || 0;
            return tB - tA;
        });
        
        renderDriverRegistry();
        renderFleetInventory();
        populateAssociationDropdowns();
        loadFleetRoster();
    }, (error) => {
        console.error("Drivers stream error:", error);
        utils.showAlert(adminAlert, "Drivers database stream error: " + error.message);
    });
}

function renderFleetInventory() {
    if (!fleetInventoryTbody) return;
    fleetInventoryTbody.innerHTML = "";
    
    if (vehiclesData.length === 0) {
        fleetInventoryTbody.innerHTML = `
            <tr>
                <td colspan="8" class="py-8 text-center text-slate-500 italic">No vehicles registered yet. Click seed defaults to test quickly.</td>
            </tr>
        `;
        utils.showElement(btnSeedFleet);
        return;
    }
    utils.hideElement(btnSeedFleet);

    vehiclesData.forEach(vehicle => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-900/60 hover:bg-slate-900/20 transition-all";
        
        let driverNameStr = "Unassigned";
        if (vehicle.assigned_driver_id) {
            const driverObj = driversData.find(d => d.id === vehicle.assigned_driver_id);
            driverNameStr = driverObj ? `${driverObj.name} (${driverObj.phone})` : "Assigned (Loading...)";
        }

        let tierBadgeClass = "bg-slate-800 text-slate-350";
        if (vehicle.tier === "compact") tierBadgeClass = "bg-teal-500/10 border border-teal-500/20 text-teal-400";
        if (vehicle.tier === "premium") tierBadgeClass = "bg-blue-500/10 border border-blue-500/20 text-blue-400";
        if (vehicle.tier === "suv") tierBadgeClass = "bg-amber-500/10 border border-amber-500/20 text-amber-400";
        if (vehicle.tier === "muv") tierBadgeClass = "bg-purple-500/10 border border-purple-500/20 text-purple-400";

        let statusBadgeClass = "bg-slate-800 text-slate-400";
        if (vehicle.status === "active") statusBadgeClass = "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400";
        if (vehicle.status === "maintenance") statusBadgeClass = "bg-amber-500/10 border border-amber-500/20 text-amber-400";

        tr.innerHTML = `
            <td class="py-4 px-5 font-bold text-white">${vehicle.model}</td>
            <td class="py-4 px-5 font-mono uppercase text-slate-300">${vehicle.plate_number}</td>
            <td class="py-4 px-5">
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${tierBadgeClass} uppercase">${vehicle.tier}</span>
            </td>
            <td class="py-4 px-5 text-slate-300">${vehicle.passengers || 4} Pax</td>
            <td class="py-4 px-5 text-slate-400 text-xs truncate max-w-[150px]" title="${vehicle.address || 'Unspecified'}">${vehicle.address || 'Unspecified'}</td>
            <td class="py-4 px-5 text-slate-400">${driverNameStr}</td>
            <td class="py-4 px-5">
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusBadgeClass} uppercase">${vehicle.status}</span>
            </td>
            <td class="py-4 px-5 text-right space-x-2">
                <button type="button" class="btn-edit-vehicle text-amber-500 hover:underline font-semibold text-xs" data-id="${vehicle.id}">Edit</button>
                <button type="button" class="btn-delete-vehicle text-rose-500 hover:underline font-semibold text-xs" data-id="${vehicle.id}">Delete</button>
            </td>
        `;
        fleetInventoryTbody.appendChild(tr);
    });

    bindFleetActionButtons();
}

function renderDriverRegistry() {
    if (!driverRegistryTbody) return;
    driverRegistryTbody.innerHTML = "";

    if (driversData.length === 0) {
        driverRegistryTbody.innerHTML = `
            <tr>
                <td colspan="7" class="py-8 text-center text-slate-500 italic">No drivers registered yet. Register drivers on the left.</td>
            </tr>
        `;
        return;
    }

    driversData.forEach(driver => {
        const tr = document.createElement("tr");
        tr.className = "border-b border-slate-900/60 hover:bg-slate-900/20 transition-all";

        let vehicleStr = "Unassigned";
        if (driver.assigned_vehicle_id) {
            const vehObj = vehiclesData.find(v => v.id === driver.assigned_vehicle_id);
            vehicleStr = vehObj ? `${vehObj.model} (${vehObj.plate_number})` : "Assigned (Loading...)";
        }

        let statusBadgeClass = "bg-slate-800 text-slate-400";
        if (driver.status === "active") statusBadgeClass = "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400";
        if (driver.status === "sick") statusBadgeClass = "bg-rose-500/10 border border-rose-500/20 text-rose-400";
        if (driver.status === "on_leave") statusBadgeClass = "bg-blue-500/10 border border-blue-500/20 text-blue-400";

        tr.innerHTML = `
            <td class="py-4 px-5 font-bold text-white">${driver.name}</td>
            <td class="py-4 px-5 text-slate-300 font-mono">${driver.phone}</td>
            <td class="py-4 px-5 text-slate-400 text-xs truncate max-w-[150px]" title="${driver.address || 'Unspecified'}">${driver.address || 'Unspecified'}</td>
            <td class="py-4 px-5 text-slate-300 uppercase">${driver.license_number}</td>
            <td class="py-4 px-5 text-slate-400">${vehicleStr}</td>
            <td class="py-4 px-5">
                <span class="px-2 py-0.5 rounded-lg text-[10px] font-bold ${statusBadgeClass} uppercase">${(driver.status || "active").replace('_', ' ')}</span>
            </td>
            <td class="py-4 px-5 text-right space-x-2">
                <button type="button" class="btn-edit-driver text-amber-500 hover:underline font-semibold text-xs" data-id="${driver.id}">Edit</button>
                <button type="button" class="btn-delete-driver text-rose-500 hover:underline font-semibold text-xs" data-id="${driver.id}">Delete</button>
            </td>
        `;
        driverRegistryTbody.appendChild(tr);
    });

    bindDriverActionButtons();
}

function populateAssociationDropdowns(editingVehicleId = null, editingDriverId = null) {
    if (!vehicleDriver || !driverVehicle) return;

    // 1. Vehicle form: Driver selector
    const currentVehicleDriverVal = vehicleDriver.value;
    vehicleDriver.innerHTML = '<option value="">-- None / Unassociated --</option>';
    driversData.forEach(d => {
        if (d.status !== "active") return;
        
        let label = `${d.name} (${d.phone})`;
        if (d.assigned_vehicle_id) {
            const associatedVeh = vehiclesData.find(v => v.id === d.assigned_vehicle_id);
            if (associatedVeh) {
                if (associatedVeh.id === editingVehicleId) {
                    label += " [Currently Assigned]";
                } else {
                    label += ` [Assigned to ${associatedVeh.plate_number}]`;
                }
            }
        }
        
        const opt = document.createElement("option");
        opt.value = d.id;
        opt.textContent = label;
        vehicleDriver.appendChild(opt);
    });
    vehicleDriver.value = currentVehicleDriverVal;

    // 2. Driver form: Vehicle selector
    const currentDriverVehicleVal = driverVehicle.value;
    driverVehicle.innerHTML = '<option value="">-- None / Unassociated --</option>';
    vehiclesData.forEach(v => {
        if (v.status !== "active") return;
        
        let label = `${v.model} (${v.plate_number}) - ${v.tier.toUpperCase()}`;
        if (v.assigned_driver_id) {
            const associatedD = driversData.find(d => d.id === v.assigned_driver_id);
            if (associatedD) {
                if (associatedD.id === editingDriverId) {
                    label += " [Currently Assigned]";
                } else {
                    label += ` [Assigned to ${associatedD.name}]`;
                }
            }
        }

        const opt = document.createElement("option");
        opt.value = v.id;
        opt.textContent = label;
        driverVehicle.appendChild(opt);
    });
    driverVehicle.value = currentDriverVehicleVal;
}

async function handleVehicleFormSubmit(e) {
    e.preventDefault();
    if (!db) return;

    const modelVal = vehicleModel.value.trim();
    const plateVal = vehiclePlate.value.trim().toUpperCase().replace(/\s+/g, '-');
    const tierVal = vehicleTier.value;
    const passengersVal = parseInt(vehiclePassengers.value) || 4;
    const addressVal = vehicleAddress.value.trim();
    const statusVal = vehicleStatus.value;
    const driverIdVal = vehicleDriver.value; 
    const editId = vehicleEditId.value;

    const standardizedId = plateVal.replace(/[^A-Z0-9]/g, ""); 

    utils.showAlert(adminAlert, "Saving vehicle in inventory...", "success");

    try {
        const vehicleDocRef = doc(db, "vehicles", standardizedId);

        if (!editId && standardizedId !== editId) {
            const docSnap = await getDoc(vehicleDocRef);
            if (docSnap.exists()) {
                utils.showAlert(adminAlert, `Vehicle with Plate Number ${plateVal} already exists!`);
                return;
            }
        }

        if (editId && editId !== standardizedId) {
            await deleteDoc(doc(db, "vehicles", editId));
        }

        const vehiclePayload = {
            model: modelVal,
            plate_number: plateVal,
            tier: tierVal,
            passengers: passengersVal,
            address: addressVal,
            status: statusVal,
            assigned_driver_id: driverIdVal || null,
            creation_ts: serverTimestamp()
        };

        await setDoc(vehicleDocRef, vehiclePayload);

        // Link driver bidirectionally
        if (driverIdVal) {
            const driverDocRef = doc(db, "drivers", driverIdVal);
            const driverSnap = await getDoc(driverDocRef);
            if (driverSnap.exists()) {
                const driverData = driverSnap.data();
                const previousAssignedVehicleId = driverData.assigned_vehicle_id;
                
                if (previousAssignedVehicleId && previousAssignedVehicleId !== standardizedId) {
                    await updateDoc(doc(db, "vehicles", previousAssignedVehicleId), {
                        assigned_driver_id: null
                    });
                }
            }
            await updateDoc(driverDocRef, {
                assigned_vehicle_id: standardizedId
            });
        } else {
            // If we unassigned the driver, clear their driver record
            if (editId) {
                const prevVeh = vehiclesData.find(v => v.id === editId);
                if (prevVeh && prevVeh.assigned_driver_id) {
                    await updateDoc(doc(db, "drivers", prevVeh.assigned_driver_id), {
                        assigned_vehicle_id: null
                    });
                }
            }
        }

        // Unlink old driver if changed
        if (editId && driverIdVal) {
            const prevVehDoc = vehiclesData.find(v => v.id === editId);
            if (prevVehDoc && prevVehDoc.assigned_driver_id && prevVehDoc.assigned_driver_id !== driverIdVal) {
                await updateDoc(doc(db, "drivers", prevVehDoc.assigned_driver_id), {
                    assigned_vehicle_id: null
                });
            }
        }

        resetVehicleForm();
        utils.showAlert(adminAlert, "Vehicle details saved successfully!", "success");
    } catch (error) {
        console.error("Failed to save vehicle:", error);
        utils.showAlert(adminAlert, "Failed to save vehicle: " + error.message);
    }
}

async function handleDriverFormSubmit(e) {
    e.preventDefault();
    if (!db) return;

    const nameVal = driverName.value.trim();
    const addressVal = driverAddress.value.trim();
    const phoneVal = driverPhone.value.trim();
    const licenseVal = driverLicense.value.trim().toUpperCase();
    const statusVal = driverStatus.value;
    const vehicleIdVal = driverVehicle.value;
    const editId = driverEditId.value;

    const standardizedId = phoneVal.replace(/[^0-9]/g, ""); 

    utils.showAlert(adminAlert, "Registering driver operator...", "success");

    try {
        const driverDocRef = doc(db, "drivers", standardizedId);

        if (!editId && standardizedId !== editId) {
            const docSnap = await getDoc(driverDocRef);
            if (docSnap.exists()) {
                utils.showAlert(adminAlert, `Driver with phone number ${phoneVal} is already registered!`);
                return;
            }
        }

        if (editId && editId !== standardizedId) {
            await deleteDoc(doc(db, "drivers", editId));
        }

        const driverPayload = {
            name: nameVal,
            address: addressVal,
            phone: phoneVal,
            license_number: licenseVal,
            status: statusVal,
            assigned_vehicle_id: vehicleIdVal || null,
            creation_ts: serverTimestamp()
        };

        await setDoc(driverDocRef, driverPayload);

        // Link vehicle bidirectionally
        if (vehicleIdVal) {
            const vehDocRef = doc(db, "vehicles", vehicleIdVal);
            const vehSnap = await getDoc(vehDocRef);
            if (vehSnap.exists()) {
                const vehData = vehSnap.data();
                const previousAssignedDriverId = vehData.assigned_driver_id;
                
                if (previousAssignedDriverId && previousAssignedDriverId !== standardizedId) {
                    await updateDoc(doc(db, "drivers", previousAssignedDriverId), {
                        assigned_vehicle_id: null
                    });
                }
            }
            await updateDoc(vehDocRef, {
                assigned_driver_id: standardizedId
            });
        } else {
            if (editId) {
                const prevDrv = driversData.find(d => d.id === editId);
                if (prevDrv && prevDrv.assigned_vehicle_id) {
                    await updateDoc(doc(db, "vehicles", prevDrv.assigned_vehicle_id), {
                        assigned_driver_id: null
                    });
                }
            }
        }

        // Unlink old vehicle if changed
        if (editId && vehicleIdVal) {
            const prevDriverDoc = driversData.find(d => d.id === editId);
            if (prevDriverDoc && prevDriverDoc.assigned_vehicle_id && prevDriverDoc.assigned_vehicle_id !== vehicleIdVal) {
                await updateDoc(doc(db, "vehicles", prevDriverDoc.assigned_vehicle_id), {
                    assigned_driver_id: null
                });
            }
        }

        resetDriverForm();
        utils.showAlert(adminAlert, "Driver registry updated successfully!", "success");
    } catch (error) {
        console.error("Failed to save driver:", error);
        utils.showAlert(adminAlert, "Failed to save driver: " + error.message);
    }
}

function bindFleetActionButtons() {
    const editBtns = document.querySelectorAll(".btn-edit-vehicle");
    editBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const vehicle = vehiclesData.find(v => v.id === id);
            if (vehicle) {
                vehicleEditId.value = vehicle.id;
                vehicleModel.value = vehicle.model;
                vehiclePlate.value = vehicle.plate_number;
                vehicleTier.value = vehicle.tier;
                vehiclePassengers.value = vehicle.passengers || "";
                vehicleAddress.value = vehicle.address || "";
                vehicleStatus.value = vehicle.status;
                
                populateAssociationDropdowns(vehicle.id, null);
                vehicleDriver.value = vehicle.assigned_driver_id || "";

                document.getElementById("fleet-form-title").textContent = "Edit Vehicle";
                utils.showElement(btnCancelVehicle);
                utils.showElement(vehicleModal);
            }
        });
    });

    const deleteBtns = document.querySelectorAll(".btn-delete-vehicle");
    deleteBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const confirmDelete = confirm(`Are you sure you want to delete vehicle ${id}?`);
            if (confirmDelete && db) {
                try {
                    utils.showAlert(adminAlert, "Deleting vehicle...", "success");
                    
                    const vehicleObj = vehiclesData.find(v => v.id === id);
                    if (vehicleObj && vehicleObj.assigned_driver_id) {
                        await updateDoc(doc(db, "drivers", vehicleObj.assigned_driver_id), {
                            assigned_vehicle_id: null
                        });
                    }
                    
                    await deleteDoc(doc(db, "vehicles", id));
                    utils.showAlert(adminAlert, "Vehicle deleted successfully!", "success");
                } catch (e) {
                    console.error(e);
                    utils.showAlert(adminAlert, "Delete failed: " + e.message);
                }
            }
        });
    });
}

function bindDriverActionButtons() {
    const editBtns = document.querySelectorAll(".btn-edit-driver");
    editBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const id = btn.getAttribute("data-id");
            const driver = driversData.find(d => d.id === id);
            if (driver) {
                driverEditId.value = driver.id;
                driverName.value = driver.name;
                driverPhone.value = driver.phone;
                driverLicense.value = driver.license_number;
                driverAddress.value = driver.address || "";
                driverStatus.value = driver.status;

                populateAssociationDropdowns(null, driver.id);
                driverVehicle.value = driver.assigned_vehicle_id || "";

                document.getElementById("driver-form-title").textContent = "Edit Driver";
                utils.showElement(btnCancelDriver);
                utils.showElement(driverModal);
            }
        });
    });

    const deleteBtns = document.querySelectorAll(".btn-delete-driver");
    deleteBtns.forEach(btn => {
        btn.addEventListener("click", async () => {
            const id = btn.getAttribute("data-id");
            const confirmDelete = confirm(`Are you sure you want to delete driver ${id}?`);
            if (confirmDelete && db) {
                try {
                    utils.showAlert(adminAlert, "Deleting driver...", "success");
                    
                    const driverObj = driversData.find(d => d.id === id);
                    if (driverObj && driverObj.assigned_vehicle_id) {
                        await updateDoc(doc(db, "vehicles", driverObj.assigned_vehicle_id), {
                            assigned_driver_id: null
                        });
                    }

                    await deleteDoc(doc(db, "drivers", id));
                    utils.showAlert(adminAlert, "Driver deleted successfully!", "success");
                } catch (e) {
                    console.error(e);
                    utils.showAlert(adminAlert, "Delete failed: " + e.message);
                }
            }
        });
    });
}

function resetVehicleForm() {
    vehicleEditId.value = "";
    vehicleModel.value = "";
    vehiclePlate.value = "";
    vehicleTier.value = "premium";
    vehiclePassengers.value = "";
    vehicleAddress.value = "";
    vehicleStatus.value = "active";
    vehicleDriver.value = "";
    document.getElementById("fleet-form-title").textContent = "Add Vehicle";
    utils.hideElement(btnCancelVehicle);
    if (vehicleModal) utils.hideElement(vehicleModal);
    populateAssociationDropdowns();
}

function resetDriverForm() {
    driverEditId.value = "";
    driverName.value = "";
    driverAddress.value = "";
    driverPhone.value = "";
    driverLicense.value = "";
    driverStatus.value = "active";
    driverVehicle.value = "";
    document.getElementById("driver-form-title").textContent = "Register Driver";
    utils.hideElement(btnCancelDriver);
    if (driverModal) utils.hideElement(driverModal);
    populateAssociationDropdowns();
}

async function seedDefaultFleet() {
    if (!db) return;
    utils.showAlert(adminAlert, "Seeding default fleet data into database...", "success");
    try {
        const response = await fetch("../booking/dummyFleet.json");
        if (!response.ok) throw new Error("Failed to load dummyFleet.json");
        const dummyData = await response.json();

        const modelMapping = {
            compact: "Maruti Alto K10",
            premium: "Maruti Swift Dzire",
            suv: "Hyundai Creta",
            muv: "Toyota Innova"
        };

        let count = 0;
        for (const tier of Object.keys(dummyData)) {
            const driversList = dummyData[tier];
            for (const item of driversList) {
                const vehiclePlateClean = item.vehicle_number.toUpperCase().trim();
                const vehicleId = vehiclePlateClean.replace(/[^A-Z0-9]/g, ""); 
                
                const driverPhoneClean = item.driver_phone.trim();
                const driverId = driverPhoneClean.replace(/[^0-9]/g, ""); 
                
                const randomLicenseNum = "DL-" + Math.floor(1000000000 + Math.random() * 9000000000);

                const vehRef = doc(db, "vehicles", vehicleId);
                await setDoc(vehRef, {
                    model: modelMapping[tier] || "Fleet Car",
                    plate_number: vehiclePlateClean,
                    tier: tier,
                    status: "active",
                    assigned_driver_id: driverId,
                    passengers: tier === "compact" ? 4 : (tier === "premium" ? 4 : (tier === "suv" ? 6 : 12)),
                    address: "Main Garage, Kolkata",
                    creation_ts: serverTimestamp()
                });

                const drvRef = doc(db, "drivers", driverId);
                await setDoc(drvRef, {
                    name: item.driver_name,
                    phone: driverPhoneClean,
                    license_number: randomLicenseNum,
                    status: "active",
                    assigned_vehicle_id: vehicleId,
                    address: "Kolkata City Depot",
                    creation_ts: serverTimestamp()
                });

                count++;
            }
        }

        utils.showAlert(adminAlert, `Successfully seeded ${count} drivers and vehicles into Firestore!`, "success");
    } catch (err) {
        console.error("Seeding failed:", err);
        utils.showAlert(adminAlert, "Seeding inventory failed: " + err.message);
    }
}

async function runRetrospectiveUpdates() {
    if (!db) return;
    try {
        const vehiclesSnap = await getDocs(collection(db, "vehicles"));
        let updatedCount = 0;
        for (const docSnap of vehiclesSnap.docs) {
            const data = docSnap.data();
            let needsUpdate = false;
            const updatePayload = {};

            // 1. Rename sedan to premium
            if (data.tier === "sedan") {
                updatePayload.tier = "premium";
                needsUpdate = true;
            }

            // 2. Set default passengers based on tier (existing: Sedan/Premium-4, SUV-6, MUV-12)
            if (data.passengers === undefined) {
                const currentTier = updatePayload.tier || data.tier;
                if (currentTier === "premium" || currentTier === "sedan") {
                    updatePayload.passengers = 4;
                } else if (currentTier === "suv") {
                    updatePayload.passengers = 6;
                } else if (currentTier === "muv") {
                    updatePayload.passengers = 12;
                } else {
                    updatePayload.passengers = 4;
                }
                needsUpdate = true;
            }

            // 3. Set default address if missing
            if (data.address === undefined) {
                updatePayload.address = "Main Garage, Kolkata";
                needsUpdate = true;
            }

            if (needsUpdate) {
                await updateDoc(docSnap.ref, updatePayload);
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            console.log(`[Retrospective Sync] Successfully updated ${updatedCount} vehicles with new schema fields.`);
        }

        // Also check drivers for address
        const driversSnap = await getDocs(collection(db, "drivers"));
        let driversUpdatedCount = 0;
        for (const docSnap of driversSnap.docs) {
            const data = docSnap.data();
            if (data.address === undefined) {
                await updateDoc(docSnap.ref, {
                    address: "Kolkata City Depot"
                });
                driversUpdatedCount++;
            }
        }
        if (driversUpdatedCount > 0) {
            console.log(`[Retrospective Sync] Successfully updated ${driversUpdatedCount} drivers with default address.`);
        }

        // Check if settings/rates has the new compact rate and updated premium name
        const ratesDocRef = doc(db, "settings", "rates");
        const ratesSnap = await getDoc(ratesDocRef);
        if (ratesSnap.exists()) {
            const ratesData = ratesSnap.data();
            let ratesNeedUpdate = false;
            const newRates = { ...ratesData.rates };

            // Rename sedan to premium if present
            if (ratesData.rates?.sedan && !ratesData.rates?.premium) {
                newRates.premium = ratesData.rates.sedan;
                delete newRates.sedan;
                ratesNeedUpdate = true;
            }

            // Add compact if missing
            if (!ratesData.rates?.compact) {
                newRates.compact = {
                    base_cost: 250,
                    rate_per_km: 10.00,
                    rate_per_hour: 120.00,
                    driver_allowance_per_day: 300.00
                };
                ratesNeedUpdate = true;
            }

            if (ratesNeedUpdate) {
                await updateDoc(ratesDocRef, {
                    rates: newRates
                });
                console.log(`[Retrospective Sync] Updated fare matrix settings to include Compact and Premium Ride.`);
            }
        }

        // 4. Seed Predefined Locations if empty
        const locationsSnap = await getDocs(collection(db, "locations"));
        if (locationsSnap.empty) {
            console.log("[Retrospective Sync] Seeding predefined locations into Firestore...");
            for (const [name, coords] of Object.entries(terminalCoordinates)) {
                const locId = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                const docRef = doc(db, "locations", locId);
                await setDoc(docRef, {
                    id: locId,
                    name: name,
                    lat: coords[0],
                    lng: coords[1],
                    type: "both",
                    creation_ts: serverTimestamp()
                });
            }
            console.log("[Retrospective Sync] Predefined locations seeded successfully.");
        }

        // 5. Seed Predefined Flat Fares if empty
        const flatFaresSnap = await getDocs(collection(db, "flat_fares"));
        if (flatFaresSnap.empty) {
            console.log("[Retrospective Sync] Seeding predefined flat fares into Firestore...");
            for (const [pickupName, drops] of Object.entries(routesMatrix)) {
                const pickupId = pickupName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                for (const [dropName, metrics] of Object.entries(drops)) {
                    const dropId = dropName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
                    const combinedId = `${pickupId}_${dropId}`;
                    const docRef = doc(db, "flat_fares", combinedId);
                    await setDoc(docRef, {
                        id: combinedId,
                        pickup_name: pickupName,
                        drop_name: dropName,
                        fares: {
                            compact: Math.round((metrics.base_fare_sedan || 999) * 0.85),
                            premium: metrics.base_fare_sedan || 999,
                            suv: metrics.base_fare_suv || 1499,
                            muv: Math.round((metrics.base_fare_suv || 1499) * 1.25)
                        },
                        creation_ts: serverTimestamp()
                    });
                }
            }
            console.log("[Retrospective Sync] Predefined flat fares seeded successfully.");
        }
    } catch (err) {
        console.error("[Retrospective Sync] Error running schema updates:", err);
    }
}

// =========================================================================
// PREDEFINED LOCATIONS & FLAT FARES CRUD MANAGEMENT
// =========================================================================

function initLocationFormMap() {
    const kolkataCenter = [22.5726, 88.3639];

    if (!locationMapInstance) {
        // Initialize Map
        locationMapInstance = L.map('location-form-map').setView(kolkataCenter, 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(locationMapInstance);

        // Map Click Listener
        locationMapInstance.on('click', (e) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            updateLocationFormMarker(lat, lng);
        });

        // Search Handlers
        btnLocationMapSearch.addEventListener("click", handleLocationMapSearch);
        locationMapSearch.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleLocationMapSearch();
            }
        });

        // Form Submission
        addLocationForm.addEventListener("submit", handleAddLocationSubmit);
        flatFareForm.addEventListener("submit", handleFlatFareSubmit);
    } else {
        setTimeout(() => {
            locationMapInstance.invalidateSize();
        }, 100);
    }
}

function updateLocationFormMarker(lat, lng) {
    locationLat.value = lat.toFixed(6);
    locationLng.value = lng.toFixed(6);

    if (locationMapMarker) {
        locationMapMarker.setLatLng([lat, lng]);
    } else {
        locationMapMarker = L.marker([lat, lng], { draggable: true }).addTo(locationMapInstance);
        locationMapMarker.on('dragend', () => {
            const pos = locationMapMarker.getLatLng();
            locationLat.value = pos.lat.toFixed(6);
            locationLng.value = pos.lng.toFixed(6);
        });
    }
}

async function handleLocationMapSearch() {
    const queryStr = locationMapSearch.value.trim();
    if (!queryStr) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`, {
            headers: { 'Accept-Language': 'en' }
        });
        if (!response.ok) throw new Error("Search request failed");
        const results = await response.json();
        if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            
            locationMapInstance.setView([lat, lng], 14);
            updateLocationFormMarker(lat, lng);
        } else {
            alert("No locations found for your search query.");
        }
    } catch (err) {
        console.error("Geocoding search failed:", err);
        alert("Search failed: " + err.message);
    }
}

async function handleAddLocationSubmit(e) {
    e.preventDefault();
    const name = locationName.value.trim();
    const type = locationType.value;
    const lat = parseFloat(locationLat.value);
    const lng = parseFloat(locationLng.value);

    if (!name || isNaN(lat) || isNaN(lng)) {
        utils.showAlert(adminAlert, "Please fill out all fields and select a point on the map.");
        return;
    }

    const locId = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    
    utils.showAlert(adminAlert, "Saving predefined location...", "success");

    try {
        await setDoc(doc(db, "locations", locId), {
            id: locId,
            name: name,
            type: type,
            lat: lat,
            lng: lng,
            creation_ts: serverTimestamp()
        });

        utils.showAlert(adminAlert, `Successfully saved predefined location: ${name}!`, "success");
        
        // Reset form
        locationName.value = "";
        locationType.value = "both";
        locationLat.value = "";
        locationLng.value = "";
        locationMapSearch.value = "";
        if (locationMapMarker) {
            locationMapInstance.removeLayer(locationMapMarker);
            locationMapMarker = null;
        }
    } catch (error) {
        console.error("Failed to add location:", error);
        utils.showAlert(adminAlert, "Failed to save location: " + error.message);
    }
}

async function handleFlatFareSubmit(e) {
    e.preventDefault();
    const pickupName = flatFarePickup.value;
    const dropName = flatFareDrop.value;
    const compactVal = parseInt(flatFareCompact.value);
    const premiumVal = parseInt(flatFarePremium.value);
    const suvVal = parseInt(flatFareSuv.value);
    const muvVal = parseInt(flatFareMuv.value);

    if (!pickupName || !dropName || isNaN(compactVal) || isNaN(premiumVal) || isNaN(suvVal) || isNaN(muvVal)) {
        utils.showAlert(adminAlert, "Please specify route endpoints and fares for all categories.");
        return;
    }

    if (pickupName === dropName) {
        utils.showAlert(adminAlert, "Pickup and drop locations cannot be identical.");
        return;
    }

    const pickupId = pickupName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const dropId = dropName.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const combinedId = `${pickupId}_${dropId}`;

    utils.showAlert(adminAlert, "Saving flat fare override...", "success");

    try {
        await setDoc(doc(db, "flat_fares", combinedId), {
            id: combinedId,
            pickup_name: pickupName,
            drop_name: dropName,
            fares: {
                compact: compactVal,
                premium: premiumVal,
                suv: suvVal,
                muv: muvVal
            },
            creation_ts: serverTimestamp()
        });

        utils.showAlert(adminAlert, `Flat fare override configured for route: ${pickupName} to ${dropName}!`, "success");
        
        // Reset form
        flatFareCompact.value = "";
        flatFarePremium.value = "";
        flatFareSuv.value = "";
        flatFareMuv.value = "";
        flatFarePickup.value = "";
        flatFareDrop.value = "";
    } catch (error) {
        console.error("Failed to save flat fare:", error);
        utils.showAlert(adminAlert, "Failed to save flat fare: " + error.message);
    }
}

let activeLocationsListener = null;
function loadLocationsList() {
    if (activeLocationsListener) activeLocationsListener();

    activeLocationsListener = onSnapshot(query(collection(db, "locations"), orderBy("name")), (snapshot) => {
        locationsListTbody.innerHTML = "";
        
        // Hydrate dropdown selects
        const pickupOpts = ['<option value="" disabled selected>Select Pickup Location</option>'];
        const dropOpts = ['<option value="" disabled selected>Select Drop Location</option>'];

        snapshot.forEach(docSnap => {
            const loc = docSnap.data();
            
            const tr = document.createElement("tr");
            tr.className = "border-b border-slate-800/40 hover:bg-slate-900/10 transition-colors";
            
            let typeBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">Both</span>`;
            if (loc.type === "pickup") {
                typeBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">Pickup Only</span>`;
            } else if (loc.type === "drop") {
                typeBadge = `<span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">Drop Only</span>`;
            }

            tr.innerHTML = `
                <td class="py-3 font-semibold text-white">${loc.name}</td>
                <td class="py-3">${typeBadge}</td>
                <td class="py-3 font-mono text-slate-400">${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}</td>
                <td class="py-3 text-right">
                    <button type="button" class="btn-delete-location text-rose-400 hover:text-rose-300 font-bold hover:underline" data-id="${loc.id}">Delete</button>
                </td>
            `;
            locationsListTbody.appendChild(tr);

            // Hydrate flat fare config selects
            if (loc.type === "pickup" || loc.type === "both") {
                pickupOpts.push(`<option value="${loc.name}">${loc.name}</option>`);
            }
            if (loc.type === "drop" || loc.type === "both") {
                dropOpts.push(`<option value="${loc.name}">${loc.name}</option>`);
            }
        });

        flatFarePickup.innerHTML = pickupOpts.join("");
        flatFareDrop.innerHTML = dropOpts.join("");

        // Bind deletes
        document.querySelectorAll(".btn-delete-location").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                if (confirm("Are you sure you want to delete this predefined location? This will disable matching routes and flat fares.")) {
                    utils.showAlert(adminAlert, "Deleting location...", "success");
                    try {
                        await deleteDoc(doc(db, "locations", id));
                        utils.showAlert(adminAlert, "Location deleted successfully.", "success");
                    } catch (error) {
                        utils.showAlert(adminAlert, "Delete failed: " + error.message);
                    }
                }
            });
        });
    }, (error) => {
        console.error("Locations listener failed:", error);
    });
}

let activeFlatFaresListener = null;
function loadFlatFaresList() {
    if (activeFlatFaresListener) activeFlatFaresListener();

    activeFlatFaresListener = onSnapshot(query(collection(db, "flat_fares"), orderBy("pickup_name")), (snapshot) => {
        flatFaresListTbody.innerHTML = "";
        snapshot.forEach(docSnap => {
            const fareDoc = docSnap.data();
            
            const tr = document.createElement("tr");
            tr.className = "border-b border-slate-800/40 hover:bg-slate-900/10 transition-colors";
            
            tr.innerHTML = `
                <td class="py-3 font-semibold text-white">
                    <div class="flex items-center gap-1">
                        <span class="text-slate-300">${fareDoc.pickup_name}</span>
                        <span class="text-amber-500">→</span>
                        <span class="text-slate-300">${fareDoc.drop_name}</span>
                    </div>
                </td>
                <td class="py-3 text-center text-slate-300 font-medium">₹${fareDoc.fares.compact}</td>
                <td class="py-3 text-center text-slate-300 font-medium">₹${fareDoc.fares.premium}</td>
                <td class="py-3 text-center text-slate-300 font-medium">₹${fareDoc.fares.suv}</td>
                <td class="py-3 text-center text-slate-300 font-medium">₹${fareDoc.fares.muv}</td>
                <td class="py-3 text-right">
                    <button type="button" class="btn-delete-flatfare text-rose-400 hover:text-rose-300 font-bold hover:underline" data-id="${fareDoc.id}">Delete</button>
                </td>
            `;
            flatFaresListTbody.appendChild(tr);
        });

        // Bind deletes
        document.querySelectorAll(".btn-delete-flatfare").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                if (confirm("Are you sure you want to delete this flat fare override? Driving calculations will fallback OSRM distance pricing.")) {
                    utils.showAlert(adminAlert, "Deleting override...", "success");
                    try {
                        await deleteDoc(doc(db, "flat_fares", id));
                        utils.showAlert(adminAlert, "Flat fare override deleted successfully.", "success");
                    } catch (error) {
                        utils.showAlert(adminAlert, "Delete failed: " + error.message);
                    }
                }
            });
        });
    }, (error) => {
        console.error("Flat fares listener failed:", error);
    });
}

// =========================================================================
// APPROVE MODAL CUSTOM GEOCIDING IMPLEMENTATION
// =========================================================================

function initApproveGeocodeMap(booking) {
    const isCustom = !booking.trip_details.pickup_coords || !booking.trip_details.drop_coords;

    if (!isCustom) {
        approveMapSection.classList.add("hidden");
        return;
    }

    approveMapSection.classList.remove("hidden");

    approvePickupAddressText.textContent = booking.trip_details.pickup_location || "Custom Pickup Address";
    approveDropAddressText.textContent = booking.trip_details.drop_location || "Custom Drop Address";
    
    approveMapSearchInput.value = "";
    approveSaveCoords.checked = true;

    approvePickupCoords = null;
    approveDropCoords = null;
    if (approvePickupMarker) {
        if (approveMapInstance) approveMapInstance.removeLayer(approvePickupMarker);
        approvePickupMarker = null;
    }
    if (approveDropMarker) {
        if (approveMapInstance) approveMapInstance.removeLayer(approveDropMarker);
        approveDropMarker = null;
    }

    const kolkataCenter = [22.5726, 88.3639];

    if (!approveMapInstance) {
        approveMapInstance = L.map('approve-map').setView(kolkataCenter, 12);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(approveMapInstance);

        approveMapInstance.on('click', (e) => {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            const target = document.querySelector('input[name="approve-search-target"]:checked')?.value || "pickup";
            if (target === "pickup") {
                approvePickupCoords = [lat, lng];
                if (approvePickupMarker) {
                    approvePickupMarker.setLatLng(e.latlng);
                } else {
                    approvePickupMarker = L.marker(approvePickupCoords, { draggable: true }).addTo(approveMapInstance);
                    approvePickupMarker.on('dragend', () => {
                        const pos = approvePickupMarker.getLatLng();
                        approvePickupCoords = [pos.lat, pos.lng];
                        updateApproveCoordsBadges();
                    });
                }
            } else {
                approveDropCoords = [lat, lng];
                if (approveDropMarker) {
                    approveDropMarker.setLatLng(e.latlng);
                } else {
                    approveDropMarker = L.marker(approveDropCoords, { draggable: true }).addTo(approveMapInstance);
                    approveDropMarker.on('dragend', () => {
                        const pos = approveDropMarker.getLatLng();
                        approveDropCoords = [pos.lat, pos.lng];
                        updateApproveCoordsBadges();
                    });
                }
            }
            updateApproveCoordsBadges();
        });

        btnApproveMapSearch.addEventListener("click", handleApproveMapSearch);
        approveMapSearchInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                handleApproveMapSearch();
            }
        });
    } else {
        approveMapInstance.setView(kolkataCenter, 12);
    }

    setTimeout(() => {
        if (approveMapInstance) approveMapInstance.invalidateSize();
    }, 200);

    geocodeAndPositionMarkers(booking.trip_details.pickup_location, booking.trip_details.drop_location);
}

function updateApproveCoordsBadges() {
    if (approvePickupCoords) {
        approvePickupCoordsBadge.textContent = `Pickup: ${approvePickupCoords[0].toFixed(4)}, ${approvePickupCoords[1].toFixed(4)}`;
    } else {
        approvePickupCoordsBadge.textContent = "Pickup: --, --";
    }

    if (approveDropCoords) {
        approveDropCoordsBadge.textContent = `Drop: ${approveDropCoords[0].toFixed(4)}, ${approveDropCoords[1].toFixed(4)}`;
    } else {
        approveDropCoordsBadge.textContent = "Drop: --, --";
    }
}

async function handleApproveMapSearch() {
    const queryStr = approveMapSearchInput.value.trim();
    if (!queryStr) return;

    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryStr)}&limit=1`, {
            headers: { 'Accept-Language': 'en' }
        });
        if (!response.ok) throw new Error("Search request failed");
        const results = await response.json();
        if (results && results.length > 0) {
            const lat = parseFloat(results[0].lat);
            const lng = parseFloat(results[0].lon);
            
            approveMapInstance.setView([lat, lng], 14);
            const target = document.querySelector('input[name="approve-search-target"]:checked')?.value || "pickup";
            if (target === "pickup") {
                approvePickupCoords = [lat, lng];
                if (approvePickupMarker) {
                    approvePickupMarker.setLatLng([lat, lng]);
                } else {
                    approvePickupMarker = L.marker([lat, lng], { draggable: true }).addTo(approveMapInstance);
                    approvePickupMarker.on('dragend', () => {
                        const pos = approvePickupMarker.getLatLng();
                        approvePickupCoords = [pos.lat, pos.lng];
                        updateApproveCoordsBadges();
                    });
                }
            } else {
                approveDropCoords = [lat, lng];
                if (approveDropMarker) {
                    approveDropMarker.setLatLng([lat, lng]);
                } else {
                    approveDropMarker = L.marker([lat, lng], { draggable: true }).addTo(approveMapInstance);
                    approveDropMarker.on('dragend', () => {
                        const pos = approveDropMarker.getLatLng();
                        approveDropCoords = [pos.lat, pos.lng];
                        updateApproveCoordsBadges();
                    });
                }
            }
            updateApproveCoordsBadges();
        } else {
            alert("No locations found for your search query.");
        }
    } catch (err) {
        console.error("Geocoding search failed:", err);
        alert("Search failed: " + err.message);
    }
}

async function geocodeAndPositionMarkers(pickupText, dropText) {
    updateApproveCoordsBadges();

    let pCoords = null;
    if (pickupText) {
        try {
            const query = encodeURIComponent(pickupText + ", Kolkata, West Bengal, India");
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (response.ok) {
                const results = await response.json();
                if (results && results.length > 0) {
                    pCoords = [parseFloat(results[0].lat), parseFloat(results[0].lon)];
                }
            }
        } catch (e) {
            console.error("Auto geocode pickup failed:", e);
        }
    }

    let dCoords = null;
    if (dropText) {
        try {
            const query = encodeURIComponent(dropText + ", Kolkata, West Bengal, India");
            const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=1`, {
                headers: { 'Accept-Language': 'en' }
            });
            if (response.ok) {
                const results = await response.json();
                if (results && results.length > 0) {
                    dCoords = [parseFloat(results[0].lat), parseFloat(results[0].lon)];
                }
            }
        } catch (e) {
            console.error("Auto geocode drop failed:", e);
        }
    }

    if (!pCoords) {
        pCoords = [22.5726, 88.3639];
    }
    if (!dCoords) {
        dCoords = [22.5833, 88.3414];
    }

    approvePickupCoords = pCoords;
    approveDropCoords = dCoords;

    if (approveMapInstance) {
        approvePickupMarker = L.marker(approvePickupCoords, { draggable: true }).addTo(approveMapInstance);
        approvePickupMarker.bindPopup("<b>Pickup Pin (Draggable)</b>").openPopup();
        approvePickupMarker.on('dragend', () => {
            const pos = approvePickupMarker.getLatLng();
            approvePickupCoords = [pos.lat, pos.lng];
            updateApproveCoordsBadges();
        });

        approveDropMarker = L.marker(approveDropCoords, { draggable: true }).addTo(approveMapInstance);
        approveDropMarker.bindPopup("<b>Drop Pin (Draggable)</b>");
        approveDropMarker.on('dragend', () => {
            const pos = approveDropMarker.getLatLng();
            approveDropCoords = [pos.lat, pos.lng];
            updateApproveCoordsBadges();
        });

        updateApproveCoordsBadges();

        try {
            const group = new L.featureGroup([approvePickupMarker, approveDropMarker]);
            approveMapInstance.fitBounds(group.getBounds().pad(0.15));
        } catch (e) {
            console.error("Failed to fit bounds:", e);
        }
    }
}

