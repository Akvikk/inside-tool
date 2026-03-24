/**
 * Inside Strategy - Main Controller
 * Orchestrates the execution of all sub-patterns for the "Inside Patterns" mode.
 */

(function () {
    const InsideStrategy = {
        name: 'Inside Patterns',
        key: 'inside',
        tableHeader: 'PATTERN',

        PATTERN_FILTER_META: {
            'rptng': { label: 'Repeating', hint: 'Repeating Pattern', accent: '#30D158' },
            '1c-rptng': { label: 'One Cut Repeating', hint: 'One Cut Repeating Pattern', accent: '#30D158' },
            'brkt': { label: 'Bracket', hint: 'Bracket Pattern', accent: '#30D158' },
            '121': { label: '1-2-1', hint: '1-2-1 Pattern', accent: '#30D158' },
            '123': { label: '1-2-3', hint: '1-2-3 Pattern', accent: '#30D158' },
            '22': { label: '2-2', hint: '2-2 Pattern', accent: '#30D158' },
            'seqvarbrkt': { label: 'SeqVarBrkt', hint: 'Sequence and Variation Bracket', accent: '#30D158' }
        },

        // Explicit chronological order of patterns
        PATTERN_ORDER: [
            'rptng',
            '1c-rptng',
            'brkt',
            '121',
            '123',
            '22',
            'seqvarbrkt'
        ],

        // Registry for all sub-patterns
        patterns: {},

        /**
         * Registers a new sub-pattern.
         * @param {Object} pattern - The pattern implementation module.
         */
        registerPattern(pattern) {
            if (!pattern.key) {
                console.warn('[InsideStrategy] Pattern is missing key:', pattern);
                return;
            }
            this.patterns[pattern.key] = pattern;
            console.log(`[InsideStrategy] Pattern registered: ${pattern.name} (${pattern.key})`);
        },

        /**
         * Main execution point for the strategy.
         */
        run(historyData, snapshot, patternConfig, options = {}) {
            const notifications = [];
            const nextBets = [];
            const backgroundResults = [];
            const resultsByPattern = {};

            // Iterate through all registered patterns strictly in chronological order
            const orderedKeys = this.PATTERN_ORDER || Object.keys(this.patterns);
            for (const key of orderedKeys) {
                const pattern = this.patterns[key];

                // Skip if a defined pattern isn't loaded/registered yet
                if (!pattern) continue;

                const isEnabled = !(patternConfig && patternConfig[key] === false);

                try {
                    const result = pattern.run(historyData, snapshot, patternConfig, options);

                    if (result) {
                        if (isEnabled) {
                            if (Array.isArray(result.notifications)) {
                                notifications.push(...result.notifications);
                            }
                            if (Array.isArray(result.nextBets)) {
                                nextBets.push(...result.nextBets);
                            }
                        } else {
                            if (Array.isArray(result.nextBets)) {
                                backgroundResults.push(...result.nextBets);
                            }
                        }
                        resultsByPattern[key] = result;
                    }
                } catch (error) {
                    console.error(`[InsideStrategy] Error running pattern ${key}:`, error);
                }
            }

            return {
                notifications,
                nextBets,
                backgroundResults,
                resultsByPattern
            };
        },

        /**
         * Generates a default config for all sub-patterns.
         */
        buildPatternConfig(enabled = true) {
            const config = {};
            // Enforce chronological ordering for the UI default configuration state
            const keys = this.PATTERN_ORDER || Object.keys(this.patterns);
            for (const key of keys) {
                config[key] = enabled;
            }
            return config;
        }
    };

    // Attach to window for global access and registration
    window.InsideStrategy = InsideStrategy;
    if (typeof window.StrategyRegistry === 'undefined') window.StrategyRegistry = {};
    window.StrategyRegistry.inside = InsideStrategy;
})();
