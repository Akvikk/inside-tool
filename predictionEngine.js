/**
 * PREDICTION ENGINE
 * This file houses the logic for the Faces of Numbers (FON) Combo Tracker
 * and other predictive analytics.
 */

const FACES = {
    1: { id: 1, nums: [1, 6, 10, 15, 24, 29, 33], color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: '#0891b2' }, // Cyan
    2: { id: 2, nums: [2, 7, 11, 16, 20, 24, 25, 29, 34], color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: '#ea580c' }, // Orange
    3: { id: 3, nums: [3, 8, 12, 17, 21, 26, 30, 35], color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: '#9333ea' }, // Purple
    4: { id: 4, nums: [4, 9, 13, 18, 22, 27, 31, 36], color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: '#ca8a04' }, // Yellow
    5: { id: 5, nums: [0, 5, 10, 14, 15, 19, 23, 28, 32], color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#dc2626' } // Red
};

const PredictionEngine = {
    updateFONTracker: function (history) {
        if (!history || history.length === 0) return;

        // 1. Get last 14 spins
        const last14 = history.slice(-14);

        // 2. Build Sequence Display
        const sequenceDisplay = document.getElementById('fonSequenceDisplay');
        if (sequenceDisplay) {
            const sequenceArray = last14.map(spin => {
                if (spin.faces && spin.faces.length > 0) return spin.faces[0];
                return '?';
            });
            sequenceDisplay.innerHTML = sequenceArray.join(' <i class="fas fa-arrow-right text-[6px] text-white/20 mx-1"></i> ');
        }

        // 3. Calculate Combo Counts
        let counts = { '5-2': 0, '5-3': 0, '1-3': 0, '2-4': 0 };

        for (let i = 1; i < last14.length; i++) {
            let prevFaces = last14[i - 1].faces || [];
            let currFaces = last14[i].faces || [];

            let found = { '5-2': false, '5-3': false, '1-3': false, '2-4': false };

            for (let p of prevFaces) {
                for (let c of currFaces) {
                    if ((p === 5 && c === 2) || (p === 2 && c === 5)) found['5-2'] = true;
                    if ((p === 5 && c === 3) || (p === 3 && c === 5)) found['5-3'] = true;
                    if ((p === 1 && c === 3) || (p === 3 && c === 1)) found['1-3'] = true;
                    if ((p === 2 && c === 4) || (p === 4 && c === 2)) found['2-4'] = true;
                }
            }

            if (found['5-2']) counts['5-2']++;
            if (found['5-3']) counts['5-3']++;
            if (found['1-3']) counts['1-3']++;
            if (found['2-4']) counts['2-4']++;
        }

        // 4. Update UI
        document.getElementById('combo-52').innerText = counts['5-2'];
        document.getElementById('combo-53').innerText = counts['5-3'];
        document.getElementById('combo-13').innerText = counts['1-3'];
        document.getElementById('combo-24').innerText = counts['2-4'];
    }
};

console.log("Prediction Engine Loaded");
