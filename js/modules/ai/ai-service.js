(function () {
    window.requestTacticalAudit = async function () {
        if (!window.AiBrain || typeof window.AiBrain.requestTacticalAudit !== 'function') {
            return { error: 'AI module unavailable.' };
        }
        return window.AiBrain.requestTacticalAudit({
            history: window.state.history,
            netUnits: window.state && window.state.engineStats
                ? window.state.engineStats.netUnits
                : 0
        });
    };

    window.requestNeuralPrediction = async function (options = {}) {
        if (!window.AiBrain || typeof window.AiBrain.requestNeuralPrediction !== 'function') {
            return null;
        }

        const opts = options && typeof options === 'object' ? options : {};
        const renderDashboardNow = opts.renderDashboardNow === true;
        const brainOptions = { force: opts.force === true };

        const mathSignal = window.state.engineSnapshot && window.state.engineSnapshot.currentPrediction ? window.state.engineSnapshot.currentPrediction : null;
        const recentHits = window.state.history.slice(-10)
            .map(spin => `F${window.FON_PRIMARY_FACE_MAP[spin.num] || '?'}`)
            .join(' -> ') || 'None';

        const signal = await window.AiBrain.requestNeuralPrediction({
            history: window.state.history,
            strategy: window.state.currentGameplayStrategy,
            netUnits: window.state && window.state.engineStats
                ? window.state.engineStats.netUnits
                : 0,
            recentHits,
            mathLabel: mathSignal ? (mathSignal.comboLabel || mathSignal.action || 'Math') : 'No math signal',
            mathTarget: mathSignal ? mathSignal.targetFace : null,
            mathConfidence: mathSignal && Number.isFinite(mathSignal.confidence) ? mathSignal.confidence : 0,
            mathSignal
        }, brainOptions);

        if (signal) {
            window.state.currentNeuralSignal = signal;
            if (window.updateAiFusionSnapshot) window.updateAiFusionSnapshot(window.state.currentNeuralSignal);

            // Map AI signal to activeBets so it controls the Dashboard Cards
            if (signal.status === 'GO' && signal.targetFace) {
                window.state.activeBets = [{
                    patternName: 'Neural Net',
                    targetFace: signal.targetFace,
                    confidence: signal.confidence || 0,
                    subtitle: signal.reason || 'AI Tactical Read',
                    accentColor: '#bf5af2', // Purple AI theme
                    confirmed: false
                }];
            } else {
                window.state.activeBets = [];
            }
        } else {
            // Fallback to Math Engine Cards if AI is unreachable
            const getLatestMathBets = function () {
                const strategyKey = window.state && window.state.currentGameplayStrategy ? window.state.currentGameplayStrategy : 'series';
                const cachedResult = window.state && window.state.strategySyncCache
                    ? window.state.strategySyncCache[strategyKey]
                    : null;
                return cachedResult && Array.isArray(cachedResult.nextBets) ? cachedResult.nextBets.slice() : [];
            };
            window.state.activeBets = getLatestMathBets();
        }

        if (renderDashboardNow) {
            if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
            if (window.syncAppStore) window.syncAppStore(); // Broadcast the update
        }

        return signal;
    };
})();