// modules/shared/firebase.js

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration for IshanCabs (Free Tier)
// REPLACE these placeholders with your actual keys from the Firebase Console!
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "your-project-id.firebaseapp.com",
    projectId: "your-project-id",
    storageBucket: "your-project-id.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app;
let auth;
let db;

try {
    if (firebaseConfig.apiKey === "YOUR_FIREBASE_API_KEY") {
        console.warn("IshanCabs: Firebase credentials have not been configured yet. Please replace the placeholders in modules/shared/firebase.js with your keys.");
    }
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
} catch (error) {
    console.error("IshanCabs: Failed to initialize Firebase SDK:", error);
}

export { app, auth, db };
