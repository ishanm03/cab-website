# FastAPI API Migration Plan for IshanCabs

## Summary
This migration will convert the current client-direct Firebase architecture into a modular FastAPI backend without changing the frontend UI.
Phase 1 keeps Firebase Auth and Firestore, but moves backend-sensitive logic and writes behind Python API endpoints.
The migration is organized to reduce risk: start with backend foundations, then move rider flows, then admin workflows, then harden and optimize.

Chosen defaults:
- Keep `Firebase Auth + Firestore` in the first version
- Use `REST + polling` first
- Execute a phased rollout
- Keep current frontend pages and UX intact

## Target Architecture
### Backend stack
- `FastAPI` for HTTP APIs
- `Pydantic` for request/response validation
- `Firebase Admin SDK` for token verification and Firestore access
- `Uvicorn` for local runtime
- `pytest` + `httpx` for backend tests

### Backend module layout
- `backend/app/main.py`
- `backend/app/core/`
- `backend/app/api/v1/`
- `backend/app/modules/auth/`
- `backend/app/modules/profiles/`
- `backend/app/modules/bookings/`
- `backend/app/modules/activity/`
- `backend/app/modules/admin_bookings/`
- `backend/app/modules/fleet/`
- `backend/app/modules/drivers/`
- `backend/app/modules/offers/`
- `backend/app/modules/settings/`
- `backend/app/modules/locations/`

Each module should include:
- `router.py`
- `service.py`
- `repository.py`
- `schemas.py`

### Backend responsibilities
The backend becomes the source of truth for:
- fare calculation
- promo validation
- availability checks
- booking creation
- booking status transitions
- driver/vehicle assignment
- admin mutations
- feedback submission rules
- profile read/write rules

## Phase 0: Discovery and Contract Freeze
### Goal
Lock down the current frontend-to-data behavior so migration does not accidentally break flows.

### Work
- Inventory all direct Firebase reads/writes in:
  - `modules/shared/dbService.js`
  - `modules/auth/authService.js`
  - `modules/booking/bookingService.js`
  - `modules/booking/bookingUI.js`
  - `modules/booking/activityUI.js`
  - `modules/admin/adminUI.js`
- Freeze current Firestore collection usage:
  - `users`
  - `bookings`
  - `vehicles`
  - `drivers`
  - `offers`
  - `settings/rates`
  - `rates_history`
  - `locations`
  - `flat_fares`
- Document current payload shapes for:
  - user profile
  - booking document
  - fare details
  - trip details
  - driver assignment
  - feedback
- Identify frontend functions that must become API calls
- Define standard API response envelope:
  - success: `{ data, meta }`
  - error: `{ error: { code, message, details } }`

### Output
- field-level API contract reference
- current Firestore schema notes
- list of frontend methods to replace with HTTP requests

### Acceptance
- Every current backend-like browser responsibility is mapped to a future endpoint
- No hidden Firestore dependency remains undocumented

## Phase 1: Backend Foundation and Security
### Goal
Stand up a production-shaped FastAPI service and secure it with Firebase token verification.

### Work
- Create backend project structure under `backend/`
- Add environment-based config for:
  - Firebase service account
  - API base URL
  - allowed admin emails or admin role policy
  - CORS settings
- Initialize Firebase Admin SDK once in `core`
- Add auth dependency to:
  - verify Firebase ID token
  - attach current user context to request
- Add admin authorization dependency
- Add centralized exception handlers
- Add request logging and health endpoint
- Add API versioning under `/api/v1`

### Endpoints
- `GET /api/v1/health`
- `POST /api/v1/auth/bootstrap`

### Bootstrap behavior
- Verify token
- read existing profile if present
- resolve role
- return normalized session context needed by frontend

### Output
- running FastAPI service
- reusable auth/role guard dependencies
- backend skeleton ready for feature modules

### Acceptance
- valid Firebase token is accepted
- invalid or missing token is rejected
- admin-only endpoint access is blocked for non-admins

## Phase 2: Profiles and Shared Catalog Read APIs
### Goal
Move safe shared reads to the backend first, with minimal frontend risk.

### Work
Implement read APIs for:
- user profile
- rates
- visible offers
- locations
- flat fares
- rider booking history summary read support

### Endpoints
- `GET /api/v1/me/profile`
- `PUT /api/v1/me/profile`
- `GET /api/v1/settings/rates`
- `GET /api/v1/offers/visible`
- `POST /api/v1/offers/validate`
- `GET /api/v1/locations`
- `GET /api/v1/flat-fares`
- `GET /api/v1/me/bookings`

### Business rules
- profile access only for the authenticated rider
- visible offers filtered by `status=active` and `visible_to_customer=true`
- promo validation done server-side, not trusted from client

### Frontend integration impact
Replace these direct reads first:
- `dbService.getUserProfile`
- `dbService.saveUserProfile`
- `bookingService.fetchRates`
- `bookingService.fetchVisiblePromos`
- `bookingService.verifyPromoCode`
- location and flat fare Firestore reads
- rider activity booking query

### Acceptance
- auth page still resolves profile status correctly
- booking page loads rates/offers/locations through APIs
- rider activity history loads through backend endpoint

## Phase 3: Booking Quote and Booking Creation
### Goal
Move booking-critical business logic to Python so the browser stops being trusted for fare, discounts, and booking writes.

### Work
Implement backend services for:
- route/fare quote calculation
- availability check
- booking creation
- booking ID generation
- applied promo validation
- rates version stamping

### Endpoints
- `POST /api/v1/bookings/quote`
- `POST /api/v1/bookings`

### Booking quote behavior
Input:
- ride type
- pickup/drop
- custom coordinates or custom text if applicable
- pickup datetime
- outstation days or rental hours
- selected promo code if any

Output:
- resolved route summary
- estimated km
- fare options by tier
- availability per tier
- promo validation result
- rates version id

### Booking creation behavior
- accept raw rider inputs only
- recompute fare server-side
- recompute discount server-side
- never trust client `estimated_fare`, `discount_amount`, or `estimated_km`
- write booking with backend-generated fields

### Firestore rules
- browser should stop writing directly to `bookings`
- only backend service account should write protected booking mutations

### Frontend integration impact
Replace:
- `bookingService.checkAvailability`
- `bookingService.calculateFare` as a trusted source
- `bookingService.createBooking`
- quote logic embedded in `bookingUI.js`

### Acceptance
- booking can be created from frontend without direct Firestore write
- tampered fare payloads are ignored by backend
- booking document shape stays compatible with admin and rider UI

## Phase 4: Rider Activity and Feedback APIs
### Goal
Move rider booking history and feedback submission behind the backend.

### Work
Implement:
- authenticated rider booking history query
- feedback write endpoint
- ownership and status checks

### Endpoints
- `GET /api/v1/me/bookings`
- `POST /api/v1/me/bookings/{booking_id}/feedback`

### Rules
- rider can read only their own bookings
- feedback allowed only for completed bookings
- feedback locked after submission unless explicit edit support is added later
- backend stamps feedback timestamp

### Frontend integration impact
Replace:
- `activityUI.js` direct booking query
- direct `updateDoc` feedback submission

### Acceptance
- rider history renders unchanged from API data
- rider cannot submit feedback for another user’s booking
- rider cannot submit feedback for incomplete ride

## Phase 5: Admin Booking Operations
### Goal
Move dispatch and booking lifecycle control into secure backend endpoints.

### Work
Implement admin operations for:
- list/filter bookings
- approve bookings
- reject bookings
- start ride
- complete ride
- optional admin discount override
- custom-booking coordinate enrichment if needed

### Endpoints
- `GET /api/v1/admin/bookings`
- `POST /api/v1/admin/bookings/{booking_id}/approve`
- `POST /api/v1/admin/bookings/{booking_id}/reject`
- `POST /api/v1/admin/bookings/{booking_id}/start`
- `POST /api/v1/admin/bookings/{booking_id}/complete`

### Approval rules
- validate admin authorization
- ensure booking exists and is in an approvable state
- check conflict on assigned driver/vehicle
- use Firestore transaction for assignment
- recompute fare if admin provides route coordinates or discount override
- update `driver_assignment`, `fare_details`, `trip_details`, `status`, `updated_ts`

### Transition rules
- `pending_approval -> confirmed`
- `confirmed -> active`
- `active -> completed`
- `pending_approval -> rejected`

### Frontend integration impact
Replace all admin booking `updateDoc` operations and in-memory conflict enforcement with API calls.

### Acceptance
- admin dashboard can approve/reject/start/complete bookings through API
- conflicting driver/vehicle assignment is rejected atomically
- admin UI still renders using current data shape

## Phase 6: Fleet and Driver Management APIs
### Goal
Move fleet registry and driver registry into backend-managed modules with consistent association rules.

### Work
Implement CRUD and association logic for:
- vehicles
- drivers
- bidirectional link maintenance

### Endpoints
- `GET /api/v1/admin/fleet`
- `POST /api/v1/admin/fleet`
- `PUT /api/v1/admin/fleet/{vehicle_id}`
- `DELETE /api/v1/admin/fleet/{vehicle_id}`
- `GET /api/v1/admin/drivers`
- `POST /api/v1/admin/drivers`
- `PUT /api/v1/admin/drivers/{driver_id}`
- `DELETE /api/v1/admin/drivers/{driver_id}`

### Rules
- normalize identifiers server-side
- maintain `assigned_driver_id` and `assigned_vehicle_id` consistently
- use transactions when reassigning linked entities
- prevent invalid dangling links
- block deletion if policy requires active booking protection

### Frontend integration impact
Replace vehicle/driver CRUD calls in `adminUI.js`.

### Acceptance
- adding/editing/deleting vehicles and drivers works through APIs
- reassignment clears prior links safely
- roster endpoint logic remains compatible with admin approval flow

## Phase 7: Settings, Offers, Locations, and Flat Fare Admin APIs
### Goal
Move operational configuration management behind backend endpoints.

### Work
Implement backend management for:
- rates and rate history
- offers catalog
- predefined locations
- flat fare overrides

### Endpoints
- `PUT /api/v1/admin/settings/rates`
- `GET /api/v1/admin/offers`
- `POST /api/v1/admin/offers`
- `PATCH /api/v1/admin/offers/{code}/status`
- `DELETE /api/v1/admin/offers/{code}`
- `GET /api/v1/admin/locations`
- `POST /api/v1/admin/locations`
- `DELETE /api/v1/admin/locations/{location_id}`
- `GET /api/v1/admin/flat-fares`
- `POST /api/v1/admin/flat-fares`
- `DELETE /api/v1/admin/flat-fares/{flat_fare_id}`

### Rules
- rates update writes both `settings/rates` and `rates_history`
- offer codes normalized uppercase
- visible offers controlled by backend
- location IDs normalized on backend
- flat fare route IDs normalized on backend

### Frontend integration impact
Replace remaining admin configuration writes and list subscriptions.

### Acceptance
- admin settings pages work entirely through FastAPI
- rate history version tracking remains intact
- booking quote flow can still consume these settings correctly

## Phase 8: Frontend Service Refactor
### Goal
Remove direct Firebase data access from the frontend while keeping frontend pages unchanged.

### Work
Create lightweight frontend API client wrappers:
- `apiClient.js`
- `authApi.js`
- `profileApi.js`
- `bookingApi.js`
- `activityApi.js`
- `adminApi.js`

Refactor current modules so UI logic remains, but data access moves to HTTP wrappers:
- `dbService.js` becomes API-based or is retired
- `bookingService.js` becomes thin client helper or is split into API + display helpers
- `adminUI.js`, `bookingUI.js`, `activityUI.js`, `authUI.js` call API clients instead of Firestore SDK directly

Keep in frontend only:
- DOM updates
- input gathering
- lightweight presentation helpers
- non-authoritative map rendering

### Acceptance
- no protected Firestore write remains in frontend
- frontend still works without page redesign
- all business-critical mutations go through backend

## Phase 9: Hardening, Cleanup, and Production Readiness
### Goal
Make the new architecture safe and maintainable for production.

### Work
- tighten Firestore security rules so browser cannot mutate protected collections
- remove PoC admin localStorage bypass
- add pagination for admin booking lists
- add filtering parameters for admin booking queries
- add rate limiting and request validation hardening
- add structured logging
- add test coverage for critical workflows
- add deployment docs and environment docs
- add OpenAPI tagging and endpoint documentation
- optionally add WebSocket/SSE as a future enhancement if polling becomes insufficient

### Acceptance
- browser cannot bypass backend for protected writes
- admin auth is backend-enforced
- backend API is documented and test-covered
- production deployment checklist is complete

## API Contract Notes
### Shared response format
- success:
  - `{ "data": ..., "meta": ... }`
- error:
  - `{ "error": { "code": "string", "message": "string", "details": ... } }`

### Important request models
- `BootstrapRequest`
- `ProfileUpsertRequest`
- `OfferValidationRequest`
- `BookingQuoteRequest`
- `CreateBookingRequest`
- `ApproveBookingRequest`
- `RejectBookingRequest`
- `RideTransitionRequest`
- `VehicleUpsertRequest`
- `DriverUpsertRequest`
- `RatesUpdateRequest`
- `OfferUpsertRequest`
- `LocationUpsertRequest`
- `FlatFareUpsertRequest`
- `FeedbackSubmitRequest`

### Important response models
- `SessionContextResponse`
- `ProfileResponse`
- `BookingQuoteResponse`
- `BookingResponse`
- `BookingListResponse`
- `AdminBookingListResponse`
- `RatesResponse`
- `OffersResponse`
- `LocationsResponse`
- `FleetResponse`
- `DriversResponse`

## Test Plan
### Unit tests
- fare calculation across ride types
- promo validation logic
- booking ID generation
- profile upsert rules
- booking state transition rules
- driver/vehicle association rules

### Integration tests
- token verification middleware
- rider quote and booking creation
- rider booking history read
- rider feedback submission
- admin approval/rejection/start/complete
- rates/offers/locations CRUD
- fleet and driver CRUD with reassignment

### Security tests
- non-admin blocked from admin endpoints
- rider blocked from reading another rider’s bookings
- client fare tampering ignored
- duplicate assignment blocked by transaction
- unauthorized write attempts rejected

### Regression scenarios
- auth page still works for rider onboarding
- booking page still completes all 3 steps
- promo flow still works
- activity modal still loads and submits feedback
- admin panel still supports booking operations and configuration management

## Assumptions
- Firebase login stays in place for the first migration version
- Firestore remains the phase-1 datastore
- frontend UI and navigation do not need redesign
- polling is acceptable initially for admin and rider history updates
- map/geocoding display can remain in frontend temporarily, but booking-critical calculations should move server-side
- current admin localStorage shortcut is temporary and should be removed during hardening
