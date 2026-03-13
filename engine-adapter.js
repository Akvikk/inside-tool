/**
 * Engine Adapter Boundary
 * Converts raw engine output into stable UI-safe view data.
 */
(function () {
    'use strict';

    function getContract() {
        return window.EngineContract || null;
    }

    function toSyncView(rawResult) {
        const contract = getContract();
        const sanitized = contract && typeof contract.sanitizeSyncResult === 'function'
            ? contract.sanitizeSyncResult(rawResult)
            : {
                notifications: Array.isArray(rawResult && rawResult.notifications) ? rawResult.notifications : [],
                nextBets: Array.isArray(rawResult && rawResult.nextBets) ? rawResult.nextBets : []
            };

        const validation = contract && typeof contract.validateSyncResult === 'function'
            ? contract.validateSyncResult(sanitized)
            : { valid: true, errors: [] };

        return {
            notifications: sanitized.notifications || [],
            nextBets: sanitized.nextBets || [],
            valid: validation.valid !== false,
            errors: Array.isArray(validation.errors) ? validation.errors : []
        };
    }

    function toSpinSignals(activeBets, options = {}) {
        const bets = Array.isArray(activeBets) ? activeBets : [];
        const neuralPredictionEnabled = options.neuralPredictionEnabled === true;
        const currentNeuralSignal = options.currentNeuralSignal || null;
        const buildPredictionLogSignal = typeof options.buildPredictionLogSignal === 'function'
            ? options.buildPredictionLogSignal
            : null;

        if (neuralPredictionEnabled && currentNeuralSignal && buildPredictionLogSignal) {
            return [buildPredictionLogSignal(currentNeuralSignal)];
        }

        return bets.map(bet => ({
            patternName: bet.patternName,
            filterKey: bet.filterKey || bet.patternName,
            targetFace: bet.targetFace,
            comboLabel: bet.comboLabel || null,
            confidence: Number.isFinite(bet.confidence) ? bet.confidence : null,
            reason: bet.reason || bet.subtitle || '',
            mode: bet.mode || null,
            status: bet.status || 'GO',
            signalSource: bet.signalSource || 'math'
        }));
    }

    function toStorePatch(values = {}) {
        return {
            history: Array.isArray(values.history) ? values.history : [],
            activeBets: Array.isArray(values.activeBets) ? values.activeBets : [],
            alerts: Array.isArray(values.alerts) ? values.alerts : [],
            snapshot: values.snapshot || null
        };
    }

    window.EngineAdapter = {
        toSyncView,
        toSpinSignals,
        toStorePatch
    };
})();

