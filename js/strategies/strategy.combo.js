// ============================================================
//  STRATEGY: COMBO  (Perimeter Pair / TripleCs Engine)
//  Owned data: (reads PERIMETER_COMBOS from app.js globals)
//  Exports:    StrategyRegistry.combo
// ============================================================

'use strict';

// StrategyRegistry entry for Combo
if (typeof window.StrategyRegistry === 'undefined') {
    window.StrategyRegistry = {};
}

window.StrategyRegistry.combo = {
    key: 'combo',
    label: 'Combo Strategy',
    tableHeader: 'COMBO',

    /**
     * PATTERN_FILTER_META is computed lazily so it can safely reference
     * PERIMETER_COMBOS which is defined in app.js after scripts load.
     */
    get PATTERN_FILTER_META() {
        return Object.fromEntries(
            (PERIMETER_COMBOS || []).map(combo => [combo.label, {
                label: combo.label,
                hint: `Track ${combo.label} inside the prediction engine and dashboard flow.`,
                icon: 'fa-link',
                accent: combo.color
            }])
        );
    },

    /**
     * Build the default patternConfig keys for this strategy.
     * Returns an object: { "2-4": bool, "1-5": bool, ... }
     */
    buildPatternConfig(enabled = true) {
        return Object.fromEntries(
            (PERIMETER_COMBOS || []).map(combo => [combo.label, enabled])
        );
    },

    /**
     * Run the combo strategy engine.
     * Reads the pre-built engine snapshot (from PredictionEngine) and extracts
     * the current prediction, producing notifications and nextBets.
     *
     * @param {Array}  _historyData  - unused in combo mode (snapshot already has it)
     * @param {Object} snapshot      - return value of buildPredictionEngineSnapshot()
     * @param {Object} _patternConfig - unused (combo patterns filtered inside PredictionEngine)
     */
    run(_historyData, snapshot, patternConfig = {}) {
        const notifications = [];
        const nextBets = [];

        if (!snapshot) {
            return { notifications, nextBets };
        }

        const prediction = snapshot.currentPrediction || snapshot;
        const action = prediction.action || snapshot.action;
        const targetFace = prediction.targetFace || snapshot.targetFace;
        const displayLabel = prediction.comboLabel || snapshot.signalLabel || snapshot.ruleLabel || null;
        const comboKey = snapshot.focusCombo && snapshot.focusCombo.label
            ? snapshot.focusCombo.label
            : displayLabel;

        if (!targetFace || action === 'SIT_OUT' || action === 'WAIT') {
            // Even if we aren't betting, we might want to return the signal info for the UI
            return {
                notifications,
                nextBets: []
            };
        }

        if (comboKey && patternConfig[comboKey] === false) {
            return { notifications, nextBets };
        }

        notifications.push({
            type: 'ACTIVE',
            fA: prediction.triggerFace || snapshot.triggerFace || targetFace,
            fB: targetFace,
            count: 1,
            strategy: 'Combo',
            patternName: comboKey || displayLabel || 'Combo',
            filterKey: comboKey || displayLabel || 'Combo'
        });
        nextBets.push({
            targetFace,
            strategy: 'Combo',
            patternName: comboKey || displayLabel || 'Combo',
            comboLabel: displayLabel || comboKey || 'Combo',
            filterKey: comboKey || displayLabel || 'Combo',
            confidence: prediction.confidence || snapshot.confidence || 0,
            confirmed: false
        });

        return { notifications, nextBets };
    },

    /**
     * Detect a perimeter-combo bridge between prevSpin and currSpin.
     * Returns { label, color, matchedPrevFace, matchedCurrFace } or null.
     *
     * @param {number} prevMask  - FON_MASK_MAP value for previous spin
     * @param {number} currMask  - FON_MASK_MAP value for current spin
     * @param {Object} FACE_MASKS - the global FACE_MASKS lookup
     */
    detectBridge(prevMask, currMask, FACE_MASKS) {
        const combos = PERIMETER_COMBOS || [];
        for (let i = 0; i < combos.length; i++) {
            const combo = combos[i];
            const prevHasA = (prevMask & FACE_MASKS[combo.a]) !== 0;
            const prevHasB = (prevMask & FACE_MASKS[combo.b]) !== 0;
            const currHasA = (currMask & FACE_MASKS[combo.a]) !== 0;
            const currHasB = (currMask & FACE_MASKS[combo.b]) !== 0;

            if (prevHasA && currHasB) {
                return { label: combo.label, color: combo.color, matchedPrevFace: combo.a, matchedCurrFace: combo.b };
            }
            if (prevHasB && currHasA) {
                return { label: combo.label, color: combo.color, matchedPrevFace: combo.b, matchedCurrFace: combo.a };
            }
        }
        return null;
    }
};
