/**
 * PREDICTION ENGINE
 * Optimized for direct file:/// execution without workers.
 */

const FACE_MASKS = Object.freeze({
    1: 1,
    2: 2,
    3: 4,
    4: 8,
    5: 16
});

const FON_MAP = Object.freeze({
    0: [5],
    1: [1],
    2: [2],
    3: [3],
    4: [4],
    5: [5],
    6: [1],
    7: [2],
    8: [3],
    9: [4],
    10: [1, 5],
    11: [2],
    12: [3],
    13: [4],
    14: [5],
    15: [1, 5],
    16: [2],
    17: [3],
    18: [4],
    19: [5],
    20: [2],
    21: [3],
    22: [4],
    23: [5],
    24: [1, 2],
    25: [2],
    26: [3],
    27: [4],
    28: [5],
    29: [1, 2],
    30: [3],
    31: [4],
    32: [5],
    33: [1],
    34: [2],
    35: [3],
    36: [4]
});

const FON_MASK_MAP = Object.freeze(Object.fromEntries(
    Object.keys(FON_MAP).map(key => {
        const faces = FON_MAP[key];
        let mask = 0;
        for (let i = 0; i < faces.length; i++) {
            mask |= FACE_MASKS[faces[i]];
        }
        return [key, mask];
    })
));

const FON_PRIMARY_FACE_MAP = Object.freeze(Object.fromEntries(
    Object.keys(FON_MAP).map(key => [key, FON_MAP[key][0]])
));

const FACES = {
    1: { id: 1, nums: [1, 6, 10, 15, 24, 29, 33], color: '#06b6d4', bg: 'rgba(6, 182, 212, 0.15)', border: '#0891b2' },
    2: { id: 2, nums: [2, 7, 11, 16, 20, 24, 25, 29, 34], color: '#f97316', bg: 'rgba(249, 115, 22, 0.15)', border: '#ea580c' },
    3: { id: 3, nums: [3, 8, 12, 17, 21, 26, 30, 35], color: '#a855f7', bg: 'rgba(168, 85, 247, 0.15)', border: '#9333ea' },
    4: { id: 4, nums: [4, 9, 13, 18, 22, 27, 31, 36], color: '#eab308', bg: 'rgba(234, 179, 8, 0.15)', border: '#ca8a04' },
    5: { id: 5, nums: [0, 5, 10, 14, 15, 19, 23, 28, 32], color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)', border: '#dc2626' }
};

const PERIMETER_COMBOS = [
    { label: '5-2', a: 5, b: 2, color: '#FF3B30' },
    { label: '5-3', a: 5, b: 3, color: '#FF9500' },
    { label: '1-3', a: 1, b: 3, color: '#34C759' },
    { label: '2-4', a: 2, b: 4, color: '#007AFF' }
];

const PERIMETER_COMBO_LOOKUP = Object.freeze(
    PERIMETER_COMBOS.map(combo => ({
        ...combo,
        maskA: FACE_MASKS[combo.a],
        maskB: FACE_MASKS[combo.b]
    }))
);

const ENGINE_CHUNK_SIZE = 500;
const RECENT_CONFIRMATION_WINDOW = 5;
const RECENT_FATIGUE_WINDOW = 14;
const EMPTY_FACES = Object.freeze([]);

function normalizeWindowSize(windowSize, fallback = RECENT_FATIGUE_WINDOW, maxWindow = 60) {
    if (windowSize === 'all' || windowSize === Infinity || windowSize === null) return 'all';
    const parsedWindow = parseInt(windowSize, 10);
    if (Number.isNaN(parsedWindow)) return fallback;
    return Math.max(2, Math.min(maxWindow, parsedWindow));
}

function getSpinNumber(spin) {
    if (Number.isInteger(spin)) return spin;
    if (spin && Number.isInteger(spin.num)) return spin.num;

    const parsed = parseInt(spin, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function getFacesForNumber(number) {
    return Object.prototype.hasOwnProperty.call(FON_MAP, number) ? FON_MAP[number] : EMPTY_FACES;
}

function getMaskForNumber(number) {
    return Object.prototype.hasOwnProperty.call(FON_MASK_MAP, number) ? FON_MASK_MAP[number] : 0;
}

function hasFace(mask, faceId) {
    return (mask & FACE_MASKS[faceId]) !== 0;
}

function isComboHit(prevMask, currMask, combo) {
    return ((prevMask & combo.maskA) !== 0 && (currMask & combo.maskB) !== 0) ||
        ((prevMask & combo.maskB) !== 0 && (currMask & combo.maskA) !== 0);
}

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function emitPredictionProgress(percent, detail = {}) {
    const processed = Number.isFinite(detail.processed) ? detail.processed : 0;
    const total = Number.isFinite(detail.total) ? detail.total : 0;
    const message = total > 0
        ? `Prediction Engine ${percent}% (${processed}/${total})`
        : `Prediction Engine ${percent}%`;

    console.log(message);

    if (typeof document === 'undefined') return;

    const checkpointSummary = document.getElementById('intelCheckpointSummary');
    if (checkpointSummary) checkpointSummary.innerText = message;

    const checkpointMeta = document.getElementById('intelNextCheckpointMeta');
    if (checkpointMeta) {
        checkpointMeta.innerText = total > 0
            ? `${processed}/${total} spins processed`
            : 'Awaiting spins';
    }
}

function buildWindowStats(validSpinCount, primaryFaceHistory, comboHitLists, windowSize) {
    const normalizedWindow = normalizeWindowSize(windowSize);
    const sampleSize = normalizedWindow === 'all'
        ? validSpinCount
        : Math.min(validSpinCount, normalizedWindow);
    const safeSampleSize = Math.max(validSpinCount > 0 ? 1 : 0, sampleSize);
    const transitionCount = Math.max(0, safeSampleSize - 1);
    const startTransitionIndex = Math.max(0, validSpinCount - safeSampleSize);
    const counts = Object.fromEntries(PERIMETER_COMBOS.map(combo => [combo.label, 0]));
    const lastSeen = Object.fromEntries(PERIMETER_COMBOS.map(combo => [combo.label, -1]));

    const comboStats = PERIMETER_COMBO_LOOKUP.map(combo => {
        const hitList = comboHitLists[combo.label];
        let hits = 0;
        let lastSeenIndex = -1;

        for (let i = hitList.length - 1; i >= 0; i--) {
            const hitIndex = hitList[i];
            if (hitIndex < startTransitionIndex) break;
            hits++;
            if (lastSeenIndex === -1) lastSeenIndex = hitIndex;
        }

        counts[combo.label] = hits;
        lastSeen[combo.label] = lastSeenIndex;

        const misses = Math.max(0, transitionCount - hits);
        const hitRate = transitionCount > 0 ? Math.round((hits / transitionCount) * 100) : 0;
        const missRate = transitionCount > 0 ? Math.round((misses / transitionCount) * 100) : 0;
        const sampleMisses = Math.max(0, safeSampleSize - hits);
        const hotPercent = safeSampleSize > 0 ? Math.round((hits / safeSampleSize) * 100) : 0;
        const coldPercent = safeSampleSize > 0 ? Math.round((sampleMisses / safeSampleSize) * 100) : 0;
        const drought = transitionCount === 0
            ? 0
            : (lastSeenIndex === -1
                ? transitionCount
                : Math.max(0, (validSpinCount - 2) - lastSeenIndex));
        let state = 'idle';

        if (safeSampleSize > 0) {
            if (hits === 0) state = 'cold';
            else if (hotPercent >= 25) state = 'hot';
            else if (coldPercent >= 75) state = 'cold';
            else state = 'neutral';
        }

        return {
            ...combo,
            hits,
            misses,
            hitRate,
            missRate,
            sampleMisses,
            hotPercent,
            coldPercent,
            drought,
            lastSeenIndex,
            lastSeenDistance: drought,
            coldScore: coldPercent,
            sampleSize: safeSampleSize,
            state,
            transitionCount
        };
    });

    const sortedCombos = comboStats
        .slice()
        .sort((a, b) => (b.hits - a.hits) || ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) || (a.label > b.label ? 1 : -1));

    const dominantCombo = sortedCombos.length > 0 && sortedCombos[0].hits > 0 ? sortedCombos[0] : null;
    const coldLeader = comboStats
        .slice()
        .sort((a, b) => b.coldPercent - a.coldPercent || b.sampleMisses - a.sampleMisses || a.hits - b.hits)[0] || null;
    const hotLeader = comboStats
        .slice()
        .sort((a, b) => b.hotPercent - a.hotPercent || b.hits - a.hits || a.sampleMisses - b.sampleMisses)[0] || null;

    return {
        windowSize: safeSampleSize,
        recentSpins: [],
        sampleSize: safeSampleSize,
        transitionCount,
        latestPrimaryFace: primaryFaceHistory.length > 0 ? primaryFaceHistory[primaryFaceHistory.length - 1] : null,
        sequence: safeSampleSize > 0 ? primaryFaceHistory.slice(-safeSampleSize) : [],
        counts,
        dominantCombo,
        lastSeen,
        comboStats,
        coldLeader,
        hotLeader
    };
}

const PredictionEngine = {
    calculatePerimeterStats: function (history, windowSize = RECENT_FATIGUE_WINDOW) {
        const historyArray = Array.isArray(history) ? history : [];
        const normalizedWindow = normalizeWindowSize(windowSize);
        const maxSampleSize = normalizedWindow === 'all'
            ? historyArray.length
            : Math.min(historyArray.length, normalizedWindow);
        const startIndex = Math.max(0, historyArray.length - maxSampleSize);
        const comboHitLists = Object.fromEntries(PERIMETER_COMBOS.map(combo => [combo.label, []]));
        const primaryFaceHistory = [];
        let validSpinCount = 0;
        let lastMask = 0;

        for (let i = startIndex; i < historyArray.length; i++) {
            const spinNumber = getSpinNumber(historyArray[i]);
            if (spinNumber === null || !Object.prototype.hasOwnProperty.call(FON_MAP, spinNumber)) continue;

            const mask = getMaskForNumber(spinNumber);
            primaryFaceHistory.push(FON_PRIMARY_FACE_MAP[spinNumber]);

            if (validSpinCount > 0) {
                const transitionIndex = validSpinCount - 1;
                for (let comboIndex = 0; comboIndex < PERIMETER_COMBO_LOOKUP.length; comboIndex++) {
                    const combo = PERIMETER_COMBO_LOOKUP[comboIndex];
                    if (isComboHit(lastMask, mask, combo)) {
                        comboHitLists[combo.label].push(transitionIndex);
                    }
                }
            }

            lastMask = mask;
            validSpinCount++;
        }

        return buildWindowStats(validSpinCount, primaryFaceHistory, comboHitLists, normalizedWindow);
    },

    evaluatePredictionEngine: async function (allSpins, options = {}) {
        const source = Array.isArray(allSpins) ? allSpins : [];
        const chunkSize = Number.isFinite(options.chunkSize) && options.chunkSize > 0
            ? Math.max(1, Math.floor(options.chunkSize))
            : ENGINE_CHUNK_SIZE;
        const onProgress = typeof options.onProgress === 'function'
            ? options.onProgress
            : emitPredictionProgress;
        const faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        const comboHitLists = Object.fromEntries(PERIMETER_COMBOS.map(combo => [combo.label, []]));
        const primaryFaceHistory = [];
        let validSpinCount = 0;
        let previousMask = 0;
        let previousFaces = EMPTY_FACES;
        let previousPrimaryFace = null;
        let lastMask = 0;
        let lastFaces = EMPTY_FACES;
        let lastPrimaryFace = null;

        for (let chunkStart = 0; chunkStart < source.length; chunkStart += chunkSize) {
            const chunkEnd = Math.min(source.length, chunkStart + chunkSize);

            for (let i = chunkStart; i < chunkEnd; i++) {
                const spinNumber = getSpinNumber(source[i]);
                if (spinNumber === null || !Object.prototype.hasOwnProperty.call(FON_MAP, spinNumber)) continue;

                const faces = getFacesForNumber(spinNumber);
                const mask = getMaskForNumber(spinNumber);
                const primaryFace = FON_PRIMARY_FACE_MAP[spinNumber];
                const priorMask = lastMask;
                const priorFaces = lastFaces;
                const priorPrimaryFace = lastPrimaryFace;

                for (let faceId = 1; faceId <= 5; faceId++) {
                    faceGaps[faceId]++;
                }
                for (let faceIndex = 0; faceIndex < faces.length; faceIndex++) {
                    faceGaps[faces[faceIndex]] = 0;
                }

                if (validSpinCount > 0) {
                    const transitionIndex = validSpinCount - 1;
                    for (let comboIndex = 0; comboIndex < PERIMETER_COMBO_LOOKUP.length; comboIndex++) {
                        const combo = PERIMETER_COMBO_LOOKUP[comboIndex];
                        if (isComboHit(priorMask, mask, combo)) {
                            comboHitLists[combo.label].push(transitionIndex);
                        }
                    }
                    previousMask = priorMask;
                    previousFaces = priorFaces;
                    previousPrimaryFace = priorPrimaryFace;
                }

                lastMask = mask;
                lastFaces = faces;
                lastPrimaryFace = primaryFace;
                primaryFaceHistory.push(primaryFace);
                validSpinCount++;
            }

            const percent = source.length === 0 ? 100 : Math.round((chunkEnd / source.length) * 100);
            onProgress(percent, {
                processed: chunkEnd,
                total: source.length
            });

            if (chunkEnd < source.length) {
                await new Promise(resolve => setTimeout(resolve, 0));
            }
        }

        const stats14 = buildWindowStats(validSpinCount, primaryFaceHistory, comboHitLists, RECENT_FATIGUE_WINDOW);
        const stats5 = buildWindowStats(validSpinCount, primaryFaceHistory, comboHitLists, RECENT_CONFIRMATION_WINDOW);
        const rankedCombos = stats14.comboStats
            .slice()
            .sort((a, b) => (b.hits - a.hits) || ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) || (a.label > b.label ? 1 : -1));
        const dominantCombo = stats14.dominantCombo || null;
        const runnerUpCombo = rankedCombos.find(combo => !dominantCombo || combo.label !== dominantCombo.label) || null;
        const exhaustedCombos = stats14.comboStats
            .filter(combo => combo.hits >= 3)
            .sort((a, b) => (b.hits - a.hits) || ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) || (a.label > b.label ? 1 : -1));

        let targetFace = null;
        let action = 'WAIT';
        let confidence = 0;
        let ruleKey = 'no-signal';
        let ruleLabel = 'No Signal';
        let signalLabel = 'No Signal';
        let detail = validSpinCount < 2
            ? 'Need at least two valid spins for a full read.'
            : 'No terminal rule triggered on the latest state.';
        let triggerFace = null;
        let fadedFace = null;
        let focusCombo = dominantCombo;
        let markovSequenceLabel = null;
        let fatigueComboLabel = null;

        if (typeof currentPredictionStrategy !== 'undefined' && currentPredictionStrategy === 'legacy-face') {
            // --- LEGACY FACE PREDICTOR ---
            if (validSpinCount >= 2 && hasFace(previousMask, 4) && hasFace(lastMask, 5)) {
                targetFace = 4;
                action = 'BET';
                confidence = 92;
                ruleKey = 'markov-4-5';
                ruleLabel = 'Markov Trigger';
                signalLabel = 'F4 -> F5';
                detail = 'Latest two spins formed F4 -> F5, so the engine snaps back to Face 4.';
                triggerFace = 5;
                markovSequenceLabel = 'F4 -> F5';
            } else if (validSpinCount >= 2 && hasFace(previousMask, 2) && hasFace(lastMask, 2)) {
                targetFace = 5;
                action = 'BET';
                confidence = 88;
                ruleKey = 'markov-2-2';
                ruleLabel = 'Markov Trigger';
                signalLabel = 'F2 -> F2';
                detail = 'Latest two spins held on Face 2, so the engine rotates to Face 5.';
                triggerFace = 2;
                markovSequenceLabel = 'F2 -> F2';
            } else if (faceGaps[5] >= 10) {
                targetFace = 5;
                action = 'BET_PROGRESSION_3';
                confidence = clamp(74 + ((faceGaps[5] - 10) * 2), 74, 90);
                ruleKey = 'elasticity-snapback';
                ruleLabel = 'Elasticity Snapback';
                signalLabel = 'Face 5 Gap';
                detail = `Face 5 has slept ${faceGaps[5]} spins, so progression step 3 points back to Face 5.`;
                triggerFace = 5;
            } else {
                for (let comboIndex = 0; comboIndex < exhaustedCombos.length; comboIndex++) {
                    const combo = exhaustedCombos[comboIndex];
                    const latestHasA = hasFace(lastMask, combo.a);
                    const latestHasB = hasFace(lastMask, combo.b);

                    if (latestHasA === latestHasB) continue;

                    targetFace = latestHasA ? combo.a : combo.b;
                    fadedFace = latestHasA ? combo.b : combo.a;
                    action = 'BET_AGAINST';
                    confidence = clamp(62 + ((combo.hits - 3) * 6), 62, 82);
                    ruleKey = 'fatigue-inversion';
                    ruleLabel = 'Fatigue Inversion';
                    signalLabel = combo.label;
                    detail = `${combo.label} hit ${combo.hits} times in the last ${stats14.windowSize} spins. Latest spin leaned Face ${targetFace}, so the engine fades Face ${fadedFace}.`;
                    triggerFace = targetFace;
                    focusCombo = combo;
                    fatigueComboLabel = combo.label;
                    break;
                }
            }
        } else {
            // --- MOMENTUM & GAP FILTER STARTEGY ---

            // 1. Find the highest momentum combo (must have >= 2 hits in 14 spins to be alive)
            const aliveCombos = stats14.comboStats.filter(c => c.hits >= 2).sort((a, b) => b.hits - a.hits);

            if (aliveCombos.length > 0) {
                const targetCombo = aliveCombos[0]; // The combo with the most momentum
                const faceA = targetCombo.a;
                const faceB = targetCombo.b;

                const gapA = faceGaps[faceA] || 0;
                const gapB = faceGaps[faceB] || 0;

                const isASweetSpot = gapA >= 2 && gapA <= 9;
                const isBSweetSpot = gapB >= 2 && gapB <= 9;
                const isADeepSleep = gapA >= 10;
                const isBDeepSleep = gapB >= 10;

                // Evaluate the faces
                if (isADeepSleep && isBDeepSleep) {
                    // Both faces are dead. The combo is failing.
                    action = 'SIT_OUT';
                    confidence = 0;
                    ruleKey = 'momentum-gap-fail';
                    ruleLabel = 'Momentum & Gap (Failing)';
                    signalLabel = 'SIT OUT';
                    detail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits, but both Face ${faceA} (Gap ${gapA}) and Face ${faceB} (Gap ${gapB}) are in a Deep Sleep. Combo is actively failing.`;
                    focusCombo = targetCombo;
                } else if (isASweetSpot && isBDeepSleep) {
                    targetFace = faceA;
                    action = 'BET_MOMENTUM_FACE';
                    confidence = 88;
                    ruleKey = 'momentum-gap-target';
                    ruleLabel = 'Momentum & Gap Filter';
                    signalLabel = `F${faceA} (on ${targetCombo.label})`;
                    detail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits. Face ${faceB} is in deep sleep (Gap ${gapB}), so Face ${faceA} (Gap ${gapA}) is the isolated target.`;
                    focusCombo = targetCombo;
                } else if (isBSweetSpot && isADeepSleep) {
                    targetFace = faceB;
                    action = 'BET_MOMENTUM_FACE';
                    confidence = 88;
                    ruleKey = 'momentum-gap-target';
                    ruleLabel = 'Momentum & Gap Filter';
                    signalLabel = `F${faceB} (on ${targetCombo.label})`;
                    detail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits. Face ${faceA} is in deep sleep (Gap ${gapA}), so Face ${faceB} (Gap ${gapB}) is the isolated target.`;
                    focusCombo = targetCombo;
                } else if (isASweetSpot && isBSweetSpot) {
                    // Both are good. Pick the one that has slept slightly longer (more "due")
                    targetFace = gapA >= gapB ? faceA : faceB;
                    action = 'BET_MOMENTUM_FACE';
                    confidence = 82;
                    ruleKey = 'momentum-gap-target-dual';
                    ruleLabel = 'Momentum & Gap Filter';
                    signalLabel = `F${targetFace} (on ${targetCombo.label})`;
                    detail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits. Both faces are in the sweet spot. Face ${targetFace} has the higher gap (${gapA >= gapB ? gapA : gapB}), making it the optimal mathematical entry.`;
                    focusCombo = targetCombo;
                } else {
                    // Messy state (e.g. gaps are 0 or 1, meaning they literally just hit and are repeating)
                    // We don't bet on immediate repeaters unless forced.
                    action = 'WAIT';
                    confidence = 0;
                    ruleKey = 'momentum-gap-wait';
                    ruleLabel = 'Momentum & Gap Filter';
                    signalLabel = 'WAIT';
                    detail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits, but faces are neither in sweet spots nor deep sleep. Waiting for clearer gap alignment.`;
                    focusCombo = targetCombo;
                }

            } else {
                // No combos are alive
                action = 'SIT_OUT';
                confidence = 0;
                ruleKey = 'momentum-gap-dead';
                ruleLabel = 'Momentum & Gap (Dead Table)';
                signalLabel = 'SIT OUT';
                detail = 'No Perimeter Combos have enough momentum (2+ hits in 14 spins). The table is chaotic or hitting pure dozen/column variants.';
            }
        }

        const confirmationCombo = focusCombo && stats5 && stats5.counts

            ? stats5.counts[focusCombo.label] || 0
            : 0;

        return {
            targetFace,
            action,
            confidence,
            ruleKey,
            ruleLabel,
            signalLabel,
            detail,
            triggerFace,
            fadedFace,
            focusCombo,
            fatigueComboLabel,
            markovSequenceLabel,
            faceGaps,
            previousFaces: previousFaces === EMPTY_FACES ? [] : previousFaces.slice(),
            lastFaces: lastFaces === EMPTY_FACES ? [] : lastFaces.slice(),
            previousPrimaryFace,
            lastPrimaryFace,
            processedSpins: validSpinCount,
            dominantCombo,
            runnerUpCombo,
            exhaustedCombos,
            confirmationHits: confirmationCombo,
            stats14,
            stats5
        };
    },

    updateFONTracker: function (history, windowSize = RECENT_FATIGUE_WINDOW) {
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

// --- EXPORTS ---
window.FACE_MASKS = FACE_MASKS;
window.FACES = FACES;
window.FON_MAP = FON_MAP;
window.FON_MASK_MAP = FON_MASK_MAP;
window.FON_PRIMARY_FACE_MAP = FON_PRIMARY_FACE_MAP;
window.PERIMETER_COMBOS = PERIMETER_COMBOS;
window.PERIMETER_COMBO_LOOKUP = PERIMETER_COMBO_LOOKUP;
window.PredictionEngine = PredictionEngine;

console.log('Prediction Engine Loaded');
