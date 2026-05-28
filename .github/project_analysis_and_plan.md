# 🚖 IshanCabs: Project Analysis & Modular Feature Plan (with APK Compatibility)

This document provides a detailed analysis of your existing repository files, evaluates the design choices, and presents a modular, highly scalable folder architecture for the completed **Customer Auth (Sign Up & Login) Module** and the upcoming **Booking Module** of your cab service. It addresses hosting on **GitHub Pages** for a Proof of Concept (PoC) and wrapping into an **Android APK (Play Store)**, leveraging a 100% **Free-Tier/Cost-Effective** infrastructure tailored for India (INR).

---

## 1. Summary of Project Setup & Design Review

### 📂 Repository Analysis
Your workspace consists of a highly efficient, lightweight web application:
- **`index.html`**: A semantically rich landing page utilizing **Tailwind CSS via CDN** for rapid styling, coupled with custom responsive layouts. Features a premium navigation header overlay with a dynamic auth state button.
- **`styles.css`**: A comprehensive custom stylesheet containing custom CSS variables, custom tokens, custom media queries, and sophisticated keyframe animations (e.g., `.pulse-button` for CTA, `.card-route` styling). It has robust accessibility adjustments (such as `prefers-reduced-motion` safety) and printing provisions.
- **`app.js`**: Re-engineered as a native ES module that coordinates landing page interactions and acts as an active **Authentication State Observer**.
- **Backend Setup**: Powered by **Firebase Spark (Free Tier)**. Authentication (Google Login & Phone OTP) and user profile storage (Cloud Firestore) are fully integrated via client-side libraries.

### 🎨 Design & UI Review
- **Aesthetic Quality**: The visual design is modern, engaging, and premium. It relies on a playful dark slate base (`#0F172A`/`#1E293B`) accented by warm honey-yellow/amber details (`#F59E0B`), giving it a sleek "urban premium cab" identity.
- **Responsiveness**: Excellent. Grids dynamically scale down from 4 columns on desktop to stack nicely on mobile screens.
- **Micro-Animations**: Custom hover animations and persistent pulse states on critical booking buttons keep the page interactive and energetic.

---

## 2. Multi-Page vs. Single-Page Architecture for PoC

Since you are hosting the Proof of Concept (PoC) on **GitHub Pages** and wrapping it into an **Android APK** later, we have to design with key constraints in mind:
- **GitHub Pages is a static file host**: It does not support Node.js, Python, or Java runtimes, meaning all compilation must happen client-side or during a build step.
- **The Routing Challenge**: Standard Single-Page Application (SPA) routers (e.g., React Router, Vue Router) using HTML5 `history.pushState` fail on page reload on GitHub Pages (yielding `404 Not Found` because GitHub has no real backend to redirect arbitrary routes to `index.html`).
- **Android WebView Compatibility**: When wrapped inside an APK, files are loaded locally (e.g., from `capacitor://localhost` or `file:///`). Deep nesting or dynamic route-rewriting can break asset lookups on mobile.

### 🏆 Recommended Solution: Modular Multi-Page Application (MPA)
By organizing modules into logical subfolders with their own static files (e.g., `/auth/auth.html`), **GitHub Pages serves them natively and flawlessly**. You will avoid any router hack workarounds and keep the codebase simple, transparent, and extremely lightweight.

Using **Vanilla JavaScript with ES Modules (`type="module"`)** allows us to:
1. Write clean, modular, and reusable JavaScript classes/functions.
2. Avoid heavy bundlers like Webpack or Vite for the PoC stage, making local development as simple as launching a basic live server.
3. Keep the file structure highly isolated. When you want to add the `booking` module, it will reside in its own folder completely independent of `auth`.
4. Ensure 100% compatibility with mobile wrapper engines, which serve static HTML directory structures out of the box.

---

## 3. Mobile APK Wrapper Architecture (Capacitor)

To turn this codebase into a premium Android APK for the Google Play Store, we will use **Capacitor** (created by Ionic). It is the modern, high-performance successor to Cordova.

```mermaid
graph LR
    HTML[HTML/CSS/JS Web App] -->|Capacitor Native Bridge| Webview[Android System WebView]
    Webview -->|Compiled Native APK| Android[Android OS / Play Store]
```

### 💡 Why Capacitor is Ideal for Your Tech Stack:
1. **Zero Framework Overhead**: It wraps vanilla HTML/CSS/JS directly. It doesn't force you to rewrite your app in React Native or Flutter.
2. **Build-Once, Deploy-Twice**: Your exact folder structure will run in the browser (GitHub Pages) and inside the native APK without duplicative development.
3. **Access Native Features**: When ready, you can easily add plugins to trigger native features (like Android Geolocation, Push Notifications, or Secure Storage).

### ⚠️ Critical Constraints for APK Compatibility:
1. **Strict Relative Paths**: You MUST use relative paths (e.g., `./modules/auth/auth.html` or `../shared/utils.js`) instead of root-absolute paths (`/modules/auth/auth.html`). WebView asset loaders look up files relative to the current virtual directory.
2. **Firebase Native vs. Web Auth**: Standard web-redirect authentication (`signInWithRedirect` or `signInWithPopup`) **fails** in mobile WebViews because the app runs inside a secure sandboxed origin. 
   * *The Strategy*: We will isolate the authentication layer inside a modular adapter. For web (GitHub Pages), it will use standard Firebase Web Auth. For mobile (APK), we can seamlessly swap to the `@capacitor-firebase/authentication` plugin which binds native Google Sign-In to your Firebase project.

---

## 4. Completed Modular Folder Structure

Here is the completed modular folder structure implemented to scale your application seamlessly and accommodate native Android assets:

```text
cab-website/
├── index.html                 # Main Landing Page (SethCabs/IshanCabs)
├── styles.css                 # Global Custom Styles & Design System Tokens
├── app.js                     # Global Observer Module (Dynamic Header & Login/Logout toggle)
│
├── assets/                    # Shared static assets
│   ├── images/                # Cab and driver photography
│   └── icons/                 # Brand and route SVGs
│
├── modules/                   # Isolated feature modules
    │
    ├── auth/                  # Customer Authentication Module
    │   ├── auth.html          # Unified Sign Up & Login Page (Google/Phone tabs + Close button)
    │   ├── auth.css           # Authentication UI styles (Google buttons, OTP inputs)
    │   ├── authUI.js          # Handles interactive elements (tabs, forms, alerts)
    │   └── authService.js     # Communicates with Firebase Auth (supports Web & Native APK bridging)
    │
    ├── booking/               # Customer Booking Module
    │   ├── booking.html       # Booking flow screen (Multi-step glassmorphic UI)
    │   ├── booking.css        # Booking specific layout, overlays, and indicators
    │   ├── bookingUI.js       # Coordinates steps, date validations, and pricing calculations
    │   └── bookingService.js  # Connects to Firestore & WhatsApp, checks overlapping inventory
    │
    └── shared/                # Universal Shared Modules & Integrations
        ├── firebase.js        # Core Firebase Config & SDK Initialization (Firestore/Auth)
        ├── dbService.js       # Common Firestore operations (user profiles, audit columns)
        ├── routesMatrix.js    # Decoupled matrix containing popular routes, km, and flat pricing
        └── utils.js           # Utility helpers (time formatting, input sanitization)
```

---

## 5. Booking Module Specifications

### A. Real-Time Overbooking Prevention
We implement a **Time-Aware Inventory Control** check in the booking service:
- **`vehicles` Collection**: Stored in Firestore, it lists physical fleet cars, vehicle categories, and active statuses.
- **Overlapping Query**: When the rider queries a date and time, the booking service fetches overlapping confirmed bookings for that tier. If the count of occupied cars matches your total active fleet, the system automatically marks that tier as **"Sold Out"** and disables selection, avoiding double-bookings.

### B. Dynamic Driver & Vehicle Assignment Mapping
To give you complete, flexible control over the fleet, we separate vehicles and drivers into distinct entities:
- **`drivers` Collection**: Stores names, contact numbers, and status (e.g., `active`, `sick`, `on_leave`).
- **`vehicles` Collection**: Stores car tiers and plate numbers, mapping dynamically to drivers via an `assigned_driver_id` pointer.
- **Dynamic Swapping**: If a driver falls sick or takes a day off, you can quickly edit the vehicle's `assigned_driver_id` reference or change the driver's status inside the future Admin Dashboard.
- **Historical Auditing**: When you confirm a booking, the active driver's details and vehicle plate number are written directly inside that booking document as a snapshot. This preserves record accuracy even if the driver is assigned to a different car next month.

### C. Route Configuration (`routesMatrix.js`)
Distances and prices are stored in a central config module. It defines distances (km) and base rates in INR, which prepares your codebase to expand into an Admin Dashboard seamlessly:
```javascript
export const routesMatrix = {
    "Howrah Station": {
        "Airport": { km: 18, base_fare_sedan: 999, base_fare_suv: 1499 },
        "Digha": { km: 185, base_fare_sedan: 4500, base_fare_suv: 6500 }
    }
};
```

### D. 2-Hour Scheduling Enforcer
All booking date/time fields validate client inputs in real-time, blocking requests unless they are scheduled at least **2 hours in advance** from the present time.

### E. WhatsApp & Firestore Dual Dispatch
On checking out:
1. The trip record is saved in Cloud Firestore, creating an audit-ready `booking_id` linked to the customer's profile.
2. The user is redirected to a pre-filled WhatsApp API window, sending the exact booking payload directly to your customer support chat automatically.

---

## 6. Cost-Effective Integration Architecture (Free Tier & INR Target)

To respect your goal of staying within the **Free Tier** or at a modest cost, we structured the entire backend using **Firebase Spark (Free Tier)**.

### 💳 Service Cost Matrix (INR)

| Service | Tier / Plan | Limits & Pricing | Suitability for PoC / MVP / APK |
| :--- | :--- | :--- | :--- |
| **Hosting (Web)** | GitHub Pages | **100% Free** forever. | Perfect for PoC and early staging. |
| **Wrapping (APK)** | Capacitor | **100% Free** & Open Source. | Excellent, premium solution for Play Store deployment. |
| **Authentication** | Firebase Auth (Google) | **100% Free** & unlimited. | Zero friction for user growth on web & APK. |
| **Authentication** | Firebase Auth (Phone OTP) | **10,000 free verifications / month**. | Highly generous. Plenty for validation. |
| **Database** | Cloud Firestore | **1 GB Storage** free.<br>• 50,000 Reads/day (Free)<br>• 20,000 Writes/day (Free)<br>• 20,000 Deletes/day (Free) | Highly performant. Free tier supports hundreds of active daily users. |
| **Domain Name** | Custom Domain | **₹300 - ₹800 / year** (average for `.in` or `.com` on Cloudflare/Hostinger). | Optional. Works out of the box with GitHub Pages via custom CNAME. |

---

## 7. Firebase Data Models

### A. User Profile Schema (`users` Collection)
```json
{
  "uid": "google_or_phone_unique_firebase_uid",
  "name": "Ishan Mukherjee",
  "city": "Kolkata",
  "phone": "+918981538038",
  "email": "ishan@example.com",
  "auth_provider": "google.com",
  "status": "active",
  "creation_ts": "server_timestamp",
  "updated_ts": "server_timestamp"
}
```

### B. Driver Profile Schema (`drivers` Collection)
```json
{
  "driver_id": "DRV_20260528_xxxx",
  "name": "Rajesh Kumar",
  "phone": "+919876543210",
  "status": "active", // "active" | "sick" | "on_leave" | "suspended"
  "creation_ts": "server_timestamp"
}
```

### C. Vehicle Profile Schema (`vehicles` Collection)
```json
{
  "vehicle_id": "WB-02-A-1234",
  "tier": "sedan",
  "model": "Swift Dzire",
  "status": "active",
  "assigned_driver_id": "DRV_20260528_xxxx",
  "creation_ts": "server_timestamp"
}
```

### D. Trip Booking Schema (`bookings` Collection)
```json
{
  "booking_id": "BK_20260528_xxxx",
  "customer_id": "google_or_phone_unique_firebase_uid",
  "customer_details": {
    "name": "Ishan Mukherjee",
    "phone": "+918981538038"
  },
  "trip_details": {
    "ride_type": "outstation",
    "pickup_location": "Howrah Station",
    "drop_location": "Digha",
    "pickup_datetime": "2026-06-01T12:00:00.000Z",
    "outstation_days": 3
  },
  "fare_details": {
    "vehicle_tier": "sedan",
    "estimated_km": 185.0,
    "estimated_fare": 2520.00
  },
  "status": "pending_approval",
  "payment_status": "pending",
  "driver_assignment": { // Snapshot of assignment locked upon confirmation
    "driver_name": "Rajesh Kumar",
    "driver_phone": "+919876543210",
    "vehicle_number": "WB-02-A-1234"
  },
  "creation_ts": "server_timestamp",
  "updated_ts": "server_timestamp"
}
```
