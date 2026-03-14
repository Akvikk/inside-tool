const state = window.state;

async function requestTacticalAudit() {
    if (!window.AiBrain || typeof window.AiBrain.requestTacticalAudit !== 'function') {
        return { error: 'AI module unavailable.' };
    }
    return window.AiBrain.requestTacticalAudit({
        history: state.history,
        netUnits: window.EngineCore && window.EngineCore.stats
            ? window.EngineCore.stats.netUnits
            : 0
    });
}

async function requestNeuralPrediction(options = {}) {
    if (!window.AiBrain || typeof window.AiBrain.requestNeuralPrediction !== 'function') {
        return null;
    }

    const opts = options && typeof options === 'object' ? options : {};
    const renderDashboardNow = opts.renderDashboardNow === true;
    const brainOptions = {
        force: opts.force === true
    };

    const mathSignal = state.engineSnapshot && state.engineSnapshot.currentPrediction ? state.engineSnapshot.currentPrediction : null;
    const recentHits = state.history.slice(-10)
        .map(spin => `F${window.FON_PRIMARY_FACE_MAP[spin.num] || '?'}`)
        .join(' -> ') || 'None';

    const signal = await window.AiBrain.requestNeuralPrediction({
        history: state.history,
        strategy: state.currentGameplayStrategy,
        netUnits: window.EngineCore && window.EngineCore.stats
            ? window.EngineCore.stats.netUnits
            : 0,
        recentHits,
        mathLabel: mathSignal ? (mathSignal.comboLabel || mathSignal.action || 'Math') : 'No math signal',
        mathTarget: mathSignal ? mathSignal.targetFace : null,
        mathConfidence: mathSignal && Number.isFinite(mathSignal.confidence) ? mathSignal.confidence : 0,
        mathSignal
    }, brainOptions);

    if (signal) {
        state.currentNeuralSignal = signal;
        if (window.updateAiFusionSnapshot) window.updateAiFusionSnapshot(state.currentNeuralSignal);
    }

    if (renderDashboardNow) {
        if (window.renderDashboardSafe) window.renderDashboardSafe(window.currentAlerts || []);
    }

    return signal;
}

function buildStrategicBrainSummary() {
    const coreStats = window.EngineCore && window.EngineCore.stats
        ? window.EngineCore.stats
        : { totalWins: 0, totalLosses: 0, netUnits: 0 };
    const totalSignals = coreStats.totalWins + coreStats.totalLosses;
    const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.totalWins / totalSignals) * 100);
    const recentFaces = state.history.slice(-8).map(spin => window.FON_PRIMARY_FACE_MAP[spin.num] || 0).filter(Boolean);
    const faceCounts = recentFaces.reduce((acc, face) => {
        acc[face] = (acc[face] || 0) + 1;
        return acc;
    }, {});
    const dominantFaceEntry = Object.entries(faceCounts).sort((a, b) => b[1] - a[1])[0] || null;
    const dominantFace = dominantFaceEntry ? Number(dominantFaceEntry[0]) : null;
    const dominantHits = dominantFaceEntry ? dominantFaceEntry[1] : 0;
    const topGapEntry = Object.entries(state.faceGaps).sort((a, b) => b[1] - a[1])[0] || ['0', 0];
    const topGapFace = Number(topGapEntry[0]) || null;
    const topGapValue = Number(topGapEntry[1]) || 0;
    const neuralConfidence = state.currentNeuralSignal && Number.isFinite(state.currentNeuralSignal.confidence)
        ? state.currentNeuralSignal.confidence
        : 0;
    const trendBonus = dominantHits >= 4 ? 16 : dominantHits >= 3 ? 8 : 0;
    const gapBonus = topGapValue >= 8 ? 10 : topGapValue >= 6 ? 5 : 0;
    const pnlPenalty = coreStats.netUnits < 0 ? Math.min(18, Math.abs(coreStats.netUnits) * 3) : 0;
    const chaosPenalty = recentFaces.length >= 6 && new Set(recentFaces).size >= 5 ? 14 : 0;
    const predictabilityScore = Math.max(8, Math.min(96, Math.round(hitRate * 0.45 + neuralConfidence * 0.35 + trendBonus + gapBonus - pnlPenalty - chaosPenalty)));

    let verdict = 'Feed more spins to the local brain before acting.';
    let pivot = '';

    if (state.history.length < 8) {
        verdict = 'Sample too thin. Let the wheel print a cleaner rhythm before trusting any push.';
    } else if (state.currentNeuralSignal && state.currentNeuralSignal.status === 'SIT_OUT') {
        verdict = state.currentNeuralSignal.reason || 'Noise detected. Local brain says stand down and wait for a cleaner edge.';
        pivot = 'Pivot: sit out until the table stops chopping.';
    } else if (coreStats.netUnits <= -4) {
        verdict = 'The session is bleeding. Tighten exposure and only touch a signal if math and rhythm agree.';
        pivot = 'Pivot: reduce aggression and wait for confirmation.';
    } else if (dominantFace && dominantHits >= 4) {
        verdict = `F${dominantFace} is repeating inside the last 8 hits. The table is leaning instead of spraying.`;
        pivot = `Pivot: watch F${dominantFace} for continuation or first clean snapback.`;
    } else if (topGapFace && topGapValue >= 8) {
        verdict = `F${topGapFace} is stretched to a ${topGapValue}-spin gap. That is the cleanest tension point on the board.`;
        pivot = `Pivot: monitor F${topGapFace} for a controlled re-entry setup.`;
    } else {
        verdict = 'The wheel is mixed. Use the math engine first and demand a strong reason before you press.';
        pivot = 'Pivot: let structure form before increasing risk.';
    }

    if (state.currentNeuralSignal && state.currentNeuralSignal.status === 'GO' && state.currentNeuralSignal.targetFace) {
        pivot = `Pivot: AI leans F${state.currentNeuralSignal.targetFace} at ${state.currentNeuralSignal.confidence || 0}% confidence.`;
    }

    return {
        predictabilityScore,
        verdict,
        profitPivot: pivot
    };
}

function renderStrategicBrainSummary() {
    const verdictEl = document.getElementById('aiBrainVerdict');
    const scoreEl = document.getElementById('aiBrainScore');
    const pivotEl = document.getElementById('aiBrainPivot');
    if (!verdictEl || !scoreEl || !pivotEl) return;

    const summary = buildStrategicBrainSummary();
    verdictEl.innerText = summary.verdict;
    scoreEl.innerText = `${summary.predictabilityScore}%`;
    scoreEl.classList.remove('opacity-0');

    if (summary.profitPivot) {
        pivotEl.innerText = summary.profitPivot;
        pivotEl.classList.remove('hidden');
    } else {
        pivotEl.classList.add('hidden');
    }
}

async function triggerAiAudit() {
    const btn = event.currentTarget;
    const originalText = btn.innerText;
    btn.innerText = 'AUDITING...';
    btn.disabled = true;

    const audit = await requestTacticalAudit();
    btn.innerText = originalText;
    btn.disabled = false;

    if (audit && !audit.error) {
        const verdictEl = document.getElementById('aiBrainVerdict');
        const scoreEl = document.getElementById('aiBrainScore');
        const pivotEl = document.getElementById('aiBrainPivot');

        if (verdictEl) verdictEl.innerText = audit.verdict || "Audit complete.";
        if (scoreEl) {
            scoreEl.innerText = `${audit.predictabilityScore || 0}%`;
            scoreEl.classList.remove('opacity-0');
        }
        if (pivotEl && audit.profitPivot) {
            pivotEl.innerText = `Pivot Suggestion: ${audit.profitPivot}`;
            pivotEl.classList.remove('hidden');
        }
    }
}
