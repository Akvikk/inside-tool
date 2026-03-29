(function () {
    window.state = {
        currentInputLayout: 'grid', // 'grid' or 'racetrack'
        history: [],
        activeBets: [],
        globalSpinIdCounter: 0,
        spinProcessingQueue: Promise.resolve(),
        faceGaps: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
        predictionPerimeterWindow: 14,
        perimeterRuleEnabled: true,
        showOnlyPerimeterBets: false,
        advancementLog: [],
        chatMessageHistory: [],
        patternConfig: {},
        patternConfigs: {},
        userStats: {
            totalWins: 0, totalLosses: 0, netUnits: 0,
            bankrollHistory: [0],
            betLog: []
        },
        currentPredictionStrategy: 'series',
        currentGameplayStrategy: 'inside', // 'series', 'combo', 'inside'
        strategies: {},
        changeStrategyTimeout: null,
        cachedAddSpinBtn: null,
        perimeterStatsCache: {},
        currentAnalyticsTab: 'strategy',
        currentIntelligenceMode: 'brief',
        isHudColdMode: false,
        hudHistoryScope: 'all',
        engineSnapshot: null,
        lastActionableComboLabel: null,
        lastActionableTargetFace: null,
        lastActionableCheckpointSpin: 0,
        analyticsDisplayStrategy: 'inside',
        historyRenderVersion: 0,
        strategySyncCache: { series: null, combo: null, inside: null, exibitl: null }
    };
    window.currentAlerts = [];

    window.updateUserStats = function(isWin, bet, spinIndex, unitChange) {
        if (!window.state || !window.state.userStats) return;
        const stats = window.state.userStats;

        if (isWin) {
            stats.totalWins++;
        } else {
            stats.totalLosses++;
        }
        stats.netUnits += unitChange;
        
        if (!stats.bankrollHistory) stats.bankrollHistory = [0];
        stats.bankrollHistory.push(stats.netUnits);

        if (!stats.betLog) stats.betLog = [];
        stats.betLog.unshift({
            id: stats.totalWins + stats.totalLosses,
            patternName: bet.patternName || bet.comboLabel || 'Unknown',
            targetFace: bet.targetFace || null,
            targetNums: bet.targetNums || null,
            accentColor: bet.accentColor || '#ffffff',
            isWin: isWin,
            spinIndex: spinIndex,
            unitChange: unitChange
        });

        if (stats.betLog.length > 500) stats.betLog.length = 500;

        // Auto-refresh the DOM if modal is open
        if (typeof window.renderUserAnalytics === 'function') {
            window.renderUserAnalytics();
        }
    };
})();
