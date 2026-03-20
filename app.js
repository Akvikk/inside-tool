/**
 * INSIDE TOOL - Application Bootstrap
 */

window.syncPredictionEngine = async function () {
    if (!window.PredictionEngine || typeof window.PredictionEngine.evaluatePredictionEngine !== 'function') return null;
    const snapshot = await window.PredictionEngine.evaluatePredictionEngine(window.state.history, {
        currentPredictionStrategy: window.state.currentGameplayStrategy === 'combo' ? 'momentum-gap' : 'legacy-face'
    });
    window.state.engineSnapshot = snapshot || null;
    return window.state.engineSnapshot;
};

window.scanAllStrategies = async function (options = {}) {
    if (window.EngineCore && typeof window.EngineCore.scanAll === 'function' && window.state) {
        if (window.ensureActivePatternConfig) window.ensureActivePatternConfig();
        if (window.syncPredictionEngine) await window.syncPredictionEngine();

        const rawResult = await window.EngineCore.scanAll(
            window.state.history, window.state.engineSnapshot || {},
            window.state.currentGameplayStrategy || 'series', window.state.patternConfig || {}, options
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
            window.state.strategySyncCache[window.state.currentGameplayStrategy || 'series'] = result;
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
    } else if (window.renderDashboardSafe) {
        window.renderDashboardSafe(window.state.activeBets || []);
    }
};

window.resetData = function () {
    if (window.state) {
        window.state.history = []; window.state.activeBets = []; window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        window.state.engineSnapshot = null; window.state.strategySyncCache = { series: null, combo: null, inside: null };
        window.state.userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
        window.state.engineStats = { totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0, bankrollHistory: [0], patternStats: {}, signalLog: [] };
    }
    window.currentAlerts = [];
    if (window.EngineCore) window.EngineCore.reset();
    const tbody = document.getElementById('historyBody'); if (tbody) tbody.innerHTML = '';
    if (window.renderGapStats) window.renderGapStats();
    if (window.renderDashboardSafe) window.renderDashboardSafe([]);
    if (window.HudManager && window.HudManager.update) window.HudManager.update();
    if (window.syncAppStore) window.syncAppStore();
    if (window.saveSessionData) window.saveSessionData();
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) confirmModal.classList.add('hidden');
};

window.syncStrategyUi = function () {
    const strategyKey = window.state.currentGameplayStrategy || 'series';
    const strategy = window.StrategyRegistry ? window.StrategyRegistry[strategyKey] : null;
    const comboHeader = document.getElementById('historyComboHeader');
    if (comboHeader) comboHeader.innerText = strategy && strategy.tableHeader ? strategy.tableHeader : 'COMBO';
    const strategySelect = document.getElementById('hamburgerStrategySelect');
    if (strategySelect) strategySelect.value = strategyKey;
};

window.addEventListener('DOMContentLoaded', async () => {
    document.addEventListener('click', (e) => {
        const patternShell = document.getElementById('patternFilterShell');
        const patternPopover = document.getElementById('patternFilterPopover');
        if (patternShell && patternPopover && !patternPopover.classList.contains('hidden') && !patternShell.contains(e.target)) {
            if (window.closePatternFilterPopover) window.closePatternFilterPopover();
        }
        const burgerMenu = document.getElementById('hamburgerMenu');
        const burgerBtn = document.getElementById('headerMenuBtn');
        if (burgerMenu && !burgerMenu.classList.contains('hidden') && !burgerMenu.contains(e.target) && (!burgerBtn || !burgerBtn.contains(e.target))) {
            if (window.toggleHamburgerMenu) window.toggleHamburgerMenu();
        }
    });

    console.log("INSIDE TOOL: Bootstrapping modular architecture...");

    if (window.InputProcessor && window.InputProcessor.init) window.InputProcessor.init();
    if (window.UiController && window.UiController.init) window.UiController.init();
    if (window.HudManager && window.HudManager.init) window.HudManager.init();
    if (window.EngineCore && window.EngineCore.initTracker) window.EngineCore.initTracker();

    const restoredSession = window.loadSessionData ? window.loadSessionData() : false;
    if (window.ensureActivePatternConfig) window.ensureActivePatternConfig();
    if (window.syncStrategyUi) window.syncStrategyUi();
    if (window.renderPatternFilterUi) window.renderPatternFilterUi();

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
