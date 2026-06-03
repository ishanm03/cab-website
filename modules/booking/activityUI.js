// modules/booking/activityUI.js

import { auth, db } from "../shared/firebase.js";
import { utils } from "../shared/utils.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { terminalCoordinates } from "../shared/routesMatrix.js";
import { 
    collection, 
    query, 
    where,
    orderBy, 
    onSnapshot, 
    doc, 
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// DOM Selector Handles
const btnRiderActivity = document.getElementById("btn-rider-activity");
const activityModal = document.getElementById("activity-modal");
const btnCloseActivity = document.getElementById("btn-close-activity");

const activityLoader = document.getElementById("activity-loader");
const activityEmptyState = document.getElementById("activity-empty-state");
const activityListContainer = document.getElementById("activity-list-container");

// State Variables
let currentUser = null;
let activityBookings = [];
let firestoreUnsubscribe = null;
let selectedRating = 5; // Default rating for feedback forms
let riderMaps = {}; // booking.id -> Leaflet map instance

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    initActivityUI();
});

function initActivityUI() {
    if (!btnRiderActivity) return;

    // 1. Listen to Auth State changes
    if (auth) {
        onAuthStateChanged(auth, (user) => {
            if (user && user.email !== "admin@ishancabs.com") {
                currentUser = user;
                utils.showElement(btnRiderActivity);
            } else {
                currentUser = null;
                utils.hideElement(btnRiderActivity);
                utils.hideElement(activityModal);
                stopActivitySnapshotListener();
            }
        });
    }

    // 2. Open Activity modal
    btnRiderActivity.addEventListener("click", () => {
        utils.showElement(activityModal);
        startActivitySnapshotListener();
    });

    // 3. Close Activity modal
    btnCloseActivity.addEventListener("click", () => {
        utils.hideElement(activityModal);
        stopActivitySnapshotListener();
        // Destroy all maps
        Object.keys(riderMaps).forEach(id => destroyRiderMap(id));
    });
}

// Stream the user's specific bookings in real-time
function startActivitySnapshotListener() {
    if (!currentUser || !db) return;

    utils.showElement(activityLoader);
    utils.hideElement(activityEmptyState);
    utils.hideElement(activityListContainer);

    try {
        const activityQuery = query(
            collection(db, "bookings"),
            where("customer_id", "==", currentUser.uid)
        );

        firestoreUnsubscribe = onSnapshot(activityQuery, (snapshot) => {
            activityBookings = [];
            snapshot.forEach((doc) => {
                activityBookings.push({
                    id: doc.id,
                    ...doc.data()
                });
            });

            // Perform in-memory descending sort based on creation_ts to bypass composite index requirements
            activityBookings.sort((a, b) => {
                const timeA = a.creation_ts ? (a.creation_ts.seconds || 0) : 0;
                const timeB = b.creation_ts ? (b.creation_ts.seconds || 0) : 0;
                return timeB - timeA; // Descending
            });

            utils.hideElement(activityLoader);
            renderActivityList();
        }, (error) => {
            console.error("IshanCabs: Rider activity streaming error:", error);
            utils.hideElement(activityLoader);
            activityListContainer.innerHTML = `<p class="text-rose-400 text-xs text-center p-4">Failed to load booking history: ${error.message}</p>`;
            utils.showElement(activityListContainer);
        });
    } catch (err) {
        console.error("IshanCabs: Error initializing activity stream:", err);
        utils.hideElement(activityLoader);
        activityListContainer.innerHTML = `<p class="text-rose-400 text-xs text-center p-4">Error: ${err.message}</p>`;
        utils.showElement(activityListContainer);
    }
}

function stopActivitySnapshotListener() {
    if (firestoreUnsubscribe) {
        firestoreUnsubscribe();
        firestoreUnsubscribe = null;
        console.log("IshanCabs: Unsubscribed from rider bookings stream.");
    }
}

// Render historical and active list elements
function renderActivityList() {
    activityListContainer.innerHTML = "";

    if (activityBookings.length === 0) {
        utils.hideElement(activityListContainer);
        utils.showElement(activityEmptyState);
        return;
    }

    utils.hideElement(activityEmptyState);
    utils.showElement(activityListContainer);

    activityBookings.forEach(booking => {
        const card = document.createElement("div");
        card.className = "bg-slate-950/60 border border-slate-800 p-5 rounded-2xl transition-all duration-300 hover:border-slate-700/60";

        // Style status text & pills
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

        // HTML structure for card summary and collapsible detail panels
        card.innerHTML = `
            <div class="flex justify-between items-start cursor-pointer btn-toggle-details" data-id="${booking.id}">
                <div>
                    <span class="text-[9px] font-black text-slate-500 tracking-wider block uppercase">Booking ID</span>
                    <h4 class="font-bold text-white text-sm tracking-wide">${booking.booking_id}</h4>
                    <p class="text-xs text-slate-400 mt-1">${booking.trip_details.pickup_location} ➔ ${booking.trip_details.drop_location}</p>
                </div>
                <div class="flex flex-col items-end gap-1.5">
                    <span class="border px-2 py-0.5 rounded-lg text-[10px] font-bold ${badgeClass}">
                        ${statusText}
                    </span>
                    <span class="text-xs font-bold text-amber-500">₹${booking.fare_details.estimated_fare}/-</span>
                </div>
            </div>

            <!-- Collapsible Expanded Panel (Hidden initially) -->
            <div id="details-${booking.id}" class="hidden mt-4 pt-4 border-t border-slate-800/60 space-y-4 text-xs transition-all duration-300">
                
                <!-- Static Route Map Preview -->
                <div id="map-rider-${booking.id}" class="h-36 w-full rounded-xl border border-slate-800 overflow-hidden relative z-10 hidden"></div>

                <!-- Journey Route Parameters -->
                <div class="grid grid-cols-2 gap-4">
                    <div>
                        <span class="text-slate-500 block text-[10px]">Pickup Date/Time</span>
                        <span class="font-semibold text-slate-300 block mt-0.5">${dateStr} at ${timeStr}</span>
                    </div>
                    <div>
                        <span class="text-slate-500 block text-[10px]">Vehicle & Route Category</span>
                        <span class="font-semibold text-slate-300 block mt-0.5 uppercase">${booking.fare_details.vehicle_tier} (${booking.trip_details.ride_type})</span>
                    </div>
                </div>

                <!-- Distance and Duration Parameters -->
                <div class="grid grid-cols-2 gap-4 border-y border-slate-800/40 py-3">
                    <div>
                        <span class="text-slate-500 block text-[10px]">Estimated Distance</span>
                        <span class="font-semibold text-slate-300 block mt-0.5">${booking.fare_details.estimated_km} km</span>
                    </div>
                    <div>
                        <span class="text-slate-500 block text-[10px]">Outstation Duration</span>
                        <span class="font-semibold text-slate-300 block mt-0.5">${booking.trip_details.outstation_days || 1} Calendar Days</span>
                    </div>
                </div>

                <!-- Driver Assignment details -->
                ${(booking.status === "confirmed" || booking.status === "completed") && booking.driver_assignment ? `
                <div class="bg-slate-900/40 border border-slate-800/60 p-3 rounded-xl">
                    <span class="text-[9px] font-bold text-slate-500 tracking-wider block uppercase mb-1.5">Your Allocated Driver & Car</span>
                    <div class="grid grid-cols-3 gap-2 text-slate-300">
                        <div>
                            <span class="text-slate-500 block text-[9px]">Driver Name</span>
                            <span class="font-bold block mt-0.5">${booking.driver_assignment.driver_name}</span>
                        </div>
                        <div>
                            <span class="text-slate-500 block text-[9px]">Driver Phone</span>
                            <span class="font-bold block mt-0.5"><a href="tel:${booking.driver_assignment.driver_phone}" class="text-amber-400 hover:underline">${booking.driver_assignment.driver_phone}</a></span>
                        </div>
                        <div>
                            <span class="text-slate-500 block text-[9px]">Vehicle License</span>
                            <span class="font-bold text-amber-400 block mt-0.5 uppercase">${booking.driver_assignment.vehicle_number}</span>
                        </div>
                    </div>
                </div>
                ` : ""}

                <!-- Rejection Details -->
                ${booking.status === "rejected" && booking.rejection_reason ? `
                <div class="bg-rose-950/10 border border-rose-500/10 p-3 rounded-xl">
                    <span class="text-[9px] font-bold text-rose-400 tracking-wider block uppercase mb-0.5">Rejection Reason</span>
                    <p class="text-rose-300 leading-relaxed">${booking.rejection_reason}</p>
                </div>
                ` : ""}

                <!-- Active On-Going Wait Notification -->
                ${booking.status === "confirmed" ? `
                <p class="text-[10px] text-slate-500 text-center italic py-1">Ride is ongoing. Once completed, your feedback review form will unlock.</p>
                ` : ""}

                <!-- Requested Wait Notification -->
                ${booking.status === "pending_approval" ? `
                <p class="text-[10px] text-slate-500 text-center italic py-1">Waiting for dispatch team approval. WhatsApp alerts have reached our controllers.</p>
                ` : ""}

                <!-- Feedback Section: Render review or input fields -->
                ${booking.status === "completed" ? `
                    <div class="border-t border-slate-800/40 pt-4" id="feedback-section-${booking.id}">
                        ${booking.feedback ? `
                            <!-- RENDER STORED FEEDBACK -->
                            <div class="bg-slate-900/20 border border-slate-800/60 p-3 rounded-xl">
                                <div class="flex justify-between items-center mb-1">
                                    <span class="text-[9px] font-bold text-slate-500 tracking-wider uppercase">Your Feedback Summary</span>
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
                        ` : `
                            <!-- RENDER FEEDBACK CAPTURE FORM -->
                            <form class="feedback-submit-form space-y-3" data-id="${booking.id}">
                                <span class="text-[9px] font-bold text-amber-500 tracking-wider block uppercase">Rate Your Experience</span>
                                
                                <!-- Star Selection Nodes -->
                                <div class="flex items-center gap-2">
                                    <span class="text-slate-400">Rating:</span>
                                    <div class="flex text-slate-600 gap-1.5 star-rating-container" data-id="${booking.id}">
                                        ${Array.from({ length: 5 }, (_, i) => `
                                            <button type="button" class="btn-star hover:scale-115 transition-transform text-amber-500" data-val="${i + 1}" aria-label="Rate ${i + 1} Star">
                                                <svg class="w-5 h-5 fill-current" viewBox="0 0 20 20">
                                                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                                </svg>
                                            </button>
                                        `).join("")}
                                    </div>
                                </div>

                                <div>
                                    <textarea placeholder="Write a comment about your trip, driver, or car..." required rows="2" class="w-full bg-slate-950 border border-slate-800 focus:border-amber-500 text-white px-3 py-2.5 rounded-xl outline-none transition-all duration-200 text-xs leading-relaxed comments-input" data-id="${booking.id}"></textarea>
                                </div>

                                <button type="submit" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold py-2.5 px-4 rounded-xl transition-all duration-200 text-xs">
                                    Submit Review
                                </button>
                            </form>
                        `}
                    </div>
                ` : ""}

            </div>
        `;

        activityListContainer.appendChild(card);
    });

    // Bind Details Toggles & Rating Listeners
    bindActivityListInteractiveEvents();
}

// Bind collapsible click actions and stars click selectors
function bindActivityListInteractiveEvents() {
    // 1. Toggle expanded detail cards
    const toggleTriggers = document.querySelectorAll(".btn-toggle-details");
    toggleTriggers.forEach(trigger => {
        trigger.addEventListener("click", () => {
            const bookingId = trigger.getAttribute("data-id");
            const detailPanel = document.getElementById(`details-${bookingId}`);
            const booking = activityBookings.find(b => b.id === bookingId);
            
            if (detailPanel.classList.contains("hidden")) {
                detailPanel.classList.remove("hidden");
                // Subtle slide border glow
                trigger.parentElement.classList.add("border-amber-500/30");
                if (booking) initRiderMap(booking);
            } else {
                detailPanel.classList.add("hidden");
                trigger.parentElement.classList.remove("border-amber-500/30");
                destroyRiderMap(bookingId);
            }
        });
    });

    // 2. Star click handlers in review form
    const forms = document.querySelectorAll(".feedback-submit-form");
    forms.forEach(form => {
        const bookingId = form.getAttribute("data-id");
        const stars = form.querySelectorAll(".btn-star");
        
        // Reset defaults
        let localSelectedRating = 5;

        stars.forEach(star => {
            star.addEventListener("click", () => {
                localSelectedRating = parseInt(star.getAttribute("data-val"));
                
                // Color active stars amber-500 and inactive ones slate-600
                stars.forEach(s => {
                    const val = parseInt(s.getAttribute("data-val"));
                    if (val <= localSelectedRating) {
                        s.className = "btn-star hover:scale-115 transition-transform text-amber-500";
                    } else {
                        s.className = "btn-star hover:scale-115 transition-transform text-slate-600";
                    }
                });
            });
        });

        // 3. Feedback Submission
        form.addEventListener("submit", async (e) => {
            e.preventDefault();
            const commentsText = form.querySelector(".comments-input").value.trim();

            if (!commentsText) {
                alert("Please add a review comment.");
                return;
            }

            const feedbackSection = document.getElementById(`feedback-section-${bookingId}`);
            feedbackSection.innerHTML = '<p class="text-xs text-slate-400 italic text-center py-2">Saving your review...</p>';

            try {
                const bookingDocRef = doc(db, "bookings", bookingId);
                await updateDoc(bookingDocRef, {
                    feedback: {
                        rating: localSelectedRating,
                        comments: commentsText,
                        submitted_ts: serverTimestamp()
                    },
                    updated_ts: serverTimestamp()
                });

                // Success render inside expanded card directly
                feedbackSection.innerHTML = `
                    <div class="bg-slate-900/20 border border-slate-800/60 p-3 rounded-xl mt-2 animate-pulse">
                        <div class="flex justify-between items-center mb-1">
                            <span class="text-[9px] font-bold text-emerald-400 tracking-wider uppercase">Review Submitted!</span>
                            <div class="flex text-amber-500 gap-0.5">
                                ${Array.from({ length: 5 }, (_, i) => `
                                    <svg class="w-3 h-3 ${i < localSelectedRating ? "fill-current" : "stroke-current text-slate-600 fill-none"}" viewBox="0 0 20 20">
                                        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                    </svg>
                                `).join("")}
                            </div>
                        </div>
                        <p class="text-slate-300 italic">"${commentsText}"</p>
                    </div>
                `;
            } catch (error) {
                console.error("IshanCabs: Failed to save rider review", error);
                feedbackSection.innerHTML = `<p class="text-rose-400 text-[10px] text-center">Failed to save review: ${error.message}. Please close and reopen history.</p>`;
            }
        });
    });
}

function initRiderMap(booking) {
    const mapId = `map-rider-${booking.id}`;
    const mapContainer = document.getElementById(mapId);
    if (!mapContainer) return;

    // Show the container
    utils.showElement(mapContainer);

    // If map already exists, return
    if (riderMaps[booking.id]) {
        setTimeout(() => {
            if (riderMaps[booking.id]) {
                riderMaps[booking.id].invalidateSize();
            }
        }, 100);
        return;
    }

    // Retrieve coordinates from booking document
    let pickupCoords = booking.trip_details.pickup_coords;
    let dropCoords = booking.trip_details.drop_coords;
    let polyline = booking.trip_details.route_polyline;

    // Fallback to coordinates dictionary if not found in booking details
    if (!pickupCoords && booking.trip_details.pickup_location) {
        pickupCoords = terminalCoordinates[booking.trip_details.pickup_location];
    }
    if (!dropCoords && booking.trip_details.drop_location) {
        dropCoords = terminalCoordinates[booking.trip_details.drop_location];
    }

    if (!pickupCoords || !dropCoords) {
        console.warn("Could not find coordinates for booking:", booking.id);
        utils.hideElement(mapContainer);
        return;
    }

    try {
        // Initialize Leaflet map
        const map = L.map(mapId, {
            dragging: false,
            touchZoom: false,
            doubleClickZoom: false,
            scrollWheelZoom: false,
            boxZoom: false,
            keyboard: false,
            zoomControl: false,
            attributionControl: false
        }).setView(pickupCoords, 12);

        // Add CartoDB Dark Matter tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 20
        }).addTo(map);

        // Plot Pickup and Drop markers
        const pickupMarker = L.marker(pickupCoords, { title: "Pickup Location" }).addTo(map);
        const dropMarker = L.marker(dropCoords, { title: "Drop Location" }).addTo(map);

        // Bind simple popups
        pickupMarker.bindPopup(`<b>Pickup:</b> ${booking.trip_details.pickup_location}`);
        dropMarker.bindPopup(`<b>Drop:</b> ${booking.trip_details.drop_location}`);

        // Plot polyline
        if (polyline && polyline.length > 0) {
            L.polyline(polyline, { color: '#f59e0b', weight: 4, opacity: 0.8 }).addTo(map);
        } else {
            // Draw straight-line fallback
            L.polyline([pickupCoords, dropCoords], { color: '#f59e0b', weight: 3, opacity: 0.8, dashArray: '5, 5' }).addTo(map);
        }

        // Adjust bounds
        const group = new L.featureGroup([pickupMarker, dropMarker]);
        setTimeout(() => {
            map.invalidateSize();
            map.fitBounds(group.getBounds().pad(0.15));
        }, 100);

        riderMaps[booking.id] = map;
    } catch (err) {
        console.error("Failed to initialize rider map:", err);
    }
}

function destroyRiderMap(bookingId) {
    if (riderMaps[bookingId]) {
        try {
            riderMaps[bookingId].remove();
        } catch (e) {
            console.error("Error removing rider map instance:", e);
        }
        delete riderMaps[bookingId];
    }
    const mapId = `map-rider-${bookingId}`;
    const mapContainer = document.getElementById(mapId);
    if (mapContainer) {
        utils.hideElement(mapContainer);
    }
}
