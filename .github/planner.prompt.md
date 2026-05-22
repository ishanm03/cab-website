# Prompt: Create a Modular Landing Page for 'SethCabs'

You are an expert Frontend Engineer and UI/UX Designer. Your task is to generate a pristine, highly responsive landing page for a premium local cab rental business named **SethCabs**, operating out of Kolkata and Howrah.

## 🛠️ Architecture Rules (Crucial for VS Code Setup)
To maximize the effectiveness of GitHub Copilot, cleanly separate the logic into three files:
1. `index.html` - Contains ONLY semantic HTML5 content structures.
2. `styles.css` - Custom utility overrides and design assets.
3. `app.js` - Empty for now, but linked for future interactive features.

---

## 1. Visual Theme & Aesthetic Guidelines
* **Color Palette:**
    * *Primary/Accent:* Deep Yellow / Amber (`#F59E0B` / `#FBBF24`) - A premium, modern homage to Kolkata's iconic taxi heritage.
    * *Backgrounds:* Deep Midnight Slate (`#1E293B`) for a sleek, executive appearance, contrasting with off-white (`#F8FAFC`) for maximum table readability.
* **Background Visuals:** Use Tailwind gradient classes (`bg-gradient-to-br from-slate-900 to-slate-800`) combined with subtle geometric lines instead of heavy background images, keeping the site ultra-lightweight for mobile data networks.

---

## 2. Page Structure & Components (Modular Layout)

Every section must be encapsulated within distinct, well-commented semantic HTML blocks (`<section id="...">`).

### Component 1: Hero Section (`#hero`)
* **Left Column (Content):** * Main Headline: *"Reliable Outstation & Local Cabs from Kolkata & Howrah"*
    * Sub-headline: *"Transparent pricing. Verified drivers. Seamless WhatsApp booking within 2 minutes."*
    * **Primary CTA Button:** A high-visibility WhatsApp Booking Button featuring a WhatsApp green icon, bold white text (*"Book Your Ride via WhatsApp"*), and a subtle CSS pulse effect. Use `href="#"` as a placeholder.
* **Right Column:** A beautifully styled CSS/SVG graphic or icon container representing an executive car silhouette or a localized map matrix overlay.

### Component 2: Route & Pricing Table Section (`#pricing`)
* **Background:** Clean, light background (`#F8FAFC`).
* **Header:** *"Popular Routes & Transparent Rates"* with a subtitle *"No hidden charges. Tolls and taxes discussed upfront."*
* **The Matrix (Responsive Layout):**
    * *Desktop:* A beautifully spaced table with light borders and smooth hover rows.
    * *Mobile:* Table rows must collapse responsively into clean, independent cards.
    * **Data Rows:**
        1. Howrah Station / Kolkata City to Airport (CCU) | Sedan: ₹999 fixed | SUV: ₹1,499 fixed | *Includes airport toll*
        2. Kolkata / Howrah to Digha (One-Way) | Sedan: ₹4,500 | SUV: ₹6,500 | *Ideal for beach getaways*
        3. Kolkata / Howrah to Mandarmani (Round-Trip) | Sedan: ₹8,500 (2 Days) | SUV: ₹11,500 (2 Days) | *Driver allowance included*
        4. Kolkata to Mayapur (Day Trip) | Sedan: ₹3,800 | SUV: ₹5,200 | *12 Hours / 250 km limit*
* **Footer Caption:** *“Note: Outstation prices exclude state entry taxes and highway tolls where applicable.”*

### Component 3: Contact Details & Trust Section (`#contact`)
* **Background:** Deep Slate (`#0F172A`).
* **Layout:** Two distinct grid columns.
    * *Left column:* Phone numbers, business email, and primary operating text (*"Serving Kolkata, Howrah, and Hooghly districts 24/7"*).
    * *Right column:* Trust badges (e.g., "✓ UPI Payments Accepted", "✓ Sanitized Cars", "✓ Professional Drivers").

---

## 3. Technical Requirements
* Import Tailwind CSS via official CDN in the HTML header.
* Keep data bound cleanly within predictable classes so sections can be easily duplicated or edited as new requirements arise.