/**
 * INSIDE TOOL - Application Bootstrap
 */

window.syncPredictionEngine = async function () {
    if (!window.PredictionEngine || typeof window.PredictionEngine.evaluatePredictionEngine !== 'function') return null;

    // Perimeter feature is strictly limited to the Pattern (inside) strategy
    if (window.state && window.state.currentGameplayStrategy !== 'inside') {
        window.state.engineSnapshot = null;
        return null;
    }

    const snapshot = await window.PredictionEngine.evaluatePredictionEngine(window.state.history, {
        currentPredictionStrategy: 'legacy-face'
    });
    window.state.engineSnapshot = snapshot || null;
    return snapshot;
};

window.ensureActivePatternConfig = function () {
    if (!window.state) return;
    if (!window.state.patternConfig) window.state.patternConfig = {};

    const strategyKey = window.state.currentGameplayStrategy || 'inside';
    const strategy = window.StrategyRegistry && window.StrategyRegistry[strategyKey];

    if (strategy && typeof strategy.buildPatternConfig === 'function') {
        const defaults = strategy.buildPatternConfig(true);
        let changed = false;
        for (const key of Object.keys(defaults)) {
            if (window.state.patternConfig[key] === undefined) {
                window.state.patternConfig[key] = true;
                changed = true;
            }
        }
        // If we initialized new keys, immediately sync the UI button badge
        if (changed && window.syncPatternFilterButton) {
            window.syncPatternFilterButton();
        }
    }
};

window.scanAllStrategies = async function (options = {}) {
    if (window.EngineCore && typeof window.EngineCore.scanAll === 'function' && window.state) {
        if (window.ensureActivePatternConfig) window.ensureActivePatternConfig();
        if (window.syncPredictionEngine) await window.syncPredictionEngine();

        const rawResult = await window.EngineCore.scanAll(
            window.state.history, window.state.engineSnapshot || {},
            window.state.currentGameplayStrategy || 'inside', window.state.patternConfig || {}, options
        );

        const syncView = window.EngineAdapter && typeof window.EngineAdapter.toSyncView === 'function' ? window.EngineAdapter.toSyncView(rawResult) : rawResult;
        const result = {
            ...rawResult, notifications: Array.isArray(syncView && syncView.notifications) ? syncView.notifications : [],
            nextBets: Array.isArray(syncView && syncView.nextBets) ? syncView.nextBets : [],
            valid: syncView && syncView.valid !== false, errors: Array.isArray(syncView && syncView.errors) ? syncView.errors : []
        };

        window.state.activeBets = result.nextBets;
        window.currentAlerts = result.notifications;

        if (window.state.strategySyncCache && typeof window.state.strategySyncCache === 'object') {
            window.state.strategySyncCache[window.state.currentGameplayStrategy || 'inside'] = result;
        }
        return result;
    }
    return { notifications: [], nextBets: [], resultsByStrategy: {} };
};

window.syncAppStore = function () {
    if (window.AppStore && typeof window.AppStore.dispatch === 'function' && window.state) {
        const storePatch = window.EngineAdapter && typeof window.EngineAdapter.toStorePatch === 'function'
            ? window.EngineAdapter.toStorePatch({ history: window.state.history, activeBets: window.state.activeBets, alerts: window.currentAlerts, snapshot: window.state.engineSnapshot })
            : { history: window.state.history, activeBets: window.state.activeBets, alerts: window.currentAlerts, snapshot: window.state.engineSnapshot };
        window.AppStore.dispatch('engine/sync', storePatch);
    } else {
        if (window.renderDashboardSafe) {
            window.renderDashboardSafe(window.state.activeBets || []);
        } else if (window.renderDashboard) {
            if (window.state && window.state.activeBets) {
                window.activeBets = window.state.activeBets;
            }
            window.renderDashboard(window.currentAlerts || []);
        }
    }
};

window.resetData = async function () {
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) confirmModal.classList.add('hidden');

    if (window.rebuildSessionFromSpins) {
        await window.rebuildSessionFromSpins([]);
    } else {
        if (window.state) {
            window.state.history = []; window.state.activeBets = []; window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            window.state.engineSnapshot = null; window.state.strategySyncCache = { series: null, combo: null, inside: null };
            window.state.userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
            window.state.engineStats = { totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0, bankrollHistory: [0], patternStats: {}, signalLog: [] };
            window.state.globalSpinIdCounter = 0;
            window.state.currentGameplayStrategy = 'inside';
            window.state.analyticsDisplayStrategy = 'inside';
            window.state.patternConfig = {};
            if (window.ensureActivePatternConfig) window.ensureActivePatternConfig();
        }
        window.currentAlerts = [];
        if (window.EngineCore && window.EngineCore.reset) window.EngineCore.reset();
        const tbody = document.getElementById('historyBody'); if (tbody) tbody.innerHTML = '';
        if (window.renderGapStats) window.renderGapStats();
        if (window.renderDashboardSafe) window.renderDashboardSafe([]);
        if (window.HudManager && window.HudManager.update) window.HudManager.update();
        if (window.syncAppStore) window.syncAppStore();
        if (window.saveSessionData) window.saveSessionData();
    }

    if (window.UiController && typeof window.UiController.showToast === 'function') {
        window.UiController.showToast('Session data reset successfully.', 'info');
    }
};
window.performReset = window.resetData;

window.syncUIWithStrategyMode = function () {
    const strategyKey = window.state && window.state.currentGameplayStrategy ? window.state.currentGameplayStrategy : 'inside';
    const comboHeader = document.getElementById('historyComboHeader');

    if (comboHeader) {
        if (strategyKey === 'series') {
            comboHeader.innerHTML = "SEQUENCE";
        } else if (strategyKey === 'combo') {
            comboHeader.innerHTML = "COMBO";
        } else if (strategyKey === 'inside') {
            comboHeader.innerHTML = "PATTERN";
        } else {
            comboHeader.innerHTML = "COMBO";
        }
    }

    const strategySelect = document.getElementById('hamburgerStrategySelect');
    if (strategySelect) strategySelect.value = strategyKey;

    const switcherBtn = document.getElementById('strategySwitcherBtn');
    const switcherLabel = document.getElementById('strategySwitcherLabel');
    if (switcherBtn && switcherLabel) {
        let label = 'INSIDE';
        let color = '#BF5AF2';
        let borderColor = 'rgba(191, 90, 242, 0.1)';
        let iconClass = 'fas fa-crosshairs text-[11px]';

        if (strategyKey === 'combo') {
            label = 'COMBOS';
            color = '#30D158'; // Green
            borderColor = 'rgba(48, 209, 88, 0.1)';
            iconClass = 'fas fa-link text-[11px]';
        } else if (strategyKey === 'series') {
            label = 'SERIES';
            color = '#0A84FF'; // Blue
            borderColor = 'rgba(10, 132, 255, 0.1)';
            iconClass = 'fas fa-layer-group text-[11px]';
        } else if (strategyKey === 'exibitl') {
            label = 'EXIBITL';
            color = '#BF5AF2'; // Violet
            borderColor = 'rgba(191, 90, 242, 0.1)';
            iconClass = 'fas fa-bolt text-[11px]';
        }

        switcherLabel.innerText = label;
        switcherBtn.style.color = color;
        switcherBtn.style.borderColor = borderColor;

        const switcherIcon = document.getElementById('strategySwitcherIcon');
        if (switcherIcon) switcherIcon.className = iconClass;
    }

    // Re-render the pattern filter list so it instantly rebuilds with correct toggles
    if (window.renderPatternFilterList) window.renderPatternFilterList();

    // --- PERIMETER VISIBILITY ---
    const perimeterTrigger = document.querySelector('[onclick="toggleAccordion(\'perimeterSubMenu\')"]');
    const perimeterSubMenu = document.getElementById('perimeterSubMenu');
    
    if (perimeterTrigger) {
        if (strategyKey === 'inside') {
            perimeterTrigger.classList.remove('hidden');
        } else {
            perimeterTrigger.classList.add('hidden');
            if (perimeterSubMenu) perimeterSubMenu.classList.add('hidden');
        }
    }
};

window.setGameplayStrategy = async function (strategyKey) {
    if (!window.state) return;
    if (window.state.currentGameplayStrategy === strategyKey) return;

    const oldSpins = window.state.history ? window.state.history.map(s => s.num) : [];
    window.state.currentGameplayStrategy = strategyKey;
    if (window.setAnalyticsDisplayStrategy) window.setAnalyticsDisplayStrategy(strategyKey);
    if (window.ensureActivePatternConfig) window.ensureActivePatternConfig();

    if (window.syncUIWithStrategyMode) window.syncUIWithStrategyMode();

    // If we have history, rewind and replay the entire session under the new Strategy lens.
    // This elegantly scrubs old signals and recalculates all metrics natively.
    if (oldSpins.length > 0 && window.rebuildSessionFromSpins) {
        await window.rebuildSessionFromSpins(oldSpins);
    } else {
        // Re-run processing and update UI components if no history bounds it
        if (window.scanAllStrategies) {
            await window.scanAllStrategies({ silent: true });
        }
        if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
        if (window.reRenderHistory) window.reRenderHistory();
    }

    if (window.renderPatternFilterList) window.renderPatternFilterList();
    if (window.syncPatternFilterButton) window.syncPatternFilterButton();
    if (window.saveSessionData) window.saveSessionData();
};

window.cycleGameplayStrategy = async function () {
    if (!window.state) return;
    const modes = ['series', 'combo', 'inside', 'exibitl'];
    const currentMode = window.state.currentGameplayStrategy || 'series';
    const nextIdx = (modes.indexOf(currentMode) + 1) % modes.length;
    await window.setGameplayStrategy(modes[nextIdx]);
};

window.toggleStrategyDropdown = function(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('strategyDropdownMenu');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden') || menu.classList.contains('opacity-0');
    
    document.querySelectorAll('.dropdown-layer').forEach(d => {
        if (d !== menu) {
            d.classList.add('opacity-0', 'scale-95');
            setTimeout(() => d.classList.add('hidden'), 200);
        }
    });

    if (isHidden) {
        menu.classList.remove('hidden');
        void menu.offsetWidth;
        menu.classList.remove('scale-95', 'opacity-0');
        menu.classList.add('scale-100', 'opacity-100');
    } else {
        menu.classList.remove('scale-100', 'opacity-100');
        menu.classList.add('scale-95', 'opacity-0');
        setTimeout(() => { if (menu.classList.contains('opacity-0')) menu.classList.add('hidden'); }, 200);
    }
};

window.addEventListener('DOMContentLoaded', async () => {
    console.log("INSIDE TOOL: Bootstrapping modular architecture...");

    // Inject Global iOS Glassmorphism
    const glassStyle = document.createElement('style');
    glassStyle.textContent = `
        @keyframes glassSlideFade {
            0% {
                opacity: 0;
                transform: translateY(16px) scale(0.97);
            }
            100% {
                opacity: 1;
                transform: translateY(0) scale(1);
            }
        }

        /* iOS 2026 Core Aesthetics - Pure Blacks, Heavy Blurs, Ultra-Thin Borders */
        body {
            background-color: #000000 !important;
            color: #F2F2F7; /* Apple System Gray 6 */
            -webkit-font-smoothing: antialiased;
        }
        
        /* High-fidelity Glass Panels (Apple Materials) */
        header, 
        #hamburgerMenu, 
        #patternFilterPopover,
        [id$="Modal"] > div.relative,
        .dashboard-empty,
        #analyticsHUD,
        #hudControls {
            background: rgba(28, 28, 30, 0.65) !important; /* iOS Dark Material */
            backdrop-filter: blur(60px) saturate(200%) !important;
            -webkit-backdrop-filter: blur(60px) saturate(200%) !important;
            border: 0.5px solid rgba(255, 255, 255, 0.15) !important;
            box-shadow: none !important; /* Remove muddy drop shadows for clean lines */
            border-radius: 20px !important; /* Squircle appearance */
        }

        /* Number Pad Grid Panel - Deeper material */
        #inputGridContainer {
            background: transparent !important;
            border-right: 0.5px solid rgba(255, 255, 255, 0.1) !important;
        }

        /* Standardize Table UI to iOS list styles */
        thead.bg-black\\/20 th {
            background-color: transparent !important;
            color: #8E8E93 !important; /* Apple System Gray */
            text-transform: uppercase;
            font-size: 10px;
            letter-spacing: 0.05em;
            border-bottom: 0.5px solid rgba(255, 255, 255, 0.1) !important;
        }

        /* High-fidelity Glass Analytics Tables */
        table:has(#heatmapBody), 
        table:has(#userBetsBody), 
        table:has(#patternDetailBody), 
        .intel-table {
            border-collapse: separate !important;
            border-spacing: 0 6px !important;
            width: 100%;
        }

        #heatmapBody tr, 
        #userBetsBody tr, 
        #patternDetailBody tr, 
        .intel-table tbody tr {
            background: rgba(255, 255, 255, 0.02) !important;
            backdrop-filter: blur(16px) saturate(180%) !important;
            -webkit-backdrop-filter: blur(16px) saturate(180%) !important;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        
        #heatmapBody tr:hover, 
        #userBetsBody tr:hover, 
        #patternDetailBody tr:hover, 
        .intel-table tbody tr:hover {
            background: rgba(255, 255, 255, 0.06) !important;
            transform: scale(1.01);
            box-shadow: 0 8px 24px rgba(0,0,0,0.15);
            z-index: 10;
            position: relative;
        }

        #heatmapBody td, 
        #userBetsBody td, 
        #patternDetailBody td, 
        .intel-table tbody td {
            border-top: 0.5px solid rgba(255, 255, 255, 0.08) !important;
            border-bottom: 0.5px solid rgba(255, 255, 255, 0.08) !important;
        }

        #heatmapBody td:first-child, 
        #userBetsBody td:first-child, 
        #patternDetailBody td:first-child, 
        .intel-table tbody td:first-child {
            border-left: 0.5px solid rgba(255, 255, 255, 0.08) !important;
            border-top-left-radius: 12px !important;
            border-bottom-left-radius: 12px !important;
        }

        #heatmapBody td:last-child, 
        #userBetsBody td:last-child, 
        #patternDetailBody td:last-child, 
        .intel-table tbody td:last-child {
            border-right: 0.5px solid rgba(255, 255, 255, 0.08) !important;
            border-top-right-radius: 12px !important;
            border-bottom-right-radius: 12px !important;
        }
        
        /* Lists and secondary interaction areas */
        #patternsList > div {
            background: rgba(255, 255, 255, 0.03) !important;
            border: 1px solid rgba(255, 255, 255, 0.02) !important;
        }
        #patternsList > div:hover {
            background: rgba(255, 255, 255, 0.08) !important;
        }
        
        /* Smooth entry animation for structural and dynamic panels */
        header,
        .dashboard-empty,
        #analyticsHUD,
        #hudControls,
        #patternsList > div {
            animation: glassSlideFade 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }

        /* Animated Mesh Gradient Background */
        @keyframes volumetricFloat {
            0% { transform: translate(0, 0) rotate(0deg) scale(1); }
            33% { transform: translate(4vw, -4vh) rotate(120deg) scale(1.15); }
            66% { transform: translate(-3vw, 3vh) rotate(240deg) scale(0.9); }
            100% { transform: translate(0, 0) rotate(360deg) scale(1); }
        }
        .animate-blob {
            animation: volumetricFloat 20s linear infinite;
        }
        .animation-delay-2000 {
            animation-delay: 2s;
        }
        .animation-delay-4000 {
            animation-delay: 4s;
        }
    `;
    document.head.appendChild(glassStyle);

    // Dynamic Cursor Tracking Blob
    const cursorBlob = document.createElement('div');
    // Signature purple with heavy blur, disabled on mobile to preserve resources
    cursorBlob.className = 'fixed top-0 left-0 w-[500px] h-[500px] bg-[#BF5AF2]/10 rounded-full blur-[120px] pointer-events-none z-[-1] hidden md:block will-change-transform';
    document.body.appendChild(cursorBlob);

    let tgtX = window.innerWidth / 2;
    let tgtY = window.innerHeight / 2;
    let curX = tgtX;
    let curY = tgtY;

    window.addEventListener('mousemove', (e) => {
        tgtX = e.clientX;
        tgtY = e.clientY;
    });
    const animateCursorBlob = () => {
        curX += (tgtX - curX) * 0.08; // Smooth easing multiplier for the "heavy float" effect
        curY += (tgtY - curY) * 0.08;
        cursorBlob.style.transform = `translate3d(${curX - 250}px, ${curY - 250}px, 0)`;
        requestAnimationFrame(animateCursorBlob);
    };
    animateCursorBlob();

    if (window.InputProcessor && window.InputProcessor.init) window.InputProcessor.init();
    if (window.UiController && window.UiController.init) window.UiController.init();
    if (window.HudManager && window.HudManager.init) window.HudManager.init();
    if (window.EngineCore && window.EngineCore.initTracker) window.EngineCore.initTracker();

    const restoredSession = window.loadSessionData ? window.loadSessionData() : false;

    if (window.state && !window.state.currentGameplayStrategy) {
        window.state.currentGameplayStrategy = 'inside';
    }
    if (window.state && !window.state.analyticsDisplayStrategy) {
        window.state.analyticsDisplayStrategy = window.state.currentGameplayStrategy || 'inside';
    }

    if (window.ensureActivePatternConfig) window.ensureActivePatternConfig();
    if (window.syncUIWithStrategyMode) window.syncUIWithStrategyMode();

    if (window.renderPatternFilterList) window.renderPatternFilterList();
    else if (window.renderPatternFilterUi) window.renderPatternFilterUi();

    if (restoredSession && window.state.history.length > 0) {
        if (window.EngineCore && window.EngineCore.restoreStats) {
            window.EngineCore.restoreStats(window.state.engineStats);
        }

        if (window.reRenderHistory) window.reRenderHistory({ scrollToEnd: true });

        if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
        if (window.HudManager && window.HudManager.update) window.HudManager.update();
        if (window.syncAppStore) window.syncAppStore();
    }

    if (window.renderGapStats) window.renderGapStats();
    if (window.renderDashboardSafe) window.renderDashboardSafe();
    if (window.initPerimeterUI) window.initPerimeterUI();
    if (window.initComboBridgeAutoLayout) window.initComboBridgeAutoLayout();
    if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout();


    const resetBtn = document.getElementById('confirmResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', window.resetData);

    // (More Menu Logic handled via index.html inline onclick for better reliability)
    
    document.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-layer').forEach(d => {
            d.classList.add('opacity-0', 'scale-95');
            setTimeout(() => d.classList.add('hidden'), 200);
        });
    });

    // STRATEGY CYCLING HELPER
    window.cycleGameplayStrategy = function() {
        const order = ['inside', 'series', 'combo'];
        const current = window.state.currentGameplayStrategy || 'inside';
        const next = order[(order.indexOf(current) + 1) % order.length];
        if (window.setGameplayStrategy) window.setGameplayStrategy(next);
    };
});
