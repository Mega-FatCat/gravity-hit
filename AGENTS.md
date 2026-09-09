# Instructions for AI Coding Agents

Every AI agent working on Stillwater / Gravity Hit must follow these principles:

1. **Read `PROJECT_HANDOFF.md` First**: Before making substantial changes, read `PROJECT_HANDOFF.md` in the project root. It contains the authoritative project intent, physical device mechanics, verification records, critic feedback, and failed attempts.
2. **Inspect Actual Current Files**: Never assume a feature works or is broken based solely on conversational claims. Inspect the current files, run the test suites (`npm test`), and check actual runtime behavior.
3. **Preserve Strong Systems**: The minimalistic UI, HUD styling, Web Audio procedural soundscape, Torricelli drainage physics, and camera/animation direction are established strengths. Do not redesign them simply to match personal stylistic preferences.
4. **Preserve User Intent over Personal Taste**: The user wants an authentic waterfall gravity bong simulation with near-photorealistic forest environment and physical continuity (held objects, stream targeting, logical state consequences).
5. **Verify Important Claims**: If a previous agent claimed a bug was fixed (e.g. lighter jitter, reload recovery, save persistence), verify it yourself using tests (`scripts/stability.mjs`, `scripts/playtest.mjs`, `tests/simulation.test.mjs`).
6. **Record Meaningful Failed Attempts**: If an approach fails or is replaced (especially graphics techniques like flat ground sine waves or identical shrub stamping), record it in `PROJECT_HANDOFF.md` with the specific reasons why it failed, so future agents do not repeat it.
7. **Check Before Redoing**: Before creating new assets or downloading new models, inspect `work/raw`, `work/game/public/assets`, and `work/*.py` to see what already exists.
8. **Update `PROJECT_HANDOFF.md`**: At the end of every substantial working session, update `PROJECT_HANDOFF.md` with your changes, test results, performance numbers, and immediate next priorities.
