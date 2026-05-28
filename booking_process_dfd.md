# 🚖 IshanCabs: Booking & Notifications Data Flow Diagram (DFD)

This document visualizes the data flow architectures of the customer booking lifecycle, the dummy fleet selector, and the planned future notification pipelines (Email, SMS, and Admin alert triggers).

---

## 📊 Visual DFD: Process Pipeline Flowchart

This interactive DFD is structured using Mermaid flowchart syntax. It details the existing customer booking database transaction flow alongside the proposed status-driven automated notification subsystems.

```mermaid
graph TD
    %% Styling Definitions
    classDef rider fill:#1E293B,stroke:#F59E0B,stroke-width:2px,color:#fff;
    classDef system fill:#0F172A,stroke:#38BDF8,stroke-width:2px,color:#fff;
    classDef database fill:#172554,stroke:#3B82F6,stroke-width:2px,color:#fff;
    classDef future fill:#1C1917,stroke:#A8A29E,stroke-width:1.5px,stroke-dasharray: 5 5,color:#A8A29E;

    %% Elements Mapped
    R1[Rider: Launches Booking]:::rider
    R2[Verify Auth & Profile State]:::system
    R3["Step 1: Select Journey (Date & Time)"]:::rider
    R4["Step 2: Select Vehicle Class (Select Fleet)"]:::rider
    R5["Step 3: Review Details & Confirm"]:::rider
    
    DB1[(Firestore: bookings collection)]:::database
    JSON1[dummyFleet.json]:::database
    
    F1["Future: Cloud Function Trigger (OnCreate)"]:::future
    F2["Future: Rider Notification (Email/SMS Receipt)"]:::future
    F3["Future: Admin Push Alert (New Booking)"]:::future
    
    A1["Future: Admin Panel Approval/Manual Re-assignment"]:::future
    DB2[(Firestore: Update Status to Confirmed)]:::database
    
    F4["Future: Driver Notification (SMS Job Details)"]:::future
    F5["Future: Rider Final Confirmation (Email/SMS Invoice)"]:::future

    %% Data Flow Connections
    R1 --> R2
    R2 -- "If Unauthenticated" --> AuthPage["Auth: Phone OTP / Google"]:::system
    AuthPage -- "On Success" --> R3
    R2 -- "If Authenticated" --> R3
    
    R3 --> R4
    R4 -- "Local Fetch & Random Allocation" --> JSON1
    JSON1 --> R5
    
    R5 -->|"Commit Payload"| DB1
    
    %% Future Notification Pipeline
    DB1 -->|"DB Document Triggers"| F1
    F1 --> F2
    F1 --> F3
    
    F2 -->|"Dispatches PDF Receipt"| R_Email[Rider Inbox]:::rider
    F3 -->|"Dispatches System Alert"| A1
    
    A1 -->|"Admin Approves Booking"| DB2
    DB2 -->|"Status Transition"| F_Trigger["Future: Cloud Function Trigger (OnUpdate)"]:::future
    
    F_Trigger --> F4
    F_Trigger --> F5
    
    F4 -->|"Dispatches Job Specs"| D_Phone[Driver Device]:::rider
    F5 -->|"Dispatches Live Trip Invoice"| R_Email
```

---

## 🔍 Detailed Data Flow Description

### 1. Booking Phase (Active Implementation)
1. **Auth & Profile Check**: When the rider opens `/modules/booking/booking.html`, the session state is validated. If the rider lacks a profile, they are redirected to `/modules/auth/auth.html`.
2. **Journey Setup**: Rider selects locations, pickup date, and pickup time (30-minute interval select dropdown). The system restricts inputs to require at least **2 hours scheduling lead time**.
3. **Fleet Selection**: The system fetches flat metrics or calculates round-trip outstation costs and checks vehicles availability. The system does a standard `fetch()` load of `/modules/booking/dummyFleet.json`, extracts the mapped array for the selected tier, and selects a driver/vehicle randomly.
4. **Local Database Commit**: When clicking **Confirm & Book**, the payload is committed directly to Cloud Firestore under `/bookings/{booking_id}` with `status: "pending_approval"`, and an on-screen success prompt is displayed.

---

### 2. Notifications Phase (Planned Enhancements)
1. **Background Cloud Trigger**: Committing a new booking to Firestore fires an `onCreate` trigger inside a Firebase Cloud Function.
2. **Instant Customer Receipt**: The Cloud Function processes the customer's profile details and dispatches a clean transactional email (via SendGrid/Mailgun) or SMS (via Twilio) containing the structured booking breakdown and a PDF receipt.
3. **Instant Admin Dispatch Alert**: The Cloud Function sends a real-time push alert or SMS notification to the administrator panel, warning the fleet controller that a new ride request (`pending_approval`) has arrived.

---

### 3. Verification & Driver Dispatch Phase (Planned Enhancements)
1. **Admin Approval Actions**: The administrator reviews all active pending bookings on the central control panel. The admin can verify details, change the auto-assigned mock driver to a manual choice, and hit **Approve**.
2. **Database Status Update**: Approving the ride updates the document status inside the Firestore bookings collection to `status: "confirmed"`.
3. **Update Trigger Execution**: The database status transition fires an `onUpdate` trigger inside Firebase Cloud Functions.
4. **Automated Driver Dispatch**: The trigger compiles trip details and dispatches a direct SMS to the assigned driver's registered phone, containing coordinates and pickup schedules.
5. **Rider Confirmation Alert**: Concurrently, the trigger dispatches a confirmation email and SMS to the customer, indicating that their ride has been successfully approved, showing their final live driver name, phone number, and vehicle registration license plate.
