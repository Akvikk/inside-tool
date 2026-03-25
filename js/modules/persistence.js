(function () {
    'use strict';

    window.loadSessionData = function () {
        try {
            const raw = localStorage.getItem('insideTool_session_v2');
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.history) window.state.history = data.history;
            if (data.faceGaps) window.state.faceGaps = data.faceGaps;
            if (data.currentInputLayout === 'grid' || data.currentInputLayout === 'racetrack') window.state.currentInputLayout = data.currentInputLayout;
            if (data.currentGameplayStrategy === 'series' || data.currentGameplayStrategy === 'combo') window.state.currentGameplayStrategy = data.currentGameplayStrategy;
            if (data.patternConfigs && typeof data.patternConfigs === 'object') window.state.patternConfigs = data.patternConfigs;
            if (data.patternConfig && typeof data.patternConfig === 'object') window.state.patternConfig = data.patternConfig;
            if (typeof data.currentAnalyticsTab === 'string' && data.currentAnalyticsTab) window.state.currentAnalyticsTab = data.currentAnalyticsTab;
            if (typeof data.currentIntelligenceMode === 'string' && data.currentIntelligenceMode) window.state.currentIntelligenceMode = data.currentIntelligenceMode;
            if (data.analyticsDisplayStrategy === 'series' || data.analyticsDisplayStrategy === 'combo') window.state.analyticsDisplayStrategy = data.analyticsDisplayStrategy;
            if (data.isHudColdMode !== undefined) window.state.isHudColdMode = data.isHudColdMode === true;
            if (data.hudHistoryScope !== undefined) window.state.hudHistoryScope = data.hudHistoryScope === 'recent' ? 'recent' : 'all';
            
            // Restore persistent stats objects
            if (data.userStats) window.state.userStats = data.userStats;
            if (data.engineStats) window.state.engineStats = data.engineStats;

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
                currentInputLayout: state.currentInputLayout,
                currentGameplayStrategy: state.currentGameplayStrategy,
                patternConfig: state.patternConfig,
                patternConfigs: state.patternConfigs,
                currentAnalyticsTab: state.currentAnalyticsTab,
                currentIntelligenceMode: state.currentIntelligenceMode,
                analyticsDisplayStrategy: state.analyticsDisplayStrategy,
                isHudColdMode: state.isHudColdMode === true,
                hudHistoryScope: state.hudHistoryScope === 'recent' ? 'recent' : 'all',
                
                // Add persistent stats
                userStats: state.userStats,
                engineStats: state.engineStats
            }));
        } catch (e) {
            console.warn("Session save failed:", e);
        }
    };
})();
