// modules/booking/bookingService.js

import { db } from "../shared/firebase.js";
import { 
    collection, 
    addDoc, 
    setDoc, 
    doc, 
    query, 
    where, 
    getDocs, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Static Default Fleet Size Configurations (Fallback if Firestore database is empty)
const DEFAULT_FLEET_SIZES = {
    sedan: 5, // Up to 5 Sedans can be booked concurrently
    suv: 3,   // Up to 3 SUVs can be booked concurrently
    muv: 2    // Up to 2 Group MUVs can be booked concurrently
};

// Rate matrix configurations for custom computations (INR)
const RATE_CONFIG = {
    sedan: { rate_per_km: 12.00, driver_allowance_per_day: 300.00 },
    suv:   { rate_per_km: 15.00, driver_allowance_per_day: 400.00 },
    muv:   { rate_per_km: 18.00, driver_allowance_per_day: 500.00 }
};

const bookingService = {
    /**
     * Calculates the estimated grand total fare for a given trip configuration
     * @param {string} rideType - "local" | "intercity" | "outstation"
     * @param {number} distance - Distance in kilometers (from routesMatrix)
     * @param {number} days - Outstation duration (in days)
     * @param {string} tier - "sedan" | "suv" | "muv"
     * @param {object} flatMetrics - Flat metrics from routeMatrix if available
     * @returns {number} Estimated total fare in INR
     */
    calculateFare(rideType, distance, days, tier, flatMetrics) {
        // Fallback checks
        const actualDays = Math.max(1, parseInt(days) || 1);
        const actualDistance = parseFloat(distance) || 0;
        
        // 1. If Local / Intercity and flat-rates are mapped in our routesMatrix, use them!
        if ((rideType === "local" || rideType === "intercity") && flatMetrics) {
            if (tier === "sedan" && flatMetrics.base_fare_sedan) return flatMetrics.base_fare_sedan;
            if (tier === "suv" && flatMetrics.base_fare_suv) return flatMetrics.base_fare_suv;
            if (tier === "muv") return (flatMetrics.base_fare_suv || 1000) * 1.25; // MUV is 25% premium over SUV flat-rate
        }

        // 2. Fallback or Outstation computations (Round-Trip pricing based on West Bengal standard guidelines)
        const config = RATE_CONFIG[tier] || RATE_CONFIG.sedan;
        
        if (rideType === "outstation") {
            // Outstation standard: Round-trip distance (pickup to drop to pickup)
            const roundTripDistance = actualDistance * 2;
            
            // Standard West Bengal rule: minimum 250 km billed per calendar day
            const minimumBilledDistance = actualDays * 250;
            const finalBilledDistance = Math.max(roundTripDistance, minimumBilledDistance);
            
            // Total = (Billed distance * Rate per km) + (Number of days * Driver daily night allowance)
            const distanceCost = finalBilledDistance * config.rate_per_km;
            const allowanceCost = actualDays * config.driver_allowance_per_day;
            
            return Math.round(distanceCost + allowanceCost);
        } else {
            // Fallback for custom local point-to-point without flat-fares
            const distanceCost = actualDistance * config.rate_per_km;
            const baseCost = tier === "sedan" ? 300 : (tier === "suv" ? 500 : 700);
            return Math.round(baseCost + distanceCost);
        }
    },

    /**
     * Checks if a vehicle tier has availability for the selected pickup date
     * Prevents overbooking by comparing active bookings vs total fleet sizes
     * @param {string} tier - "sedan" | "suv" | "muv"
     * @param {string} dateString - "YYYY-MM-DD"
     * @returns {Promise<boolean>} Available status
     */
    async checkAvailability(tier, dateString) {
        if (!db) {
            console.warn("IshanCabs: Firestore not initialized. Defaulting to full availability.");
            return true;
        }

        try {
            // 1. Determine active fleet size for this tier
            let fleetSize = DEFAULT_FLEET_SIZES[tier] || 2;
            
            try {
                // Check if a vehicles collection lists fleet size dynamically
                const fleetQuery = query(
                    collection(db, "vehicles"),
                    where("tier", "==", tier),
                    where("status", "==", "active")
                );
                const fleetSnap = await getDocs(fleetQuery);
                if (!fleetSnap.empty) {
                    fleetSize = fleetSnap.size;
                }
            } catch (err) {
                console.log("IshanCabs: Falling back to default static fleet size allocations:", err.message);
            }

            // 2. Fetch all conflicting active bookings for this date and tier
            // We search for bookings where status is not cancelled and dates overlap
            const bookingsQuery = query(
                collection(db, "bookings"),
                where("trip_details.pickup_date", "==", dateString),
                where("fare_details.vehicle_tier", "==", tier),
                where("status", "in", ["pending_approval", "confirmed", "active"])
            );
            
            const bookingsSnap = await getDocs(bookingsQuery);
            const activeBookingsCount = bookingsSnap.size;

            console.log(`IshanCabs Inventory Check [${tier} on ${dateString}]: Active Bookings = ${activeBookingsCount}, Fleet Size = ${fleetSize}`);

            // 3. If bookings match or exceed total active fleet, mark as Sold Out!
            return activeBookingsCount < fleetSize;
        } catch (error) {
            console.error("IshanCabs: Error running overbooking check:", error);
            return true; // Fallback to safe true to allow bookings in offline/degraded states
        }
    },

    /**
      * Commits a customer's booking request directly to the Cloud Firestore database
      * @param {object} bookingPayload - Comprehensive booking data matching trip schemas
      * @returns {Promise<string>} Generated Booking ID
      */
    async createBooking(bookingPayload) {
        if (!db) throw new Error("Firestore not initialized.");

        try {
            // Generate a clean date-based readable Booking ID (e.g. BK-20260528-9F8A)
            const dateStamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
            const randomHex = Math.floor(1000 + Math.random() * 9000).toString();
            const bookingId = `BK-${dateStamp}-${randomHex}`;

            // Simple static dummy assignments matching the selected tier (JSON dictionary)
            const dummyFleet = {
                sedan: {
                    driver_name: "Rajesh Kumar",
                    driver_phone: "+918981538038",
                    vehicle_number: "WB-02-A-1111"
                },
                suv: {
                    driver_name: "Subhasis Roy",
                    driver_phone: "+919876543215",
                    vehicle_number: "WB-02-B-6666"
                },
                muv: {
                    driver_name: "Deepak Patel",
                    driver_phone: "+919876543212",
                    vehicle_number: "WB-02-C-9999"
                }
            };

            const tier = bookingPayload.fare_details.vehicle_tier;
            const assignment = dummyFleet[tier] || dummyFleet.sedan;

            const completePayload = {
                ...bookingPayload,
                booking_id: bookingId,
                status: "pending_approval",
                payment_status: "pending",
                driver_assignment: {
                    driver_name: assignment.driver_name,
                    driver_phone: assignment.driver_phone,
                    vehicle_number: assignment.vehicle_number
                },
                creation_ts: serverTimestamp(),
                updated_ts: serverTimestamp()
            };

            // Write explicitly to /bookings/{booking_id}
            await setDoc(doc(db, "bookings", bookingId), completePayload);
            console.log("IshanCabs: Booking logged in Firestore successfully:", bookingId);
            return bookingId;
        } catch (error) {
            console.error("IshanCabs: Error committing booking to database:", error);
            throw error;
        }
    },

    /**
     * Compiles an automated booking confirmation text and returns the WhatsApp API trigger URI
     * @param {object} booking - Committed booking payload
     * @returns {string} WhatsApp API Redirect Link
     */
    compileWhatsAppLink(booking) {
        const supportPhone = "918981538038"; // Dispatch center phone
        
        const text = `🚖 *IshanCabs: New Ride Booking*

*Booking ID:* ${booking.booking_id}
*Customer:* ${booking.customer_details.name} (${booking.customer_details.phone})
*Category:* ${booking.trip_details.ride_type.toUpperCase()}
*Pickup:* ${booking.trip_details.pickup_location}
*Drop:* ${booking.trip_details.drop_location}
*Pickup Date/Time:* ${booking.trip_details.pickup_date} at ${booking.trip_details.pickup_time}
${booking.trip_details.outstation_days ? `*Duration:* ${booking.trip_details.outstation_days} Days\n` : ""}*Car Class:* ${booking.fare_details.vehicle_tier.toUpperCase()}
*Estimated Total:* ₹${booking.fare_details.estimated_fare}/-

Please confirm driver and vehicle allocation details. Thank you!`;

        return `https://wa.me/${supportPhone}?text=${encodeURIComponent(text)}`;
    }
};

export { bookingService };
