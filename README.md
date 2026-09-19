# ZNICZ (Beta 1)

> *A quiet forest ritual. A photorealistic first-person waterfall gravity simulation.*

**ZNICZ** (formerly *Stillwater / Gravity Hit*) is a meditative, first-person ritual simulation set in a quiet, sunlit conifer forest beside a mountain stream. It meticulously recreates the authentic Polish "wodospad / tłok" (waterfall gravity bong) ritual with physical fidelity, tangible prop interactions, fluid outflow dynamics, and volumetric atmosphere.

---

## The Ritual

1. **Cap Preparation**: Heat the tip of the glass pipe (*lufka*) with the Clipper lighter and melt a snug hole through the center of the plastic bottle cap.
2. **Outlet Drainage Hole**: Melt a drainage hole near the base of the plastic bottle.
3. **Fill with Stream Water**: Hold the bottle and dip it into the mountain stream to fill it with cold water.
4. **Pack the Bowl**: Open the ziplock bag and pack fresh aromatic herbs into the glass pipe bowl.
5. **Thread the Cap**: Screw the prepared cap and packed pipe firmly onto the bottle neck.
6. **The Pull ("Wodospad / Tłok")**: Unseal the lower outlet hole and ignite the lighter over the bowl. As water empties according to Torricelli's law of outflow, the expanding vacuum draws thick, rich smoke down into the bottle headspace.
7. **The Hit**: Unscrew the cap (`A`), seal or unseal as needed, and inhale (`Spacebar`). Experience the natural game cough and residue buildup.
8. **Continuous Ritual**: No artificial day breaks or forced sleep timers. Replenish herb charges at any time using the in-game **Refill** button to continue your quiet ritual in the clearing.

---

## Key Features in Beta 1

- **Physical Liquid & Outflow Mechanics**: Torricelli-driven outflow with dynamic velocity tapering, Rayleigh-Plateau capillary instability waves, and a 12-droplet ballistic splash arc over stream rocks.
- **Refined Prop Interactions**:
  - Dedicated **A / D** controls to unscrew (`A`) and screw (`D`) the cap naturally.
  - Interactive hotbar item toggle (keys `1`–`5` or UI slots): click/press once to hold, press again to stow.
  - Cap and pipe auto-stow cleanly on the ritual rock slab when appropriate.
  - Authentic Clipper lighter ignition without awkward angle-locking.
  - Visible herb buds inside the ziplock bag dynamically reflect remaining charges (1–10).
- **Volumetric Smoke & Residue**: Raymarched volumetric bottle smoke that fills the expanding headspace as water drains, leaving gradual golden-brown resin deposits in the glass stem.
- **Photorealistic European Conifer Forest**: Scanned bark PBR textures, mossy boulders, wet streambed gravel, animated wind-responsive needles and foliage mipmaps.
- **Scalable Quality Engine**: Dynamic quality profiles (`High`, `Medium`, `Low`) adapting render resolution, shadow maps, foliage density, and post-processing edges to keep frame pacing smooth across integrated and discrete GPUs.
- **Path-Traced Photo Mode**: Press `P` at any moment to pause time and engage a progressive GPU path tracer (`three-gpu-pathtracer`) with multi-bounce global illumination.
- **Procedural Web Audio Soundscape**: Dynamically generated ambient forest sounds—filtering mountain wind, rushing stream water, algorithmic birdsong, and faint distant propeller planes—alongside physical lighter flick and glass clink foley.
- **Clean Save Invariants**: Fresh game state saved to local storage or local JSON without corrupting between sessions.

---

## Controls

| Key / Input | Action |
| --- | --- |
| **Right Mouse (hold & drag)** | Look around the forest clearing |
| **Left Mouse (click / hold)** | Interact, pick up items, ignite lighter, pack herb |
| **1 – 5 (or Hotbar click)** | **Toggle item**: `1` Glass Pipe, `2` Lighter, `3` Bottle, `4` Herb Bag, `5` Stream |
| **A / D** | **Cap Threading**: `A` unscrews cap, `D` screws cap onto bottle |
| **Hold Space** | Finger seal over bottle drainage outlet |
| **Tap Space** (cap off + smoke present) | Inhale the hit |
| **E** | Stow / set down currently held item |
| **T** | Toggle ritual tutorial guide |
| **Refill Button (HUD / Menu)** | Replenish herb bag with 10 fresh charges |
| **Ctrl + 2137** | **Ritual Cheat**: Instant preparation, water fill & packed bowl (`Shift` keeps water full) |
| **P** | Enter progressive GPU path-traced photo mode (`Esc` to exit) |
| **H** | Toggle minimalistic HUD visibility |
| **F11** | Toggle fullscreen mode |
| **Esc** | Pause menu and settings (Audio, Graphics, Weather, Guide) |

---

## How to Play

### 1. Online in Browser (GitHub Pages)
ZNICZ runs directly in any modern WebGL2-compatible desktop browser (Chrome, Edge, Firefox, Brave):
- **Live URL**: `https://<username>.github.io/<repository-name>/`
- The site deploys automatically via GitHub Actions from `work/game/dist`.

### 2. Standalone Portable Windows App
For an offline, native desktop experience without browser chrome:
- Run **`outputs/Stillwater/Znicz.exe`**.
- Fully self-contained portable build: no installer, Node.js, Python, or internet connection required.
- Settings and progress are kept in the adjacent `UserData` folder.

---

## Local Development & Testing

The game source code is located in `work/game`.

```bash
# Navigate to the game folder
cd work/game

# Install dependencies (pinned in package-lock.json)
npm install

# Start local Vite development server
npm run dev

# Run automated unit, regression, and causality tests (121 passing tests)
node --test tests/*.test.mjs

# Build production web bundle into work/game/dist
npm run build

# Package portable Windows executable into outputs/Stillwater
node scripts/package.mjs
```

---

## Architecture & Tech Stack

- **Client Runtime**: Native ES Modules, Three.js (0.180.0), Vite 8.
- **Physics & Outflow**: Custom Torricelli analytical hydrostatic solver (`liquid_core.mjs`).
- **Spatial Acceleration**: `three-mesh-bvh` for raycasting and geometry queries.
- **Offline Rendering**: `three-gpu-pathtracer` for photorealistic paused photo mode.
- **Audio**: Web Audio API with procedural noise synthesis, biquad filter sweeps, and algorithmic bird chirps.
- **Desktop Wrapper**: Electron 44 with isolated context, sandboxed renderer, and local IPC save persistence.
- **Continuous Deployment**: GitHub Actions workflow deploying to GitHub Pages.

---

## Asset Sources & Licensing

- **Poly Haven Assets**: CC0 (textures, scanned rocks, foliage). See `work/game/public/assets/sources.json` and in-game Credits.
- **Clipper Reference**: Proportions aligned with the manufacturer's Classic Large 74mm design.
- **Hero Props**: Procedural Three.js geometry and custom shaders in `work/game/src/props.js`.
- **Software Licenses**: Three.js, three-mesh-bvh, three-gpu-pathtracer (MIT). Electron runtime and Chromium components (MIT / BSD).

---

## Credits

**Dominik Zieliński** — Creative Director / Product Owner / QA Lead  
*Concept, prompting, testing, feedback, ritual fidelity, and overall project direction.*

- **GPT-6 Astra** — Lead Developer / Software Architect  
  *Core game systems, technical foundation, and key architecture.*
- **Claude 4.6 Opus** — Solutions Architect / Technical Consultant  
  *Critique, problem analysis, and architectural solutions.*
- **GPT-5.6 Sol** — Technical Advisor / Code Reviewer  
  *Technical consulting and code analysis.*
- **Gemini 3.8 Flash** — Primary Implementation Developer  
  *Main implementation work, hero props, visual shaders, gameplay updates, and fixes.*
- **GPT-5.6 Luna** — Software Developer / Git & Release Manager  
  *Implementation support, Git management, test maintenance, and change documentation.*
- **Muse Spark 1.3 Free** — Supporting Developer  
  *Additional implementation of smaller features and fixes.*
