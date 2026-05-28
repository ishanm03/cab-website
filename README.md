# 🚖 IshanCabs Website

A lightweight, modern, and modular web application built for **SethCabs / IshanCabs** operating across Kolkata and Howrah. The project is designed as a modular Multi-Page Application (MPA) fully optimized for static file hosting on **GitHub Pages**, with complete out-of-the-box compatibility to be wrapped into an **Android APK** for Google Play Store deployment.

---

## 📂 Project Structure

```text
cab-website/
├── index.html                 # Main Landing Page
├── styles.css                 # Global Custom Styles & Design System Tokens
├── app.js                     # Global Application Initializer & Landing UI Coordinator
├── README.md                  # Complete Setup, Configuration, & Deployment Manual
│
├── assets/                    # Shared static assets (images, SVGs)
│   ├── images/
│   └── icons/
│
└── modules/                   # Isolated feature modules
    ├── auth/                  # Customer Authentication (Google & Phone OTP)
    │   ├── auth.html          # Unified Login & Registration Markup
    │   ├── auth.css           # Auth-specific UI styling
    │   ├── authUI.js          # Auth Interface Logic
    │   └── authService.js     # Firebase Authentication Adapter (Web & Native APK bridge)
    │
    ├── booking/               # Future Booking Module (Scalable plug-and-play)
    │   ├── booking.html
    │   ├── booking.css
    │   ├── bookingUI.js
    │   └── bookingService.js
    │
    └── shared/                # Shared utility layers
        ├── firebase.js        # Core Firebase SDK Initialization
        ├── dbService.js       # Centralized Firestore Operations & Audit Logger
        └── utils.js           # Generic utility helpers
```

---

## ⚙️ 1. Manual Firebase Setup (Free Tier)

To enable user registration and Firestore profiles, you need to create and link a **Firebase Spark Plan** project.

### Step 1.1: Create Project & Web App
1. Go to the [Firebase Console](https://console.firebase.google.com/) and log in using a Google account.
2. Click **Add project**, name it `IshanCabs`, and proceed (you can disable Google Analytics for speed, or enable it for free).
3. Once the project dashboard loads, click the **Web icon (`</>`)** to register a new web application.
4. Name the app `IshanCabs-Web` and click **Register app**.
5. Copy the generated `firebaseConfig` object containing your keys:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "your-project-id.firebaseapp.com",
     projectId: "your-project-id",
     storageBucket: "your-project-id.appspot.com",
     messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   ```
6. Paste these configurations directly into [modules/shared/firebase.js](file:///Users/ishanmukherjee/AI_Learning/Cab-Website-Build/cab-website/modules/shared/firebase.js) (once created).

### Step 1.2: Enable Authentication Providers
1. In the left Firebase menu, navigate to **Build** > **Authentication** and click **Get Started**.
2. Go to the **Sign-in method** tab.
3. **Google Sign-In**:
   - Select **Google**, click **Enable**.
   - Select your project support email and click **Save**.
4. **Phone Authentication**:
   - Select **Phone**, click **Enable**, and click **Save**.
   - *Note*: Under the free plan, you have 10,000 free SMS verifications per month.

### Step 1.3: Provision Cloud Firestore Database
1. Go to **Build** > **Firestore Database** in the left menu.
2. Click **Create database**.
3. Choose a location nearest to your customers (e.g., `asia-south1` for Mumbai/Kolkata/Howrah to ensure low latency).
4. Start in **Test mode** for local development, and click **Create**.
5. *Security Setup*: Once ready for production, go to the **Rules** tab in Firestore and replace the rules with standard secure structures to restrict database entry modifications:
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
       }
     }
   }
   ```

---

## 💻 2. Local Development

Because we use Native ES Modules (`type="module"`), files cannot be opened directly via double-clicking in a browser (due to CORS security constraints on the `file://` protocol). 

Run the application using a local server:
- **VS Code**: Install the **Live Server** extension, right-click `index.html`, and choose `Open with Live Server`.
- **Python**: Run `python3 -m http.server 8000` in the directory terminal, then open `http://localhost:8000`.
- **Node.js**: Run `npx serve` in the project root.

---

## 🚀 3. Deploying to GitHub Pages (PoC)

GitHub Pages provides secure, free hosting for static code directly from your repository.

1. Initialize a Git repository and push your project to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initialize modular cab website structure"
   git remote add origin https://github.com/YOUR_USERNAME/cab-website.git
   git branch -M main
   git push -u origin main
   ```
2. Navigate to your repository page on GitHub.
3. Go to **Settings** > **Pages** (under Code and automation in the sidebar).
4. Under **Build and deployment**, set **Source** to `Deploy from a branch`.
5. Select the `main` branch and the `/ (root)` folder, then click **Save**.
6. After a few minutes, your site will be live at `https://YOUR_USERNAME.github.io/cab-website/`.

---

## 🌐 4. Custom Domain Migration (MVP Transition)

Once you reach the MVP stage and purchase a custom domain (e.g., `www.ishancabs.com`), follow these steps to route it to your GitHub Pages site.

### Step 4.1: Create a CNAME File in Your Repository
GitHub Pages requires a physical CNAME file in the root directory of your repository pointing to your domain.
1. Create a file named `CNAME` (capitalized, with no file extension) in the root of the project.
2. Add a single line containing your domain:
   ```text
   www.ishancabs.com
   ```
3. Commit and push this change to your main branch on GitHub.

### Step 4.2: Configure DNS Settings with Your Domain Registrar
Log in to your domain provider (e.g., Namecheap, Hostinger, GoDaddy, or Cloudflare) and navigate to the **DNS Zone Editor**. Add the following records:

1. **A Records (Apex Domain Mapping):**
   Point your root domain (`ishancabs.com` or `@`) to GitHub Pages' standard IP addresses. Add four A records:
   - Type: `A`, Host: `@` (or leave blank), Value: `185.199.108.153`
   - Type: `A`, Host: `@` (or leave blank), Value: `185.199.109.153`
   - Type: `A`, Host: `@` (or leave blank), Value: `185.199.110.153`
   - Type: `A`, Host: `@` (or leave blank), Value: `185.199.111.153`

2. **CNAME Record (Subdomain Mapping):**
   Point your subdomain (`www`) to your GitHub Pages host.
   - Type: `CNAME`, Host: `www`, Value: `YOUR_USERNAME.github.io.` (make sure to include the trailing dot if your registrar requests it).

### Step 4.3: Secure the Site with HTTPS
1. Go back to your GitHub Repository **Settings** > **Pages**.
2. Under **Custom domain**, enter `www.ishancabs.com` and click **Save**.
3. Check **Enforce HTTPS** (it may take up to an hour for the Let's Encrypt SSL certificate to provision, after which HTTPS will activate).

---

## 📱 5. Wrapping into an Android APK (Capacitor Setup)

To compile your static files into an installable APK for the Google Play Store, use the **Capacitor CLI**:

### Step 5.1: Initialize Capacitor
Install Capacitor dependencies and initialize configuration:
```bash
# Initialize Capacitor configuration
npx cap init IshanCabs com.ishancabs.app --web-dir=.
```
*Note*: By default, Capacitor expects built files in a `dist` or `www` directory. Since this is a vanilla project with no build step, setting `--web-dir=.` directs it to use your root folder files.

### Step 5.2: Create the Android Platform
Install the Android package and run the platform generator:
```bash
# Install Android platform library
npm install @capacitor/android

# Add the Android project directory
npx cap add android
```
This generates a complete `android/` directory in your workspace that contains a pre-configured Android Studio Gradle project.

### Step 5.3: Build & Synchronize Files
Whenever you edit your HTML, CSS, or JS code, synchronize it with the native Android layer:
```bash
npx cap sync
```

### Step 5.4: Generate the Production APK in Android Studio
1. Open Android Studio.
2. Select **Open an Existing Project** and choose the `android/` directory in your workspace.
3. Let Gradle compile and load the project (first launch may take a few minutes).
4. To test on an emulator or plugged phone, select **Run** > **Run 'app'**.
5. To build the final deployable file:
   - Go to **Build** > **Build Bundle(s) / APK(s)** > **Build APK(s)**.
   - The compiled release APK will be located inside: `android/app/build/outputs/apk/debug/app-debug.apk`.
   - For Google Play Store submission, click **Build** > **Generate Signed Bundle/APK** to sign the application securely.
