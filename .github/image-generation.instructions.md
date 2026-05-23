# Image Generation & Asset Management Instructions

## 📁 Folder Structure Setup

Before generating images, create the following folder structure:

```
cab-website/
├── images/
│   ├── icons/
│   │   ├── routes/
│   │   │   ├── airport.png
│   │   │   ├── beach.png
│   │   │   ├── temple.png
│   │   │   └── daytrip.png
│   │   └── badges/
│   │       ├── verified.png
│   │       ├── transparent-pricing.png
│   │       └── 24-7.png
│   ├── fleet/
│   │   ├── sedan.jpg
│   │   └── suv.jpg
│   ├── drivers/
│   │   ├── driver-1.jpg
│   │   ├── driver-2.jpg
│   │   └── driver-3.jpg
│   ├── avatars/
│   │   ├── customer-1.jpg
│   │   ├── customer-2.jpg
│   │   └── customer-3.jpg
│   └── image-cab-1.png [existing]
```

### Create Folders via Terminal

```bash
cd cab-website
mkdir -p images/icons/routes
mkdir -p images/icons/badges
mkdir -p images/fleet
mkdir -p images/drivers
mkdir -p images/avatars
```

---

## 🎨 Image Generation Prompts

### ROUTE ICONS (4 Images)
**Specifications:** 200x200px, PNG, transparent background, flat design

---

#### Route Icon 1: Airport ✈️
```
Create a modern, flat design icon for an airport/travel route.
- Show an airplane or airport terminal symbol
- Colors: Sky blue (#3B82F6) with white accents and amber highlights
- Size: 200x200px with padding
- Style: Rounded shapes, flat design, friendly, minimalist
- Background: Transparent
- Format: PNG

Save as: images/icons/routes/airport.png
```

---

#### Route Icon 2: Beach 🏖️
```
Create a playful flat design icon for beach route/vacation.
- Show umbrella, waves, or beach scene
- Colors: Amber (#F59E0B) and coral (#FF6B9D) with white accents
- Size: 200x200px with padding
- Style: Rounded corners, flat design, bright, summery, fun
- Background: Transparent
- Format: PNG

Save as: images/icons/routes/beach.png
```

---

#### Route Icon 3: Temple 🏛️
```
Create a respectful flat design icon for temple/pilgrimage route.
- Show temple structure or spiritual symbol
- Colors: Emerald green (#10B981) and gold/amber with white
- Size: 200x200px with padding
- Style: Rounded design, flat, spiritual but modern, elegant, respectful
- Background: Transparent
- Format: PNG

Save as: images/icons/routes/temple.png
```

---

#### Route Icon 4: Day Trip 🚗
```
Create a dynamic flat design icon for day trip/adventure.
- Show car, map, compass, or journey symbol
- Colors: Coral (#FF6B9D), navy (#1E293B), and amber (#F59E0B)
- Size: 200x200px with padding
- Style: Rounded design, flat, dynamic, adventurous, energetic
- Background: Transparent
- Format: PNG

Save as: images/icons/routes/daytrip.png
```

---

### TRUST BADGE ICONS (3 Images)
**Specifications:** 200x200px, PNG, transparent background, flat design

---

#### Trust Badge 1: Verified Drivers ✓
```
Create a modern flat design badge for "Verified Drivers".
- Show checkmark, verification badge, or human with badge
- Colors: Emerald green (#10B981) with white accents
- Size: 200x200px with padding
- Style: Flat design, rounded, badge-like, trustworthy, professional
- Background: Transparent
- Format: PNG

Save as: images/icons/badges/verified.png
```

---

#### Trust Badge 2: Transparent Pricing 💰
```
Create a flat design icon for "Transparent Pricing/No Hidden Charges".
- Show price tag, calculator, crystal, or open book symbol
- Colors: Warm amber (#F59E0B) with white and gold accents
- Size: 200x200px with padding
- Style: Flat design, rounded, minimalist, communicates honesty/clarity
- Background: Transparent
- Format: PNG

Save as: images/icons/badges/transparent-pricing.png
```

---

#### Trust Badge 3: 24/7 Support ⏰
```
Create a flat design icon for "24/7 Support/Always Available".
- Show clock, circle with "24/7", phone, or continuous symbol
- Colors: Coral (#FF6B9D) with white accents
- Size: 200x200px with padding
- Style: Flat design, rounded, circular elements for continuity, always-on feeling
- Background: Transparent
- Format: PNG

Save as: images/icons/badges/24-7.png
```

---

## 📸 OPTIONAL: Additional Images

### Fleet Vehicles (Optional)
```
Sedan Vehicle Photo:
- Professional side-view of modern sedan
- Premium feel, bright daylight
- 800x600px minimum
- JPG format
Save as: images/fleet/sedan.jpg

SUV Vehicle Photo:
- Professional side-view of modern SUV
- Spacious, premium feel, bright daylight
- 800x600px minimum
- JPG format
Save as: images/fleet/suv.jpg
```

### Driver Photos (Optional - 3 diverse drivers)
```
Driver 1:
- Male, 35-45 years, warm smile
- Professional attire (light colored shirt)
- 600x600px, JPG
Save as: images/drivers/driver-1.jpg

Driver 2:
- Different ethnicity, 30-40 years, friendly smile
- Professional dress
- 600x600px, JPG
Save as: images/drivers/driver-2.jpg

Driver 3:
- Different appearance, 40-50 years, confident expression
- Professional attire
- 600x600px, JPG
Save as: images/drivers/driver-3.jpg
```

### Customer Avatars (Optional - for testimonials)
```
Customer 1: Woman, 25-35, smiling, 150x150px, JPG
Save as: images/avatars/customer-1.jpg

Customer 2: Man, 30-40, friendly, 150x150px, JPG
Save as: images/avatars/customer-2.jpg

Customer 3: Woman, 35-45, satisfied, 150x150px, JPG
Save as: images/avatars/customer-3.jpg
```

---

## 🛠️ Step-by-Step Implementation

### Step 1: Create Folder Structure
```bash
# Run in terminal from cab-website directory
mkdir -p images/icons/routes images/icons/badges images/fleet images/drivers images/avatars
```

### Step 2: Generate Route Icons (4 Images)
1. Open DALL-E, Midjourney, Stable Diffusion, or similar
2. Use the prompts from "ROUTE ICONS" section above
3. Download as PNG with transparent background
4. Save to `images/icons/routes/` with exact filenames

### Step 3: Generate Trust Badge Icons (3 Images)
1. Use same AI tool
2. Use prompts from "TRUST BADGE ICONS" section
3. Download as PNG with transparent background
4. Save to `images/icons/badges/` with exact filenames

### Step 4: Optimize Images for Web
- **Icons:** Should be <50KB each (typically <10KB)
- **Photos:** Should be <200KB each
- Use TinyPNG, ImageOptim, or similar tool

### Step 5: Verify All Images are in Correct Folders
```bash
# Verify structure
ls -R images/icons/
ls -R images/fleet/
```

---

## ✅ Quality Checklist

### For Icons
- [ ] 200x200px base size
- [ ] Very rounded, friendly appearance
- [ ] PNG format with transparency
- [ ] <50KB file size
- [ ] Correct folder: `images/icons/routes/` or `images/icons/badges/`
- [ ] Exact filename matches (airport.png, beach.png, temple.png, daytrip.png, verified.png, transparent-pricing.png, 24-7.png)

---

## 🚀 Next Steps After Image Generation

1. ✅ Generate all 7 required images (4 routes + 3 badges)
2. ✅ Move optimized images to correct folders
3. ✅ Ready for HTML/CSS implementation based on `ui-ux.prompt.md`
