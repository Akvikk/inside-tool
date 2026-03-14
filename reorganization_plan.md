# Project Reorganization: "Clean Code" Structure

The project will be organized into a logical folder structure to improve maintainability and follow the "Clean Code" principles.

## Target Structure

```text
inside-tool/
├── assets/
│   ├── css/
│   │   └── style.css
│   └── images/
├── js/
│   ├── modules/
│   │   ├── engine/
│   │   │   ├── adapter.js
│   │   │   ├── contract.js
│   │   │   ├── core.js
│   │   │   ├── prediction.js
│   │   │   └── state.js
│   │   ├── ui/
│   │   │   ├── renderers.js
│   │   │   ├── controller.js
│   │   │   ├── hud-manager.js
│   │   │   └── modals.js
│   │   ├── ai/
│   │   │   └── brain.js
│   │   └── input/
│   │       └── processor.js
│   ├── strategies/
│   │   ├── strategy.combo.js
│   │   └── strategy.series.js
│   ├── store.js
│   └── app.js (Entry)
├── index.html
├── server.js
└── package.json
```

## Migration Plan

1.  **Preparation**: Create the directory structure.
2.  **CSS**: Move `style.css` to `assets/css/` and update `index.html`.
3.  **Modules**:
    *   Move existing decoupled scripts (`engine-core.js`, `predictionEngine.js`, etc.) to their respective `js/modules/engine/` folders.
    *   Extract state and constants from `app.js` into `js/modules/engine/state.js`.
    *   Extract UI logic from `app.js` into `js/modules/ui/controller.js`.
    *   Extract HUD logic from `app.js` into `js/modules/ui/hud-manager.js`.
    *   Extract Input logic from `app.js` into `js/modules/input/processor.js`.
4.  **Integration**: Update `index.html` script tags to reflect new paths.
5.  **Clean up**: Remove original files after verification.
