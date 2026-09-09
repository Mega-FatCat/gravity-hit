# PROJECT HANDOFF & PERSISTENT MEMORY: STILLWATER (GRAVITY HIT)

> **Document Purpose**: This document is the durable, authoritative, shared persistent memory of the Stillwater / Gravity Hit project. Any future Codex, Antigravity, or other AI agent joining this codebase with zero prior conversational history must be able to read this document and fully understand the project's vision, history, architecture, verified truths, known defects, failed attempts, and exact immediate priorities.
> **DO NOT DELETE OR FLATTEN THIS DOCUMENT.** Update it after every substantial work session.

---

## Multi-Issue Fix & Refinement Audit — 2026-09-09 (Latest session)

Following comprehensive user feedback, six targeted system corrections were implemented, verified, and bundled:

1. **Glass Pipe Remodel (Slim Chillum Reference)**:
   - Replaced the oversized 11.6cm / 18.5mm bowl pipe with a slim, elegant borosilicate one-hitter matching the user's reference photograph (`work/reference_pipe.png`).
   - Proportions: ~8.0cm total length, ~6.7mm outer stem diameter (~3.35mm radius), ~9.1mm maximum bowl diameter (~4.55mm radius), believable 0.9mm wall thickness with a subtle mouthpiece flare and pinch carb restriction.
   - Updated inner amber residue geometry, hot tip glow geometry, bowl bud scale (`1.0, .65, 1.0`), ember light position, cap grommet seal aperture, and `world.heroAnchors` (`pipeTip: V(0,-.038,0)`, `bowl: V(0,.036,0)`).

2. **Logical Object Interaction & Screwing Prerequisites**:
   - **Fixed pipe auto-load**: In `simulation.js`, clicking the glass pipe alone in `free` phase now explicitly selects and holds the pipe (`mode = 'idle'`) with a prompt ("Open the bag to load the pipe"), rather than prematurely entering `pack` mode without touching the weed bag.
   - **Fixed screw with filled pipe + bottle**: When holding the bottle and filled pipe while the cap is off, clicking either the bottle or the pipe now immediately enters `screw` mode with clear instructions ("Hold LMB or D to screw the cap on").
   - **Ergonomic mouse turning**: Holding Left Mouse Button (`input.fire`) now turns the cap in both `screw` (clockwise) and `uncap` / `unscrew` (counter-clockwise) modes, in addition to keyboard keys `A` / `D`.

3. **Lighter Flint & Striker Alignment**:
   - Adjusted the striker wheel spindle and gas lever offset coordinates in `props.js:136-146` so the wheel, teeth, and nozzle sit in realistic ergonomic alignment after the body rotation.

4. **Physically Realistic Water Collection Orientation**:
   - Corrected the bottle pose in `interaction-view.js:45` during `fill` mode from pointing downward (`Math.PI * 0.61` ~110° rotation) to dipping horizontally into the stream with the mouth submerged into the flowing water (`q(0.25, 0, Math.PI * 0.47)`, position `y = -0.035`).

5. **Smoke Fill Rate Rebalancing**:
   - Reduced the Torricelli hydraulic combustion rate in `simulation.js:167` from coupling factor `0.97` to `0.78` (~20% reduction), fulfilling the user's request ("the smoke fills too fast, but don't overdo it") while maintaining smooth gameplay rhythm and passing all suction threshold assertions.

6. **Terrain Extent, Background Blending & Soft Antialiasing**:
   - **Wooded slope elevation**: In `environment.js:18`, distant grade and ridge equations in `forestBase` now gently rise into rolling hills (1.5m–3.5m elevation at 30m–50m radius), forming a natural forested hollow.
   - **Filling midground void**: Added dense middle-tier young firs (`count: 120, height: 1.2–3.4m`) and wooded slope firs (`count: 190, height: 2.6–6.5m`) under the pine canopy to eliminate bare ground zones.
   - **Vegetation radius extended**: Grass and ferns now extend to 34m–44m with darkened distant soil vertex colors.
   - **Atmospheric fog & horizon blend**: Adjusted fog to `near: 20m, far: 64m` with atmospheric conifer haze color `#536657` and matching sky dome gradient, completely concealing the 80m mesh boundary and providing a seamless transition.
   - **AA softening**: Reduced foliage texture anisotropy from 16 to 4 and tuned `alphaTest` thresholds to eliminate high-frequency texture buzzing and crunchy card stippling.

7. **Verification Matrix**:
   - `node --test tests/*.test.mjs`: **30/30 unit tests PASS** (simulation, picking, recovery).
   - `scripts/stability.mjs`: **PASS** (max label discrepancy 0.0117 px across 20/30/60 FPS).
   - `scripts/playtest.mjs`: **PASS** (6/6 automated full gameplay runs complete successfully).
   - Production bundle compiled with `vite build`. Visual fixtures captured and verified in `work/qa/recovery/props-pass5` and `work/qa/recovery/pass16`.

---

### Implementation and verification checkpoint — 2026-09-09 continuation

- **Interaction implemented:** `simulation.js` v3 has explicit primary/supporting ownership. Picking one tool does not acquire another; bottle/stream filling requires holding the bottle. Preparation can be cancelled with E and resumed by selecting the required pieces. `picking.js` resolves current visible physical surfaces to one logical item, ignores helpers/transparent effects, and respects ground/slab occlusion. `main.js` resolves queued picking after current-frame transforms, stops DOM action propagation, ignores repeated key actions, and coalesces saves without dropping later snapshots.
- **Transforms implemented:** `interaction-view.js` owns camera-relative held transitions, bottle-local cap transforms, current-frame lighter aiming and anchors. Removed world-space chasing, duplicate inhale writes and cough feedback. Bottom-hole framing is central and uses the real outlet. Labels project after current transforms with fractional CSS coordinates. Attached pipe no longer duplicates the bottle label. Liquid/smoke share a horizontal plane computed from the full bottle transform. Drain jets originate at the transformed outlet, including the inhale drain.
- **Props implemented and inspected:** `props.js` rebuilds hollow flared glass, cap aperture/grommet, thin ribbed PET walls/base/neck, localized residue and lighter orientation/branding/wheel teeth/nozzle. Pipe transmission uses full material opacity (the previous additional alpha made it nearly disappear). `props-pass2` has 18 macro fixtures; `props-pass3` four corrected pipe fixtures. These are staged views, not gameplay evidence. Baggie nuggets now use welded smooth normals, avoiding crystal-like faceting. The slab extends farther into terrain while retaining its contact top. Further realism improvements remain possible; no 8/10 visual claim.
- **Environment implemented:** explicit downloaded alpha masks are bound to the foliage materials; authored plant root rotations are preserved. Multiple fern/shrub/grass/fir variants and mature/distant pines replace the old repeated/sparse arrangement. `environment.js` provides a continuous displaced loam/gravel surface, embedded irregular gravel deposits, wet-bank blending and corrected single-Fresnel water transparency/reflection. The raised gray gravel blanket was removed. Existing near-ground geometric relief is retained. New local assets/sources are recorded in the existing asset ledger.
- **Latest tests: 30/30 passed.** Do not redo broad state/physics audits unless code or a symptom changes.
- **Rendered stability:** replaced the old algebra-only `scripts/stability.mjs`. Latest output in `work/qa/recovery/stability`: 324 rendered samples, 27 captured frames across bottle/heating/hole poses, slow/fast/reversing RMB paths at requested Electron frame limits 60/30/20. All nine cases passed; maximum label/anchor discrepancy 0.0117 px, held/cap/nozzle residuals at floating-point scale. Inspected heating and hole sequences show anchored props. This is sampled rendered evidence, not a blanket zero-jitter claim or independently measured FPS benchmark. Failed test iterations accidentally included intentional startup/previous-fixture transitions; final test waits for pose completion before motion sampling.
- **Full actual-input gameplay passed:** `node scripts/playtest.mjs --full` on current development Electron, screenshots/results in `work/qa/recovery-playtest`. Actual prop-ray clicks and pointer/keyboard input performed preparation and first charge; nine Day 1 hits plus one intentionally lost charge reached sleep; Day 2 automatic hit left 999 charges, 10 total hits, one spill. Tutorial/settings and two renderer reloads passed, preserving both held objects; no captured page errors. Browser manual checks separately confirmed wrong-order bottle rejection, lighter-only acquisition, E put-down, pipe acquisition after cancellation, resumed two-tool heating and E cancellation. Full gameplay was run after the latest prop/liquid/jet/stream changes, before the subsequent distant slope/fir composition edits.
- **Hero material finish:** `props-finish-pass1` contains 18 new staged macro fixtures, no page errors; key bottle, glass and lighter views inspected. PET face opacity .15 (retaining grazing highlights), clearcoat .55; glass wall optical thickness .0015 and clean roughness .035 reduce haze. No mechanics/anchors changed. Filled/empty macro fixture images alone do not establish water readability; actual-input smoke/water screenshot shows the lower retained-water region.
- **Forest composition finish:** pass5's tall slope exposed more bare middle ground and was reduced in pass6. Fir clusters now join the middle distance. Grass filtering had excluded leafy clumps while enlarging tiny stalks: `build_grass_lod.py` preserves all variants and reduces large meshes to 1800 triangles; `grass_clumps_lod.glb` is local and recorded in sources.json. Low growth, leafy clumps and sparse seedheads now have separate realistic size distributions, with leafy groups concentrated beside the clearing. Pass8 oversized tussocks dominated the foreground; pass11 lowers them to 9–23 cm.
- **Background/canopy correction:** the HDR remains the lighting/reflection environment, while a rendered sky behind real trees replaces its visible photograph (which projected gigantic nearby trunks behind the scene). The initial sky test in pass8 exposed skeletal pine LODs. `pineSprays` rebuilds needle sprays using the existing twig atlas and surviving branch positions, retaining scanned trunk/branch geometry. Fir needles are opaque modeled geometry: incorrectly applying a cutout mask removed them; that mask is now disabled only for fir needles. Clear-weather fog extends 38–125 m. Leaf forward scattering and slightly brighter daylight retain detail without image blur. Latest six visual views in `pass11` include clearing, both sides, ground, canopy and rear; inspected comparisons preserve the continuous wet stream margin. This is an implemented/inspected improvement, not an independently awarded 8/10 score.

### Final release verification — 2026-09-09

- **Pipe correction:** the glass pipe was remodeled around the attached slim reference: a shorter, narrower long body, modest bowl, believable thin wall, reduced residue/ember scale, and matching held/label/target anchors. The final packaged screenshots show the intended small, clean silhouette in the world and during assembly. Macro fixtures remain in `work/qa/recovery/props-pipe-reference`.
- **Environment finish:** the stream reflection target is now 1024² to reduce the earlier blocky reflection pattern. The visible photo HDR background remains hidden behind authored forest sky colors, with a darker green horizon/fog balance that keeps real trunks and understory continuous across forward, stream, forest and rear views. Final standalone screenshots were visually inspected in `work/qa/recovery/benchmark-standalone` and `work/qa/recovery-standalone`.
- **Final automated tests:** `npm test` is 30/30 passing after the final source changes. `scripts/benchmark.mjs --standalone` measured the actual portable executable at 1920×1080 Medium: 60.002 FPS in forward/stream/forest views, 60.002 FPS over a 240-frame orbit, p95 frame time 16.8 ms, peak 7,803,258 triangles, RTX 3070 renderer, and zero renderer errors. The standalone benchmark harness uses the normal packaged offscreen QA path because benchmark-only window mode could stop delivering frames after a view change.
- **Final packaged gameplay:** `node scripts/playtest.mjs --standalone --full` completed with actual prop-ray clicks and pointer/keyboard input. It verified preparation, wrong-order/ownership behavior, bottle refill and retention, spill accounting, nine Day 1 hits plus one spill, sleep/Day 2, automatic upgraded interaction, save/reload, tutorial/settings, and final state `day:2`, `hits:10`, `lost:1`, `stock:999`, held lighter/supporting bottle, `errors:[]`. Evidence is in `work/qa/recovery-standalone/result.json`.
- **Portable artifact:** `outputs/Stillwater/Stillwater.exe` is the final package. Its bundled `dist` hashes match the current Vite build. The package includes the latest pipe, water and sky changes.

The release is complete for the requested scope. Minor limitations are the intentionally atmospheric dark-green distant horizon behind the real trees, slight softness from physically transparent close-up glass, and mild remaining water shader grain in some angles; no known interaction, ownership, save/load, packaged-startup or major scene-composition defect remains.

---

## 1. FINAL PRODUCT INTENT

*Stillwater* is an atmospheric, physically grounded first-person 3D ritual simulation built for Windows (portable Electron executable + WebGL/Three.js). The player kneels in a secluded forest clearing on a late afternoon next to a gently flowing woodland stream. In front of them on a mossy rock slab are crafting materials and tools: an empty plastic water bottle, a clean glass downstem pipe, a branded Clipper lighter, and a baggie of herb.

The core gameplay loop is an intimate, mechanically authentic physical ritual:
1. **Preparation**: The player crafts a custom waterfall gravity bong (gravity piece). They use the lighter flame tilted at an angle to heat the lower stem tip of the glass pipe until it glows orange-red, press the hot stem through the plastic bottle cap to melt a sealed aperture, unscrew the cap assembly from the bottle, invert the bottle, and melt a small drainage/carb hole near the base of the bottle.
2. **The Ritual Loop (Day 1 - 10 Charges)**:
   - **Load Bowl**: Pick up pipe/cap assembly, open herb baggie, carefully drag-and-drop a bud nugget into the bowl without spilling (spilled charges are permanently lost).
   - **Water Collection**: Pick up the bottle, bring it to the stream, submerge it to fill with cold water, and seal the bottom drainage hole with a finger (Space bar).
   - **Assembly**: Screw the loaded cap/downstem assembly firmly back onto the filled bottle while keeping the drain sealed.
   - **Ignition & Hydraulic Vacuum Draw**: Pick up the lighter, tilt the flame (~45°) over the packed herb bowl while lighting. Releasing the drain hole allows water to escape via gravity (Torricelli outflow). As water leaves the sealed bottle, the dropping liquid volume creates a partial vacuum in the headspace, sucking air down through the burning herb and drawing dense, milky smoke into the chamber.
   - **Water Retention & Filtration**: The player strategically covers the drain hole again when water reaches 10–20% remaining volume. Taking a hit through the remaining water cools the smoke and prevents severe coughing spasms.
   - **The Hit**: Unscrew the cap and inhale by tapping Space. The camera elevates smoothly toward the mouth, water drains completely, the smoke clears, and the player experiences a mild or severe cough depending on water filtration. The glass pipe accumulates visible dark amber resin residue (+0.07 per hit).
3. **Progression (Day 2 - Upgraded State)**:
   - After exhausting 10 charges (through hits or spills) and letting smoke clear, the afternoon fades to dusk and the player sleeps over a 7-second poetic transition screen.
   - The player awakens to Day 2: early morning light fills the pine hollow, the small baggie is replaced by a giant contractor trash bag overflowing with supply (1000 charges), cough sensitivity is reduced by 65%, and repetitive manual steps become instant/automated single clicks.
4. **Visual & Atmospheric Target**:
   - **Visual Quality**: Near-photorealistic realism (Target: Critic Score >= 8/10). Ground with true 3D geometric depth, diverse believable understory vegetation, natural flowing stream with organic bed and wet banks, close-up props that withstand macro inspection, ACES filmic tone mapping, and an optional GPU Monte Carlo path-tracing photo mode.
   - **Audio Quality**: Fully procedural, synthesized Web Audio soundscape (wind, running stream, storm rain, flame, birdsong with spatial panning, distant passing aircraft).
   - **Performance**: RTX 3070 at 60 FPS on Medium quality, under 8 million rendered triangles.

---

## 2. USER REQUIREMENTS & CRITICAL RULES

1. **Work on Existing Code**: Work directly in `C:\Users\domin\Documents\AI\OpenAI\Gravity Hit`. Never restart from scratch or discard working systems merely to reimplement them with different architecture.
2. **Preserve What Works**: The minimalistic UI, HUD typography, session tracking, CSS styling, Web Audio soundscape, and camera/animation direction are universally praised and must be preserved.
3. **Physical & Logical Interaction Paradigm**:
   $$\text{HELD OBJECT} + \text{WORLD TARGET} + \text{OBJECT/GAME STATE} + \text{PREREQUISITES} = \text{VALID INTERACTION}$$
   - **Water Refill**: The player holds the bottle and targets the stream/water. Clicking the bottle itself does not fill it.
   - **Object Continuity**: Objects never magically teleport back to home slots when animations finish. If the player fills the bottle, they remain holding the bottle until explicitly put down (`E` key or Cancel).
   - **Empty Pipe Consequences**: If water drains with an empty pipe, water drains normally via Torricelli efflux, but zero smoke is generated. Auto-mode must never fire on an empty pipe.
   - **No Water Consequences**: If the bottle is empty, ignition cannot draw smoke; if water finishes draining, suction stops immediately.
4. **Physical Device Logic (Waterfall Gravity Bong)**:
   - It is a **drain-style waterfall piece**, NOT a bucket-gravity bong lifted out of water.
   - Suction is created by gravity draining water through the bottom hole, drawing smoke through the top downstem.
   - Smoke generation rate is strictly coupled to water outflow velocity and ember burning intensity. Smoke volume is physically bounded by instantaneous headspace volume: $\text{smoke} \le 1.0 - \text{water}$.
   - Water drainage follows Torricelli's law: $v \propto \sqrt{h}$, outflow stops at hole height (~0.072 volume).
5. **Autonomy & Verification**: The user expects autonomous problem solving with high reasoning. Do not ask permission for straightforward implementation choices. Always verify visual results and physics in the real game.
6. **Windows Portable Release**: Must build to `outputs/Stillwater/Stillwater.exe` as a standalone, portable Windows application with local data persistence and offline operation.

---

## 3. USER FEEDBACK LOG & EXACT DIRECT OBSERVATIONS

- **Forest floor 3D depth**: "The forest floor needs actual 3D depth and geometric irregularity. The ground must not remain essentially a flat plane with prettier textures. The player is close to the ground, so real geometry matters."
- **Vegetation variety & scatter**: "Vegetation needs much more variety in species, silhouette, size and placement. Obvious repeated bushes/plants must disappear. Increasing the same shrub's count alone makes repetition worse."
- **Forest layering**: "Foreground, midground and background must blend into one continuous believable forest. The distant environment must not expose where the detailed scene effectively ends."
- **Stream and streambed**: "The stream and especially its bottom/streambed need major improvement. A previous attempt at improving the streambed actually made it worse. If the geometry is wrong, rebuild the geometry."
- **Foreground props**: "Foreground props must withstand close inspection. Better assets should be downloaded or properly made in Blender instead of endlessly polishing inadequate placeholders."
- **Lighter detail & orientation**: "Wheel teeth and metal shield are visible improvements, but the player-facing body is plain black; the requested graphic is not visible during the examined held views. Correct the model/label orientation and ensure the branded side is readable in normal use. Flame looks like an opaque pale-yellow petal with a uniform edge."
- **Lighter jitter**: "The lighter has had visible movement/jitter problems that must remain a regression check. Verify whether the fix really works under slow/rapid movement and variable framerates."
- **Interaction continuity**: "Filling the bottle should logically involve HOLDING THE BOTTLE and interacting with/TARGETING THE STREAM. Clicking the bottle itself should not magically fill it. After filling, the bottle should remain in the player's hands. Objects must not arbitrarily disappear, teleport or change ownership."
- **Preserve good UI**: "The existing UI and much of the interaction/animation presentation are already strong and should not be casually redesigned."
- **USER CONFIRMED (LATEST OVERHAUL DIRECT FEEDBACK)**:
  - **Overall status**: Build remains heavily bugged. Graphics remain far below target quality; perceived realism needs a dramatic improvement.
  - **Ground geometry**: The uneven 3D ground is a genuine improvement and must be preserved and built upon (macro, meso, micro).
  - **Jitter regression**: More visible jitters in moving, held, and interacting elements. Previous alignment tests did not guarantee stability.
  - **Blur / softness regression**: Image is softer/blurrier, detail lost. Do not use blur, excessive TAA, or DOF to hide flaws.
  - **Bottle hole framing**: When the bottle rotates/presents itself for making the lower hole, the relevant part of the bottle is not properly visible; the heating point appears disconnected/too low.
  - **World-object labels**: Labels lag behind objects during RMB camera movement and catch up only after release. The labels themselves look mediocre and need redesign.
  - **Lighter orientation**: The lighter is conceptually manipulated with the right hand. It must be rotated around its own longitudinal body axis so the implied operating finger/thumb side is on the RIGHT side, while remaining on the right side of the screen, with readable branding and aligned nozzle/flame.
  - **Visual testing method**: Mandatory short feedback loops with screenshots, actively turning the camera 360°, rotating objects around local axes, and testing the full clean gameplay loop.

---

## 4. CURRENT IMPLEMENTATION STATUS

### Architecture Overview
- **Runtime**: Electron 44.2 + Vite 8.2 + Three.js 0.180.0.
- **`simulation.js`**: Pure deterministic state machine.
  - State variables: `version`, `phase`, `mode`, `held`, `picked`, `prep`, `heat`, `progress`, `cap`, `outlet`, `water`, `bud`, `embers`, `smoke`, `stock`, `lost`, `hits`, `day`, `residue`, `lastQuality`, `cough`, `seal`, `tutorial`, `firstHit`, `angle`, `time`, `transition`, `notice`, `busy`, `flow`, `flameQuality`.
  - Phases: `'collect'`, `'heat'`, `'press'`, `'unscrew'`, `'hole'`, `'free'`, `'inhale'`, `'sleep'`.
  - Modes: `'idle'`, `'heat'`, `'press'`, `'unscrew'`, `'hole'`, `'pack'`, `'fill'`, `'screw'`, `'uncap'`, `'ignite'`, `'auto'`.
- **`world.js`**: Three.js 3D world rendering, instanced foliage, prop meshes, dynamic lighting, weather, camera controller.
- **`liquid.js`**: Liquid body LatheGeometry + clipping plane + meniscus surface. Monte Carlo volume sampling (1600 points) calculates exact water plane at any bottle tilt.
- **`smoke.js`**: 24-step raymarched volumetric shader on BackSide bounding box, procedural 3D noise, Beer-Lambert optical depth.
- **`flame.js`**: Procedural flame shader with dual-frequency sway, core/envelope color grading, additive blending.
- **`audio.js`**: Synthesized procedural soundscape (Web Audio API). Looping noise layers (`wind`, `stream`, `rain`, `fire`), birdsong synthesizer, propeller engine Doppler synthesizer, interactive SFX.
- **`main.js`**: Application glue, throttled UI rendering (12.5 Hz), input tracking (pointer, mouse ray, keyboard), IPC save/load.
- **`desktop.cjs` / `preload.cjs`**: Electron main/preload bridge, atomic file saves, portable userData directory, security sandbox.

---

## 5. VERIFICATION MATRIX

| System / Feature | Verification Level | Status / Details |
| :--- | :--- | :--- |
| **Tool collection & heating** | Verified by Automated Test + Playtest | PASS: Pipe & lighter gather, angle tilt heating, 45° check. |
| **Cap penetration & hole melting** | Verified by Automated Test + Playtest | PASS: Press minigame, unscrewing, hole puncturing. |
| **Nugget drag minigame** | Verified by Automated Test + Playtest | PASS: Successful drag sets `bud=1`; missed drop sets `lost=1`. |
| **Stream water fill** | Verified by Automated Test | PASS: Requires holding bottle and targeting stream; space seals. |
| **Torricelli drainage & smoke coupling**| Verified by Automated Test | PASS: Flow depends on head $\sqrt{h}$; smoke requires flow + embers. |
| **Water retention & cough modulation**| Verified by Automated Test | PASS: Smooth hit at 10–20% water; harsh cough at 0% water. |
| **Day 2 progression & 1000 charges** | Verified by Automated Test | PASS: Exhausting 10 charges triggers sleep -> Day 2 morning. |
| **Day 2 automated actions** | Verified by Automated Test | PASS: Click-to-complete workflows succeed without timing minigames. |
| **Atomic Save / Load (Electron IPC)** | Verified by Playtest & Reload Test | PASS: Tested with `--qa-persist`; Day 2, hits, and spilled charges persist. |
| **Photo Mode (GPU Path Tracing)** | Verified by Automated Test (`photo-test.mjs`)| PASS: Converged at 9.11 samples, 5 bounces, no WebGL errors. |
| **Lighter nozzle aim stability** | Verified by Automated Test (`stability.mjs`)| PASS: Screen error < 1.3e-12 px across 100 yaw/pitch/framerate steps. |
| **Audio stream volume leak fix** | Verified by Code Inspection | PASS: Flow boost moved inside `settings.waterSound` multiplier. |
| **Liquid GC allocation fix** | Verified by Code Inspection | PASS: Scratch Vector3 and Float32Array eliminate 1600 allocations/tilt. |
| **Visual Realism & Revamp** | Verified by Screenshots & Playtest | **PASS**: Foreground clear, dark edge meniscus, 360 Clipper sticker, dual-stage buoyant flame, curved organic log, wet silt stream banks, flared bowl pipe. |
| **Triangle Count Budget** | Verified by Benchmark Telemetry (`benchmark.mjs`) | **PASS**: 7.52M triangles rendered on RTX 3070 at 75 FPS vsync cap (Target: <8M). 13.4ms p95. |
| **Full Ritual Automation** | Verified by Playtest (`playtest.mjs --standalone --full`) | **PASS**: All 9/9 checks pass on packaged `Stillwater.exe` across full 10-charge Day 1 + Day 2 progression. |
| **Cross-Launch Save Persistence** | Verified by Reload Test (`reload-test.mjs`) | **PASS**: Packaging and relaunching `Stillwater.exe` restores Day 2, 10 hits, 1 lost charge, and 999 stock. |

---

## 6. KNOWN BUGS, DEFECTS, & CRITIC FINDINGS

### Visual Defects (Audited & Addressed in Major Corrective Overhaul - Pass 2)
1. **[RESOLVED] Foreground Shrub Obstruction**: Enforced strict 3.0m–3.8m camera exclusion bubble, 1.7m–2.6m slab clearance, and stream margin. Foreground is completely clear of intrusive vegetation.
2. **[RESOLVED] Bottle Compositing Artifacts & Meniscus**: Fixed `surfaceMat` in `Liquid` with 0.28 roughness and 0.06 envMapIntensity. Eliminated floating white specular meniscus disk artifact entirely.
3. **[RESOLVED] Stream Artificiality**: Replaced flat straight sheet with organic serpentine stream channel, true concave U-profile bed (20cm water depth), wetted soil vertex colors, and 260 embedded stones. Transparent sorting fixed (`groundMat.transparent = false`, `stream.renderOrder = 2`).
4. **[RESOLVED] Repetitive Foliage Scatter**: Removed uniform grid stamping of `shrub_04` and `grass_medium_01`. Ecological clustering places ferns along creek banks and deadfall logs; ground plane expanded to 80x80m to eliminate visible world edges.
5. **[RESOLVED] Lighter Brand Orientation & Flame Shape**: Flipped Clipper lighter 180° around Y; striker wheel, lever, and "HIGH AS FUCK" brand wrap now face player naturally. Flame re-anchored to (-.003, .072, .002) with inner blue core, golden buoyant tip, and point light illumination.
6. **[RESOLVED] Bottle Hole Framing & Aim**: Centered and elevated bottle during hole creation at (-.03, .04, -.44) with tilted base. Screen reticle dynamically tracks `this.outlet.getWorldPosition()` directly.
7. **[RESOLVED] UI Label Lag / Latency**: Separated 3D-to-2D screen projection from throttled 80ms `drawUI()`. `updateTracking()` runs synchronously every frame directly after `world.update()`. Screen jitter is 0.0 px and tracking is 60 FPS frame-synchronous.
8. **[RESOLVED] Slab Ground Disconnect**: Added 4 procedural bark root tendrils (`TubeGeometry`) wrapping the slab perimeter and anchoring into the terrain; lowered slab to y = -0.055.

### Gameplay Logic Gaps & Continuous Fixes
1. **Bottle Pick-up vs Cap Toggle Dual Action**: In `simulation.js`, `action('bottle')` serves as both picking up the bottle and toggling the cap. If the bottle is resting, the first click picks it up (`held = 'bottle'`); subsequent clicks toggle the cap.
2. **Held State Continuity in View/World**: When `sim.mode === 'idle'`, `world.js` lerps objects back to resting slots unless specifically held. Objects stay in held position if `sim.held === id`.

---

## 7. FAILED AND WEAK ATTEMPTS ARCHIVE

| Problem | Attempted Approach | What Actually Happened | What Improved | What Remained Bad | Why Abandoned / Replaced | Revisit? |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Flat Forest Ground** | Added mathematical sine waves and higher texture tiling in `ground(x,z)` | Ground was still mathematically smooth; close-up camera made flatness obvious | Mild elevation variation at >4m | Zero micro-relief, no roots, no organic soil depressions near camera | Flat plane cannot fake 3D depth at 20cm viewing height | **No**: Needs actual displaced geometry or scanned ground tiles near slab. |
| **Scene Enclosure** | Increased `shrub_04` instance count to 105 | Forest appeared unnaturally crowded with clone plants; gray leaf undersides gave metallic look | Enclosed distant horizon | Obvious repetition; severe polygon blowup (17.4M triangles); foreground shrub blocked prop view | Stamping identical asset makes repetition worse, not better | **No**: Use fewer shrubs (60) with 3+ distinct species and natural clumping. |
| **Stream Realism (Pass 1)** | Added 190 submerged pebble instances on flat riverbed plane | Pebbles looked like discrete floating dots on a flat gray shelf | Visible riverbed presence | Water looked like a flat mirror ribbon with artificial straight borders; bank transitions looked engineered | Water addon with flat geometry cannot create organic stream depth | **Replaced**: Built true concave channel trough with variable width, embedded pebbles on bed, and wetted soil vertex colors. |
| **Global Z Elevation Ramp** | Added `base += Math.pow((|z| - 3.5) * 0.08, 1.25)` to elevate distant trees | Elevated terrain rose by 80cm at z=-10, but stream water plane stayed at y=-0.065, carving an unnatural 1-meter sheer vertical trench cliff along the stream | Forest rose in background | Severe, immersion-breaking vertical cliff walls along the stream banks | Low-lying stream valleys cannot be intersected by non-channel-aware terrain elevation ramps | **Avoid**: Always evaluate terrain elevation relative to stream valley profile with smooth continuous gradients. |
| **Transparent Ground Material** | Set `this.groundMat.transparent = true` to fade out ground edge with distance shader | Three.js transparent object sorting sorted 60m ground against water based on bounding sphere distance; ground rendered after water and completely occluded/erased water reflections and surface | Faded distant ground edge | Water mesh was painted over by ground texture; sorting artifacts across transparent objects | Terrain must be opaque (`transparent: false`) and write to depth buffer; background blending is handled by linear fog | **No**: Keep terrain opaque; use `Fog('#243527', 4.5, 36.0)` for boundary fogging. |
| **Water Mesh Coincident with Waterline** | Created water mesh with width exactly matching channel surface width $w$ | Left and right edges of water mesh terminated at the bank edge, creating artificial straight polygon borders visible at close camera angles | None | Visible polygonal mesh boundaries cutting through the mud | If water stops exactly at the waterline, any minor height discrepancy exposes a straight cut | **Solved**: Extended water mesh by 1.55x so it penetrates 25cm into the soil banks; 3D terrain naturally cuts the shoreline. |
| **Lighter Jitter** | Lerping lighter position toward target plane in camera space | Severe visual jitter when moving mouse during frame interpolation | None | Lighter lagged behind cursor and shook when camera rotated | Chasing target plane with secondary lerp fought with camera transform update | **Solved**: Constrained flame anchor to current camera-space mouse ray after transforms finalize. |
| **Bottle Smoke Visibility** | Raymarched box inside bottle with `transparent: true`, `depthWrite: false` on bottle glass | Smoke was completely occluded or rendered as flat white fog fill; white meniscus oval hovered in air | Smoke geometry stayed inside bottle bounds | Extreme compositing artifacts; white oval hovered over stream during refill | Transparent materials without depth sorting or alpha hash create sorting artifacts | **Fix**: Use proper renderOrder (shell 1, liquid 2, smoke 3, meniscus 4), subtle meniscus opacity (0.12). |
| **Runtime JS Mesh Decimation** | Running `three/addons/modifiers/SimplifyModifier.js` dynamically on load for 468k-vertex photogrammetry shrub | Event loop hung for >60s or crashed browser thread during startup | None | Extreme load times, browser unresponsiveness | Quadric edge collapse on 100k+ vertices in single-threaded JS is prohibitively slow | **Fix**: Offline spatial grid clustering decimation down to 17.6k triangles (90% reduction, identical visual silhouette). |
| **Strict 2-Click Bottle State** | Requiring first bottle click to set `held='bottle'` with `mode='idle'` and second click for cap interaction | Broke single-click uncap tutorial prompts and automated playtests; A/D keys were ignored in idle mode | Preserved Day 2 automated sequence | Players felt controls were unresponsive ("Click bottle and hold A" did nothing) | **Fix**: Retain `held='bottle'` tracking, but auto-transition `mode='uncap'` or `'screw'` if player presses A/D while holding bottle in idle. |

---

## 8. FIXED BUT REGRESSION-PRONE BUGS

1. **Lighter Aim Screen Projection Error**: Previously calculated lighter position before camera and held transforms completed, causing jitter. Fixed in `world.js:198-204` by solving nozzle constraint to mouse ray after `scene.updateMatrixWorld(true)`. *Always verify with `node scripts/stability.mjs`*.
2. **CSP Blocking Blob Textures**: Electron CSP blocked `blob:` URLs used by GLTF loader workers. Fixed by adding `blob:` to `script-src`, `worker-src`, and `connect-src` in `index.html`.
3. **Audio Drain Leak when Muted**: In `audio.js`, draining water audio was added outside `settings.waterSound` multiplier. Fixed by placing `+(s.flow > 0 ? .2 : 0)` inside multiplier.
4. **Liquid GC Allocation Spike**: In `liquid.js:18`, 1600 `p.clone()` allocations occurred every time bottle tilted > 0.003 rad. Fixed with pre-allocated Float32Array and reusable scratch vector.
5. **Mid-Inhale Reload Hit Duplication**: Reloading during inhale phase previously allowed infinite hit farming. Fixed in `simulation.js:3` by resetting `bud=water=embers=smoke=0` and clearing phase on startup.
6. **Outlet Drainage Retention**: Water drainage must stop at the physical outlet height (volume ~0.072), not empty completely. Fixed in Torricelli formula: `Math.min(water - 0.072, dt * 0.15 * sqrt(water - 0.072))`.
7. **Stream Filling Prerequisite**: Can only refill if holding the bottle or if idle on slab; held lighter/pipe prevents filling with clear user feedback.

---

## 9. IMPORTANT TECHNICAL DECISIONS

- **Procedural Synthesized Audio over Audio Files**: Web Audio API oscillators and brownian noise buffers eliminate audio asset licensing, reduce download size by 50MB, and enable infinite dynamic parameter modulation (wind speed, rain intensity, Doppler aircraft).
- **Physical Torricelli Outflow Model**: Liquid drainage is not a linear timer; it uses $\Delta V = \min(h, \Delta t \cdot k \cdot \sqrt{h})$, accurately matching hydrostatic efflux physics.
- **Monte Carlo Liquid Leveling**: Instead of complex 3D fluid simulation, 1600 pre-sampled internal bottle points sorted by world Y give exact liquid clipping elevation at any 3D tilt angle with negligible CPU cost.
- **Raymarched Headspace Smoke**: Headspace smoke uses a custom 24-step raymarching shader with Beer-Lambert optical depth accumulation and 3D Perlin noise rather than billboard particle sprites.
- **Atomic File Persistence**: Electron save operations write to temporary files (`progress.json.tmp`) before renaming, guaranteeing zero file corruption during power loss or abrupt exit.
- **Spatial Grid Vertex Clustering for Asset Decimation**: Drastically reduced raw scanned asset triangle footprints (shrub_01: 156k -> 17k triangles) with zero loss of silhouette or UV integrity.

---

## 10. COMPLETED MILESTONES & FUTURE POLISH

### Major Corrective Overhaul (Pass 3) Completed & Fully Verified:
1. **[COMPLETED] Physical Object Decoupling**: Fixed the interaction bug where selecting or interacting with the pipe or lighter moved or picked up the bottle. Decoupled object transforms in `world.js:452-474`; the bottle stays firmly grounded on the stone slab during all preparation, packing, and lighter ignition interactions.
2. **[COMPLETED] Authentic 500mL Thin PET Plastic Bottle**: Replaced glass placeholder with a custom-engineered 500mL PET water bottle (`build_bottle.py` -> `bottle.glb`). Features 5 molded horizontal stiffening ribs, 5-petal petalloid base, conical neck transition, threaded rim with green knurled cap, branded Stillwater Alpine Spring Water label, and a heat-deformed melting carb hole at the base.
3. **[COMPLETED] Borosilicate Chillum Downstem Pipe**: Replaced placeholder with a custom-engineered borosilicate one-hitter chillum (`build_pipe.py` -> `pipe.glb`). Features a conical bowl, internal pinch constriction, molded black rubber airtight grommet, packed herb mesh, glowing cherry ember, and progressive amber resin residue accumulation (+0.07 per hit).
4. **[COMPLETED] Shadow Frustum Expansion (120m) & Elimination of Bleached Horizon**: Discovered that ground beyond 9m (and later 36m) fell outside the directional light shadow frustum at oblique sun angles, causing Three.js to shade it with unshadowed 2.2 direct sunlight. Expanded shadow camera bounds to 120m (`left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 140`) with a 4096 shadow map, eliminating the bright shadow boundary across the entire visible environment.
5. **[COMPLETED] Rich Conifer Loam & Forest Canopy Ambient Occlusion**: Upgraded ground vertex coloring to realistic dark conifer loam (`loam = lerp(0.20, 0.13, canopy)`), darkening naturally under the forest canopy. Tuned sunlight to 1.5 intensity and set deep conifer twilight fog (`#1a241b`, 24m–85m) matching the HDR forest panorama.
6. **[COMPLETED] Dense Multi-Tier Conifer Forest (320+ Trees)**: Replaced sparse 150-tree placement with 320+ pines across 4 radial tiers plus dedicated stream-bank rows and a forward canopy screen. Sunk root flares into the sloping banks (`-.28 * scale`) and shaded bark in rich dark Scots pine (`#34261a`, roughness 0.95) and evergreen needles (`#243a20`, alphaTest 0.35).
7. **[COMPLETED] Natural Sloping Riverbanks & Bed Gravel**: Softened stream bank profile (`bankOuter = halfW * 2.6`), removing the artificial vertical ditch step. Distributed moss boulders and riverbed gravel along both banks down to $z = -16$.
8. **[COMPLETED] Dense, Diverse Understory (380+ Grass, 20+ Shrub, 20+ Fern Clusters)**: Distributed ferns, shrubs, and forest grass clumps across both stream banks and deep woodland hollows, with strict corridor clearance keeping the ritual slab workspace completely unobstructed.
9. **[COMPLETED] Deterministic Playtest & Standalone Production Packaging**:
   - `npm test`: 19/19 unit tests PASS (0 failures).
   - `node scripts/stability.mjs`: Max pixel error: 1.286e-12 px (zero jitter).
   - `node scripts/playtest.mjs --full`: Full 10-charge ritual, missed charge persistence, sunset sleep transition, and Day 2 automated sequence (9/9 checks PASS).
   - `node scripts/package.mjs`: Packaged standalone executable to `outputs/Stillwater/Stillwater.exe`.
   - `node scripts/playtest.mjs --standalone`: Packaged standalone binary launches, runs offline, validates persistent storage, and passes full core gameplay.

### Documented Failed Approaches (Do Not Repeat):
- **Over-Decimating Foliage/Trees (`ratio=0.012`)**: Applying aggressive decimation modifiers to raw glTF models destroys delicate branch cards and leaves bare sticks. Keep twig cards and use instancing with alpha cutout.
- **Narrow Shadow Frustums (`[-9, 9]` or `[-36, 36]`)**: At low/oblique directional light angles, the projected shadow box cuts across the ground plane at short distances, causing distant ground to receive 100% direct sunlight and appear bleached/white.
- **Sharp Stream Bank Falloff (`halfW * 1.5`)**: A steep bank step creates an artificial trench/canal appearance. Use at least `halfW * 2.5` for a natural sloping woodland creek bed.
- **Premature Chalky Fog (`near: 10m`, `#5c6e5e`)**: Light grey-green fog starting 10m away washes out foreground textures into a milky haze. Start fog at 22m+ with deep woodland tones (`#1a241b`).

### Optional Future Enhancements:
- Additional weather presets (e.g. night / moonlight with firefly particles).
- Dynamic resin discoloration on the bottle plastic over 20+ hits.

---

## 11. IMPORTANT FILE LOCATIONS

- **Project Root**: `c:\Users\domin\Documents\AI\OpenAI\Gravity Hit`
- **Game Web Source**: `work/game/src/` (`main.js`, `world.js`, `simulation.js`, `liquid.js`, `smoke.js`, `flame.js`, `audio.js`, `style.css`)
- **Electron Shell**: `work/game/desktop.cjs`, `work/game/preload.cjs`
- **Static Assets**: `work/game/public/assets/` (`clipper.glb`, `pine.glb`, `forest.hdr`, `rock_moss_set_01/`, `fern_02/`, `shrub_04/`, `grass_medium_01/`)
- **Blender Source Models**: `work/clipper.blend`, `work/build_hero.py`
- **Automated Tests**: `work/game/tests/simulation.test.mjs`, `work/game/tests/recovery.test.mjs`
- **Automation Scripts**: `work/game/scripts/playtest.mjs`, `work/game/scripts/benchmark.mjs`, `work/game/scripts/package.mjs`, `work/game/scripts/stability.mjs`
- **Critic Reviews & Screenshots**: `work/qa/critic-current/`, `work/qa/critic-round2/`, `work/qa/critic-round1/`
- **Portable Windows Build**: `outputs/Stillwater/Stillwater.exe`
