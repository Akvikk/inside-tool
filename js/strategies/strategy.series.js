// ============================================================
//  STRATEGY: SERIES  (1-2-3 Sequence Engine)
//  Owned data: SEQUENCES, SEQUENCE_COLORS
//  Exports:    StrategyRegistry.series
// ============================================================

'use strict';

const SEQUENCES = [
    { name: "1-2-3", a: 1, b: 2, target: 3 },
    { name: "2-3-4", a: 2, b: 3, target: 4 },
    { name: "3-4-5", a: 3, b: 4, target: 5 },
    { name: "5-4-3", a: 5, b: 4, target: 3 },
    { name: "4-3-2", a: 4, b: 3, target: 2 },
    { name: "3-2-1", a: 3, b: 2, target: 1 },
    { name: "1-3-5", a: 1, b: 3, target: 5 },
    { name: "5-3-1", a: 5, b: 3, target: 1 }
];

const SEQUENCE_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

// Pattern filter metadata — used by the hamburger filter menu
const PATTERN_FILTER_META_SERIES = {
    'TripleCs': {
        label: 'Triple Cs Pattern',
        hint: 'Shadow-tracks repeating face pairs in the last 14 spins and triggers bets on subsequent starts.',
        icon: 'fa-link',
        accent: '#30D158'
    },
    ...Object.fromEntries(
        SEQUENCES.map((seq, i) => {
            const patternName = `(${seq.name.replace(/-/g, '')})`;
            return [patternName, {
                label: patternName,
                hint: `Track sequence ${seq.name}: F${seq.a} → F${seq.b} → F${seq.target}`,
                icon: 'fa-stream',
                accent: SEQUENCE_COLORS[i % SEQUENCE_COLORS.length]
            }];
        })
    )
};

// StrategyRegistry entry for Series
if (typeof window.StrategyRegistry === 'undefined') {
    window.StrategyRegistry = {};
}

window.StrategyRegistry.series = {
    key: 'series',
    label: 'Series Strategy',
    tableHeader: 'SEQUENCE',
    PATTERN_FILTER_META: PATTERN_FILTER_META_SERIES,
    SEQUENCES,
    SEQUENCE_COLORS,

    /**
     * Build the default patternConfig keys for this strategy.
     * Returns an object: { "(123)": bool, "(234)": bool, ... }
     */
    buildPatternConfig(enabled = true) {
        const config = Object.fromEntries(
            SEQUENCES.map(seq => [`(${seq.name.replace(/-/g, '')})`, enabled])
        );
        config['TripleCs'] = enabled;
        return config;
    },

    /**
     * Run the sequence engine against the full history.
     * Returns { notifications, nextBets } to be assigned to activeBets/currentAlerts.
     *
     * @param {Array}  historyData  - global `history` array
     * @param {*}      _snapshot    - unused in series mode (for API compat)
     * @param {Object} patternConfig - the global patternConfig
     */
    run(historyData, _snapshot, patternConfig, options = {}) {
        if (historyData.length < 2) return { notifications: [], nextBets: [] };

        const notifications = [];
        const nextBets = [];
        const resetMap = options.tripleCsResets || {};

        // 1. Run Triple Cs Engine (Series sub-strategy)
        if (patternConfig['TripleCs'] !== false) {
            const tcs = this.runTripleCs(historyData, resetMap);
            notifications.push(...tcs.notifications);
            nextBets.push(...tcs.nextBets);
        }

        // 2. Run Sequence Engine
        const latest = historyData[historyData.length - 1];
        const prev   = historyData[historyData.length - 2];

        if (latest.faces && prev.faces) {
            SEQUENCES.forEach(seq => {
                const patternName = `(${seq.name.replace(/-/g, '')})`;
                if (prev.faces.includes(seq.a) && latest.faces.includes(seq.b)) {
                    const seqKey = `${seq.a}-${seq.b}`;

                    if (patternConfig[patternName] !== false) {
                        notifications.push({
                            type: 'ACTIVE',
                            fA: seq.a,
                            fB: seq.target,
                            count: 1,
                            strategy: 'Sequence',
                            patternName
                        });
                        nextBets.push({
                            targetFace: seq.target,
                            originPairKey: seqKey,
                            strategy: 'Sequence',
                            highlightIds: [prev.id, latest.id],
                            patternName,
                            filterKey: patternName,
                            confirmed: false
                        });
                    }
                }
            });
        }

        return { notifications, nextBets };
    },

    /**
     * Logic for Triple Cs sub-strategy:
     * Scan last 14 spins for repeating face pairs F(A) -> F(B) (count >= 2).
     * If latest spin is F(A), bet on F(B).
     */
    runTripleCs(historyData, resetMap) {
        const SCAN_DEPTH = 14;
        let startIndex = Math.max(0, historyData.length - SCAN_DEPTH);
        const scanWindow = historyData.slice(startIndex);

        if (scanWindow.length < 2) return { notifications: [], nextBets: [] };

        const notifications = [];
        const nextBets = [];
        const latestSpin = historyData[historyData.length - 1];

        // Scan for ALL possible face pairs F1..F5 -> F1..F5
        for (let startFace = 1; startFace <= 5; startFace++) {
            for (let targetFace = 1; targetFace <= 5; targetFace++) {
                const pairKey = `${startFace}-${targetFace}`;
                const lastResetIndex = resetMap[pairKey] || -1;

                let count = 0;
                let lastCompletionIndex = -1;
                let ids = [];

                let i = 0;
                while (i < scanWindow.length - 1) {
                    const spinA = scanWindow[i];
                    const spinB = scanWindow[i + 1];

                    if (!spinA.faces || !spinB.faces) { i++; continue; }

                    if (spinA.faces.includes(startFace) && spinB.faces.includes(targetFace)) {
                        if (spinB.index > lastResetIndex) {
                            count++;
                            ids.push(spinA.id, spinB.id);
                            lastCompletionIndex = spinB.index;
                            i += 2; // Jump past this pair
                            continue;
                        }
                    }
                    i++;
                }

                if (count >= 2) {
                    let isSignal = false;
                    if (latestSpin && latestSpin.faces) {
                        const isStartFace = latestSpin.faces.includes(startFace);
                        const isFreshStart = (latestSpin.index > lastCompletionIndex);
                        if (isStartFace && isFreshStart) {
                            isSignal = true;
                        }
                    }

                    if (isSignal) {
                        const patternName = `TripleCs: F${startFace}➜F${targetFace}`;
                        notifications.push({
                            type: 'ACTIVE',
                            fA: startFace,
                            fB: targetFace,
                            count: count,
                            strategy: 'TripleCs',
                            patternName
                        });
                        nextBets.push({
                            targetFace: targetFace,
                            originPairKey: pairKey,
                            strategy: 'TripleCs',
                            highlightIds: ids,
                            patternName,
                            filterKey: 'TripleCs',
                            confirmed: false
                        });
                    } else {
                        notifications.push({
                            type: 'LOCKED',
                            fA: startFace,
                            fB: targetFace,
                            count: count,
                            strategy: 'TripleCs'
                        });
                    }
                }
            }
        }

        return { notifications, nextBets };
    },

    /**
     * Detect a sequence bridge between prevSpin and currSpin for the history table.
     * Returns { label, color, matchedPrevFace, matchedCurrFace } or null.
     *
     * @param {number} prevMask  - FON_MASK_MAP value for previous spin
     * @param {number} currMask  - FON_MASK_MAP value for current spin
     * @param {Object} FACE_MASKS - the global FACE_MASKS lookup
     */
    detectBridge(prevMask, currMask, FACE_MASKS) {
        // 1. Check for Sequences
        for (let i = 0; i < SEQUENCES.length; i++) {
            const seq = SEQUENCES[i];
            if ((prevMask & FACE_MASKS[seq.a]) !== 0 && (currMask & FACE_MASKS[seq.b]) !== 0) {
                return {
                    label: `${seq.a}-${seq.b}`,
                    color: SEQUENCE_COLORS[i % SEQUENCE_COLORS.length],
                    matchedPrevFace: seq.a,
                    matchedCurrFace: seq.b
                };
            }
        }
        return null;
    }
};
