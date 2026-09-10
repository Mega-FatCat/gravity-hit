# Instructions for AI Coding Agents

Every AI agent working on Stillwater / Gravity Hit must follow these principles:

1. **Read `PROJECT_HANDOFF.md` First**: Before making substantial changes, read `PROJECT_HANDOFF.md` in the project root. It contains the authoritative project intent, physical device mechanics, verification records, critic feedback, and failed attempts.
2. **Apply Mandatory Status Vocabulary**: Historical claims must NEVER be mistaken for current truth. When documenting, reviewing, or updating tasks, use only these six canonical status categories:
   - `USER VERIFIED CURRENT`: Confirmed working/acceptable directly by the human user in recent manual playtesting or visual critique. Highest authority level. Cannot be overridden by automated passes or agent claims alone.
   - `AUTOMATED VERIFIED`: Verified by automated test suites (`node --test tests/*.test.mjs`, `stability.mjs`, `playtest.mjs`, `benchmark.mjs`). Validates code logic, transforms, or headless interactions, but does NOT constitute human player-visible acceptance.
   - `CURRENT BUILD NEEDS MANUAL CHECK`: A feature, fix, or asset has been modified/staged and may pass automated checks, but has not yet undergone interactive manual verification by the human user.
   - `PREVIOUS AGENT CLAIM`: An assertion made in past agent notes, commit summaries, or handoff checkpoints (e.g. "Release complete", "[RESOLVED] Bottle Hole Framing", "8/10 graphics"). Must be treated with skepticism until independently verified or user-confirmed; never confuse with current truth.
   - `FIXED BUT REGRESSION-PRONE`: Features or fixes verified in specific tests, but historically fragile under camera rotation, framerate variance, timing changes, or adjacent refactoring (e.g. lighter alignment, held-object transforms, label tracking, drainage threshold). Requires mandatory regression checking whenever adjacent code is touched.
   - `SUPERSEDED`: Outdated test metrics (e.g. historical 19/19 or 30/30 unit tests), obsolete passes (Pass 2/3 claims), replaced assets, or deprecated agent claims that have been explicitly superseded by subsequent commits, newer suites (49/49 tests), or latest user feedback. Preserved for context, marked as obsolete.
3. **Respect the Source-of-Truth Hierarchy**:
   1. Latest explicit user feedback (human eyes, manual playtest)
   2. Durable product intent (waterfall gravity bong ritual, photorealistic forest, physical continuity)
   3. Current live behavior observed during interactive execution
   4. Actual current source code and asset files in the repository
   5. Verified automated test suites (`npm test` / `node --test`, `stability.mjs`, etc.)
   6. Project documentation and backlog specifications
   7. Prior agent claims and conversational summaries
   8. Unverified assumptions
4. **Inspect Actual Current Files**: Never assume a feature works or is broken based solely on conversational claims or historical notes. Inspect the current files, run the test suites (`node --test tests/*.test.mjs`), and check actual runtime behavior.
5. **Preserve Strong Systems**: The minimalistic UI, HUD styling, Web Audio procedural soundscape, Torricelli drainage physics, and camera/animation direction are established strengths. Do not redesign them simply to match personal stylistic preferences.
6. **Preserve User Intent over Personal Taste**: The user wants an authentic waterfall gravity bong simulation with near-photorealistic forest environment and physical continuity (held objects, stream targeting, logical state consequences).
7. **Verify Important Claims**: If a previous agent claimed a bug was fixed (e.g. lighter jitter, reload recovery, save persistence), verify it yourself using tests (`scripts/stability.mjs`, `scripts/playtest.mjs`, `tests/*.test.mjs`).
8. **Record Meaningful Failed Attempts & Consolidate History**: If an approach fails or is replaced (especially graphics techniques like flat ground sine waves or identical shrub stamping), record it in `PROJECT_HANDOFF.md` with the specific reasons why it failed, so future agents do not repeat it. Never delete past failures—consolidate and label them `SUPERSEDED` or `HISTORICAL RECORD`.
9. **Check Before Redoing**: Before creating new assets or downloading new models, inspect `work/raw`, `work/game/public/assets`, and `work/*.py` to see what already exists.
10. **Update `PROJECT_HANDOFF.md`**: At the end of every substantial working session, update `PROJECT_HANDOFF.md` with your changes, test results, performance numbers, and immediate next priorities using the standardized status vocabulary.

