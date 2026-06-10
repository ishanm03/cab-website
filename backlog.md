# 🚖 IshanCabs: Product Requirements Backlog

This document maintains the backlog of pending enhancements, architectural changes, and new features planned for **IshanCabs**. Tasks are categorized by module and priority.

---

## 📋 Backlog Items

### 🛠️ Epic 1: Fleet & Driver Registry Enhancements
Improvements to the admin roster database controls.
*   `[ ]` **Task 1.1: Vehicle Registration Date Tracking**
    *   **Description**: Add a new "Addition Date" field in the Fleet Control panel when adding a new vehicle.
    *   **Implications**: Store `addition_date` in the `/vehicles` Firestore document and render it in the Fleet Inventory list table.
*   `[ ]` **Task 1.2: Driver Registration Date Tracking**
    *   **Description**: Add a new "Registration Date" field in the Driver Control registry.
    *   **Implications**: Store `registration_date` in the `/drivers` Firestore document and render it in the Driver Registry list table.

### 📉 Epic 2: Administrative Control Scaling
Operational stability upgrades for high-traffic handling.
*   `[ ]` **Task 2.1: Ride Management Pagination**
    *   **Description**: Implement pagination (e.g. load first 20 records and load more on scroll/click) for the bookings list across all tabs of "Ride Management" in the Admin Panel (All, Requested, Confirmed, On-Going, Completed, Rejected).
    *   **Implications**: Replaces unpaginated snapshot listeners to reduce browser memory usage and limit Firestore read billing counts.

### 🎨 Epic 3: Rider UX & Checkout Friction Reduction
Small enhancements to improve the customer booking experience.
*   `[ ]` **Task 3.1: Promo Code "Copy" Shortcut**
    *   **Description**: Add an interactive "Copy" button next to active promo code offers in Step 3 ("Review Booking Page") so riders can copy the discount code to their clipboard with a single click.

### 🔒 Epic 4: Production Architecture Upgrade (MVP)
Major structural redesign for backend security and database isolation.
*   `[ ]` **Task 4.1: Transition to Client-Server Architecture**
    *   **Description**: Move core business logic (fare calculation, overbooking validation, promo threshold checking) from the customer browser JS to a secure backend API (e.g. FastAPI in Python).
    *   **Implications**: Lock Firestore security rules to prevent direct writes from browsers, route updates through server-side verification using the Firebase Admin SDK, and hide third-party API credentials on the server.
*   `[x]` **Task 4.2: Remove Diagnostic Browser Alert Pop-ups**
    *   **Description**: Remove `window.addEventListener("error")` from `adminUI.js` and other diagnostic alert modals.
    *   **Implications**: Replaces user-facing browser `alert()` pop-ups with clean console logs or UI notifications to ensure standard consumer-grade UX.

### ✉️ Epic 5: Multichannel Notification System (MVP)
Communication workflows for rider updates, admin alerts, and auth tokens.
*   `[ ]` **Task 5.1: Transactional Email Notifications**
    *   **Description**: Deploy automated email dispatches for riders (booking receipts, allocation details) and admins (booking alerts, system reports).
*   `[ ]` **Task 5.2: WhatsApp & Mobile SMS Notifications**
    *   **Description**: Integrate mobile messaging alerts to notify riders of active driver assignments, status shifts (e.g., driver arrived), and dispatch coordinates.
*   `[ ]` **Task 5.3: Authentication OTP Gateway**
    *   **Description**: Set up direct OTP SMS delivery to customer mobile devices during auth registration/login.
