// modules/shared/dbService.js

import { db } from "./firebase.js";
import { 
    doc, 
    setDoc, 
    getDoc, 
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/**
 * Service to manage all Firestore database interactions for IshanCabs
 */
const dbService = {
    /**
     * Creates or updates a customer profile with audit records
     * @param {string} uid - Unique Firebase Authentication user ID
     * @param {object} profileData - Customer details (name, city, phone, email, auth_provider)
     */
    async saveUserProfile(uid, profileData) {
        if (!db) throw new Error("Firestore is not initialized. Check firebase.js configurations.");
        
        try {
            const userDocRef = doc(db, "users", uid);
            const userSnapshot = await getDoc(userDocRef);
            
            if (!userSnapshot.exists()) {
                // New user - Write complete structure & audit columns
                const payload = {
                    uid: uid,
                    name: profileData.name || "",
                    city: profileData.city || "",
                    phone: profileData.phone || "",
                    email: profileData.email || null,
                    auth_provider: profileData.auth_provider || "unknown",
                    status: "active",
                    creation_ts: serverTimestamp(),
                    updated_ts: serverTimestamp()
                };
                await setDoc(userDocRef, payload);
                console.log("IshanCabs: Successfully created new user profile in Firestore:", uid);
                return payload;
            } else {
                // Existing user - Merge changes and refresh update timestamp
                const updatePayload = {
                    updated_ts: serverTimestamp()
                };
                // Do not overwrite existing set fields with null/empty values
                if (profileData.name) updatePayload.name = profileData.name;
                if (profileData.city) updatePayload.city = profileData.city;
                if (profileData.phone) updatePayload.phone = profileData.phone;
                if (profileData.email) updatePayload.email = profileData.email;
                if (profileData.auth_provider) updatePayload.auth_provider = profileData.auth_provider;

                await setDoc(userDocRef, updatePayload, { merge: true });
                console.log("IshanCabs: Successfully updated existing user profile in Firestore:", uid);
                return { ...userSnapshot.data(), ...updatePayload };
            }
        } catch (error) {
            console.error("IshanCabs: Error saving user profile to Firestore:", error);
            throw error;
        }
    },

    /**
     * Fetches user profile data from Firestore
     * @param {string} uid - Unique Firebase Authentication user ID
     * @returns {Promise<object|null>} Profile data or null
     */
    async getUserProfile(uid) {
        if (!db) throw new Error("Firestore is not initialized.");
        try {
            const userDocRef = doc(db, "users", uid);
            const userSnapshot = await getDoc(userDocRef);
            return userSnapshot.exists() ? userSnapshot.data() : null;
        } catch (error) {
            console.error("IshanCabs: Error fetching user profile:", error);
            throw error;
        }
    }
};

export { dbService };
