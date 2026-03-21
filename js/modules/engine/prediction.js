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
    1: { id: 1, nums: [1, 6, 10, 15, 24, 29, 33], color: '#0ea5e9', bg: 'rgba(14, 165, 233, 0.15)', border: '#0284c7' },
    2: { id: 2, nums: [2, 7, 11, 16, 20, 24, 25, 29, 34], color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)', border: '#d97706' },
    3: { id: 3, nums: [3, 8, 12, 17, 21, 26, 30, 35], color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)', border: '#7c3aed' },
    4: { id: 4, nums: [4, 9, 13, 18, 22, 27, 31, 36], color: '#d4af37', bg: 'rgba(212, 175, 55, 0.15)', border: '#b4952e' },
    5: { id: 5, nums: [0, 5, 10, 14, 15, 19, 23, 28, 32], color: '#d33838', bg: 'rgba(211, 56, 56, 0.15)', border: '#b02a2a' }
};

const PERIMETER_COMBOS = [
    { label: '5-2', a: 5, b: 2, color: '#d33838' },
    { label: '5-3', a: 5, b: 3, color: '#e07a00' },
    { label: '1-3', a: 1, b: 3, color: '#22c55e' },
    { label: '2-4', a: 2, b: 4, color: '#3b82f6' }
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
    // Pure data reporter - no DOM lookups allowed here
    const processed = Number.isFinite(detail.processed) ? detail.processed : 0;
    const total = Number.isFinite(detail.total) ? detail.total : 0;
    const message = total > 0
        ? `Prediction Engine ${percent}% (${processed}/${total})`
        : `Prediction Engine ${percent}%`;

    console.log(message);

    // Dispatch as a CustomEvent for UI to listen to if it chooses
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('predictionProgress', {
            detail: { percent, processed, total, message }
        }));
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

        const engineOutputs = {
            legacy: { action: 'WAIT', targetFace: null, ruleKey: 'no-signal' },
            momentum: { action: 'WAIT', targetFace: null, ruleKey: 'no-signal' }
        };

        // 1. RUN LEGACY FACE PREDICTOR (Markov & Fatigue Inversion)
        if (true) {
            let lTarget = null, lAction = 'WAIT', lConf = 0, lKey = 'no-signal', lLabel = 'No Signal', lSigLabel = 'No Signal', lDetail = detail, lTrigger = null;
            
            if (validSpinCount >= 2 && hasFace(previousMask, 4) && hasFace(lastMask, 5)) {
                lTarget = 4; lAction = 'BET'; lConf = 92; lKey = 'markov-4-5'; lLabel = 'Markov Trigger'; lSigLabel = 'F4 -> F5'; lTrigger = 5;
                lDetail = 'Latest two spins formed F4 -> F5, so the engine snaps back to Face 4.';
            } else if (validSpinCount >= 2 && hasFace(previousMask, 2) && hasFace(lastMask, 2)) {
                lTarget = 5; lAction = 'BET'; lConf = 88; lKey = 'markov-2-2'; lLabel = 'Markov Trigger'; lSigLabel = 'F2 -> F2'; lTrigger = 2;
                lDetail = 'Latest two spins held on Face 2, so the engine rotates to Face 5.';
            } else if (faceGaps[5] >= 10) {
                lTarget = 5; lAction = 'BET_PROGRESSION_3'; lConf = clamp(74 + ((faceGaps[5] - 10) * 2), 74, 90); lKey = 'elasticity-snapback'; lLabel = 'Elasticity Snapback'; lSigLabel = 'Face 5 Gap'; lTrigger = 5;
                lDetail = `Face 5 has slept ${faceGaps[5]} spins, so progression step 3 points back to Face 5.`;
            } else {
                for (const combo of exhaustedCombos) {
                    const latestHasA = hasFace(lastMask, combo.a);
                    const latestHasB = hasFace(lastMask, combo.b);
                    if (latestHasA === latestHasB) continue;
                    lTarget = latestHasA ? combo.a : combo.b;
                    lAction = 'BET_AGAINST'; lConf = clamp(62 + ((combo.hits - 3) * 6), 62, 82); lKey = 'fatigue-inversion'; lLabel = 'Fatigue Inversion'; lSigLabel = combo.label; lTrigger = lTarget;
                    lDetail = `${combo.label} hit ${combo.hits} times in the last ${stats14.windowSize} spins. Latest spin leaned Face ${lTarget}, so the engine fades Face ${latestHasA ? combo.b : combo.a}.`;
                    break;
                }
            }
            engineOutputs.legacy = { targetFace: lTarget, action: lAction, confidence: lConf, ruleKey: lKey, ruleLabel: lLabel, signalLabel: lSigLabel, detail: lDetail, triggerFace: lTrigger };
        }

        // 2. RUN MOMENTUM & GAP FILTER STRATEGY
        // 2. RUN MOMENTUM & GAP FILTER STRATEGY
        {
            let mTarget = null, mAction = 'WAIT', mConf = 0, mKey = 'no-signal', mLabel = 'No Signal', mSigLabel = 'No Signal', mDetail = detail, mFocus = dominantCombo;

            if (aliveCombos.length > 0) {
                const targetCombo = aliveCombos[0];
                const faceA = targetCombo.a, faceB = targetCombo.b;
                const gapA = faceGaps[faceA] || 0, gapB = faceGaps[faceB] || 0;
                const isASweetSpot = gapA >= 2 && gapA <= 9, isBSweetSpot = gapB >= 2 && gapB <= 9;
                const isADeepSleep = gapA >= 10, isBDeepSleep = gapB >= 10;

                if (isADeepSleep && isBDeepSleep) {
                    mAction = 'SIT_OUT'; mConf = 0; mKey = 'momentum-gap-fail'; mLabel = 'Momentum & Gap (Failing)'; mSigLabel = 'SIT OUT';
                    mDetail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits, but both Face ${faceA} (Gap ${gapA}) and Face ${faceB} (Gap ${gapB}) are in a Deep Sleep. Combo is actively failing.`;
                } else if (isASweetSpot && isBDeepSleep) {
                    mTarget = faceA; mAction = 'BET_MOMENTUM_FACE'; mConf = 88; mKey = 'momentum-gap-target'; mLabel = 'Momentum & Gap Filter'; mSigLabel = `F${faceA} (on ${targetCombo.label})`;
                    mDetail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits. Face ${faceB} is in deep sleep (Gap ${gapB}), so Face ${faceA} (Gap ${gapA}) is the isolated target.`;
                } else if (isBSweetSpot && isADeepSleep) {
                    mTarget = faceB; mAction = 'BET_MOMENTUM_FACE'; mConf = 88; mKey = 'momentum-gap-target'; mLabel = 'Momentum & Gap Filter'; mSigLabel = `F${faceB} (on ${targetCombo.label})`;
                    mDetail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits. Face ${faceA} is in deep sleep (Gap ${gapA}), so Face ${faceB} (Gap ${gapB}) is the isolated target.`;
                } else if (isASweetSpot && isBSweetSpot) {
                    mTarget = gapA >= gapB ? faceA : faceB; mAction = 'BET_MOMENTUM_FACE'; mConf = 82; mKey = 'momentum-gap-target-dual'; mLabel = 'Momentum & Gap Filter'; mSigLabel = `F${mTarget} (on ${targetCombo.label})`;
                    mDetail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits. Both faces are in the sweet spot. Face ${mTarget} has the higher gap (${Math.max(gapA, gapB)}), making it the optimal mathematical entry.`;
                } else {
                    mAction = 'WAIT'; mConf = 0; mKey = 'momentum-gap-wait'; mLabel = 'Momentum & Gap Filter'; mSigLabel = 'WAIT';
                    mDetail = `Combo ${targetCombo.label} has ${targetCombo.hits} hits, but faces are neither in sweet spots nor deep sleep. Waiting for clearer gap alignment.`;
                }
                mFocus = targetCombo;
            } else {
                mAction = 'SIT_OUT'; mConf = 0; mKey = 'momentum-gap-dead'; mLabel = 'Momentum & Gap (Dead Table)'; mSigLabel = 'SIT OUT';
                mDetail = 'No Perimeter Combos have enough momentum (2+ hits in 14 spins). The table is chaotic or hitting pure dozen/column variants.';
            }
            engineOutputs.momentum = { targetFace: mTarget, action: mAction, confidence: mConf, ruleKey: mKey, ruleLabel: mLabel, signalLabel: mSigLabel, detail: mDetail, focusCombo: mFocus };
        }

        // 3. SELECTION LOGIC: Which results become the primary prediction "active" snapshot?
        // Default to Legacy (Markov/Fatigue) if it triggered a BET, otherwise fallback to Momentum
        const useLegacy = options.currentPredictionStrategy === 'legacy-face' || engineOutputs.legacy.action.startsWith('BET');
        const primary = (useLegacy && engineOutputs.legacy.action !== 'WAIT') ? engineOutputs.legacy : engineOutputs.momentum;

        targetFace = primary.targetFace;
        action = primary.action;
        confidence = primary.confidence;
        ruleKey = primary.ruleKey;
        ruleLabel = primary.ruleLabel;
        signalLabel = primary.signalLabel;
        detail = primary.detail;
        triggerFace = primary.triggerFace || null;
        focusCombo = primary.focusCombo || dominantCombo;

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
