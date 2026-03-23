/**
 * Inside Pattern - 2-2 (22)
 */

(function () {
    const pattern = {
        name: '2-2',
        key: '22',
        label: '2-2',

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

            // Slice 1: Extract last 6 faces safely
            if (!Array.isArray(historyData) || historyData.length < 6) {
                return { notifications, nextBets };
            }

            const len = historyData.length;
            const getFace = (index) => {
                const spin = historyData[index];
                return (spin && Array.isArray(spin.faces) && spin.faces.length > 0) ? spin.faces[0] : null;
            };

            const f_1 = getFace(len - 1); // Latest
            const f_2 = getFace(len - 2);
            const f_3 = getFace(len - 3);
            const f_4 = getFace(len - 4);
            const f_5 = getFace(len - 5);
            const f_6 = getFace(len - 6); // Oldest of the 6

            if (f_1 === null || f_2 === null || f_3 === null || f_4 === null || f_5 === null || f_6 === null) {
                return { notifications, nextBets };
            }

            // Slice 2: Implement the logical check
            const Fx = f_1;
            const isMatch = (f_2 === Fx && f_3 !== Fx && f_4 === Fx && f_5 === Fx && f_6 !== Fx);

            // Slice 3: Return results with filterKey: '22'
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
                    comboLabel: '2-2 Pattern',
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