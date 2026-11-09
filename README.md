# Ballistic Flight — Interactive 3D Aerospace Exhibit

An interactive 3D educational simulation built with **Three.js**, **React Three Fiber**, **Drei**, **TypeScript**, **Tailwind CSS**, and **Framer Motion**. It visualizes the five flight phases of a fictional three-stage solid-fuel ballistic vehicle inspired by the general flight stages of India's Agni-V.

> **Educational Notice:** All trajectories, altitudes, speeds, Mach numbers, and timings in this simulation are **illustrative motion curves** designed for physics education—not actual Agni-V performance data, targeting solutions, launch angles, or guidance parameters.

## Quick Start

```bash
npm install
npm run dev
```

Open `http://127.0.0.1:5173/` in your browser.

## Features

- **5 Interactive Flight Phases:**
  1. **Launch:** Mobile canister pad complex, booster ignition, billowing pad smoke, and vertical liftoff.
  2. **Powered Ascent:** Three-stage solid rocket climb with animated Stage 1, 2, and 3 separations, payload fairing jettison, and altitude-expanding Mach-diamond exhaust plume shader.
  3. **Midcourse Flight:** Sub-orbital Keplerian elliptical coast peaking at an illustrative 780 km apogee above the Indian Ocean.
  4. **Atmospheric Re-entry:** Hypersonic bow-shock compression heating with an incandescent plasma sheath and glowing carbon-phenolic nose tip.
  5. **Impact Visualization:** Dense-air aerodynamic deceleration and non-destructive optical telemetry pulse at a fictional, uninhabited southern-ocean instrumentation zone.
- **Detailed 3D Earth:**
  - 4K NASA Blue Marble day surface texture, Black Marble night-side city lights, specular ocean sun glints, animated cloud layer with surface cloud shadows, Rayleigh/Fresnel atmospheric limb scattering, and deep-space starfield.
- **Interactive Mission Controls:**
  - Play / Pause (`Space`), Restart (`R`), Playback speeds (`0.25×`, `0.5×`, `1×`, `2×`, `4×`), continuous deterministic timeline scrubber, Camera modes (`Follow Rocket`, `Earth View`, `Free Camera`), Trajectory & 3D Flight Labels toggles, and a `Reduced (2K)` quality mode for slower devices.
