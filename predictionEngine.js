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

const PERIMETER_COMBOS = [
    { label: '5-2', a: 5, b: 2, color: '#FF3B30' },
    { label: '5-3', a: 5, b: 3, color: '#FF9500' },
    { label: '1-3', a: 1, b: 3, color: '#34C759' },
    { label: '2-4', a: 2, b: 4, color: '#007AFF' }
];

const PredictionEngine = {
    calculatePerimeterStats: function (history, windowSize = 14) {
        const parsedWindow = parseInt(windowSize, 10);
        const safeWindow = Number.isNaN(parsedWindow) ? 14 : Math.max(2, Math.min(60, parsedWindow));
        const recentSpins = Array.isArray(history) ? history.slice(-safeWindow) : [];

        let counts = { '5-2': 0, '5-3': 0, '1-3': 0, '2-4': 0 };
        let lastSeen = { '5-2': -1, '5-3': -1, '1-3': -1, '2-4': -1 };

        for (let i = 1; i < recentSpins.length; i++) {
            const prevSpin = recentSpins[i - 1];
            const currSpin = recentSpins[i];
            
            if (!prevSpin || !currSpin || !prevSpin.faces || !currSpin.faces) continue;

            PERIMETER_COMBOS.forEach(combo => {
                // Check for ANY matching face pair (handling overlapping faces like 10, 15, 24)
                const prevHasA = prevSpin.faces.includes(combo.a);
                const prevHasB = prevSpin.faces.includes(combo.b);
                const currHasA = currSpin.faces.includes(combo.a);
                const currHasB = currSpin.faces.includes(combo.b);

                const matched = (prevHasA && currHasB) || (prevHasB && currHasA);
                
                if (matched) {
                    counts[combo.label]++;
                    lastSeen[combo.label] = i;
                }
            });
        }

        const highestCount = Math.max(counts['5-2'], counts['5-3'], counts['1-3'], counts['2-4']);
        let dominantCombo = null;
        if (highestCount > 0) {
            const contenders = PERIMETER_COMBOS.filter(combo => (counts[combo.label] || 0) === highestCount);
            dominantCombo = contenders[0] || null;
            contenders.forEach(combo => {
                const currentLastSeen = lastSeen[dominantCombo.label] || -1;
                const nextLastSeen = lastSeen[combo.label] || -1;
                if (nextLastSeen > currentLastSeen) {
                    dominantCombo = combo;
                }
            });
        }

        return {
            windowSize: safeWindow,
            recentSpins: recentSpins,
            // Use the first face for simple sequence display, but stats used all faces
            latestPrimaryFace: recentSpins.length > 0 && recentSpins[recentSpins.length - 1].faces ? recentSpins[recentSpins.length - 1].faces[0] : null,
            sequence: recentSpins.map(s => (s.faces && s.faces.length > 0 ? s.faces[0] : '?')),
            counts: counts,
            dominantCombo: dominantCombo,
            lastSeen: lastSeen
        };
    },

    updateFONTracker: function (history, windowSize = 14) {
        const stats = this.calculatePerimeterStats(history, windowSize);

        const titleEl = document.getElementById('fonTrackerWindowLabel');
        if (titleEl) {
            titleEl.innerText = `FON Combo Tracker (${stats.windowSize} Spins)`;
        }

        const sequenceDisplay = document.getElementById('fonSequenceDisplay');
        if (sequenceDisplay) {
            if (!stats.sequence || stats.sequence.length === 0) {
                sequenceDisplay.innerHTML = '<span class="italic text-white/10">Awaiting data...</span>';
            } else {
                sequenceDisplay.innerHTML = stats.sequence.join(' <i class="fas fa-arrow-right text-[6px] text-white/20 mx-1"></i> ');
            }
        }

        const c52 = document.getElementById('combo-52');
        const c53 = document.getElementById('combo-53');
        const c13 = document.getElementById('combo-13');
        const c24 = document.getElementById('combo-24');
        if (c52) c52.innerText = stats.counts['5-2'];
        if (c53) c53.innerText = stats.counts['5-3'];
        if (c13) c13.innerText = stats.counts['1-3'];
        if (c24) c24.innerText = stats.counts['2-4'];
    }
};

console.log("Prediction Engine Loaded");
