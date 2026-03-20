const state = window.state;

function getLatestMathBets() {
    const strategyKey = state && state.currentGameplayStrategy ? state.currentGameplayStrategy : 'series';
    const cachedResult = state && state.strategySyncCache
        ? state.strategySyncCache[strategyKey]
        : null;
    return cachedResult && Array.isArray(cachedResult.nextBets)
        ? cachedResult.nextBets.slice()
        : [];
}

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
        state.activeBets = getLatestMathBets();
    }

    if (renderDashboardNow) {
        if (window.renderDashboardSafe) window.renderDashboardSafe(state.activeBets || []);
        if (window.syncAppStore) window.syncAppStore(); // Broadcast the update
    }

    return signal;
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

async function safeModuleCall(label, handler) {
    try {
        return await handler();
    } catch (error) {
        console.error(`${label} failed:`, error);
        return null;
    }
}

window.syncStrategyUi = function () {
    if (!window.state) return;

    const registry = window.StrategyRegistry || {};
    const strategyKey = window.state.currentGameplayStrategy || 'series';
    const strategy = registry[strategyKey] || null;

    const comboHeader = document.getElementById('historyComboHeader');
    if (comboHeader) {
        comboHeader.innerText = strategy && strategy.tableHeader ? strategy.tableHeader : 'COMBO';
    }

    const strategySelect = document.getElementById('hamburgerStrategySelect');
    if (strategySelect) {
        strategySelect.value = strategyKey;
    }
};

// --- RESTORED CORE APP GLUE & INITIALIZATION ---
window.addEventListener('DOMContentLoaded', async () => {
    console.log("INSIDE TOOL: Bootstrapping modular architecture...");

    // 1. Initialize Active Modules
    await safeModuleCall('InputProcessor.init', () => window.InputProcessor && window.InputProcessor.init && window.InputProcessor.init());
    await safeModuleCall('UiController.init', () => window.UiController && window.UiController.init && window.UiController.init());
    await safeModuleCall('HudManager.init', () => window.HudManager && window.HudManager.init && window.HudManager.init());

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
    const restoredSession = window.loadSessionData
        ? await safeModuleCall('loadSessionData', () => window.loadSessionData())
        : false;
    if (window.ensureActivePatternConfig) {
        window.ensureActivePatternConfig();
    }
    if (window.syncStrategyUi) {
        window.syncStrategyUi();
    }
    if (window.renderPatternFilterUi) {
        window.renderPatternFilterUi();
    }
    if (restoredSession && window.state.history.length > 0) {
        console.log(`Session data loaded. Rebuilding state from ${window.state.history.length} spins...`);
        const spinNumbers = window.state.history.map(s => s.num);
        await safeModuleCall('rebuildSessionFromSpins', () => window.rebuildSessionFromSpins && window.rebuildSessionFromSpins(spinNumbers));
        
        console.log("State rebuilt successfully.");

        // 2.5 Re-authenticate AI silently if enabled
        if (window.state && window.state.aiEnabled && window.state.aiApiKey) {
            await safeModuleCall('saveAiConfig', () => window.saveAiConfig && window.saveAiConfig(true));
        }
    } else if (restoredSession) {
        console.log("Session data loaded, but no history to rebuild.");
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
    await safeModuleCall('renderGapStats', () => window.renderGapStats && window.renderGapStats());
    await safeModuleCall('renderDashboardSafe', () => window.renderDashboardSafe && window.renderDashboardSafe());
    await safeModuleCall('initComboBridgeAutoLayout', () => window.initComboBridgeAutoLayout && window.initComboBridgeAutoLayout());
    await safeModuleCall('scheduleComboBridgeRelayout', () => window.scheduleComboBridgeRelayout && window.scheduleComboBridgeRelayout());
    await safeModuleCall('updateAiConfigModalUI', () => window.updateAiConfigModalUI && window.updateAiConfigModalUI());

    const resetBtn = document.getElementById('confirmResetBtn');
    if (resetBtn) resetBtn.addEventListener('click', window.resetData);
});







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
        x: prevRect.right - cellRect.left + 4,
        y: prevRect.top + prevRect.height / 2 - cellRect.top
    };
    const currPoint = {
        x: currRect.right - cellRect.left + 4,
        y: currRect.top + currRect.height / 2 - cellRect.top
    };
    const badgePoint = {
        x: badgeRect.left - cellRect.left + (badgeRect.width * 0.15),
        y: badgeRect.top + (badgeRect.height / 2) - cellRect.top
    };
    const availableReach = Math.max(30, badgePoint.x - Math.max(prevPoint.x, currPoint.x));
    const mergeBackoff = Math.max(8, Math.min(16, availableReach * 0.2));
    const mergePoint = {
        x: badgePoint.x - mergeBackoff,
        y: badgePoint.y
    };
    const maxAllowedSpan = Math.max(comboCell.offsetHeight * 2.4, 140);
    if (
        Math.abs(prevPoint.y - mergePoint.y) > maxAllowedSpan ||
        Math.abs(currPoint.y - mergePoint.y) > maxAllowedSpan
    ) {
        layer.innerHTML = '';
        layer._comboGeom = null;
        return;
    }

    const nextGeom = {
        p1: prevPoint,
        p2: currPoint,
        m: mergePoint,
        b: badgePoint,
        color: color
    };
    const prevGeom = layer._comboGeom || {
        p1: { ...badgePoint },
        p2: { ...badgePoint },
        m: { ...badgePoint },
        b: { ...badgePoint },
        color: color
    };

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
                <path class="combo-path-glow-merge" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                <path class="combo-path-core-1" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                <path class="combo-path-core-2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                <path class="combo-path-core-merge" fill="none" stroke-linecap="round" stroke-linejoin="round" />
            </svg>
        `;
        svg = layer.querySelector('svg');
    }
    return {
        svg,
        glow1: layer.querySelector('.combo-path-glow-1'),
        glow2: layer.querySelector('.combo-path-glow-2'),
        glowMerge: layer.querySelector('.combo-path-glow-merge'),
        core1: layer.querySelector('.combo-path-core-1'),
        core2: layer.querySelector('.combo-path-core-2'),
        coreMerge: layer.querySelector('.combo-path-core-merge')
    };
}

window.drawComboBridge = function (layer, geom) {
    const { svg, glow1, glow2, glowMerge, core1, core2, coreMerge } = window.ensureComboBridgeElements(layer);

    const minX = Math.min(geom.p1.x, geom.p2.x, geom.m.x, geom.b.x) - 14;
    const maxX = Math.max(geom.p1.x, geom.p2.x, geom.m.x, geom.b.x) + 10;
    const minY = Math.min(geom.p1.y, geom.p2.y, geom.m.y, geom.b.y) - 14;
    const maxY = Math.max(geom.p1.y, geom.p2.y, geom.m.y, geom.b.y) + 14;

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
    const m = { x: geom.m.x - minX, y: geom.m.y - minY };
    const b = { x: geom.b.x - minX, y: geom.b.y - minY };

    const makeBranchPath = (p) => {
        const spanX = Math.max(28, m.x - p.x);
        const startLead = Math.max(16, Math.min(46, spanX * 0.34));
        const endLead = Math.max(12, Math.min(28, spanX * 0.26));
        return `M ${p.x} ${p.y} C ${p.x + startLead} ${p.y}, ${m.x - endLead} ${m.y}, ${m.x} ${m.y}`;
    };
    const makeMergePath = () => {
        const spanX = Math.max(0, b.x - m.x);
        if (spanX < 1) return `M ${m.x} ${m.y}`;
        // Ensure y is stable for the stem
        return `M ${m.x} ${m.y} L ${b.x} ${m.y}`;
    };

    const d1 = makeBranchPath(p1);
    const d2 = makeBranchPath(p2);
    const dMerge = makeMergePath();

    const connectorReach = Math.max(36, b.x - Math.min(p1.x, p2.x));
    const responsiveScale = Math.max(0.58, Math.min(1.04, connectorReach / 156));
    const coreWidth = (1.9 * responsiveScale).toFixed(2);
    const mergeCoreWidth = (2.05 * responsiveScale).toFixed(2);
    const glowWidth = (4.1 * responsiveScale).toFixed(2);
    const coreOpacity = Math.max(0.8, Math.min(0.95, 0.8 + responsiveScale * 0.12)).toFixed(2);
    const glowOpacity = Math.max(0.18, Math.min(0.32, 0.16 + responsiveScale * 0.15)).toFixed(2);
    const blurPx = Math.max(2, Math.round(5 * responsiveScale));

    [glow1, glow2].forEach((p, idx) => {
        p.setAttribute('d', idx === 0 ? d1 : d2);
        p.setAttribute('stroke', geom.color);
        p.setAttribute('stroke-width', glowWidth);
        p.setAttribute('stroke-opacity', glowOpacity);
        p.style.filter = `drop-shadow(0 0 ${blurPx}px ${geom.color})`;
    });
    glowMerge.setAttribute('d', dMerge);
    glowMerge.setAttribute('stroke', geom.color);
    glowMerge.setAttribute('stroke-width', glowWidth);
    glowMerge.setAttribute('stroke-opacity', (parseFloat(glowOpacity) * 0.94).toFixed(2));
    glowMerge.style.filter = `drop-shadow(0 0 ${blurPx + 1}px ${geom.color})`;

    [core1, core2].forEach((p, idx) => {
        p.setAttribute('d', idx === 0 ? d1 : d2);
        p.setAttribute('stroke', geom.color);
        p.setAttribute('stroke-width', coreWidth);
        p.setAttribute('stroke-opacity', coreOpacity);
    });
    coreMerge.setAttribute('d', dMerge);
    coreMerge.setAttribute('stroke', geom.color);
    coreMerge.setAttribute('stroke-width', mergeCoreWidth);
    coreMerge.setAttribute('stroke-opacity', Math.min(0.98, parseFloat(coreOpacity) + 0.04).toFixed(2));
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
            m: { x: lerp(fromGeom.m.x, toGeom.m.x, t), y: lerp(fromGeom.m.y, toGeom.m.y, t) },
            b: { x: lerp(fromGeom.b.x, toGeom.b.x, t), y: lerp(fromGeom.b.y, toGeom.b.y, t) },
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
    if (window.saveSessionData) window.saveSessionData();
};
window.resetData = function () {
    if (window.state) {
        window.state.history = [];
        window.state.activeBets = [];
        window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        window.state.engineSnapshot = null;
        window.state.currentNeuralSignal = null;
        window.state.strategySyncCache = { series: null, combo: null, inside: null };
    }
    window.currentAlerts = [];
    if (window.EngineCore) window.EngineCore.reset();
    const tbody = document.getElementById('historyBody');
    if (tbody) tbody.innerHTML = '';
    if (window.renderGapStats) window.renderGapStats();
    if (window.renderDashboardSafe) window.renderDashboardSafe([]);
    if (window.HudManager && window.HudManager.update) window.HudManager.update();
    if (window.syncAppStore) window.syncAppStore();
    if (window.saveSessionData) window.saveSessionData();
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
        currentPredictionStrategy: state.currentGameplayStrategy === 'combo' ? 'momentum-gap' : 'legacy-face'
    });
    
    state.engineSnapshot = snapshot || null;
    return state.engineSnapshot;
};

window.scanAllStrategies = async function (options = {}) {
    if (window.EngineCore && typeof window.EngineCore.scanAll === 'function' && window.state) {
        if (window.ensureActivePatternConfig) {
            window.ensureActivePatternConfig();
        }
        if (window.syncPredictionEngine) {
            await window.syncPredictionEngine();
        }

        const rawResult = await window.EngineCore.scanAll(
            window.state.history,
            window.state.engineSnapshot || {},
            window.state.currentGameplayStrategy || 'series',
            window.state.patternConfig || {},
            options
        );

        const syncView = window.EngineAdapter && typeof window.EngineAdapter.toSyncView === 'function'
            ? window.EngineAdapter.toSyncView(rawResult)
            : rawResult;
        const result = {
            ...rawResult,
            notifications: Array.isArray(syncView && syncView.notifications) ? syncView.notifications : [],
            nextBets: Array.isArray(syncView && syncView.nextBets) ? syncView.nextBets : [],
            valid: syncView && syncView.valid !== false,
            errors: Array.isArray(syncView && syncView.errors) ? syncView.errors : []
        };

        window.state.activeBets = result.nextBets;
        window.currentAlerts = result.notifications;

        if (window.state.strategySyncCache && typeof window.state.strategySyncCache === 'object') {
            const strategyKey = window.state.currentGameplayStrategy || 'series';
            window.state.strategySyncCache[strategyKey] = result;
        }

        return result;
    }
    console.warn('EngineCore.scanAll not found.');
    return { notifications: [], nextBets: [], resultsByStrategy: {} };
};

window.syncAppStore = function () {
    if (window.AppStore && typeof window.AppStore.dispatch === 'function' && window.state) {
        const storePatch = window.EngineAdapter && typeof window.EngineAdapter.toStorePatch === 'function'
            ? window.EngineAdapter.toStorePatch({
                history: window.state.history,
                activeBets: window.state.activeBets,
                alerts: window.currentAlerts,
                snapshot: window.state.engineSnapshot
            })
            : {
                history: window.state.history,
                activeBets: window.state.activeBets,
                alerts: window.currentAlerts,
                snapshot: window.state.engineSnapshot
            };
        window.AppStore.dispatch('engine/sync', storePatch);
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
function getAnalyticsTabConfig() {
    const buttons = Array.from(document.querySelectorAll('[data-analytics-tab]'));
    if (buttons.length > 0) {
        return buttons.map(button => ({
            key: button.dataset.analyticsTab,
            button,
            panelId: button.dataset.analyticsPanel || '',
            rendererName: button.dataset.analyticsRenderer || ''
        })).filter(tab => tab.key && tab.panelId);
    }

    return [
        { key: 'strategy', button: document.getElementById('tabBtnStrategy'), panelId: 'strategyAnalyticsPanel', rendererName: 'renderStrategyAnalytics' },
        { key: 'intelligence', button: document.getElementById('tabBtnIntelligence'), panelId: 'intelligencePanel', rendererName: 'renderIntelligencePanel' },
        { key: 'advancements', button: document.getElementById('tabBtnAdvancements'), panelId: 'advancementsPanel', rendererName: 'renderAdvancementAnalytics' }
    ].filter(tab => tab.button);
}

function ensureActiveAnalyticsTab(tabs) {
    if (!state || !Array.isArray(tabs) || tabs.length === 0) {
        return state ? state.currentAnalyticsTab : '';
    }

    const activeExists = tabs.some(tab => tab.key === state.currentAnalyticsTab);
    if (!activeExists) {
        state.currentAnalyticsTab = tabs[0].key;
    }
    return state.currentAnalyticsTab;
}

window.switchAnalyticsTab = function (tab) {
    if (!state) return;
    state.currentAnalyticsTab = tab;
    if (window.saveSessionData) window.saveSessionData();
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
    if (window.saveSessionData) window.saveSessionData();
    if (window.HudManager && typeof window.HudManager.update === 'function') {
        window.HudManager.update();
    }
    if (window.renderAnalytics) {
        window.renderAnalytics();
    } else {
        renderStrategyAnalytics();
    }
};

window.changeIntelMode = function (mode) {
    if (!state) return;
    state.currentIntelligenceMode = mode;
    if (window.saveSessionData) window.saveSessionData();
    if (state.currentAnalyticsTab === 'intelligence' && window.renderAnalytics) {
        window.renderAnalytics();
    }
};

function applyAnalyticsTabUI() {
    const tabs = getAnalyticsTabConfig();
    const activeTab = ensureActiveAnalyticsTab(tabs);

    tabs.forEach(tab => {
        const btn = tab.button;
        const panel = document.getElementById(tab.panelId);

        if (btn) {
            if (tab.key === activeTab) {
                btn.className = "pb-2 text-xs font-bold uppercase tracking-widest text-[#30D158] border-b-2 border-[#30D158] transition-all";
            } else {
                btn.className = "pb-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all";
            }
        }
        if (panel) {
            if (tab.key === activeTab) {
                panel.classList.remove('hidden');
            } else {
                panel.classList.add('hidden');
            }
        }
    });
}

window.renderAdvancementAnalytics = function () {
    const advPanel = document.getElementById('advancementLogContainer');
    if (advPanel) {
        advPanel.innerHTML = '<div class="text-white/40 text-center py-6 text-xs italic tracking-wide">Advancements tracking active. Awaiting threshold breaches.</div>';
    }
};

window.renderAnalytics = function () {
    if (!state) return;
    const tabs = getAnalyticsTabConfig();
    const activeTab = ensureActiveAnalyticsTab(tabs);
    applyAnalyticsTabUI();

    const activeConfig = tabs.find(tab => tab.key === activeTab);
    if (!activeConfig || !activeConfig.rendererName) return;

    const renderer = window[activeConfig.rendererName];
    if (typeof renderer === 'function') {
        renderer();
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
        const confidence = Number.isFinite(snapshot.currentPrediction.confidence) && snapshot.currentPrediction.confidence > 0
            ? ` ${snapshot.currentPrediction.confidence}%`
            : '';
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

    const ENGINE_PRIMARY_WINDOW = window.config ? window.config.ENGINE_PRIMARY_WINDOW : 14;
    const ENGINE_CONFIRMATION_WINDOW = window.config ? window.config.ENGINE_CONFIRMATION_WINDOW : 5;
    
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
    const displayStrategy = state && state.analyticsDisplayStrategy === 'combo' ? 'combo' : 'series';
    const analytics = window.EngineCore && typeof window.EngineCore.getAnalyticsData === 'function'
        ? window.EngineCore.getAnalyticsData(displayStrategy)
        : null;
    const coreStats = analytics || {
        wins: 0,
        losses: 0,
        net: 0,
        streak: 0,
        history: [0],
        patterns: {}
    };

    const totalSignals = coreStats.wins + coreStats.losses;
    const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.wins / totalSignals) * 100);

    const hrEl = document.getElementById('kpiHitRate');
    if (hrEl) {
        hrEl.innerText = hitRate + "%";
        hrEl.className = `text-2xl font-bold tracking-tight ${totalSignals === 0 ? 'text-white' : (hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]')}`;
    }

    const netEl = document.getElementById('kpiNet');
    if (netEl) {
        netEl.innerText = (coreStats.net > 0 ? '+' : '') + coreStats.net;
        netEl.className = `text-2xl font-bold tracking-tight ${coreStats.net > 0 ? 'text-[#30D158]' : (coreStats.net < 0 ? 'text-[#FF453A]' : 'text-white')}`;
    }

    const sigEl = document.getElementById('kpiSignals');
    if (sigEl) sigEl.innerText = totalSignals;

    const s = coreStats.streak || 0;
    const formEl = document.getElementById('kpiForm');
    if (formEl) {
        formEl.innerText = s > 0 ? `W${s}` : (s < 0 ? `L${Math.abs(s)}` : '-');
        formEl.className = `text-2xl font-bold tracking-tight ${s > 0 ? 'text-[#30D158]' : (s < 0 ? 'text-[#FF453A]' : 'text-gray-400')}`;
    }

    if (typeof window.drawAdvancedGraph === 'function') {
        window.drawAdvancedGraph(coreStats.history, coreStats.wins, coreStats.losses, 'graphContainer');
    }
    updatePatternHeatmap(coreStats.patterns);
}

window.renderUserAnalytics = function () {
    if (!state) return;
    const uStats = state.userStats || { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
    const totalBets = uStats.totalWins + uStats.totalLosses;
    const hitRate = totalBets === 0 ? 0 : Math.round((uStats.totalWins / totalBets) * 100);

    const netEl = document.getElementById('userNet');
    if (netEl) {
        netEl.innerText = (uStats.netUnits > 0 ? '+' : '') + uStats.netUnits;
        netEl.className = `text-4xl font-bold tracking-tight ${uStats.netUnits > 0 ? 'text-[#30D158]' : (uStats.netUnits < 0 ? 'text-[#FF453A]' : 'text-white')}`;
    }

    const hrEl = document.getElementById('userHitRate');
    if (hrEl) {
        hrEl.innerText = hitRate + "%";
        hrEl.className = `text-4xl font-bold tracking-tight ${totalBets === 0 ? 'text-white' : (hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]')}`;
    }

    const totEl = document.getElementById('userTotal');
    if (totEl) totEl.innerText = totalBets;

    if (typeof window.drawAdvancedGraph === 'function') {
        window.drawAdvancedGraph(uStats.bankrollHistory, uStats.totalWins, uStats.totalLosses, 'userGraphContainer');
    }
    updateUserBetLog(uStats.betLog);
};



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
// --- REGISTER STRATEGIES ---
    if (window.StrategyRegistry) {
        if (window.SeriesStrategy) window.StrategyRegistry.series = window.SeriesStrategy;
        if (window.ComboStrategy) window.StrategyRegistry.combo = window.ComboStrategy;
        if (window.InsideStrategy) window.StrategyRegistry.inside = window.InsideStrategy;
    }

window.changePredictionStrategy = async function (val) {
    if (window.state) {
        window.state.currentGameplayStrategy = val;
        
        // Auto-switch analytics tab
        if (window.setAnalyticsDisplayStrategy) {
            window.setAnalyticsDisplayStrategy(val);
        }

        if (window.syncStrategyUi) {
            window.syncStrategyUi();
        }
        if (window.ensureActivePatternConfig) {
            window.ensureActivePatternConfig();
        }
        if (window.renderPatternFilterUi) {
            window.renderPatternFilterUi();
        }
        if (window.reRenderHistory) {
            window.reRenderHistory();
        }
        if (window.saveSessionData) window.saveSessionData();
        if (window.scanAllStrategies) {
            const result = await window.scanAllStrategies();
            if (window.renderDashboardSafe) window.renderDashboardSafe(result);
            if (window.syncAppStore) window.syncAppStore();
        }
    }
};

window.setGameplayStrategy = window.changePredictionStrategy;

window.openAiConfigModal = function () { 
    if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
    const keyInput = document.getElementById('aiApiKeyInput');
    const providerSelect = document.getElementById('aiProviderSelect');
    if (keyInput) keyInput.value = window.state.aiApiKey || '';
    if (providerSelect) providerSelect.value = window.state.aiProvider || 'gemini';
    toggleModal('aiConfigModal'); 
};
window.openAiChat = function () { toggleModal('aiChatModal'); };
