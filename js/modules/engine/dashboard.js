(function () {
    'use strict';

    function buildStrategicBrainSummary() {
        const coreStats = window.EngineCore && window.EngineCore.stats ? window.EngineCore.stats : { totalWins: 0, totalLosses: 0, netUnits: 0 };
        const totalSignals = coreStats.totalWins + coreStats.totalLosses;
        const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.totalWins / totalSignals) * 100);
        const recentFaces = (window.state.history || []).slice(-8).map(spin => window.FON_PRIMARY_FACE_MAP[spin.num] || 0).filter(Boolean);
        const faceCounts = recentFaces.reduce((acc, face) => { acc[face] = (acc[face] || 0) + 1; return acc; }, {});
        const dominantFaceEntry = Object.entries(faceCounts).sort((a, b) => b[1] - a[1])[0] || null;
        const dominantFace = dominantFaceEntry ? Number(dominantFaceEntry[0]) : null;
        const dominantHits = dominantFaceEntry ? dominantFaceEntry[1] : 0;
        const topGapEntry = Object.entries(window.state.faceGaps || {}).sort((a, b) => b[1] - a[1])[0] || ['0', 0];
        const topGapFace = Number(topGapEntry[0]) || null;
        const topGapValue = Number(topGapEntry[1]) || 0;
        const neuralConfidence = window.state.currentNeuralSignal && Number.isFinite(window.state.currentNeuralSignal.confidence) ? window.state.currentNeuralSignal.confidence : 0;
        const trendBonus = dominantHits >= 4 ? 16 : dominantHits >= 3 ? 8 : 0;
        const gapBonus = topGapValue >= 8 ? 10 : topGapValue >= 6 ? 5 : 0;
        const pnlPenalty = coreStats.netUnits < 0 ? Math.min(18, Math.abs(coreStats.netUnits) * 3) : 0;
        const chaosPenalty = recentFaces.length >= 6 && new Set(recentFaces).size >= 5 ? 14 : 0;
        const predictabilityScore = Math.max(8, Math.min(96, Math.round(hitRate * 0.45 + neuralConfidence * 0.35 + trendBonus + gapBonus - pnlPenalty - chaosPenalty)));
        let verdict = 'Feed more spins to the local brain before acting.';
        let pivot = '';

        if (!window.state.history || window.state.history.length < 8) verdict = 'Sample too thin. Let the wheel print a cleaner rhythm before trusting any push.';
        else if (window.state.currentNeuralSignal && window.state.currentNeuralSignal.status === 'SIT_OUT') { verdict = window.state.currentNeuralSignal.reason || 'Noise detected. Local brain says stand down and wait for a cleaner edge.'; pivot = 'Pivot: sit out until the table stops chopping.'; }
        else if (coreStats.netUnits <= -4) { verdict = 'The session is bleeding. Tighten exposure and only touch a signal if math and rhythm agree.'; pivot = 'Pivot: reduce aggression and wait for confirmation.'; }
        else if (dominantFace && dominantHits >= 4) { verdict = `F${dominantFace} is repeating inside the last 8 hits. The table is leaning instead of spraying.`; pivot = `Pivot: watch F${dominantFace} for continuation or first clean snapback.`; }
        else if (topGapFace && topGapValue >= 8) { verdict = `F${topGapFace} is stretched to a ${topGapValue}-spin gap. That is the cleanest tension point on the board.`; pivot = `Pivot: monitor F${topGapFace} for a controlled re-entry setup.`; }
        else { verdict = 'The wheel is mixed. Use the math engine first and demand a strong reason before you press.'; pivot = 'Pivot: let structure form before increasing risk.'; }

        if (window.state.currentNeuralSignal && window.state.currentNeuralSignal.status === 'GO' && window.state.currentNeuralSignal.targetFace) pivot = `Pivot: AI leans F${window.state.currentNeuralSignal.targetFace} at ${window.state.currentNeuralSignal.confidence || 0}% confidence.`;
        return { predictabilityScore, verdict, profitPivot: pivot };
    }

    window.renderStrategicBrainSummary = function () {
        const verdictEl = document.getElementById('aiBrainVerdict'), scoreEl = document.getElementById('aiBrainScore'), pivotEl = document.getElementById('aiBrainPivot');
        if (!verdictEl || !scoreEl || !pivotEl) return;
        const summary = buildStrategicBrainSummary();
        verdictEl.innerText = summary.verdict; scoreEl.innerText = `${summary.predictabilityScore}%`; scoreEl.classList.remove('opacity-0');
        if (summary.profitPivot) { pivotEl.innerText = summary.profitPivot; pivotEl.classList.remove('hidden'); } else pivotEl.classList.add('hidden');
    };

    window.toggleBetConfirmation = function (index) {
        if (!window.state || !Array.isArray(window.state.activeBets)) return;
        const betIndex = Number(index);
        if (!Number.isInteger(betIndex) || betIndex < 0 || betIndex >= window.state.activeBets.length) return;
        const bet = window.state.activeBets[betIndex];
        if (!bet || !bet.targetFace || bet.targetFace === '?') return;
        bet.confirmed = bet.confirmed !== true;
        if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets);
        if (window.syncAppStore) window.syncAppStore();
        if (window.saveSessionData) window.saveSessionData();
    };

    window.renderDashboardSafe = function (items) {
        if (window.aiScrambleInterval) { clearInterval(window.aiScrambleInterval); window.aiScrambleInterval = null; }
        const dash = document.getElementById('dashboard');
        if (!dash) return;
        const signals = Array.isArray(items) ? items : (items && items.nextBets ? items.nextBets : []);
        let cards = [];
        signals.forEach((bet, index) => {
            const subtitle = bet.subtitle || (bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName);
            const accent = bet.accentColor || '#FF3B30';
            const bgStyle = bet.confirmed ? `background: linear-gradient(135deg, ${accent}35, ${accent}10)` : `background: linear-gradient(135deg, ${accent}15, ${accent}05)`;
            const borderBase = bet.confirmed ? accent : `${accent}40`, borderPulse = accent, shadowBase = `0 4px 12px ${accent}15`, shadowPulse = `0 4px 20px ${accent}35, inset 0 0 8px ${accent}20`;
            const hitRate = bet.hitRate ? `${bet.hitRate}% Hit Rate` : 'Evaluating...';
            const hits = bet.hits !== undefined ? `${bet.hits}/${bet.totalHits || 14} Hits` : '';
            const isAiLoading = bet.patternName === 'Neural Net' && bet.targetFace === '?';
            const mainText = isAiLoading ? 'SYNCING NEURAL NET' : `BET F${bet.targetFace}`;
            const subText = isAiLoading ? subtitle : `${hits} (${hitRate})`;
            const titleClass = isAiLoading ? 'ai-scramble-text text-[#bf5af2]' : 'text-white';
            const confirmationLabel = isAiLoading ? 'ANALYZING' : (bet.confirmed ? 'CONFIRMED' : 'TAP TO CONFIRM');
            const confirmationTone = isAiLoading ? 'text-[#bf5af2]' : (bet.confirmed ? 'text-[#22c55e]' : 'text-white/45');
            cards.push(`<div class="min-w-[250px] h-[72px] px-4 py-2 rounded-lg border flex flex-col justify-center cursor-pointer select-none transition-all hover:brightness-110 signal-card" data-bet-index="${index}" title="${isAiLoading ? 'AI read in progress' : 'Click to toggle confirmation'}" style="--border-base: ${borderBase}; --border-pulse: ${borderPulse}; --shadow-base: ${shadowBase}; --shadow-pulse: ${shadowPulse}; border-left: 4px solid ${accent}; ${bgStyle};"><div class="flex items-start justify-between gap-3"><div class="text-[14px] leading-tight font-bold tracking-wide drop-shadow-sm uppercase ${titleClass}" data-text="${mainText}">${mainText}</div><div class="text-[9px] font-bold tracking-[0.18em] uppercase ${confirmationTone}">${confirmationLabel}</div></div><div class="text-[10px] leading-tight text-white/70 font-semibold mt-1 font-mono">${subText}</div></div>`);
        });
        if (cards.length === 0) { dash.innerHTML = `<div class="dashboard-empty w-full text-center text-[10px] font-medium text-[#8E8E93]/60 border border-dashed border-white/5 rounded-xl p-2 select-none tracking-wide flex items-center justify-center h-[60px]"><span>AWAITING SIGNALS...</span></div>`; return; }
        dash.innerHTML = cards.join('');
        dash.querySelectorAll('.signal-card[data-bet-index]').forEach(card => { card.addEventListener('click', () => { const idx = Number(card.getAttribute('data-bet-index')); if (window.toggleBetConfirmation) window.toggleBetConfirmation(idx); }); });
        const scramblers = dash.querySelectorAll('.ai-scramble-text');
        if (scramblers.length > 0) { const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!'; window.aiScrambleInterval = setInterval(() => { scramblers.forEach(el => { const original = el.dataset.text; let scrambled = ''; for (let i = 0; i < original.length; i++) { if (original[i] === ' ') scrambled += ' '; else scrambled += Math.random() > 0.75 ? chars[Math.floor(Math.random() * chars.length)] : original[i]; } el.innerText = scrambled; }); }, 50); }
    };
})();