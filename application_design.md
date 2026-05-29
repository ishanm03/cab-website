# 🚖 IshanCabs: High-Level Application Design & Architecture Document

This document outlines the high-level system architecture, database design, and component interactions of the **IshanCabs Web Application**. It serves as an architectural blueprint for developers, stakeholders, and clients.

---

## 1. 🌐 High-Level Architecture Overview

IshanCabs is built as a **Serverless, Client-First Web Application**. Instead of utilizing a custom-built backend server (like Node.js/Express or Python/Django), the application runs directly inside the customer's web browser and communicates securely with cloud-based services.

### Core Architecture Pillars:
1. **Frontend (Browser Environment)**: Renders the user interface. Built with HTML5, CSS3, Tailwind CSS (for modern layouts), and standard ES Modules (JavaScript) for modular code structure.
2. **Database & Auth (Cloud Infrastructure)**: Uses **Firebase Authentication** for secure sign-in (OTP and Google OAuth) and **Cloud Firestore** as a real-time, NoSQL document database.
3. **External Services (Notification Gateways)**: Uses third-party REST APIs (like EmailJS and CallMeBot/Twilio) to trigger automated transactional emails and WhatsApp alerts.

---

## 2. 📊 C4 Architecture Diagrams

The C4 model helps visualize system boundaries, containers, and code components in progressive levels of detail.

### C4 Level 1: System Context Diagram
This diagram shows the system boundaries and how different actors (Rider, Admin) interact with the IshanCabs platform and external services.

```mermaid
graph TB
    %% Styling
    classDef actor fill:#1E293B,stroke:#F59E0B,stroke-width:2px,color:#fff;
    classDef system fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#fff;
    classDef external fill:#1C1917,stroke:#A8A29E,stroke-width:1.5px,stroke-dasharray: 5 5,color:#A8A29E;

    Rider([Rider / Customer]):::actor
    Admin([Administrator]):::actor

    IshanCabs["IshanCabs Web Application
    (Static Client App)"]:::system
    
    Firebase["Firebase Services
    (Auth & Firestore Database)"]:::system
    
    EmailGateway["Email Gateway
    (EmailJS / SMTP)"]:::external
    
    WAGateway["WhatsApp Gateway
    (CallMeBot / Twilio Sandbox)"]:::external

    %% Relations
    Rider -->|"Book Cabs, Views Fare"| IshanCabs
    Admin -->|"Manages Bookings & Fleet"| IshanCabs
    
    IshanCabs -->|"Reads/Writes Data & Session Checks"| Firebase
    IshanCabs -->|"Triggers Receipts & Alerts"| EmailGateway
    IshanCabs -->|"Triggers Real-time WhatsApp Texts"| WAGateway
    
    EmailGateway -->|"Delivers Booking Receipt"| Rider
    EmailGateway -->|"Delivers Booking Alert Digest"| Admin
    WAGateway -->|"Delivers Automated Alert"| Admin
```

---

### C4 Level 2: Container Diagram
This diagram drills down into the core containers that run inside the browser and how they connect to the database and external integrations.

```mermaid
graph TB
    %% Styling
    classDef container fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#fff;
    classDef cloud fill:#172554,stroke:#3B82F6,stroke-width:2px,color:#fff;
    classDef external fill:#1C1917,stroke:#A8A29E,stroke-width:1.5px,color:#A8A29E;

    subgraph BrowserContainer ["Web Browser (Rider's Device)"]
        UI["UI & Markup Layer
        (HTML / CSS / Tailwind)"]:::container
        
        AuthMod["Auth Module
        (User Sessions & OTP)"]:::container
        
        BookingMod["Booking Module
        (Route Setup, Fleet & Checkout)"]:::container
        
        SharedMod["Shared Core Utilities
        (Firebase Config & Routes Matrix)"]:::container
    end

    Firestore[("Cloud Firestore
    NoSQL Database")]:::cloud
    
    FBAuth["Firebase Authentication
    Secure Sessions"]:::cloud
    
    EmailService["EmailJS API Services"]:::external
    WAService["WhatsApp REST Gateway"]:::external

    %% Connectors
    UI --> AuthMod
    UI --> BookingMod
    
    AuthMod -->|"Reads config"| SharedMod
    BookingMod -->|"Reads config & matrix"| SharedMod
    
    AuthMod -->|"Authenticates"| FBAuth
    BookingMod -->|"CRUD Booking/Fleet Data"| Firestore
    
    BookingMod -->|"Dispatches Emails"| EmailService
    BookingMod -->|"Dispatches WhatsApp Alerts"| WAService
```

---

### C4 Level 3: Component Diagram for Booking/Notification Container
This diagram illustrates the code structure inside the **Booking Module** and how modules import each other to calculate fares and process checkouts.

```mermaid
graph TD
    %% Styling
    classDef ui fill:#1E293B,stroke:#F59E0B,stroke-width:2px,color:#fff;
    classDef service fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#fff;
    classDef helper fill:#172554,stroke:#3B82F6,stroke-width:1.5px,color:#fff;

    bookingHTML["booking.html
    (Multi-Step Interface)"]:::ui
    
    bookingUI["bookingUI.js
    (DOM Controller & Validations)"]:::ui
    
    bookingService["bookingService.js
    (Fare Math, Firestore Commits)"]:::service
    
    notifyService["notificationService.js
    (EmailJS & CallMeBot Connectors)"]:::service
    
    routesMatrix["routesMatrix.js
    (Pre-calculated Distances)"]:::helper
    
    dbService["dbService.js
    (Core CRUD Helpers)"]:::helper

    %% Dependencies
    bookingHTML <-->|"Event listeners & updates"| bookingUI
    bookingUI -->|"Triggers calculations & checkout"| bookingService
    bookingUI -->|"Reads static routes"| routesMatrix
    
    bookingService -->|"Validates user profile"| dbService
    bookingService -->|"Launches async alerts"| notifyService
    bookingService -->|"Reads static rates"| routesMatrix
```

---

## 3. 🔄 System Process Flowcharts

### Customer Booking Lifecycle (Multi-Step Wizard)
This flowchart shows how a user moves through the multi-step booking process, enforcing lead times and verifying fleet availability.

```mermaid
flowchart TD
    Start([Rider enters booking screen]) --> Step1[Step 1: Input pickup, destination, date & time]
    Step1 --> VerifyLead{Is pickup datetime > 2 hours from now?}
    
    VerifyLead -- "No" --> RejectTime[Show warning & block progress]
    RejectTime --> Step1
    
    VerifyLead -- "Yes" --> SubmitStep1[Submit Route Details]
    SubmitStep1 --> Step2[Step 2: Fetch vehicle categories and estimated fares]
    
    Step2 --> CheckInv{Is fleet available for selected category & date?}
    CheckInv -- "No" --> ShowSoldOut[Show 'Sold Out' & disable card selection]
    CheckInv -- "Yes" --> ShowFares[Display computed fares & enable card selection]
    
    ShowFares --> SelectCar[Rider selects car card & clicks Review]
    ShowSoldOut --> Step2
    
    SelectCar --> Step3[Step 3: Review ride summary & click Confirm]
    Step3 --> WriteDB[(Write booking to Firestore)]
    
    WriteDB --> SuccessScreen[Show success prompt & return booking ID]
    SuccessScreen --> TriggerNotifications[Trigger email receipts and WhatsApp alerts]
```

---

## 4. 🗄️ Database Entity Relationship Diagram (ERD)

This physical model shows the Firestore collection schemas and how documents link to each other. Because Firestore is NoSQL, relations are maintained by storing reference IDs (Foreign Keys) in the documents.

```mermaid
erDiagram
    users ||--o{ bookings : "creates"
    drivers ||--o{ vehicles : "is assigned to"
    vehicles ||--o{ bookings : "is scheduled in"
    drivers ||--o{ bookings : "drives for"

    users {
        string uid PK "Firebase Authentication UID"
        string name "User Name"
        string email "Email Address"
        string phone "Contact Number"
        string role "Rider or Admin role"
        timestamp creation_ts "Profile creation time"
    }

    bookings {
        string booking_id PK "Unique Booking Number (BK-YYYYMMDD-XXXX)"
        string customer_id FK "Reference to users.uid"
        string ride_type "local, intercity, or outstation"
        string pickup_location "Starting Address"
        string drop_location "Destination Address"
        timestamp pickup_datetime "Schedule date & time"
        integer outstation_days "Outstation duration in days"
        string vehicle_tier "sedan, suv, or muv"
        float estimated_km "Computed driving distance"
        float estimated_fare "Final estimated cost"
        string status "pending_approval, confirmed, completed, or cancelled"
        string payment_status "pending, paid"
        string assigned_driver_name "Assigned driver name copy"
        string assigned_driver_phone "Assigned driver phone copy"
        string assigned_vehicle_number "Assigned car license plate copy"
        timestamp creation_ts "Booking submission time"
    }

    vehicles {
        string vehicle_id PK "Vehicle License Plate (e.g. WB-02-A-1234)"
        string tier "sedan, suv, or muv"
        string model "Car brand name (e.g. Swift Dzire)"
        string status "active, breakdown, or retired"
        string assigned_driver_id FK "Reference to drivers.driver_id"
        timestamp creation_ts "Roster registration time"
    }

    drivers {
        string driver_id PK "Unique Driver ID (DRV-YYYYMMDD-XXXX)"
        string name "Driver's full name"
        string phone "Driver's contact number"
        string status "active, sick, on_leave, or suspended"
        timestamp creation_ts "Roster registration time"
    }
```

---

## 5. 📖 High-Level Component Explanations

Here is a straightforward explanation of each file in the codebase and what it is responsible for.

### 🏠 Landing Page & Entry
* **[index.html](file:///Users/ishanmukherjee/AI_Learning/Cab-Website-Build/cab-website/index.html)**: The main entry point of the website. Renders the interactive homepage, showcasing the service tiers, promotional cards, and primary CTA buttons.
* **[app.js](file:///Users/ishanmukherjee/AI_Learning/Cab-Website-Build/cab-website/app.js)**: Configures global layouts, checks current session states, and coordinates links between the homepage and sub-modules.
* **[styles.css](file:///Users/ishanmukherjee/AI_Learning/Cab-Website-Build/cab-website/styles.css)**: The primary visual design system. Outlines typography, custom animations, transitions, and dark background palettes.

### 🔐 Authentication Module (`modules/auth/`)
* **`auth.html`**: A modern interface allowing riders to log in using Google Single Sign-On or standard OTP verification.
* **`authService.js`**: Connects directly with the Firebase Auth API to trigger OTP requests, verify user codes, or resolve Google profile metadata.
* **`authUI.js`**: Listens to user inputs in `auth.html`, validates character inputs, displays error banners, and manages screen redirects on successful sign-in.

### 🚖 Booking Module (`modules/booking/`)
* **`booking.html`**: The multi-step booking panel (Route Setup -> Vehicle Class -> Dispatch Review) designed with a glassmorphic styling system.
* **`bookingUI.js`**: Binds actions to inputs. Manages the visual transition between steps, updates badges (such as showing estimated kilometers), configures date constraints, and displays alerts if fields are missed.
* **`bookingService.js`**: The core operational engine. It queries active fleet occupancy on selected dates to check availability, runs the per-kilometer fare calculations, fetches mock driver/car data, and commits completed bookings to Cloud Firestore.
* **`booking.css`**: Contains styling specifics for step-dot progress indicators, car cards, and animated sold-out overlays.

### ✉️ Notification Module (`modules/booking/notificationService.js`)
* **`notificationService.js`**: The outbound notification engine. Compiles booking receipt attributes, formats styled HTML structures, and dispatches API requests to EmailJS (sending copy receipts to both Rider and Admin) and CallMeBot/Twilio (sending real-time text alerts to the fleet controller's device).

### 🛠️ Shared Core Module (`modules/shared/`)
* **`firebase.js`**: Initializes the global Firebase connection using project configuration keys.
* **`dbService.js`**: Housekeeping CRUD database routines (such as fetching user profile data).
* **`routesMatrix.js`**: A centralized data list containing static distance mappings and fixed/flat route fares between key local terminals (such as Airport and Railway Station).
* **`utils.js`**: Global helper functions used throughout the application (such as formatting currencies to Indian Rupees or toggling visibility classes).
