# FastAPI API Migration Plan for IshanCabs (Version 0.3)

## Summary
This migration plan details the conversion of IshanCabs from a client-direct Firebase architecture to a secure, modular FastAPI backend. 

### Core Architectural Decisions for Version 0.3
1. **Hybrid Real-Time Architecture**:
   * **Reads**: Clients will continue using the client-side Firebase SDK to establish `onSnapshot` real-time listeners for data display. This preserves real-time synchronization without custom WebSocket/SSE complexity.
   * **Writes**: 100% of data mutations (booking request, approval, fleet edit, setting updates) are routed through the FastAPI backend.
   * **Security**: Client access is locked down in Firestore Security Rules to **strictly read-only**.
2. **OSRM Backend Ownership**:
   * Distance calculation and routing query tasks are moved entirely to the backend. The client passes only coordinate pairs, preventing malicious fare/distance tampering.
3. **Signed Quote Flow**:
   * The backend generates fare quotes and signs them cryptographically using a server secret hash (`quote_signature`). The client must submit this signature when booking; the backend verifies it before writing.
4. **Atomic Transactions**:
   * Critical mutations (such as driver/vehicle allocations) use Firestore Transactions in Python to guarantee race-condition safety.
5. **Firebase Custom Claims for RBAC**:
   * Custom claims (`{"admin": true}`) verify administrator access on backend routes, replacing local storage and client-side email string checks.

---

## Phase 0: Discovery and Contract Freeze
**Goal**: Lock down current frontend-to-data schemas and behavior to optimize token utilization and prevent regression.

### 🏃 Sprint 0.1: Contract & Schema Freezing
* **Migration Tasks**:
  1. Document all direct Firestore collections: `users`, `bookings`, `vehicles`, `drivers`, `offers`, `settings/rates`, `locations`, `flat_fares`.
  2. Map out payload structures, identifying required vs optional attributes (including recently added capacity and address fields).
  3. Freeze standard JSON response envelopes for backend APIs:
     * Success: `{ "data": ..., "meta": ... }`
     * Error: `{ "error": { "code": "string", "message": "string", "details": ... } }`
* **Test & Validation Scenarios**:
  * Create JSON schema validation mocks representing user profiles, booking invoices, and driver assignments to serve as test fixtures.

---

## Phase 0.5: Local Environment Setup
**Goal**: Establish a Docker-based emulation suite for local development mirroring Google Cloud and Firebase architecture.

### 🏃 Sprint 0.5: Docker Compose & Firebase Emulators Configuration
* **Migration Tasks**:
  1. Create `backend/Dockerfile` scaffold.
  2. Create `firebase.json` local emulator suite configuration.
  3. Create root `docker-compose.yml` declaring `firebase-emulator`, `api-backend`, and `static-frontend` containers on a shared bridge network.
  4. Set environment variables (`FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`) for Python.
  5. Implement conditional redirect in client-side Firebase configuration (`modules/shared/firebase.js`) to target the emulator ports if running on `localhost`.
* **Test & Validation Scenarios**:
  * Execute `docker-compose up --build`.
  * Verify:
    * Frontend resolves on `http://localhost:8080` (static-frontend)
    * Backend Swagger UI API docs resolve on `http://localhost:8000/docs` (api-backend)
    * Firebase Emulator Suite UI resolves on `http://localhost:4000` (firebase-emulator)

---

## Phase 1: Backend Foundation and Security
**Goal**: Build a secure FastAPI scaffolding verified with Firebase custom claims token validation.

### 🏃 Sprint 1.1: FastAPI Setup & Health Checks
* **Migration Tasks**:
  1. Create Python virtual environment and directory layout under `backend/`.
  2. Implement `backend/app/main.py` and Uvicorn runtime config.
  3. Add environment variable loaders (handling CORS configurations and security secrets).
* **Test & Validation Scenarios**:
  * Run `GET /api/v1/health` and verify HTTP 200 with standard health check metadata.

### 🏃 Sprint 1.2: Firebase SDK & Auth Authentication Context
* **Migration Tasks**:
  1. Initialize the Firebase Admin SDK once globally in `backend/app/core/firebase.py`.
  2. Code the auth dependency `core/auth.py` to decode Firebase ID tokens, handle validation checks, and yield current user contexts.
* **Test & Validation Scenarios**:
  * Query a mock protected route `GET /api/v1/me/test-auth` and verify:
    * HTTP 401 Unauthorized when no token is provided.
    * HTTP 401 Unauthorized on invalid/expired tokens.
    * HTTP 200 OK with correct UID when a valid token is provided.

### 🏃 Sprint 1.3: Custom claims RBAC Seeder
* **Migration Tasks**:
  1. Build an admin dependency checker decoding token claims: `if not claims.get("admin"): raise HTTPException(403)`.
  2. Create a backend CLI bootstrap script `backend/scripts/make_admin.py` to assign custom claims to specified staff emails.
* **Test & Validation Scenarios**:
  * Run `make_admin.py` for a test user. Verify that their ID token contains the `{"admin": true}` claim, and verify that accessing an admin-guarded route returns HTTP 200 instead of HTTP 403.

---

## Phase 2: Profiles, Catalog Reads, and Bootstrap
**Goal**: Move profiles CRUD and catalog lookups behind validated routes.

### 🏃 Sprint 2.1: User Profile Manager
* **Migration Tasks**:
  1. Implement routers and schemas for profiles under `/api/v1/me/profile`.
  2. Create repository handlers reading/writing to the Firestore `users` collection.
* **Test & Validation Scenarios**:
  * `GET /api/v1/me/profile` returns correct user data from Firestore.
  * `PUT /api/v1/me/profile` updates fields (e.g. name, phone) and returns the modified profile. Blocks updates to read-only parameters (e.g., `role`, `uid`).

### 🏃 Sprint 2.2: Settings & Metadata Catalogs
* **Migration Tasks**:
  1. Move predefined metadata queries behind endpoints: `GET /api/v1/settings/rates`, `GET /api/v1/locations`, and `GET /api/v1/flat-fares`.
* **Test & Validation Scenarios**:
  * Compare JSON structures returned from endpoints against frontend configuration files to ensure 100% naming compliance.

### 🏃 Sprint 2.3: Promo Offer Validations
* **Migration Tasks**:
  1. Move coupon validation logic to backend: `POST /api/v1/offers/validate`.
  2. Backend fetches coupon code from Firestore, verifies expiration, status active, and checks base fare thresholds before returning calculated discount totals.
* **Test & Validation Scenarios**:
  * Validate discount responses under scenarios: invalid coupon code (404), inactive coupon (400), valid percentage code (returns exact computed discount), valid flat code (returns flat discount value).

---

## Phase 3: Secure Booking Quote and Booking Creation
**Goal**: Move routing calculations, quote signing, and booking writes to the backend.

### 🏃 Sprint 3.1: Server-Side Routing Utilities
* **Migration Tasks**:
  1. Implement backend routing module `backend/app/core/routing.py` containing OSRM query fetcher and Haversine straight-line distance fallback functions.
* **Test & Validation Scenarios**:
  * Run unit tests on `routing.py` passing coordinate pairs: assert output distance matches expected values and verify fallback coordinates are drawn if OSRM mock fails.

### 🏃 Sprint 3.2: Signed Quote Engine
* **Migration Tasks**:
  1. Implement `POST /api/v1/bookings/quote`.
  2. Backend computes distance (via OSRM) and fare totals across all tiers (using active settings rates and matching flat fares).
  3. Returns quote parameters alongside a cryptographically signed HMAC token (`quote_signature`) containing: `base_fare`, `distance_km`, `vehicle_tier`, and a `15-minute expiration timestamp`.
* **Test & Validation Scenarios**:
  * Verify the endpoint returns quote details and a signature string. Assert signature changes if quote details are manually tampered with.

### 🏃 Sprint 3.3: Booking Document Writes
* **Migration Tasks**:
  1. Implement booking creation `POST /api/v1/bookings`.
  2. Backend verifies quote signature and timestamp.
  3. Writes booking document to Firestore, mapping `booking_channel: "website"`.
* **Test & Validation Scenarios**:
  * Test checkout: submitting request with valid quote signature logs booking in Firestore.
  * Attempt submitting with expired signature (returns HTTP 400).
  * Attempt submitting with modified fare details (signature validation fails, returns HTTP 400).

---

## Phase 4: Rider Activity and Feedback
**Goal**: Securely query history logs and write customer feedback star ratings.

### 🏃 Sprint 4.1: Activity History Log
* **Migration Tasks**:
  1. Implement `GET /api/v1/me/bookings` which queries Firestore for the caller's UIDs.
* **Test & Validation Scenarios**:
  * Verify it returns sorted, paginated rides for the logged-in customer. Verify a user cannot query another rider's history.

### 🏃 Sprint 4.2: Booking Feedback Submissions
* **Migration Tasks**:
  1. Implement `POST /api/v1/me/bookings/{booking_id}/feedback`.
  2. Verify booking exists, is owned by caller, has status `'completed'`, and does not already have a feedback rating.
* **Test & Validation Scenarios**:
  * Assert submitting star rating on incomplete ride returns HTTP 400.
  * Assert submitting review on someone else's ride returns HTTP 403.

---

## Phase 5: Admin Booking Dispatch Operations
**Goal**: Secure booking status transitions and geocoded approvals.

### 🏃 Sprint 5.1: Live Dashboard Websocket Feed
* **Migration Tasks**:
  1. Set up WebSocket or Server-Sent Events (SSE) route `/api/v1/ws/admin/bookings`.
  2. Implement background Firestore snapshot listener on the backend that broadcasts changes to active admin feeds.
* **Test & Validation Scenarios**:
  * Verify real-time messages are received by the client when a document is updated in Firestore.

### 🏃 Sprint 5.2: Atomic Allocation and Approval
* **Migration Tasks**:
  1. Implement `/api/v1/admin/bookings/{booking_id}/approve` supporting optional custom `pickup_coords` and `drop_coords`.
  2. Use Firestore Transactions to:
     * Verify booking status.
     * Verify driver/car are active and not currently assigned to another ride.
     * Recalculate OSRM fare if custom coordinates are updated.
     * Allocate driver and transition status to `"confirmed"`.
* **Test & Validation Scenarios**:
  * Test geocoding override: verify correct route recalculation is committed.
  * Test allocation race conditions: trigger concurrent approvals for same driver and verify only one succeeds.

### 🏃 Sprint 5.3: Ride Lifecycle Transitions
* **Migration Tasks**:
  1. Implement endpoints `/reject`, `/start`, and `/complete`.
  2. Start Ride (`/start`) updates status to `"active"` (only permitted if pickup date/time has passed). Complete Ride (`/complete`) updates status to `"completed"`.
* **Test & Validation Scenarios**:
  * Verify correct state transitions and validate time lockouts on starting rides early.

---

## Phase 6: Fleet and Driver Registry CRUD
**Goal**: Secure vehicle and driver registry CRUD and manage document associations.

### 🏃 Sprint 6.1: Fleet Registry Management
* **Migration Tasks**:
  1. Implement CRUD routes under `/api/v1/admin/fleet`.
  2. Enforce bidirectional links: updating a vehicle's driver automatically updates the driver's vehicle link, clearing stale references.
* **Test & Validation Scenarios**:
  * Test endpoints, verifying that adding or editing a vehicle syncs associations atomically to Firestore.

### 🏃 Sprint 6.2: Driver Registry Management
* **Migration Tasks**:
  1. Implement CRUD routes under `/api/v1/admin/drivers`.
* **Test & Validation Scenarios**:
  * Verify edits sync back to vehicle driver assignment fields.

### 🏃 Sprint 6.3: Upload Service
* **Migration Tasks**:
  1. Implement `/api/v1/admin/upload` storing media uploads in Firebase Storage.
* **Test & Validation Scenarios**:
  * Test uploading image files, verifying it returns public asset URLs and validates file MIME types.

---

## Phase 7: Settings, Offers, Locations, and Flat Fare Admin APIs
**Goal**: Move remaining metadata and catalog updates behind secure routes.

### 🏃 Sprint 7.1: Catalog Admin Control
* **Migration Tasks**:
  1. Implement catalog CRUD routes:
     * Rates: `PUT /api/v1/admin/settings/rates`
     * Coupons: `/api/v1/admin/offers` (CRUD)
     * Locations: `/api/v1/admin/locations` (CRUD)
     * Flat Fares: `/api/v1/admin/flat-fares` (CRUD)
* **Test & Validation Scenarios**:
  * Modify pricing parameters. Verify immediate changes on next quote calculation.
  * Create, toggle active, and delete promo codes, verifying correct logic behaviors.

---

## Phase 8: Frontend Client Refactor
**Goal**: Replace all client-side Firestore writes and direct catalog reads with HTTP wrapper calls.

### 🏃 Sprint 8.1: API Client setup
* **Migration Tasks**:
  1. Create frontend API client wrapper `apiClient.js` injecting Firebase JWT token headers.
  2. Integrate `authService.js` to perform authentication actions via `/bootstrap` and `/profile`.
* **Test & Validation Scenarios**:
  * Verify user profiles load correctly on login.

### 🏃 Sprint 8.2: Checkout Quote & Creator Refactor
* **Migration Tasks**:
  1. Refactor `bookingUI.js` checkout flow:
     * Calls `/bookings/quote` with terminal parameters.
     * Passes signed quote credentials to `POST /bookings`.
* **Test & Validation Scenarios**:
  * Place booking, verifying OSRM routing works on the backend, signature is valid, and database document registers.

### 🏃 Sprint 8.3: Activity & Reviews Refactor
* **Migration Tasks**:
  1. Refactor `activityUI.js` to fetch personal logs and submit rating star comments via API.
* **Test & Validation Scenarios**:
  * Expand card, verify map path displays, and verify submitting comments updates Firestore.

### 🏃 Sprint 8.4: Admin Dashboard Refactor
* **Migration Tasks**:
  1. Refactor `adminUI.js` to call REST endpoints for status transitions, fleet registry edits, geocoded acceptances, and settings updates.
  2. Maintain real-time feeds using WebSockets or Server-Sent Events.
* **Test & Validation Scenarios**:
  * Verify that creating bookings, changing settings, and starting rides updates dashboard tables instantly.

---

## Phase 9: Hardening, Security Rules, and Cleanup
**Goal**: Lock down the client security rules and sanitize codebase.

### 🏃 Sprint 9.1: Firestore Rules Lockdown
* **Migration Tasks**:
  1. Update Firestore Security Rules:
     ```javascript
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         // Clients can read catalogs, settings, or their own bookings/profile
         match /users/{userId} {
           allow read: if request.auth != null && request.auth.uid == userId;
           allow write: if false; // BACKEND ONLY
         }
         match /bookings/{bookingId} {
           allow read: if request.auth != null && (resource.data.customer_id == request.auth.uid || request.auth.token.admin == true);
           allow write: if false; // BACKEND ONLY
         }
         match /{document=**} {
           allow read: if request.auth != null;
           allow write: if false; // BACKEND ONLY
         }
       }
     }
     ```
* **Test & Validation Scenarios**:
  * Attempt write mutations directly from frontend browser console. Verify all write attempts are blocked with permission errors.

### 🏃 Sprint 9.2: Code Cleanup and Auditing
* **Migration Tasks**:
  1. Remove unused javascript libraries and database utility code.
  2. Enforce API client headers auditing.
* **Test & Validation Scenarios**:
  * Confirm application runs cleanly on localhost with zero browser console errors and secure data pathways.
