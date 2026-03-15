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
        advancementLog: [],
        chatMessageHistory: [],
        aiEnabled: false,
        aiProvider: 'gemini',
        aiApiKey: '',
        neuralPredictionEnabled: false,
        currentNeuralSignal: null,
        neuralPredictionRequestId: 0,
        aiSignalLedger: [],
        lastAiFusionSnapshot: null,
        aiPredictionCacheKey: '',
        aiPredictionCacheSignal: null,
        aiPredictionInFlight: null,
        aiApiKeyVisible: false,
        aiRelayAvailable: false,
        aiRuntimeState: {
            status: 'IDLE',
            provider: 'gemini',
            lastError: '',
            lastRequestMode: '',
            lastLatencyMs: 0,
            lastPromptPreview: '',
            lastResponsePreview: '',
            lastUpdatedLabel: 'Never'
        },
        patternConfig: {},
        userStats: {
            totalWins: 0, totalLosses: 0, netUnits: 0,
            bankrollHistory: [0],
            betLog: []
        },
        currentPredictionStrategy: 'series',
        currentGameplayStrategy: 'series', // 'series' or 'combo'
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
        analyticsDisplayStrategy: 'series',
        historyRenderVersion: 0,
        strategySyncCache: { series: null, combo: null }
    };
    window.currentAlerts = [];
})();
