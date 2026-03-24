/**
 * INSIDE TOOL - Engine Core
 * Centralized logic for strategy execution, background tracking, and analytics.
 */

window.EngineCore = {
    // 1. DATA STORE
    stats: {
        totalWins: 0,
        totalLosses: 0,
        netUnits: 0,
        currentStreak: 0,
        bankrollHistory: [0],
        patternStats: {},
        signalLog: []
    },

    backgroundBets: {},  // { 'strategy': [bets...] }
    tripleCsResets: {}, // { 'pairKey': lastResetIndex }

    /**
     * Resets the entire engine state.
     */
    reset() {
        this.stats = {
            totalWins: 0,
            totalLosses: 0,
            netUnits: 0,
            currentStreak: 0,
            bankrollHistory: [0],
            patternStats: {},
            signalLog: []
        };
        this.backgroundBets = {};
        this.tripleCsResets = {};
    },

    /**
     * Updates engine stats with a new result.
     */
    updateStats(isWin, patternName, unitChange, rawStrategy, rawPattern, spinIndex, spinNum) {
        const stats = this.stats;
        if (isWin) {
            stats.totalWins++;
            stats.currentStreak = stats.currentStreak >= 0 ? stats.currentStreak + 1 : 1;
        } else {
            stats.totalLosses++;
            stats.currentStreak = stats.currentStreak <= 0 ? stats.currentStreak - 1 : -1;
        }
        stats.netUnits += unitChange;
        stats.bankrollHistory.push(stats.netUnits);

        if (!stats.patternStats[patternName]) {
            stats.patternStats[patternName] = { wins: 0, losses: 0 };
        }
        if (isWin) stats.patternStats[patternName].wins++;
        else stats.patternStats[patternName].losses++;

        stats.signalLog.push({
            result: isWin ? 'WIN' : 'LOSS',
            units: unitChange,
            patternName: patternName,
            rawStrategy: rawStrategy,
            rawPattern: rawPattern,
            spinIndex: spinIndex,
            spinNum: spinNum
        });
    },

    /**
     * Resolves all pending bets (active and background) for a new spin.
     */
    resolveTurn(val, matchedFaceMask, activeBets, currentGameplayStrategy, updateUserStats, runtime = {}) {
        const historyLength = Number.isInteger(runtime.historyLength)
            ? runtime.historyLength
            : (Array.isArray(runtime.history) ? runtime.history.length : 0);
        const faceMasks = runtime.faceMasks || window.FACE_MASKS || {};
        const faces = runtime.faces || window.FACES || {};
        const resolvedTurnBets = [];

        // Resolve Active Bets
        if (activeBets && activeBets.length > 0) {
            activeBets.forEach(bet => {
                const mask = faceMasks[bet.targetFace] || 0;
                const isWin = (matchedFaceMask & mask) !== 0;
                const count = faces[bet.targetFace] ? faces[bet.targetFace].nums.length : 0;
                const unitChange = isWin ? (35 - count) : -count;

                this.updateStats(isWin, bet.patternName, unitChange, bet.strategy, bet.patternName, historyLength, val);

                if (bet.confirmed && typeof updateUserStats === 'function') {
                    updateUserStats(isWin, bet, historyLength, unitChange);
                }

                if (bet.strategy === 'TripleCs' && bet.originPairKey) {
                    this.tripleCsResets[bet.originPairKey] = historyLength;
                }

                resolvedTurnBets.push({
                    patternName: bet.patternName,
                    filterKey: bet.filterKey || bet.patternName,
                    strategy: bet.strategy || currentGameplayStrategy,
                    targetFace: bet.targetFace,
                    isWin: isWin,
                    label: `BET F${bet.targetFace}`,
                    comboLabel: bet.comboLabel || null,
                    confidence: bet.confidence,
                    highlightIds: bet.highlightIds || [],
                    reason: bet.reason || bet.subtitle || '',
                    mode: bet.mode || null,
                    status: bet.status || 'GO',
                    signalSource: bet.signalSource || 'math'
                });
            });
        }

        // Resolve Background Bets
        const registry = window.StrategyRegistry || {};
        for (const stratKey of Object.keys(registry)) {
            // Resolve standard background bets (from other strategies) 
            // AND any shadow bets specifically returned by the active strategy
            const bgBets = (this.backgroundBets[stratKey] || []).concat(this.shadowBets?.[stratKey] || []);
            
            bgBets.forEach(bet => {
                const isWin = (matchedFaceMask & (faceMasks[bet.targetFace] || 0)) !== 0;
                const count = faces[bet.targetFace] ? faces[bet.targetFace].nums.length : 0;
                const unitChange = isWin ? (35 - count) : -count;

                this.updateStats(isWin, bet.patternName, unitChange, bet.strategy || stratKey, bet.patternName, historyLength, val);

                if (bet.strategy === 'TripleCs' && bet.originPairKey) {
                    this.tripleCsResets[bet.originPairKey] = historyLength;
                }
            });
            
            this.backgroundBets[stratKey] = [];
            if (this.shadowBets) this.shadowBets[stratKey] = [];
        }

        return resolvedTurnBets;
    },

    /**
     * Runs all registered strategies and stores results.
     */
    async scanAll(history, snapshot, activeStrategyKey, patternConfig, runtime = {}) {
        const registry = runtime.registry || window.StrategyRegistry || {};
        let activeResults = { notifications: [], nextBets: [] };
        const resultsByStrategy = {};

        for (const stratKey of Object.keys(registry)) {
            const strat = registry[stratKey];
            if (!strat || typeof strat.run !== 'function') continue;

            const config = stratKey === activeStrategyKey
                ? patternConfig
                : (strat.buildPatternConfig ? strat.buildPatternConfig(true) : {});

            const result = strat.run(history, snapshot, config, { tripleCsResets: this.tripleCsResets });
            this.backgroundBets[stratKey] = result.nextBets || [];
            resultsByStrategy[stratKey] = {
                notifications: Array.isArray(result.notifications) ? result.notifications : [],
                nextBets: Array.isArray(result.nextBets) ? result.nextBets : []
            };

            if (stratKey === activeStrategyKey) {
                activeResults = result;
                // Store shadow bets for the active strategy to be resolved next turn
                if (!this.shadowBets) this.shadowBets = {};
                this.shadowBets[stratKey] = result.backgroundResults || [];
            } else {
                this.backgroundBets[stratKey] = result.nextBets || [];
            }
        }
        return {
            ...activeResults,
            resultsByStrategy
        };
    },

    /**
     * Aggregates analytics data for a specific display strategy.
     */
    getAnalyticsData(displayStrategy) {
        let displayStats = {
            wins: 0, losses: 0, net: 0, streak: 0,
            history: [0], patterns: {}
        };

        // Ensure new verbose names are mapped correctly for Analytics chart tracking
        const insideLabels = [
            'RPT',
            '1C RPT',
            'BRKT',
            '1-2-1',
            '1-2-3',
            '2-2',
            'SV BRKT'
        ];

        this.stats.signalLog.forEach(log => {
            let isMatch = false;
            if (displayStrategy === 'series') {
                isMatch = (log.rawStrategy === 'Sequence' || log.rawStrategy === 'TripleCs');
            } else if (displayStrategy === 'combo') {
                isMatch = (log.rawStrategy === 'Combo');
            } else if (displayStrategy === 'inside') {
                isMatch = (log.rawStrategy === 'Inside' || insideLabels.includes(log.rawPattern));
            }

            if (isMatch) {
                if (log.result === 'WIN') {
                    displayStats.wins++;
                    displayStats.streak = displayStats.streak >= 0 ? displayStats.streak + 1 : 1;
                } else {
                    displayStats.losses++;
                    displayStats.streak = displayStats.streak <= 0 ? displayStats.streak - 1 : -1;
                }
                displayStats.net += log.units;
                displayStats.history.push(displayStats.net);

                // Group Triple Cs
                let patternLabel = log.patternName;
                if (log.rawStrategy === 'TripleCs' || (log.patternName && log.patternName.startsWith('TripleCs:'))) {
                    patternLabel = 'Triple Cs';
                }

                if (!displayStats.patterns[patternLabel]) {
                    displayStats.patterns[patternLabel] = { wins: 0, losses: 0 };
                }
                if (log.result === 'WIN') displayStats.patterns[patternLabel].wins++;
                else displayStats.patterns[patternLabel].losses++;
            }
        });

        return displayStats;
    },

    /**
     * Initializes global store subscriptions for stats tracking.
     */
    initTracker() {
        if (window.AppStore) {
            window.AppStore.subscribe((storeState, action) => {
                if (action.type === 'history/append') {
                    const spin = action.payload;
                    if (!window.state) return;

                    if (!window.state.engineStats) {
                        window.state.engineStats = { totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0, bankrollHistory: [0], patternStats: {}, signalLog: [] };
                    }
                    const eStats = window.state.engineStats;

                    if (spin.resolvedBets && spin.resolvedBets.length > 0) {
                        spin.resolvedBets.forEach(bet => {
                            const isWin = bet.isWin;
                            const count = window.FACES && window.FACES[bet.targetFace] ? window.FACES[bet.targetFace].nums.length : 0;
                            const unitChange = isWin ? (35 - count) : -count;
                            const pName = bet.patternName || 'Unknown';

                            if (isWin) {
                                eStats.totalWins++;
                                eStats.currentStreak = eStats.currentStreak >= 0 ? eStats.currentStreak + 1 : 1;
                            } else {
                                eStats.totalLosses++;
                                eStats.currentStreak = eStats.currentStreak <= 0 ? eStats.currentStreak - 1 : -1;
                            }
                            eStats.netUnits += unitChange;
                            eStats.bankrollHistory.push(eStats.netUnits);

                            if (!eStats.patternStats[pName]) eStats.patternStats[pName] = { wins: 0, losses: 0 };
                            if (isWin) eStats.patternStats[pName].wins++;
                            else eStats.patternStats[pName].losses++;

                            eStats.signalLog.push({ result: isWin ? 'WIN' : 'LOSS', units: unitChange, patternName: pName, spinIndex: spin.index, spinNum: spin.num });

                            if (bet.confirmed && window.updateUserStats) window.updateUserStats(isWin, bet, spin.index, unitChange);
                        });
                    }

                    if (window.renderRow) window.renderRow(spin);
                    if (window.renderGapStats) window.renderGapStats();
                } else if (action.type === 'engine/sync') {
                    if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
                    if (window.debounceHeavyUIUpdates) window.debounceHeavyUIUpdates();
                }
            });
        }
    }
};
