/**
 * Inside Pattern - Bracket (brkt)
 */

(function () {
    const pattern = {
        name: 'BRKT',
        key: 'brkt',
        label: 'BRKT',

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

            // Slice 1: Extract last 5 spins and faces safely
            if (!Array.isArray(historyData) || historyData.length < 4) {
                return { notifications, nextBets };
            }

            const len = historyData.length;
            const s0 = len >= 5 ? historyData[len - 5] : null; // S_{n-4}
            const s1 = historyData[len - 4];                   // S_{n-3}
            const s2 = historyData[len - 3];                   // S_{n-2}
            const s3 = historyData[len - 2];                   // S_{n-1}
            const s4 = historyData[len - 1];                   // S_{n}

            const getFace = (spin) => (spin && Array.isArray(spin.faces) && spin.faces.length > 0) ? spin.faces[0] : null;

            const f0 = getFace(s0);
            const f1 = getFace(s1);
            const f2 = getFace(s2);
            const f3 = getFace(s3);
            const f4 = getFace(s4);

            if (f1 === null || f2 === null || f3 === null || f4 === null) {
                return { notifications, nextBets };
            }

            // Slice 2: Implement 3x logic
            if (f0 !== null) {
                const Fx3 = f1;
                if (f0 !== Fx3 && f2 !== Fx3 && f3 !== Fx3 && f4 !== Fx3) {
                    notifications.push({
                        type: 'ACTIVE',
                        strategy: 'inside',
                        patternName: this.name,
                        filterKey: this.key
                    });

                    nextBets.push({
                        targetFace: Fx3,
                        strategy: 'inside',
                        patternName: this.name,
                        comboLabel: '3x Bracket',
                        filterKey: this.key,
                        confirmed: false
                    });
                }
            }

            // Slice 3: Implement 2x logic
            const Fx2 = f2;
            if (f1 !== Fx2 && f3 !== Fx2 && f4 !== Fx2) {
                notifications.push({
                    type: 'ACTIVE',
                    strategy: 'inside',
                    patternName: this.name,
                    filterKey: this.key
                });

                nextBets.push({
                    targetFace: Fx2,
                    strategy: 'inside',
                    patternName: this.name,
                    comboLabel: '2x Bracket',
                    filterKey: this.key,
                    confirmed: false
                });
            }

            // Slice 4: Format output and return
            return { notifications, nextBets };
        }
    };

    if (window.InsideStrategy) {
        window.InsideStrategy.registerPattern(pattern);
    }
})();