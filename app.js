/**
 * INSIDE TOOL - Application Bootstrap
 */

window.syncPredictionEngine = async function () {
    if (!window.PredictionEngine || typeof window.PredictionEngine.evaluatePredictionEngine !== 'function') return null;
    const strategy = window.state.currentGameplayStrategy === 'combo' ? 'momentum-gap' : 'legacy-face';
    const snapshot = await window.PredictionEngine.evaluatePredictionEngine(window.state.history, {
        currentPredictionStrategy: strategy
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
        for (const key of Object.keys(defaults)) {
            if (window.state.patternConfig[key] === undefined) {
                window.state.patternConfig[key] = true;
            }
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

    // Re-render the pattern filter list so it instantly rebuilds with correct toggles
    if (window.renderPatternFilterList) window.renderPatternFilterList();
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

        /* Global atmospheric backdrop to make the glass visible - Softened for eye strain */
        body {
            background-color: #0A0A0C !important;
            background-image: radial-gradient(circle at 50% 0%, #15151c 0%, #0A0A0C 100%) !important;
            background-attachment: fixed !important;
            color: #E5E5EA; /* Soften pure whites globally without breaking Tailwind */
        }
        
        /* Core UI Panels, Modals, and Menus - Reduced Border Harshness */
        header, 
        #hamburgerMenu, 
        #patternFilterPopover,
        [id$="Modal"] > div.relative,
        .dashboard-empty,
        #analyticsHUD,
        #hudControls {
            background: rgba(20, 20, 24, 0.40) !important;
            backdrop-filter: blur(28px) saturate(160%) !important;
            -webkit-backdrop-filter: blur(28px) saturate(160%) !important;
            border: 1px solid rgba(255, 255, 255, 0.05) !important;
            box-shadow: 0 10px 40px -10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.03) !important;
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
    `;
    document.head.appendChild(glassStyle);

    if (window.InputProcessor && window.InputProcessor.init) window.InputProcessor.init();
    if (window.UiController && window.UiController.init) window.UiController.init();
    if (window.HudManager && window.HudManager.init) window.HudManager.init();
    if (window.EngineCore && window.EngineCore.initTracker) window.EngineCore.initTracker();

    const restoredSession = window.loadSessionData ? window.loadSessionData() : false;

    if (window.state) {
        // Force default mode to inside
        if (!window.state.currentGameplayStrategy || window.state.currentGameplayStrategy === 'series') {
            window.state.currentGameplayStrategy = 'inside';
        }
    }

    if (window.ensureActivePatternConfig) window.ensureActivePatternConfig();
    if (window.syncUIWithStrategyMode) window.syncUIWithStrategyMode();

    if (window.renderPatternFilterList) window.renderPatternFilterList();
    else if (window.renderPatternFilterUi) window.renderPatternFilterUi();

    if (restoredSession && window.state.history.length > 0) {
        const spinNumbers = window.state.history.map(s => s.num);
        if (window.rebuildSessionFromSpins) await window.rebuildSessionFromSpins(spinNumbers);

    }

    if (window.renderGapStats) window.renderGapStats();
    if (window.renderDashboardSafe) window.renderDashboardSafe();
    if (window.initComboBridgeAutoLayout) window.initComboBridgeAutoLayout();
    if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout();


    const resetBtn = document.getElementById('confirmResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', window.resetData);
});
