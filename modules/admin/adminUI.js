// modules/admin/adminUI.js

import { auth, db } from "../shared/firebase.js";
import { authService } from "../auth/authService.js";
import { utils } from "../shared/utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    collection, 
    query, 
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Selector Handles
const adminWelcome = document.getElementById("admin-welcome");
const btnAdminLogout = document.getElementById("btn-admin-logout");

// Stats Counters
const statTotal = document.getElementById("stat-total");
const statRequested = document.getElementById("stat-requested");
const statOngoing = document.getElementById("stat-ongoing");
const statCompleted = document.getElementById("stat-completed");

// Tabs
const tabAll = document.getElementById("tab-all");
const tabReq = document.getElementById("tab-req");
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

// State Variables
let bookingsData = [];
let rosterData = {};
let currentStatusFilter = "all"; // "all" | "pending_approval" | "confirmed" | "completed" | "rejected"
let firebaseAuthUnsubscribe = null;
let firestoreUnsubscribe = null;

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
    let ongoing = bookingsData.filter(b => b.status === "confirmed").length;
    let completed = bookingsData.filter(b => b.status === "completed").length;

    statTotal.textContent = total;
    statRequested.textContent = requested;
    statOngoing.textContent = ongoing;
    statCompleted.textContent = completed;
}

// Bind tabs clicks
function setupFilterTabs() {
    const tabs = [
        { btn: tabAll, filter: "all" },
        { btn: tabReq, filter: "pending_approval" },
        { btn: tabOng, filter: "confirmed" },
        { btn: tabComp, filter: "completed" },
        { btn: tabRej, filter: "rejected" }
    ];

    tabs.forEach(tab => {
        tab.btn.addEventListener("click", () => {
            // Swap visual tab active headers
            tabs.forEach(t => {
                t.btn.className = "flex-1 min-w-[80px] py-2.5 text-xs font-semibold rounded-xl text-slate-400 hover:text-white transition-all duration-200";
            });
            tab.btn.className = "flex-1 min-w-[80px] py-2.5 text-xs font-bold rounded-xl text-amber-500 bg-slate-900 transition-all duration-200";

            currentStatusFilter = tab.filter;
            renderBookings();
        });
    });
}

// Render filtered card summaries
function renderBookings() {
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
            statusText = "On-Going";
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
                        <span class="font-semibold text-amber-500 block mt-0.5">${booking.fare_details.estimated_km} km • ₹${booking.fare_details.estimated_fare}/-</span>
                    </div>
                </div>

                <!-- Rider Info -->
                <div class="text-xs space-y-1">
                    <span class="text-[10px] font-bold text-slate-500 tracking-wider block uppercase">Passenger Details</span>
                    <p class="font-medium text-slate-200">${booking.customer_details.name} • <a href="tel:${booking.customer_details.phone}" class="text-amber-400 hover:underline font-bold">${booking.customer_details.phone}</a></p>
                </div>

                <!-- Driver Allocation Panel -->
                ${(booking.status === "confirmed" || booking.status === "completed") && booking.driver_assignment ? `
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
                ` : ""}

                ${booking.status === "confirmed" ? `
                    <button type="button" class="btn-complete flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200 transform active:scale-95 shadow-md shadow-amber-500/10" data-id="${booking.id}">
                        Mark Completed
                    </button>
                    <button type="button" class="btn-approve flex-1 bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-300 text-xs font-bold py-3 px-3 rounded-xl transition-all duration-200" data-id="${booking.id}">
                        Reassign Driver
                    </button>
                ` : ""}

                ${booking.status === "completed" || booking.status === "rejected" ? `
                    <span class="text-slate-600 text-[10px] uppercase font-bold tracking-widest text-center w-full py-1">Archived History Record</span>
                ` : ""}
            </div>
        `;

        bookingsListContainer.appendChild(card);
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
        const bookingDocRef = doc(db, "bookings", bookingId);
        await updateDoc(bookingDocRef, {
            status: "confirmed",
            driver_assignment: {
                driver_name: driverName,
                driver_phone: driverPhone,
                vehicle_number: vehicleNumber
            },
            updated_ts: serverTimestamp()
        });

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
