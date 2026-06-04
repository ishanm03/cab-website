// modules/booking/bookingService.js

import { db } from "../shared/firebase.js";
import { 
    collection, 
    addDoc, 
    setDoc, 
    getDoc,
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
    sedan: { rate_per_km: 12.00, driver_allowance_per_day: 300.00, rate_per_hour: 150.00, base_cost: 300.00 },
    suv:   { rate_per_km: 15.00, driver_allowance_per_day: 400.00, rate_per_hour: 200.00, base_cost: 500.00 },
    muv:   { rate_per_km: 18.00, driver_allowance_per_day: 500.00, rate_per_hour: 250.00, base_cost: 700.00 }
};

const bookingService = {
    /**
     * Calculates the estimated grand total fare for a given trip configuration
     * @param {string} rideType - "local" | "intercity" | "outstation" | "rental"
     * @param {number} distance - Distance in kilometers (from routesMatrix)
     * @param {number} days - Outstation duration (in days)
     * @param {string} tier - "sedan" | "suv" | "muv"
     * @param {object} flatMetrics - Flat metrics from routeMatrix if available
     * @param {number} hours - Rental duration (in hours)
     * @param {object} activeRates - Dynamic rates setting from Firestore
     * @returns {number} Estimated total fare in INR
     */
    calculateFare(rideType, distance, days, tier, flatMetrics, hours = 0, activeRates = null) {
        // Fallback checks
        const actualDays = Math.max(1, parseInt(days) || 1);
        const actualDistance = parseFloat(distance) || 0;
        const actualHours = Math.max(1, parseInt(hours) || 1);
        
        const rates = activeRates || RATE_CONFIG;
        const config = rates[tier] || RATE_CONFIG[tier] || RATE_CONFIG.sedan;
        
        // 1. Hourly rental calculations
        if (rideType === "rental") {
            const hourlyRate = config.rate_per_hour || (tier === "sedan" ? 150 : (tier === "suv" ? 200 : 250));
            return Math.round(hourlyRate * actualHours);
        }

        // 2. If Local / Intercity and flat-rates are mapped in our routesMatrix, use them!
        if ((rideType === "local" || rideType === "intercity") && flatMetrics) {
            if (tier === "sedan" && flatMetrics.base_fare_sedan) return flatMetrics.base_fare_sedan;
            if (tier === "suv" && flatMetrics.base_fare_suv) return flatMetrics.base_fare_suv;
            if (tier === "muv") return (flatMetrics.base_fare_suv || 1000) * 1.25; // MUV is 25% premium over SUV flat-rate
        }

        // 3. Fallback or Outstation computations (Round-Trip pricing based on West Bengal standard guidelines)
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
            const baseCost = config.base_cost || (tier === "sedan" ? 300 : (tier === "suv" ? 500 : 700));
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

            // Simple static dummy assignments matching the selected tier (Fallback if fetch fails)
            let assignment = {
                driver_name: "Rajesh Kumar",
                driver_phone: "+918981538038",
                vehicle_number: "WB-02-A-1111"
            };

            try {
                // Fetch the separate JSON file relatively from modules/booking/
                const response = await fetch("./dummyFleet.json");
                if (response.ok) {
                    const dummyFleet = await response.json();
                    const tier = bookingPayload.fare_details.vehicle_tier;
                    const tierList = dummyFleet[tier] || dummyFleet.sedan;
                    
                    if (tierList && tierList.length > 0) {
                        // Dynamically select a random driver from the nested array of options
                        const randomIndex = Math.floor(Math.random() * tierList.length);
                        assignment = tierList[randomIndex];
                    }
                }
            } catch (err) {
                console.warn("IshanCabs: Fallback to local dummy assignment due to fetch error:", err.message);
            }

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
    },

    /**
     * Fetches dynamic rates from Firestore settings/rates
     * @returns {Promise<object>} Map of rates per vehicle tier
     */
    async fetchRates() {
        if (!db) {
            console.warn("IshanCabs: Firestore not initialized. Using default rates.");
            return RATE_CONFIG;
        }
        try {
            const docRef = doc(db, "settings", "rates");
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data && data.rates) {
                    return data.rates;
                }
            }
            return RATE_CONFIG;
        } catch (error) {
            console.error("IshanCabs: Error fetching rates settings:", error);
            return RATE_CONFIG;
        }
    },

    /**
     * Updates dynamic rates in Firestore settings/rates
     * @param {object} newRates - Map of rates per vehicle tier
     * @returns {Promise<void>}
     */
    async updateRates(newRates) {
        if (!db) throw new Error("Firestore not initialized.");
        const docRef = doc(db, "settings", "rates");
        await setDoc(docRef, { rates: newRates });
    },

    /**
     * Fetches active promo codes that are marked to be visible to customers
     * @returns {Promise<Array>} List of visible promo offers
     */
    async fetchVisiblePromos() {
        if (!db) return [];
        try {
            const offersQuery = query(
                collection(db, "offers"),
                where("status", "==", "active"),
                where("visible_to_customer", "==", true)
             );
             const snap = await getDocs(offersQuery);
             const list = [];
             snap.forEach(docSnap => {
                 list.push(docSnap.data());
             });
             return list;
        } catch (error) {
            console.error("IshanCabs: Error fetching visible promos:", error);
            return [];
        }
    },

    /**
     * Verifies a promo code against active offers in Firestore
     * @param {string} code - The promo code to check
     * @param {number} baseFare - Current booking base fare
     * @returns {Promise<object>} Validation result: { valid: boolean, discount: number, message: string }
     */
    async verifyPromoCode(code, baseFare) {
        if (!db) {
            return { valid: false, discount: 0, message: "Database not connected." };
        }
        try {
            const cleanCode = code.trim().toUpperCase();
            if (!cleanCode) {
                return { valid: false, discount: 0, message: "Please enter a promo code." };
            }
            const docRef = doc(db, "offers", cleanCode);
            const docSnap = await getDoc(docRef);
            
            if (!docSnap.exists()) {
                return { valid: false, discount: 0, message: "Invalid promo code." };
            }
            
            const offer = docSnap.data();
            if (offer.status !== "active") {
                return { valid: false, discount: 0, message: "This promo code is no longer active." };
            }
            
            const minThreshold = parseFloat(offer.min_fare_threshold) || 0;
            if (baseFare < minThreshold) {
                return { 
                    valid: false, 
                    discount: 0, 
                    message: `Minimum fare of ₹${minThreshold.toLocaleString("en-IN")} required to use this promo.` 
                };
            }
            
            let discount = 0;
            const val = parseFloat(offer.discount_value) || 0;
            if (offer.discount_type === "flat") {
                discount = val;
            } else if (offer.discount_type === "percentage") {
                discount = Math.round((baseFare * val) / 100);
            }
            
            // Limit discount to not exceed baseFare
            discount = Math.min(discount, baseFare);
            
            return {
                valid: true,
                discount: discount,
                code: cleanCode,
                message: `Promo code ${cleanCode} applied successfully!`
            };
        } catch (error) {
            console.error("IshanCabs: Error verifying promo code:", error);
            return { valid: false, discount: 0, message: "Error verifying promo code. Please try again." };
        }
    }
};

export { bookingService };

