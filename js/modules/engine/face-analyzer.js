(function () {
    'use strict';

    /**
     * Face Analyzer - Standalone Utility
     * Analyzes number sets to identify complete Face Group coverage.
     */
    const FaceAnalyzer = {
        /**
         * Checks if a set of numbers covers any Face Groups completely.
         * @param {Array<number>} numbers - The predicted numbers.
         * @param {Object} faces - The reference FACES object.
         * @returns {Object} { matches: [faceId...], residuals: [num...] }
         */
        checkFaceCoverage(numbers, faces) {
            if (!numbers || !Array.isArray(numbers) || numbers.length === 0) {
                return { matches: [], residuals: [] };
            }

            const faceMatches = [];
            const referenceFaces = faces || window.FACES || {};

            for (const faceId in referenceFaces) {
                const faceNums = referenceFaces[faceId].nums;
                // Check if ALL numbers in this face are present in the provided list
                const missing = faceNums.filter(n => !numbers.includes(n));
                if (missing.length === 0) {
                    faceMatches.push(parseInt(faceId));
                }
            }

            // Residuals: Predicted numbers not belonging to a 100% matched face
            let residuals = numbers;
            if (faceMatches.length > 0) {
                const allMatchedFaceNums = new Set();
                faceMatches.forEach(fId => {
                    if (referenceFaces[fId]) {
                        referenceFaces[fId].nums.forEach(n => allMatchedFaceNums.add(n));
                    }
                });
                residuals = numbers.filter(n => !allMatchedFaceNums.has(n));
            }

            return {
                matches: faceMatches,
                residuals: residuals
            };
        }
    };

    window.FaceAnalyzer = FaceAnalyzer;
    console.log('[FaceAnalyzer] Utility Loaded');
})();
