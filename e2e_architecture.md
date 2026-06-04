# 🚖 IshanCabs: End-to-End (E2E) Architecture Document

This document provides a comprehensive end-to-end technical overview of the **IshanCabs Web Application** architecture. It describes the client-first serverless structure, outlines user interaction sequence flows for different modules, documents database schemas, and models document relationships.

---

## 1. 🌐 High-Level System Architecture

IshanCabs is built on a **Serverless, Client-First Architecture**. The application does not require a custom backend application server; instead, the browser executes the core application logic and establishes secure, direct connections to cloud services and third-party APIs.

```mermaid
graph TB
    %% Styling
    classDef actor fill:#1E293B,stroke:#F59E0B,stroke-width:2px,color:#fff;
    classDef system fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#fff;
    classDef cloud fill:#172554,stroke:#3B82F6,stroke-width:2px,color:#fff;
    classDef external fill:#1C1917,stroke:#A8A29E,stroke-width:1.5px,color:#A8A29E;

    Rider([Rider / Customer]):::actor
    Admin([Fleet Administrator]):::actor

    Browser["Web UI Layer (HTML, CSS, JS)
    Renders Premium Glassmorphic Cards"]:::system
    
    Firebase["Firebase Authentication
    Secure Sessions & Users Catalog"]:::cloud
    
    Firestore[("Cloud Firestore DB
    Real-Time Data Streaming")]:::cloud
    
    OSRM["OSRM & Nominatim APIs
    Routing Geometry & Geocoding"]:::external
    
    NotificationEngine["CallMeBot / EmailJS
    Outbound Alert Dispatches"]:::external

    %% Interconnections
    Rider -->|"Books cab, views history"| Browser
    Admin -->|"Manages roster & approves bookings"| Browser
    
    Browser <-->|"Authenticates session"| Firebase
    Browser <-->|"Direct CRUD / Real-time snapshot streams"| Firestore
    Browser -->|"Requests geocodes & route coordinates"| OSRM
    Browser -->|"Dispatches transactional notifications"| NotificationEngine
```

---

## 2. 🔄 Module Interaction Flows (Stick / Sequence Diagrams)

These sequence diagrams depict step-by-step system interactions across different modules.

### A. Rider Authentication & Session Initialization
This flow manages secure access checks during client load, separating standard riders from dashboard administrators.

```mermaid
sequenceDiagram
    autonumber
    actor Rider as Rider / User
    participant Browser as Web Browser (app.js)
    participant FBAuth as Firebase Auth
    participant Firestore as Firestore (/users)
    actor Admin as Administrator

    Rider->>Browser: Loads landing page (index.html)
    Browser->>FBAuth: Check current authentication state (onAuthStateChanged)
    
    alt User is Logged In
        FBAuth-->>Browser: Returns user object (UID, Email)
        Browser->>Firestore: Queries user profile details by UID
        Firestore-->>Browser: Returns user document (role)
        
        alt User Role is "admin"
            Browser->>Browser: Hides Booking buttons & reveals "Admin Panel" CTA
            Admin->>Browser: Clicks "Admin Panel"
            Browser->>Browser: Redirects to modules/admin/admin.html
        else User Role is "rider"
            Browser->>Browser: Reveals "Book Cab" & "Activity" CTA buttons
        end
    else User is Guest (Logged Out)
        Browser->>Browser: Directs user to authenticate if they click Book Cab
    end
```

---

### B. Customer Booking & Custom Location Map Flow
This flow represents the 3-step customer checkout loop. It coordinates Leaflet mapping, Nominatim searching, OSRM route calculations, overbooking checks, promo verification, and database logging.

```mermaid
sequenceDiagram
    autonumber
    actor Rider as Rider / User
    participant Page as Booking UI (booking.html)
    participant Controller as Controller (bookingUI.js)
    participant Maps as Leaflet & OSRM API
    participant Engine as Engine (bookingService.js)
    participant Firestore as Cloud Firestore

    Rider->>Page: Enters Route Details (Step 1)
    
    alt Custom Location selected
        Controller->>Page: Displays Leaflet map picker
        Rider->>Page: Searches address or drags Pickup/Drop markers
        Page->>Maps: Request Nominatim Reverse-Geocode
        Maps-->>Page: Return formatted address string
    end
    
    Rider->>Page: Submits Step 1 (pickup datetime, locations)
    Controller->>Controller: Enforces 2-hour scheduling lead time verification
    
    alt Standard Ride Category
        Controller->>Maps: Query OSRM Driving distance & geometry
        Maps-->>Controller: Returns route polyline array & total kilometers
    else Rental Category
        Controller->>Controller: Bypasses Drop parameters & OSRM requests
    end
    
    Controller->>Engine: Run availability checking & fare estimations
    Engine->>Firestore: Check database collections for active rate configuration matrix
    Firestore-->>Engine: Returns active rates (base, rate_per_km, rate_per_hour)
    Engine->>Engine: Compiles estimated fares per vehicle tier
    
    Engine->>Firestore: Check overbookings (compares active booking counts vs. vehicle roster size)
    Firestore-->>Engine: Returns capacity states
    
    alt Fleet Tier is Sold Out
        Engine-->>Page: Displays "Sold Out" state and locks tier card selection
    else Fleet Tier is Available
        Engine-->>Page: Displays calculated fares for Sedan, SUV, and MUV cards
    end

    Rider->>Page: Selects class card & advances to Review (Step 3)
    
    opt Enters Promo Discount Code
        Controller->>Firestore: Query coupon details from /offers collection
        Firestore-->>Controller: Returns status, minimum threshold, and discount value
        Controller->>Controller: Validates promo restrictions & applies deduction
    end

    Rider->>Page: Clicks "Confirm & Book"
    Controller->>Engine: Call createBooking(payload)
    Note over Engine: Sets driver_assignment to null (unallocated queue)
    Engine->>Firestore: Writes new record in /bookings collection
    Firestore-->>Engine: Document logged, returns Booking ID (BK-YYYYMMDD-XXXX)
    Engine-->>Page: Triggers success banner
    Page-->>Rider: Shows success screen & schedules auto-redirect to home
```

---

### C. Admin Ride Approval & Roster Allocation
This sequence details how administrators assign available drivers/vehicles to requested rides, checking for scheduling conflicts in real-time.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Fleet Administrator
    participant Panel as Admin Panel (admin.html)
    participant Logic as Admin Controller (adminUI.js)
    participant Firestore as Cloud Firestore

    Note over Logic: Snapshot listeners are active for bookings, vehicles, and drivers
    Firestore-->>Logic: Stream database updates dynamically
    Logic->>Panel: Populate list tables and update dashboard KPI metrics counters

    Admin->>Panel: Accesses "Requested" booking list & clicks "Accept Ride"
    Logic->>Logic: Calls loadFleetRoster()
    Note over Logic: Roster entries = active drivers associated with active vehicles
    
    Logic->>Firestore: Query existing bookings where status is "confirmed" or "active"
    Firestore-->>Logic: Returns busy driver phones & vehicle license plates
    
    Logic->>Panel: Populate Dropdown Roster grouped by Tier
    Note over Panel: Options holding busy drivers/cars are flagged as "[Busy - On Ride]"
    
    Admin->>Panel: Selects dynamic driver-car option (or fills manual text overrides)
    
    opt Choice has "[Busy - On Ride]" Tag
        Logic->>Panel: Renders inline warning notification on screen
    end
    
    Admin->>Panel: Adjusts manual override discount (optional) & clicks "Confirm Allocation"
    
    Logic->>Logic: Executes double-booking conflict verification
    
    alt Selected Roster Entry is Confirmed/Active on another ride
        Logic->>Panel: Blocks submit action & triggers warning alert block
    else Selected Roster Entry is Free
        Logic->>Firestore: Updates /bookings/{id} (status: "confirmed", driver_assignment: {...})
        Firestore-->>Logic: Record updated successfully
        Logic->>Panel: Closes modal and updates lists in real-time
    end
```

---

### D. Driver & Vehicle Registry Association Flow
This details the bidirectional reference mapping mechanism when updating or registering operators.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Fleet Administrator
    participant Panel as Admin Panel
    participant Logic as Admin Controller (adminUI.js)
    participant Firestore as Cloud Firestore

    Admin->>Panel: Fills Vehicle Form (Plate: WB02A1111) & assigns Driver (Phone: 918981538038)
    Admin->>Panel: Clicks "Save Vehicle"
    Logic->>Firestore: Writes vehicle document (doc_id: "WB02A1111", assigned_driver_id: "918981538038")
    
    opt Vehicle was previously linked to another driver
        Logic->>Firestore: Updates previous driver document setting assigned_vehicle_id: null
    end
    
    Logic->>Firestore: Updates assigned driver document setting assigned_vehicle_id: "WB02A1111"
    
    opt Driver was previously linked to another vehicle
        Logic->>Firestore: Updates previous vehicle document setting assigned_driver_id: null
    end
    
    Firestore-->>Logic: Write operations complete
    Logic->>Panel: Clears forms, repopulates dropdown selectors, and updates tables via snapshot
```

---

## 3. 🗄️ Database Schemas (Cloud Firestore Collections)

Firestore collections are structured as NoSQL JSON documents. Relationships between collections are maintained by storing reference IDs as strings.

### 1. Users Collection (`/users/{uid}`)
Contains customer profile details and roles used for authentication boundaries.
*   **Document ID**: Firebase Auth User UID.

| Field Key | Data Type | Description |
| :--- | :--- | :--- |
| `uid` | `string` | Unique identifier generated by Firebase Auth. |
| `name` | `string` | User's full name. |
| `email` | `string` | User's email address. |
| `phone` | `string` | Contact phone number. |
| `role` | `string` | User permission role (`"rider"` or `"admin"`). |
| `creation_ts` | `Timestamp` | Record creation date and time. |

---

### 2. Bookings Collection (`/bookings/{booking_id}`)
Stores transactional ride requests, parameters, fare details, and driver/car allocations.
*   **Document ID**: Readable date-based unique string (e.g. `BK-20260604-9844`).

| Field Key | Data Type | Description |
| :--- | :--- | :--- |
| `booking_id` | `string` | Unique booking identification number. |
| `customer_id` | `string` | Reference ID matching `/users.uid`. |
| `customer_name` | `string` | User name snapshot copy for fast rendering. |
| `customer_phone` | `string` | User phone snapshot copy. |
| `status` | `string` | State lifecycle: `"pending_approval"`, `"confirmed"`, `"active"`, `"completed"`, `"rejected"`, `"cancelled"`. |
| `payment_status` | `string` | Ledger status: `"pending"`, `"paid"`. |
| `creation_ts` | `Timestamp` | Booking checkout timestamp. |
| `updated_ts` | `Timestamp` | Last modification timestamp. |
| `trip_details` | `Map (Object)` | Holds trip parameters (detailed below). |
| `fare_details` | `Map (Object)` | Holds fare estimations and discounts (detailed below). |
| `driver_assignment` | `Map` or `null` | Allocated driver and vehicle details (detailed below). |
| `feedback` | `Map` or `null` | Rider star rating and comments (detailed below). |
| `rejection_reason` | `string` or `null` | Logged explanation when status is `"rejected"`. |

#### `trip_details` Map Structure:
*   `ride_type`: `string` (`"local"`, `"outstation"`, `"rental"`).
*   `pickup_location`: `string` (Address title).
*   `drop_location`: `string` or `null` (Destination address title).
*   `pickup_date`: `string` (`YYYY-MM-DD`).
*   `pickup_time`: `string` (`HH:MM` in 24-hr format).
*   `outstation_days`: `number` or `null` (Duration for outstation category).
*   `rental_hours`: `number` or `null` (Duration for hourly rentals).
*   `pickup_coords`: `Array [lat, lng]` (Coordinates).
*   `drop_coords`: `Array [lat, lng]` or `null` (Coordinates).
*   `route_polyline`: `string` or `null` (JSON stringified array of coordinates).

#### `fare_details` Map Structure:
*   `vehicle_tier`: `string` (`"sedan"`, `"suv"`, `"muv"`).
*   `estimated_km`: `number` (Driving distance).
*   `base_fare`: `number` (Initial fare configuration mapping).
*   `discount_amount`: `number` (Discount amount applied).
*   `promo_code`: `string` or `null` (Coupon code code).
*   `estimated_fare`: `number` (Grand total amount: `base_fare - discount_amount`).

#### `driver_assignment` Map Structure (or `null`):
*   `driver_name`: `string` (Allocated operator name).
*   `driver_phone`: `string` (Allocated operator phone).
*   `vehicle_number`: `string` (Allocated vehicle plate number).

#### `feedback` Map Structure (or `null`):
*   `rating`: `number` (Integer range: 1 to 5).
*   `comments`: `string` (Feedback review comments).

---

### 3. Vehicles Collection (`/vehicles/{vehicle_id}`)
Maintains the operator fleet inventory.
*   **Document ID**: Standardized uppercase alphanumeric plate number (e.g. `WB02A1111` for "WB-02-A-1234").

| Field Key | Data Type | Description |
| :--- | :--- | :--- |
| `model` | `string` | Vehicle model name (e.g., `"Maruti Swift Dzire"`, `"Toyota Innova"`). |
| `plate_number` | `string` | Display license plate string with formatted dashes. |
| `tier` | `string` | Pricing category classification (`"sedan"`, `"suv"`, `"muv"`). |
| `status` | `string` | Maintenance state (`"active"`, `"maintenance"`, `"inactive"`). |
| `assigned_driver_id` | `string` or `null` | Reference ID matching `/drivers.id` (stripped phone). |
| `creation_ts` | `Timestamp` | Roster log timestamp. |

---

### 4. Drivers Collection (`/drivers/{driver_id}`)
Holds the operator drivers registry.
*   **Document ID**: Standardized stripped digits-only phone number (e.g. `918981538038`).

| Field Key | Data Type | Description |
| :--- | :--- | :--- |
| `name` | `string` | Driver operator's full name. |
| `phone` | `string` | Format contact number string (e.g., `"+918981538038"`). |
| `license_number` | `string` | Driver's commercial licensing ID. |
| `status` | `string` | Availability state (`"active"`, `"sick"`, `"on_leave"`, `"inactive"`). |
| `assigned_vehicle_id` | `string` or `null` | Reference ID matching `/vehicles.id` (stripped plate). |
| `creation_ts` | `Timestamp` | Registration log timestamp. |

---

### 5. Offers Collection (`/offers/{code}`)
Coupon codes list compiled for customer deductions.
*   **Document ID**: Upper-case promo code title string (e.g., `SAVE200`).

| Field Key | Data Type | Description |
| :--- | :--- | :--- |
| `code` | `string` | Coupon display code. |
| `type` | `string` | Deduction strategy (`"flat"` value or `"percentage"` ratio). |
| `value` | `number` | Numeric deduction rate (e.g. `200` for flat or `15` for 15%). |
| `min_fare_threshold`| `number` | Minimum booking grand total base required to qualify. |
| `status` | `string` | State parameters (`"active"` or `"inactive"`). |
| `creation_ts` | `Timestamp` | Promotion creation timestamp. |

---

### 6. Settings Collection (`/settings/rates`)
Global configurations used for dynamic system values.
*   **Document ID**: `rates` (Holds nested configurations).

| Field Key | Data Type | Structure Map Description |
| :--- | :--- | :--- |
| `rates` | `Map (Object)` | Holds nested pricing matrices for vehicle tiers: `sedan`, `suv`, and `muv`. |

#### Nested Tier Rate Map Structure:
*   `base_cost`: `number` (Base booking minimum charge).
*   `rate_per_km`: `number` (Distance per-kilometer multiplier).
*   `rate_per_hour`: `number` (Hourly duration multiplier for rentals).
*   `driver_allowance_per_day`: `number` (Outstation operator daily halt allowance).

---

## 4. 📊 Entity Relationship Diagram (ERD)

This diagram visualizes relationships between the Firestore document collections. Relationships are maintained logically using string references representing keys.

```mermaid
erDiagram
    users {
        string uid PK "Document ID"
        string name
        string email
        string phone
        string role
        timestamp creation_ts
    }
    
    bookings {
        string booking_id PK "Document ID"
        string customer_id FK "References users.uid"
        string status
        string payment_status
        object trip_details
        object fare_details
        object driver_assignment FK "Holds reference fields to drivers & vehicles"
        object feedback
        string rejection_reason
        timestamp creation_ts
        timestamp updated_ts
    }
    
    vehicles {
        string id PK "Document ID (standardized plate)"
        string model
        string plate_number
        string tier
        string status
        string assigned_driver_id FK "References drivers.id"
        timestamp creation_ts
    }
    
    drivers {
        string id PK "Document ID (standardized phone)"
        string name
        string phone
        string license_number
        string status
        string assigned_vehicle_id FK "References vehicles.id"
        timestamp creation_ts
    }
    
    offers {
        string id PK "Document ID (promo code string)"
        string code
        string type
        number value
        number min_fare_threshold
        string status
        timestamp creation_ts
    }
    
    settings_rates {
        string id PK "Document ID ('rates')"
        object rates "Map containing sedan, suv, muv parameters"
    }

    users ||--o{ bookings : "submits"
    drivers |o--o| vehicles : "assigned bidirectionally (assigned_vehicle_id / assigned_driver_id)"
    bookings }o--o| drivers : "allocated on approval (driver_assignment.driver_phone)"
    bookings }o--o| vehicles : "allocated on approval (driver_assignment.vehicle_number)"
```
