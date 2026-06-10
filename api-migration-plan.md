# FastAPI API Migration Plan for IshanCabs (Version 0.2)

## Summary
This migration converts the current client-direct Firebase architecture into a modular FastAPI backend without changing the frontend UI. 
Phase 1 keeps Firebase Auth and Firestore, but moves backend-sensitive logic, authentication guards, and writes behind Python API endpoints.

Chosen defaults for v0.2:
- Keep `Firebase Auth + Firestore` as the Phase 1 datastore.
- Use **WebSockets or Server-Sent Events (SSE)** for real-time dashboard updates (replacing REST polling).
- Execute a phased rollout.
- Keep current frontend pages and UX intact.

---

## Target Architecture
### Backend stack
- `FastAPI` for HTTP/WebSocket APIs
- `Pydantic` for request/response validation
- `Firebase Admin SDK` for token verification, custom user claims, and Firestore access
- `Uvicorn` for local runtime
- `pytest` + `httpx` for backend tests

### Backend module layout
- `backend/app/main.py`
- `backend/app/core/` (includes `auth.py`, `routing.py`, `config.py`)
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
- fare calculation and quote signing
- promo validation and custom claims authorization
- availability checks
- booking creation
- booking status transitions
- driver/vehicle assignment
- admin mutations and geocoding on approval
- feedback submission rules
- profile read/write rules
- media uploads to Firebase Storage

---

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
- Document current payload shapes for user profiles, booking documents, and assigned driver details.
- Identify frontend functions that must become API calls.
- Define standard API response envelope:
  - success: `{ "data": ..., "meta": ... }`
  - error: `{ "error": { "code": "string", "message": "string", "details": ... } }`

---

## Phase 1: Backend Foundation and Security
### Goal
Stand up a production-ready FastAPI service secured with Firebase custom claims token verification.

### Work
- Create backend project structure under `backend/`
- Add environment-based config for Firebase credentials, CORS settings, and server secret keys.
- Initialize Firebase Admin SDK once in `core/`
- Add auth dependency to verify Firebase ID token and attach current user context.
- Implement Role-Based Access Control (RBAC):
  - Decode Firebase custom claims to identify users with `"admin": true`.
  - Create a secure CLI script or endpoint `/api/v1/auth/make-admin` to assign custom claims to configured staff emails.
- Add centralized exception handlers and health checks.

### Endpoints
- `GET /api/v1/health`
- `POST /api/v1/auth/bootstrap` (returns normalized session roles/context)

---

## Phase 2: Profiles, Catalog Reads, and Real-Time Setup
### Goal
Set up real-time server streams and move safe catalog reads to the backend.

### Work
- Set up **SSE (Server-Sent Events) or WebSockets** endpoints for streaming real-time collections.
- Implement read APIs for profiles, settings, active promotions, and predefined locations.
- Connect client UI to real-time streams instead of direct Firebase `onSnapshot` subscriptions.

### Endpoints
- `GET /api/v1/me/profile`
- `PUT /api/v1/me/profile`
- `GET /api/v1/settings/rates`
- `GET /api/v1/offers/visible`
- `POST /api/v1/offers/validate`
- `GET /api/v1/locations`
- `GET /api/v1/flat-fares`
- `GET /api/v1/ws/bookings` (WebSocket connection for live booking feeds) or `/api/v1/sse/bookings` (SSE Stream)

---

## Phase 3: Booking Quote and Booking Creation
### Goal
Move booking-critical calculations to Python. Ensure the browser is never trusted for fares, distances, or direct database commits.

### Work
- Implement server-side routing helper `backend/app/core/routing.py` that queries OSRM and handles Haversine fallbacks.
- Implement **Signed Quote Flow**:
  - The client posts coordinate pairs to `/api/v1/bookings/quote`.
  - The backend computes routing distance and fare options for all tiers.
  - The server signs the quote payload with a cryptographic hash (`quote_signature`) containing the fare, distance, rate version, and expiration timestamp.
- Implement booking creation:
  - Client submits booking with the signature and quote token.
  - Backend verifies the signature and expiration timestamp before writing the booking document.

### Endpoints
- `POST /api/v1/bookings/quote`
- `POST /api/v1/bookings`

---

## Phase 4: Rider Activity and Feedback APIs
### Goal
Securely display rider booking history and handle feedback submissions.

### Work
- Implement authenticated rider booking history query.
- Implement feedback submission with validation rules:
  - User must be the owner of the booking.
  - Ride status must be `'completed'`.
  - Stamps submission with server-side timestamp.

### Endpoints
- `GET /api/v1/me/bookings`
- `POST /api/v1/me/bookings/{booking_id}/feedback`

---

## Phase 5: Admin Booking Operations
### Goal
Move dispatch control, transitions, and geocoding into secure backend endpoints.

### Work
- Implement admin view list endpoints (backed by real-time WebSockets/SSE feeds).
- Implement status transitions:
  - `pending_approval -> confirmed` (Accept & Allocate)
  - `confirmed -> active` (Start Ride)
  - `active -> completed` (Complete Ride)
  - `pending_approval -> rejected` (Reject Request)
- Implement **Approval Geocoding**:
  - The `POST /api/v1/admin/bookings/{booking_id}/approve` endpoint accepts optional `pickup_coords` and `drop_coords` inputs.
  - If provided, the backend recalculates distance/route and recalculates the final fare.

### Endpoints
- `GET /api/v1/admin/bookings`
- `POST /api/v1/admin/bookings/{booking_id}/approve`
- `POST /api/v1/admin/bookings/{booking_id}/reject`
- `POST /api/v1/admin/bookings/{booking_id}/start`
- `POST /api/v1/admin/bookings/{booking_id}/complete`

---

## Phase 6: Fleet and Driver Management APIs
### Goal
Move fleet and driver registries behind backend CRUD endpoints with strict link associations.

### Work
- Implement CRUD operations for vehicles and drivers.
- Implement **File Upload Service**:
  - Create `/api/v1/admin/upload` (utilizing Firebase Storage) to support driver license documentation and vehicle photos.
  - Returns a secure public URL.
- Ensure vehicle and driver assignments are maintained consistently, clearing prior associations automatically.

### Endpoints
- `GET /api/v1/admin/fleet`
- `POST /api/v1/admin/fleet`
- `PUT /api/v1/admin/fleet/{vehicle_id}`
- `DELETE /api/v1/admin/fleet/{vehicle_id}`
- `GET /api/v1/admin/drivers`
- `POST /api/v1/admin/drivers`
- `PUT /api/v1/admin/drivers/{driver_id}`
- `DELETE /api/v1/admin/drivers/{driver_id}`
- `POST /api/v1/admin/upload`

---

## Phase 7: Settings, Offers, Locations, and Flat Fare Admin APIs
### Goal
Move all remaining settings and fare overrides to backend-managed configuration routes.

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

---

## Phase 8: Frontend Service Refactor
### Goal
Retire direct Firestore data SDK access from the frontend, routing all actions through lightweight API client wrappers.

### Work
- Create frontend client `apiClient.js` and feature modules (`authApi.js`, `bookingApi.js`, `adminApi.js`).
- Refactor the frontends so UI and maps remain intact, but data is queried and written via REST/SSE endpoints.

---

## Phase 9: Hardening, Cleanup, and Production Readiness
### Goal
Transition the system into a hardened, production-ready environment.

### Work
- **Strict Firestore Lockdown**: Update rules so *only* the backend service account has write privileges.
- Add pagination and filtering to admin queries.
- Add rate limiting and request validation checks.
- Add structured logging and write tests.

---

## Backlog / Post-MVP Enhancements
1. **Atomic Allocation Transactions**: Implement Firestore Transaction writes inside booking approval/start status changes to prevent double-booking overlaps.
2. **Offline Mode / Degraded Sync**: Cache quotes locally on the mobile frontend for spotty connectivity.

---

## API Contract Specifications

### `BookingQuoteRequest` (Pydantic Model)
```python
class BookingQuoteRequest(BaseModel):
    ride_type: str  # "local" | "outstation" | "rental"
    pickup_location: str
    drop_location: Optional[str] = None
    pickup_coords: Optional[List[float]] = None  # [lat, lng]
    drop_coords: Optional[List[float]] = None    # [lat, lng]
    pickup_datetime: datetime
    outstation_days: Optional[int] = 1
    rental_hours: Optional[int] = 0
    promo_code: Optional[str] = None
```

### `CreateBookingRequest` (Pydantic Model)
```python
class CreateBookingRequest(BaseModel):
    pickup_location: str
    drop_location: Optional[str] = None
    pickup_coords: Optional[List[float]] = None
    drop_coords: Optional[List[float]] = None
    pickup_date: str
    pickup_time: str
    ride_type: str
    vehicle_tier: str  # "compact" | "premium" | "suv" | "muv"
    outstation_days: Optional[int] = None
    rental_hours: Optional[int] = None
    applied_promo_code: Optional[str] = None
    quote_signature: str
    quoted_fare: float
```
