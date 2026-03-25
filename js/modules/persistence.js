(function () {
    'use strict';

    function cloneOrDefault(value, fallback) {
        return value && typeof value === 'object'
            ? JSON.parse(JSON.stringify(value))
            : JSON.parse(JSON.stringify(fallback));
    }

    function normalizeUserStats(userStats) {
        const stats = cloneOrDefault(userStats, {
            totalWins: 0,
            totalLosses: 0,
            netUnits: 0,
            bankrollHistory: [0],
            betLog: []
        });
        if (!Array.isArray(stats.bankrollHistory) || stats.bankrollHistory.length === 0) stats.bankrollHistory = [0];
        if (!Array.isArray(stats.betLog)) stats.betLog = [];
        return stats;
    }

    function normalizeEngineStats(engineStats) {
        const stats = cloneOrDefault(engineStats, {
            totalWins: 0,
            totalLosses: 0,
            netUnits: 0,
            currentStreak: 0,
            bankrollHistory: [0],
            patternStats: {},
            signalLog: []
        });
        if (!Array.isArray(stats.bankrollHistory) || stats.bankrollHistory.length === 0) stats.bankrollHistory = [0];
        if (!stats.patternStats || typeof stats.patternStats !== 'object') stats.patternStats = {};
        if (!Array.isArray(stats.signalLog)) stats.signalLog = [];
        return stats;
    }

    window.loadSessionData = function () {
        try {
            const raw = localStorage.getItem('insideTool_session_v2');
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.history) window.state.history = data.history;
            if (data.faceGaps) window.state.faceGaps = data.faceGaps;
            if (Array.isArray(data.activeBets)) window.state.activeBets = data.activeBets;
            if (typeof data.globalSpinIdCounter === 'number') window.state.globalSpinIdCounter = data.globalSpinIdCounter;
            if (data.currentInputLayout === 'grid' || data.currentInputLayout === 'racetrack') window.state.currentInputLayout = data.currentInputLayout;
            if (data.currentGameplayStrategy === 'series' || data.currentGameplayStrategy === 'combo' || data.currentGameplayStrategy === 'inside') window.state.currentGameplayStrategy = data.currentGameplayStrategy;
            if (data.patternConfigs && typeof data.patternConfigs === 'object') window.state.patternConfigs = data.patternConfigs;
            if (data.patternConfig && typeof data.patternConfig === 'object') window.state.patternConfig = data.patternConfig;
            if (typeof data.currentAnalyticsTab === 'string' && data.currentAnalyticsTab) window.state.currentAnalyticsTab = data.currentAnalyticsTab;
            if (typeof data.currentIntelligenceMode === 'string' && data.currentIntelligenceMode) window.state.currentIntelligenceMode = data.currentIntelligenceMode;
            if (data.analyticsDisplayStrategy === 'series' || data.analyticsDisplayStrategy === 'combo' || data.analyticsDisplayStrategy === 'inside') window.state.analyticsDisplayStrategy = data.analyticsDisplayStrategy;
            if (data.isHudColdMode !== undefined) window.state.isHudColdMode = data.isHudColdMode === true;
            if (data.hudHistoryScope !== undefined) window.state.hudHistoryScope = data.hudHistoryScope === 'recent' ? 'recent' : 'all';
            if (data.engineSnapshot && typeof data.engineSnapshot === 'object') window.state.engineSnapshot = data.engineSnapshot;
            if (data.strategySyncCache && typeof data.strategySyncCache === 'object') window.state.strategySyncCache = data.strategySyncCache;
            if (Array.isArray(data.currentAlerts)) window.currentAlerts = data.currentAlerts;
            
            // Restore persistent stats objects
            window.state.userStats = normalizeUserStats(data.userStats);
            window.state.engineStats = normalizeEngineStats(data.engineStats);

            return true;
        } catch (e) {
            console.error("Session load failed:", e);
            return false;
        }
    };

    window.saveSessionData = function () {
        try {
            localStorage.setItem('insideTool_session_v2', JSON.stringify({
                history: state.history,
                faceGaps: state.faceGaps,
                activeBets: state.activeBets,
                globalSpinIdCounter: state.globalSpinIdCounter,
                currentInputLayout: state.currentInputLayout,
                currentGameplayStrategy: state.currentGameplayStrategy,
                patternConfig: state.patternConfig,
                patternConfigs: state.patternConfigs,
                currentAnalyticsTab: state.currentAnalyticsTab,
                currentIntelligenceMode: state.currentIntelligenceMode,
                analyticsDisplayStrategy: state.analyticsDisplayStrategy,
                isHudColdMode: state.isHudColdMode === true,
                hudHistoryScope: state.hudHistoryScope === 'recent' ? 'recent' : 'all',
                engineSnapshot: state.engineSnapshot,
                strategySyncCache: state.strategySyncCache,
                currentAlerts: window.currentAlerts || [],
                
                // Add persistent stats
                userStats: state.userStats,
                engineStats: state.engineStats
            }));
        } catch (e) {
            console.warn("Session save failed:", e);
        }
    };
})();
