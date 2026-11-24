# OVERTONE: Chladni Survivor — Game Design Document

## 1. Theme & Premise
Inside the **Great Harmonium**, reality is tuned across a vast obsidian-and-brass **Chladni Plate**—an acoustic resonance table where sound carves glowing geometric nodal lines in fine quartz sand. A creeping entropic static known as **The Dead Air** has begun detuning the plate, condensing white-noise mites, feedback drones, and anechoic monoliths out of dissonance. You pilot **The Cantor**, a magnetically levitated brass-and-quartz **Tuning Stylus**. By gliding across shifting standing-wave patterns, firing pure harmonic tones, collecting **Amber Resonance Shards**, and slotting sympathetic resonators into your stylus, you fight through ascending frequency bands (`110 Hz` to ultrasonic infinity) to keep the chord alive.

## 2. Core Loop & One-Thumb Controls
- **Core Loop:** Enter a Wave (tuned to a rising Frequency & Chladni Mode `(n, m)` that redraws the sand nodal geometry underneath) → weave through escalating swarms and dodge ranged dissonance orbs → collect **Amber Shards** (XP) and **Hz Brass** (meta-currency) → **Level Up** (dramatic slow-mo chord + 1-of-3 Harmonic Upgrade draft) → defeat **Detuned Elites** and **Bosses** (Waves 5 & 10, then every 5 waves) → enter **Endless Ultrasonic Overdrive** → spend **Hz Brass** at the **Tuning Bench** between runs.
- **Portrait One-Thumb Controls:**
  - **Floating Virtual Joystick:** Touch anywhere on screen and drag to glide smoothly in 360°. Auto-aimed harmonic instruments fire continuously while moving or anchored.
  - **Anchor Stance (Archero-inspired micro-tactic):** Lifting your thumb (or holding completely still for `0.22s`) plants the Stylus into the plate, deploying a golden **Nodal Ring** (`+28% Fire Rate` and stance-synergy triggers)—rewarding rhythmic stutter-stepping and brave positioning between dodges.
  - **Overdrive Burst Button:** Large thumb-reachable button (bottom-right; `Space` on desktop) unleashed at 100% Resonance Charge—triggers hit-stop, clears nearby enemy projectiles, and deals radial harmonic damage.
  - **Desktop Fallback:** `WASD` / Arrow keys to move (stop moving for Anchor Stance), `Space` for Overdrive Burst, `1/2/3` to quick-pick upgrades, `Esc`/`P` to pause.

## 3. Upgrade System, Evolutions & Broken Synergies (22 Upgrades)
Upgrades split into **5 Active Instruments** (rank 1–4), **9 Passive Modulators** (rank 1–4), **5 Legendary Grand Harmonic Evolutions**, and **3 Wildcard Relics**:
- **Instruments:** *Strike Ping* (starter rapid tone bolts), *Chladni Orbitals* (rotating brass saw-nodes), *Arc Tessitura* (chain-plucked sympathetic lightning), *Sub-Bass Mortar* (lobbed shockwave shells), *Standing Lance* (piercing harmonic laser).
- **Modulators:** *Split Octave* (+multishot), *Overdrive Tempo* (+attack speed), *Heavy Brass* (+damage & knockback), *Wide Aperture* (+AoE & magnet radius), *Sympathetic Echo* (+pierce & bounce), *Crit Transients* (+crit chance & crit damage), *Shatter Resonance* (enemies burst into shrapnel on death), *Grounded Focus* (supercharges Anchor Stance + shield), *Harmonic Siphon* (heal on level-up/elite kill + max HP).
- **5 Example Evolutions & Synergies:**
  1. **TESLA PHILHARMONIC** (*Strike Ping R3 + Split Octave*): Evolves primary bolts into a wide fan of homing, ricocheting golden arpeggio darts that gain `+15%` damage per bounce.
  2. **AEGIS MANDALA** (*Chladni Orbitals R3 + Wide Aperture*): Summons 6 counter-rotating supersonic saw-rings that vaporize enemy projectiles on contact and vacuum shards.
  3. **STORM CONDUCTOR** (*Arc Tessitura R3 + Crit Transients*): Chain lightning forks twice per jump, crits for `2.5x`, and drops screen-shaking Zenith Bolts every 5th strike.
  4. **TECTONIC DROP** (*Sub-Bass Mortar R3 + Heavy Brass*): Shells leave vibrating Cymatic Fault Zones that pull enemies inward before detonating a secondary mega-quake.
  5. **ANCHOR + GLASS OCTAVE + SHATTER COMBO** (*Wildcard Relics + Stance*): *Glass Octave* doubles ALL damage (`2.0x`) while capping max HP at `50%`; planting in *Grounded Focus* fires radial shockwaves while *Shatter Resonance* chain-detonates entire Splitter packs in cascading hit-stop fireworks.

## 4. Enemy Factions & Boss Roster (6 Enemy Types + Elites + 2 Multi-Phase Bosses)
1. **Static Mite** (Cyan jagged triangle) — Fast pack-swarmer condensing along nodal edges.
2. **Hum Drone** (Amber heavy hexagon) — High-HP, knockback-resistant low-frequency juggernaut.
3. **Phase Skitter** (Violet sharp diamond) — Telegraphs a rhythmic charge, then dashes rapidly at the player's vector.
4. **Siren Node** (Lime 4-point star) — Kites at mid-range and fires high-contrast magenta-lime **Dissonant Orbs**.
5. **Null Dampener** (Magenta-obsidian ring) — Projects a visible dampening field granting nearby enemies `35%` damage reduction until sniped.
6. **Splitter Chord** (Coral twin-octahedron) — Fractures into two fast **Micro-Ticks** on death (prime fuel for on-kill chain reactions).
- **Detuned Elites (Wave 3+):** Crowned champions (`4x HP`, `1.25x` scale) with *Hasted*, *Twin-caster*, or *Bulwark* affixes; drop guaranteed Hz Brass caches and healing Tuning Forks.
- **Boss 1 — THE WOLF TONE (Wave 5, 15, 25...):** Giant crimson-gold serrated dodecagon with rotating armor arcs; alternates radial orb rings (with dodge lanes), telegraphed sub-bass slam lunges, and mite choirs.
- **Boss 2 — ANECHOIC MONOLITH (Wave 10, 20, 30...):** Geometric void-violet obelisk mandala; fires telegraphed sweeping Standing-Wave Laser Beams, spiral phase barrages, and summons Dampener Pylons.

## 5. Endless Ultrasonic Scaling Formula (Waves 11 → ∞)
Waves 1–10 are authored (`25s–35s` waves, Boss waves last until boss defeat). From Wave $w \ge 11$, Endless Overdrive activates with rotating **Acoustic Modifiers** (*Doppler Surge*, *Dense Choir*, *Blood Octave*, *Sub-Harmonic Armor*):
- $\text{EnemyHP}(w) = \text{BaseHP} \times (1 + 0.18(w - 1)) \times 1.09^{\max(0, w - 10)}$
- $\text{EnemyDamage}(w) = \text{BaseDmg} \times (1 + 0.11(w - 1)) \times 1.04^{\max(0, w - 10)}$
- $\text{SpawnBudget}(w) = \lfloor 18 + 6.5w + 1.4 \max(0, w - 10)^{1.35} \rfloor$, with Elite chance $\min(0.30, 0.04 + 0.015(w - 3))$
- Bosses appear every 5 waves ($w = 15, 20, 25, \dots$) with $\text{BossHP}(w) = \text{BaseBossHP} \times 1.32^{(w/5) - 1}$ and faster attack cadence.

## 6. Meta-Progression & Local Persistence
Saved under namespaced key `overtone_chladni_v1_save` (schema-versioned, try/catch guarded against corruption):
- **Tuning Bench (5 Permanent Upgrades, 5 Ranks each):** *Tempered Alloy* (+Max HP), *Keen Striker* (+Base Damage), *Magnetic Core* (+Move Speed & Magnet), *Harmonic Memory* (+XP Gain & Reroll Charge), *Overclocked Coil* (+Fire Rate & Crit).
- **Records & Settings:** Best Wave, Peak Frequency (`Hz`), High Score, Total Kills, Evolutions Discovered, plus Sound, Music, and Haptics toggles.

## 7. Art, Audio & Technical Justification
- **Visual Direction:** Crisp dark-slate & brushed-brass cymatic aesthetic (`#090A10` ground, luminous `#F5C451` gold, `#38BDF8` cyan, `#F43F5E` crimson, `#C084FC` violet). Mathematical Chladni nodal patterns render to an offscreen canvas once per wave (`0ms/frame` ongoing cost). High-contrast geometric vector silhouettes, additive glow passes, directional hit-sparks, floating crit numbers, hit-stop (`30–65ms`), and damped spring screen shake ensure instant small-screen readability and electric game feel.
- **Procedural Audio:** Zero-asset WebAudio synthesizer tuned to a D-minor pentatonic harmonic scale (`D3–A6`). Shots, pickups, crits, and level-up fanfares harmonize musically with a subtle procedural ambient pulse loop; auto-unlocks on iOS touch and suspends cleanly on backgrounding.
- **Stack & Delivery Justification:** **Vite + TypeScript + HTML5 Canvas 2D + Custom Precache Service Worker** deployed on **GitHub Pages (HTTPS)**. Zero runtime dependencies mean `<100 KB` total download, deterministic TypeScript contracts across sub-agents, pre-allocated object pools + flat `Int32Array` spatial grid for locked `60 FPS` on mobile, and 100% offline iOS Safari Home Screen PWA reliability in Airplane Mode.
