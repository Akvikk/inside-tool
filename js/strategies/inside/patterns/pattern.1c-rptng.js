/**
 * Inside Pattern - One Cut Repeating (1c-rptng)
 */

(function () {
    const pattern = {
        name: '1C RPT',
        key: '1c-rptng',
        label: '1C RPT',

        /**
         * Run the pattern detection logic.
         */
        run(historyData, snapshot, config, options = {}) {
            const notifications = [];
            const nextBets = [];

            // Validation: Ensure the config flag is honored
            if (config && config[this.key] === false) {
                return { notifications, nextBets };
            }

            // Slice 1: Guard & Extraction (Need at least 5 spins for "# 5 # 5 #")
            if (!Array.isArray(historyData) || historyData.length < 5) {
                return { notifications, nextBets };
            }

            const getFace = (index) => {
                const spin = historyData[index];
                return (spin && Array.isArray(spin.faces) && spin.faces.length > 0) ? spin.faces[0] : null;
            };

            const len = historyData.length;
            const f_1 = getFace(len - 1); // Latest (#) - Spin 5
            const f_2 = getFace(len - 2); // (5) - Spin 4
            const f_3 = getFace(len - 3); // (#) - Spin 3
            const f_4 = getFace(len - 4); // (5) - Spin 2
            const f_5 = getFace(len - 5); // (#) - Spin 1

            if (f_1 === null || f_2 === null || f_3 === null || f_4 === null || f_5 === null) {
                return { notifications, nextBets };
            }

            /**
             * "One Cut" 6-Spin vision logic:
             * Spin 1: # (Not Fx)
             * Spin 2: Fx
             * Spin 3: # (Not Fx)
             * Spin 4: Fx
             * Spin 5: # (Not Fx)
             * -> Result: Bet Fx for Spin 6
             */
            const Fx = f_4; // The target is F5 (Spin 2/4)
            const isMatch = (f_2 === Fx && f_5 !== Fx && f_3 !== Fx && f_1 !== Fx);

            // Slice 2 & 3: Comparison Logic & Result Construction
            if (isMatch) {
                notifications.push({
                    type: 'ACTIVE',
                    strategy: 'inside',
                    patternName: this.name,
                    filterKey: this.key
                });

                nextBets.push({
                    targetFace: Fx,
                    strategy: 'inside',
                    patternName: this.name,
                    comboLabel: 'One Cut Riff',
                    filterKey: this.key,
                    confirmed: false
                });
            }

            return { notifications, nextBets };
        }
    };

    if (window.InsideStrategy) {
        window.InsideStrategy.registerPattern(pattern);
    }
})();