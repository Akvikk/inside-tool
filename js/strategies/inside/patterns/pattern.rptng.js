/**
 * Inside Pattern - Repeating (RPTng)
 */

(function () {
    const pattern = {
        name: 'Repeating',
        key: 'rptng',
        label: 'RPTng',

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

            // Slice 1: History Extraction & Guards
            if (!Array.isArray(historyData) || historyData.length < 2) {
                return { notifications, nextBets };
            }

            const latestSpin = historyData[historyData.length - 1];
            const prevSpin = historyData[historyData.length - 2];

            if (!latestSpin || !prevSpin || !Array.isArray(latestSpin.faces) || !Array.isArray(prevSpin.faces) ||
                latestSpin.faces.length === 0 || prevSpin.faces.length === 0) {
                return { notifications, nextBets };
            }

            const latestFace = latestSpin.faces[0];
            const prevFace = prevSpin.faces[0];

            // Slice 2 & 3: Pattern Match, Notification & Bet Generation
            if (latestFace !== undefined && latestFace === prevFace) {
                notifications.push({
                    type: 'ACTIVE',
                    strategy: 'Inside',
                    patternName: 'Repeating'
                });

                nextBets.push({
                    targetFace: latestFace,
                    strategy: 'Inside',
                    patternName: 'Repeating',
                    confirmed: false
                });
            }

            return {
                notifications,
                nextBets
            };
        }
    };

    if (window.InsideStrategy) {
        window.InsideStrategy.registerPattern(pattern);
    }
})();
