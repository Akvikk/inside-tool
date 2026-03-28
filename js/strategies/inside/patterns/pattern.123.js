/**
 * Inside Pattern - 1-2-3 (123)
 */

(function () {
    const pattern = {
        name: '1-2-3',
        key: '123',
        label: '1-2-3',

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

            // Slice 1: Safely extract the last 3 faces.
            if (!Array.isArray(historyData) || historyData.length < 3) {
                return { notifications, nextBets };
            }

            const len = historyData.length;
            const getFace = (index) => {
                const spin = historyData[index];
                return (spin && Array.isArray(spin.faces) && spin.faces.length > 0) ? spin.faces[0] : null;
            };

            const f_1 = getFace(len - 1); // Latest
            const f_2 = getFace(len - 2);
            const f_3 = getFace(len - 3); // Oldest

            if (f_1 === null || f_2 === null || f_3 === null) {
                return { notifications, nextBets };
            }

            // Slice 2: Implement the strict +1 / -1 progression check.
            const isIncreasing = (f_3 + 1 === f_2) && (f_2 + 1 === f_1);
            const isDecreasing = (f_3 - 1 === f_2) && (f_2 - 1 === f_1);

            // Slice 3: Return results with dynamic label based on direction.
            if (isIncreasing || isDecreasing) {
                const directionLabel = isIncreasing ? '1-2-3 Progression' : '3-2-1 Progression';

                notifications.push({ type: 'ACTIVE', strategy: 'inside', patternName: this.name, filterKey: this.key });
                nextBets.push({
                    targetFace: f_1, strategy: 'inside', patternName: this.name, comboLabel: directionLabel, filterKey: this.key, confirmed: false
                });
            }

            return { notifications, nextBets };
        }
    };

    if (window.InsideStrategy) {
        window.InsideStrategy.registerPattern(pattern);
    }
})();