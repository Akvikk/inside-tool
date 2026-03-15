(function () {
    'use strict';

    window.loadSessionData = function () {
        try {
            const raw = localStorage.getItem('insideTool_session_v2');
            if (!raw) return false;
            const data = JSON.parse(raw);
            if (data.history) window.state.history = data.history;
            if (data.faceGaps) window.state.faceGaps = data.faceGaps;
            if (data.aiEnabled !== undefined) window.state.aiEnabled = data.aiEnabled;
            if (data.aiApiKey) window.state.aiApiKey = data.aiApiKey;
            if (data.aiProvider) window.state.aiProvider = data.aiProvider;
            if (data.neuralPredictionEnabled !== undefined) window.state.neuralPredictionEnabled = data.neuralPredictionEnabled;
            if (data.currentInputLayout === 'grid' || data.currentInputLayout === 'racetrack') window.state.currentInputLayout = data.currentInputLayout;
            if (data.currentGameplayStrategy === 'series' || data.currentGameplayStrategy === 'combo') window.state.currentGameplayStrategy = data.currentGameplayStrategy;
            if (typeof data.currentAnalyticsTab === 'string' && data.currentAnalyticsTab) window.state.currentAnalyticsTab = data.currentAnalyticsTab;
            if (typeof data.currentIntelligenceMode === 'string' && data.currentIntelligenceMode) window.state.currentIntelligenceMode = data.currentIntelligenceMode;
            if (data.analyticsDisplayStrategy === 'series' || data.analyticsDisplayStrategy === 'combo') window.state.analyticsDisplayStrategy = data.analyticsDisplayStrategy;
            if (data.isHudColdMode !== undefined) window.state.isHudColdMode = data.isHudColdMode === true;
            if (data.hudHistoryScope !== undefined) window.state.hudHistoryScope = data.hudHistoryScope === 'recent' ? 'recent' : 'all';
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
                aiEnabled: state.aiEnabled,
                aiApiKey: state.aiApiKey,
                aiProvider: state.aiProvider,
                neuralPredictionEnabled: state.neuralPredictionEnabled,
                currentInputLayout: state.currentInputLayout,
                currentGameplayStrategy: state.currentGameplayStrategy,
                currentAnalyticsTab: state.currentAnalyticsTab,
                currentIntelligenceMode: state.currentIntelligenceMode,
                analyticsDisplayStrategy: state.analyticsDisplayStrategy,
                isHudColdMode: state.isHudColdMode === true,
                hudHistoryScope: state.hudHistoryScope === 'recent' ? 'recent' : 'all'
            }));
        } catch (e) {
            console.warn("Session save failed:", e);
        }
    };
})();
