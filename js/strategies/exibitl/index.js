(function () {
    'use strict';

    if (typeof window.StrategyRegistry === 'undefined') {
        window.StrategyRegistry = {};
    }

    // ExibitL Pattern Filter Metadata
    // For now we map 0-10 dynamically as sub-patterns if the user wants to toggle them individually
    const PATTERN_FILTER_META_EXIBITL = {
        'ExibitL': {
            label: 'ExibitL Engine',
            hint: 'A completely isolated custom-mapped tracking mode.',
            icon: 'fa-microchip',
            accent: '#BF5AF2'
        }
    };

    window.StrategyRegistry.exibitl = {
        key: 'exibitl',
        label: 'ExibitL Strategy',
        tableHeader: 'EXIBIT \u2022 L', // Unique visual title for the UI Table
        PATTERN_FILTER_META: PATTERN_FILTER_META_EXIBITL,

        buildPatternConfig(enabled = true) {
            return {
                'ExibitL': enabled
            };
        },

        updateAnalytics(val, activeBets, currentSpinIndex) {
            if (window.ExibitlAnalytics && typeof window.ExibitlAnalytics.resolve === 'function') {
                return window.ExibitlAnalytics.resolve(val, activeBets, currentSpinIndex);
            }
            return [];
        },

        /**
         * Main ExibitL sequence logic.
         * Looks up the last spin dynamically against `window.EXIBITL_MAP`.
         */
        run(historyData, snapshot, patternConfig, options = {}) {
            const notifications = [];
            const nextBets = [];

            if (!historyData || historyData.length === 0) return { notifications, nextBets };

            // Check if the user toggled off "ExibitL" inside Pattern Filters
            if (patternConfig['ExibitL'] === false) {
                return { notifications, nextBets };
            }

            const latestSpin = historyData[historyData.length - 1];
            if (!latestSpin) return { notifications, nextBets };

            const targetArray = window.EXIBITL_MAP ? window.EXIBITL_MAP[latestSpin.num] : null;

            if (targetArray && Array.isArray(targetArray) && targetArray.length > 0) {
                const uniqueNumTargets = Array.from(new Set(targetArray.map(Number)));
                
                // Use the modular analyst for face/residual calculation
                const analyzerResult = window.FaceAnalyzer ? window.FaceAnalyzer.checkFaceCoverage(uniqueNumTargets, window.FACES) : { matches: [], residuals: uniqueNumTargets };
                const faceMatches = analyzerResult.matches;
                const residuals = analyzerResult.residuals;

                notifications.push({
                    type: 'ACTIVE',
                    fA: latestSpin.num,
                    fB: null,
                    count: uniqueNumTargets.length,
                    strategy: 'ExibitL',
                    patternName: `Trigger ${latestSpin.num}`,
                    filterKey: 'ExibitL',
                    faceMatches,
                    residuals
                });

                nextBets.push({
                    targetNums: uniqueNumTargets,
                    originSpin: latestSpin.num,
                    strategy: 'ExibitL',
                    highlightIds: [latestSpin.id],
                    patternName: `Trigger ${latestSpin.num}`,
                    filterKey: 'ExibitL',
                    confirmed: false,
                    accentColor: '#BF5AF2',
                    faceMatches,
                    residuals
                });
            } else {
                notifications.push({
                    type: 'INFO',
                    fA: latestSpin.num,
                    fB: null,
                    count: 0,
                    strategy: 'ExibitL',
                    patternName: `Awaiting rules for [${latestSpin.num}]`
                });
            }

            return { notifications, nextBets };
        },

        /**
         * Specialized UI Formatter for ExibitL Mode.
         * Creates the "F[x] and [residuals]" string.
         */
        formatPrediction(entry) {
            if (!entry) return '';
            const matches = entry.faceMatches || [];
            const residuals = entry.residuals || [];
            
            if (matches.length > 0) {
                const faceStr = matches.map(fId => `F${fId}`).join(', ');
                if (residuals.length > 0) {
                    return `${faceStr} AND ${residuals.slice(0, 5).join(', ')}${residuals.length > 5 ? '...' : ''}`;
                }
                return faceStr;
            }
            return entry.patternName || `Trigger ${entry.fA || '?'}`;
        }
    };
})();
