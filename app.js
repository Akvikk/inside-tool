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

// --- RESTORED CORE APP GLUE & INITIALIZATION ---
window.addEventListener('DOMContentLoaded', () => {
    console.log("INSIDE TOOL: Bootstrapping modular architecture...");

    // 1. Initialize Active Modules
    if (window.InputProcessor) window.InputProcessor.init();
    if (window.UiController) window.UiController.init();
    if (window.HudManager) window.HudManager.init();

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

    const resetBtn = document.getElementById('confirmResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', window.resetData);
});

// --- ESSENTIAL UI POLYFILLS ---
window.saveSessionData = function () {
    try {
        localStorage.setItem('insideTool_session_v2', JSON.stringify({
            history: state.history,
            faceGaps: state.faceGaps
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

window.renderDashboardSafe = function (alerts) {
    const dash = document.getElementById('dashboard');
    if (!dash) return;

    let cards = [];
    const activeBets = state.activeBets || [];

    activeBets.forEach((bet, index) => {
        const subtitle = bet.subtitle || (bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName);
        const accent = bet.accentColor || '#FF3B30';
        const bgStyle = bet.confirmed
            ? `background: linear-gradient(135deg, ${accent}50, ${accent}15)`
            : `background: linear-gradient(135deg, ${accent}25, ${accent}05)`;
        const borderStyle = bet.confirmed ? `border-color: ${accent}` : `border-color: ${accent}40`;

        cards.push(`
            <div class="min-w-[250px] h-[64px] px-3 py-2 rounded-lg border flex items-center justify-between cursor-pointer select-none transition-all hover:brightness-110"
                 ondblclick="window.toggleBetConfirmation && window.toggleBetConfirmation(${index})"
                 style="border-left: 3px solid ${accent}; ${borderStyle}; ${bgStyle}; box-shadow: 0 4px 15px ${accent}15;">
                <div class="min-w-0">
                    <div class="text-[15px] leading-tight font-black text-white tracking-wide drop-shadow-sm">BET F${bet.targetFace}</div>
                    <div class="text-[11px] leading-tight text-white/80 font-semibold mt-0.5">${subtitle}</div>
                </div>
            </div>
        `);
    });

    if (cards.length === 0) {
        dash.innerHTML = `<div class="dashboard-empty w-full text-center text-[10px] font-medium text-[#8E8E93]/60 border border-dashed border-white/5 rounded-xl p-2 select-none tracking-wide flex items-center justify-center h-[60px]"><span>AWAITING SIGNALS...</span></div>`;
        return;
    }

    dash.innerHTML = cards.join('');
};

window.renderRow = function (spin) {
    const tbody = document.getElementById('historyBody');
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
            return `<span class="face-tag mb-1 mr-1" data-spin-id="${spin.id}" data-face-id="${fId}" style="color:${fStyle.color}; border:1px solid ${fStyle.border}; background:${fStyle.bg};">F${fId}</span>`;
        }).join('');
        faceHTML = `<div class="flex flex-wrap justify-center">${faceTags}</div>`;
    }

    tr.innerHTML = `
        <td class="text-center font-mono text-xs text-gray-400">#${spin.index + 1}</td>
        <td class="text-center"><div class="num-box ${bgClass}">${spin.num}</div></td>
        <td class="text-center relative z-[5]">${faceHTML}</td>
        <td class="text-center relative overflow-visible z-[1]"><span class="text-gray-600">-</span></td>
        <td class="pl-4"><span class="text-gray-600">-</span></td>
    `;
    tbody.appendChild(tr);

    const sc = document.querySelector('#scrollContainer > div');
    if (sc) { setTimeout(() => { sc.scrollTop = sc.scrollHeight; }, 50); }
};

// --- RESTORED GLOBAL UI HANDLERS (MODALS, MENUS, STOPWATCH) ---
window.addSpin = function () { if (window.InputProcessor) window.InputProcessor.addSpin(); };
window.undoSpin = function () { if (window.InputProcessor) window.InputProcessor.undoSpin(); };

window.toggleHamburgerMenu = function () {
    const menu = document.getElementById('hamburgerMenu');
    const backdrop = document.getElementById('hamburgerBackdrop');
    if (menu) menu.classList.toggle('hidden');
    if (backdrop) backdrop.classList.toggle('hidden');
};

window.toggleAccordion = function (id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(id + 'Icon');
    if (content) {
        content.classList.toggle('hidden');
        if (icon) {
            icon.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
        }
    }
};

window.toggleModal = function (id) {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden');
};

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
};

window.togglePatternFilterPopover = function () {
    const popover = document.getElementById('patternFilterPopover');
    if (popover) popover.classList.toggle('hidden');
};

window.closePatternFilterPopover = function () {
    const popover = document.getElementById('patternFilterPopover');
    if (popover) popover.classList.add('hidden');
};

window.resetSession = function () { toggleModal('confirmModal'); };
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

let swInterval = null;
let swSeconds = 0;
window.toggleStopwatch = function () {
    const icon = document.getElementById('stopwatchIcon');
    const text = document.getElementById('stopwatchText');
    if (swInterval) {
        clearInterval(swInterval);
        swInterval = null;
        if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
        if (text) text.innerText = 'Start';
    } else {
        swInterval = setInterval(() => {
            swSeconds++;
            const display = document.getElementById('stopwatchDisplay');
            if (display) {
                let hrs = Math.floor(swSeconds / 3600);
                let mins = Math.floor((swSeconds % 3600) / 60);
                let secs = swSeconds % 60;
                display.innerText = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
            }
        }, 1000);
        if (icon) { icon.classList.remove('fa-play'); icon.classList.add('fa-pause'); }
        if (text) text.innerText = 'Pause';
    }
};

window.resetStopwatch = function () {
    if (swInterval) clearInterval(swInterval);
    swInterval = null;
    swSeconds = 0;
    const display = document.getElementById('stopwatchDisplay');
    if (display) display.innerText = '00:00:00';
    const icon = document.getElementById('stopwatchIcon');
    const text = document.getElementById('stopwatchText');
    if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
    if (text) text.innerText = 'Start';
};

// Prevent immediate console errors for UI links not yet modularized
window.renderUserAnalytics = function () { console.log("Analytics renderer pending rebuild..."); };
window.renderAnalytics = function () { console.log("Analytics renderer pending rebuild..."); };
window.switchAnalyticsTab = function (tab) { console.log("Switch tab to", tab); };
window.setAnalyticsDisplayStrategy = function (strat) { console.log("Set display strategy to", strat); };
window.changeIntelMode = function (mode) { console.log("Change intel mode to", mode); };
window.exportSpins = function () { alert("Export spins function moved to modular system."); };
window.importSpins = function () { alert("Import spins function moved to modular system."); };
window.changePredictionStrategy = function (val) { console.log("Changed strategy to", val); };
window.openAiConfigModal = function () { toggleModal('aiConfigModal'); };
window.openAiChat = function () { toggleModal('aiChatModal'); };
