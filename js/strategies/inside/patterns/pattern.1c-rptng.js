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

            // Slice 1: Guard & Extraction
            if (!Array.isArray(historyData) || historyData.length < 3) {
                return { notifications, nextBets };
            }

            const latestSpin = historyData[historyData.length - 1];
            const middleSpin = historyData[historyData.length - 2];
            const oldestSpin = historyData[historyData.length - 3];

            if (!latestSpin || !middleSpin || !oldestSpin || !Array.isArray(latestSpin.faces) || !Array.isArray(middleSpin.faces) || !Array.isArray(oldestSpin.faces) ||
                latestSpin.faces.length === 0 || middleSpin.faces.length === 0 || oldestSpin.faces.length === 0) {
                return { notifications, nextBets };
            }

            const latestFace = latestSpin.faces[0];
            const middleFace = middleSpin.faces[0];
            const oldestFace = oldestSpin.faces[0];

            // Slice 2 & 3: Comparison Logic & Result Construction
            if (latestFace !== undefined && latestFace === oldestFace && latestFace !== middleFace) {
                notifications.push({
                    type: 'ACTIVE',
                    strategy: 'inside',
                    patternName: this.name,
                    filterKey: this.key
                });

                nextBets.push({
                    targetFace: latestFace,
                    strategy: 'inside',
                    patternName: this.name,
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