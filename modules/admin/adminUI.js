// modules/admin/adminUI.js

import { auth, db } from "../shared/firebase.js";
import { authService } from "../auth/authService.js";
import { utils } from "../shared/utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { terminalCoordinates } from "../shared/routesMatrix.js";
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
const viewSettingsTab = document.getElementById("view-settings-tab");
const panelBookings = document.getElementById("panel-bookings");
const panelSettings = document.getElementById("panel-settings");

// Fares Configuration Form
const faresMatrixForm = document.getElementById("fares-matrix-form");
const fareSedanBase = document.getElementById("fare-sedan-base");
const fareSedanKm = document.getElementById("fare-sedan-km");
const fareSedanHour = document.getElementById("fare-sedan-hour");
const fareSedanAllowance = document.getElementById("fare-sedan-allowance");

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

        // Prefetch settings and promo configuration arrays
        loadFaresMatrix();
        loadPromoOffers();
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

// Pull the central fleet roster JSON relativamente to populate dropdown choices
async function loadFleetRoster() {
    try {
        const response = await fetch("../booking/dummyFleet.json");
        if (response.ok) {
            rosterData = await response.json();
            
            // Hydrate Roster Select dropdown
            approveRosterSelect.innerHTML = '<option value="" selected>-- Type manual details below --</option>';
            
            // Group drivers under vehicle classes
            Object.keys(rosterData).forEach(tier => {
                const group = document.createElement("optgroup");
                group.label = tier.toUpperCase() + " Class";
                
                rosterData[tier].forEach(driver => {
                    const option = document.createElement("option");
                    option.textContent = `${driver.driver_name} (${driver.vehicle_number})`;
                    // Stringify data to capture all metrics easily
                    option.value = JSON.stringify(driver);
                    group.appendChild(option);
                });
                approveRosterSelect.appendChild(group);
            });
        }
    } catch (err) {
        console.warn("IshanCabs: Failed to load dummyFleet roster configurations for dropdown:", err.message);
    }
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

                <!-- Requested Route Map Preview -->
                ${booking.status === "pending_approval" ? `
                <div id="map-admin-${booking.id}" class="h-40 w-full mt-3 rounded-2xl border border-slate-800/80 overflow-hidden relative z-10"></div>
                ` : ""}
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

    // Initialize maps for all requested bookings
    filteredBookings.forEach(booking => {
        if (booking.status === "pending_approval") {
            initAdminMap(booking);
        }
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
                alert("Rider phone details are unavailable.");
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
        alert("Please complete all allocation fields.");
        return;
    }

    utils.hideElement(approvalModal);
    utils.showAlert(adminAlert, "Allocating driver and confirming ride...", "success");

    try {
        const booking = bookingsData.find(b => b.id === bookingId);
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
        alert("Please specify a reason.");
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
            if (firebaseAuthUnsubscribe) firebaseAuthUnsubscribe();
            
            await authService.logout();
            window.location.href = "../auth/auth.html";
        } catch (error) {
            console.error("IshanCabs: Admin Logout Error:", error);
            alert("Sign out failed: " + error.message);
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
        mapContainer.style.display = "none";
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
    viewBookingsTab.addEventListener("click", () => {
        // Swap active tab visual styles
        viewBookingsTab.className = "pb-4 text-base font-extrabold text-amber-500 border-b-2 border-amber-500 tracking-wide transition-all duration-200";
        viewSettingsTab.className = "pb-4 text-base font-semibold text-slate-400 hover:text-white tracking-wide transition-all duration-200";
        
        utils.showElement(panelBookings);
        utils.hideElement(panelSettings);
        
        renderBookings();
    });

    viewSettingsTab.addEventListener("click", () => {
        // Swap active tab visual styles
        viewSettingsTab.className = "pb-4 text-base font-extrabold text-amber-500 border-b-2 border-amber-500 tracking-wide transition-all duration-200";
        viewBookingsTab.className = "pb-4 text-base font-semibold text-slate-400 hover:text-white tracking-wide transition-all duration-200";
        
        utils.hideElement(panelBookings);
        utils.showElement(panelSettings);
        
        // Hydrate data grids
        loadFaresMatrix();
        loadPromoOffers();
    });
}

// Static default rates mapping fallback configuration
const DEFAULT_RATES = {
    sedan: { rate_per_km: 12.00, driver_allowance_per_day: 300.00, rate_per_hour: 150.00, base_cost: 300.00 },
    suv:   { rate_per_km: 15.00, driver_allowance_per_day: 400.00, rate_per_hour: 200.00, base_cost: 500.00 },
    muv:   { rate_per_km: 18.00, driver_allowance_per_day: 500.00, rate_per_hour: 250.00, base_cost: 700.00 }
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
        
        // Hydrate Sedan Tier inputs
        fareSedanBase.value = rates.sedan?.base_cost ?? 300;
        fareSedanKm.value = rates.sedan?.rate_per_km ?? 12.00;
        fareSedanHour.value = rates.sedan?.rate_per_hour ?? 150.00;
        fareSedanAllowance.value = rates.sedan?.driver_allowance_per_day ?? 300.00;

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
        sedan: {
            base_cost: parseFloat(fareSedanBase.value) || 0,
            rate_per_km: parseFloat(fareSedanKm.value) || 0,
            rate_per_hour: parseFloat(fareSedanHour.value) || 0,
            driver_allowance_per_day: parseFloat(fareSedanAllowance.value) || 0
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
        const ratesDocRef = doc(db, "settings", "rates");
        await setDoc(ratesDocRef, { rates: newRates });
        utils.showAlert(adminAlert, "Fare matrix saved and updated successfully!", "success");
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
        alert("Please specify a promo code name.");
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

