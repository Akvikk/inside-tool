/**
 * Inside Strategy - Main Controller
 * Orchestrates the execution of all sub-patterns for the "Inside Patterns" mode.
 */

(function () {
    const InsideStrategy = {
        name: 'Inside Patterns',
        key: 'inside',
        
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
            const resultsByPattern = {};

            // Iterate through all registered patterns
            for (const key of Object.keys(this.patterns)) {
                const pattern = this.patterns[key];
                
                // Allow disabling specific patterns via config
                if (patternConfig && patternConfig[key] === false) continue;

                try {
                    const result = pattern.run(historyData, snapshot, patternConfig, options);
                    
                    if (result) {
                        if (Array.isArray(result.notifications)) {
                            notifications.push(...result.notifications);
                        }
                        if (Array.isArray(result.nextBets)) {
                            nextBets.push(...result.nextBets);
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
                resultsByPattern
            };
        },

        /**
         * Generates a default config for all sub-patterns.
         */
        buildPatternConfig(enabled = true) {
            const config = {};
            for (const key of Object.keys(this.patterns)) {
                config[key] = enabled;
            }
            return config;
        }
    };

    // Attach to window for global access and registration
    window.InsideStrategy = InsideStrategy;
})();
