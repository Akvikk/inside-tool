# Handoff: Roulette Tool Refactoring & Stabilization Prompt

**Context:** You are working on a high-end roulette analytics tool. The core file `app.js` has grown to 4,700 lines and is becoming unstable. Recent refactoring to isolate AI logic has caused regressions in data input and UI components (especially the Analytics HUD).

**Objective:** Modularize the codebase into a clean folder structure, restore broken features, and fix existing bugs.

### Current Problems
1. **Broken Data Input**: The `addSpin` and `enqueueSpin` functions in `app.js` are crashing. They reference missing functions (like `settleAiSignalLedger` and `refreshAdvancementStates`) that were either deleted or moved without proper bridging.
2. **Glitched Analytics HUD**: The floating Analytics HUD is non-functional or invisible. The logic for `updateAnalyticsHUD`, its dragging/resizing, and state variables like `isHudColdMode` were accidentally removed from `app.js`.
3. **Massive File Size**: `app.js` is nearly 5,000 lines, making it impossible to debug or extend without breaking things.
4. **Poor Organization**: All core scripts are in the root directory.

### Tasks to Complete
1. **Restore Core Stability**:
   - Repair the input processing queue in `app.js`.
   - Ensure all AI-related calls are bridged correctly to `window.AiBrain` (defined in `ai-brain.js`).
   - Restore the full HUD functionality (dragging, resizing, cold/hot modes).
2. **Implement "Clean Code" Folder Structure**:
   - Move files into this structure:
     - `assets/css/`: Stylesheets.
     - `js/modules/engine/`: `core.js`, `prediction.js`, `adapter.js`, `contract.js`, `state.js`.
     - `js/modules/ui/`: `controller.js`, `hud-manager.js`, `renderers.js`, `modals.js`.
     - `js/modules/ai/`: `brain.js`.
     - `js/modules/input/`: `processor.js`.
     - `js/strategies/`: Strategy logic files.
3. **Modularize `app.js`**:
   - Extract the global state and constants into `js/modules/engine/state.js`.
   - Move DOM/UI logic into `js/modules/ui/controller.js`.
   - Move spin processing and event listeners into `js/modules/input/processor.js`.
   - Keep `app.js` only as a lean entry point that initializes these modules.
4. **Update `index.html`**: Update all script paths to point to the new folder structure.

### References (Work Already Started)
- `ai-brain.js` is already created and contains the AI logic.
- A directory structure has been initialized.
- `hud-manager.js` has been drafted to house the restored HUD logic.
- `previous_app.js` (UTF-16) contains the original stable code that can be used for reference to restore missing functions.
