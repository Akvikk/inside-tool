# Inside Tool - High-Performance Analytics Dashboard

**PROPRIETARY AND CONFIDENTIAL**
This repository is public for **VISIBILITY AND PORTFOLIO PURPOSES ONLY**. 
All Rights Reserved. No permission is granted to **fork**, **copy**, **clone**, **distribute**, or **modify** this software or its source code via any medium. Unauthorized use, copying, or redistribution is a direct violation of copyright law.
See the [LICENSE](LICENSE) file for the full list of restrictions and legal terms.

---

## Key Features

### 1. Ultra-Compact UI (Zero-Waste)
- **High-Density History**: Optimized row heights with 4px padding for maximum information density.
- **Pipe-Separated Signals**: Multi-signal results rendered horizontally: (X) F2 • BRKT | (V) F5 • BRKT.
- **Icon-Only Status**: All redundant text labels removed in favor of color-coded status icons.

### 2. Absolute Stats Persistence
- **Global Binding Engine**: The EngineCore is directly bound to the global session state, providing 100% data reliability.
- **Direct Hydration**: Session restoration bypasses destructive re-simulation, preserving manual bet confirmations and historical telemetry.
- **Persistent Analytics**: Continuous tracking for both personal ledger (My Bets) and strategy-specific telemetry (Terminal/Perimeter).

### 3. Context-Aware Strategy Management
- **Intelligent Modals**: The Analytics dashboard automatically defaults to the active gameplay strategy (Inside, Series, or Combo).
- **Background Tracking**: Real-time resolution of background bets and strategy-specific pattern recognition.

---

## Technical Stack
- **Architecture**: Modular JS component system with a centralized EngineCore and AppStore.
- **UI Architecture**: Vanilla HTML5, JavaScript (ES6+), and custom CSS (Zero-Waste).
- **Persistence**: LocalStorage-based session serialization with deep state hydration.

## Installation and Local Development
1. Clone the repository for local review.
2. Open index.html in a modern browser.
3. For local server development:
   ```bash
   node server.js
   ```

## Legal Notice
Copyright (c) 2026. All rights reserved. Access to this repository does not constitute a license to use or distribute the software.
