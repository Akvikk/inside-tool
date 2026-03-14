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
        
        // Map AI signal to activeBets so it controls the Dashboard Cards
        if (signal.status === 'GO' && signal.targetFace) {
            state.activeBets = [{
                patternName: 'Neural Net',
                targetFace: signal.targetFace,
                confidence: signal.confidence || 0,
                subtitle: signal.reason || 'AI Tactical Read',
                accentColor: '#bf5af2', // Purple AI theme
                confirmed: false
            }];
        } else {
            state.activeBets = [];
        }
    } else {
        // Fallback to Math Engine Cards if AI is unreachable
        state.activeBets = state.engineSnapshot ? (state.engineSnapshot.nextBets || []) : [];
    }

    if (renderDashboardNow) {
        if (window.renderDashboardSafe) window.renderDashboardSafe(state.activeBets || []);
        if (window.syncAppStore) window.syncAppStore(); // Broadcast the update
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

window.triggerAiAudit = async function (btn) {
    if (!btn) return;
    const originalText = btn.innerText;
    btn.innerText = 'AUDITING...';
    btn.disabled = true;

    // This now correctly calls the mock function in brain.js
    const audit = await requestTacticalAudit();
    btn.innerText = originalText;
    btn.disabled = false;

    const verdictEl = document.getElementById('aiBrainVerdict');
    const scoreEl = document.getElementById('aiBrainScore');
    const pivotEl = document.getElementById('aiBrainPivot');

    if (audit && !audit.error) {
        if (verdictEl) verdictEl.innerText = audit.verdict || "Audit complete.";
        if (scoreEl) {
            scoreEl.innerText = `${audit.predictabilityScore || 0}%`;
            scoreEl.classList.remove('opacity-0');
        }
        if (pivotEl && audit.profitPivot) {
            pivotEl.innerText = `Pivot Suggestion: ${audit.profitPivot}`;
            pivotEl.classList.remove('hidden');
        }
    } else if (audit && audit.error) {
        if (verdictEl) verdictEl.innerText = `Error: ${audit.error}`;
    }
}

// --- AUDIO ENGINE (SYNTHESIZED AMBIENCE) ---
window.AudioEngine = (function() {
    let ctx = null;

    function init() {
        if (!ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) ctx = new AudioContext();
        }
        if (ctx && ctx.state === 'suspended') ctx.resume();
    }

    function playChip() {
        if (!ctx) init();
        if (!ctx) return;

        // Sharp, percussive click simulating a heavy plastic chip hitting felt
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(50, ctx.currentTime + 0.05);
        
        gain.gain.setValueAtTime(0.4, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
    }

    function playWin() {
        if (!ctx) init();
        if (!ctx) return;
        // Fast ascending metallic chord (C major arpeggio)
        [523.25, 659.25, 783.99, 1046.50].forEach((freq, i) => {
            setTimeout(() => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.15, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start();
                osc.stop(ctx.currentTime + 0.6);
            }, i * 60);
        });
    }

    function playLoss() {
        if (!ctx) init();
        if (!ctx) return;
        // Low-frequency decaying thud
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.4);
        gain.gain.setValueAtTime(0.1, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.4);
    }

    return { init, playChip, playWin, playLoss };
})();

// Initialize audio context on first user interaction (Browser Policy Requirement)
document.addEventListener('click', () => {
    if (window.AudioEngine) window.AudioEngine.init();
}, { once: true });

// --- RESTORED CORE APP GLUE & INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
    console.log("INSIDE TOOL: Bootstrapping modular architecture...");

    // 1. Initialize Active Modules
    if (window.InputProcessor) window.InputProcessor.init();
    if (window.UiController) window.UiController.init();
    if (window.HudManager) window.HudManager.init();

    // 1.5 Bind Event-Driven Architecture (AppStore)
    if (window.AppStore) {
        window.AppStore.subscribe((storeState, action) => {
            if (action.type === 'history/append') {
                if (window.renderRow) window.renderRow(action.payload);
                if (window.renderGapStats) window.renderGapStats();
            } else if (action.type === 'engine/sync') {
                if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
                if (window.debounceHeavyUIUpdates) window.debounceHeavyUIUpdates();
            }
        });
    }

    // 2. Load previous session if it exists
    if (window.loadSessionData && window.loadSessionData()) {
        console.log("Session data loaded.");
        if (window.reRenderHistory) window.reRenderHistory();
        if (window.scanAllStrategies) await window.scanAllStrategies();
        if (window.HudManager) window.HudManager.update();

        // 2.5 Re-authenticate AI silently if enabled
        if (window.state && window.state.aiEnabled && window.state.aiApiKey) {
            if (window.saveAiConfig) await window.saveAiConfig(true);
        }
    }

    // 2. Bind missing enter-key functionality
    const spinInput = document.getElementById('spinInput');
    if (spinInput) {
        spinInput.focus();
        spinInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                if (window.InputProcessor) window.InputProcessor.addSpin();
            }
        });
    }

    // 3. Initial Rendering State
    if (window.renderGapStats) window.renderGapStats();
    if (window.renderDashboardSafe) window.renderDashboardSafe();
    if (window.initComboBridgeAutoLayout) window.initComboBridgeAutoLayout();
    if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout();
    if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();

    const resetBtn = document.getElementById('confirmResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', window.resetData);
});

// --- ESSENTIAL UI POLYFILLS ---
window.loadSessionData = function () {
    try {
        const raw = localStorage.getItem('insideTool_session_v2');
        if (!raw) return false;
        const data = JSON.parse(raw);
        if (data.history) window.state.history = data.history;
        if (data.faceGaps) window.state.faceGaps = data.faceGaps;
        if (data.aiEnabled !== undefined) window.state.aiEnabled = data.aiEnabled;
        if (data.aiApiKey) window.state.aiApiKey = data.aiApiKey;
        if (data.aiProvider) window.state.aiProvider = data.aiProvider;
        if (data.neuralPredictionEnabled !== undefined) window.state.neuralPredictionEnabled = data.neuralPredictionEnabled;
        // NOTE: More state properties can be added here for persistence
        return true;
    } catch (e) {
        console.error("Session load failed:", e);
        return false;
    }
};

window.saveSessionData = function () {
    try {
        localStorage.setItem('insideTool_session_v2', JSON.stringify({
            history: state.history,
            faceGaps: state.faceGaps,
            aiEnabled: state.aiEnabled,
            aiApiKey: state.aiApiKey,
            aiProvider: state.aiProvider,
            neuralPredictionEnabled: state.neuralPredictionEnabled
        }));
    } catch (e) {
        console.warn("Session save failed:", e);
    }
};

window.renderGapStats = function () {
    const container = document.getElementById('faceGapContainer');
    if (!container) return;

    container.innerHTML = '';
    for (let f = 1; f <= 5; f++) {
        const gap = state.faceGaps[f] || 0;
        let colorClass = 'text-[#30D158]';
        if (gap > 10) colorClass = 'text-[#FFD60A]';
        if (gap > 15) colorClass = 'text-[#FF453A]';

        container.innerHTML += `
            <div class="text-center p-2 rounded-xl bg-white/5 border border-white/5 shadow-sm backdrop-blur-sm transition-all hover:bg-white/10">
                <span class="block text-gray-400 text-[9px] font-bold mb-0.5 uppercase tracking-wider">F${f}</span>
                <span class="${colorClass} font-bold text-xl drop-shadow-sm">${gap}</span>
            </div>
        `;
    }
};

window.renderDashboardSafe = function (items) {
    if (window.aiScrambleInterval) {
        clearInterval(window.aiScrambleInterval);
        window.aiScrambleInterval = null;
    }

    const dash = document.getElementById('dashboard');
    if (!dash) return;

    // Handle both raw nextBets array and scanResult objects
    const signals = Array.isArray(items) ? items : (items && items.nextBets ? items.nextBets : []);
    let cards = [];

    signals.forEach((bet, index) => {
        const subtitle = bet.subtitle || (bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName);
        const accent = bet.accentColor || '#FF3B30';
        const bgStyle = bet.confirmed
            ? `background: linear-gradient(135deg, ${accent}50, ${accent}15)`
            : `background: linear-gradient(135deg, ${accent}25, ${accent}05)`;

        const borderBase = bet.confirmed ? accent : `${accent}40`;
        const borderPulse = accent;
        const shadowBase = `0 4px 20px ${accent}20`;
        const shadowPulse = `0 4px 30px ${accent}60, inset 0 0 12px ${accent}30`;

        // Screenshot sync: Add hit rate stats
        const hitRate = bet.hitRate ? `${bet.hitRate}% Hit Rate` : 'Evaluating...';
        const hits = bet.hits !== undefined ? `${bet.hits}/${bet.totalHits || 14} Hits` : '';

        const isAiLoading = bet.patternName === 'Neural Net' && bet.targetFace === '?';
        const mainText = isAiLoading ? 'SYNCING NEURAL NET' : `BET F${bet.targetFace}`;
        const subText = isAiLoading ? subtitle : `${hits} (${hitRate})`;
        const titleClass = isAiLoading ? 'ai-scramble-text text-[#bf5af2]' : 'text-white';

        cards.push(`
            <div class="min-w-[250px] h-[72px] px-4 py-2 rounded-lg border flex flex-col justify-center cursor-pointer select-none transition-all hover:brightness-110 signal-card"
                 style="--border-base: ${borderBase}; --border-pulse: ${borderPulse}; --shadow-base: ${shadowBase}; --shadow-pulse: ${shadowPulse}; border-left: 4px solid ${accent}; ${bgStyle};">
                <div class="text-[14px] leading-tight font-black tracking-wide drop-shadow-sm uppercase ${titleClass}" data-text="${mainText}">${mainText}</div>
                <div class="text-[10px] leading-tight text-white/70 font-bold mt-1 font-mono">${subText}</div>
            </div>
        `);
    });

    if (cards.length === 0) {
        dash.innerHTML = `<div class="dashboard-empty w-full text-center text-[10px] font-medium text-[#8E8E93]/60 border border-dashed border-white/5 rounded-xl p-2 select-none tracking-wide flex items-center justify-center h-[60px]"><span>AWAITING SIGNALS...</span></div>`;
        return;
    }

    dash.innerHTML = cards.join('');

    // Initiate Hacker Terminal Scramble Effect
    const scramblers = dash.querySelectorAll('.ai-scramble-text');
    if (scramblers.length > 0) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!';
        window.aiScrambleInterval = setInterval(() => {
            scramblers.forEach(el => {
                const original = el.dataset.text;
                let scrambled = '';
                for(let i = 0; i < original.length; i++) {
                    if (original[i] === ' ') scrambled += ' ';
                    else scrambled += Math.random() > 0.75 ? chars[Math.floor(Math.random() * chars.length)] : original[i];
                }
                el.innerText = scrambled;
            });
        }, 50);
    }
};

window.renderPredictionCell = function (spin) {
    const lines = [];

    // 1. Render Resolved Results (History of this spin's impact)
    if (spin.resolvedBets && spin.resolvedBets.length > 0) {
        spin.resolvedBets.forEach(bet => {
            const icon = bet.isWin ? '<i class="fas fa-check-circle text-[#30D158] mr-2"></i>' : '<i class="fas fa-times-circle text-[#FF453A] mr-2"></i>';
            const status = bet.isWin ? 'WIN' : 'LOSS';
            const color = bet.isWin ? 'text-[#30D158]' : 'text-[#FF453A]';
            lines.push(`
                <div class="flex items-center text-[10px] font-mono font-bold ${color} mb-1 opacity-90">
                    ${icon}${status}: F${bet.targetFace} (${bet.patternName || 'Perimeter'})
                </div>
            `);
        });
    }

    // 2. Render Active Signals (What this spin just triggered)
    const signals = spin.newSignals || [];
    signals.forEach(sig => {
        lines.push(`
            <div class="flex items-center text-[10px] font-mono font-bold text-gray-500 mb-1 tracking-tight">
                Active Signal: ${sig.patternName || 'Prediction Perimeter'}
            </div>
        `);
    });

    if (lines.length === 0) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';
    return lines.join('');
};

window.renderComboCell = function (spin) {
    const registry = window.StrategyRegistry || {};
    const stratKey = state.currentGameplayStrategy || 'series';
    const strategy = registry[stratKey];
    if (!strategy || typeof strategy.detectBridge !== 'function') return '<span class="text-gray-600">-</span>';
    if (spin.index <= 0) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';

    const currMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[spin.num] : 0;
    const prevSpin = state.history[spin.index - 1];
    if (!prevSpin) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';

    const prevMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[prevSpin.num] : 0;
    const bridge = strategy.detectBridge(prevMask, currMask, window.FACE_MASKS);

    if (!bridge || !prevSpin) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';

    // Combo badge + dynamic bridge between matched faces
    return `
        <div class="absolute inset-x-0 top-0 -translate-y-1/2 h-0 pointer-events-none select-none z-[1] flex items-center justify-center">
            <div class="combo-link-layer absolute overflow-visible"
                 data-prev-spin-id="${prevSpin.id}"
                 data-prev-face="${bridge.matchedPrevFace}"
                 data-curr-face="${bridge.matchedCurrFace}"
                 data-color="${bridge.color}"></div>
            <div class="relative z-[2] inline-flex items-center justify-center">
                <span class="combo-badge relative px-3 py-1 rounded-md text-[10px] font-black font-mono tracking-widest border shadow-2xl transition-all duration-300"
                      style="color:${bridge.color}; border-color:${bridge.color}55; background-color:#0b0b0d; box-shadow: 0 0 14px ${bridge.color}5a, inset 0 0 8px ${bridge.color}22;">
                    ${bridge.label}
                </span>
            </div>
        </div>
    `;
};

window.renderRow = function (spin, targetContainer) {
    const tbody = targetContainer || document.getElementById('historyBody');
    if (!tbody) return;

    const tr = document.createElement('tr');
    tr.className = "history-row relative hover:bg-white/[0.02] transition-colors";
    tr.id = 'row-' + spin.id;

    const RED_NUMS = state.RED_NUMS || [];
    let bgClass = spin.num === 0 ? 'bg-green' : (RED_NUMS.includes(spin.num) ? 'bg-red' : 'bg-black');

    let faceHTML = '<span class="text-gray-600">-</span>';
    if (spin.faces && spin.faces.length > 0) {
        let faceTags = spin.faces.map(fId => {
            let fStyle = window.FACES ? window.FACES[fId] : { color: '#fff', border: '#fff', bg: '#000' };
            return `<span class="face-tag mb-0.5 mr-1" data-spin-id="${spin.id}" data-face-id="${fId}" style="color:${fStyle.color}; border:1px solid ${fStyle.border}; background:${fStyle.bg};">F${fId}</span>`;
        }).join('');
        faceHTML = `<div class="flex flex-wrap justify-center">${faceTags}</div>`;
    }

    const comboHTML = window.renderComboCell ? window.renderComboCell(spin) : '<span class="text-gray-600">-</span>';
    const predictionHTML = window.renderPredictionCell ? window.renderPredictionCell(spin) : '<span class="text-gray-600">-</span>';

    tr.innerHTML = `
        <td class="text-center font-mono text-xs text-gray-400">#${spin.index + 1}</td>
        <td class="text-center"><div class="num-box ${bgClass}">${spin.num}</div></td>
        <td class="text-center relative z-[5]">${faceHTML}</td>
        <td class="text-center relative overflow-visible z-[1]">${comboHTML}</td>
        <td class="pl-4">${predictionHTML}</td>
    `;
    tbody.appendChild(tr);

    if (!targetContainer) {
        const sc = document.querySelector('#scrollContainer > div');
        if (sc) { setTimeout(() => { sc.scrollTop = sc.scrollHeight; }, 50); }
        if (window.layoutComboBridge) requestAnimationFrame(() => window.layoutComboBridge(spin.id));
    }
};

window.reRenderHistory = function () {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (window.state && window.state.history) {
        const fragment = document.createDocumentFragment();
        window.state.history.forEach(spin => {
            if (window.renderRow) window.renderRow(spin, fragment);
        });
        tbody.appendChild(fragment);
    }
    if (window.layoutAllComboBridges) {
        requestAnimationFrame(window.layoutAllComboBridges);
    }
};

window.rebuildSessionFromSpins = async function (spins, options = {}) {
    // 1. Hard reset of state
    if (window.state) {
        window.state.history = [];
        window.state.activeBets = [];
        window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        window.state.globalSpinIdCounter = 0;
        window.state.userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
    }
    if (window.EngineCore) window.EngineCore.reset();
    const tbody = document.getElementById('historyBody');
    if (tbody) tbody.innerHTML = '';

    // 2. Reprocess spins silently
    if (window.InputProcessor && window.InputProcessor.processSpinValue) {
        for (const spinNum of spins) {
            await window.InputProcessor.processSpinValue(spinNum, { silent: true, skipStoreSync: true });
        }
    }

    // 3. Re-render the entire history table from the new state.history
    if (window.reRenderHistory) window.reRenderHistory();

    // 4. Final UI updates
    if (window.renderGapStats) window.renderGapStats();
    const alerts = window.scanAllStrategies ? await window.scanAllStrategies() : [];
    if (window.renderDashboardSafe) window.renderDashboardSafe(alerts);
    if (window.HudManager) window.HudManager.update();
    if (window.saveSessionData) window.saveSessionData();
    if (window.syncAppStore) window.syncAppStore();
};

// --- COMBO BRIDGE RENDERERS (VISUAL UI) ---
window.layoutComboBridge = function (spinId) {
    const row = document.getElementById(`row-${spinId}`);
    if (!row) return;

    const layer = row.querySelector('.combo-link-layer');
    const badge = row.querySelector('.combo-badge');
    const comboCell = row.querySelector('td:nth-child(4)');
    if (!layer || !badge || !comboCell) return;

    const prevSpinId = layer.dataset.prevSpinId;
    const prevFace = parseInt(layer.dataset.prevFace, 10);
    const currFace = parseInt(layer.dataset.currFace, 10);
    const color = layer.dataset.color || '#ffffff';

    if (!prevSpinId || Number.isNaN(prevFace) || Number.isNaN(currFace)) return;

    const prevTag = document.querySelector(`.face-tag[data-spin-id="${prevSpinId}"][data-face-id="${prevFace}"]`);
    const currTag = row.querySelector(`.face-tag[data-spin-id="${spinId}"][data-face-id="${currFace}"]`);
    if (!prevTag || !currTag) return;

    const cellRect = comboCell.getBoundingClientRect();
    const prevRect = prevTag.getBoundingClientRect();
    const currRect = currTag.getBoundingClientRect();
    const badgeRect = badge.getBoundingClientRect();

    const prevPoint = {
        x: prevRect.right - cellRect.left + 2,
        y: prevRect.top + prevRect.height / 2 - cellRect.top
    };
    const currPoint = {
        x: currRect.right - cellRect.left + 2,
        y: currRect.top + currRect.height / 2 - cellRect.top
    };
    const targetPoint = {
        x: badgeRect.left - cellRect.left + 4,
        y: badgeRect.top + badgeRect.height / 2 - cellRect.top
    };
    const maxAllowedSpan = Math.max(comboCell.offsetHeight * 2.4, 140);
    if (
        Math.abs(prevPoint.y - targetPoint.y) > maxAllowedSpan ||
        Math.abs(currPoint.y - targetPoint.y) > maxAllowedSpan
    ) {
        layer.innerHTML = '';
        layer._comboGeom = null;
        return;
    }

    const nextGeom = { p1: prevPoint, p2: currPoint, t: targetPoint, color: color };
    const prevGeom = layer._comboGeom || { p1: { ...targetPoint }, p2: { ...targetPoint }, t: { ...targetPoint }, color: color };

    if (window.animateComboBridge) window.animateComboBridge(layer, prevGeom, nextGeom, 260);
    layer._comboGeom = nextGeom;
}

window.layoutAllComboBridges = function () {
    if (window.state && window.state.history) {
        window.state.history.forEach(spin => window.layoutComboBridge(spin.id));
    }
}

window.scheduleComboBridgeRelayout = function () {
    if (window._comboRelayoutFrame) cancelAnimationFrame(window._comboRelayoutFrame);
    window._comboRelayoutFrame = requestAnimationFrame(() => {
        window._comboRelayoutFrame = null;
        if (window.layoutAllComboBridges) window.layoutAllComboBridges();
    });
};

window.initComboBridgeAutoLayout = function () {
    if (window._comboBridgeAutoLayoutInit) return;
    window._comboBridgeAutoLayoutInit = true;

    window.addEventListener('resize', window.scheduleComboBridgeRelayout, { passive: true });
    window.addEventListener('orientationchange', window.scheduleComboBridgeRelayout, { passive: true });

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => {
        if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout();
    });

    const scrollPane = document.querySelector('#scrollContainer > div');
    const historyBody = document.getElementById('historyBody');
    if (scrollPane) observer.observe(scrollPane);
    if (historyBody) observer.observe(historyBody);
    window._comboBridgeResizeObserver = observer;
};

window.ensureComboBridgeElements = function (layer) {
    let svg = layer.querySelector('svg');
    if (!svg) {
        layer.innerHTML = `
            <svg class="overflow-visible">
                <path class="combo-path-glow-1" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                <path class="combo-path-glow-2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                <path class="combo-path-core-1" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                <path class="combo-path-core-2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `;
        svg = layer.querySelector('svg');
    }
    return {
        svg,
        glow1: layer.querySelector('.combo-path-glow-1'),
        glow2: layer.querySelector('.combo-path-glow-2'),
        core1: layer.querySelector('.combo-path-core-1'),
        core2: layer.querySelector('.combo-path-core-2')
    };
}

window.drawComboBridge = function (layer, geom) {
    const { svg, glow1, glow2, core1, core2 } = window.ensureComboBridgeElements(layer);

    const minX = Math.min(geom.p1.x, geom.p2.x, geom.t.x) - 10;
    const maxX = Math.max(geom.p1.x, geom.p2.x, geom.t.x) + 6;
    const minY = Math.min(geom.p1.y, geom.p2.y, geom.t.y) - 10;
    const maxY = Math.max(geom.p1.y, geom.p2.y, geom.t.y) + 10;

    const width = Math.max(24, maxX - minX);
    const height = Math.max(24, maxY - minY);

    layer.style.left = `${minX}px`;
    layer.style.top = `${minY}px`;
    layer.style.width = `${width}px`;
    layer.style.height = `${height}px`;
    
    svg.setAttribute('width', width);
    svg.setAttribute('height', height);
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

    const p1 = { x: geom.p1.x - minX, y: geom.p1.y - minY };
    const p2 = { x: geom.p2.x - minX, y: geom.p2.y - minY };
    const t = { x: geom.t.x - minX, y: geom.t.y - minY };

    const makePath = (p) => {
        const spanX = Math.max(18, t.x - p.x);
        const dy = t.y - p.y;
        const c1x = p.x + Math.max(10, Math.min(26, spanX * 0.52));
        const c2x = t.x - Math.max(6, Math.min(14, spanX * 0.28));
        const c1y = p.y + dy * 0.08;
        const c2y = t.y - dy * 0.08;
        return `M ${p.x} ${p.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${t.x} ${t.y}`;
    };

    const d1 = makePath(p1);
    const d2 = makePath(p2);

    const connectorReach = Math.max(24, t.x - Math.min(p1.x, p2.x));
    const responsiveScale = Math.max(0.62, Math.min(1, connectorReach / 150));
    const coreWidth = (2.2 * responsiveScale).toFixed(2);
    const glowWidth = (4.4 * responsiveScale).toFixed(2);
    const coreOpacity = Math.max(0.78, Math.min(0.95, 0.78 + responsiveScale * 0.16)).toFixed(2);
    const glowOpacity = Math.max(0.22, Math.min(0.35, 0.18 + responsiveScale * 0.17)).toFixed(2);
    const blurPx = Math.max(2, Math.round(4 * responsiveScale));

    [glow1, glow2].forEach((p, idx) => {
        p.setAttribute('d', idx === 0 ? d1 : d2);
        p.setAttribute('stroke', geom.color);
        p.setAttribute('stroke-width', glowWidth);
        p.setAttribute('stroke-opacity', glowOpacity);
        p.style.filter = `drop-shadow(0 0 ${blurPx}px ${geom.color})`;
    });
    [core1, core2].forEach((p, idx) => {
        p.setAttribute('d', idx === 0 ? d1 : d2);
        p.setAttribute('stroke', geom.color);
        p.setAttribute('stroke-width', coreWidth);
        p.setAttribute('stroke-opacity', coreOpacity);
    });
}

window.animateComboBridge = function (layer, fromGeom, toGeom, duration = 260) {
    if (layer._comboAnimFrame) cancelAnimationFrame(layer._comboAnimFrame);
    const startTime = performance.now();
    const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = (now) => {
        const raw = Math.min(1, (now - startTime) / duration);
        const t = easeInOutCubic(raw);
        const geom = {
            p1: { x: lerp(fromGeom.p1.x, toGeom.p1.x, t), y: lerp(fromGeom.p1.y, toGeom.p1.y, t) },
            p2: { x: lerp(fromGeom.p2.x, toGeom.p2.x, t), y: lerp(fromGeom.p2.y, toGeom.p2.y, t) },
            t: { x: lerp(fromGeom.t.x, toGeom.t.x, t), y: lerp(fromGeom.t.y, toGeom.t.y, t) },
            color: toGeom.color
        };
        if (window.drawComboBridge) window.drawComboBridge(layer, geom);
        if (raw < 1) {
            layer._comboAnimFrame = requestAnimationFrame(tick);
        } else {
            layer._comboAnimFrame = null;
            layer._comboGeom = toGeom;
        }
    };
    layer._comboAnimFrame = requestAnimationFrame(tick);
}

// --- RESTORED GLOBAL UI HANDLERS (MODALS, MENUS, STOPWATCH) ---
window.addSpin = function () { if (window.InputProcessor) window.InputProcessor.addSpin(); };
window.undoSpin = function () { if (window.InputProcessor) window.InputProcessor.undoSpin(); };

window.toggleInputLayout = function () {
    if (!window.state) return;
    window.state.currentInputLayout = window.state.currentInputLayout === 'grid' ? 'racetrack' : 'grid';
    const label = document.getElementById('layoutLabel');
    if (label) {
        label.innerText = window.state.currentInputLayout.toUpperCase();
        if (window.state.currentInputLayout === 'racetrack') {
            label.className = "text-[9px] font-black bg-[#BF5AF2]/20 px-2.5 py-1 rounded-md text-[#BF5AF2] shadow-inner";
        } else {
            label.className = "text-[9px] font-black bg-white/10 px-2.5 py-1 rounded-md text-white shadow-inner";
        }
    }
    if (window.UiController && window.UiController.initDesktopGrid) {
        window.UiController.initDesktopGrid();
    }
    if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout();
};
window.resetData = function () {
    if (window.state) {
        window.state.history = [];
        window.state.activeBets = [];
        window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    }
    if (window.EngineCore) window.EngineCore.reset();
    const tbody = document.getElementById('historyBody');
    if (tbody) tbody.innerHTML = '';
    if (window.renderGapStats) window.renderGapStats();
    if (window.renderDashboardSafe) window.renderDashboardSafe([]);
    const confirmModal = document.getElementById('confirmModal');
    if (confirmModal && !confirmModal.classList.contains('hidden')) {
        confirmModal.classList.add('hidden');
    }
};

// --- RESTORED GLOBAL BRIDGES & UTILITIES ---
/**
 * Centralized trigger for the math-heavy PredictionEngine.
 * Updates state.engineSnapshot with fresh targets and metrics.
 */
window.syncPredictionEngine = async function() {
    if (!window.PredictionEngine || typeof window.PredictionEngine.evaluatePredictionEngine !== 'function') {
        console.warn('PredictionEngine not found.');
        return null;
    }
    
    // Evaluate the history and store result in state.engineSnapshot
    const snapshot = await window.PredictionEngine.evaluatePredictionEngine(state.history, {
        currentPredictionStrategy: state.ui.strategy === 'combo' ? 'momentum-gap' : 'legacy-face'
    });
    
    state.engineSnapshot = snapshot;
    return snapshot;
};

window.scanAllStrategies = function (options = {}) {
    if (window.EngineCore && typeof window.EngineCore.scanAll === 'function' && window.state) {
        return window.EngineCore.scanAll(
            window.state.history,
            window.state.engineSnapshot || {},
            window.state.currentGameplayStrategy || 'series',
            window.state.patternConfig || {},
            options
        );
    }
    console.warn('EngineCore.scanAll not found.');
    return [];
};

window.syncAppStore = function () {
    if (window.AppStore && typeof window.AppStore.dispatch === 'function' && window.state) {
        window.AppStore.dispatch('engine/sync', window.state);
    }
};

window.updateUserStats = function (isWin, bet, spinIndex, unitChange) {
    if (!window.state || !window.state.userStats) return;
    const uStats = window.state.userStats;

    if (isWin) {
        uStats.totalWins++;
    } else {
        uStats.totalLosses++;
    }
    uStats.netUnits += unitChange;
    uStats.bankrollHistory.push(uStats.netUnits);

    uStats.betLog.unshift({
        id: uStats.totalWins + uStats.totalLosses,
        pattern: bet.patternName,
        target: `F${bet.targetFace}`,
        spinNum: spinIndex + 1,
        result: isWin ? 'WIN' : 'LOSS',
        units: unitChange
    });
};

let heavyUpdateTimeout = null;
window.debounceHeavyUIUpdates = function () {
    if (heavyUpdateTimeout) clearTimeout(heavyUpdateTimeout);
    heavyUpdateTimeout = setTimeout(() => {
        if (window.renderAnalytics) window.renderAnalytics();
        if (window.renderUserAnalytics) window.renderUserAnalytics();
        if (window.HudManager && window.HudManager.update) window.HudManager.update();
    }, 100);
};

// --- ANALYTICS & RENDERING ---
window.switchAnalyticsTab = function (tab) {
    if (!state) return;
    state.currentAnalyticsTab = tab;
    applyAnalyticsTabUI();
    window.renderAnalytics();
};

window.setAnalyticsDisplayStrategy = function (strat) {
    if (!state) return;
    state.analyticsDisplayStrategy = strat;
    const btnSeries = document.getElementById('analyticsBtnSeries');
    const btnCombo = document.getElementById('analyticsBtnCombo');
    const pillBg = document.getElementById('analyticsTogglePillBg');

    if (strat === 'series') {
        if (btnSeries) btnSeries.className = "flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 text-[#30D158] transition-colors relative z-10";
        if (btnCombo) btnCombo.className = "flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 text-gray-400 transition-colors relative z-10";
        if (pillBg) pillBg.style.transform = 'translateX(0)';
    } else {
        if (btnSeries) btnSeries.className = "flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 text-gray-400 transition-colors relative z-10";
        if (btnCombo) btnCombo.className = "flex-1 text-[10px] font-bold uppercase tracking-wider py-1.5 text-[#30D158] transition-colors relative z-10";
        if (pillBg) pillBg.style.transform = 'translateX(100%)';
    }
    renderStrategyAnalytics();
};

window.changeIntelMode = function (mode) {
    if (!state) return;
    state.currentIntelligenceMode = mode;
    // Re-render will automatically pick up mode changes if intelligence panel is rebuilt
};

function applyAnalyticsTabUI() {
    const tabs = ['strategy', 'intelligence', 'advancements'];
    tabs.forEach(t => {
        const btn = document.getElementById(`tabBtn${t.charAt(0).toUpperCase() + t.slice(1)}`);
        const panelId = t === 'strategy' ? 'strategyAnalyticsPanel' : `${t}Panel`;
        const panel = document.getElementById(panelId);

        if (btn) {
            if (t === state.currentAnalyticsTab) {
                btn.className = "pb-2 text-xs font-bold uppercase tracking-widest text-[#30D158] border-b-2 border-[#30D158] transition-all";
            } else {
                btn.className = "pb-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all";
            }
        }
        if (panel) {
            if (t === state.currentAnalyticsTab) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        }
    });
}

window.renderAnalytics = function () {
    if (!state) return;
    applyAnalyticsTabUI();
    if (state.currentAnalyticsTab === 'strategy') {
        renderStrategyAnalytics();
    } else if (state.currentAnalyticsTab === 'intelligence') {
        if (window.renderIntelligencePanel) window.renderIntelligencePanel();
    } else if (state.currentAnalyticsTab === 'advancements') {
        const advPanel = document.getElementById('advancementLogContainer');
        if (advPanel) advPanel.innerHTML = '<div class="text-white/40 text-center py-6 text-xs italic tracking-wide">Advancements tracking active. Awaiting threshold breaches.</div>';
    }
};

// --- INTELLIGENCE PANEL HELPERS ---
window.sortEngineReadCombos = function (comboStats) {
    return (comboStats || []).slice().sort((a, b) =>
        (b.hits - a.hits) ||
        ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) ||
        (a.label > b.label ? 1 : -1)
    );
};

window.getEngineStateTone = function(stateStr) {
    const tones = {
        BUILDING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded',
        WAITING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded',
        READY: 'text-[#30D158] bg-[#30D158]/10 border border-[#30D158]/20 px-2 py-0.5 rounded',
        FOLLOW_UP: 'text-[#0A84FF] bg-[#0A84FF]/10 border border-[#0A84FF]/20 px-2 py-0.5 rounded',
        WATCHLIST: 'text-[#FFD60A] bg-[#FFD60A]/10 border border-[#FFD60A]/20 px-2 py-0.5 rounded',
        NO_SIGNAL: 'text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded'
    };
    return tones[stateStr] || 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded';
};

window.getMetricToneClass = function(metric, value) {
    switch (metric) {
        case 'hits':
            if (value >= 3) return 'text-[#30D158] drop-shadow-sm font-bold';
            if (value === 2) return 'text-[#FFD60A] font-bold';
            if (value === 1) return 'text-[#FF453A]';
            return 'text-gray-500 opacity-50';
        case 'hotPercent':
        case 'coldPercent':
            if (value >= (metric === 'hotPercent' ? 25 : 85)) return 'text-[#30D158] drop-shadow-sm font-bold';
            if (value >= (metric === 'hotPercent' ? 15 : 65)) return 'text-[#FFD60A] font-bold';
            if (value > 0) return 'text-[#FF453A]';
            return 'text-gray-500 opacity-50';
        case 'margin':
            if (value >= 2) return 'text-[#30D158] font-bold';
            if (value === 1) return 'text-[#FFD60A] font-bold';
            if (value === 0) return 'text-[#FF453A]';
            return 'text-gray-500 opacity-50';
        case 'confirmation':
            return value >= 1 ? 'text-[#30D158] drop-shadow-sm font-bold' : 'text-[#FF453A] font-bold';
        case 'lastSeen':
            if (value === null || value === undefined || value === '-') return 'text-gray-500 opacity-50';
            if (value <= 1) return 'text-[#30D158] font-bold';
            if (value <= 3) return 'text-[#FFD60A] font-bold';
            return 'text-[#FF453A] font-bold';
        case 'checkpoint':
            if (value <= 1) return 'text-[#FFD60A] font-bold';
            if (value <= 3) return 'text-[#FF453A] font-bold';
            return 'text-gray-500 opacity-50';
        default:
            return 'text-gray-500 opacity-50';
    }
};

window.getPredictionToneClass = function(snapshot) {
    if (!snapshot) return 'text-gray-500';
    if (snapshot.currentPrediction) return 'text-[#30D158] font-bold drop-shadow-sm';
    if (snapshot.engineState === 'WATCHLIST') return 'text-[#FFD60A] font-bold';
    if (snapshot.engineState === 'NO_SIGNAL') return 'text-gray-400';
    return 'text-gray-500';
};

window.formatEnginePrediction = function(snapshot) {
    if (!snapshot) return 'No engine state available.';
    if (snapshot.currentPrediction) {
        const action = snapshot.currentPrediction.action || 'BET';
        const confidence = Number.isFinite(snapshot.currentPrediction.confidence) ? ` ${snapshot.currentPrediction.confidence}%` : '';
        return `${action} F${snapshot.currentPrediction.targetFace} via ${snapshot.currentPrediction.comboLabel}${confidence}.`;
    }
    return snapshot.watchlistMessage || snapshot.leadMessage || 'No actionable signal.';
};

window.renderIntelligencePanel = function() {
    const content = document.getElementById('intelligenceContent');
    const stateChip = document.getElementById('intelStateChip');
    const checkpointSummary = document.getElementById('intelCheckpointSummary');
    const nextCheckpoint = document.getElementById('intelNextCheckpoint');
    if (!content) return;

    const ENGINE_PRIMARY_WINDOW = window.state ? window.state.ENGINE_PRIMARY_WINDOW : 14;
    const ENGINE_CONFIRMATION_WINDOW = window.state ? window.state.ENGINE_CONFIRMATION_WINDOW : 5;
    
    const snapshot = window.state.engineSnapshot || {};
    const rankedCombos = window.sortEngineReadCombos(snapshot.comboCoverage || []);
    const leadCombo = snapshot.dominantCombo;
    const runnerUp = snapshot.runnerUpCombo;

    if (stateChip) {
        stateChip.innerText = snapshot.engineState || 'IDLE';
        stateChip.className = `font-black text-[9px] tracking-widest uppercase ${window.getEngineStateTone(snapshot.engineState)}`;
    }

    if (checkpointSummary) {
        checkpointSummary.innerText = snapshot.checkpointStatus || 'Waiting for valid sample';
        checkpointSummary.className = `font-bold text-[10px] tracking-widest uppercase ${window.getPredictionToneClass(snapshot)}`;
    }

    if (nextCheckpoint) {
        nextCheckpoint.innerText = snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW;
        nextCheckpoint.className = `text-lg font-black tracking-tighter ${window.getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}`;
    }

    const comboRows = rankedCombos.map((combo, index) => `
        <tr class="hover:bg-white/5 transition-colors">
            <td class="p-3 font-bold tracking-widest text-[10px]" style="color:${combo.color}">${index + 1}. ${combo.label}</td>
            <td class="p-3 font-mono ${window.getMetricToneClass('hits', combo.hits)}">${combo.hits}</td>
            <td class="p-3 font-mono ${window.getMetricToneClass('hotPercent', combo.hotPercent)}">${combo.hotPercent}%</td>
            <td class="p-3 font-mono ${window.getMetricToneClass('coldPercent', combo.coldPercent)}">${combo.coldPercent}%</td>
            <td class="p-3 font-mono ${window.getMetricToneClass('lastSeen', combo.lastSeenDistance ?? '-')}">${combo.lastSeenDistance ?? '-'}</td>
        </tr>
    `).join('');

    content.innerHTML = `
        <div class="grid grid-cols-2 gap-3 mt-2">
            <div class="col-span-2 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-xl p-4 text-center shadow-lg">
                <div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Lead Insight</div>
                <div class="text-lg mb-1 ${window.getPredictionToneClass(snapshot)}">${snapshot.leadMessage || 'Awaiting Valid Sample'}</div>
                <div class="text-[11px] font-medium text-white/70">${window.formatEnginePrediction(snapshot)}</div>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                <div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Primary Read</div><div class="text-lg font-bold tracking-wide" style="color:${leadCombo ? leadCombo.color : '#f0f0f0'}">${leadCombo ? leadCombo.label : 'No combo'}</div></div>
                <div class="text-[10px] text-white/60 mt-2">${leadCombo ? `<span class="${window.getMetricToneClass('hits', leadCombo.hits)}">${leadCombo.hits} hits</span> in rolling 14` : 'Waiting for a valid sample.'}</div>
            </div>
            <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                <div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Runner-Up Margin</div><div class="text-lg font-bold tracking-wide ${window.getMetricToneClass('margin', snapshot.topMargin)}">${leadCombo ? `${(snapshot.topMargin || 0) >= 0 ? '+' : ''}${snapshot.topMargin || 0}` : '-'}</div></div>
                <div class="text-[10px] text-white/60 mt-2">${runnerUp ? `Runner-up is ${runnerUp.label} (${runnerUp.hits} hits)` : 'No runner-up yet.'}</div>
            </div>
        </div>
        <div class="col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden mt-4 shadow-sm">
            <div class="bg-black/30 text-white/40 text-[9px] font-black uppercase tracking-widest p-3 border-b border-white/5">14-Spin Combo Ranking</div>
            <table class="w-full text-left text-xs">
                <thead class="bg-black/10 text-white/30 uppercase text-[9px] tracking-wider border-b border-white/5">
                    <tr><th class="p-3">Combo</th><th class="p-3">Hits</th><th class="p-3">Hot</th><th class="p-3">Cold</th><th class="p-3">Last Seen</th></tr>
                </thead>
                <tbody class="divide-y divide-white/5">${comboRows || '<tr><td colspan="5" class="p-6 text-center text-white/30 italic">Awaiting data...</td></tr>'}</tbody>
            </table>
        </div>
    `;
};

function renderStrategyAnalytics() {
    const coreStats = window.EngineCore && window.EngineCore.stats
        ? window.EngineCore.stats
        : { totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0, bankrollHistory: [0], patternStats: {} };

    const totalSignals = coreStats.totalWins + coreStats.totalLosses;
    const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.totalWins / totalSignals) * 100);

    const hrEl = document.getElementById('kpiHitRate');
    if (hrEl) {
        hrEl.innerText = hitRate + "%";
        hrEl.className = `text-2xl font-bold tracking-tight ${hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;
    }

    const netEl = document.getElementById('kpiNet');
    if (netEl) {
        netEl.innerText = (coreStats.netUnits > 0 ? '+' : '') + coreStats.netUnits;
        netEl.className = `text-2xl font-bold tracking-tight ${coreStats.netUnits >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;
    }

    const sigEl = document.getElementById('kpiSignals');
    if (sigEl) sigEl.innerText = totalSignals;

    const s = coreStats.currentStreak || 0;
    const formEl = document.getElementById('kpiForm');
    if (formEl) {
        formEl.innerText = s > 0 ? `W${s}` : (s < 0 ? `L${Math.abs(s)}` : '-');
        formEl.className = `text-2xl font-bold tracking-tight ${s > 0 ? 'text-[#30D158]' : (s < 0 ? 'text-[#FF453A]' : 'text-gray-400')}`;
    }

    drawAdvancedGraph(coreStats.bankrollHistory, coreStats.totalWins, coreStats.totalLosses, 'graphContainer');
    updatePatternHeatmap(coreStats.patternStats);
}

window.renderUserAnalytics = function () {
    if (!state) return;
    const uStats = state.userStats || { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
    const totalBets = uStats.totalWins + uStats.totalLosses;
    const hitRate = totalBets === 0 ? 0 : Math.round((uStats.totalWins / totalBets) * 100);

    const netEl = document.getElementById('userNet');
    if (netEl) {
        netEl.innerText = (uStats.netUnits > 0 ? '+' : '') + uStats.netUnits;
        netEl.className = `text-4xl font-bold tracking-tight ${uStats.netUnits >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;
    }

    const hrEl = document.getElementById('userHitRate');
    if (hrEl) hrEl.innerText = hitRate + "%";

    const totEl = document.getElementById('userTotal');
    if (totEl) totEl.innerText = totalBets;

    drawAdvancedGraph(uStats.bankrollHistory, uStats.totalWins, uStats.totalLosses, 'userGraphContainer');
    updateUserBetLog(uStats.betLog);
};

function drawAdvancedGraph(historyArray, winCount, lossCount, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.className = "flex flex-col h-full w-full rounded-b-xl overflow-hidden";

    const chartDiv = document.createElement('div');
    chartDiv.className = "relative h-[80%] w-full bg-black/20";
    container.appendChild(chartDiv);

    const hudDiv = document.createElement('div');
    hudDiv.className = "h-[20%] w-full flex justify-between items-center px-4 text-[10px] font-bold bg-white/5 border-t border-white/5 backdrop-blur-sm";
    hudDiv.innerHTML = `
        <span class="text-[#4ade80] drop-shadow-sm tracking-wide">WINS: ${winCount || 0}</span>
        <span class="text-[#e5e7eb] drop-shadow-sm tracking-wide">SPINS: ${historyArray ? Math.max(0, historyArray.length - 1) : 0}</span>
        <span class="text-[#f87171] drop-shadow-sm tracking-wide">LOSSES: ${lossCount || 0}</span>
    `;
    container.appendChild(hudDiv);

    if (!historyArray || historyArray.length < 2) {
        chartDiv.innerHTML = `<div class="flex items-center justify-center h-full text-xs text-[#8E8E93] font-mono animate-pulse">Waiting for Data...</div>`;
        return;
    }

    const vWidth = 600;
    const vHeight = 200;
    const padding = 10;

    const maxVal = Math.max(...historyArray);
    const minVal = Math.min(...historyArray);
    let range = maxVal - minVal;
    if (range === 0) range = 2;

    const getX = i => (i / (historyArray.length - 1)) * (vWidth - 2 * padding) + padding;
    const getY = v => vHeight - padding - ((v - minVal) / range) * (vHeight - 2 * padding);

    let pathD = `M ${getX(0)} ${getY(historyArray[0])}`;
    for (let i = 1; i < historyArray.length; i++) {
        pathD += ` L ${getX(i)} ${getY(historyArray[i])}`;
    }

    const zeroY = getY(0);
    let zeroOffset = 0;
    if (maxVal > 0 && minVal < 0) {
        zeroOffset = (maxVal / range) * 100;
    } else if (minVal >= 0) {
        zeroOffset = 100;
    }

    const svgContent = `
        <svg viewBox="0 0 ${vWidth} ${vHeight}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;">
            <defs>
                <linearGradient id="profitGrad-${containerId}" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#4ade80" />
                    <stop offset="${zeroOffset}%" stop-color="#4ade80" />
                    <stop offset="${zeroOffset}%" stop-color="#f87171" />
                    <stop offset="100%" stop-color="#f87171" />
                </linearGradient>
            </defs>
            <line x1="${padding}" y1="${zeroY}" x2="${vWidth - padding}" y2="${zeroY}" 
                  stroke="#9ca3af" stroke-width="2" stroke-dasharray="6 6" opacity="0.3" vector-effect="non-scaling-stroke" />
            <path d="${pathD}" fill="none" stroke="url(#profitGrad-${containerId})" 
                  stroke-width="3" stroke-linecap="round" stroke-linejoin="round" 
                  vector-effect="non-scaling-stroke" 
                  style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" />
        </svg>
    `;

    chartDiv.innerHTML = svgContent;
}

function updatePatternHeatmap(patternData) {
    const tbody = document.getElementById('heatmapBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const patterns = Object.entries(patternData || {});

    if (patterns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No patterns recorded yet</td></tr>';
        return;
    }

    patterns.sort((a, b) => {
        const rA = a[1].wins / ((a[1].wins + a[1].losses) || 1);
        const rB = b[1].wins / ((b[1].wins + b[1].losses) || 1);
        return rB - rA;
    });

    patterns.forEach(([name, s]) => {
        const total = s.wins + s.losses;
        const rate = total === 0 ? 0 : Math.round((s.wins / total) * 100);
        const color = rate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]';
        const bar = rate >= 50 ? 'bg-[#30D158]' : 'bg-[#FF453A]';

        tbody.innerHTML += `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="p-3 font-semibold text-gray-200">
                    <div class="flex items-center justify-between">
                        <span class="tracking-wide">${name}</span>
                        <button onclick="event.stopPropagation(); window.openPatternLog && window.openPatternLog('${name}')" class="text-[#8E8E93] hover:text-white cursor-pointer px-2 py-1 rounded-full hover:bg-white/10 transition-colors" title="View Log">
                            <i class="fas fa-list-ul"></i>
                        </button>
                    </div>
                </td>
                <td class="p-3 text-right text-[#30D158] font-mono font-bold drop-shadow-sm">${s.wins}</td>
                <td class="p-3 text-right text-[#FF453A] font-mono font-bold drop-shadow-sm">${s.losses}</td>
                <td class="p-3 text-right w-24 relative">
                    <div class="absolute inset-y-4 left-2 right-2 bg-[#3a3a3c] rounded-full overflow-hidden h-1.5 mt-2 shadow-inner">
                        <div class="h-full ${bar}" style="width: ${rate}%"></div>
                    </div>
                    <span class="relative z-10 ${color} font-bold text-[10px] top-[-8px] right-[0px]">${rate}%</span>
                </td>
            </tr>
        `;
    });
}

function updateUserBetLog(betLog) {
    const tbody = document.getElementById('userBetsBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!betLog || betLog.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No confirmed bets yet</td></tr>';
        return;
    }

    betLog.forEach(log => {
        const resClass = log.result === 'WIN' ? 'text-[#30D158]' : 'text-[#FF453A]';
        const unitsText = log.units > 0 ? `+${log.units}` : log.units;
        const targetText = String(log.target || '').replace('F', '');

        tbody.innerHTML += `
            <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                <td class="p-3 text-[#8E8E93] font-mono text-xs">#${log.id || '-'}</td>
                <td class="p-3 font-bold text-gray-200 tracking-wide">${log.pattern || '-'}</td>
                <td class="p-3 text-center font-bold text-white"><span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10 shadow-sm text-xs">F${targetText}</span></td>
                <td class="p-3 text-right">
                    <span class="text-[9px] text-[#8E8E93] mr-2">Spin ${log.spinNum || '-'}</span>
                    <span class="font-bold ${resClass} text-sm drop-shadow-sm">${log.result || '-'} (${unitsText})</span>
                </td>
            </tr>
        `;
    });
}

// --- DATA IMPORT & EXPORT ---
window.exportSpins = function () {
    if (!window.state || !window.state.history || window.state.history.length === 0) {
        alert("No spins to export!");
        return;
    }
    const spins = window.state.history.map(h => h.num);
    const data = { timestamp: Date.now(), spins: spins };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `Roulette_Spins_${dateStr}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

window.importSpins = function (input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data.spins)) {
                if (window.rebuildSessionFromSpins) {
                    if (window.toggleHamburgerMenu) window.toggleHamburgerMenu();
                    await window.rebuildSessionFromSpins(data.spins);

                    const inputField = document.getElementById('spinInput');
                    if (inputField) {
                        inputField.value = '';
                        inputField.focus();
                    }
                }
            } else {
                alert("Invalid file format: 'spins' array missing.");
            }
        } catch (err) {
            alert("Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = '';
};

// --- AI CHAT MODULE ---
window.sendAiChatMessage = async function () {
    const input = document.getElementById('aiChatInput');
    const historyContainer = document.getElementById('aiChatHistory');
    if (!input || !historyContainer || !input.value.trim()) return;

    const message = input.value.trim();
    input.value = '';

    // 1. Render User Message
    historyContainer.innerHTML += `
        <div class="flex justify-end">
            <div class="bg-[#bf5af2]/20 border border-[#bf5af2]/30 text-white p-3 rounded-xl rounded-tr-sm max-w-[85%] text-xs shadow-md">
                ${message}
            </div>
        </div>
    `;
    historyContainer.scrollTop = historyContainer.scrollHeight;

    // 2. Render Loading State
    const typingId = 'typing-' + Date.now();
    historyContainer.innerHTML += `
        <div id="${typingId}" class="flex justify-start">
            <div class="bg-white/5 border border-white/10 text-white/60 p-3 rounded-xl rounded-tl-sm max-w-[85%] text-xs italic animate-pulse ai-chat-scramble-text" data-text="Consulting local brain...">
                Consulting local brain...
            </div>
        </div>
    `;
    historyContainer.scrollTop = historyContainer.scrollHeight;

    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!';
    const scrambleInterval = setInterval(() => {
        const el = document.querySelector(`#${typingId} .ai-chat-scramble-text`);
        if (el) {
            const original = el.dataset.text;
            let scrambled = '';
            for(let i = 0; i < original.length; i++) {
                if (original[i] === ' ') scrambled += ' ';
                else scrambled += Math.random() > 0.75 ? chars[Math.floor(Math.random() * chars.length)] : original[i];
            }
            el.innerText = scrambled;
        }
    }, 50);

    // 3. Formulate Prompt & Fetch
    try {
        if (!window.AiBrain) throw new Error("AI module unavailable.");
        const context = window.state ? `Recent history: ${window.state.history.slice(-12).map(s => s.num).join(', ')}. Net: ${window.state.userStats ? window.state.userStats.netUnits : 0}u.` : "";

        const responseText = await window.AiBrain.requestAiText(
            `ROLE: Elite Roulette Table Boss.\nCONTEXT: ${context}\nUSER: ${message}`,
            { requestMode: 'chat', maxOutputTokens: 250 }
        );

        clearInterval(scrambleInterval);
        document.getElementById(typingId).remove();
        historyContainer.innerHTML += `
            <div class="flex justify-start">
                <div class="bg-black/40 border border-white/10 text-white p-3 rounded-xl rounded-tl-sm max-w-[85%] text-xs shadow-md leading-relaxed whitespace-pre-wrap">${responseText.trim()}</div>
            </div>
        `;
    } catch (error) {
        clearInterval(scrambleInterval);
        document.getElementById(typingId).remove();
        historyContainer.innerHTML += `<div class="flex justify-start"><div class="bg-[#ff1a33]/20 border border-[#ff1a33]/30 text-[#ff1a33] p-3 rounded-xl rounded-tl-sm max-w-[85%] text-xs shadow-md">Error: ${error.message}</div></div>`;
    }
    historyContainer.scrollTop = historyContainer.scrollHeight;
};

// --- AI CONFIG MODAL LOGIC ---
window.toggleAiMasterSwitch = function() {
    if (!state) return;
    state.aiEnabled = !state.aiEnabled;
    if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
    if (window.saveSessionData) window.saveSessionData();
};

window.toggleNeuralPrediction = function() {
    if (!state) return;
    state.neuralPredictionEnabled = !state.neuralPredictionEnabled;
    if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
    if (window.saveSessionData) window.saveSessionData();
};

window.toggleAiApiKeyVisibility = function() {
    const input = document.getElementById('aiApiKeyInput');
    const icon = document.getElementById('toggleAiKeyVisibilityIcon');
    if (!input || !icon) return;
    
    if (input.type === 'password') {
        input.type = 'text';
        icon.classList.remove('fa-eye');
        icon.classList.add('fa-eye-slash');
    } else {
        input.type = 'password';
        icon.classList.remove('fa-eye-slash');
        icon.classList.add('fa-eye');
    }
};

window.saveAiConfig = async function(silent = false) {
    if (!state) return;
    const keyInput = document.getElementById('aiApiKeyInput');
    const providerSelect = document.getElementById('aiProviderSelect');
    const btn = document.getElementById('saveAiBtn');
    
    if (!silent) {
        state.aiApiKey = keyInput ? keyInput.value.trim() : '';
        state.aiProvider = providerSelect ? providerSelect.value : 'gemini';
    }
    
    if (!state.aiApiKey) return;
    
    if (btn && !silent) btn.innerText = 'VERIFYING...';
    
    try {
        const response = await fetch(`${state.AI_RELAY_BASE_URL}/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: state.aiProvider, apiKey: state.aiApiKey })
        });
        const data = await response.json();
        
        if (response.ok && data.connected) {
            state.aiRelayAvailable = true;
            if (btn && !silent) {
                btn.innerText = 'CONNECTED';
                setTimeout(() => { if(btn) btn.innerText = 'VERIFY & SAVE'; }, 2000);
            }
        } else {
            throw new Error(data.error || 'Failed to connect');
        }
    } catch (error) {
        console.error('AI Connection Error:', error);
        state.aiRelayAvailable = false;
        if (btn && !silent) {
            btn.innerText = 'FAILED';
            setTimeout(() => { if(btn) btn.innerText = 'VERIFY & SAVE'; }, 2000);
            alert('AI Connection Failed: ' + error.message);
        }
    }
    
    if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
    if (window.saveSessionData) window.saveSessionData();
};

window.clearAiConfig = async function() {
    if (!state) return;
    const keyInput = document.getElementById('aiApiKeyInput');
    if (keyInput) keyInput.value = '';
    state.aiApiKey = '';
    state.aiRelayAvailable = false;
    
    try {
        await fetch(`${state.AI_RELAY_BASE_URL}/disconnect`, { method: 'POST' });
    } catch(e) {}
    
    if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
    if (window.saveSessionData) window.saveSessionData();
};

window.updateAiConfigModalUI = function() {
    if (!state) return;
    
    const masterSwitch = document.getElementById('aiMasterSwitch');
    const knob = document.getElementById('aiSwitchKnob');
    const statusText = document.getElementById('aiMasterStatusText');
    const vaultSection = document.getElementById('aiVaultSection');
    const hindsightToggle = document.getElementById('aiHindsightToggle');
    const statusBadge = document.getElementById('aiStatusBadge');
    
    if (masterSwitch && knob && statusText && vaultSection) {
        if (state.aiEnabled) {
            masterSwitch.classList.replace('bg-white/10', 'bg-[#30D158]/20');
            masterSwitch.classList.replace('border-white/20', 'border-[#30D158]/30');
            knob.classList.replace('bg-gray-400', 'bg-[#30D158]');
            knob.style.transform = 'translateX(24px)';
            statusText.innerText = 'Enabled';
            vaultSection.classList.remove('hidden');
        } else {
            masterSwitch.classList.replace('bg-[#30D158]/20', 'bg-white/10');
            masterSwitch.classList.replace('border-[#30D158]/30', 'border-white/20');
            knob.classList.replace('bg-[#30D158]', 'bg-gray-400');
            knob.style.transform = 'translateX(0)';
            statusText.innerText = 'Disabled';
            vaultSection.classList.add('hidden');
        }
    }
    
    if (hindsightToggle) {
        const hKnob = hindsightToggle.querySelector('div');
        if (state.neuralPredictionEnabled) {
            hindsightToggle.classList.replace('bg-white/10', 'bg-[#bf5af2]/30');
            hindsightToggle.classList.replace('border-white/20', 'border-[#bf5af2]/50');
            if (hKnob) {
                hKnob.classList.replace('bg-gray-500', 'bg-[#bf5af2]');
                hKnob.style.transform = 'translateX(20px)';
                hKnob.style.boxShadow = '0 0 8px rgba(191,90,242,0.6)';
            }
        } else {
            hindsightToggle.classList.replace('bg-[#bf5af2]/30', 'bg-white/10');
            hindsightToggle.classList.replace('border-[#bf5af2]/50', 'border-white/20');
            if (hKnob) {
                hKnob.classList.replace('bg-[#bf5af2]', 'bg-gray-500');
                hKnob.style.transform = 'translateX(0)';
                hKnob.style.boxShadow = 'none';
            }
        }
    }
    
    if (statusBadge) {
        if (state.aiRelayAvailable) {
            statusBadge.innerText = 'CONNECTED';
            statusBadge.className = 'text-[9px] font-black bg-[#30D158]/20 px-2.5 py-1 rounded-md text-[#30D158] shadow-inner';
        } else {
            statusBadge.innerText = 'NOT CONNECTED';
            statusBadge.className = 'text-[9px] font-black bg-white/10 px-2.5 py-1 rounded-md text-white/50 shadow-inner';
        }
    }

    const headerAiBtn = document.getElementById('headerAiBtn');
    if (headerAiBtn) {
        if (state.aiRelayAvailable) {
            headerAiBtn.classList.add('ai-connected');
            headerAiBtn.classList.remove('ai-offline');
        } else if (state.aiEnabled) {
            headerAiBtn.classList.add('ai-offline');
            headerAiBtn.classList.remove('ai-connected');
        } else {
            headerAiBtn.classList.remove('ai-connected');
            headerAiBtn.classList.remove('ai-offline');
        }
    }
};

// --- MISC. SETTINGS ---
window.changePredictionStrategy = function (val) {
    if (window.state) {
        window.state.currentGameplayStrategy = val;
        if (window.scanAllStrategies) window.scanAllStrategies();
    }
};
window.openAiConfigModal = function () { 
    if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
    const keyInput = document.getElementById('aiApiKeyInput');
    const providerSelect = document.getElementById('aiProviderSelect');
    if (keyInput) keyInput.value = window.state.aiApiKey || '';
    if (providerSelect) providerSelect.value = window.state.aiProvider || 'gemini';
    toggleModal('aiConfigModal'); 
};
window.openAiChat = function () { toggleModal('aiChatModal'); };
