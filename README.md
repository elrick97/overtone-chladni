# OVERTONE: Chladni Survivor

**Live HTTPS URL:** https://elrick97.github.io/overtone-chladni/

An offline-first, one-thumb acoustic-cymatics action roguelike built for portrait mobile play. Pilot **The Cantor**—a magnetically levitated brass-and-quartz Tuning Stylus—across mathematical **Chladni standing-wave plates**, shatter waves of entropic white-noise mites and anechoic bosses, evolve instruments into screen-filling **Grand Harmonics**, and push into **Endless Ultrasonic Overdrive**.

---

## How to install on my phone before the flight (iPhone — iOS Safari)

> **Important:** Open the link in **Safari** (on iOS, only Safari shows *Add to Home Screen* with full standalone PWA support; Chrome/in-app browsers may hide or limit it).

1. **Open in Safari:** Unlock your iPhone on Wi-Fi or cellular and open **https://elrick97.github.io/overtone-chladni/** in **Safari**.
2. **Tap Share:** Tap the **Share** icon (square with an upward arrow `↑`) in Safari's bottom toolbar.
3. **Add to Home Screen:** Scroll down the share sheet and tap **Add to Home Screen**.
4. **Confirm Install:** Verify the name **`OVERTONE`** and custom Chladni mandala icon, then tap **Add** in the top-right corner.
5. **Launch Once Online (Critical on iOS!):** Go to your iPhone Home Screen, tap the new **`OVERTONE`** app icon **once while still connected to the internet**, and wait 2 seconds until the green **`OFFLINE READY`** badge illuminates at the top of the Title Screen. *(iOS isolates Home Screen web app caches from regular Safari tabs—opening the installed icon once online ensures its standalone Service Worker precaches 100% of assets.)*

---

## How to verify it works in airplane mode before leaving home

Do this 30-second check at home so you have 100% peace of mind at the gate:

1. **Force-close OVERTONE:** Swipe up from the bottom of your iPhone to open the App Switcher and swipe **OVERTONE** completely off-screen so nothing is held in RAM.
2. **Cut all radios:** Open **Control Center** (or **Settings**), turn **Airplane Mode ON**, and make sure the **Wi-Fi** icon is completely **OFF** (grayed/crossed out—iOS sometimes leaves Wi-Fi active when toggling Airplane Mode).
3. **Cold-launch from Home Screen:** Tap the **`OVERTONE`** icon on your Home Screen.
4. **Verify gameplay & sound:** Confirm the animated Chladni Title Screen opens immediately with **`OFFLINE READY`**, tap **`STRIKE THE PLATE`**, drag your thumb to glide, release to trigger **`ANCHOR LOCKED`**, and shatter a few Static Mites. *(Tip: flip your iPhone physical Silent switch off or wear AirPods on the plane to hear the procedural D-minor harmonic WebAudio synth!)*
5. Turn Airplane Mode back off—your meta-progress (`Hz Brass` and Tuning Bench upgrades) is saved locally under `overtone_chladni_v1_save` and won't collide with any other installed game.

---

## Controls

### Mobile (Portrait One-Thumb)
- **Move (Floating Virtual Joystick):** Touch anywhere on the arena and drag your thumb in any direction to glide.
- **Anchor Stance (Focus Bonus):** Lift your thumb (or hold still for `0.22s`) to plant your Stylus onto the Chladni plate (`⚓ ANCHOR LOCKED`), deploying a golden Nodal Mandala for `+28%` Base Fire Rate plus Grounded Focus / Anchor Relic synergies.
- **Auto-Fire:** All slotted Instruments fire and target automatically.
- **Overdrive Burst:** Tap the glowing bottom-right **`OVERDRIVE`** radial button once it reaches `100%` (`BURST!`) to clear nearby enemy orbs and unleash a massive radial shockwave.
- **Pause:** Tap **`❚❚`** in the top-right corner (the game also auto-pauses and suspends audio automatically if you lock your phone or switch apps).

### Desktop Browser Fallback (Laptop Offline Play)
- **Move:** `WASD` or `Arrow Keys` (release movement keys for `0.22s` to engage Anchor Stance)
- **Overdrive Burst:** `Space` (or click the Overdrive button)
- **Quick-Pick Level-Up Card:** `1`, `2`, `3` (or click card)
- **Pause / Resume:** `Esc` or `P`

---

## Local Development & One-Command Redeploy

Requires **Node.js 20+** and **Git** (zero runtime npm dependencies; dev tooling uses only `vite` and `typescript`).

```bash
# Install dev dependencies
npm install

# Start local dev server
npm run dev

# Run strict TypeScript check + production build + Service Worker precache hash generator
npm run build

# Preview production PWA locally at http://127.0.0.1:4173/
npm run preview

# One-command build + deploy to GitHub Pages (gh-pages branch)
npm run deploy
```

### First-time GitHub Setup (if deploying to a brand-new repo)
```bash
gh repo create overtone-chladni --public --source=. --remote=origin
npm run deploy
gh api -X POST repos/<YOUR_GITHUB_USER>/overtone-chladni/pages -f "source[branch]=gh-pages" -f "source[path]=/"
```
