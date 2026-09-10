# STILLWATER / Gravity Hit

The existing project was moved here from the original Codex workspace. The application code is in `work/game`; the playable Windows build is in `outputs/Stillwater`.

Run **outputs/Stillwater/Stillwater.exe**. Keep the complete folder together. The application includes its runtime and assets and requires no installer, Node.js, Blender, browser, or online connection to play. Progress and settings are stored beside the executable in `UserData`.

The game supports preparation, ten consumable charges, missed drops, water sealing and draining, cap threading, lighter positioning and tilt, burning and smoke accumulation, inhaling, the sleep transition, and the second day's automatic actions. Sound, weather, graphics, camera motion and tutorials can be adjusted in Settings.

## Development

From `work/game`, use `npm run dev` for local development, `npm run build` for the bundled application, `npm test` (or `node --test tests/*.test.mjs`) for the simulation checks, and `npm run package` for the portable Windows folder. The existing dependencies and assets are included in this workspace. `package-lock.json` pins the dependency versions. Blender source and its generation script are in `work/clipper.blend` and `work/build_hero.py`.

`work/qa` contains independent critiques, screenshots, executable tests, and performance results. Project documentation adheres to the standardized status semantics defined in `PROJECT_HANDOFF.md` and `AGENTS.md` (`USER VERIFIED CURRENT`, `AUTOMATED VERIFIED`, `CURRENT BUILD NEEDS MANUAL CHECK`, `PREVIOUS AGENT CLAIM`, `FIXED BUT REGRESSION-PRONE`, `SUPERSEDED`), strictly prioritizing user feedback over automated passes or historical agent claims.

## Rendering

Gameplay uses physically based real-time rendering, reflected stream lighting, scanned vegetation and rocks, normal-mapped surfaces, animated foliage, and a ray-marched smoke volume. The photo mode uses actual GPU path tracing through `three-gpu-pathtracer`. This is a separate, paused rendering mode; the gameplay renderer is not a DirectX hardware ray-tracing pipeline. It does not use NVIDIA RT cores through DXR.

The water model tracks volume, hydrostatic outlet head, a gravity-aligned free surface and a ballistic outlet jet. It is a simplified game fluid model, not a full Navier–Stokes simulation. Atmospheric sounds are synthesized locally. The in-game cough and progression rules are fictional mechanics.

The original live-action / 8-of-10 visual target has not been independently achieved. Earlier critiques and the fresh close-up critique are preserved honestly. Improvements made after those captures are not represented as having a new independent score.

## Asset sources

Poly Haven assets are CC0. See `work/game/public/assets/sources.json` for individual source pages and the in-game Credits panel. The Clipper proportions were checked against the manufacturer's Classic Large reference (74 mm): https://clipperofficial.ca/our-range/pocket-lighters. The graphic follows the user's supplied reference. The lighter and pipe are custom modeled; the lighter Blender source is included.

Graphics libraries: Three.js, three-mesh-bvh, three-gpu-pathtracer (MIT). Desktop runtime: Electron (MIT; its bundled Chromium and third-party license files are distributed with the application).
