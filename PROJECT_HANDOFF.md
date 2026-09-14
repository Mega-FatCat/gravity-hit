# PROJECT HANDOFF & PERSISTENT MEMORY: ZNICZ (FORMERLY STILLWATER / GRAVITY HIT)

> **Document Purpose**: This document is the durable, authoritative, shared persistent memory of the Znicz (formerly Stillwater / Gravity Hit) project. Any future Codex, Antigravity, or other AI agent joining this codebase with zero prior conversational history must be able to read this document and fully understand the project's vision, history, architecture, verified truths, known defects, failed attempts, and exact immediate priorities.
> **DO NOT DELETE OR FLATTEN THIS DOCUMENT.** Update it after every substantial work session.

---

## 0. STATUS VOCABULARY & SOURCE-OF-TRUTH SEMANTICS

To ensure that historical claims, previous agent summaries, or automated test passes are never mistaken for current player-visible truth, all statements, table rows, and task updates in this project MUST strictly adhere to the following six status categories and source-of-truth priority:

### Canonical Status Categories
- **`[USER VERIFIED CURRENT]`**: Directly verified, tested, and confirmed acceptable by the human user in recent manual playtesting or visual critique. This represents the **highest authority level**. No automated test pass or agent claim may override or dispute a user-verified finding without new direct user confirmation.
- **`[AUTOMATED VERIFIED]`**: Validated by automated unit, regression, or benchmark test suites (`node --test tests/*.test.mjs`, `scripts/stability.mjs`, `scripts/playtest.mjs`, `scripts/benchmark.mjs`). Validates code contracts, mathematical invariants, transform stability, or synthetic interactions, but **does NOT constitute proof of human player visual or interactive acceptance**.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]`**: Implemented, refactored, or staged in the current source code or assets. The work may have passed automated gates, but has not yet undergone live manual interactive playtesting by the user to confirm that it feels right, looks natural, and avoids unintended edge cases.
- **`[PREVIOUS AGENT CLAIM]`**: An assertion, summary, or "release complete" statement made in past agent logs, handoff checkpoints, or commit notes (e.g., claiming a bug was "RESOLVED" or graphics were "PASS"). **Must be treated with skepticism** until independently reproduced or confirmed by the user. Must never be cited as active proof.
- **`[FIXED BUT REGRESSION-PRONE]`**: A bug fix or calibration that has been verified in specific conditions, but is known to be structurally fragile under camera rotation, variable framerates, input timing, or adjacent refactorings (e.g., lighter screen-ray alignment, label tracking, held-object handoffs, Torricelli drainage cutoff). **Requires mandatory regression checking** before and after touching related systems.
- **`[SUPERSEDED]`**: Outdated test metrics (e.g., historical 19/19 or 30/30 unit tests), obsolete passes (Pass 2/Pass 3 claims), replaced assets, or deprecated agent claims that have been superseded by subsequent commits, newer test suites (49/49 tests), or the latest Post-Luna User Audit. **Preserved for historical context and debugging, but explicitly marked as inactive/obsolete.**

### Source-of-Truth Hierarchy
When resolving conflicting information, always follow this strict priority order:
1. **Latest explicit user feedback** (human eyes, manual playtesting observations)
2. **Durable product intent** (authentic waterfall gravity bong physics, near-photorealistic conifer forest, physical continuity)
3. **Current live behavior** observed during interactive execution of the current build
4. **Actual current source code and asset files** in `work/game/src/` and `work/game/public/assets/`
5. **Verified automated test suites** (`npm test` / `node --test tests/*.test.mjs`, `scripts/stability.mjs`)
6. **Project documentation and backlog specifications** (`PROJECT_HANDOFF.md`, `Gravity_Hit_Final_Post_Luna_Audit_Backlog.md`)
7. **Prior agent claims and conversational summaries**
8. **Unverified assumptions**

---

## Project Identity Transition: "Znicz" & Official Team Credits — 2026-09-11
**Status**: `[USER VERIFIED CURRENT: TEAM CREDITS ROSTER, TITLE & EXECUTABLE RENAME]`

### Project Identity & Boundary Directives
- **New Canonical Title**: **Znicz** (Polish proper noun, no diacritics).
- **Executable Artifact**: Renamed from `Stillwater.exe` to `Znicz.exe` (located in `outputs/Stillwater/Znicz.exe`).
- **Application Entry Brand**: Window title, HTML document `<title>`, and in-game topbar brand updated to **ZNICZ** (`A FOREST RITUAL`).
- **Explicit Strict Gameplay Invariant**: In-game bottle label (`STILLWATER Natural Spring Water`), in-game location lore, fluid mechanics, save data keys (`stillwater-save`), and interaction systems remain strictly preserved and untouched per user instruction.

### Official Project Credits
- **Dominik Zieliński** — Creative Director / Product Owner / QA Lead  
  *Concept, prompting, testing, feedback, and overall project direction.*
- **GPT-6 Astra** — Lead Developer / Software Architect  
  *Core game systems, technical foundation, and key architecture.*
- **Claude 4.6 Opus** — Solutions Architect / Technical Consultant  
  *Critique, problem analysis, and solution proposals.*
- **GPT-5.6 Sol** — Technical Advisor / Code Reviewer  
  *Technical consulting and code analysis.*
- **Gemini 3.8 Flash** — Primary Implementation Developer  
  *Main implementation work, including most later-stage features and fixes.*
- **GPT-5.6 Luna** — Software Developer / Git & Release Manager  
  *Implementation support, Git management, commits, and change descriptions.*
- **Muse Spark 1.3 Free** — Supporting Developer  
  *Additional implementation of smaller features and fixes.*

## Reference-Driven Visual Iteration Protocol — 2026-09-13
**Status**: `[USER VERIFIED CURRENT: AGENT WORKFLOW DIRECTIVE]`

The latest STREAM-BED-01 cycle established a durable workflow for tasks judged against an authoritative user reference image:

1. **Every participating agent must directly inspect the exact reference image.** Research, implementation, and critic agents must each open the user-supplied reference themselves before analysis, editing, or scoring. Another agent's written description is insufficient. If an agent cannot actually access the reference, it must report a blocker rather than infer visual details from prose.
2. **Preferred sequence: research -> implementation -> critic.** The research agent compares the current runtime result with the reference and proposes a bounded correction. The implementation agent independently re-inspects the reference and edits the real application. The critic independently re-inspects the reference plus fresh runtime QA captures and scores strict adherence.
3. **Numeric thresholds and iteration caps are hard gates.** For the current STREAM-BED-01 cycle, passing required **>= 9.0/10** strict photo adherence and the user allowed **up to five critic evaluations**. Conflicting fallback scores do not replace the designated primary/final score. The fifth and final score was **8.9/10**, so the streambed remains `[CURRENT BUILD NEEDS MANUAL CHECK]`; no sixth critic run is allowed unless the user explicitly authorizes another cycle.
4. **Visual application tasks must be judged from the real build.** When the request is to improve the game/environment, implement it in code and evaluate screenshots captured from the running application. Do not satisfy the task by generating a standalone approximation of the desired image.
5. **Preserve a real before state and deliver matched before/after evidence.** Before editing, preserve representative captures of the current build. At completion, create a comparison file containing several matched before/after viewpoints so the user can judge the exact change directly.
6. **Protect concurrent work in the shared workspace.** Inspect current files before editing, committing, or pushing. Commit only task-owned files unless the user explicitly asks to include other completed changes.

For STREAM-BED-01 specifically, the authoritative reference was the reposted `image(5).png`. The user's key correction was that the previous bed was too fine-biased: too many tiny pebbles and too few medium/larger stones. The accepted target direction is a clast-supported bed visually dominated by hand-sized medium/small-cobble stones, with tiny pebble/gravel classes mainly filling interstices and larger anchors remaining sparse. The exact final composition and critic trajectory are recorded in the STREAM-BED-01 section below.

## FOREST-TEXTURE-01 Vegetation Model & Texture Rebuild — 2026-09-14
**Status**: `[AUTOMATED VERIFIED: 92/92 TESTS PASS; VERIFIED RUNTIME CAPTURES; CURRENT BUILD NEEDS MANUAL CHECK]`

- **User directive / hard scope boundary**: decisively improve trees, bushes, foliage and forest-floor sticks/twigs toward the supplied realistic forest reference, especially the hard/over-sharp vegetation edges. ATM/ray-tracing/lighting shaders are being worked on separately and must not be modified here. Stones/streambed are also out of scope.
- **Rollback checkpoint**: before edits, the task-owned source state was copied to `work/checkpoints/pre-forest-fix/` and six verified runtime screenshots were captured to `work/game/qa/forest-texture-01/pre-forest-fix/`. `work/checkpoints/pre-forest-fix/README.md` records SHA256 hashes and the surgical rollback boundary.
- **Root-cause finding**: the scanned fern/shrub meshes are already high-detail geometry, but their opacity masks were effectively one-bit silhouettes (`shrub_02` only ~0.067% intermediate alpha; `shrub_03` ~0.015%; `shrub_04` ~0.012%; `fern_02` ~0.055%). The pine crown also resolved as hundreds of same-frequency 10-plane spherical "puffs," which produced the repeated diagonal-feather pattern in the pre-fix capture. Therefore the pass did not chase arbitrary higher texture resolution; it changed representation and authored coverage instead.
- **Foliage coverage assets**: `scripts/generate-forest-alpha.py` reproducibly creates `alpha_forest.png` for `fern_02` and `shrub_02/03/04`. It preserves opaque interiors and empty atlas padding while adding a narrow filtered fractional-coverage band at the leaf boundary. `environment.js` routes only those scanned broadleaf/fern assets to the generated mask and keeps authored pine/grass/fir masks. Example: `shrub_02` intermediate alpha increases from ~0.067% to ~3.125%, giving the existing MSAA alpha-to-coverage path actual edge information instead of a binary cutout.
- **Pine model rebuild**: the old 10-plane spherical puff primitive was replaced with parent-bough-aligned folded branchlet sprays. Canopy packing was reorganized from continuous micro-puff fill into readable trunk -> structural bough -> branchlet spray hierarchy: fewer whorls/branches per whorl, fewer branchlet groups, selective single lateral children, substantially reduced shell/inner fill, and explicit negative space. This is geometry/UV/normal work; no foliage shader code was changed.
- **Pine branch texture/model integration**: procedural bough cylinders now carry cylindrical bark UVs and reuse the existing 4K pine-bark diffuse/normal/roughness set. Branch radius/reach were also reduced from the first pass. This specifically fixes the pale, smooth "silver tube" branches exposed by Pass 01 without touching the concurrent lighting implementation.
- **Scanned understory fidelity**: previous strong green material multipliers and wide per-instance RGB swings were reduced so the scan's real high-resolution color/age/vein variation survives. Variation remains correlated at plant scale instead of producing synthetic color noise. The real scan geometry and existing LOD placement remain intact.
- **Ground deadwood**: `clutter.js` now mixes three deterministic procedural stick geometries and three forked-twig geometries (different lengths, tapers, radii and curvature seeds) instead of repeating one mesh family everywhere. Existing photogrammetry `dry_branches_medium_01` variants remain and use a restrained rough bark response rather than exaggerated normal contrast. Pebble/stone code was deliberately not changed.
- **Shader isolation verification**: `work/game/src/foliage-rendering.js` has the exact same SHA256 (`399790D2F793C9A3B88D8DBA5A58E361348FDDCD93D7C226E7778E85F2004966`) as the pre-fix checkpoint. `atmosphere.js` contained concurrent external work and was not edited by this task.
- **Iteration / visual QA**: Pass 01 was inspected and rejected as final because the new canopy hierarchy revealed overly pale bough geometry. Pass 02 corrected bark UV/PBR integration and was re-captured. `work/game/qa/forest-texture-01/pass-02/` contains six verified screenshots with `errors: []` and 38.14M–70.16M rendered triangles; `ground-pass-02/` contains eight verified deadwood/forest-floor views with `errors: []` and 46.08M–69.62M triangles. `before-after.png` is a matched three-view pre-fix vs Pass-02 comparison. Detailed visual critique is in `work/game/qa/forest-texture-01/README.md`.
- **Automated verification**: `npm.cmd run build` passes. `npm.cmd test -- --run` passes **92/92**, 0 failures. Current implementation remains `[CURRENT BUILD NEEDS MANUAL CHECK]` because the human user has not yet manually confirmed final visual acceptance; the separate in-progress ATM/shader work also materially affects how foliage brightness appears in captures and was intentionally excluded from this task.

### FOREST-TEXTURE-02 decisive redo after direct user rejection — 2026-09-14
**Status**: `[AUTOMATED VERIFIED: 92/92 TESTS PASS; SIX VALID PASS-06 CAPTURES; CURRENT BUILD NEEDS MANUAL CHECK]`

- **Latest user authority supersedes the prior visual claim**: the user explicitly
  judged FOREST-TEXTURE-01 as roughly "10% of the work": nearby ferns looked good,
  while most bushes and tree leaves still looked nothing like the reference. The
  old Pass-02 description is therefore historical evidence, not visual acceptance.
- **Proven root cause**: the positive fern result mapped directly to its usable
  full-detail band. By contrast, `shrub_02` used `near=2.0` and `lodDistance=2.0`,
  making its full 173,836-triangle scan unreachable; `shrub_03` had only a
  ~20 cm full-detail annulus; tall `shrub_04` groups were similarly forced onto
  aggressively collapsed LODs. The fir "near" model was itself only ~7.5% of
  original topology. These facts explain the flat/angular midground far better
  than further alpha-only tweaks.
- **Decisive implementation**: shrub full scans now survive into the real
  midground; bushes receive same-root secondary scan volume; tall sapling roots
  deterministically mix broadleaf and lance families without changing root
  placement generation; forest-tuned high-detail scan albedos are generated and
  loaded; original fir scan geometry is restored for the true near tier; and
  mature pine crowns now use the authored scanned twig/needle + crown-bark
  topology instead of procedural ribbon/puff replacement geometry. Additional
  rotated/raised scanned crown layers deepen living foliage on the same trunks.
- **Scope isolation**: no stones/streambed edits and no changes to
  `src/foliage-rendering.js`. Existing concurrent `atmosphere.js` work was left
  untouched. This redo stays inside foliage models, foliage textures and their
  environment placement/render integration.
- **QA evidence**: `work/game/qa/forest-texture-02/pass-06/` contains six valid
  runtime screenshots with `errors: []`, 61.05M–128.28M rendered triangles and
  910–4,120 draw calls. `work/game/qa/forest-texture-02/before-after.png` compares
  the rejected FOREST-TEXTURE-01 Pass 02 against current Pass 06 using matched
  mid-distance, side-canopy and stream-side views. Full notes are in
  `work/game/qa/forest-texture-02/README.md`.
- **Automated gates**: current `npm.cmd run build` passes and
  `npm.cmd test -- --run` passes **92/92**, 0 failures. Human visual acceptance is
  still required, so status remains `[CURRENT BUILD NEEDS MANUAL CHECK]`.

## GH-50 Central Ritual Slab Plant Exclusion — 2026-09-12
**Status**: `[AUTOMATED VERIFIED: 85/85 UNIT TESTS PASS; QA CAPTURE SET VALID; CURRENT BUILD NEEDS MANUAL CHECK]`

- **User request**: remove only living plants that appear to grow directly out of the central ritual slab carrying the bottle, lighter, pipe, and weed bag. Plants rooted in surrounding soil and unrelated forest vegetation must remain.
- **Implementation**: `work/game/src/environment.js` now uses `ritualSlabCoverage()` with a rounded footprint based on the measured world-space bounds of the scanned ritual slab (`x ±0.81m`, `z 0.19m–1.47m`), plus only a local `0.008–0.08m` base-overlap margin derived from the plant base. The filter is applied only to forest plant placements; fallen leaves, needles, branches, stones, and plants rooted immediately behind or beside the slab remain unchanged.
- **Follow-up correction from user-marked screenshot**: three remaining `Midground screening bushes` roots identified by the user's red marks were traced to deterministic roots at `(1.6269, 1.5113)`, `(0.4548, -0.5828)`, and `(0.7806, -0.2388)`. `ritualSlabMarkedBush()` excludes only those three instances; it does not widen the slab clearing or affect other vegetation behind the stone.
- **Superseded attempt**: a later fixed `0.20–0.22m` margin was too aggressive and made the soil immediately behind the slab look sparse. It was replaced by the smaller geometry-derived margin in the current build.
- **Automated verification**: `npm test` passes **85/85** including the new screenshot-marked-root assertions in `tests/gh50.test.mjs`; `npm run build` succeeds with no errors.
- **Runtime QA**: `work/game/qa/gh50-after-marked-fix/` contains 8 valid 1440×900 WebGL captures after the targeted correction, with `errors: []`, 51.5M–78.1M triangles, and 1,484–3,684 draw calls. The slab-top view is clear while the perimeter/behind-slab forest remains dense. The prior `work/game/qa/gh50-evidence-restored/` set remains the pre-follow-up comparison record.
- **Manual status**: `[CURRENT BUILD NEEDS MANUAL CHECK]` until the user confirms that the central slab is visually clear while nearby soil vegetation remains acceptable.

---

## Post-Luna Implementation & Verification Checkpoint — 2026-09-10 (Current Session)
**Status**: `[AUTOMATED VERIFIED: 49/49 UNIT TESTS PASS; CURRENT BUILD NEEDS MANUAL CHECK]`

Following the comprehensive Post-Luna User Audit and 50-task backlog (`Gravity_Hit_Final_Post_Luna_Audit_Backlog.md`), four implementation phases and documentation semantics were addressed:

1. **Phases 1 & 2 Implemented (Commit `4e90de5`)**:
   - `GH-01`: Order-independent pipe and weed-bag acquisition (`simulation.js`).
   - `GH-02`: Screw-start pose normalization regardless of pickup order (`interaction-view.js`).
   - `GH-09` & `GH-10`: Hero pipe slim chillum geometry and borosilicate glass shader tuning (`props.js`).
   - `GH-21` & `GH-22`: Pine trunk thickness and natural bark variation scaling (`environment.js`, `world.js`).
   - `GH-41`: Static shadow camera profile optimization.
   - `GH-44`: QA capture provenance and zero-draw render validity guard (`tests/capture-guard.test.mjs`, `scripts/qa-capture.mjs`).
2. **Phases 3 & 4 Implemented (Commit `9f691e2`)**:
   - `GH-03`: Interaction prerequisite audit and matrix test suite (`tests/gh03.test.mjs`).
   - `GH-04`: Three-tier Torricelli smoke combustion response curve (`tests/gh04.test.mjs`).
   - `GH-11`: Multi-stage glass pipe progressive resin accumulation shader (`props.js`).
   - `GH-12`: Ergonomic Clipper lighter grip orientation with player-facing right thumb operating side (`props.js`).
   - `GH-19` & `GH-20`: HUD typography and responsive hotbar label styling (`style.css`).
   - `GH-23`: Scots pine bark PBR material update (`environment.js`).
   - `GH-24`: Multi-layer conifer canopy needle clusters (`environment.js`).
3. **GH-45 Implemented (Current Task)**:
   - Standardized documentation status semantics across `PROJECT_HANDOFF.md`, `AGENTS.md`, `Gravity_Hit_Final_Post_Luna_Audit_Backlog.md`, and `README.md`.
   - Separated historical agent claims from active truths and classified all verification records.

4. **Current Test Suite Status**:
   - `node --test tests/*.test.mjs`: **80/80 unit tests PASS** (up from historical 19/19, 30/30, and 49/49).
   - Includes: `capture-guard.test.mjs` (10 tests), `gh03.test.mjs` (3 tests), `gh04.test.mjs` (4 tests), `gh06.test.mjs` (5 tests), `gh08.test.mjs` (8 tests), `gh16.test.mjs` (2 tests), `gh46.test.mjs` (20 tests), `picking.test.mjs` (3 tests), `recovery.test.mjs` (10 tests), `simulation.test.mjs` (15 tests).

## User Follow-up: Pine canopy and trunk resolution — 2026-09-10
**Status**: `[CURRENT BUILD NEEDS MANUAL CHECK]`

- Latest explicit user feedback remains the source of truth: the pine foliage still looked unrealistic; the user requested a denser, more natural leaf/needle presentation inspired by the supplied realistic-tree reference, while keeping the existing trunk thickness and making the bark visibly 3D and high resolution.
- **GH-24 canopy rebuild**: `work/game/src/environment.js` now retains the scanned 3D trunk/dead-branch meshes, but replaces the decimated twig presentation with near/mid/distant tiers, irregular inner whorls, layered branch depth, procedural tapered 3D needle bundles, brown 3D branchlets, and sparse atlas detail. Shrub density and unrelated forest composition were not changed.
- **Trunk resolution pass**: downloaded the CC0 4K Poly Haven Pine Bark PBR set (`work/game/public/assets/pine_bark_4k/`) and applied its diffuse, GL normal, and roughness maps only to `pine_tree_01_bark` and `pine_tree_01_trunk_b` materials. Existing pine trunk proportions and GH-23 bark shader logic are preserved. Source is recorded in `work/game/public/assets/sources.json`.
- **Failed attempt recorded**: Poly Haven `bark_brown_01` was initially tested as a 4K replacement, but its warm generic wood albedo rendered the pine trunks too yellow under the current lighting. It was replaced by the conifer-specific `pine_bark` set and is therefore `[SUPERSEDED]` for this task.
- **Automated verification**: `npm run build` passed; `npm test` passed **80/80**. `work/game/qa/gh24-evidence-final/capture.json` is verified with six captures, no page/asset errors, four requested canopy/distance views plus side view, and 72 slow-camera samples. Fully loaded runtime snapshot: 14,994,774 triangles, 1,652 draw calls, `assetErrors: []`. `scripts/benchmark.mjs` at 1920×1080 Medium reported 65.85 FPS forward, 73.77 FPS forest, 69.76 FPS orbit, 16,294,038 peak triangles, and `errors: []`.
- **Manual status**: the current build remains `[CURRENT BUILD NEEDS MANUAL CHECK]` until the human user visually checks trunk bark resolution, canopy density, against-sky silhouettes, and slow camera movement in the live build.

---

## GH-35 Streambed 3D Rebuild Verification Checkpoint — 2026-09-11
**Status**: `[CURRENT BUILD NEEDS MANUAL CHECK]` (AUTOMATED VERIFIED: 80/80 UNIT TESTS PASS, 5 PROVENANCE-VERIFIED 1080P QA CAPTURES, ZERO FLOATING INSTANCES; CRITIC VERDICT: YES, 9/10 PHOTOREALISTIC TIER)

### Problem & Intent
The stream water itself was broadly acceptable to the user, but the streambed looked like an unrealistic, flat gray blob / weak surface. The user requested a focused, major streambed rebuild with strong **real 3D structure**: dense gravel layer, small pebbles, multiple size classes, partially buried stones, larger anchor rocks, uneven bed depth, sediment pockets, varied orientation, and believable burial, with actual geometric relief visible through shallow water. 

**User Mandate & Visual Benchmark**:
- Streambed pebbles and rocks must match the 3D realism, high resolution, and photographic quality of the main ritual rock slab where items (bottle, lighter, weed bag) rest.
- Authentic physical placement without recurring patterns or straight lines.
- Evaluated by an independent Critic Agent on two criteria:
  1. *Do rocks/pebbles look just as good as the big rock that has items on it (quality, not size)?* -> Requirement: `YES`.
  2. *Rate 1/10 on how realistic and good looking the riverbed is.* -> Requirement: `> 7.0 / 10`.

### Iteration History & Critic Trajectory
- **Iteration 1**:
  - *Critique*: Question 1: `NO`, Question 2: `6.0 / 10`.
  - *Defects Identified*: Uniform plastic specular sheen, French drain voids without sediment, monotonous cobble sizing, missing anchor boulders.
- **Iteration 2**:
  - *Critique*: Question 1: `NO`, Question 2: `5.5 / 10`.
  - *Defects Identified*: Vertical tombstone rock at `[-0.68, 0.92]` standing unnaturally on its tip; warm yellow/orange "garden gravel" palette contrasting with cool pine hollow; procedural texture disparity against the razor-sharp photogrammetric ritual slab; vertical stacking spires; flat grey sludge ground plane in refill view.
- **Iteration 3 (Final Rebuild)**:
  - *Critique*: Question 1: `YES`, Question 2: `9.0 / 10` (**PASS**).

### Technical Implementation Details (`work/game/src/streambed.js`, `world.js`, `environment.js`)
1. **Scanned 3D Photogrammetry Geometries**:
   - Upgraded Class 1 Anchor Boulders and Class 2 River Cobbles via `upgradeStreambedGeometries()` to use the real scanned 3D photogrammetry meshes from `rock_moss_set_01` (`sources[1]` and `sources[3]`), bringing genuine geological fracture facets and erosion profiles to the riverbed.
   - Retained procedural fluvial geometries for Class 3 pebbles, Class 3b shingle discs, Class 4 pea gravel, and Class 5 interstitial grit with hydraulic asymmetry and water-smoothed cleavage edges.
2. **Shared 4K Photogrammetry Texture Pipeline**:
   - Streambed PBR material directly utilizes the 4K photogrammetry texture library from `rock_moss_set_01` (`diff_4k.jpg`, `nor_gl_4k.jpg`, `rough_4k.jpg`, `ao_4k.jpg`) matching the ritual rock slab, supplemented by micro-grain normal maps from `rock_boulder_dry/nor_gl_4k.jpg`.
   - Applied identical photogrammetric grain calibration: `mDiff / vec3(0.658, 0.609, 0.550)` matching `world.js:194`.
   - Prevented ground-plane `sandy_gravel` maps from overwriting the clean 4K stone materials in `applyStreambedTextures()`.
3. **Dual-Octave Normal Detailing**:
   - Blended macro geological cleavage ridges (`dNw1 * 1.15`) with sharp micro-crystalline grain (`dNw2 * 0.55`) and elevated normal strength (`1.35 - 1.70`).
   - World-to-view space normal transformation maintained under camera rotation via `uViewRotation` linked to `camera.matrixWorldInverse` in `inst.onBeforeRender`.
4. **Matte Tops & Satin Fluvial Wetness Dynamics**:
   - Replaced uniform specular sheen with physical gradient wetness:
     - Exposed upper facets drying in the air ($y > W + 0.01\text{m}$, $N_y > 0$) have matte `roughness = 0.86`, matching the top face of the dry ritual slab.
     - Submerged rock features a natural satin damp sheen (`roughness = 0.32`).
     - Contact waterline has an ultra-tight glossy meniscus rim (`roughness = 0.07`) at $|y - W| < 0.010\text{m}$.
     - Submerged stone albedo drops by $40\%\text{--}48\%$ with subtle mineral saturation, mirroring natural wet rock optical absorption.
5. **Cool Native Mineral Palette**:
   - Replaced warm yellow/orange tones with native mountain hollow minerals:
     - River Granite (`#9fa4a4`), Slate/Siltstone (`#5e6565`), Weathered River Bedrock (`#767066`), Basalt (`#404242`), Moss/Biofilm Patina (`#566248`), Quartzite (`#b8b0a2`).
6. **Anti-Tower Single-Tier Physical Stacking & Collision**:
   - Single-tier stacking depth: stones can never stack on a stone that is already stacked (`base.isStacked`).
   - Strict size hierarchy: stones can only stack on strictly larger stones from an earlier tier (`base.tier < currentTier && base.r >= r * 1.40`).
   - Absolute ground relief ceiling: `stackY <= groundY + base.h * 1.15`, preventing vertical spires and cairns.
   - Horizontal same-tier collision checks enforce non-phasing spacing.
7. **Channel Corridor Clamping & Authored Rock Tucking**:
   - Clamped stone distribution within natural riverbed boundaries, removing rogue pebbles climbing up forest banks.
   - Authored standing rock at `[-0.68, 0.92]` moved to `[-0.92, 0.92, 0.16]` and nestled flat into the bank moss.
8. **Sedimentary Bedding Underbed (`environment.js`)**:
   - Upgraded ground mesh creekbed shader with rich, dark wet gravel sediment (`cSample.rgb * vec3(0.58, 0.54, 0.50)` at $11.5\times$ frequency), completely eliminating the flat grey sludge plane.

### Verification Records
- **Unit Test Suite**: `node --test tests/*.test.mjs` passed **80/80 tests** (0 regressions).
- **Physical Contact Guard**: `node scripts/inspect-contact.mjs` passed with **`floatingCount: 0`** (all stones anchored).
- **Production Build**: `node node_modules/vite/bin/vite.js build` built in 373ms with 0 errors.
- **QA Capture Suite (`work/game/qa/gh35-rebuild/capture.json`)**:
  - `allValid: true`, resolution $1920 \times 1080$, renderer: ANGLE NVIDIA GeForce RTX 3070 Direct3D11.
  - Verified 5 mandatory views:
    1. `01-exposed-dry-edge.png`: Dry exposed bank transitioning into shallow stream edge with cool mineral cobbles and wet gravel bars.
    2. `02-shallow-water-bottom.png`: Looking down into clear shallow water showing distinct 3D pebbles, cobbles, and sediment pockets.
    3. `03-looking-along-stream.png`: Longitudinal channel view showing continuous gravel bed relief and channel curvature without vertical spires.
    4. `04-looking-across-stream.png`: Cross-channel view from near bank to far bank showing natural fluvial bedding.
    5. `05-refill-view.png`: Interactive refill mode showing the submerged bottle dipping over a dense, clean floor of rounded pebbles without boulder intersection or grey sludge.
- **Critic Agent Final Verdict (Iteration 3)**:
  - Question 1 (Material Quality Parity vs Ritual Slab): **YES**
  - Question 2 (Realism & Aesthetics Score): **9 / 10** (Outstanding / Photorealistic Tier; passing threshold was > 7.0 / 10).
- **Manual Status**: Marked `[CURRENT BUILD NEEDS MANUAL CHECK]` per `AGENTS.md` rules until the human user confirms interactive acceptance in live play.

### User Directive & Restoration to Critic Round 2 State — 2026-09-11
**Status**: `[CURRENT BUILD NEEDS MANUAL CHECK]` (AUTOMATED VERIFIED: 80/80 UNIT TESTS PASS, 5 PROVENANCE-VERIFIED 1080P QA CAPTURES, ZERO ERRORS; USER APPROVED PRIOR ROUND 2 VISUAL DIRECTION)

- **User Directive**: The user explicitly requested: *"implement the stuff you made when there was the critic round 2 and end"* (referring to Critic Round 2 evaluated at transcript step 2337/2338 with conversation ID `c49a2560-12e0-4900-9256-e0616ab08ce8`). The user stated: *"ogólnie jest o niebo lepiej niż było wcześniej"* and instructed to restore that exact version.
- **Root Cause of Reversion**: Later experimental iterations (Rounds 3-5) introduced changes (smooth SphereGeometry otoczaki, overly aggressive plant exclusions, modified water opacity and coordinate calculations) that degraded the visual balance achieved in Round 2.
- **Exact Codebase Restoration**:
  - `work/game/src/streambed.js`: 100% replayed through all 67 transcript actions from step 0 to step 2337 (`rebuild_to_step.mjs`), restoring the authentic mineral palette (`#b8ab96`, `#9c8a74`, `#bd9d74`, etc.), dual-frequency micro-normals, physical waterline meniscus, lateral gravel bars, and seamless multi-octave water turbulence.
  - `work/game/src/environment.js`: Fully reconstructed and aligned to step 2241 / 2337, preserving all root berm segments, nurse logs, knoll cradles, disturbed soil, bank profiles, `forestHeight`, `creekBankMeander`, `placeAllowed`, `buildStreambed(world)`, and the 4-octave water turbulence normal generator.
- **Verification Records**:
  - `npm run build`: Vite v8.2.2 bundle compiled in 384ms with 0 errors.
  - `node --test tests/*.test.mjs`: **80/80 tests PASS** (0 regressions, 408ms).
  - `scripts/capture-gh35-rebuild.mjs`: 5 provenance-verified 1080p QA captures generated in `work/game/qa/gh35-rebuild/` (`allValid: true`, 23.2M to 52.3M triangles, 1,176 to 2,918 draw calls, `errors: []`).
  - Rendered captures visually inspected and verified to replicate the exact Round 2 visual fidelity.

---

## Hero-Prop Runtime Source-of-Truth Architecture (GH-43 Audit — 2026-09-11)
**Status**: `[AUTOMATED VERIFIED: 80/80 UNIT TESTS PASS; ARCHITECTURALLY CLARIFIED; CURRENT BUILD NEEDS MANUAL CHECK]`

### Problem & Architectural Ambiguity (Why GH-43 Existed)
Historically, hero props (bottle, pipe, lighter) passed through three disconnected, overlapping layers during application startup:
1. **Layer 1 (Startup Fallback)**: Synchronous procedural geometry in `world.js:makeObjects()`.
2. **Layer 2 (Intermediate GLB)**: Asynchronous GLTF loader in `world.js:loadAssets()` calling `upgradeBottle()`, `upgradePipe()`, and `upgradeLighter()`, loading `bottle.glb`, `pipe.glb`, and `clipper.glb`.
3. **Layer 3 (Runtime Rebuild / Authority)**: Immediate invocation of `upgradeHeroProps(this)` in `work/game/src/props.js` after all asset promises settle.

This three-layer pipeline created severe architectural regression risk: future agents were prone to editing the wrong files (e.g. modifying `work/build_bottle.py` or `work/build_pipe.py` or styling GLB meshes in `world.js:upgradeBottle()`) and wondering why no in-game changes appeared.

### Authoritative Hero-Prop Source-of-Truth Map

| Hero Prop | Final Runtime Representation | Authoritative Source File & Function | Historical / Superseded Files | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Bottle** (`items.bottle`) | **100% Procedural Three.js**: 96-segment PET lathe shell with petaloid base & parting seams, 2048×512 BoPP label with normal map, helical neck thread tube, 28mm knurled cap (`createCapGeometry(false)`), torus melt rim, circle outlet aperture. Shaders: `thinShellResponse` dielectric Fresnel + `createPetNormalTexture()`. | `work/game/src/props.js`<br>↳ `rebuildBottle()` | `work/build_bottle.py`<br>`work/game/public/assets/bottle.glb`<br>`world.js:makeObjects()` bottle lathe<br>`world.js:upgradeBottle()` | `[USER VERIFIED CURRENT / RUNTIME SOURCE OF TRUTH]`<br><br>*Historical files marked `[SUPERSEDED AT RUNTIME]`* |
| **Pipe** (`items.pipe`) | **100% Procedural Three.js**: 96-segment slim borosilicate chillum lathe (~8.0cm × 6.7mm OD, shallow flared bowl, mouthpiece flare), 28mm knurled cap with melted aperture (`createCapGeometry(true)`), rubber grommet collar, dynamic 2D canvas amber resin inner bore texture (`createPipeResidueTexture()`), hot tip glow lathe, procedural bud nugget. Shader: `borosilicateResponse`. | `work/game/src/props.js`<br>↳ `rebuildPipe()` | `work/build_pipe.py`<br>`work/game/public/assets/pipe.glb`<br>`world.js:makeObjects()` pipe lathe<br>`world.js:upgradePipe()` | `[USER VERIFIED CURRENT / RUNTIME SOURCE OF TRUTH]`<br><br>*Historical files marked `[SUPERSEDED AT RUNTIME]`* |
| **Lighter** (`items.lighter`) | **Hybrid Architecture**: Lower chassis meshes retained from `clipper.glb`. All upper mechanisms procedurally replaced in `props.js`: machined brass burner valve assembly, stainless steel curved windscreen hood with rolled rim & vents, polymer flint stanchion with brass bushing & steel axle, knurled 24-tooth striker wheel rotor (`world.wheel`), ergonomic gas actuator lever with 3 thumb grip ridges, and 1024×1024 high-res canvas sticker decal. | `work/game/src/props.js`<br>↳ `correctLighter()`<br><br>*(Chassis meshes: `work/game/public/assets/clipper.glb`)* | `world.js:makeObjects()` lighter cylinder<br>Upper mechanism meshes in `work/build_hero.py` / `clipper.glb`<br>`world.js:upgradeLighter()` head setup | `[USER VERIFIED CURRENT / RUNTIME SOURCE OF TRUTH]`<br><br>*Chassis marked `[PARTIALLY ACTIVE]`; GLB head parts marked `[SUPERSEDED]`* |

### Key Invariants for Future Agents Working on Hero Props
1. **Never edit `build_bottle.py` or `build_pipe.py`** expecting visual updates. `bottle.glb` and `pipe.glb` are completely stripped from the scene graph by `removeTree()` during `rebuildBottle()` and `rebuildPipe()`.
2. **If editing the Bottle**: Edit `work/game/src/props.js` (`rebuildBottle`, `createCapGeometry`, `createPetNormalTexture`, `createLabelNormalTexture`, `bottleLabel`).
3. **If editing the Pipe**: Edit `work/game/src/props.js` (`rebuildPipe`, `borosilicateResponse`, `createPipeResidueTexture`, `updatePipeResidueTexture`).
4. **If editing the Lighter**:
   - To edit the cylindrical plastic body, refill valve, or lower collar: edit `work/build_hero.py` / `clipper.blend` / `clipper.glb` (only meshes named `'Body'`, `'Base_mould_seam'`, `'Refill_valve'`, `'Refill_valve_recess'`, `'Upper_collar'` are preserved).
   - To edit the striker wheel, wheel teeth, flint stanchion, windscreen guard, burner nozzle, gas lever, or printed wrap: edit `work/game/src/props.js` (`correctLighter`).

---

## Terrain-Detail Contact & Physical Embedding (GH-34 Pass — 2026-09-11)
**Status**: `[AUTOMATED VERIFIED: 80/80 UNIT TESTS PASS; QA CAPTURES VERIFIED; CURRENT BUILD NEEDS MANUAL CHECK]`

### Problem Addressed
In earlier builds, terrain clutter (sticks, twigs, pine cones, leaves, bark flakes), scanned rocks, riverbed gravel, and understory plants exhibited several immersion-breaking integration defects:
1. **Euler Rotation Crosstalk**: When yaw (`rot`) was set in Three.js Euler order `XYZ` alongside ground slopes (`rx`, `rz`), non-zero yaw rotated the tilt vector away from the surface normal, causing props to tip into air or slice into soil.
2. **Elongated Prop Floating**: Sticks (~0.38m) and fallen branches sampled terrain height only at their center, causing one or both ends to hover noticeably above dips or cut through rises on uneven banks.
3. **Upright Standing Pine Cones**: Pine cones were standing vertically on their bases like tiny trees instead of lying naturally horizontal on the needle bed.
4. **Floating Rock & Plant Skirts**: Scanned field rocks had insufficient embedding depth (only 25% of height), leaving visible air gaps under rock margins on slopes. Plant root flares hovered above local displacement hollows.

### Technical Implementation
1. **Quaternion Normal Alignment (`work/game/src/clutter.js`, `world.js`, `environment.js`)**:
   - Replaced all Euler-based tilt/yaw calculations with exact orthonormal frame computation:
     `norm = (-slopeX, 1.0, -slopeZ).normalize()`, `qAlign.setFromUnitVectors(UP, norm)`, `qYaw.setFromAxisAngle(UP, yaw)`, `quaternion = qAlign * qYaw * qWobble`.
   - Applied to all ground clutter batches, authored rocks, riverbed stream stones, and understory props.
2. **Two-Point Longitudinal Slope Pitch Tracking (`clutter.js:addElongatedInstance()`, `environment.js:wood()`)**:
   - For long props (straight sticks, forked twigs, dead branches, fallen nurse logs), sampled terrain heights at both longitudinal endpoints: $P_1 = (x - dx, y_1, z - dz)$ and $P_2 = (x + dx, y_2, z + dz)$.
   - Constructed the longitudinal direction vector $\vec{D} = (P_2 - P_1)/\lVert P_2 - P_1 \rVert$, normal vector $\vec{N}_{avg}$, and cross-product right vector $\vec{R} = \vec{D} \times \vec{N}_{avg}$, creating an orthonormal rotation matrix directly fitted to the ground slope.
   - Guaranteed both endpoints and prop belly make physical contact with the ground without hovering.
3. **Horizontal Fallen Pine Cones (`clutter.js:createPineConeGeometry()`)**:
   - Reoriented pine cone procedural geometry by 90° along the X axis (`rotateZ(-Math.PI * 0.5)`), centered its longitudinal axis, and applied a 36% diameter belly embedding into the pine needle bed.
4. **Calibrated Physical Embeddings**:
   - Scanned rocks: embedding increased from 25% to 48% (close-up) and 54% (midground) of scaled height, grounding rock skirts into loam and creek beds.
   - Riverbed gravel: aligned to local creek bed/bank normal with 18% diameter embedding.
   - Leaf clusters & pine needle tufts: base vertex grounded at $y=0$ with 7mm downward penetration to eliminate hover over displacement dips.
   - Bark flakes: centered thickness around $y=0$ so edges seat into soil; enabled `castShadow = true`.
   - Shrubs, saplings, ferns, grasses: tilted naturally with downhill slope gradient (`tiltMult: 0.20-0.35`) and deepened stem base embedding from 2.2cm to 5.0cm.

### Verification Results
- **Automated Unit Tests**: `node --test tests/*.test.mjs` passed **80/80**.
- **Contact Invariant Verification (`scripts/inspect-contact.mjs`)**:
  - Pine Cones: 100% horizontal orientation (world Up dot-product $\le 0.169$; vertical would be 1.0).
  - Sticks & Forks: Minimum ground penetration $\ge 9.0\text{mm}$, average $47.3\text{mm}$. Zero floating ends.
  - Scanned Pebbles: Embedded $17.2\text{mm}$ to $32.6\text{mm}$ (average $22.2\text{mm}$).
- **QA Capture Session (`qa/gh34-evidence/`)**:
  - Captured 8 verified viewpoints with live WebGL metrics (13.2M to 28.2M triangles, 1239 to 2699 draw calls, `errors: []`).
  - Viewpoints: `01-ground-close-up.png`, `01b-ground-close-up-angled.png`, `02-player-height-normal.png`, `02b-player-height-slight-down.png`, `03-slab-perimeter-collar.png`, `03b-slab-perimeter-left.png`, `04-creek-bank-wrack.png`, `05-midground-forest-floor.png`.

---

## Historical Session: Multi-Issue Fix & Refinement Audit — 2026-09-09 [SUPERSEDED IN PART BY POST-LUNA USER AUDIT]

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

7. **Historical Verification Matrix (2026-09-09)**:
   - `node --test tests/*.test.mjs`: **30/30 unit tests PASS** (historical test suite; superseded by 49/49 on 2026-09-10).
   - `scripts/stability.mjs`: **PASS** (max label discrepancy 0.0117 px across 20/30/60 FPS).
   - `scripts/playtest.mjs`: **PASS** (6/6 automated full gameplay runs complete successfully).
   - Production bundle compiled with `vite build`. Visual fixtures captured and verified in `work/qa/recovery/props-pass5` and `work/qa/recovery/pass16`.

---

### Historical Checkpoint: Implementation and verification continuation — 2026-09-09 [SUPERSEDED IN PART]

- **Interaction implemented:** `simulation.js` v3 has explicit primary/supporting ownership. Picking one tool does not acquire another; bottle/stream filling requires holding the bottle. Preparation can be cancelled with E and resumed by selecting the required pieces. `picking.js` resolves current visible physical surfaces to one logical item, ignores helpers/transparent effects, and respects ground/slab occlusion. `main.js` resolves queued picking after current-frame transforms, stops DOM action propagation, ignores repeated key actions, and coalesces saves without dropping later snapshots.
- **Transforms implemented:** `interaction-view.js` owns camera-relative held transitions, bottle-local cap transforms, current-frame lighter aiming and anchors. Removed world-space chasing, duplicate inhale writes and cough feedback. Bottom-hole framing is central and uses the real outlet. Labels project after current transforms with fractional CSS coordinates. Attached pipe no longer duplicates the bottle label. Liquid/smoke share a horizontal plane computed from the full bottle transform. Drain jets originate at the transformed outlet, including the inhale drain.
- **Props implemented and inspected:** `props.js` rebuilds hollow flared glass, cap aperture/grommet, thin ribbed PET walls/base/neck, localized residue and lighter orientation/branding/wheel teeth/nozzle. Pipe transmission uses full material opacity (the previous additional alpha made it nearly disappear). `props-pass2` has 18 macro fixtures; `props-pass3` four corrected pipe fixtures. These are staged views, not gameplay evidence. Baggie nuggets now use welded smooth normals, avoiding crystal-like faceting. The slab extends farther into terrain while retaining its contact top. Further realism improvements remain possible; no 8/10 visual claim.
- **Environment implemented:** explicit downloaded alpha masks are bound to the foliage materials; authored plant root rotations are preserved. Multiple fern/shrub/grass/fir variants and mature/distant pines replace the old repeated/sparse arrangement. `environment.js` provides a continuous displaced loam/gravel surface, embedded irregular gravel deposits, wet-bank blending and corrected single-Fresnel water transparency/reflection. The raised gray gravel blanket was removed. Existing near-ground geometric relief is retained. New local assets/sources are recorded in the existing asset ledger.
- **Historical tests: 30/30 passed.** (Superseded by current 49/49 test suite).
- **Rendered stability:** replaced the old algebra-only `scripts/stability.mjs`. Latest output in `work/qa/recovery/stability`: 324 rendered samples, 27 captured frames across bottle/heating/hole poses, slow/fast/reversing RMB paths at requested Electron frame limits 60/30/20. All nine cases passed; maximum label/anchor discrepancy 0.0117 px, held/cap/nozzle residuals at floating-point scale. Inspected heating and hole sequences show anchored props. This is sampled rendered evidence, not a blanket zero-jitter claim or independently measured FPS benchmark. Failed test iterations accidentally included intentional startup/previous-fixture transitions; final test waits for pose completion before motion sampling.
- **Full actual-input gameplay passed:** `node scripts/playtest.mjs --full` on current development Electron, screenshots/results in `work/qa/recovery-playtest`. Actual prop-ray clicks and pointer/keyboard input performed preparation and first charge; nine Day 1 hits plus one intentionally lost charge reached sleep; Day 2 automatic hit left 999 charges, 10 total hits, one spill. Tutorial/settings and two renderer reloads passed, preserving both held objects; no captured page errors. Browser manual checks separately confirmed wrong-order bottle rejection, lighter-only acquisition, E put-down, pipe acquisition after cancellation, resumed two-tool heating and E cancellation. Full gameplay was run after the latest prop/liquid/jet/stream changes, before the subsequent distant slope/fir composition edits.
- **Hero material finish:** `props-finish-pass1` contains 18 new staged macro fixtures, no page errors; key bottle, glass and lighter views inspected. PET face opacity .15 (retaining grazing highlights), clearcoat .55; glass wall optical thickness .0015 and clean roughness .035 reduce haze. No mechanics/anchors changed. Filled/empty macro fixture images alone do not establish water readability; actual-input smoke/water screenshot shows the lower retained-water region.
- **Forest composition finish:** pass5's tall slope exposed more bare middle ground and was reduced in pass6. Fir clusters now join the middle distance. Grass filtering had excluded leafy clumps while enlarging tiny stalks: `build_grass_lod.py` preserves all variants and reduces large meshes to 1800 triangles; `grass_clumps_lod.glb` is local and recorded in sources.json. Low growth, leafy clumps and sparse seedheads now have separate realistic size distributions, with leafy groups concentrated beside the clearing. Pass8 oversized tussocks dominated the foreground; pass11 lowers them to 9–23 cm.
- **Background/canopy correction:** the HDR remains the lighting/reflection environment, while a rendered sky behind real trees replaces its visible photograph (which projected gigantic nearby trunks behind the scene). The initial sky test in pass8 exposed skeletal pine LODs. `pineSprays` rebuilds needle sprays using the existing twig atlas and surviving branch positions, retaining scanned trunk/branch geometry. Fir needles are opaque modeled geometry: incorrectly applying a cutout mask removed them; that mask is now disabled only for fir needles. Clear-weather fog extends 38–125 m. Leaf forward scattering and slightly brighter daylight retain detail without image blur. Latest six visual views in `pass11` include clearing, both sides, ground, canopy and rear; inspected comparisons preserve the continuous wet stream margin. This is an implemented/inspected improvement, not an independently awarded 8/10 score.

---

### Historical Checkpoint: Final release verification — 2026-09-09 [PREVIOUS AGENT CLAIM - SUPERSEDED]

- **Pipe correction:** the glass pipe was remodeled around the attached slim reference: a shorter, narrower long body, modest bowl, believable thin wall, reduced residue/ember scale, and matching held/label/target anchors. The final packaged screenshots show the intended small, clean silhouette in the world and during assembly. Macro fixtures remain in `work/qa/recovery/props-pipe-reference`.
- **Environment finish:** the stream reflection target is now 1024² to reduce the earlier blocky reflection pattern. The visible photo HDR background remains hidden behind authored forest sky colors, with a darker green horizon/fog balance that keeps real trunks and understory continuous across forward, stream, forest and rear views. Final standalone screenshots were visually inspected in `work/qa/recovery/benchmark-standalone` and `work/qa/recovery-standalone`.
- **Automated tests:** `npm test` was 30/30 passing at the time. `scripts/benchmark.mjs --standalone` measured the actual portable executable at 1920×1080 Medium: 60.002 FPS in forward/stream/forest views, 60.002 FPS over a 240-frame orbit, p95 frame time 16.8 ms, peak 7,803,258 triangles, RTX 3070 renderer, and zero renderer errors. The standalone benchmark harness uses the normal packaged offscreen QA path because benchmark-only window mode could stop delivering frames after a view change.
- **Packaged gameplay:** `node scripts/playtest.mjs --standalone --full` completed with actual prop-ray clicks and pointer/keyboard input. It verified preparation, wrong-order/ownership behavior, bottle refill and retention, spill accounting, nine Day 1 hits plus one spill, sleep/Day 2, automatic upgraded interaction, save/reload, tutorial/settings, and final state `day:2`, `hits:10`, `lost:1`, `stock:999`, held lighter/supporting bottle, `errors:[]`. Evidence is in `work/qa/recovery-standalone/result.json`.
- **Portable artifact:** `outputs/Stillwater/Stillwater.exe` was packaged.

> [!WARNING]
> **PREVIOUS AGENT CLAIM — SUPERSEDED / DISPROVEN BY POST-LUNA USER AUDIT**
> The statement below ("The release is complete... no known defect remains") was a historical assertion by a previous agent. Subsequent human playtesting and visual review revealed that the build remained heavily bugged and rated graphics at "A — still clearly an obvious prototype", resulting in the 50-task Post-Luna Audit Backlog (GH-01 through GH-50). Do NOT cite this historical statement as current truth.

*Historical claim:* "The release is complete for the requested scope. Minor limitations are the intentionally atmospheric dark-green distant horizon behind the real trees, slight softness from physically transparent close-up glass, and mild remaining water shader grain in some angles; no known interaction, ownership, save/load, packaged-startup or major scene-composition defect remains."

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

## 3. USER FEEDBACK LOG & DIRECT OBSERVATIONS [USER VERIFIED CURRENT - HIGHEST AUTHORITY]

> [!IMPORTANT]
> **USER VERIFIED CURRENT**: Direct user observations represent the ultimate source of truth for the project. When an agent's claim or automated test assertion conflicts with user feedback, the user feedback ALWAYS governs.

- **Forest floor 3D depth**: "The forest floor needs actual 3D depth and geometric irregularity. The ground must not remain essentially a flat plane with prettier textures. The player is close to the ground, so real geometry matters."
- **Vegetation variety & scatter**: "Vegetation needs much more variety in species, silhouette, size and placement. Obvious repeated bushes/plants must disappear. Increasing the same shrub's count alone makes repetition worse."
- **Forest layering**: "Foreground, midground and background must blend into one continuous believable forest. The distant environment must not expose where the detailed scene effectively ends."
- **Stream and streambed**: "The stream and especially its bottom/streambed need major improvement. A previous attempt at improving the streambed actually made it worse. If the geometry is wrong, rebuild the geometry."
- **Foreground props**: "Foreground props must withstand close inspection. Better assets should be downloaded or properly made in Blender instead of endlessly polishing inadequate placeholders."
- **Lighter detail & orientation**: "Wheel teeth and metal shield are visible improvements, but the player-facing body is plain black; the requested graphic is not visible during the examined held views. Correct the model/label orientation and ensure the branded side is readable in normal use. Flame looks like an opaque pale-yellow petal with a uniform edge."
- **Lighter jitter**: "The lighter has had visible movement/jitter problems that must remain a regression check. Verify whether the fix really works under slow/rapid movement and variable framerates."
- **Interaction continuity**: "Filling the bottle should logically involve HOLDING THE BOTTLE and interacting with/TARGETING THE STREAM. Clicking the bottle itself should not magically fill it. After filling, the bottle should remain in the player's hands. Objects must not arbitrarily disappear, teleport or change ownership."
- **Preserve good UI**: "The existing UI and much of the interaction/animation presentation are already strong and should not be casually redesigned."
- **USER CONFIRMED (LATEST OVERHAUL DIRECT FEEDBACK - POST-LUNA AUDIT)**:
  - **Overall status**: Build remains heavily bugged. Graphics remain far below target quality; perceived realism needs a dramatic improvement (Current Grade: **A — still clearly an obvious prototype**).
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

## 5. VERIFICATION MATRIX [SYSTEM STATUS AUDIT]

| System / Feature | Verification Level | Canonical Status & Verified Evidence |
| :--- | :--- | :--- |
| **Unit Test Suite (49 tests)** | `node --test tests/*.test.mjs` | **`[AUTOMATED VERIFIED]`**: 49/49 unit tests PASS (simulation, recovery, picking, gh03, gh04, capture-guard). (Supersedes historical 19/19 and 30/30 suites). |
| **Tool collection & heating** | Automated Test + Playtest | **`[AUTOMATED VERIFIED; CURRENT BUILD NEEDS MANUAL CHECK]`**: Unit tests pass (GH-01/GH-03 order independence), but physical feel and ergonomics await live user verification. |
| **Cap penetration & hole melting** | Automated Test + Playtest | **`[CURRENT BUILD NEEDS MANUAL CHECK]`**: Test scripts pass press/hole sequence, but user confirmed bottle hole framing is disconnected/too low. |
| **Nugget drag minigame** | Automated Test + Playtest | **`[AUTOMATED VERIFIED / USER VERIFIED CURRENT]`**: Drag-and-drop logic functions (`bud=1` / `lost=1`), but visual nugget model needs high-fidelity replacement (GH-15, GH-16). |
| **Stream water fill** | Automated Test | **`[AUTOMATED VERIFIED / FIXED BUT REGRESSION-PRONE]`**: Refill requires holding bottle and targeting stream; orientation adjusted (GH-07). |
| **Torricelli drainage & smoke coupling** | Automated Test | **`[AUTOMATED VERIFIED / FIXED BUT REGRESSION-PRONE]`**: Outflow stops at hole; smoke curve retuned in GH-04. |
| **Water retention & cough modulation** | Automated Test | **`[AUTOMATED VERIFIED]`**: Smooth hit at 10–20% water; harsh cough at 0% water. |
| **Day 2 progression & 1000 charges** | Automated Test | **`[AUTOMATED VERIFIED]`**: 10 charges trigger sleep -> Day 2 morning transition. |
| **Day 2 automated actions** | Automated Test | **`[AUTOMATED VERIFIED]`**: Click-to-complete workflows succeed without timing minigames. |
| **Atomic Save / Load (Electron IPC)** | Playtest & Reload Test | **`[AUTOMATED VERIFIED / FIXED BUT REGRESSION-PRONE]`**: Tested with `--qa-persist`; Day 2, hits, and stock persist across reloads. |
| **Photo Mode (GPU Path Tracing)** | Automated Test (`photo-test.mjs`) | **`[AUTOMATED VERIFIED]`**: Converged at 9.11 samples, 5 bounces, no WebGL errors. |
| **Lighter nozzle aim stability** | Automated Test (`stability.mjs`) | **`[AUTOMATED VERIFIED / FIXED BUT REGRESSION-PRONE]`**: Screen error < 1.3e-12 px in synthetic test, but user noted motion jitter and ergonomics during live gameplay. |
| **Audio stream volume leak fix** | Code Inspection | **`[AUTOMATED VERIFIED]`**: Flow boost moved inside `settings.waterSound` multiplier. |
| **Liquid GC allocation fix** | Code Inspection | **`[AUTOMATED VERIFIED]`**: Scratch Vector3 and Float32Array eliminate allocations. |
| **Visual Realism & Revamp** | Historical Agent Summary | **`[PREVIOUS AGENT CLAIM - SUPERSEDED / DISPROVEN BY USER AUDIT]`**: Historical agent claimed "PASS". User rated current graphics as "A — still clearly an obvious prototype", citing weak shrubs, thin trunks, 2D canopy, flat gray streambed. See `Gravity_Hit_Final_Post_Luna_Audit_Backlog.md`. |
| **Triangle Count Budget** | Benchmark Telemetry (`benchmark.mjs`) | **`[AUTOMATED VERIFIED]`**: 7.52M triangles on RTX 3070 at 75 FPS cap (Target: <8M). 13.4ms p95. |
| **Full Ritual Automation** | Playtest (`playtest.mjs --standalone --full`) | **`[AUTOMATED VERIFIED]`**: Scripted agent runs complete 9/9 checks, but manual user playtest uncovered edge cases (GH-01/GH-02/GH-03). |
| **Cross-Launch Save Persistence** | Reload Test (`reload-test.mjs`) | **`[AUTOMATED VERIFIED / FIXED BUT REGRESSION-PRONE]`**: Relaunching restores Day 2, 10 hits, 1 lost, 999 stock. |

---

## 6. KNOWN BUGS, DEFECTS, & CRITIC FINDINGS

### Active User-Reported Defects & Granular Backlog [USER VERIFIED CURRENT / CURRENT BUILD NEEDS MANUAL CHECK]

The following defects represent the active Post-Luna audit findings that govern current priorities (see `Gravity_Hit_Final_Post_Luna_Audit_Backlog.md`):

1. **Shrub Leaf Density & Background Occlusion (`GH-25`–`GH-28`)**: **`[USER VERIFIED CURRENT DEFECT / P1]`**. Individual bushes have too few leaves, look like flat cards, and do not occlude enough background. Understory is sparse, exposing too much bare soil.
2. **Mature Tree Trunk Thickness & Black-Pole Silhouette (`GH-21`–`GH-23`)**: **`[CURRENT BUILD NEEDS MANUAL CHECK / P1]`**. Trunks were too thin and read as black vertical poles. Implemented in commits `4e90de5` and `9f691e2`; pending manual user verification.
3. **2D Conifer Canopy & Needles (`GH-24`)**: **`[CURRENT BUILD NEEDS MANUAL CHECK / P1]`**. Canopy needles read as flat cards. Multi-layer needle geometry added in commit `9f691e2`; pending manual user verification.
4. **Streambed Flatness & Low Detail (`GH-35`–`GH-38`)**: **`[USER VERIFIED CURRENT DEFECT / P1]`**. Streambed reads as an artificial flat gray area. Needs genuine 3D bed contour and dense embedded pebbles/gravel.
5. **Hero Prop Close Inspection & Bud Model (`GH-09`–`GH-18`)**: **`[CURRENT BUILD NEEDS MANUAL CHECK / P1]`**. Pipe and lighter remodeled; weed nuggets still read as crude green balls and need procedural or scanned geometry.
6. **Interaction Order Dependencies (`GH-01`–`GH-03`)**: **`[AUTOMATED VERIFIED / CURRENT BUILD NEEDS MANUAL CHECK]`**. Bag/pipe and bottle/pipe order-dependent behavior addressed in `simulation.js` and `interaction-view.js` with passing unit tests; pending interactive user playtest.
7. **Lighter Grip Ergonomics & Flame Shape (`GH-12`, `GH-13`)**: **`[CURRENT BUILD NEEDS MANUAL CHECK / P1]`**. Lighter orientation flipped to right-hand thumb ergonomics in `props.js`; flame shape needs refinement.
8. **World-Object Label Lag on Camera Swing (`GH-19`, `GH-20`)**: **`[CURRENT BUILD NEEDS MANUAL CHECK / P1]`**. Labels lagged behind props during RMB camera movement. Synchronous tracking and CSS restyling implemented in `9f691e2`; pending user check.

---

### Historical Defects: Pass 2 & Pass 3 [SUPERSEDED HISTORICAL RECORD - PREVIOUS AGENT RESOLUTION CLAIMS]

> [!NOTE]
> The items below were recorded by previous agents as "[RESOLVED]" in historical Passes 2 and 3. While code improvements were made, several (such as streambed, shrub scatter, lighter orientation, and label lag) proved incomplete or regressed upon direct user playtesting. They are preserved here strictly for technical history.

1. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] Foreground Shrub Obstruction**: Enforced strict 3.0m–3.8m camera exclusion bubble, 1.7m–2.6m slab clearance, and stream margin. Foreground is completely clear of intrusive vegetation (though subsequent audit found understory too sparse overall).
2. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] Bottle Compositing Artifacts & Meniscus**: Fixed `surfaceMat` in `Liquid` with 0.28 roughness and 0.06 envMapIntensity. Eliminated floating white specular meniscus disk artifact.
3. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] Stream Artificiality**: Replaced flat straight sheet with organic serpentine stream channel, concave bed, wetted soil vertex colors, and 260 embedded stones. Transparent sorting fixed. (User audit confirmed streambed still needs substantial geometric rework).
4. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] Repetitive Foliage Scatter**: Removed uniform grid stamping of `shrub_04` and `grass_medium_01`. Ecological clustering places ferns along creek banks and deadfall logs; ground plane expanded to 80x80m.
5. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] Lighter Brand Orientation & Flame Shape**: Flipped Clipper lighter 180° around Y; striker wheel, lever, and brand wrap faced player. (User audit noted ergonomic thumb orientation required further adjustment, addressed in GH-12).
6. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] Bottle Hole Framing & Aim**: Centered and elevated bottle during hole creation at (-.03, .04, -.44) with tilted base. (User audit noted heating point remained disconnected/too low).
7. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] UI Label Lag / Latency**: Separated 3D-to-2D screen projection from throttled 80ms `drawUI()`. (User audit observed lag during active RMB camera movement, addressed in GH-19/GH-20).
8. **[SUPERSEDED RESOLUTION CLAIM: PASS 2] Slab Ground Disconnect**: Added 4 procedural bark root tendrils (`TubeGeometry`) wrapping the slab perimeter and anchoring into the terrain; lowered slab to y = -0.055.

### Gameplay Logic Gaps & Continuous Fixes [FIXED BUT REGRESSION-PRONE]
1. **Bottle Pick-up vs Cap Toggle Dual Action**: In `simulation.js`, `action('bottle')` serves as both picking up the bottle and toggling the cap. If the bottle is resting, the first click picks it up (`held = 'bottle'`); subsequent clicks toggle the cap.
2. **Held State Continuity in View/World**: When `sim.mode === 'idle'`, `world.js` lerps objects back to resting slots unless specifically held. Objects stay in held position if `sim.held === id`.

---

## 7. FAILED AND WEAK ATTEMPTS ARCHIVE [HISTORICAL RECORD: FAILED / ABANDONED APPROACHES]

> [!NOTE]
> **HISTORICAL RECORD — PRESERVE AND CONSOLIDATE**: The approaches below were attempted and proven ineffective or flawed in past sessions. They are preserved here so that future agents do NOT repeat these mistakes. Consolidate rather than deleting them.

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

## 8. FIXED BUT REGRESSION-PRONE BUGS [FIXED BUT REGRESSION-PRONE - MANDATORY REGRESSION CHECKS]

> [!WARNING]
> **FIXED BUT REGRESSION-PRONE**: The systems below have been fixed in specific commits, but are structurally sensitive to adjacent refactoring, camera movement, framerate variance, or timing differences. Always execute the specified regression commands before considering a related change complete.

1. **`[FIXED BUT REGRESSION-PRONE]` Lighter Aim Screen Projection Error**: Previously calculated lighter position before camera and held transforms completed, causing jitter. Fixed in `world.js:198-204` by solving nozzle constraint to mouse ray after `scene.updateMatrixWorld(true)`. *Always verify with:* `node scripts/stability.mjs`.
2. **`[FIXED BUT REGRESSION-PRONE]` CSP Blocking Blob Textures**: Electron CSP blocked `blob:` URLs used by GLTF loader workers. Fixed by adding `blob:` to `script-src`, `worker-src`, and `connect-src` in `index.html`. *Always verify with:* packaged Electron launch (`outputs/Stillwater/Stillwater.exe`).
3. **`[FIXED BUT REGRESSION-PRONE]` Audio Drain Leak when Muted**: In `audio.js`, draining water audio was added outside `settings.waterSound` multiplier. Fixed by placing `+(s.flow > 0 ? .2 : 0)` inside multiplier. *Always verify with:* code inspection in `audio.js`.
4. **`[FIXED BUT REGRESSION-PRONE]` Liquid GC Allocation Spike**: In `liquid.js:18`, 1600 `p.clone()` allocations occurred every time bottle tilted > 0.003 rad. Fixed with pre-allocated Float32Array and reusable scratch vector. *Always verify with:* code inspection in `liquid.js`.
5. **`[FIXED BUT REGRESSION-PRONE]` Mid-Inhale Reload Hit Duplication**: Reloading during inhale phase previously allowed infinite hit farming. Fixed in `simulation.js:3` by resetting `bud=water=embers=smoke=0` and clearing phase on startup. *Always verify with:* `node --test tests/recovery.test.mjs`.
6. **`[FIXED BUT REGRESSION-PRONE]` Outlet Drainage Retention**: Water drainage must stop at the physical outlet height (volume ~0.072), not empty completely. Fixed in Torricelli formula: `Math.min(water - 0.072, dt * 0.15 * sqrt(water - 0.072))`. *Always verify with:* `node --test tests/simulation.test.mjs` & `tests/recovery.test.mjs`.
7. **`[FIXED BUT REGRESSION-PRONE]` Stream Filling Prerequisite**: Can only refill if holding the bottle or if idle on slab; held lighter/pipe prevents filling with clear user feedback. *Always verify with:* `node --test tests/simulation.test.mjs` & `tests/gh03.test.mjs`.

---

## 9. IMPORTANT TECHNICAL DECISIONS

- **Procedural Synthesized Audio over Audio Files**: Web Audio API oscillators and brownian noise buffers eliminate audio asset licensing, reduce download size by 50MB, and enable infinite dynamic parameter modulation (wind speed, rain intensity, Doppler aircraft).
- **Physical Torricelli Outflow Model**: Liquid drainage is not a linear timer; it uses $\Delta V = \min(h, \Delta t \cdot k \cdot \sqrt{h})$, accurately matching hydrostatic efflux physics.
- **Monte Carlo Liquid Leveling**: Instead of complex 3D fluid simulation, 1600 pre-sampled internal bottle points sorted by world Y give exact liquid clipping elevation at any 3D tilt angle with negligible CPU cost.
- **Raymarched Headspace Smoke**: Headspace smoke uses a custom 24-step raymarching shader with Beer-Lambert optical depth accumulation and 3D Perlin noise rather than billboard particle sprites.
- **Atomic File Persistence**: Electron save operations write to temporary files (`progress.json.tmp`) before renaming, guaranteeing zero file corruption during power loss or abrupt exit.
- **Spatial Grid Vertex Clustering for Asset Decimation**: Drastically reduced raw scanned asset triangle footprints (shrub_01: 156k -> 17k triangles) with zero loss of silhouette or UV integrity.

---

## 10. COMPLETED MILESTONES & HISTORICAL RECORD

### Historical Record: Major Corrective Overhaul (Pass 3) [SUPERSEDED HISTORICAL RECORD - PASS 3]

> [!NOTE]
> **SUPERSEDED HISTORICAL RECORD**: The items below represent historical Pass 3 milestones. The 19/19 unit test count was the historical Pass 3 suite baseline, superseded by 30/30 (2026-09-09) and currently 49/49 (2026-09-10). Visual "COMPLETED" claims were superseded by the Post-Luna user audit (Graphics grade: A — still prototype).

1. **[HISTORICAL PASS 3] Physical Object Decoupling**: Fixed interaction bug where selecting or interacting with the pipe or lighter moved or picked up the bottle. Decoupled object transforms in `world.js:452-474`; bottle stays grounded on stone slab during preparation, packing, and lighter interactions.
2. **[HISTORICAL PASS 3] Authentic 500mL Thin PET Plastic Bottle**: Replaced glass placeholder with custom-engineered 500mL PET water bottle (`build_bottle.py` -> `bottle.glb`). Features molded stiffening ribs, petalloid base, conical neck, green knurled cap, branded Stillwater label, and heat-deformed carb hole.
3. **[HISTORICAL PASS 3] Borosilicate Chillum Downstem Pipe**: Replaced placeholder with borosilicate chillum (`build_pipe.py` -> `pipe.glb`). Features conical bowl, pinch constriction, black rubber grommet, packed herb mesh, cherry ember, and resin residue accumulation (+0.07 per hit).
4. **[HISTORICAL PASS 3] Shadow Frustum Expansion (120m) & Elimination of Bleached Horizon**: Expanded shadow camera bounds to 120m (`left: -60, right: 60, top: 60, bottom: -60, near: 1, far: 140`) with 4096 shadow map, eliminating bright unshadowed ground boundary.
5. **[HISTORICAL PASS 3] Rich Conifer Loam & Forest Canopy Ambient Occlusion**: Upgraded ground vertex coloring to dark conifer loam (`loam = lerp(0.20, 0.13, canopy)`), darkening naturally under canopy. Tuned sunlight to 1.5 and conifer twilight fog (`#1a241b`, 24m–85m).
6. **[HISTORICAL PASS 3] Dense Multi-Tier Conifer Forest (320+ Trees)**: Replaced sparse 150-tree placement with 320+ pines across 4 radial tiers plus stream-bank rows. Root flares sunk into banks (`-.28 * scale`), dark Scots pine bark (`#34261a`) and evergreen needles (`#243a20`, alphaTest 0.35).
7. **[HISTORICAL PASS 3] Natural Sloping Riverbanks & Bed Gravel**: Softened bank profile (`bankOuter = halfW * 2.6`), removing artificial vertical ditch step. Distributed moss boulders and riverbed gravel.
8. **[HISTORICAL PASS 3] Dense, Diverse Understory (380+ Grass, 20+ Shrub, 20+ Fern Clusters)**: Distributed ferns, shrubs, and grass clumps across stream banks and hollows with slab corridor clearance.
9. **[SUPERSEDED TEST RECORD: PASS 3] Deterministic Playtest & Standalone Production Packaging**:
   - `npm test`: 19/19 unit tests PASS (historical Pass 3 suite; superseded by 49/49 on 2026-09-10).
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

### STREAM-BED-01 — Medium-Stone Creek-Bed Composition Pass (2026-09-13)

- **`[SUPERSEDED]` Earlier 6,613-instance visual status:** The first medium-stone candidate used 1,661 medium stones and 6,613 total instances. It is retained only as historical context; the current corrected-target candidate is the 13,391-instance state documented below.
- **`[SUPERSEDED]` Earlier composition / packing pass:** The first medium-stone density/masking values were subsequently superseded by the denser 13,391-instance corrected-target configuration. The underlying `RiverbedSpatialGrid`, local-normal seating, embedding and refill-feathering architecture remains current.
- **`[SUPERSEDED]` Earlier four-family stone-quality pass:** The four-medium-family scan mapping and its critic correction were replaced by the current 6-cobble / 8-medium / 5-pebble / 3-shingle visual-family architecture documented below.
- **`[SUPERSEDED]` Earlier exact-candidate captures:** The older 14-batch capture set is historical. `work/game/qa/stream-bed-01/` has since been overwritten by the fresh 33-batch corrected-target capture recorded below.
- **`[SUPERSEDED]` Earlier tests / build record:** The 88/88 test result is historical. The current exact edited source passes 91/91 tests and builds successfully, as recorded below.
- **`[SUPERSEDED]` Earlier performance observation:** The old 14-batch / ~14.26M streambed-triangle measurement no longer describes the current multi-family candidate. Use the current 33-batch / ~35.46M triangles-per-color-pass record below.
- **`[AUTOMATED VERIFIED]` Research basis:** The pass used USGS gravel-bed textural-facies work and EPA embeddedness guidance to favor coarse clast-supported patches with fines primarily in interstices/local pockets, plus official Three.js `InstancedMesh`/LOD guidance for batched geometry. The research was advisory; final values were selected against the actual current scene rather than mechanically enforcing a published particle-size percentage.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Corrected-target variety pass (2026-09-13):** Latest user direction supersedes the prior working visual reference and keeps the current packed physical bed while eliminating repeated scan silhouettes. `streambed.js` now preserves the exact deterministic physical counts (33 anchors, 503 cobbles, 5,426 medium, 4,409 pebbles/gap-fill, 1,045 shingle, 1,516 gravel, 459 grit; 13,391 total) and repartitions already accepted placements with dedicated RNGs into 6 cobble, 8 medium, 5 pebble and 3 shingle visual geometry families. All six `rock_moss_set_01` scans participate; the round `source[2]` is restored to both medium and pebble tiers, while tall/blocky `source[3]` is flattened and kept as a minority family. The medium mineral palette now includes restrained warm brown-gray, neutral/cool gray, slate/basalt, occasional pale and mossy families without changing placement RNG sequences. Near medium families retain full-resolution scans and far/pebble/shingle families use the existing matching LODs. Headless `buildStreambed()` runs twice produced identical count and variant distributions; `npm.cmd test` passes 91/91 and `npm.cmd run build` succeeds. No corrected-target QA capture has been generated yet; exact-candidate visual review remains pending prime capture and user/critic inspection.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Corrected-target critic correction (2026-09-13):** A fresh critic pass on the 13,391-instance / 33-batch candidate found the remaining visual mismatch was primarily presentation rather than missing physical packing: center/far clasts collapsed into a dark-green submerged field, warm/neutral/cool geology was not surviving the water response, blocky scan families were over-visible, and the two refill-bank authored rocks still read as pale smooth caps. The bounded correction therefore left every physical placement/count unchanged and changed only render-family/material presentation: cobble, medium, pebble and shingle visual-family partitioning is now weighted toward round/sub-rounded/flat/elongated scans; the blocky source-3 family is a small minority and is flattened further; bed-forming clasts use a dedicated restrained warm/neutral/cool/slate/light/mossy palette; class-1 cobbles now receive the same class-gated submerged-readability treatment as medium/pebble/shingle while anchors remain excluded. `world.js` routes the exact two offending refill-bank authored rocks into separate full-resolution source-0/source-1 batches with darker neutral/warm PBR response while preserving their authored matrices, positions and sizes. Prime re-ran `npm.cmd test` (91/91 PASS) and `npm.cmd run build` (PASS) on this exact source.
- **`[AUTOMATED VERIFIED]` Fresh corrected-target exact-candidate capture (2026-09-13 15:30Z):** `work/game/qa/stream-bed-01/` now contains a new 11/11 valid 1920x1080 medium-quality capture set from RTX 3070 / D3D11 / WebGL2 with no renderer errors, source provenance `9933d056-dirty`. Counts remain 33 anchors, 503 cobbles, 5,426 medium (1,997 near / 3,429 far), 4,409 pebbles, 1,045 shingle, 1,516 gravel, 459 grit, 13,391 total and 33 streambed batches. Weighted current visual-family distributions are cobble `[86,97,100,25,106,89]`, medium `[594,793,586,727,1187,155,851,533]`, pebble `[1048,806,889,954,712]`, shingle `[334,455,256]`. Streambed geometry is ~35.46M triangles per color pass; fresh whole-scene captures range ~101.98M–154.86M triangles and 2,251–4,505 draw calls. Prime inspection confirms the close/refill views reveal a densely packed physical bed more clearly than the pre-correction candidate and retain refill usability/bank geometry; final user visual acceptance is still pending, so this is not `USER VERIFIED CURRENT`.
- **`[SUPERSEDED]` 13,391-instance size hierarchy:** The user's later reference-photo correction explicitly identified the 13,391-instance bed as too fine-biased: 503 true cobbles versus 4,409 pebbles, 1,045 shingle, 1,516 gravel and 459 grit. That physical composition is retained only as historical context. The authoritative target for the latest cycle is the reposted `image(5).png`, and the current candidate is the 9,705-instance composition below.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Reference-photo size-hierarchy cycle (2026-09-13):** After direct reference inspection by the research/implementation workers, `streambed.js` was rebalanced toward the target's hand-sized clast hierarchy while preserving stream course, water, bank geometry and refill gameplay. True cobbles now use deterministic center/riffle-weighted random sampling rather than shoreline-like rows; medium stones have a larger footprint; pebble/shingle/gravel tiers are reduced to interstitial fill. Exact physical counts are 33 anchors, 1,200 cobbles, 4,097 medium (1,643 near / 2,454 far), 2,339 pebbles, 608 shingle, 973 gravel and 455 grit = **9,705 total**. The existing `RiverbedSpatialGrid`, local-normal seating, collision rejection and refill feathering remain the physical packing architecture.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Iteration-3/4 upper-cobble and readability polish:** Without adding physical stones, 400 already-accepted center/far medium placements are deterministically promoted render-side into three rounded/sub-rounded upper-cobble families. Their footprint is increased ~18–28% and height ~8–15%, creating the missing ~14–24 cm secondary population while leaving physical collision/seating/counts unchanged. The outermost true cobbles are rendered slightly lower/smaller and pale edge colors are muted to break the bead-like shoreline. Iteration 4 further increases class-gated underwater mineral/value separation for bed-forming clasts, adds a restrained distance-selective readability floor for center/far coarse clasts, and lifts/mottles wet anchors toward gray-brown/mossy rock without changing the water surface.
- **`[AUTOMATED VERIFIED]` Final exact-candidate verification for the size-hierarchy cycle:** `npm.cmd test` passes **91/91**, `npm.cmd run build` succeeds, and `work/game/qa/stream-bed-01/` contains **11/11 valid** fresh captures with `errors: []`. Current render metadata: 9,705 physical instances, 400 render-side upper-cobble promotions, **41 streambed batches**, ~**38,207,313 streambed triangles per color pass**; whole-scene captures range ~**111.08M–166.69M triangles** and **2,273–4,529 draw calls** at the capture quality. A true pre-cycle comparison set is preserved in `work/game/qa/stream-bed-01-size-rebalance-before/` (views 01, 04 and 07).
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Critic loop final result:** strict reference-photo adherence progressed **6.7/10 (iteration 1 FAIL)** -> **8.1/10 (iteration 2 FAIL)**. Iteration 3 produced conflicting independent scores (**7.4/10 FAIL** primary, **9.0/10 PASS** fallback); iteration 4 again conflicted (**8.6/10 FAIL** primary, **9.4/10 PASS** fallback), so neither fallback pass was treated as robust acceptance. The fifth and final user-authorized critic run on the exact final source scored **8.9/10 FAIL**, missing the required >=9 threshold by 0.1. The final iteration preserved all physical counts/placements/promotions and only added a restrained center/far-only warm/neutral/value lift to submerged coarse clasts. The remaining strict-photo discrepancy is mainly underwater presentation: center/far mineral families still compress somewhat toward green/dark gray versus the reference's clearly legible warm tan/brown + neutral-gray mosaic; pale edge-string regularity remains a secondary issue, and a few anchors remain darker than the target. Size hierarchy, dominant 8–16 cm abundance, visible ~14–24 cm secondary tier, packing, shape diversity, refill usability, bank geometry, water and stream course were judged strong. The user capped the loop at five critic evaluations, so no sixth score should be run unless the user explicitly authorizes another cycle. Status remains `CURRENT BUILD NEEDS MANUAL CHECK`; do not mark `USER VERIFIED CURRENT` until the user manually approves it.
- **`[AUTOMATED VERIFIED]` Final iteration-5 exact-source capture:** After the last center/far underwater readability lift, prime re-ran `npm.cmd test` (**91/91 PASS**), `npm.cmd run build` (**PASS**) and `node scripts/capture-stream-bed-01.mjs` (**11/11 valid**, `errors: []`). Physical composition is unchanged at **9,705** instances: 33 anchors, 1,200 cobbles, 4,097 medium (1,643 near / 2,454 far), 2,339 pebbles, 608 shingle, 973 gravel and 455 grit; 400 medium-far placements remain promoted render-side to the upper-cobble tier. Render metadata remains **41 batches**, ~**38,207,313 streambed triangles per color pass**, ~**111.08M–166.69M whole-scene triangles** and **2,273–4,529 draw calls** in the QA captures. A three-view pre-cycle comparison set is preserved at `work/game/qa/stream-bed-01-size-rebalance-before/`, and the final 11-view set is in `work/game/qa/stream-bed-01/`.

- **`[SUPERSEDED]` Historical `image(5)` critic cap / render-only upper-cobble state:** The 9,705-instance / 400 render-only-promotion / five-critic sequence above is retained as historical evidence only. The user's newer `image(6)` cycle explicitly changed the active critic cap to **three** evaluations and replaced render-only promotions with physically reserved upper-cobbles. Do not use the historical five-round allowance or 400-promotion architecture as current truth.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Authoritative `image(6)` reference cycle (2026-09-13):** Every research, implementation and designated-critic stage directly inspected exact user reference `image(6)` (`file_000000007c448210a16766d4dd8ea7a8`). The current deterministic physical bed is **9,627 instances**: 33 anchors, 1,200 cobbles, 3,853 regular medium (1,614 near / 2,239 far), **166 physically reserved upper-cobbles** with variants `[82,46,38]`, 2,339 pebbles, 608 shingle, 973 gravel and 455 grit. There are **0 render-only upper-cobble promotions** and **41 geometry batches**. `RiverbedSpatialGrid`, physical contact/seating and anti-phasing remain active; bank shape, refill interaction, water and stream course were intentionally preserved.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` `image(6)` rendering/material correction:** The final pass identified two concrete root causes. First, submerged mineral classification was sampling `diffuseColor` inside the map stage **before** Three.js applied instanced `vColor`, so many differently tinted placements were effectively classified as the same neutral family. The shader now reads the actual per-instance color and applies stronger class/distance-gated warm tan/brown, neutral-gray, cool-gray and moss/olive separation while keeping dark stones lower-lift; submerged bed-clast micro/contact AO is relaxed enough to retain more top-facet energy without changing the water itself. Second, runtime raycasts proved the conspicuous refill-side pale blobs were `Streambed Class 1 Refill Hero Anchor 1/2`; those meshes previously used a plain `MeshStandardMaterial` and bypassed the streambed triplanar/micro-normal shader. They now use the same full streambed 4K PBR/triplanar micro-detail path while preserving their accepted placements and full-resolution scan geometry. The previously identified authored refill-bank stones in `world.js` remain on their full-resolution scan-PBR path.
- **`[AUTOMATED VERIFIED]` Final `image(6)` exact-source validation/capture:** Prime independently ran `git diff --check -- src/streambed.js src/world.js` (**PASS**), `npm.cmd test` (**91/91 PASS**) and production Vite build (**PASS**). Fresh runtime capture `work/game/qa/stream-bed-01/` is timestamped **2026-09-13T19:55:19.837Z**, contains **11/11 valid** 1920x1080 medium-quality RTX 3070 / D3D11 / WebGL2 frames, and reports `errors: []`. Whole-scene captures range **106,565,247–161,131,305 triangles** and **2,271–4,529 draw calls**; streambed triangles per color pass remain **36,482,373**. Genuine iteration-2 evidence is preserved at `work/game/qa/stream-bed-01-critic-iter2/`; matched genuine pre/final views are preserved at `work/game/qa/STREAM-BED-01-image6-final-before-after.jpg`.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Final designated-critic result for `image(6)`:** The same designated critic scored the three user-authorized rounds **6.4/10 FAIL -> 6.7/10 FAIL -> 6.8/10 FAIL** against strict **>=9.0/10 PHOTO ADHERENCE**. The third score used the exact `image(6)` reference and all 11 fresh runtime views; the three-round cap is exhausted, so **no fourth score is authorized**. Final residuals remain: (1) critical underwater material/value collapse toward dark green/charcoal with much weaker warm/tan/gray/olive separation than the reference, especially center/far; (2) high-severity pale above-water bank/edge stones still reading smooth/chalky with an abrupt wet/dry material jump; (3) high-severity far stream losing clast texture, mineral variation and relief; (4) medium-high visible geometry/size hierarchy still more angular/repetitive than the reference; and (5) medium packing/coverage still less visibly nested/fine-filled than the reference. Intersections/phasing are acceptable, and bank/refill remain preserved. This build is **not** `USER VERIFIED CURRENT`; human visual acceptance is still required.

- **`[SUPERSEDED]` Restored 9,627-instance `image(6)` baseline:** After the rejected 12,088-instance pastel/smooth branch, the project was restored to the deterministic **9,627** physical baseline preserved in `work/checkpoints/streambed-baseline-9627-20260913-2352` and `work/game/qa/stream-bed-01-baseline-9627-20260913-2351/`. That exact restored state was the starting point for the reference-driven residual-void/material pass below and is no longer the current source.
- **`[SUPERSEDED]` Residual-void packing / native-scan material pass (2026-09-14):** The implementation worker directly re-inspected authoritative `image(6)` plus the restored baseline, user-rejected branch and no-water baseline before editing. `streambed.js` replaced the remaining fixed-z pebble/shingle, near-bank bar, gravel and grit row generators with seeded random **residual-void + facies** sampling. `RiverbedSpatialGrid`, contact-elevation seating, same-tier collision rejection, refill feathering and physical upper-cobble reservations remained active. This intermediate composition was **10,802 instances / 41 batches**: 33 anchors, 1,200 cobbles, 3,853 medium (1,614 near / 2,239 far), 166 physical upper-cobbles, 3,100 pebbles, 700 shingle, 1,150 gravel and 600 grit. It is retained as the scored 5.4/10 -> 5.5/10 stepping stone and is no longer the current source.
- **`[SUPERSEDED]` Native-scan material rebuild / AO-exposure hypothesis:** Three r180 inspection confirmed `MeshPhysicalMaterial` uses `<opaque_fragment>` and the previous `<output_fragment>` post-light compensation never executed. That dead hard-floor block and synthetic post-light bounce were removed; the source `rock_moss_set_01.gltf` was confirmed to contain no `COLOR_0`. Native 4K scan UV albedo/normal/roughness, restrained triplanar detail, satin wet roughness and contact/micro-AO became the active base. A direct `aoMapIntensity=0.40` test did **not** materially improve the no-water diagnostic, and a simple stronger pre-light exposure multiplier likewise only moved strict photo adherence from **5.4/10 to 5.5/10**. Those two hypotheses are therefore historical, not pending next steps.
- **`[SUPERSEDED]` 10,802-instance runtime validation:** On that intermediate source, `npm.cmd test` passed **91/91**, `npm.cmd run build` succeeded, and `node scripts/capture-stream-bed-01.mjs` produced **11/11 valid** runtime captures with `errors: []`. Metadata was **37,656,519 streambed triangles per color pass**, **108,913,539–164,653,743 whole-scene triangles** and **2,271–4,529 draw calls**. The exact pre-final 5.5/10 QA set is preserved at `work/game/qa/stream-bed-01-final-pass-before-5p5-20260913-2233/`.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Final redo correction after critic 2 (2026-09-14):** Prime froze the three-score cap and made one final bounded STREAM-BED-01 edit before Critic 3. Water source, stream course, refill function, anchors, `RiverbedSpatialGrid`, contact/seating and anti-phasing were preserved. In the scan shader, the actual per-instance `vColor` is now read after Three's color multiplication; most tint value loss is compensated with a bounded luminance recovery, and a restrained normalized family carrier is mixed back into the real scan albedo **before lighting** so warm/neutral/cool/moss identity survives without post-light RGB floors. The existing multiplicative scan exposure remains, plus a small albedo-proportional forest-sky indirect diffuse fill (~0.035-0.060, ~0.045 for fines). Residual-only packing targets were increased to **3,800 pebbles, 850 shingle, 1,500 gravel and 800 grit**, with attempts raised to 32,000 / 13,000 / 9,000 respectively; all candidates still pass the existing facies, `residualVoidWeight`, same-tier collision and contact logic. The original authored transition-bank physical/RNG sequence was restored so deterministic coarse counts remain **33 anchors / 1,200 cobbles**; selected transition stones now use smaller render scales only, breaking some visible shoreline continuity without changing their physical footprints.
- **`[AUTOMATED VERIFIED]` Final redo exact-source validation/capture:** The final current bed is **12,202 physical instances / 41 batches**: 33 anchors, 1,200 cobbles, 3,853 medium (1,614 near / 2,239 far), 166 physical upper-cobbles, 3,800 pebbles, 850 shingle, 1,500 gravel and 800 grit; 0 render-only upper promotions. `npm.cmd test` passes **91/91**, production Vite build passes, and `work/game/qa/stream-bed-01/capture.json` records a fresh **11/11 valid** 1920x1080 medium-quality RTX 3070 / D3D11 / WebGL2 set with `errors: []`, timestamp **2026-09-13T22:43:51.650Z** and source `2f513d6e-dirty`. Metadata is **39,055,483 streambed triangles per color pass**, **111,711,467–168,850,635 whole-scene triangles** and **2,271–4,529 draw calls**. A matched redo comparison image is preserved at `work/game/qa/STREAM-BED-01-image6-redo-final-before-after.jpg`.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Final redo critic result / cap exhausted:** The three user-authorized redo critic rounds are now complete: **5.4/10 FAIL -> 5.5/10 FAIL -> 5.8/10 FAIL** against strict **>=9.0/10 PHOTO ADHERENCE**. Critic 3 directly inspected exact authoritative `image(6)` first, then `capture.json` and all 11 fresh current runtime PNGs. Remaining severity-ranked residuals are: (1) **CRITICAL** material/value balance remains too dark olive/charcoal/blue-black versus the reference's clearer warm tan/brown, neutral/cool gray and moss/olive mosaic; (2) **CRITICAL** visible packing still leaves broad continuous pale/gray substrate lanes despite the 12,202 physical instances, whereas the reference is much more tightly nested; (3) **HIGH** both banks still read as a conspicuous near-black stone necklace with an abrupt wet/dry seam; (4) **HIGH** medium geometry remains more angular/repetitive with weaker continuous size hierarchy; (5) **HIGH** far-stream clast/mineral/relief readability collapses into a green-gray/dark ribbon too early; and (6) **MEDIUM** pale/ochre exposed stones remain isolated rather than integrated into the shoreline transition. Refill/bank geometry remains coherent and no major phasing/intersection failure was visible. The three-score cap is **exhausted; do not run a fourth score unless the user explicitly authorizes a new cycle**. This build is **not `USER VERIFIED CURRENT`**.

---

### ATM-01 — Sun Scattering, Glare and Pollen (2026-09-13)

- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Scope and ownership:** Astra selected the architecture, reviewed/integrated the work and performed runtime QA. One Luna Extra High research agent and one Luna Extra High implementation agent were used; a separate Luna Extra High critic reviews the fresh capture set. ATM-01 owns `src/atmosphere.js`, its limited integration in `world.js` and `stream-water.js`, `tests/atm01.test.mjs`, and the three dedicated `scripts/*atm*.mjs` QA scripts. It does not own concurrent STREAM-BED-01 edits to stone placement, materials or geometry.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Architecture:** A bounded 24 m view-ray integration samples the existing directional light's RGBA-packed shadow map, with five local PCF taps and four wider shadow taps to emphasize illuminated canopy gaps. This localized contrast makes broken shafts perceptible without increasing uniform airlight. Shadow-frustum boundary, height and distance fades soften the result. Opaque depth is reused from the custom stream renderer; the atmosphere is added in linear color to the existing final background copy before transparent PET, glass, smoke and pollen. GH-39's final SMAA remains last. There is no additional forest/shadow scene render, static light cone, global fog change, broad relighting or temporal accumulation. A depth-weighted bilinear upsample rejects unrelated foreground depths.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Sun and particles:** The full-resolution sun disc follows the light-to-target direction independently of camera translation, rejects rear-facing/offscreen directions, uses per-pixel opaque depth and a nine-sample sun visibility estimate for the restrained halo. The existing 180 pollen placements and RNG consumption are retained; grains drift independently, respond to shadow visibility, vary in size and are capped at 3.5 pixels to avoid large foreground flecks. Dappled-light perception comes from the existing canopy shadow field interacting with air and pollen, not an extra surface-lighting pass.
- **`[AUTOMATED VERIFIED]` Quality hooks:** Existing quality selection now calls internal atmosphere hooks: Low disables scattering/glare and their depth routing; Medium uses 1/3 linear resolution and 24 steps (640x360 at 1080p); High uses 1/2 resolution and 40 steps (960x540). `world.atmosphere.enabled=false` gives a same-build diagnostic bypass. Low -> High -> Medium transitions rendered without errors in the final QA run. This is not a new complete preset system. High's separate performance cost was not benchmarked.
- **`[AUTOMATED VERIFIED]` Final capture evidence:** `work/game/qa/atm-01/final/` contains 22 valid 1920x1080 runtime captures with `errors: []` and SHA-256 fingerprints for the exact renderer, environment, streambed and protected material sources. Views cover sun through canopy, fully blocked sun, partial exposure, perpendicular view, dense forest, stream, rocky streambed, hero props, held PET/smoke, refill and five slow-camera samples. Seven frozen-frame atmosphere-off controls accompany them. The blocked sun fixture translates the camera to `[-2.5, 2.8, 1]`, where actual scene-depth probes confirmed zero sun visibility; yaw changes alone are not occlusion proof. `qa/atm-01/comparison.html` is the before/after comparison file.
- **`[AUTOMATED VERIFIED]` Tests and interactions:** `npm.cmd test` passes 91/91 and `npm.cmd run build` succeeds. The final `scripts/stability.mjs` run passes all nine 60/30/20 FPS cases: maximum held drift ~1.03e-15 m, cap offset ~5.37e-16 m, label error ~0.01034 px and lighter error ~1.94e-12 px. `scripts/playtest.mjs` passes five real-click/core-ritual/settings/save-reload checks with `errors: []`. These checks do not constitute human visual acceptance.
- **`[AUTOMATED VERIFIED]` Measured Medium cost (2026-09-14 final current source):** `qa/atm-01/benchmark.json` records two off and two on runs of 180 frames per view on RTX 3070 / WebGL2 at 1920x1080. Its source hashes match the final captures and remain stable throughout measurement; errors are empty. Average GPU on/off times: canopy 28.476/28.239 ms; stream 61.628/61.678 ms; rocky bed 57.842/58.092 ms. Paired differences are +0.237, -0.050 and -0.250 ms respectively; negative differences represent run-to-run noise, not a speedup. Every paired view adds exactly one draw and two fullscreen triangles. Current total stream performance is ~16 FPS with either setting; this independent geometry-heavy baseline must not be described as ATM-01 cost. Details are in `performance-summary.json`. Earlier corrected-shader measurements on the prior shared streambed (+0.297/+0.013/+0.478 ms) are retained in `benchmark-corrected-earlier-streambed.json` as `SUPERSEDED` current-build metrics.
- **`[SUPERSEDED]` Rejected attempts and evidence:** The initial candidate's broad greenish airlight washed out canopy detail. Astra reduced density, removed the extra green tint and strengthened the angular preference toward the sun. Review also corrected capped-depth sun detection, inverted texture Y, finite-point parallax, mismatched depth metrics, copied pollen-buffer updates and renderer clear-alpha restoration. An initial capture promotion was rejected when unrelated streambed/world source changed mid-run. A first blocked-sun camera landed inside a shrub and was replaced with the elevated canopy fixture. `candidate-2/` predates the final pollen size cap/blocked fixture; the unpromoted candidate-1 staging folder and `benchmark-earlier-build.json` are not final evidence.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Critic correction and Astra acceptance (2026-09-14):** The critic rejected the first restrained version as visually underdelivered. Astra accepted that finding and introduced the localized canopy-gap shadow contrast described above. The same Luna Extra High critic directly inspected `qa/atm-01/correction/` and accepted the bounded visual fixture gate: perceptible broken shafts, blocked-sun suppression, preserved water/rock detail and no obvious discontinuity across sampled motion endpoints. Astra accepted the correction and then refreshed all 22 captures after unrelated stream renderer/riverbed changes during the pause. The refreshed `final/` set records `d134edd8-dirty`, timestamp `2026-09-13T23:41:29.799Z`, all ten source fingerprints matching at promotion, and zero runtime errors. Astra directly checked all seven requested views plus PET/smoke; no ATM-induced streambed, bank, water or foliage regression was observed in the matched pairs. This remains agent acceptance, not human verification.
- **`[SUPERSEDED]` Evidence retained:** `qa/atm-01/pre-critic-correction/` is the visually weak former final; `correction/` is the critic-accepted shaft correction with an earlier shared streambed. Their measurements and source hashes are historical evidence only. The current accepted capture set is `final/`. The benchmark script now fingerprints its four relevant source files and rejects source changes during measurement.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Concurrent work and limits:** The true pre-ATM `qa/atm-01/baseline/` records the older 6,613-stone scene. STREAM-BED-01 and shallow-water clarity were independently revised during this session and its pause. Use the final same-build off/on pairs to assess atmospheric regression, not cross-version stone differences. ATM-01 did not alter those independent revisions. Protected foliage rendering, edge-quality, props and smoke sources remain unmodified by ATM-01. Slow-camera stills support inspection but cannot establish full interactive freedom from shimmer; the immediate next priority is the human user's live-build visual check.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Research basis:** Local Three.js r180 code was inspected before web research. References: [Three RenderTarget](https://threejs.org/docs/pages/RenderTarget.html), [Three LightShadow](https://threejs.org/docs/pages/LightShadow.html), [GPU Gems 3 light scattering](https://developer.nvidia.com/gpugems/gpugems3/part-ii-light-and-shadows/chapter-13-volumetric-light-scattering-post-process), [NVIDIA physically based volumetric scattering](https://developer.nvidia.com/sites/default/files/akamai/gameworks/downloads/papers/NVVL/Fast_Flexible_Physically-Based_Volumetric_Light_Scattering.pdf), and [Adaptive Volumetric Light and Atmospheric Scattering](https://pmc.ncbi.nlm.nih.gov/articles/PMC7673549/). Color-only radial blur, full-resolution marching, extra shadow scenes and temporal history were rejected for this renderer.

### ATM-01 expansion — user reference direction (2026-09-14)

- **`[USER VERIFIED CURRENT]` Latest user feedback:** The first ATM-01 step looks good toward the sun but delivers only a small part of the desired effect. The user requires richer sunlight through ground-level/understory gaps, subtle glow and illuminated dust across natural camera directions, with no look-dependent switches or artificial cones/layers. The previous agent visual acceptance is insufficient for this expanded target.
- **`[USER VERIFIED CURRENT]` Exact references and concurrent scope:** The user supplied `deep-research-report.md`, a 1424x861 game image and a 2048x1152 target forest image. Exact copies are preserved in `work/game/qa/atm-01/references/`. The report reverses their ordinal labels: dimensions and visible content identify `user-game.png` versus `target-forest.png`. The report is a proposed research/implementation plan, not evidence that all proposed measurements or algorithms were completed. The user explicitly instructed ATM-01 to ignore temporarily white rocks because another agent is constructing them; do not repair or overwrite that task's rock changes.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Architecture decision:** Retain the existing HDR raster/depth/shadow pipeline, add a continuous world-space low aerosol field with near-path integration and a broad phase response, retain opaque occlusion and one solar source, and tune actual sun versus sky fill before optical glare. No full renderer replacement, screen-facing beam geometry, automatic exposure or broad recoloring is selected. Rock construction is excluded from this iteration's visual verdict; source changes to ATM and other protected rendering components remain capture failures.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Expansion implementation:** `src/atmosphere.js` now integrates from a 5 cm clip instead of suppressing the first 3.5 m. A continuous two-octave world-space aerosol field, exponential height falloff, near-biased midpoint samples and a broad HG/isotropic phase response keep short downward and side-facing paths active. The existing directional shadow map supplies trunk/canopy/local foliage occlusion; its canopy-gap contrast concentrates visible radiance. Shared shadow/medium sampling lights 600 deterministic dust particles (180 original positions plus 420 small near-ground grains) in the existing Points draw. Actual solar direction remains unchanged. Clear sun/hemisphere intensity is 3.8/1.05 (morning 2.8/1.05); rain/mist and exposure stay unchanged. The full-resolution solar disc has two restrained analytic glare scales, gated by nine actual disc depth probes. This remains additive single-scattering radiance over the existing scene fog, not full path tracing or a new energy-conserving atmosphere composite.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Internal quality hooks:** Low disables volumetrics; Medium uses 1/3 width and height with 40 samples; High uses 1/2 width and height with 64 samples. Both active qualities have a 24 m maximum path. The pipeline still adds one fullscreen draw/two triangles, reuses opaque depth and the existing shadow map, preserves depth-weighted upsampling and leaves transparent props/smoke plus the final edge pass in their existing order. No complete new preset UI was added.
- **`[SUPERSEDED]` Expansion attempts and QA corrections:** Candidate 2's weak continuous density did not deliver enough ground presence. Candidate 4's stronger open-air response veiled near trunks/canopy; Astra reduced broad direct response and emphasized real light-space gaps in candidate 5, while increasing the occlusion-gated solar halo. Earlier fixes corrected an inverted gap component, a stale pollen noise function name, duplicate noise work and High's mismatched integration distance. Candidate 4's shader comparison was valid but its requested old sun/sky values were overwritten by the per-frame environment update; candidate 5 holds the old values through that update. Native Playwright video startup hung, so motion QA now records the actual WebGL canvas using MediaRecorder. Failed or earlier capture sets and the first-stage genuine before captures remain preserved.
- **`[AUTOMATED VERIFIED]` Expansion validation (2026-09-14):** Current source passes 92/92 unit tests and the production build. `qa/atm-01/expansion-candidate-5/` contains 46 verified runtime captures with zero errors, including 13 current/previous/off viewpoints, PET/smoke, refill and small camera steps. All ten source hashes stayed stable during that capture. Previous comparisons use the prior shader, 180 original particles and old sun/fill on the same frozen current geometry; they are not a reconstructed old whole-build screenshot. `expansion-motion-final/` contains actual continuous camera video, six endpoint captures and source provenance with no errors. Rock work changed between sessions, as explicitly excluded by the user; ATM/environment source hashes agree.
- **`[AUTOMATED VERIFIED]` Expansion performance (2026-09-14):** `expansion-medium.json`, `expansion-high.json` and `expansion-performance.json` record serial ABBA GPU timing at 1920x1080 on RTX 3070, with no errors/source drift. Medium GPU increments: canopy +0.755 ms, stream +0.514 ms, rocky bed +0.285 ms, understory +0.442 ms. High: canopy +1.400 ms, understory +1.566 ms. Every pair adds one draw/two triangles. These are volume/glare toggle costs; the 600 pollen particles remain in both states. Medium total on/off stream rate is 23.66/23.91 FPS, largely the shared scene baseline. One canopy on run had higher variance; do not advertise a fixed sub-millisecond guarantee or reuse first-stage timing as current expansion timing.

- **`[SUPERSEDED]` Expansion candidate 5 and correction history:** The Luna critic rejected candidate 5 because ground/inter-shrub shafts and illuminated dust remained underdelivered. Candidate 6 introduced an explicit artistic canopy-gap gain (3.6, capped 4.25), a tighter .00012 shadow comparison margin and a softer partial-gap response. Astra then added five-tap pollen shadow filtering, raised pollen alpha to .72, and selected clear sun/fill 5.8/.85 after three runtime lighting probes; morning remains 2.8/1.05. The earlier expansion validation/performance paragraphs above describe candidate 5 and are not current final acceptance or current final timing.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Integrated capture rejection (2026-09-14 evening):** Concurrent foliage/environment work changed the canopy and understory during the pause. ATM preserved those edits and did not modify rock construction. A motion run was rejected by source guards when environment.js changed mid-run. After rebuilding, `expansion-current-8/` produced 46 valid captures with stable ten-source fingerprints and no runtime errors; `motion-current-8/` records a continuous actual-canvas orbit. Astra rejected current8 for delivery after direct on/off inspection: additive atmosphere broadly pales shaded trunks and understory (especially views 06/12/13), losing reference contrast. Its partial-sun fixture also needs renewed occlusion verification after canopy changes. The same Luna implementation role is correcting the localized scattering response; the same critic role is reviewing. These artifacts are preserved as rejected evidence, not a final accepted set. QA provenance now also fingerprints the integrated foliage mipmap helper, clutter and loaded dist/index.html.


- **`[CURRENT BUILD NEEDS MANUAL CHECK]` ATM-01 selected version, user-directed acceptance (2026-09-14):** User requested approval of the best available version and no further visual iteration. Astra selected current9, copied all 46 valid matched runtime captures to `work/game/qa/atm-01/expansion-final/`, and updated `expansion-comparison.html`. All 13 source/build fingerprints still match at selection; capture and `motion-current-9/` report no errors. The actual solar depth probes read 100% / 0% / approximately 44% for open, blocked and partial fixtures. This is approval of the selected working version, not a claim of completed human visual playtesting.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Selected correction and ownership:** The same Luna Extra High implementation role restricted the gap source to `smoothstep(.34,.72,gapLight)*pow(gapLight,1.20)`, eliminating broad enhancement from common .25 partial coverage. Artistic gain is 2.4, capped 3.0, with near/far fades; physical extinction .025, albedo .74, 24 m path, 600 particles, five-tap pollen shadow filtering and .72 particle alpha are retained. The tested /4pi phase variant removed useful atmosphere, so the mean-one artistic phase remains; do not describe this as fully energy-conserving path tracing. Low off, Medium 1/3 resolution with 40 samples, High 1/2 with 64. Clear sun/fill remains 5.8/.85. Concurrent foliage/environment changes and rock construction were preserved.
- **`[AUTOMATED VERIFIED]` Selected-source checks:** 92/92 unit tests and production build passed at the final resume. Current9 has 46/46 valid captures and six motion endpoints plus actual camera-orbit video. Earlier stability/playtest checks remain recorded with their original source/time scope. No new paired GPU benchmark for current9 was completed; earlier expansion timing is historical, not current9 effect cost.
- **`[CURRENT BUILD NEEDS MANUAL CHECK]` Critic scope at acceptance:** Luna's candidate8 rejection for pervasive wash is preserved in `expansion-critic-candidate8.md`; Astra accepted that finding and reviewed the subsequent corrected runtime. The full independent current9 critic verdict was still pending when the user requested approval. Do not claim a current9 critic pass. Final selection/provenance and verification limits are recorded in `expansion-acceptance.json` and `.md`. No additional visual edits, commits or changes to other agents' files were made during acceptance.

## 11. IMPORTANT FILE LOCATIONS

- **Project Root**: `c:\Users\domin\Documents\AI\OpenAI\Gravity Hit`
- **Agent Instructions & Status Rules**: `AGENTS.md`
- **Post-Luna Implementation Backlog**: `Gravity_Hit_Final_Post_Luna_Audit_Backlog.md`
- **Persistent Project Memory & Handoff**: `PROJECT_HANDOFF.md`
- **Game Web Source**: `work/game/src/` (`main.js`, `world.js`, `simulation.js`, `liquid.js`, `smoke.js`, `flame.js`, `audio.js`, `style.css`)
- **Electron Shell**: `work/game/desktop.cjs`, `work/game/preload.cjs`
- **Static Assets**: `work/game/public/assets/` (`clipper.glb`, `pine.glb`, `forest.hdr`, `rock_moss_set_01/`, `fern_02/`, `shrub_04/`, `grass_medium_01/`)
- **Blender Source Models**: `work/clipper.blend`, `work/build_hero.py`
- **Automated Tests**: `work/game/tests/` (`simulation.test.mjs`, `recovery.test.mjs`, `picking.test.mjs`, `gh03.test.mjs`, `gh04.test.mjs`, `capture-guard.test.mjs`)
- **Automation Scripts**: `work/game/scripts/playtest.mjs`, `work/game/scripts/benchmark.mjs`, `work/game/scripts/package.mjs`, `work/game/scripts/stability.mjs`, `work/game/scripts/qa-capture.mjs`
- **Critic Reviews & Screenshots**: `work/qa/critic-current/`, `work/qa/critic-round2/`, `work/qa/critic-round1/`
- **Portable Windows Build**: `outputs/Stillwater/Znicz.exe`
