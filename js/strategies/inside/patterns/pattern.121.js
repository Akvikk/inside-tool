/**
 * Inside Pattern - 1-2-1 (121)
 */

(function () {
    const pattern = {
        name: '1-2-1',
        key: '121',
        label: '1-2-1',

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

            // Slice 1: Extract last 7 faces safely
            if (!Array.isArray(historyData) || historyData.length < 7) {
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
            const f_6 = getFace(len - 6);
            const f_7 = getFace(len - 7); // Oldest of the 7

            if (f_1 === null || f_2 === null || f_3 === null || f_4 === null || f_5 === null || f_6 === null || f_7 === null) {
                return { notifications, nextBets };
            }

            // Slice 2: Implement the multi-step verification
            const Fx = f_7;
            const isMatch = (f_6 !== Fx && f_5 === Fx && f_4 !== Fx && f_3 !== Fx && f_2 === Fx && f_1 !== Fx);

            // Slice 3: Return notifications and nextBets
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
                    comboLabel: '1-2-1 Gap Symmetry',
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