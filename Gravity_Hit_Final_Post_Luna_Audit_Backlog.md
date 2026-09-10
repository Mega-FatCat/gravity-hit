# Gravity Hit — Final Post-Luna Audit & Granular Implementation Backlog
## Based on reconstructed 3.0 GB project snapshot + current-agent continuation + latest user playtest/visual feedback

> **Purpose:** copy-ready backlog for future implementation agents. It is deliberately decomposed into small, independently verifiable tasks so each task can be run as a separate prompt and manually checked before the next one.
>
> **Do not treat historical `FIXED`, `PASS`, screenshot generation, or automated tests as player-visible proof.**
>
> Source-of-truth priority:
> 1. latest explicit user feedback,
> 2. durable product intent,
> 3. current live behavior observed by the user,
> 4. actual source / reconstructed snapshot,
> 5. verified tests,
> 6. project docs,
> 7. prior agent claims,
> 8. assumptions.

---

## REMINDER - USE THE INTERNET WHEN WORKING. THIS IS NOT A PUBLIC APP, COPYRIGHTS DON'T MATTER. YOU MAY COPY AS MUCH AS NEEDED TO REACH YOUR GOAL.

# 0. CURRENT STATE SUMMARY

## Overall user-visible state
**Current graphics grade: A — still clearly an obvious prototype.**

The project has improved substantially compared with the earliest builds, especially:
- real 3D terrain relief now exists,
- terrain material is broadly acceptable,
- stream water itself is acceptable,
- object transform jitter is substantially improved,
- label tracking is substantially improved,
- mature tree count is broadly acceptable,
- fog/background atmosphere is acceptable,
- core Day 1 / Day 2 systems and state model are much stronger than before.

However, the scene still fails the intended realism target because the visible world is not yet a coherent natural forest. The dominant problems are now:
- weak / sparse / low-density shrubs and foliage,
- individual bushes have too few leaves and do not occlude enough background,
- mature tree trunks are too thin,
- trunks read as black vertical poles,
- canopy/needles still look strongly 2D/card-like,
- insufficient understory density produces too much empty visible ground,
- terrain lacks enough real meso/micro 3D breakup,
- streambed is extremely weak and reads as a gray flat/low-detail area,
- hero props still fail close inspection,
- weed/bud representation is crude,
- some interaction sequences are still order-dependent instead of world-logic-dependent,
- UI labels/hotbar do not yet match the stronger HUD styling,
- general edge presentation still feels excessively hard / old-game-like.

## What MUST be preserved unless a reproduced problem proves otherwise
- current core simulation causality,
- held/supporting-object architecture,
- current camera-relative stable transform approach,
- true 3D terrain foundation,
- current stream water look as a starting point,
- current fog unless a later change genuinely requires retuning,
- mature tree **count** as a starting point,
- current label **tracking** behavior,
- current jitter improvements,
- UI/HUD direction that already looks good,
- audio architecture,
- save/load architecture,
- Day 1 → Day 2 progression,
- existing 30-test state suite,
- current RTX 3070 Medium performance baseline.

## Things explicitly NOT worth doing now
- do not add more mature trees merely to increase tree count,
- do not rebuild the fog/background from scratch,
- do not redesign label tracking if it is still stable,
- do not rewrite held-object transforms if jitter remains fixed,
- do not overhaul the water shader before the streambed geometry is fixed,
- do not solve the forest by simply increasing fog,
- do not solve terrain by texture/noise only,
- do not solve foliage softness by indiscriminate blur,
- do not prioritize shrub repetition; the user does **not** currently notice repetition — quality and density are much bigger problems.

---

# 1. STANDARD EXECUTION WRAPPER FOR EVERY FUTURE TASK

Use this text at the top of each future implementation prompt:

> Work ONLY on task **[TASK ID]** below.  
> Start from the current live repository, not from this historical snapshot. Read the relevant section of `PROJECT_HANDOFF.md` and the current walkthrough/backlog, then inspect/reproduce the task before editing because another agent may have changed nearby code after this audit.  
> Do not perform a broad rewrite or opportunistically fix unrelated systems.  
> Preserve systems explicitly marked as good.  
> Make the smallest coherent change that reaches the requested player-visible result.  
> For visual tasks, capture the exact required before/after views. For gameplay tasks, perform the exact state/interaction verification listed.  
> Update the task status in the backlog/handoff using canonical categories: **USER VERIFIED CURRENT**, **AUTOMATED VERIFIED**, **CURRENT BUILD NEEDS MANUAL CHECK**, **PREVIOUS AGENT CLAIM**, **FIXED BUT REGRESSION-PRONE**, or **SUPERSEDED**, with evidence.  
> Then STOP.

---

# 2. P0 — GAMEPLAY / INTERACTION LOGIC

## GH-01 — Make pipe + weed-bag acquisition order-independent
**Priority:** P0  
**Size:** SMALL  
**Status:** USER-CONFIRMED CURRENT BUG

### Problem
The first three tested cases behave as intended, but when the player takes the weed bag first and then clicks the pipe, the bag is immediately put down. The interaction depends on pickup order.

### Desired result
- pipe alone → hold pipe only,
- bag alone → hold bag only,
- pipe → bag → both required objects remain logically involved and packing becomes available,
- bag → pipe → same final logical state,
- taking one object must not silently put down another unless the action physically requires it.

### Design principle
If the action is possible in the real scene, the game should allow it regardless of arbitrary scripted sequence. If it is physically impossible, reject it consistently.

### Scope
`simulation.js`, item ownership/supporting-object transitions, pack-mode entry conditions.

### Verification
Test pipe only, bag only, pipe→bag, bag→pipe, both cancel paths, repeated clicks and save/reload with one object held if supported.

---

## GH-02 — Normalize bottle + loaded pipe screw-start state regardless of pickup order
**Priority:** P0  
**Size:** SMALL–MEDIUM  
**Status:** USER-CONFIRMED CURRENT BUG

### Problem
- **pipe → bottle:** objects begin next to each other; when screwing starts, they overlap progressively in a believable way.
- **bottle → pipe:** objects immediately overlap before the player starts screwing.

The screw/unscrew minigame itself can move backward/forward correctly, but its starting pose depends incorrectly on acquisition order.

### Desired result
Both valid acquisition orders converge to the **same pre-screw starting pose**:
- bottle and cap/pipe assembly are near each other,
- they are not already intersecting,
- rotation/advance causes the engagement,
- reversing rotation backs the action out correctly.

### Preserve
Current reversible screw/unscrew control.

### Verification
Capture both acquisition orders before rotation, then at 25%, 50%, 100%, and reverse back to 0%.

---

## GH-03 — Full interaction prerequisite audit using world logic, not scripted order
**Priority:** P0  
**Size:** MEDIUM  
**Status:** REQUIRED SYSTEMIC FOLLOW-UP

### Problem
The remaining pickup-order bugs show that the state machine still contains sequence assumptions.

### Desired result
For each core action, formalize:
**HELD OBJECT(S) + WORLD TARGET + OBJECT STATE + GAME STATE + PHYSICAL PREREQUISITES = VALID ACTION**

The current scripted stage must not be sufficient by itself.

### Scope
Audit only important interactions:
- pipe/bag packing,
- bottle/stream refill,
- cap/pipe preparation,
- bottle + cap/pipe screw/unscrew,
- lighter heating,
- hole interaction,
- drainage,
- final hit.

### Verification
Create a compact valid/invalid prerequisite matrix and test unusual orders. No softlocks, silent object drops, magical teleports, or hidden state corrections.

### Dependencies
GH-01 and GH-02 first.

---

## GH-04 — Rebuild smoke-fill response curve
**Priority:** P0  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED CURRENT BAD FEEL

### Problem
Current smoke behavior is badly balanced:
- smoke appears/fills too abruptly at first,
- then becomes extremely slow,
- overall response does not feel physically continuous.

### Desired result
- initial smoke begins visibly but not explosively,
- generation ramps with actual ember/heat + drain-driven airflow,
- middle of fill remains responsive,
- late fill naturally slows as headspace decreases,
- no sudden “jump then crawl” behavior.

### Preserve
- no contents → no normal smoke,
- no water/drain airflow → no normal suction fill,
- covered bottom hole → no drain displacement.

### Verification
Time and visually inspect normal heating, weak heating, strong heating, and early/mid/late drainage. Record smoke amount at several evenly spaced timestamps or frames.

---

## GH-05 — Increase visible smoke density/intensity separately from smoke rate
**Priority:** P0  
**Size:** SMALL  
**Status:** USER-CONFIRMED CURRENT ISSUE

### Problem
Even aside from rate, bottle smoke is currently too faint/low-intensity.

### Desired result
More readable smoke volume inside the bottle without turning it into a flat white/milky blob.

### Scope
Smoke material opacity/scattering/color/compositing after GH-04 defines correct simulation amount.

### Verification
Compare 25%, 50%, 75% and near-full smoke under normal gameplay lighting.

### Dependencies
GH-04 first.

---

## GH-06 — Add intentional standalone lighter use
**Priority:** P0  
**Size:** SMALL–MEDIUM  
**Status:** NEW USER REQUIREMENT

### Problem
The player wants to be able to use/ignite the lighter when holding only the lighter, not only as part of scripted heating interactions.

### Desired result
When the lighter is held alone:
- normal lighter control can ignite/extinguish it,
- flame originates at the nozzle,
- no unrelated game stage is advanced,
- no pipe/bottle action is triggered without a valid target/prerequisite.

### Preserve
Current game-specific heating mechanics.

### Verification
Hold lighter alone, ignite, extinguish, rotate camera, pick another item, enter heating, leave heating, and verify no state corruption.

---

## GH-07 — Refine refill bottle pose to a more natural fill angle
**Priority:** P0  
**Size:** SMALL  
**Status:** USER-CONFIRMED PARTIAL

### Problem
Current refill pose is much better, but the bottle should be more clearly angled as if filling: top higher, bottom lower, mouth plausibly meeting the water.

### Desired result
A visibly natural fill pose rather than a nearly flat/floating presentation.

### Preserve
Bottle remains held before/during/after refill.

### Verification
Player-camera screenshots before touching stream, initial immersion, mid-fill and full bottle immediately after fill.

---

## GH-08 — Final adversarial state-continuity regression pass
**Priority:** P0  
**Size:** MEDIUM  
**Status:** REGRESSION PROTECTION

### Problem
Historically interactions regressed through object teleporting, wrong ownership, detached hotspots, wrong-order softlocks and multi-object pickup.

### Verification
For each major interaction: cancel, reverse where possible, spam clicks, wrong target, wrong item, camera movement, repeated pickup/drop, re-enter interaction, save/reload where supported. Fix only reproduced failures.

---

# 3. P1 — HERO PROPS / CLOSE-RANGE OBJECTS

## GH-09 — Remodel the glass pipe to the supplied real-world reference
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED CURRENTLY POOR

### Problem
The latest pipe is smaller than before but still visually weak and does not convincingly match the supplied reference / common slim glass pipe sold in Polish shops.

### Desired result
- slim narrow glass tube,
- modest bowl section,
- believable proportions,
- clean simple silhouette,
- believable wall thickness,
- correct scale next to lighter/bottle,
- readable from normal gameplay distance,
- no giant vertical transparent rod look.

### Scope
Geometry + interaction anchors that must follow the geometry.

### Verification
Front, side, bowl, mouthpiece, bottom, slab, held and installed-on-cap views.

---

## GH-10 — Rebuild pipe glass material for stronger transparency + realistic edge readability
**Priority:** P1  
**Size:** SMALL–MEDIUM  
**Status:** USER-CONFIRMED CURRENTLY POOR

### Desired result
- clear borosilicate look,
- thin but visible Fresnel/edge highlights,
- correct refraction/roughness balance,
- no frosted/plastic look,
- no disappearance against vegetation.

### Verification
Inspect against dark trunk, bright sky, forest ground and normal held background.

### Dependencies
GH-09.

---

## GH-11 — Implement progressive pipe dirtying/residue over repeated use
**Priority:** P1  
**Size:** SMALL–MEDIUM  
**Status:** USER REQUIREMENT / QUALITY PASS

### Desired result
Fresh pipe is mostly clean transparent glass. Repeated use progressively adds brown/black residue, strongest near bowl/hot path, gradual rather than binary, never uniformly opaque.

### Verification
Capture fresh / early / mid / late-use states.

### Dependencies
GH-09, GH-10.

---

## GH-12 — Fix lighter flint/wheel/lever/nozzle assembly alignment
**Priority:** P1  
**Size:** SMALL  
**Status:** USER-CONFIRMED CURRENT BUG

### Problem
The flint/striker area still does not physically line up.

### Desired result
Wheel, spindle, flint, lever and nozzle read as one mechanically plausible lighter top assembly.

### Verification
Macro front / left / right / top / tilted close-ups.

---

## GH-13 — Reorient held lighter side-on instead of front-facing
**Priority:** P1  
**Size:** SMALL  
**Status:** USER-CONFIRMED CURRENT ISSUE

### Problem
Rotation behavior itself is now okay, but the lighter's baseline held orientation is wrong. It should present more side-on to the camera, not front-on.

### Desired result
- lighter remains on screen-right,
- body starts side-on,
- current local-axis rotation behavior is preserved around the corrected baseline,
- interaction/heating poses remain coherent.

### Verification
Standalone-held + heating-held views, plus local-axis rotation test.

### Dependencies
GH-12 recommended first.

---

## GH-14 — Make PET bottle visually read as thin plastic, not glass
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED CURRENT ISSUE

### Desired result
Thin disposable PET cues:
- molded ribs,
- seam / mold detail,
- subtle deformation,
- plastic-specific highlight response,
- less optically perfect shell,
- credible cap/neck relationship,
- label that feels attached to flexible plastic.

### Verification
Empty/full/back/bottom/tilted/held close-ups.

---

## GH-15 — Improve weed/bud model used in loading minigame
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED CURRENTLY VERY WEAK

### Problem
The loading minigame is acceptable, but the weed itself looks like a simple green ball.

### Desired result
A small realistic botanical bud asset with irregular clustered form, layered surface, mixed green/brown detail, non-spherical silhouette, believable small scale, and good readability without oversizing it.

### Scope
Visual asset first; do not redesign minigame logic unless needed.

### Verification
Close-up on slab/bag + during drag/loading + loaded bowl.

---

## GH-16 — Improve bag contents / weed presentation
**Priority:** P1  
**Size:** SMALL–MEDIUM  
**Status:** VISUAL QUALITY FOLLOW-UP

### Desired result
- irregular contents,
- believable bag film folds,
- physically plausible packing,
- no obvious duplicated green-ball pattern.

### Dependencies
GH-15.

---

## GH-17 — Upgrade work stone texture/material resolution
**Priority:** P1  
**Size:** SMALL–MEDIUM  
**Status:** USER-CONFIRMED REQUEST

### Desired result
Higher texel density, believable micro-normal/roughness and no blurry stretched region near props.

---

## GH-18 — Re-layout resting props so they look physically stable on the sloped stone
**Priority:** P1  
**Size:** SMALL  
**Status:** USER-CONFIRMED CURRENT ISSUE

### Problem
Some resting objects are placed at angles/positions where they look as though they should slide or fall.

### Desired result
Respect local surface normal, center of mass, contact, gravity and stable resting placement.

### Verification
Full starting scene + side/oblique view of every prop contact.

---

# 4. P1 — UI / PRESENTATION

## GH-19 — Restyle world labels to the cleaner transparent HUD visual language
**Priority:** P1  
**Size:** SMALL–MEDIUM  
**Status:** USER-CONFIRMED CURRENT DESIGN ISSUE

### Problem
Label tracking is now good, but label styling still looks “meh.”

### Desired result
Use the stronger right-side water/state HUD as reference:
- translucent panel,
- cleaner minimalist typography,
- softer border,
- less opaque blockiness,
- clearer hierarchy,
- consistent padding/radius.

### Preserve
Current per-frame label tracking logic.

---

## GH-20 — Restyle hotbar buttons 1–5 to match the same UI system
**Priority:** P1  
**Size:** SMALL

### Desired result
Shared transparency, radius, border treatment, typography, icon hierarchy and hover/active states with GH-19 and the right-side HUD.

### Dependencies
GH-19.

---

# 5. P1 — FOREST STRUCTURE / TREES

## GH-21 — Thicken mature tree trunks independently from canopy width
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED HIGH-IMPACT PROBLEM

### Problem
Tree quantity is broadly good, but mature trunks are much too thin.

### Desired result
- substantially thicker mature trunks,
- preserve thinner young/sapling trunks,
- do not simply scale whole trees in X/Z and make canopy too wide,
- introduce believable diameter/age variation.

### Verification
Forward / side / rear / midground screenshots.

---

## GH-22 — Add trunk diameter/age variation and occasional larger foreground trees
**Priority:** P1  
**Size:** SMALL–MEDIUM

### Desired result
Mix young thin trunks, medium trees, mature thick trees and several clearly substantial foreground/midground trunks.

### Dependencies
GH-21.

---

## GH-23 — Fix black-pole trunk material/lighting response
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED CURRENT ISSUE

### Desired result
Visible bark color/detail, readable shadow-side texture, less crushed blacks, believable rough bark response, while retaining the dark forest mood.

### Scope
Bark material, normals/roughness, direct/ambient balance, shadow bias if relevant.

### Preserve
Current fog/background feel.

---

## GH-24 — Replace / rebuild 2D-looking pine canopy and needle presentation
**Priority:** P1  
**Size:** LARGE — split if needed  
**Status:** USER-CONFIRMED “TRAGEDY 2D”

### Desired result
A denser, more volumetric pine branch/needle structure:
- layered branch depth,
- less obvious flat card silhouette,
- better edge breakup against sky,
- believable cluster thickness,
- sensible LOD strategy.

### Split if needed
- GH-24A near/mid branch volume,
- GH-24B needle/alpha material quality,
- GH-24C distant canopy LOD.

---

# 6. P1 — SHRUBS / UNDERSTORY / FOREST DENSITY

## GH-25 — Rebuild individual shrub foliage density
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED MAJOR PROBLEM

### Problem
Current shrubs are themselves weak: too few leaves per bush, too much empty space inside each plant, low occlusion.

### Desired result
Significantly denser leaf mass, more overlapping leaf layers, believable branch support, less skeletal appearance and more visual occlusion.

### Critical note
This is **not** “spawn more shrubs.” Improve the plant asset first.

---

## GH-26 — Improve leaf geometry/material quality on shrubs
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED MAJOR PROBLEM

### Desired result
Better leaf shape/orientation, better normals, less flat-card appearance, cleaner alpha edges and believable translucency/backlighting where affordable.

---

## GH-27 — Greatly increase shrub and understory instance density
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED MAJOR PROBLEM

### Problem
The forest has far too few shrubs/understory plants. Large areas of ground remain visible, preventing the desired deep-forest effect.

### Desired result
Significantly denser shrubs, low bushes, ferns, saplings and ground plants while maintaining the interaction clearing and stream access.

### Preserve
Mature tree count; do not fix density by adding many more mature trees.

### Dependencies
GH-25 and GH-26 first so density does not multiply weak assets.

---

## GH-28 — Increase within-plant leaf coverage / occlusion, not just plant count
**Priority:** P1  
**Size:** SMALL–MEDIUM

### Problem
The user specifically wants leaves themselves to cover more background, not only more shrubs in the scene.

### Desired result
From player height, shrub/young-tree leaf masses form overlapping visual screens with natural gaps rather than skeletal branches.

### Dependencies
GH-25 / GH-26.

---

## GH-29 — Strengthen foreground → understory → sapling → young-tree layering
**Priority:** P1  
**Size:** MEDIUM

### Desired result
Clear ecological progression:
ground plants → ferns/shrubs → saplings → young trees → mature trunks → distant canopy.

### Preserve
Current fog/background because the user reports it is broadly okay.

### Dependencies
GH-21–GH-28.

---

## GH-30 — Fill remaining midground empty-ground belts
**Priority:** P1  
**Size:** SMALL–MEDIUM  
**Status:** USER-CONFIRMED CURRENT ISSUE

### Desired result
Use shrubs/ferns/saplings/deadwood/terrain breakup to remove the “empty floor before forest” look.

### Dependencies
GH-27 / GH-29.

---

## GH-31 — Secondary vegetation/species diversity pass
**Priority:** P2  
**Size:** MEDIUM  
**Status:** LOWER PRIORITY THAN DENSITY/QUALITY

### Note
The user does not currently notice obvious repetition, so repetition itself is not the major blocker. Do this after GH-25–GH-30.

---

# 7. P1 — TERRAIN / FOREST FLOOR

## GH-32 — Add stronger real 3D meso-shape to terrain surface
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED CURRENT ISSUE

### Problem
Terrain texture works well and broad terrain shape is much better, but the physical surface still lacks enough 3D breakup.

### Desired result
More actual geometry: small rises/depressions, exposed root ridges, erosion lips, embedded stones, disturbed earth and natural irregularities.

### Preserve
Current macro terrain foundation and material.

---

## GH-33 — Add forest-floor sticks, twigs, small stones and dead material
**Priority:** P1  
**Size:** SMALL–MEDIUM

### Desired result
Natural low-cost geometry/instancing for sticks, broken twigs, bark fragments, small rocks, leaf piles and other forest debris.

### Dependencies
GH-32.

---

## GH-34 — Improve contact/embedding of terrain details
**Priority:** P1  
**Size:** SMALL

### Desired result
Partial embedding, orientation to terrain normal, contact shadows and credible intersections.

### Dependencies
GH-32 / GH-33.

---

# 8. P1 — STREAM / STREAMBED

## GH-35 — Rebuild the streambed as heavily 3D gravel/stone terrain
**Priority:** P1  
**Size:** LARGE but focused  
**Status:** USER-CONFIRMED “AWFUL / GRAY BLOB”

### Problem
The water itself is acceptable, but the stream floor is one of the worst-looking areas. It reads as a gray flat/low-detail patch.

### Desired result
A physically modeled shallow streambed with:
- dense gravel layer,
- pebbles of several sizes,
- partially buried stones,
- larger anchor rocks,
- sediment pockets,
- uneven depth,
- visible bed relief,
- variation in rock orientation and burial,
- no flat gray sheet appearance.

### Important
Do **not** solve this with only a shader or texture. Strong 3D is required.

---

## GH-36 — Add streambed material variation after geometry exists
**Priority:** P1  
**Size:** MEDIUM

### Desired result
Natural mix of gray/brown stones, wet dark sediment, lighter gravel, restrained moss/algae and leaf/debris accumulation.

### Dependencies
GH-35.

---

## GH-37 — Improve bank / streambed physical integration
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER SAYS BROAD TERRAIN TRANSITION IS OK

### Desired result
Embedded stones crossing wet/dry boundary, eroded pockets, damp soil, roots/debris near banks and no obvious mesh boundary.

### Preserve
Current overall bank shape if it already looks good.

### Dependencies
GH-35 / GH-36.

---

## GH-38 — Preserve current water look while integrating it with the new streambed
**Priority:** P1  
**Size:** SMALL–MEDIUM

### Problem
The user says the **water itself is good**. A bed rebuild must not break it.

### Desired result
Retain current water quality while ensuring correct depth transparency, bed readability and natural integration.

### Do not
Do not start a fresh water-shader overhaul unless the new bed exposes a specific defect.

### Dependencies
GH-35–GH-37.

---

# 9. P1 — RENDERING / EDGE QUALITY

## GH-39 — Root-cause pass for overly hard / old-game-looking edges
**Priority:** P1  
**Size:** MEDIUM  
**Status:** USER-CONFIRMED CURRENT ISSUE, IMPROVING BUT NOT SOLVED

### Diagnose separately
- opaque geometry MSAA quality,
- render scale / DPR,
- normals and bevels,
- hard silhouette geometry,
- specular aliasing,
- shadow edge contrast,
- local contrast / black trunks,
- post sharpening,
- foliage alpha behavior.

### Desired result
Natural edge integration while remaining detailed and crisp.

### Do not
No global blur, heavy DOF, excessive fog or indiscriminate alpha-threshold lowering.

### Verification
100% pixel-scale before/after for trunk against sky, rocks, bottle/pipe, ground geometry and stream edge.

---

## GH-40 — Foliage-specific edge / alpha / temporal stability pass
**Priority:** P1  
**Size:** MEDIUM

### Desired result
Improve alpha maps, alpha-to-coverage, mipmaps, filtering, foliage LOD alpha behavior, leaf normals and edge stability.

### Preserve
The user currently reports motion shimmer is broadly okay, so do not introduce blur to fix a problem that is not present.

### Dependencies
GH-24, GH-25, GH-26 should inform the final technique.

---

# 10. P2 — TECHNICAL / PERFORMANCE / ARCHITECTURE

## GH-41 — Profile and fix unnecessary per-frame shadow refresh if confirmed
**Priority:** P2  
**Size:** SMALL–MEDIUM  
**Status:** CODE-CONFIRMED PERFORMANCE SMELL, PROFILE BEFORE CHANGE

### Problem
Medium quality appears configured with `shadowMap.autoUpdate = false`, but render logic still marks `shadowMap.needsUpdate = true` every frame.

### Desired result
Refresh expensive static-world shadows only when needed while preserving correct moving-prop/light shadows.

---

## GH-42 — Remove per-frame water-jet geometry recreation if profiler shows churn
**Priority:** P2  
**Size:** MEDIUM  
**Status:** CODE-CONFIRMED PERFORMANCE SMELL

### Problem
Water jet geometry is disposed and recreated repeatedly during flow.

### Desired result
Reuse/update geometry or use a cheaper deformable representation if profiling shows measurable cost.

---

## GH-43 — Document / reduce hero-prop runtime representation ambiguity
**Priority:** P2  
**Size:** MEDIUM  
**Status:** ARCHITECTURAL REGRESSION RISK

### Problem
Hero props can pass through multiple representations:
fallback → GLB load → runtime `upgradeHeroProps()` rebuild/correction.

### Desired result
At minimum document final runtime ownership and mark unused/superseded models. Simplify only if safe.

---

## GH-44 — Add QA capture provenance and render-validity guard
**Priority:** P2  
**Size:** SMALL–MEDIUM  
**Status:** CONFIRMED QA PIPELINE WEAKNESS

### Problem
A screenshot set can exist even when the WebGL scene did not actually render correctly; a later capture reported `triangles: 0 / calls: 0`.

### Desired result
Every QA capture set records build/source identifier, timestamp, renderer info, triangles, draw calls, resolution and quality preset, and FAILS on implausibly zero scene draw stats.

---

## GH-45 — Keep walkthrough/handoff current-state and historical claims separated
**Priority:** P2  
**Size:** SMALL  
**Status:** AUTOMATED VERIFIED & DOCUMENTATION STANDARDIZED (CURRENT BUILD NEEDS MANUAL CHECK)

### Desired result
Clear status vocabulary:
- **USER VERIFIED CURRENT**: Directly confirmed by human user in interactive playtest or visual critique. Highest authority level; cannot be overridden by automated passes or agent claims alone.
- **AUTOMATED VERIFIED**: Proven by test suites (`node --test tests/*.test.mjs`, `stability.mjs`, `playtest.mjs`, `benchmark.mjs`). Validates code logic/invariants, but does NOT substitute for player-visible acceptance.
- **CURRENT BUILD NEEDS MANUAL CHECK**: Implemented in code/assets, passed automated gates, but pending human visual/interactive acceptance.
- **PREVIOUS AGENT CLAIM**: Assertions made in earlier agent reports, commit summaries, or checkpoints (e.g. "Release complete", "[RESOLVED] Bottle Hole Framing", "8/10 graphics"). Must be treated with skepticism until independently reproduced or user-confirmed; never confused with current truth.
- **FIXED BUT REGRESSION-PRONE**: Historically fragile features (lighter alignment, held-object transforms, label tracking, drainage threshold). Requires mandatory regression verification whenever related code changes.
- **SUPERSEDED**: Outdated metrics (e.g. historical 19/19 or 30/30 unit tests), obsolete passes, or contradicted earlier claims. Preserved for context and post-mortem analysis, marked as inactive.

### Implementation
- Added foundational Section 0 to `PROJECT_HANDOFF.md` establishing the 6 canonical categories and the 8-tier source-of-truth priority.
- Audited `PROJECT_HANDOFF.md`: categorized all verification matrices, bug lists, and historical sessions with explicit status tags.
- Re-framed historical "release complete" claims and Pass 2/Pass 3 "[RESOLVED]" sections as `[PREVIOUS AGENT CLAIM - SUPERSEDED]`.
- Updated `AGENTS.md` with strict rules requiring future agents to use this status vocabulary and respect the source-of-truth hierarchy.
- Recorded recent implementation phases (49/49 tests passing) while categorizing them as `[AUTOMATED VERIFIED: CURRENT BUILD NEEDS MANUAL CHECK]`.

---

# 11. P2 — FINAL REGRESSION / RELEASE

## GH-46 — Full player-input gameplay acceptance pass
**Priority:** P2  
**Size:** MEDIUM

### Required coverage
- clean start,
- pipe/bag both acquisition orders,
- individual pickup/drop,
- wrong target,
- refill,
- bottle remains held,
- pack/load/spill,
- heat,
- cap/pipe prep,
- screw/unscrew both acquisition orders,
- drainage/smoke,
- final hit,
- repeated cycles,
- Day 1 depletion,
- sleep,
- Day 2 automatic state,
- tutorial,
- settings,
- save/load,
- rapid clicks,
- camera movement.

### Acceptance
No multi-pickup, teleport, hidden ownership changes, softlocks, detached hotspots or impossible states.

---

## GH-47 — 360° environment acceptance set
**Priority:** P2  
**Size:** SMALL

### Required captures
forward, left, far-left, right, far-right, rear, ground, canopy, midground, stream-along, stream-across.

### Acceptance
No view is dominated by empty belt, weak shrub cards, black-pole trunks, 2D canopy, gray streambed, obvious scene boundary or major flat terrain patch.

---

## GH-48 — Multi-angle hero prop acceptance set
**Priority:** P2  
**Size:** SMALL

### Required
Bottle: empty/full/smoke/tilts/bottom/back.  
Pipe: front/side/bowl/mouth/bottom/residue/held/installed.  
Lighter: front/side/back/top/bottom/tilted/standalone-lit/heating.  
Weed: bag/individual nug/drag/loaded bowl.

---

## GH-49 — Final Medium 1080p RTX 3070 performance re-budget
**Priority:** P2  
**Size:** MEDIUM

### Target
Approximately 60 FPS or better on Medium 1080p RTX 3070-class hardware.

### Report
Average FPS, p95 frame time, worst representative view, draw calls, triangles and major GPU/CPU bottlenecks.

### Optimization order
1. distant/small vegetation,
2. LOD/culling,
3. instancing/batching,
4. shadow update strategy,
5. texture/material cost,
6. only then sacrifice visible quality.

Do not downgrade hero props first.

---

## GH-50 — Clean portable build acceptance
**Priority:** P2  
**Size:** MEDIUM

### Required
Current packaged Windows portable executable:
- clean launch,
- no stale save,
- no missing assets,
- no external dependency surprises,
- full Day 1 → Day 2 path,
- save/quit/reload,
- no runtime errors,
- same visuals/performance as verified build.

---

# 12. RECOMMENDED EXECUTION ORDER

## Phase A — eliminate remaining interaction contradictions
1. GH-01 bag/pipe order independence
2. GH-02 screw-start pose order independence
3. GH-03 interaction prerequisite audit
4. GH-04 smoke response curve
5. GH-05 smoke visual density
6. GH-06 standalone lighter
7. GH-07 refill angle
8. GH-08 adversarial regression

## Phase B — finish close-range hero assets
9. GH-09 → GH-11 pipe geometry, glass, progressive residue
10. GH-12 → GH-13 lighter mechanism + orientation
11. GH-14 PET bottle
12. GH-15 → GH-16 realistic weed/bag contents
13. GH-17 → GH-18 work stone fidelity + physical prop placement
14. GH-19 → GH-20 labels/hotbar UI

## Phase C — fix forest structure
15. GH-21 → GH-23 trunks: thickness, variation, black-pole material
16. GH-24 canopy/needles
17. GH-25 → GH-28 shrub/leaf asset quality + occlusion
18. GH-27 → GH-30 much denser understory and depth layering
19. GH-31 secondary species diversity only after the above

## Phase D — fix ground and creek
20. GH-32 → GH-34 real terrain/forest-floor 3D detail
21. GH-35 → GH-38 streambed geometry → materials → bank integration → preserve water

## Phase E — rendering integration
22. GH-39 general hard-edge diagnosis
23. GH-40 foliage-specific edge quality

## Phase F — technical cleanup + acceptance
24. GH-41 → GH-45 performance/QA/documentation technical issues
25. GH-46 → GH-48 gameplay + visual acceptance
26. GH-49 final performance
27. GH-50 portable build acceptance

---

# 13. MANUAL GATES

### Gate 1 — Interactions
After GH-01–GH-08 verify:
- pipe→bag == bag→pipe,
- bottle→pipe == pipe→bottle pre-screw pose,
- smoke no longer jumps then crawls,
- standalone lighter works,
- refill angle looks natural.

### Gate 2 — Hero props
After GH-09–GH-18 verify:
- pipe finally resembles the supplied reference,
- pipe glass is clear and dirt progression believable,
- flint/wheel correct,
- lighter side-on,
- bottle reads PET,
- weed no longer green balls,
- props rest physically on stone.

### Gate 3 — Forest
After GH-21–GH-31 verify:
- mature trunks visibly thicker,
- trunks no longer black poles,
- canopy no longer 2D,
- individual shrubs have much denser leaves,
- there are vastly more shrubs/understory plants,
- leaves themselves occlude more,
- empty ground belts mostly disappear,
- mature tree count has not been needlessly increased,
- depth now reads as real forest.

### Gate 4 — Ground + stream
After GH-32–GH-38 verify:
- ground has obvious real 3D breakup,
- sticks/rocks/debris integrate naturally,
- streambed is a dense 3D gravel/rock bed instead of gray blob,
- water remains as good or better than before.

### Gate 5 — Rendering
After GH-39–GH-40 verify:
- edges are naturally integrated,
- scene is still crisp,
- no global blur/fog cheat,
- foliage does not look like harsh alpha cards,
- motion remains stable.

### Gate 6 — Final acceptance
After GH-46–GH-50 verify:
- full gameplay works,
- all directions look acceptable,
- all props hold up close,
- RTX 3070 Medium target still met,
- packaged executable is clean.

---

# 14. GLOBAL FAILURE MODES TO AVOID

- Do not add “more graphics” without identifying which visual layer is weak.
- Do not replace a good macro terrain with another broad procedural experiment.
- Do not increase mature tree count when tree count is already fine.
- Do not fix thin trunks by scaling entire trees and making canopy too wide.
- Do not add more bad shrubs before rebuilding shrub leaf density/quality.
- Do not treat visible repetition as the primary vegetation problem; it currently is not.
- Do not use fog to hide missing understory.
- Do not use blur to hide hard silhouettes.
- Do not use only texture/noise to fake 3D terrain.
- Do not use only water shader work to fix a bad streambed.
- Do not over-polish an obsolete runtime model that is replaced by `upgradeHeroProps()`.
- Do not claim screenshots are valid merely because files were written.
- Do not accept automated PASS as player-visible PASS.
- Do not rewrite working UI/audio/state foundations without a reproduced reason.
- Do not batch five visual systems into one Flash prompt; one task = one focused change + verification.

---

# 15. FINAL PRODUCT BAR

The project should no longer read as:
> “small clearing + gameplay props + procedural forest assets + fog backdrop.”

It should read as:
> “a convincing first-person woodland location with a physically continuous forest floor, dense layered understory, substantial trees, believable canopy depth, a genuinely rocky/gravelly shallow stream, and close-range props that survive inspection.”

The current build has a visible direction toward that target, but the user rates it **A — still obvious prototype**.
The next stage should therefore prioritize **visible world quality per focused task**, while preserving the now-stronger interaction/state foundations and current performance discipline.
