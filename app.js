// --- CONFIGURATION ---
const RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const PERIMETER_RULE_KEY = 'Perimeter Rule';
const PREDICTION_PERIMETER_PATTERN = 'Prediction Perimeter';
const AI_TAKEOVER_PATTERN = 'AI Takeover';
const ENGINE_PRIMARY_WINDOW = 14;
const ENGINE_CONFIRMATION_WINDOW = 5;
const HUD_RECENT_WINDOW = 14;
const GEMINI_MODEL = 'gemini-2.5-flash';
const INTELLIGENCE_VIEW_KEY = 'insideTool.intelligenceViewMode';
const INTELLIGENCE_VIEWS = ['brief', 'diagnostic', 'minimal'];
const PATTERN_FILTER_META_COMBO = Object.fromEntries(
    PERIMETER_COMBOS.map(combo => [combo.label, {
        label: combo.label,
        hint: `Track ${combo.label} inside the prediction engine and dashboard flow.`,
        icon: 'fa-link',
        accent: combo.color
    }])
);
// NOTE: PATTERN_FILTER_META_SERIES is now owned by strategies/strategy.series.js
// and accessible via window.StrategyRegistry.series.PATTERN_FILTER_META

// --- STATE MANAGEMENT ---
let currentInputLayout = 'grid'; // 'grid' or 'racetrack'
const RACETRACK_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

let history = [];
let activeBets = [];
let globalSpinIdCounter = 0;
let spinProcessingQueue = Promise.resolve();
let faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let predictionPerimeterWindow = 14;
let perimeterRuleEnabled = true;
let aiEnabled = false;
let aiProvider = 'gemini';
let aiApiKey = '';
let chatMessageHistory = [];
let advancementLog = [];
let neuralPredictionEnabled = false;
let currentNeuralSignal = null;
let neuralPredictionRequestId = 0;
let aiSignalLedger = [];
let lastAiFusionSnapshot = null;
let aiPredictionCacheKey = '';
let aiPredictionCacheSignal = null;
let aiPredictionInFlight = null;
let aiRuntimeState = {
    status: 'IDLE',
    provider: 'gemini',
    lastError: '',
    lastRequestMode: '',
    lastLatencyMs: 0,
    lastPromptPreview: '',
    lastResponsePreview: '',
    lastUpdatedLabel: 'Never'
};

// Constants PERIMETER_COMBOS and FACES are already defined in predictionEngine.js
// Removing duplicate declarations to prevent SyntaxError

// Global Pattern Configuration - The Source of Truth
// Built dynamically based on active strategy via rebuildPatternConfig()
// Uses StrategyRegistry so that each strategy owns its own key definitions
let patternConfig = {};

// Background bets: shadow tracking for ALL strategies regardless of active one
// { 'series': [...bets], 'combo': [...bets] }
let backgroundBets = {};

let engineStats = {
    totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0,
    bankrollHistory: [0], patternStats: {},
    signalLog: []
};

let userStats = {
    totalWins: 0, totalLosses: 0, netUnits: 0,
    bankrollHistory: [0],
    betLog: []
};

let currentPredictionStrategy = 'series';
let currentGameplayStrategy = 'series'; // 'series' or 'combo'
let strategies = {};

let changeStrategyTimeout = null;
let cachedAddSpinBtn = null;

function changePredictionStrategy(val) {
    currentGameplayStrategy = val;
    const headerEl = document.getElementById('historyComboHeader');
    if (headerEl) {
        headerEl.innerText = val === 'series' ? 'SEQUENCE' : 'COMBO';
    }
    if (typeof setAnalyticsDisplayStrategy === 'function') {
        setAnalyticsDisplayStrategy(val);
    }
    // Update HUD strategy label
    const hudLabel = document.getElementById('hudStrategyLabel');
    if (hudLabel) hudLabel.innerText = val === 'series' ? 'Series' : 'Combo';
    // Sync hamburger dropdown
    const hamburgerSelect = document.getElementById('hamburgerStrategySelect');
    if (hamburgerSelect) hamburgerSelect.value = val;
    
    if (changeStrategyTimeout) clearTimeout(changeStrategyTimeout);
    changeStrategyTimeout = setTimeout(() => {
        // Rebuild patternConfig for the new strategy
        rebuildPatternConfig();
        renderFilterMenu();
        updateVisibility();

        // Re-render the whole history table so bridges redraw for the new strategy
        reRenderHistory();
        requestAnimationFrame(layoutAllComboBridges);
        refreshHighlights();

        void refreshPredictionEngineUI();
        saveSessionData();
    }, 200);
}

function rebuildPatternConfig() {
    // Delegate to the active strategy module's buildPatternConfig
    const strat = window.StrategyRegistry && window.StrategyRegistry[currentGameplayStrategy];
    if (strat && typeof strat.buildPatternConfig === 'function') {
        const newConfig = strat.buildPatternConfig(true);
        // Preserve previously set values
        for (const key of Object.keys(newConfig)) {
            if (patternConfig[key] !== undefined) newConfig[key] = patternConfig[key];
        }
        patternConfig = newConfig;
    }
}

// --- PERSISTENCE ---
const SESSION_STORAGE_KEY = 'insideTool_session_v1';

function saveSessionData() {
    const data = {
        history,
        activeBets,
        faceGaps,
        predictionPerimeterWindow,
        perimeterRuleEnabled,
        patternConfig,
        engineStats,
        userStats,
        stopwatchSeconds,
        currentInputLayout,
        isHudColdMode,
        hudHistoryScope,
        aiEnabled,
        aiProvider,
        aiApiKey,
        advancementLog,
        neuralPredictionEnabled,
        aiSignalLedger,
        aiRuntimeState,
        currentPredictionStrategy,
        currentGameplayStrategy,
        globalSpinIdCounter
    };
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("Session save failed", e);
    }
}

function buildDefaultPatternConfig(enabled = true) {
    // Delegate to the active strategy module's buildPatternConfig
    const strat = window.StrategyRegistry && window.StrategyRegistry[currentGameplayStrategy];
    if (strat && typeof strat.buildPatternConfig === 'function') {
        return strat.buildPatternConfig(enabled);
    }
    // Fallback: use PERIMETER_COMBOS if StrategyRegistry not ready yet
    return Object.fromEntries((window.PERIMETER_COMBOS || []).map(combo => [combo.label, enabled]));
}

function normalizePatternConfig(rawConfig, fallbackEnabled = true) {
    if (!rawConfig || typeof rawConfig !== 'object') {
        return buildDefaultPatternConfig(fallbackEnabled);
    }

    const hasComboKeys = PERIMETER_COMBOS.some(combo => Object.prototype.hasOwnProperty.call(rawConfig, combo.label));
    if (hasComboKeys) {
        return Object.fromEntries(PERIMETER_COMBOS.map(combo => [combo.label, rawConfig[combo.label] !== false]));
    }

    const legacyEnabled = rawConfig[PERIMETER_RULE_KEY] !== false && fallbackEnabled !== false;
    return buildDefaultPatternConfig(legacyEnabled);
}

function isComboFilterEnabled(label) {
    return patternConfig[label] !== false;
}

function loadSessionData() {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return false;
    try {
        const data = JSON.parse(raw);
        if (Array.isArray(data.history)) history = data.history;
        if (Array.isArray(data.activeBets)) activeBets = data.activeBets;
        if (data.faceGaps) faceGaps = data.faceGaps;
        if (data.predictionPerimeterWindow) predictionPerimeterWindow = data.predictionPerimeterWindow;
        if (data.perimeterRuleEnabled !== undefined) perimeterRuleEnabled = data.perimeterRuleEnabled;
        if (data.patternConfig) patternConfig = data.patternConfig;
        if (data.engineStats) engineStats = data.engineStats;
        if (data.userStats) userStats = data.userStats;
        if (data.stopwatchSeconds) stopwatchSeconds = data.stopwatchSeconds;
        if (data.currentInputLayout) currentInputLayout = data.currentInputLayout;
        if (data.isHudColdMode !== undefined) isHudColdMode = data.isHudColdMode;
        if (data.hudHistoryScope) hudHistoryScope = data.hudHistoryScope;
        if (data.currentGameplayStrategy) currentGameplayStrategy = data.currentGameplayStrategy;
        if (data.globalSpinIdCounter !== undefined) globalSpinIdCounter = data.globalSpinIdCounter;
        if (data.aiEnabled !== undefined) aiEnabled = data.aiEnabled;
        if (typeof data.aiProvider === 'string' && data.aiProvider) aiProvider = data.aiProvider;
        if (typeof data.aiApiKey === 'string') aiApiKey = data.aiApiKey;
        if (Array.isArray(data.advancementLog)) advancementLog = data.advancementLog;
        if (data.neuralPredictionEnabled !== undefined) neuralPredictionEnabled = data.neuralPredictionEnabled === true;
        if (Array.isArray(data.aiSignalLedger)) aiSignalLedger = data.aiSignalLedger;
        if (data.aiRuntimeState && typeof data.aiRuntimeState === 'object') aiRuntimeState = { ...aiRuntimeState, ...data.aiRuntimeState };
        updateAiUiState();
        return true;
    } catch (e) {
        console.error("Session load failed", e);
        return false;
    }
}

let currentAnalyticsTab = 'strategy';
let currentIntelligenceMode = 'brief';
let isHudColdMode = false;
let hudHistoryScope = 'all';
let engineSnapshot = null;
let lastActionableComboLabel = null;
let lastActionableTargetFace = null;
let lastActionableCheckpointSpin = 0;
let analyticsDisplayStrategy = 'series';
window.currentAlerts = [];

function normalizeIntelligenceMode(mode) {
    return INTELLIGENCE_VIEWS.includes(mode) ? mode : 'brief';
}

function hydrateIntelligenceMode() {
    try {
        currentIntelligenceMode = normalizeIntelligenceMode(localStorage.getItem(INTELLIGENCE_VIEW_KEY) || 'brief');
    } catch (error) {
        currentIntelligenceMode = 'brief';
    }
}

function persistIntelligenceMode(mode) {
    currentIntelligenceMode = normalizeIntelligenceMode(mode);
    try {
        localStorage.setItem(INTELLIGENCE_VIEW_KEY, currentIntelligenceMode);
    } catch (error) {
        // Keep in-memory mode when storage is unavailable.
    }
}

function getCheckpointMeta(spinCount) {
    if (spinCount < ENGINE_PRIMARY_WINDOW) {
        return {
            isCheckpoint: false,
            nextCheckpointSpin: ENGINE_PRIMARY_WINDOW,
            lastCheckpointSpin: 0,
            spinsUntilNext: ENGINE_PRIMARY_WINDOW - spinCount
        };
    }

    return {
        isCheckpoint: true,
        nextCheckpointSpin: spinCount + 1,
        lastCheckpointSpin: spinCount,
        spinsUntilNext: 1
    };
}

function createEmptyEngineSnapshot(spinCount = history.length) {
    const checkpoint = getCheckpointMeta(spinCount);
    return {
        spinCount,
        engineState: spinCount < ENGINE_PRIMARY_WINDOW ? 'BUILDING' : 'WAITING',
        checkpointStatus: spinCount < ENGINE_PRIMARY_WINDOW ? 'Building initial read' : 'Continuous scan active',
        spinsUntilNextCheckpoint: checkpoint.spinsUntilNext,
        nextCheckpointSpin: checkpoint.nextCheckpointSpin,
        lastEvaluatedSpin: checkpoint.lastCheckpointSpin,
        checkpointSpin: checkpoint.isCheckpoint ? spinCount : null,
        isCheckpoint: checkpoint.isCheckpoint,
        dominantCombo: null,
        runnerUpCombo: null,
        triggerFace: null,
        predictedFace: null,
        gateResults: [],
        passedGates: [],
        failedGates: [],
        stats14: null,
        stats5: null,
        currentPrediction: null,
        signalKind: null,
        comboCoverage: [],
        leadMessage: spinCount < ENGINE_PRIMARY_WINDOW
            ? `${ENGINE_PRIMARY_WINDOW - spinCount} spins until first read`
            : 'Scanning every spin',
        watchlistMessage: '',
        topMargin: 0,
        confirmationHits: 0,
        confirmationPassed: false
    };
}

function resetSession() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.remove('hidden');
        const btn = document.getElementById('confirmResetBtn');
        if (btn) {
            btn.onclick = () => {
                performReset();
                modal.classList.add('hidden');
            };
        }
    }
}

function performReset() {
    history = [];
    activeBets = [];
    spinProcessingQueue = Promise.resolve();
    chatMessageHistory = [];
    advancementLog = [];
    neuralPredictionEnabled = false;
    currentNeuralSignal = null;
    neuralPredictionRequestId++;
    aiSignalLedger = [];
    lastAiFusionSnapshot = null;
    aiPredictionCacheKey = '';
    aiPredictionCacheSignal = null;
    aiPredictionInFlight = null;
    aiRuntimeState = {
        status: 'IDLE',
        provider: aiProvider,
        lastError: '',
        lastRequestMode: '',
        lastLatencyMs: 0,
        lastPromptPreview: '',
        lastResponsePreview: '',
        lastUpdatedLabel: 'Never'
    };
    faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    window.currentAlerts = [];
    engineSnapshot = createEmptyEngineSnapshot(0);
    lastActionableComboLabel = null;
    lastActionableTargetFace = null;
    lastActionableCheckpointSpin = 0;

    engineStats = {
        totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0,
        bankrollHistory: [0], patternStats: {},
        signalLog: []
    };

    userStats = {
        totalWins: 0, totalLosses: 0, netUnits: 0,
        bankrollHistory: [0],
        betLog: []
    };

    updatePredictionSettingsUI();
    renderGapStats();
    updatePerimeterAnalytics();
    updateVisibility();
    updateAnalyticsHUD();
    const hm = document.getElementById('hamburgerMenu');
    if (hm) hm.classList.add('hidden');
    const hb = document.getElementById('hamburgerBackdrop');
    if (hb) hb.classList.add('hidden');

    // Clear history body
    const body = document.getElementById('historyBody');
    if (body) body.innerHTML = '';

    resetAiChatUi();
    updateNeuralPredictionUi();
    saveSessionData();
}

// --- INIT ---
window.onload = async () => {
    const hasSession = loadSessionData();
    cachedAddSpinBtn = document.getElementById('addSpinBtn');

    initDesktopGrid();
    renderFilterMenu();
    renderGapStats();
    syncPerimeterRuleState();
    hydrateIntelligenceMode();
    updatePredictionSettingsUI();
    updateAiUiState();

    if (hasSession) {
        const headerEl = document.getElementById('historyComboHeader');
        if (headerEl) {
            headerEl.innerText = currentGameplayStrategy === 'series' ? 'SEQUENCE' : 'COMBO';
        }
        if (typeof setAnalyticsDisplayStrategy === 'function') {
            setAnalyticsDisplayStrategy(currentGameplayStrategy);
        }

        // Rebuild pattern config based on saved strategy
        rebuildPatternConfig();
        updateStopwatchDisplay();
        await syncPredictionEngine();
        reRenderHistory();
        setTimeout(() => {
            const sc = document.querySelector('#scrollContainer > div');
            if (sc) sc.scrollTop = sc.scrollHeight;
        }, 100);
    } else {
        rebuildPatternConfig();
        engineSnapshot = createEmptyEngineSnapshot(0);
    }

    settleAiSignalLedger();
    refreshAdvancementStates();
    updateAiFusionSnapshot(currentNeuralSignal);
    updatePerimeterAnalytics();
    updateAnalyticsHUD();
    applyAnalyticsTabUI();
    renderDashboard(window.currentAlerts || []);
    if (neuralPredictionEnabled && aiEnabled && aiApiKey) {
        void requestNeuralPrediction();
    }

    document.getElementById('spinInput').focus();

    // Enter key listener is set once in HTML via onkeydown attribute

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoSpin();
        }
    });

    // Global Click listener for menus
    document.addEventListener('click', (e) => {
        const patternShell = document.getElementById('patternFilterShell');
        const patternPopover = document.getElementById('patternFilterPopover');
        if (patternShell && patternPopover && !patternPopover.classList.contains('hidden') && !patternShell.contains(e.target)) {
            closePatternFilterPopover();
        }

        // Hamburger Menu
        const burgerMenu = document.getElementById('hamburgerMenu');
        const burgerBtn = burgerMenu ? burgerMenu.previousElementSibling : null;
        if (burgerMenu && !burgerMenu.classList.contains('hidden') && !burgerMenu.contains(e.target) && (!burgerBtn || !burgerBtn.contains(e.target))) {
            burgerMenu.classList.add('hidden');
        }
    });

    window.addEventListener('resize', () => {
        requestAnimationFrame(layoutAllComboBridges);
        fitAnalyticsHUD();
    });

    // Init HUD
    initAnalyticsHUD();
    initPatternFilterDrag();
    syncPatternFilterButton();

    window.addEventListener('beforeunload', () => {
        saveSessionData();
    });
};

function toggleHamburgerMenu() {
    const menu = document.getElementById('hamburgerMenu');
    const backdrop = document.getElementById('hamburgerBackdrop');

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        if (backdrop) backdrop.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
    }
}

function toggleAccordion(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(id + 'Icon');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function toggleInputLayout() {
    currentInputLayout = currentInputLayout === 'grid' ? 'racetrack' : 'grid';

    // Update label in Hamburger menu
    const label = document.getElementById('layoutLabel');
    if (label) {
        label.innerText = currentInputLayout.toUpperCase();
        if (currentInputLayout === 'racetrack') {
            label.className = "text-[10px] font-bold bg-[#BF5AF2]/20 px-2 py-1 rounded text-[#BF5AF2]";
        } else {
            label.className = "text-[10px] font-bold bg-white/10 px-2 py-1 rounded text-white";
        }
    }

    initDesktopGrid(); // Re-render the grid
    requestAnimationFrame(layoutAllComboBridges);
}

// --- FLOATING HUD LOGIC ---
function fitAnalyticsHUD() {
    const hud = document.getElementById('analyticsHUD');
    const header = document.getElementById('hudHeader');
    const body = hud ? hud.querySelector('.flex-1.flex.flex-col.overflow-hidden.relative') : null;
    if (!hud || !header || !body || hud.classList.contains('hidden')) return;

    requestAnimationFrame(() => {
        const maxHeight = Math.max(180, window.innerHeight - hud.offsetTop - 8);
        const desiredHeight = Math.ceil(header.offsetHeight + body.scrollHeight);
        hud.style.height = `${Math.min(desiredHeight, maxHeight)}px`;
    });
}

function initAnalyticsHUD() {
    const hud = document.getElementById('analyticsHUD');
    const header = document.getElementById('hudHeader');
    const resizer = document.getElementById('hudResizeHandle');

    if (!hud || !header || !resizer) return;
    if (hud.dataset.initialized === 'true') return;
    hud.dataset.initialized = 'true';

    let interaction = null;
    let rafId = null;
    let pendingFrame = null;

    const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

    function scheduleHUDFrame(nextValues) {
        pendingFrame = { ...(pendingFrame || {}), ...nextValues };
        if (rafId !== null) return;

        rafId = requestAnimationFrame(() => {
            if (!pendingFrame) {
                rafId = null;
                return;
            }

            if (typeof pendingFrame.left === 'number') {
                hud.style.left = `${pendingFrame.left}px`;
            }
            if (typeof pendingFrame.top === 'number') {
                hud.style.top = `${pendingFrame.top}px`;
            }
            if (typeof pendingFrame.width === 'number') {
                hud.style.width = `${pendingFrame.width}px`;
            }
            if (typeof pendingFrame.height === 'number') {
                hud.style.height = `${pendingFrame.height}px`;
            }

            pendingFrame = null;
            rafId = null;
        });
    }

    function startInteraction(type, e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (type === 'drag' && e.target.closest('button')) return;
        if (e.cancelable) e.preventDefault();
        e.stopPropagation();

        interaction = {
            type,
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            startLeft: hud.offsetLeft,
            startTop: hud.offsetTop,
            startWidth: hud.offsetWidth,
            startHeight: hud.offsetHeight
        };

        hud.classList.add('hud-interacting');
        document.body.classList.add('hud-no-select');

        if (type === 'drag') {
            header.setPointerCapture?.(e.pointerId);
        } else {
            resizer.setPointerCapture?.(e.pointerId);
        }
    }

    function onPointerMove(e) {
        if (!interaction) return;
        if (interaction.pointerId !== undefined && e.pointerId !== undefined && interaction.pointerId !== e.pointerId) return;
        if (e.cancelable) e.preventDefault();

        const dx = e.clientX - interaction.startX;
        const dy = e.clientY - interaction.startY;

        if (interaction.type === 'drag') {
            const maxLeft = Math.max(8, window.innerWidth - hud.offsetWidth - 8);
            const maxTop = Math.max(8, window.innerHeight - hud.offsetHeight - 8);
            scheduleHUDFrame({
                left: clamp(interaction.startLeft + dx, 8, maxLeft),
                top: clamp(interaction.startTop + dy, 8, maxTop)
            });
            return;
        }

        const maxWidth = Math.max(192, window.innerWidth - interaction.startLeft - 8);
        scheduleHUDFrame({
            width: clamp(interaction.startWidth + dx, 192, maxWidth)
        });
    }

    function stopInteraction(e) {
        if (!interaction) return;
        if (interaction.pointerId !== undefined && e && e.pointerId !== undefined && interaction.pointerId !== e.pointerId) return;

        if (interaction.type === 'drag') {
            header.releasePointerCapture?.(interaction.pointerId);
        } else {
            resizer.releasePointerCapture?.(interaction.pointerId);
        }

        interaction = null;
        hud.classList.remove('hud-interacting');
        document.body.classList.remove('hud-no-select');
        fitAnalyticsHUD();
    }

    header.addEventListener('pointerdown', (e) => startInteraction('drag', e));
    resizer.addEventListener('pointerdown', (e) => startInteraction('resize', e));
    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', stopInteraction);
    window.addEventListener('pointercancel', stopInteraction);
}

function toggleAnalyticsHUD() {
    const hud = document.getElementById('analyticsHUD');
    const btn = document.getElementById('hudToggleBtn');

    if (hud.classList.contains('hidden')) {
        hud.classList.remove('hidden');
        hud.classList.add('flex');
        btn.classList.add('bg-white/10');
        initAnalyticsHUD();  // ensure drag/resize is wired up
        updateAnalyticsHUD();
        fitAnalyticsHUD();
    } else {
        hud.classList.add('hidden');
        hud.classList.remove('flex');
        btn.classList.remove('bg-white/10');
    }
}

function toggleHUDControls() {
    const controls = document.getElementById('hudControls');
    if (controls.classList.contains('hidden')) {
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
    }
    fitAnalyticsHUD();
}

function toggleHudColdMode() {
    isHudColdMode = !isHudColdMode;
    const btn = document.getElementById('hudColdBtn');
    if (btn) {
        if (isHudColdMode) btn.classList.replace('text-gray-500', 'text-[#06b6d4]');
        else btn.classList.replace('text-[#06b6d4]', 'text-gray-500');
    }
    // Refresh HUD
    updateAnalyticsHUD();
}

function getPatternFilterEnabledCount() {
    return Object.keys(patternConfig).reduce((count, key) => count + (patternConfig[key] !== false ? 1 : 0), 0);
}

function initPatternFilterDrag() {
    const popover = document.getElementById('patternFilterPopover');
    const header = popover ? popover.querySelector('.pattern-popover-head') : null;

    if (!popover || !header) return;
    if (popover.dataset.dragInitialized === 'true') return;
    popover.dataset.dragInitialized = 'true';

    let isDragging = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;

    header.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        
        // Convert from absolute to fixed to allow dragging outside parent boundaries
        if (getComputedStyle(popover).position !== 'fixed') {
            const rect = popover.getBoundingClientRect();
            document.body.appendChild(popover);
            popover.style.position = 'fixed';
            popover.style.zIndex = '9999';
            popover.style.top = `${rect.top}px`;
            popover.style.left = `${rect.left}px`;
            popover.style.right = 'auto'; 
        }

        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = popover.offsetLeft;
        initialTop = popover.offsetTop;
        
        header.setPointerCapture(e.pointerId);
        document.body.classList.add('hud-no-select');
    });

    window.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        
        const maxLeft = Math.max(8, window.innerWidth - popover.offsetWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - popover.offsetHeight - 8);
        
        let newLeft = initialLeft + dx;
        let newTop = initialTop + dy;
        
        popover.style.left = `${Math.min(maxLeft, Math.max(8, newLeft))}px`;
        popover.style.top = `${Math.min(maxTop, Math.max(8, newTop))}px`;
    });

    window.addEventListener('pointerup', (e) => {
        if (!isDragging) return;
        isDragging = false;
        header.releasePointerCapture(e.pointerId);
        document.body.classList.remove('hud-no-select');
    });
}

function closePatternFilterPopover() {
    const popover = document.getElementById('patternFilterPopover');
    const button = document.getElementById('patternsToggleBtn');
    if (popover) popover.classList.add('hidden');
    if (button) button.classList.remove('pattern-toggle-active');
}

function syncPatternFilterButton() {
    const button = document.getElementById('patternsToggleBtn');
    const badge = document.getElementById('patternsActiveCount');
    const summary = document.getElementById('patternFilterSummary');
    const enabledCount = getPatternFilterEnabledCount();
    const totalCount = Object.keys(patternConfig).length;
    const isOpen = !!document.getElementById('patternFilterPopover') && !document.getElementById('patternFilterPopover').classList.contains('hidden');

    if (badge) {
        badge.innerText = String(enabledCount);
        badge.classList.toggle('pattern-toggle-badge-off', enabledCount === 0);
    }

    if (summary) {
        summary.innerText = `${enabledCount} of ${totalCount} active`;
    }

    if (button) {
        button.classList.toggle('pattern-toggle-active', isOpen);
    }
}

function togglePatternFilterPopover(forceOpen = null) {
    const popover = document.getElementById('patternFilterPopover');
    if (!popover) return;

    const shouldOpen = typeof forceOpen === 'boolean'
        ? forceOpen
        : popover.classList.contains('hidden');

    if (shouldOpen) {
        renderFilterMenu();
        popover.classList.remove('hidden');
    } else {
        popover.classList.add('hidden');
    }

    syncPatternFilterButton();
}

function toggleHudHistoryScope() {
    hudHistoryScope = hudHistoryScope === 'all' ? 'recent' : 'all';
    updateAnalyticsHUD();
}

function getHudWindowSetting() {
    return hudHistoryScope === 'recent' ? HUD_RECENT_WINDOW : 'all';
}

function getHudScopeSummary() {
    if (hudHistoryScope === 'recent') {
        return history.length > 0
            ? `Last ${Math.min(HUD_RECENT_WINDOW, history.length)} Spins`
            : `Last ${HUD_RECENT_WINDOW} Spins`;
    }
    return history.length > 0 ? `All ${history.length} Spins` : 'All History';
}

function getComboCoverageStats(stats) {
    if (stats && Array.isArray(stats.comboStats) && stats.comboStats.length > 0) {
        return stats.comboStats.slice();
    }

    const sampleSize = Math.max(0, stats && typeof stats.sampleSize === 'number'
        ? stats.sampleSize
        : (stats && Array.isArray(stats.recentSpins) ? stats.recentSpins.length : 0));

    return PERIMETER_COMBOS.map(combo => {
        const hits = stats && stats.counts ? (stats.counts[combo.label] || 0) : 0;
        const sampleMisses = Math.max(0, sampleSize - hits);
        const hotPercent = sampleSize > 0 ? Math.round((hits / sampleSize) * 100) : 0;
        const coldPercent = sampleSize > 0 ? Math.round((sampleMisses / sampleSize) * 100) : 0;
        let state = 'idle';
        if (sampleSize > 0) {
            if (hits === 0) state = 'cold';
            else if (hotPercent >= 25) state = 'hot';
            else if (coldPercent >= 75) state = 'cold';
            else state = 'neutral';
        }

        return {
            ...combo,
            hits,
            sampleMisses,
            hotPercent,
            coldPercent,
            sampleSize,
            state
        };
    });
}

function renderColdTracker(stats) {
    const list = document.getElementById('coldTrackerList');
    const meta = document.getElementById('coldTrackerMeta');
    const lead = document.getElementById('coldTrackerLead');
    if (!list) return;

    const comboStats = getComboCoverageStats(stats)
        .sort((a, b) => b.coldPercent - a.coldPercent || b.sampleMisses - a.sampleMisses || a.hits - b.hits);
    const sampleSize = comboStats.length > 0 ? comboStats[0].sampleSize : 0;

    if (meta) {
        meta.innerText = sampleSize > 0
            ? `Coverage over the last ${sampleSize} spins`
            : 'No spins logged yet.';
    }

    if (lead) {
        if (sampleSize > 0 && comboStats[0]) {
            lead.innerText = `${comboStats[0].label} ${comboStats[0].coldPercent}%`;
            lead.className = 'cold-chip cold-chip-active';
        } else {
            lead.innerText = 'IDLE';
            lead.className = 'cold-chip';
        }
    }

    if (sampleSize === 0) {
        list.innerHTML = '<div class="cold-tracker-empty">Add spins to start measuring combo coldness.</div>';
        return;
    }

    list.innerHTML = comboStats.map(combo => {
        const stateLabel = combo.state.toUpperCase();
        return `
            <div class="cold-tracker-row">
                <div class="cold-row-main">
                    <div class="cold-row-label" style="color:${combo.color}">${combo.label}</div>
                    <span class="cold-state cold-state-${combo.state}">${stateLabel}</span>
                </div>
                <div class="cold-row-value">${combo.sampleMisses}</div>
                <div class="cold-row-value cold-row-percent">${combo.coldPercent}%</div>
            </div>
        `;
    }).join('');
}

function sortEngineReadCombos(comboStats) {
    return (comboStats || []).slice().sort((a, b) =>
        (b.hits - a.hits) ||
        ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) ||
        (a.label > b.label ? 1 : -1)
    );
}

function getComboStatByLabel(stats, label) {
    return (stats && Array.isArray(stats.comboStats))
        ? stats.comboStats.find(combo => combo.label === label) || null
        : null;
}

function buildGateResult(key, label, passed, detail) {
    return { key, label, passed, detail };
}

async function evaluatePredictionEngine(allSpins = history) {
    const spins = Array.isArray(allSpins) ? allSpins : [];
    const engineRunner = typeof PredictionEngine !== 'undefined' && PredictionEngine && typeof PredictionEngine.evaluatePredictionEngine === 'function'
        ? PredictionEngine.evaluatePredictionEngine.bind(PredictionEngine)
        : null;

    if (!engineRunner) {
        return {
            targetFace: null,
            action: 'WAIT',
            confidence: 0,
            ruleKey: 'engine-unavailable',
            ruleLabel: 'Engine Unavailable',
            signalLabel: 'Engine Unavailable',
            detail: 'PredictionEngine.evaluatePredictionEngine is unavailable.',
            triggerFace: null,
            fadedFace: null,
            focusCombo: null,
            fatigueComboLabel: null,
            markovSequenceLabel: null,
            faceGaps: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
            previousFaces: [],
            lastFaces: [],
            previousPrimaryFace: null,
            lastPrimaryFace: null,
            processedSpins: 0,
            dominantCombo: null,
            runnerUpCombo: null,
            exhaustedCombos: [],
            confirmationHits: 0,
            stats14: null,
            stats5: null
        };
    }

    return engineRunner(spins, {
        chunkSize: 500,
        onProgress: (percent, detail) => {
            const processed = detail && Number.isFinite(detail.processed) ? detail.processed : 0;
            const total = detail && Number.isFinite(detail.total) ? detail.total : spins.length;
            const message = total > 0
                ? `Prediction Engine ${percent}% (${processed}/${total})`
                : 'Prediction Engine 100%';

            console.log(message);

            const checkpointSummary = document.getElementById('intelCheckpointSummary');
            if (checkpointSummary) checkpointSummary.innerText = message;

            const checkpointMeta = document.getElementById('intelNextCheckpointMeta');
            if (checkpointMeta) {
                checkpointMeta.innerText = total > 0
                    ? `${processed}/${total} spins processed`
                    : 'Awaiting spins';
            }
        }
    });
}

function buildPredictionGateResults(analysis) {
    const face5Gap = analysis && analysis.faceGaps ? analysis.faceGaps[5] || 0 : 0;
    const exhaustedCount = analysis && Array.isArray(analysis.exhaustedCombos) ? analysis.exhaustedCombos.length : 0;
    const fatigueDetail = analysis && analysis.ruleKey === 'fatigue-inversion'
        ? analysis.detail
        : exhaustedCount > 0
            ? `${exhaustedCount} combo${exhaustedCount === 1 ? '' : 's'} reached fatigue, but the last spin did not lean one clean side.`
            : 'No combo has hit 3 times in the rolling 14-spin window.';

    return [
        buildGateResult(
            'markov',
            'Markov Trigger',
            analysis && (analysis.ruleKey === 'markov-4-5' || analysis.ruleKey === 'markov-2-2'),
            analysis && analysis.markovSequenceLabel
                ? `${analysis.markovSequenceLabel} fired and pointed to F${analysis.targetFace}.`
                : 'Latest two spins did not match F4 -> F5 or F2 -> F2.'
        ),
        buildGateResult(
            'elasticity',
            'Elasticity Snapback',
            analysis && analysis.ruleKey === 'elasticity-snapback',
            analysis && analysis.ruleKey === 'elasticity-snapback'
                ? analysis.detail
                : `Face 5 gap is ${face5Gap}. Snapback starts at 10+.`
        ),
        buildGateResult(
            'fatigue',
            'Fatigue Inversion',
            analysis && analysis.ruleKey === 'fatigue-inversion',
            fatigueDetail
        )
    ];
}

async function buildPredictionEngineSnapshot(allSpins = history) {
    const spins = Array.isArray(allSpins) ? allSpins : [];
    const spinCount = spins.length;
    const checkpoint = getCheckpointMeta(spinCount);
    const snapshot = createEmptyEngineSnapshot(spinCount);
    const analysis = await evaluatePredictionEngine(spins);
    const comboStats = analysis && analysis.stats14
        ? sortEngineReadCombos(getComboCoverageStats(analysis.stats14))
        : [];
    const dominantComboLabel = analysis && analysis.dominantCombo ? analysis.dominantCombo.label : null;

    snapshot.stats14 = analysis ? analysis.stats14 : null;
    snapshot.stats5 = analysis ? analysis.stats5 : null;
    snapshot.comboCoverage = comboStats;
    snapshot.dominantCombo = analysis && analysis.focusCombo
        ? analysis.focusCombo
        : (dominantComboLabel
            ? comboStats.find(combo => combo.label === dominantComboLabel) || analysis.dominantCombo
            : null);
    snapshot.runnerUpCombo = analysis && analysis.runnerUpCombo
        ? analysis.runnerUpCombo
        : (snapshot.dominantCombo
            ? comboStats.find(combo => combo.label !== snapshot.dominantCombo.label) || null
            : comboStats[1] || null);
    snapshot.topMargin = snapshot.dominantCombo
        ? snapshot.dominantCombo.hits - (snapshot.runnerUpCombo ? snapshot.runnerUpCombo.hits : 0)
        : 0;
    snapshot.spinsUntilNextCheckpoint = checkpoint.spinsUntilNext;
    snapshot.nextCheckpointSpin = checkpoint.nextCheckpointSpin;
    snapshot.checkpointSpin = spinCount > 0 ? spinCount : null;
    snapshot.lastEvaluatedSpin = spinCount;
    snapshot.checkpointStatus = analysis && analysis.processedSpins > 0
        ? `Full scan complete (${analysis.processedSpins} spins)`
        : 'Awaiting valid spins';
    snapshot.triggerFace = analysis ? (analysis.triggerFace || analysis.previousPrimaryFace || null) : null;
    snapshot.predictedFace = analysis ? analysis.targetFace : null;
    snapshot.signalKind = analysis ? analysis.ruleKey : null;
    snapshot.confirmationHits = analysis ? analysis.confirmationHits || 0 : 0;
    snapshot.confirmationPassed = snapshot.confirmationHits >= 1;
    snapshot.gateResults = buildPredictionGateResults(analysis);
    snapshot.passedGates = snapshot.gateResults.filter(gate => gate.passed);
    snapshot.failedGates = snapshot.gateResults.filter(gate => !gate.passed);
    snapshot.watchlistMessage = analysis && analysis.detail ? analysis.detail : 'No actionable rule triggered.';

    if (!analysis || !analysis.targetFace || analysis.action === 'WAIT') {
        snapshot.engineState = spinCount < 2 ? 'BUILDING' : 'NO_SIGNAL';
        snapshot.leadMessage = analysis && analysis.detail
            ? analysis.detail
            : (spinCount < 2 ? 'Need at least two spins for the first read.' : 'No actionable rule triggered.');
        return snapshot;
    }

    snapshot.engineState = analysis.action === 'BET_AGAINST' ? 'FOLLOW_UP' : 'READY';
    snapshot.currentPrediction = {
        targetFace: analysis.targetFace,
        triggerFace: snapshot.triggerFace,
        comboLabel: analysis.signalLabel || analysis.ruleLabel,
        accentColor: FACES[analysis.targetFace] ? FACES[analysis.targetFace].color : '#f0f0f0',
        action: analysis.action,
        confidence: analysis.confidence,
        subtitle: analysis.detail
    };
    snapshot.leadMessage = `${analysis.ruleLabel}: F${analysis.targetFace} at ${analysis.confidence}% confidence.`;

    return snapshot;
}

async function syncPredictionEngine() {
    activeBets = [];
    window.currentAlerts = [];

    // Build the background snapshot for the heatmap/HUD first
    const snapshot = await buildPredictionEngineSnapshot();
    engineSnapshot = snapshot;

    // Run ALL registered strategies in the background simultaneously
    const registry = window.StrategyRegistry || {};
    for (const stratKey of Object.keys(registry)) {
        const strat = registry[stratKey];
        if (!strat || typeof strat.run !== 'function') continue;

        // Each strategy can have its own patternConfig; for bg strategies use their full config (all enabled)
        const stratPatternConfig = stratKey === currentGameplayStrategy
            ? patternConfig
            : (strat.buildPatternConfig ? strat.buildPatternConfig(true) : {});

        const result = strat.run(history, snapshot, stratPatternConfig);
        backgroundBets[stratKey] = result.nextBets || [];

        // Only the active strategy drives the live dashboard & alerts
        if (stratKey === currentGameplayStrategy) {
            window.currentAlerts = result.notifications || [];
            activeBets = result.nextBets || [];
        }
    }

    return window.currentAlerts;
}

// runSequenceEngine is now owned by strategies/strategy.series.js
// Access it as: window.StrategyRegistry.series.run(history, null, patternConfig)

function refreshHighlights() {
    document.querySelectorAll('.highlight-pair').forEach(el => el.classList.remove('highlight-pair'));
    if (activeBets.length > 0) {
        activeBets.forEach(bet => {
            if (bet.highlightIds) {
                bet.highlightIds.forEach(id => {
                    const tag = document.querySelector(`.face-tag[data-spin-id="${id}"]`);
                    if (tag) tag.classList.add('highlight-pair');
                });
            }
        });
    }
}

function getEngineStateTone(state) {
    const tones = {
        BUILDING: 'intel-chip-building',
        WAITING: 'intel-chip-waiting',
        READY: 'intel-chip-ready',
        FOLLOW_UP: 'intel-chip-followup',
        WATCHLIST: 'intel-chip-watchlist',
        NO_SIGNAL: 'intel-chip-nosignal'
    };
    return tones[state] || 'intel-chip-waiting';
}

function getMetricToneClass(metric, value) {
    switch (metric) {
        case 'hits':
            if (value >= 3) return 'intel-tone-hot';
            if (value === 2) return 'intel-tone-watch';
            if (value === 1) return 'intel-tone-cold';
            return 'intel-tone-muted';
        case 'hotPercent':
            if (value >= 25) return 'intel-tone-hot';
            if (value >= 15) return 'intel-tone-watch';
            if (value > 0) return 'intel-tone-cold';
            return 'intel-tone-muted';
        case 'coldPercent':
            if (value >= 85) return 'intel-tone-cold';
            if (value >= 65) return 'intel-tone-watch';
            if (value > 0) return 'intel-tone-hot';
            return 'intel-tone-muted';
        case 'margin':
            if (value >= 2) return 'intel-tone-hot';
            if (value === 1) return 'intel-tone-watch';
            if (value === 0) return 'intel-tone-alert';
            return 'intel-tone-muted';
        case 'confirmation':
            return value >= 1 ? 'intel-tone-hot' : 'intel-tone-alert';
        case 'lastSeen':
            if (value === null || value === undefined || value === '-') return 'intel-tone-muted';
            if (value <= 1) return 'intel-tone-hot';
            if (value <= 3) return 'intel-tone-watch';
            return 'intel-tone-cold';
        case 'checkpoint':
            if (value <= 1) return 'intel-tone-watch';
            if (value <= 3) return 'intel-tone-cold';
            return 'intel-tone-muted';
        default:
            return 'intel-tone-muted';
    }
}

function getPredictionToneClass(snapshot) {
    if (!snapshot) return 'intel-tone-muted';
    if (snapshot.currentPrediction) return 'intel-tone-hot';
    if (snapshot.engineState === 'WATCHLIST') return 'intel-tone-watch';
    if (snapshot.engineState === 'NO_SIGNAL') return 'intel-tone-alert';
    return 'intel-tone-muted';
}

function formatEnginePrediction(snapshot) {
    if (!snapshot) return 'No engine state available.';
    if (snapshot.currentPrediction) {
        const action = snapshot.currentPrediction.action || 'BET';
        const confidence = Number.isFinite(snapshot.currentPrediction.confidence)
            ? ` ${snapshot.currentPrediction.confidence}%`
            : '';
        return `${action} F${snapshot.currentPrediction.targetFace} via ${snapshot.currentPrediction.comboLabel}${confidence}.`;
    }
    if (snapshot.engineState === 'WATCHLIST') return snapshot.watchlistMessage || 'Top combo is on watchlist.';
    if (snapshot.engineState === 'BUILDING') return snapshot.leadMessage;
    if (snapshot.engineState === 'WAITING') return snapshot.leadMessage;
    if (snapshot.engineState === 'NO_SIGNAL') return snapshot.leadMessage;
    return 'No actionable signal.';
}

function renderIntelligencePanel() {
    const content = document.getElementById('intelligenceContent');
    const stateChip = document.getElementById('intelStateChip');
    const checkpointSummary = document.getElementById('intelCheckpointSummary');
    const nextCheckpoint = document.getElementById('intelNextCheckpoint');
    const nextCheckpointMeta = document.getElementById('intelNextCheckpointMeta');
    if (!content) return;

    const snapshot = engineSnapshot || createEmptyEngineSnapshot(history.length);
    const rankedCombos = sortEngineReadCombos(snapshot.comboCoverage || []);
    const leadCombo = snapshot.dominantCombo;
    const runnerUp = snapshot.runnerUpCombo;

    if (stateChip) {
        stateChip.innerText = snapshot.engineState;
        stateChip.className = `intel-state-chip ${getEngineStateTone(snapshot.engineState)}`;
    }

    if (checkpointSummary) {
        checkpointSummary.innerText = snapshot.checkpointStatus;
        checkpointSummary.className = `intel-toolbar-title ${getPredictionToneClass(snapshot)}`;
    }

    if (nextCheckpoint) {
        nextCheckpoint.innerText = snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW;
        nextCheckpoint.className = `intel-next-value ${getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}`;
    }

    if (nextCheckpointMeta) {
        nextCheckpointMeta.innerText = snapshot.spinCount < ENGINE_PRIMARY_WINDOW
            ? `${snapshot.spinsUntilNextCheckpoint} spins until first read`
            : `${snapshot.spinsUntilNextCheckpoint} spins until next read`;
        nextCheckpointMeta.className = `intel-toolbar-meta ${getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}`;
    }

    const comboRows = rankedCombos.map((combo, index) => `
        <tr>
            <td class="intel-table-label" style="color:${combo.color}">${index + 1}. ${combo.label}</td>
            <td class="intel-table-metric ${getMetricToneClass('hits', combo.hits)}">${combo.hits}</td>
            <td class="intel-table-metric ${getMetricToneClass('hotPercent', combo.hotPercent)}">${combo.hotPercent}%</td>
            <td class="intel-table-metric ${getMetricToneClass('coldPercent', combo.coldPercent)}">${combo.coldPercent}%</td>
            <td class="intel-table-metric ${getMetricToneClass('lastSeen', combo.lastSeenDistance ?? '-')}">${combo.lastSeenDistance ?? '-'}</td>
        </tr>
    `).join('');

    const diagnosticRows = rankedCombos.map((combo, index) => {
        const recentCombo = getComboStatByLabel(snapshot.stats5, combo.label);
        const recentHits = recentCombo ? recentCombo.hits : 0;
        return `
            <tr>
                <td class="intel-table-label" style="color:${combo.color}">${index + 1}. ${combo.label}</td>
                <td class="intel-table-metric ${getMetricToneClass('hits', combo.hits)}">${combo.hits}</td>
                <td class="intel-table-metric ${getMetricToneClass('hotPercent', combo.hotPercent)}">${combo.hotPercent}%</td>
                <td class="intel-table-metric ${getMetricToneClass('coldPercent', combo.coldPercent)}">${combo.coldPercent}%</td>
                <td class="intel-table-metric ${getMetricToneClass('confirmation', recentHits)}">${recentHits}</td>
                <td class="intel-table-metric ${getMetricToneClass('lastSeen', combo.lastSeenDistance ?? '-')}">${combo.lastSeenDistance ?? '-'}</td>
            </tr>
        `;
    }).join('');

    const gateRows = snapshot.gateResults.map(gate => `
        <div class="intel-gate-row ${gate.passed ? 'intel-gate-pass' : 'intel-gate-fail'}">
            <div class="intel-gate-head">
                <span>${gate.label}</span>
                <span>${gate.passed ? 'PASS' : 'FAIL'}</span>
            </div>
            <div class="intel-gate-copy">${gate.detail}</div>
        </div>
    `).join('');

    if (currentIntelligenceMode === 'minimal') {
        content.innerHTML = `
            <div class="intel-grid-minimal">
                <div class="intel-card">
                    <div class="intel-card-kicker">Dominant Combo</div>
                    <div class="intel-card-title" style="color:${leadCombo ? leadCombo.color : '#f0f0f0'}">${leadCombo ? leadCombo.label : 'None'}</div>
                </div>
                <div class="intel-card">
                    <div class="intel-card-kicker">Prediction</div>
                    <div class="intel-card-title intel-metric-copy ${getPredictionToneClass(snapshot)}">${formatEnginePrediction(snapshot)}</div>
                </div>
                <div class="intel-card">
                    <div class="intel-card-kicker">Next Checkpoint</div>
                    <div class="intel-card-title ${getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}">${snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW}</div>
                    <div class="intel-card-copy ${getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}">${snapshot.spinsUntilNextCheckpoint} spins remaining</div>
                </div>
            </div>
        `;
        return;
    }

    const briefBlock = `
        <div class="intel-grid-brief">
            <div class="intel-lead-card">
                <div class="intel-card-kicker">Lead Insight</div>
                <div class="intel-card-title ${getPredictionToneClass(snapshot)}">${snapshot.leadMessage}</div>
                <div class="intel-card-copy ${getPredictionToneClass(snapshot)}">${formatEnginePrediction(snapshot)}</div>
            </div>
            <div class="intel-card">
                <div class="intel-card-kicker">Primary Read</div>
                <div class="intel-card-title" style="color:${leadCombo ? leadCombo.color : '#f0f0f0'}">${leadCombo ? leadCombo.label : 'No combo'}</div>
                <div class="intel-card-copy">${leadCombo ? `<span class="intel-inline-metric ${getMetricToneClass('hits', leadCombo.hits)}">${leadCombo.hits} hits</span> in rolling 14` : 'Waiting for a valid sample.'}</div>
            </div>
            <div class="intel-card">
                <div class="intel-card-kicker">Runner-Up Margin</div>
                <div class="intel-card-title ${getMetricToneClass('margin', snapshot.topMargin)}">${leadCombo ? `${snapshot.topMargin >= 0 ? '+' : ''}${snapshot.topMargin}` : '-'}</div>
                <div class="intel-card-copy">${runnerUp ? `Runner-up is ${runnerUp.label} with ${runnerUp.hits} hits` : 'No runner-up yet.'}</div>
            </div>
            <div class="intel-card">
                <div class="intel-card-kicker">Trigger / Follow Face</div>
                <div class="intel-card-title ${snapshot.triggerFace ? getPredictionToneClass(snapshot) : 'intel-tone-muted'}">${snapshot.triggerFace ? `F${snapshot.triggerFace} -> F${snapshot.predictedFace}` : 'No action'}</div>
                <div class="intel-card-copy ${snapshot.triggerFace ? getPredictionToneClass(snapshot) : 'intel-tone-muted'}">${snapshot.currentPrediction ? 'Latest spin produced a clean trigger.' : 'Waiting for a clean one-sided trigger.'}</div>
            </div>
            <div class="intel-card">
                <div class="intel-card-kicker">5-Spin Confirmation</div>
                <div class="intel-card-title ${getMetricToneClass('confirmation', snapshot.confirmationHits)}">${snapshot.confirmationPassed ? 'PASS' : 'FAIL'}</div>
                <div class="intel-card-copy">${leadCombo ? `${leadCombo.label} hit <span class="intel-inline-metric ${getMetricToneClass('confirmation', snapshot.confirmationHits)}">${snapshot.confirmationHits}</span> time${snapshot.confirmationHits === 1 ? '' : 's'} in the last ${Math.min(ENGINE_CONFIRMATION_WINDOW, snapshot.spinCount)} spins.` : 'No combo under review.'}</div>
            </div>
        </div>
        <div class="intel-card intel-table-card">
            <div class="intel-card-kicker">14-Spin Combo Ranking</div>
            <table class="intel-table">
                <thead>
                    <tr><th>Combo</th><th>Hits</th><th>Hot</th><th>Cold</th><th>Last Seen</th></tr>
                </thead>
                <tbody>${comboRows || '<tr><td colspan="5" class="intel-table-empty">Awaiting data...</td></tr>'}</tbody>
            </table>
        </div>
    `;

    if (currentIntelligenceMode === 'brief') {
        content.innerHTML = briefBlock;
        return;
    }

    content.innerHTML = `
        ${briefBlock}
        <div class="intel-grid-diagnostic">
            <div class="intel-card">
                <div class="intel-card-kicker">Checkpoint Flow</div>
                <div class="intel-card-copy">Last evaluated spin: <span class="intel-inline-metric ${snapshot.lastEvaluatedSpin ? 'intel-tone-watch' : 'intel-tone-muted'}">${snapshot.lastEvaluatedSpin || 'None yet'}</span></div>
                <div class="intel-card-copy">Next checkpoint: <span class="intel-inline-metric ${getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}">${snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW}</span></div>
                <div class="intel-card-copy">Signal kind: <span class="intel-inline-metric ${getPredictionToneClass(snapshot)}">${snapshot.signalKind ? snapshot.signalKind.toUpperCase() : 'NONE'}</span></div>
            </div>
            <div class="intel-card">
                <div class="intel-card-kicker">Gate Breakdown</div>
                <div class="intel-gates">${gateRows || '<div class="intel-table-empty">No gate data yet.</div>'}</div>
            </div>
        </div>
        <div class="intel-card intel-table-card">
            <div class="intel-card-kicker">Diagnostic Combo Table</div>
            <table class="intel-table">
                <thead>
                    <tr><th>Combo</th><th>14 Hits</th><th>Hot</th><th>Cold</th><th>5 Hits</th><th>Last Seen</th></tr>
                </thead>
                <tbody>${diagnosticRows || '<tr><td colspan="6" class="intel-table-empty">Awaiting data...</td></tr>'}</tbody>
            </table>
        </div>
    `;
}

function updateAnalyticsHUD() {
    const hud = document.getElementById('analyticsHUD');
    if (!hud || hud.classList.contains('hidden')) return;

    const hudLabel = document.getElementById('hudWindowValue');
    const hudScopeBtn = document.getElementById('hudScopeBtn');

    const themeColor = isHudColdMode ? '#06b6d4' : '#30D158';

    if (hudLabel) {
        hudLabel.innerText = getHudScopeSummary();
        hudLabel.style.color = themeColor;
    }

    if (hudScopeBtn) {
        const isRecentScope = hudHistoryScope === 'recent';
        const scopeLabel = hudHistoryScope === 'all' ? 'ALL' : HUD_RECENT_WINDOW;
        hudScopeBtn.innerText = `${history.length} / ${scopeLabel}`;
        hudScopeBtn.title = hudHistoryScope === 'all' ? 'Switch to 14-spin rolling window' : 'Switch to all history';
        hudScopeBtn.className = 'px-1.5 min-w-[28px] h-5 flex items-center justify-center rounded-md text-[8px] font-black tracking-[0.12em] border transition-colors';
        hudScopeBtn.style.color = isRecentScope ? themeColor : 'rgba(255,255,255,0.88)';
        hudScopeBtn.style.borderColor = isRecentScope
            ? `${themeColor}55`
            : 'rgba(255,255,255,0.22)';
        hudScopeBtn.style.background = isRecentScope
            ? `${themeColor}22`
            : 'rgba(255,255,255,0.10)';
    }

    // Update Header Title based on mode
    const headerTitle = hud.querySelector('#hudHeader span');
    if (headerTitle) {
        headerTitle.innerHTML = isHudColdMode
            ? `<i class="fas fa-snowflake mr-1"></i> Cold Tracker`
            : `<i class="fas fa-satellite-dish mr-1"></i> Live Feed`;
        headerTitle.className = `text-[9px] font-bold tracking-[0.18em] uppercase ${isHudColdMode ? 'text-[#06b6d4]' : 'text-[#30D158]'}`;
    }

    // Update Stats Table
    const content = document.getElementById('hudStats');
    if (!content) return;

    const windowSize = getHudWindowSetting();
    const isSeries = currentGameplayStrategy === 'series';

    if (isSeries) {
        // --- SERIES MODE: show sequence hit stats ---
        const window_ = hudHistoryScope === 'recent' ? history.slice(-windowSize) : history;
        const sampleSize = window_.length;
        const colLabel = 'Seq';
        const col3Title = isHudColdMode ? 'Miss%' : 'Hit%';

        // Count how many times each sequence's target face appeared after the trigger pair
        const seriesStrat = window.StrategyRegistry && window.StrategyRegistry.series;
        const SEQ_LIST   = seriesStrat ? SEQUENCES : [];
        const SEQ_COLORS = seriesStrat ? SEQUENCE_COLORS : [];
        const seqStats = SEQ_LIST.map((seq, i) => {
            let hits = 0;
            for (let j = 2; j < window_.length; j++) {
                const fA = window_[j - 2]?.faces?.includes(seq.a);
                const fB = window_[j - 1]?.faces?.includes(seq.b);
                const fT = window_[j]?.faces?.includes(seq.target);
                if (fA && fB && fT) hits++;
            }
            const pct = sampleSize < 3 ? 0 : Math.round((hits / Math.max(1, sampleSize - 2)) * 100);
            return {
                label: seq.name,
                color: SEQ_COLORS[i % SEQ_COLORS.length],
                hits,
                pct
            };
        });

        if (isHudColdMode) {
            seqStats.sort((a, b) => a.pct - b.pct);
        } else {
            seqStats.sort((a, b) => b.pct - a.pct || b.hits - a.hits);
        }

        let html = `
            <div class="space-y-0.5">
                <div class="grid grid-cols-[50px_minmax(0,1fr)_32px] items-center gap-1.5 px-0.5 pb-1 text-[8px] uppercase tracking-[0.12em] text-white/28 border-b border-white/10">
                    <div class="font-bold">${colLabel}</div>
                    <div class="text-center font-bold">Hits</div>
                    <div class="text-right font-bold">${col3Title}</div>
                </div>
        `;

        if (sampleSize === 0) {
            html += `<div class="py-4 text-center text-white/35 italic">Awaiting spins...</div>`;
        } else {
            seqStats.forEach(s => {
                const val2 = isHudColdMode ? (100 - s.pct) : s.pct;
                const highlight = val2 > 20;
                const opacity = highlight ? '1' : '0.5';
                const valColor = highlight ? themeColor : '#8E8E93';
                html += `
                    <div class="grid grid-cols-[50px_minmax(0,1fr)_32px] items-center gap-1.5 px-0.5 py-1">
                        <div class="text-[10px] font-black tracking-[0.08em]" style="color:${s.color}; opacity:${opacity}">${s.label}</div>
                        <div class="text-center font-mono text-[10px] text-gray-200" style="opacity:${opacity}">${s.hits}</div>
                        <div class="text-right font-mono text-[10px] font-bold" style="color:${valColor}; opacity:${opacity}">${val2}%</div>
                    </div>
                `;
            });
        }
        html += `</div>`;
        content.innerHTML = html;
    } else {
        // --- COMBO MODE: original perimeter combo logic ---
        const stats = calculatePerimeterStats(history, windowSize);
        if (!stats || !stats.counts) return;
        const comboStats = getComboCoverageStats(stats);
        const sampleSize = comboStats.length > 0 ? comboStats[0].sampleSize : 0;

        let displayCombos = comboStats.slice();
        if (isHudColdMode) {
            displayCombos.sort((a, b) => b.coldPercent - a.coldPercent || b.sampleMisses - a.sampleMisses || a.hits - b.hits);
        } else {
            displayCombos.sort((a, b) => b.hotPercent - a.hotPercent || b.hits - a.hits || a.sampleMisses - b.sampleMisses);
        }

        const col3Title = isHudColdMode ? 'C%' : 'H%';

        let html = `
            <div class="space-y-0.5">
                <div class="grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-1.5 px-0.5 pb-1 text-[8px] uppercase tracking-[0.12em] text-white/28 border-b border-white/10">
                    <div class="font-bold">Combo</div>
                    <div class="text-center font-bold">H / S</div>
                    <div class="text-right font-bold">${col3Title}</div>
                </div>
        `;

        if (sampleSize === 0) {
            html += `<div class="py-4 text-center text-white/35 italic">Awaiting spins...</div>`;
        } else {
            displayCombos.forEach(c => {
                const ratioSampleSize = Number.isFinite(c.sampleSize) ? c.sampleSize : sampleSize;
                const val1 = `${c.hits}/${ratioSampleSize}`;
                const val2 = isHudColdMode ? c.coldPercent : c.hotPercent;
                const opacity = (isHudColdMode ? val2 > 80 : val2 > 20) ? '1' : '0.5';
                const valColor = (isHudColdMode ? val2 > 80 : val2 > 20) ? themeColor : '#8E8E93';
                html += `
                    <div class="grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-1.5 px-0.5 py-1">
                        <div class="text-[12px] font-black tracking-[0.08em]" style="color:${c.color}; opacity:${opacity}">${c.label}</div>
                        <div class="text-center font-mono text-[10px] text-gray-200" style="opacity:${opacity}">${val1}</div>
                        <div class="text-right font-mono text-[10px] font-bold" style="color:${valColor}; opacity:${opacity}">${val2}%</div>
                    </div>
                `;
            });
        }
        html += `</div>`;
        content.innerHTML = html;
    }

    fitAnalyticsHUD();
}

function buildRacetrackSVG() {
    const svgW = 240;
    const svgH = 880;

    const trackThickness = 44;
    const innerR = 40;
    const outerR = innerR + trackThickness; // 84

    const cx = 120;
    const cy1 = 100;
    const cy2 = 740;
    const blockH = 40; // 16 * 40 = 640

    const rightArray = [5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35];
    const leftArray = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8];

    let getWedgePath = (cx, cy, rIn, rOut, a1Deg, a2Deg) => {
        const a1 = a1Deg * Math.PI / 180;
        const a2 = a2Deg * Math.PI / 180;
        const p1x = cx + rOut * Math.cos(a1);
        const p1y = cy + rOut * Math.sin(a1);
        const p2x = cx + rOut * Math.cos(a2);
        const p2y = cy + rOut * Math.sin(a2);
        const p3x = cx + rIn * Math.cos(a2);
        const p3y = cy + rIn * Math.sin(a2);
        const p4x = cx + rIn * Math.cos(a1);
        const p4y = cy + rIn * Math.sin(a1);
        return `M ${p1x} ${p1y} A ${rOut} ${rOut} 0 0 1 ${p2x} ${p2y} L ${p3x} ${p3y} A ${rIn} ${rIn} 0 0 0 ${p4x} ${p4y} Z`;
    };

    let getRectPath = (x, y, width, height) => {
        return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
    };

    let getColorClass = (num) => {
        if (num === 0) return 'rt-green';
        return RED_NUMS.includes(num) ? 'rt-red' : 'rt-black';
    };

    let paths = '';
    let texts = '';

    // Inner Area - Transparent but bordered to match UI
    paths += `<path d="M ${cx - innerR} ${cy1} L ${cx - innerR} ${cy2} A ${innerR} ${innerR} 0 0 0 ${cx + innerR} ${cy2} L ${cx + innerR} ${cy1} A ${innerR} ${innerR} 0 0 0 ${cx - innerR} ${cy1} Z" class="rt-inner" />`;

    // Division Lines inside the track
    paths += `<line x1="${cx - innerR}" y1="230" x2="${cx + innerR}" y2="230" stroke="rgba(255,255,255,0.05)" stroke-width="2" />`;
    paths += `<line x1="${cx - innerR}" y1="380" x2="${cx + innerR}" y2="520" stroke="rgba(255,255,255,0.05)" stroke-width="2" />`;
    paths += `<path d="M ${cx - innerR} 640 C ${cx - innerR + 20} 600, ${cx + innerR - 20} 600, ${cx + innerR} 640" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2" />`;

    // Static text overlays (Rotated down for elegant fit)
    texts += `<text x="${cx}" y="150" transform="rotate(90, ${cx}, 150)" class="rt-label">TIER</text>`;
    texts += `<text x="${cx}" y="300" transform="rotate(90, ${cx}, 300)" class="rt-label">ORPHELINS</text>`;
    texts += `<text x="${cx}" y="480" transform="rotate(90, ${cx}, 480)" class="rt-label">VOISINS</text>`;
    texts += `<text x="${cx}" y="690" transform="rotate(90, ${cx}, 690)" class="rt-label">ZERO</text>`;

    let createGroup = (num, pathD, tx, ty) => {
        return `<g class="rt-seg" onclick="handleGridClick(${num})">
            <path d="${pathD}" />
            <text x="${tx}" y="${ty}" class="rt-num ${getColorClass(num)}" text-anchor="middle" dominant-baseline="central">${num}</text>
        </g>`;
    };

    // 1. Right Straight (Top down)
    for (let i = 0; i < 16; i++) {
        let n = rightArray[i];
        let x = cx + innerR;
        let y = cy1 + i * blockH;
        paths += createGroup(n, getRectPath(x, y, trackThickness, blockH), x + trackThickness / 2, y + blockH / 2);
    }

    // 2. Left Straight (Bottom up to match clockwise)
    for (let i = 0; i < 16; i++) {
        let n = leftArray[i];
        let x = cx - outerR;
        let y = cy2 - (i + 1) * blockH;
        paths += createGroup(n, getRectPath(x, y, trackThickness, blockH), x + trackThickness / 2, y + blockH / 2);
    }

    // 3. Bottom Arc
    let tr = innerR + trackThickness / 2; // 62
    paths += createGroup(3, getWedgePath(cx, cy2, innerR, outerR, 0, 60), cx + tr * Math.cos(30 * Math.PI / 180), cy2 + tr * Math.sin(30 * Math.PI / 180));
    paths += createGroup(26, getWedgePath(cx, cy2, innerR, outerR, 60, 120), cx, cy2 + tr);
    paths += createGroup(0, getWedgePath(cx, cy2, innerR, outerR, 120, 180), cx + tr * Math.cos(150 * Math.PI / 180), cy2 + tr * Math.sin(150 * Math.PI / 180));

    // 4. Top Arc
    paths += createGroup(23, getWedgePath(cx, cy1, innerR, outerR, 180, 270), cx + tr * Math.cos(225 * Math.PI / 180), cy1 + tr * Math.sin(225 * Math.PI / 180));
    paths += createGroup(10, getWedgePath(cx, cy1, innerR, outerR, 270, 360), cx + tr * Math.cos(315 * Math.PI / 180), cy1 + tr * Math.sin(315 * Math.PI / 180));

    return `
        <svg id="racetrackSvg" width="100%" viewBox="0 0 ${svgW} ${svgH}" class="max-w-[220px] pointer-events-auto">
            <style>
                .rt-num { font-family: 'Space Mono', monospace; font-size: 20px; font-weight: 800; pointer-events: none; }
                .rt-num.rt-red { fill: #ff5050; text-shadow: 0 0 10px rgba(255,80,80,0.5); }
                .rt-num.rt-black { fill: #bbbbbb; }
                .rt-num.rt-green { fill: #00ff66; text-shadow: 0 0 10px rgba(0,255,102,0.5); }
                
                .rt-seg path { fill: #2a2a2e; stroke: rgba(255,255,255,0.06); stroke-width: 1px; transition: all 0.15s ease; cursor: pointer; }
                .rt-seg:hover path { fill: rgba(255, 26, 51, 0.15); stroke: rgba(255, 26, 51, 0.6); filter: drop-shadow(0 0 10px rgba(255,26,51,0.3)); }
                
                .rt-inner { fill: transparent; stroke: rgba(255,255,255,0.06); stroke-width: 2px; }
                .rt-label { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: 5px; text-anchor: middle; dominant-baseline: central; fill: rgba(255,255,255,0.15); pointer-events: none; }
            </style>
            ${paths}
            ${texts}
        </svg>
    `;
}

function initDesktopGrid() {
    const gridWrapper = document.getElementById('desktopGrid');

    if (currentInputLayout === 'grid') {
        gridWrapper.className = "hidden md:block w-[240px] shrink-0 mesmer-grid p-3 overflow-y-auto custom-scroll";
        gridWrapper.innerHTML = '<div class="grid grid-cols-3 gap-2 pb-10"></div>';

        const grid = gridWrapper.firstElementChild;
        grid.innerHTML = '<button class="grid-btn grid-green col-span-3 py-4 shadow-sm h-12 flex items-center justify-center" onclick="handleGridClick(0)">0</button>';

        for (let i = 1; i <= 36; i++) {
            let btn = document.createElement('button');
            const isRed = RED_NUMS.includes(i);
            btn.className = `grid-btn py-4 shadow-sm h-12 flex items-center justify-center ${isRed ? 'grid-red' : 'grid-black'}`;
            btn.innerText = i;
            btn.onclick = () => handleGridClick(i);
            grid.appendChild(btn);
        }
    } else {
        // RACETRACK LAYOUT (Perfect Theme Integration)
        gridWrapper.className = "hidden md:block w-[240px] shrink-0 mesmer-grid overflow-y-auto custom-scroll";

        // Remove flex center entirely to restore the ability to scroll freely to the top and bottom!
        gridWrapper.innerHTML = '<div class="w-full flex justify-center pt-6 pb-20 fade-in"></div>';

        const grid = gridWrapper.firstElementChild;
        grid.innerHTML = buildRacetrackSVG();
    }
}

function syncPerimeterRuleState() {
    perimeterRuleEnabled = patternConfig[PERIMETER_RULE_KEY] !== false;
    patternConfig[PERIMETER_RULE_KEY] = perimeterRuleEnabled;
}

function updatePredictionSettingsUI() {
    const windowLabel = document.getElementById('perimeterWindowValue');
    if (windowLabel) {
        windowLabel.innerText = `${predictionPerimeterWindow} Spins`;
    }
    updateNeuralPredictionUi();
}

function updatePerimeterAnalytics() {
    const stats = calculatePerimeterStats(history, predictionPerimeterWindow);
    renderColdTracker(stats);

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

function calculatePerimeterStats(history, windowSize = 14) {
    if (typeof PredictionEngine !== 'undefined' && typeof PredictionEngine.calculatePerimeterStats === 'function') {
        return PredictionEngine.calculatePerimeterStats(history, windowSize);
    }

    const historyArray = Array.isArray(history) ? history : [];
    const parsedWindow = parseInt(windowSize, 10);
    const useAllHistory = windowSize === 'all' || windowSize === Infinity || windowSize === null;
    const safeWindow = useAllHistory
        ? Math.max(2, historyArray.length)
        : (Number.isNaN(parsedWindow) ? 14 : Math.max(2, Math.min(60, parsedWindow)));
    const recentSpins = historyArray.slice(-safeWindow);
    const sampleSize = recentSpins.length;
    const transitionCount = Math.max(0, recentSpins.length - 1);

    let counts = { '5-2': 0, '5-3': 0, '1-3': 0, '2-4': 0 };

    for (let i = 1; i < recentSpins.length; i++) {
        const prevSpin = recentSpins[i - 1];
        const currSpin = recentSpins[i];
        if (!prevSpin || !currSpin) continue;

        const prevMask = Object.prototype.hasOwnProperty.call(FON_MASK_MAP, prevSpin.num) ? FON_MASK_MAP[prevSpin.num] : 0;
        const currMask = Object.prototype.hasOwnProperty.call(FON_MASK_MAP, currSpin.num) ? FON_MASK_MAP[currSpin.num] : 0;

        PERIMETER_COMBOS.forEach(combo => {
            const matched = (((prevMask & FACE_MASKS[combo.a]) !== 0) && ((currMask & FACE_MASKS[combo.b]) !== 0)) ||
                (((prevMask & FACE_MASKS[combo.b]) !== 0) && ((currMask & FACE_MASKS[combo.a]) !== 0));
            if (matched) counts[combo.label]++;
        });
    }

    let dominantCombo = null;
    let highestCount = -1;
    PERIMETER_COMBOS.forEach(combo => {
        const count = counts[combo.label] || 0;
        if (count > highestCount) {
            highestCount = count;
            dominantCombo = combo;
        }
    });

    if (highestCount <= 0) dominantCombo = null;

    const comboStats = PERIMETER_COMBOS.map(combo => {
        const hits = counts[combo.label] || 0;
        const sampleMisses = Math.max(0, sampleSize - hits);
        const hotPercent = sampleSize > 0 ? Math.round((hits / sampleSize) * 100) : 0;
        const coldPercent = sampleSize > 0 ? Math.round((sampleMisses / sampleSize) * 100) : 0;
        let state = 'idle';
        if (sampleSize > 0) {
            if (hits === 0) state = 'cold';
            else if (hotPercent >= 25) state = 'hot';
            else if (coldPercent >= 75) state = 'cold';
            else state = 'neutral';
        }

        return {
            ...combo,
            hits,
            sampleMisses,
            hotPercent,
            coldPercent,
            sampleSize,
            state
        };
    });

    return {
        windowSize: safeWindow,
        recentSpins: recentSpins,
        sampleSize: sampleSize,
        transitionCount: transitionCount,
        sequence: recentSpins.map(s => (s.faces && s.faces.length > 0 ? s.faces[0] : '?')),
        counts: counts,
        dominantCombo: dominantCombo,
        comboStats: comboStats
    };
}

async function refreshPredictionEngineUI() {
    await scanAllStrategies();
    if (neuralPredictionEnabled && aiEnabled && aiApiKey) {
        await requestNeuralPrediction({ renderDashboardNow: false, force: true });
    }
    updateVisibility();
    updatePerimeterAnalytics();
    updateAnalyticsHUD();
}

function stampAiRuntimeState(nextState = {}) {
    aiRuntimeState = {
        ...aiRuntimeState,
        provider: aiProvider,
        lastUpdatedLabel: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ...nextState
    };

    const analyticsModal = document.getElementById('analyticsModal');
    if (analyticsModal && !analyticsModal.classList.contains('hidden') && currentAnalyticsTab === 'advancements') {
        renderAdvancementLog();
    }
}

function classifyAiRuntimeStatus(message) {
    const text = String(message || '').toLowerCase();
    if (!text) return 'ERROR';
    if (text.includes('quota') || text.includes('billing')) return 'QUOTA';
    if (text.includes('rate limit') || text.includes('resource_exhausted') || text.includes('too many requests')) return 'RATE_LIMIT';
    if (text.includes('invalid') || text.includes('api key') || text.includes('unauthorized') || text.includes('permission')) return 'INVALID_KEY';
    if (text.includes('model') && text.includes('not found')) return 'MODEL_ERROR';
    if (text.includes('network') || text.includes('failed to fetch')) return 'NETWORK';
    return 'ERROR';
}

function summarizeComboWindow(windowSize) {
    const stats = calculatePerimeterStats(history, windowSize);
    return sortEngineReadCombos(getComboCoverageStats(stats)).map(combo =>
        `${combo.label}: ${combo.hits} hits, hot ${combo.hotPercent}%, cold ${combo.coldPercent}%, rest ${combo.lastSeenDistance ?? '-'}`
    ).join(' | ');
}

function buildAiTakeoverPrompt() {
    const recentSpins = history.slice(-80).map(s => s.num).join(', ') || 'None yet';
    const recentHits = history.slice(-10).map(s => `F${FON_PRIMARY_FACE_MAP[s.num] || '?'}`).join(' -> ') || 'None yet';
    const gaps = Object.entries(faceGaps).map(([face, gap]) => `F${face}:${gap}`).join(', ');
    const mathSignal = engineSnapshot && engineSnapshot.currentPrediction
        ? `${engineSnapshot.currentPrediction.comboLabel} -> F${engineSnapshot.currentPrediction.targetFace} (${engineSnapshot.currentPrediction.confidence}%)`
        : 'No active math signal';
    const currentStreak = engineStats.currentStreak > 0 ? `Winning ${engineStats.currentStreak}` : (engineStats.currentStreak < 0 ? `Losing ${Math.abs(engineStats.currentStreak)}` : 'Flat');

    return `ROLE: You are an expert Roulette "Table Boss" standing over the player's shoulder. 
Task: Read the live telemetry, the wheel rhythm, and the math engine's current signal. Decide if the math is correct or if it's walking into a trap because the table is acting weird (e.g., choppy, leaking, ghost patterns). Return strict JSON.

Rules:
1. GRADE THE MATH: Provide a mathAssessment (AGREE, DISAGREE, IGNORE). If the math looks wrong based on the table, DISAGREE and SIT_OUT or provide a better target.
2. GRADE THE TABLE: Provide a tableState (TRENDING, CHOPPY, FATIGUED). 
3. PLAY OR PASS: If the math is right or you see a clean edge, return GO. If the table is chaotic and the math is walking into a trap, return SIT_OUT.
4. Keep the reason tactical, explicitly mentioning the exact rhythm or why the math is right/wrong.

Live Telemetry:
- Net Units: ${engineStats.netUnits} (Streak: ${currentStreak})
- Face Gaps: ${gaps}
- 5-spin combos: ${summarizeComboWindow(5)}
- 14-spin combos: ${summarizeComboWindow(14)}
- Math engine read: ${mathSignal}
- Last 10 hit rhythm: ${recentHits}
- Last 80 spins: ${recentSpins}

Return JSON only:
{"status":"GO|WATCH|SIT_OUT","combo":"5-2|5-3|1-3|2-4|NONE","targetFace":1,"confidence":0,"mode":"TREND|INVERSION|WAIT","mathAssessment":"AGREE|DISAGREE|IGNORE","tableState":"TRENDING|CHOPPY|FATIGUED","reason":"tactical table analysis"}`;
}

function getAiTakeoverSchema() {
    return {
        type: 'OBJECT',
        properties: {
            status: {
                type: 'STRING',
                enum: ['GO', 'WATCH', 'SIT_OUT']
            },
            combo: {
                type: 'STRING',
                enum: ['5-2', '5-3', '1-3', '2-4', 'NONE']
            },
            targetFace: {
                type: 'NUMBER'
            },
            confidence: {
                type: 'NUMBER'
            },
            mode: {
                type: 'STRING',
                enum: ['TREND', 'INVERSION', 'WAIT']
            },
            mathAssessment: {
                type: 'STRING',
                enum: ['AGREE', 'DISAGREE', 'IGNORE']
            },
            tableState: {
                type: 'STRING',
                enum: ['TRENDING', 'CHOPPY', 'FATIGUED']
            },
            reason: {
                type: 'STRING'
            }
        },
        required: ['status', 'combo', 'confidence', 'mode', 'mathAssessment', 'tableState', 'reason']
    };
}

function extractAiJsonPayload(rawText) {
    const normalizedText = String(rawText || '')
        .trim()
        .replace(/^```json\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/\s*```$/i, '');
    const jsonMatch = normalizedText.match(/\{[\s\S]*\}/);
    return JSON.parse(jsonMatch ? jsonMatch[0] : normalizedText);
}

function salvageAiTakeoverPayload(rawText) {
    const text = String(rawText || '').trim();
    const statusMatch = text.match(/\b(GO|WATCH|SIT[\s_]?OUT)\b/i);
    const comboMatch = text.match(/\b(5-2|5-3|1-3|2-4|NONE)\b/i);
    const modeMatch = text.match(/\b(TREND|INVERSION|WAIT)\b/i);
    const assessmentMatch = text.match(/\b(AGREE|DISAGREE|IGNORE)\b/i);
    const tableStateMatch = text.match(/\b(TRENDING|CHOPPY|FATIGUED)\b/i);
    const faceMatch = text.match(/(?:targetFace|face)\s*[:=]?\s*["']?F?([1-5])["']?/i) || text.match(/\bF([1-5])\b/);
    const confidenceMatch = text.match(/(?:confidence)\s*[:=]?\s*["']?(\d{1,3})["']?/i) || text.match(/\b(\d{1,3})\s*%/);
    const reasonMatch = text.match(/(?:reason)\s*[:=]\s*["']([^"']+)["']/i);

    const payload = {
        status: statusMatch ? statusMatch[1].toUpperCase().replace(/\s+/g, '_') : 'SIT_OUT',
        combo: comboMatch ? comboMatch[1].toUpperCase() : 'NONE',
        targetFace: faceMatch ? Number(faceMatch[1]) : null,
        confidence: confidenceMatch ? Number(confidenceMatch[1]) : 0,
        mode: modeMatch ? modeMatch[1].toUpperCase() : 'WAIT',
        mathAssessment: assessmentMatch ? assessmentMatch[1].toUpperCase() : 'IGNORE',
        tableState: tableStateMatch ? tableStateMatch[1].toUpperCase() : 'CHOPPY',
        reason: reasonMatch ? reasonMatch[1].trim() : text.slice(0, 180) || 'No structured reason returned.'
    };

    if (payload.status === 'SIT_OUT') {
        payload.targetFace = null;
    }

    return payload;
}

async function requestAiText(promptText, options = {}) {
    if (!aiApiKey) {
        throw new Error('AI key is not configured.');
    }

    const temperature = typeof options.temperature === 'number' ? options.temperature : 0.2;
    const maxOutputTokens = Number.isFinite(options.maxOutputTokens) ? options.maxOutputTokens : 700;
    const requestMode = options.requestMode || 'generic';
    const responseMimeType = options.responseMimeType || null;
    const responseSchema = options.responseSchema || null;
    const startedAt = Date.now();

    stampAiRuntimeState({
        status: 'WORKING',
        lastError: '',
        lastRequestMode: requestMode,
        lastPromptPreview: String(promptText || '').slice(0, 260)
    });

    try {
        let responseText = '';

        if (aiProvider === 'gemini') {
            const generationConfig = {
                temperature,
                topP: 0.8,
                maxOutputTokens
            };
            if (responseMimeType) generationConfig.responseMimeType = responseMimeType;
            if (responseSchema) generationConfig.responseSchema = responseSchema;

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': aiApiKey
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: promptText }] }],
                    generationConfig
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `Gemini request failed (${res.status})`);
            responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        } else if (aiProvider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${aiApiKey}`
                },
                body: JSON.stringify({
                    model: 'gpt-4o-mini',
                    temperature,
                    max_tokens: maxOutputTokens,
                    messages: [{ role: 'user', content: promptText }],
                    ...(responseMimeType === 'application/json'
                        ? { response_format: { type: 'json_object' } }
                        : {})
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `OpenAI request failed (${res.status})`);
            responseText = data?.choices?.[0]?.message?.content || '';
        } else {
            throw new Error("Provider not fully implemented yet.");
        }

        stampAiRuntimeState({
            status: 'CONNECTED',
            lastLatencyMs: Date.now() - startedAt,
            lastResponsePreview: String(responseText || '').slice(0, 260)
        });
        return responseText || 'No response returned by provider.';
    } catch (error) {
        stampAiRuntimeState({
            status: classifyAiRuntimeStatus(error && error.message),
            lastError: error && error.message ? error.message : 'Unknown AI error',
            lastLatencyMs: Date.now() - startedAt
        });
        throw error;
    }
}

function spinContainsFace(spin, faceId) {
    if (!spin || !Number.isInteger(faceId)) return false;
    const mask = Object.prototype.hasOwnProperty.call(FON_MASK_MAP, spin.num) ? FON_MASK_MAP[spin.num] : 0;
    return (mask & FACE_MASKS[faceId]) !== 0;
}

function updateAiFusionSnapshot(aiSignal = currentNeuralSignal) {
    const mathSignal = engineSnapshot && engineSnapshot.currentPrediction ? engineSnapshot.currentPrediction : null;
    let stance = 'NO_EDGE';
    let summary = 'No active AI or math edge.';
    let mathAssessment = aiSignal && aiSignal.mathAssessment ? aiSignal.mathAssessment : 'IGNORE';
    let tableState = aiSignal && aiSignal.tableState ? aiSignal.tableState : 'UNKNOWN';

    if (aiSignal && aiSignal.targetFace && mathSignal) {
        if (mathAssessment === 'AGREE') {
            stance = 'SYNCED';
            summary = 'AI confirms engine logic.';
        } else if (mathAssessment === 'DISAGREE') {
            stance = 'DIVERGENT';
            summary = `AI overriding math. (Table: ${tableState})`;
        } else {
            stance = 'NEUTRAL';
            summary = `AI forming independent read. (Table: ${tableState})`;
        }
    } else if (aiSignal && aiSignal.targetFace) {
        stance = 'AI_ONLY';
        summary = `AI acting without hard math trigger. (Table: ${tableState})`;
    } else if (aiSignal && aiSignal.status === 'SIT_OUT') {
        if (mathSignal) {
            stance = 'AI_VETO';
            summary = `AI vetoed math logic. (Table: ${tableState})`;
        } else {
            stance = 'MUTUAL_WAIT';
            summary = `AI & Math both see noise. (Table: ${tableState})`;
        }
    } else if (mathSignal) {
        stance = 'MATH_ONLY';
        summary = 'Engine waiting for AI confirmation...';
    }

    lastAiFusionSnapshot = { stance, summary, mathSignal, aiSignal, mathAssessment, tableState };
    renderAiFusionPanel();
}


function recordAiSignalInLedger(signal) {
    if (!signal || signal.signalSource !== 'ai' || !signal.targetFace) return;

    const existing = aiSignalLedger[0];
    if (existing &&
        existing.issuedAfterSpin === history.length &&
        existing.comboLabel === signal.comboLabel &&
        existing.targetFace === signal.targetFace) {
        return;
    }

    aiSignalLedger.unshift({
        id: Date.now() + Math.random(),
        issuedAfterSpin: history.length,
        comboLabel: signal.comboLabel || 'NONE',
        targetFace: signal.targetFace,
        mode: signal.mode || 'WAIT',
        confidence: Number.isFinite(signal.confidence) ? signal.confidence : 0,
        reason: signal.reason || signal.subtitle || '',
        stance: lastAiFusionSnapshot ? lastAiFusionSnapshot.stance : 'UNKNOWN',
        provider: aiProvider,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        outcome1: null,
        outcome3: null,
        outcome5: null
    });

    if (aiSignalLedger.length > 40) {
        aiSignalLedger = aiSignalLedger.slice(0, 40);
    }
}

function settleAiSignalLedger() {
    aiSignalLedger.forEach(entry => {
        [1, 3, 5].forEach(horizon => {
            const key = `outcome${horizon}`;
            if (entry[key] !== null) return;
            if (history.length < entry.issuedAfterSpin + horizon) return;

            let hit = false;
            for (let index = entry.issuedAfterSpin; index < entry.issuedAfterSpin + horizon; index++) {
                if (spinContainsFace(history[index], entry.targetFace)) {
                    hit = true;
                    break;
                }
            }
            entry[key] = hit ? 'HIT' : 'MISS';
        });
    });
}

function refreshAdvancementStates() {
    advancementLog = advancementLog.map(entry => ({
        ...entry,
        state: history.length - entry.spin >= 5 ? 'expired' : 'active'
    }));
}

function buildPredictionLogSignal(signal) {
    return {
        patternName: signal.patternName || AI_TAKEOVER_PATTERN,
        signalSource: signal.signalSource || 'math',
        targetFace: Number.isInteger(signal.targetFace) ? signal.targetFace : null,
        comboLabel: signal.comboLabel || null,
        confidence: Number.isFinite(signal.confidence) ? signal.confidence : null,
        reason: signal.reason || signal.subtitle || '',
        mode: signal.mode || null,
        status: signal.status || 'GO'
    };
}

function updateNeuralPredictionUi() {
    const btn = document.getElementById('neuralModeToggle');
    const knob = document.getElementById('neuralKnob');
    const takeoverSwitch = document.getElementById('aiTakeoverSwitch');
    const takeoverKnob = document.getElementById('aiTakeoverKnob');
    const takeoverStatus = document.getElementById('aiTakeoverStatus');

    const applySwitchState = (switchBtn, switchKnob) => {
        if (!switchBtn || !switchKnob) return;
        if (neuralPredictionEnabled) {
            switchBtn.classList.replace('bg-white/10', 'bg-[#bf5af2]/20');
            switchBtn.classList.replace('border-white/20', 'border-[#bf5af2]/50');
            switchKnob.classList.replace('bg-gray-400', 'bg-[#bf5af2]');
            switchKnob.style.transform = 'translateX(20px)';
        } else {
            switchBtn.classList.replace('bg-[#bf5af2]/20', 'bg-white/10');
            switchBtn.classList.replace('border-[#bf5af2]/50', 'border-white/20');
            switchKnob.classList.replace('bg-[#bf5af2]', 'bg-gray-400');
            switchKnob.style.transform = 'translateX(0)';
        }
    };

    applySwitchState(btn, knob);
    applySwitchState(takeoverSwitch, takeoverKnob);

    if (takeoverStatus) {
        if (neuralPredictionEnabled) {
            takeoverStatus.innerText = 'AI LIVE';
            takeoverStatus.className = 'text-[9px] font-black bg-[#bf5af2]/20 px-2.5 py-1 rounded-md text-[#bf5af2] shadow-inner';
        } else if (aiEnabled && aiApiKey) {
            takeoverStatus.innerText = 'MATH';
            takeoverStatus.className = 'text-[9px] font-black bg-white/10 px-2.5 py-1 rounded-md text-white/70 shadow-inner';
        } else {
            takeoverStatus.innerText = 'OFF';
            takeoverStatus.className = 'text-[9px] font-black bg-white/10 px-2.5 py-1 rounded-md text-white/40 shadow-inner';
        }
    }
}

function toggleAiPredictionTakeover(forceState = null) {
    const nextState = typeof forceState === 'boolean' ? forceState : !neuralPredictionEnabled;
    if (nextState && (!aiEnabled || !aiApiKey)) {
        alert("Please enable AI and configure your API key first.");
        return;
    }

    neuralPredictionEnabled = nextState;
    updateNeuralPredictionUi();

    if (neuralPredictionEnabled) {
        void requestNeuralPrediction({ force: true });
    } else {
        neuralPredictionRequestId++;
        currentNeuralSignal = null;
        aiPredictionCacheKey = '';
        aiPredictionCacheSignal = null;
        aiPredictionInFlight = null;
        window.currentAlerts = [];
        updateAiFusionSnapshot(null);
        void refreshPredictionEngineUI();
    }

    saveSessionData();
}

function toggleNeuralPrediction() {
    toggleAiPredictionTakeover();
}

async function requestNeuralPrediction(options = {}) {
    if (!neuralPredictionEnabled || !aiEnabled || !aiApiKey) return;

    const renderDashboardNow = options.renderDashboardNow !== false;
    const force = options.force === true;
    const cacheKey = `${history.slice(-80).map(s => s.num).join(',')}|${Object.values(faceGaps).join('-')}|${engineStats.netUnits}`;

    const applyAiSignal = (signal) => {
        currentNeuralSignal = signal;
        updateAiFusionSnapshot(signal);
        if (signal && signal.targetFace && signal.status !== 'SIT_OUT') {
            activeBets = [signal];
            window.currentAlerts = [{
                type: 'AI',
                patternName: AI_TAKEOVER_PATTERN,
                targetFace: signal.targetFace,
                comboLabel: signal.comboLabel,
                accentColor: signal.accentColor,
                signalKind: 'ai-takeover'
            }];
            recordAiSignalInLedger(signal);
        } else {
            activeBets = [];
            window.currentAlerts = [];
        }
        if (renderDashboardNow) {
            renderDashboard(window.currentAlerts || []);
            refreshHighlights();
            if (!document.getElementById('analyticsModal').classList.contains('hidden')) renderAnalytics();
        }
        saveSessionData();
        return signal;
    };

    if (!force && aiPredictionCacheKey === cacheKey && aiPredictionCacheSignal) {
        return applyAiSignal({ ...aiPredictionCacheSignal });
    }

    if (!force && aiPredictionInFlight && aiPredictionInFlight.key === cacheKey) {
        return aiPredictionInFlight.promise;
    }

    const requestId = ++neuralPredictionRequestId;
    const prompt = buildAiTakeoverPrompt();

    const predictionPromise = (async () => {
        try {
            const responseText = await requestAiText(prompt, {
                requestMode: 'prediction-takeover',
                temperature: 0.18,
                maxOutputTokens: 260,
                responseMimeType: 'application/json',
                responseSchema: getAiTakeoverSchema()
            });
            let jsonResponse;
            try {
                jsonResponse = extractAiJsonPayload(responseText);
            } catch (parseError) {
                console.warn('AI takeover JSON parse fallback engaged', parseError);
                jsonResponse = salvageAiTakeoverPayload(responseText);
            }
            const targetFace = Number(jsonResponse.targetFace);
            const status = String(jsonResponse.status || 'SIT_OUT').trim().toUpperCase().replace(/\s+/g, '_');
            const comboLabel = String(jsonResponse.combo || 'NONE').toUpperCase();
            const mode = String(jsonResponse.mode || 'WAIT').trim().toUpperCase().replace(/\s+/g, '_');
            const confidence = Math.max(0, Math.min(100, Math.round(Number(jsonResponse.confidence) || 0)));
            const reason = String(jsonResponse.reason || 'No tactical reason returned.').trim();
            const mathAssessment = String(jsonResponse.mathAssessment || 'IGNORE').trim().toUpperCase().replace(/\s+/g, '_');
            const tableState = String(jsonResponse.tableState || 'CHOPPY').trim().toUpperCase().replace(/\s+/g, '_');
            const normalizedTargetFace = Number.isInteger(targetFace) && targetFace >= 1 && targetFace <= 5 ? targetFace : null;

            if (requestId !== neuralPredictionRequestId || !neuralPredictionEnabled) return currentNeuralSignal;

            const signal = {
                signalSource: 'ai',
                patternName: AI_TAKEOVER_PATTERN,
                filterKey: AI_TAKEOVER_PATTERN,
                strategy: AI_TAKEOVER_PATTERN,
                targetFace: status === 'SIT_OUT' ? null : normalizedTargetFace,
                accentColor: '#bf5af2',
                subtitle: `${mode} | MATH: ${mathAssessment}${confidence ? ` • ${confidence}%` : ''}`,
                reason,
                confidence,
                confirmed: false,
                comboLabel,
                mode,
                mathAssessment,
                tableState,
                status
            };

            aiPredictionCacheKey = cacheKey;
            aiPredictionCacheSignal = { ...signal };
            return applyAiSignal(signal);
        } catch (error) {
            console.error("Neural Prediction Failed", error);
            if (requestId !== neuralPredictionRequestId) return currentNeuralSignal;

            aiPredictionCacheKey = cacheKey;
            aiPredictionCacheSignal = {
                signalSource: 'ai',
                patternName: AI_TAKEOVER_PATTERN,
                targetFace: null,
                accentColor: '#bf5af2',
                subtitle: 'SIT OUT',
                reason: (error && error.message ? error.message : 'AI link failed').slice(0, 160),
                confidence: 0,
                confirmed: false,
                comboLabel: 'NONE',
                mode: 'WAIT',
                mathAssessment: 'IGNORE',
                tableState: 'CHOPPY',
                status: 'SIT_OUT'
            };
            return applyAiSignal({ ...aiPredictionCacheSignal });
        } finally {
            if (aiPredictionInFlight && aiPredictionInFlight.key === cacheKey) {
                aiPredictionInFlight = null;
            }
        }
    })();

    aiPredictionInFlight = {
        key: cacheKey,
        promise: predictionPromise
    };

    return predictionPromise;
}

function adjustPredictionPerimeterWindow(delta) {
    const parsedDelta = parseInt(delta, 10);
    if (Number.isNaN(parsedDelta) || parsedDelta === 0) return;

    const nextWindow = Math.max(2, Math.min(60, predictionPerimeterWindow + parsedDelta));
    if (nextWindow === predictionPerimeterWindow) return;

    predictionPerimeterWindow = nextWindow;
    updatePredictionSettingsUI();
    void refreshPredictionEngineUI();
}

function setPerimeterWindow(val) {
    const nextWindow = parseInt(val, 10);
    if (isNaN(nextWindow) || nextWindow < 2 || nextWindow > 60) return;
    if (nextWindow === predictionPerimeterWindow) return;

    predictionPerimeterWindow = nextWindow;

    updatePredictionSettingsUI();
    void refreshPredictionEngineUI();
}

function renderFilterMenu() {
    const list = document.getElementById('patternsList');
    if (!list) return;

    const activeStrat = window.StrategyRegistry && window.StrategyRegistry[currentGameplayStrategy];
    const PATTERN_FILTER_META = (activeStrat && activeStrat.PATTERN_FILTER_META) || PATTERN_FILTER_META_COMBO;
    const entries = Object.keys(patternConfig).map(key => {
        const meta = PATTERN_FILTER_META[key] || {
            label: key,
            hint: 'No description configured yet.',
            icon: 'fa-sliders-h',
            accent: '#8E8E93'
        };
        const isEnabled = patternConfig[key] !== false;
        return `
            <div class="pattern-filter-card ${isEnabled ? 'pattern-filter-card-on' : 'pattern-filter-card-off'}"
                 style="--pattern-accent:${meta.accent};">
                <div class="pattern-filter-title">${meta.label}</div>
                <button class="pattern-filter-switch ${isEnabled ? 'pattern-filter-switch-on' : 'pattern-filter-switch-off'}"
                        onclick="event.stopPropagation(); togglePatternFilter('${key}')"
                        aria-label="Toggle ${meta.label}">
                    <span class="pattern-filter-switch-knob"></span>
                </button>
            </div>
        `;
    });

    list.innerHTML = entries.join('');
    syncPatternFilterButton();
}

function togglePatternFilter(key, isChecked = null) {
    const nextState = typeof isChecked === 'boolean' ? isChecked : patternConfig[key] === false;
    patternConfig[key] = nextState;
    if (key === PERIMETER_RULE_KEY) {
        perimeterRuleEnabled = nextState;
    }
    renderFilterMenu();
    void refreshPredictionEngineUI();
}

function updateVisibility() {
    // 1. Re-render Dashboard (Cards)
    renderDashboard(window.currentAlerts || []);

    // 2. Re-render History Table (Rows)
    reRenderHistory();

    // 3. Update Analytics if visible
    if (!document.getElementById('analyticsModal').classList.contains('hidden')) {
        renderAnalytics();
    }
}

function reRenderHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    history.forEach(spin => renderRow(spin));
    requestAnimationFrame(layoutAllComboBridges);
}

function handleGridClick(n) {
    document.getElementById('spinInput').value = n;
    void addSpin();
}

function enqueueSpin(spinValue, options = {}) {
    const val = parseInt(spinValue, 10);
    if (Number.isNaN(val) || val < 0 || val > 36) return Promise.resolve([]);

    spinProcessingQueue = spinProcessingQueue
        .catch(error => {
            console.error('Spin processing failed', error);
            return [];
        })
        .then(() => processSpinValue(val, options));

    return spinProcessingQueue;
}

function addSpin() {
    const input = document.getElementById('spinInput');
    if (!input) return;
    const raw = input.value.trim();
    const val = parseInt(raw, 10);

    // Validate range 0-36
    if (raw === '' || Number.isNaN(val) || val < 0 || val > 36) {
        // Shake and clear
        input.value = '';
        input.classList.remove('input-shake');
        void input.offsetWidth; // reflow
        input.classList.add('input-shake');
        input.focus();
        return;
    }

    input.value = '';
    input.focus();
    return enqueueSpin(val);
}

async function undoSpin() {
    if (history.length === 0) return;
    
    // 1. Remove the last spin
    history.pop();
    
    // 2. Clone the remaining spins to rebuild state
    const remainingSpins = history.map(s => s.num);
    
    // 3. Reset the core state
    resetData(true);
    
    // 4. Re-run all remaining spins silently
    const inputField = document.getElementById('spinInput');
    if (inputField) inputField.disabled = true;

    for (let i = 0; i < remainingSpins.length; i++) {
        await processSpinValue(remainingSpins[i], { silent: true, preserveInput: true });
    }

    if (inputField) inputField.disabled = false;

    // 5. Re-render everything
    const historyBody = document.getElementById('historyBody');
    if (historyBody) {
        historyBody.innerHTML = '';
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < history.length; i++) {
            renderRow(history[i], fragment);
        }
        historyBody.appendChild(fragment);
        requestAnimationFrame(layoutAllComboBridges);
    }

    renderGapStats();
    await syncPredictionEngine();
    await scanAllStrategies();
    renderDashboard(window.currentAlerts || []);
    renderAnalytics();
    updatePerimeterAnalytics();
    updateAnalyticsHUD();
    updateVisibility();
    refreshHighlights();
    saveSessionData();
}

// Global Ctrl+Z / Cmd+Z Support
document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        undoSpin();
    }
});

async function processSpinValue(val, options = {}) {
    // Animate the Plus Icon on Add
    const btn = cachedAddSpinBtn || document.getElementById('addSpinBtn');
    if (btn && !options.silent) {
        const icon = btn.querySelector('.fa-plus');
        if (icon) {
            icon.classList.remove('animate-spin-pop');
            void icon.offsetWidth; // Force reflow
            icon.classList.add('animate-spin-pop');
        }
    }

    const matchedFaces = Object.prototype.hasOwnProperty.call(FON_MAP, val)
        ? FON_MAP[val].slice()
        : [];
    const matchedFaceMask = Object.prototype.hasOwnProperty.call(FON_MASK_MAP, val)
        ? FON_MASK_MAP[val]
        : 0;

    // Update Gaps for ALL matching faces
    for (let f = 1; f <= 5; f++) faceGaps[f]++;
    matchedFaces.forEach(f => faceGaps[f] = 0);
    renderGapStats();

    const currentSpinIndex = history.length;

    // 1. RESOLVE PREVIOUS BETS
    // We calculate results here and store them as raw data, NOT HTML
    let resolvedBets = [];

    if (activeBets.length > 0) {
        activeBets.forEach(bet => {
            const isWin = (matchedFaceMask & FACE_MASKS[bet.targetFace]) !== 0;
            let label = `BET F${bet.targetFace}`;

            let count = 0;
            if (FACES[bet.targetFace]) {
                count = FACES[bet.targetFace].nums.length;
            }

            let unitChange = isWin ? (35 - count) : -count;

            let statsName = bet.patternName;
            let stratKey = bet.filterKey || bet.patternName;

            // Update Engine Stats
            updateEngineStats(isWin, statsName, unitChange, bet.strategy, bet.patternName, currentSpinIndex, val);

            if (bet.confirmed) {
                updateUserStats(isWin, bet, currentSpinIndex, unitChange);
            }

            // Store Data Object
            resolvedBets.push({
                patternName: bet.patternName, // Display Name
                filterKey: stratKey,          // Key for patternConfig
                targetFace: bet.targetFace,
                isWin: isWin,
                label: label,
                comboLabel: bet.comboLabel || null,
                confidence: Number.isFinite(bet.confidence) ? bet.confidence : null,
                reason: bet.reason || bet.subtitle || '',
                mode: bet.mode || null,
                status: bet.status || 'GO',
                signalSource: bet.signalSource || 'math'
            });
        });
        activeBets = [];
    }

    // 1b. RESOLVE BACKGROUND BETS (non-active strategies: stats only, no UI)
    const registry = window.StrategyRegistry || {};
    for (const stratKey of Object.keys(registry)) {
        if (stratKey === currentGameplayStrategy) continue; // already handled above
        const bgBets = backgroundBets[stratKey] || [];
        if (bgBets.length === 0) continue;
        bgBets.forEach(bet => {
            const isWin = (matchedFaceMask & FACE_MASKS[bet.targetFace]) !== 0;
            const count = FACES[bet.targetFace] ? FACES[bet.targetFace].nums.length : 0;
            const unitChange = isWin ? (35 - count) : -count;
            // Record in engineStats silently — no user stats, no display
            updateEngineStats(isWin, bet.patternName, unitChange, bet.strategy, bet.patternName, currentSpinIndex, val);
        });
        backgroundBets[stratKey] = [];
    }

    // 2. ADD TO HISTORY
    const spinObj = {
        num: val,
        faces: matchedFaces, // Store array of matching faces
        index: currentSpinIndex,
        resolvedBets: resolvedBets, // Store results
        newSignals: [],             // Placeholder for signals generated this turn
        id: ++globalSpinIdCounter
    };
    history.push(spinObj);
    settleAiSignalLedger();
    refreshAdvancementStates();

    // 3. SCAN FOR NEW PATTERNS
    let alerts = await scanAllStrategies();

    if (neuralPredictionEnabled) {
        await requestNeuralPrediction({ renderDashboardNow: false });
        alerts = window.currentAlerts || [];
    }

    // 4. PREPARE NEW SIGNALS FOR DISPLAY (Next Spin's Bets)
    // These are what show up on the dashboard, but we also want to show them in the table row
    if (neuralPredictionEnabled && currentNeuralSignal) {
        spinObj.newSignals = [buildPredictionLogSignal(currentNeuralSignal)];
    } else if (activeBets.length > 0) {
        spinObj.newSignals = activeBets.map(b => ({
            patternName: b.patternName,
            filterKey: b.filterKey || b.patternName,
            targetFace: b.targetFace,
            comboLabel: b.comboLabel || null,
            confidence: Number.isFinite(b.confidence) ? b.confidence : null,
            reason: b.reason || b.subtitle || '',
            mode: b.mode || null,
            status: b.status || 'GO',
            signalSource: b.signalSource || 'math'
        }));
    }

    if (!options.silent) {
        renderRow(spinObj);
        renderDashboard(alerts);

        if (!document.getElementById('analyticsModal').classList.contains('hidden')) renderAnalytics();
        if (!document.getElementById('betsModal').classList.contains('hidden')) renderUserAnalytics();

        // Update FON tracker in Patterns modal
        updatePerimeterAnalytics();
        updateAnalyticsHUD();

        refreshHighlights();
    }

    if (!options.preserveInput && input) {
        input.value = '';
        input.focus();
    }
    
    if (!options.silent) {
        saveSessionData();
    }

    return alerts;
}

function updateEngineStats(isWin, patternName, unitChange, rawStrategy, rawPattern, spinIndex, spinNum) {
    if (isWin) {
        engineStats.totalWins++;
        engineStats.currentStreak = engineStats.currentStreak >= 0 ? engineStats.currentStreak + 1 : 1;
    } else {
        engineStats.totalLosses++;
        engineStats.currentStreak = engineStats.currentStreak <= 0 ? engineStats.currentStreak - 1 : -1;
    }
    engineStats.netUnits += unitChange;
    engineStats.bankrollHistory.push(engineStats.netUnits);

    if (!engineStats.patternStats[patternName]) {
        engineStats.patternStats[patternName] = { wins: 0, losses: 0 };
    }
    if (isWin) engineStats.patternStats[patternName].wins++;
    else engineStats.patternStats[patternName].losses++;

    engineStats.signalLog.push({
        result: isWin ? 'WIN' : 'LOSS',
        units: unitChange,
        patternName: patternName,
        rawStrategy: rawStrategy,
        rawPattern: rawPattern,
        spinIndex: spinIndex,
        spinNum: spinNum
    });
}

function checkFatigue(patternName) {
    const currentSpin = history.length;
    const windowStart = Math.max(0, currentSpin - 50);

    const recentSignals = engineStats.signalLog.filter(s =>
        s.patternName === patternName && s.spinIndex >= windowStart
    );

    if (recentSignals.length < 3) return false;

    const wins = recentSignals.filter(s => s.result === 'WIN').length;
    const hitRate = wins / recentSignals.length;

    return (hitRate < 0.20);
}

function updateUserStats(isWin, bet, spinIndex, unitChange) {
    if (isWin) {
        userStats.totalWins++;
    } else {
        userStats.totalLosses++;
    }
    userStats.netUnits += unitChange;
    userStats.bankrollHistory.push(userStats.netUnits);

    userStats.betLog.unshift({
        id: userStats.totalWins + userStats.totalLosses,
        pattern: bet.patternName,
        target: `F${bet.targetFace}`,
        result: isWin ? 'WIN' : 'LOSS',
        spinNum: spinIndex + 1,
        units: unitChange
    });
}
function renderAnalytics() {
    let displayStats = {
        wins: 0, losses: 0, net: 0, streak: 0,
        history: [0], patterns: {} 
    };

    const targetStrategy = analyticsDisplayStrategy === 'series' ? 'Sequence' : 'TripleCs';

    // Only count stats for the currently active analytics strategy
    engineStats.signalLog.forEach(log => {
        if (log.rawStrategy === targetStrategy) {
            if (log.result === 'WIN') {
                displayStats.wins++;
                displayStats.streak = displayStats.streak >= 0 ? displayStats.streak + 1 : 1;
            } else {
                displayStats.losses++;
                displayStats.streak = displayStats.streak <= 0 ? displayStats.streak - 1 : -1;
            }
            displayStats.net += log.units;
            displayStats.history.push(displayStats.net);

            if (!displayStats.patterns[log.patternName]) {
                displayStats.patterns[log.patternName] = { wins: 0, losses: 0 };
            }
            if (log.result === 'WIN') displayStats.patterns[log.patternName].wins++;
            else displayStats.patterns[log.patternName].losses++;
        }
    });

    const totalSignals = displayStats.wins + displayStats.losses;
    const hitRate = totalSignals === 0 ? 0 : Math.round((displayStats.wins / totalSignals) * 100);

    const hrEl = document.getElementById('kpiHitRate');
    if (hrEl) {
        hrEl.innerText = hitRate + "%";
        hrEl.className = `text-3xl font-bold tracking-tight ${hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;
    }

    const netEl = document.getElementById('kpiNet');
    if (netEl) {
        netEl.innerText = (displayStats.net > 0 ? '+' : '') + displayStats.net;
        netEl.className = `text-3xl font-bold tracking-tight ${displayStats.net >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;
    }

    const sigsEl = document.getElementById('kpiSignals');
    if (sigsEl) sigsEl.innerText = totalSignals;

    const s = displayStats.streak;
    const formEl = document.getElementById('kpiForm');
    if (formEl) {
        formEl.innerText = s > 0 ? `W${s}` : (s < 0 ? `L${Math.abs(s)}` : '-');
        formEl.className = `text-3xl font-bold tracking-tight ${s > 0 ? 'text-[#30D158]' : (s < 0 ? 'text-[#FF453A]' : 'text-gray-400')}`;
    }

    drawAdvancedGraph(displayStats.history, displayStats.wins, displayStats.losses, 'graphContainer');
    updatePatternHeatmap(displayStats.patterns);
}

function setAnalyticsDisplayStrategy(strategy) {
    if (analyticsDisplayStrategy === strategy) return;
    
    analyticsDisplayStrategy = strategy;
    
    const seriesBtn = document.getElementById('analyticsBtnSeries');
    const comboBtn = document.getElementById('analyticsBtnCombo');
    const bgPill = document.getElementById('analyticsTogglePillBg');
    
    if (seriesBtn && comboBtn) {
        if (strategy === 'series') {
            seriesBtn.classList.replace('text-gray-400', 'text-[#30D158]');
            comboBtn.classList.replace('text-[#30D158]', 'text-gray-400');
            if (bgPill) bgPill.style.transform = 'translateX(0)';
        } else {
            comboBtn.classList.replace('text-gray-400', 'text-[#30D158]');
            seriesBtn.classList.replace('text-[#30D158]', 'text-gray-400');
            if (bgPill) bgPill.style.transform = 'translateX(100%)';
        }
    }
    
    renderAnalytics();
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
        const rA = a[1].wins / (a[1].wins + a[1].losses);
        const rB = b[1].wins / (b[1].wins + b[1].losses);
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
                        <button onclick="event.stopPropagation(); openPatternLog('${name}')" class="text-[#8E8E93] hover:text-white cursor-pointer px-2 py-1 rounded-full hover:bg-white/10 transition-colors" title="View Log">
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

function openPatternLog(patternName) {
    const logs = engineStats.signalLog.filter(s => s.patternName === patternName);
    logs.sort((a, b) => a.spinIndex - b.spinIndex);
    
    let runningROI = 0;
    let lastIndex = -1;
    
    let displayLogs = logs.map((log, i) => {
        runningROI += log.units;
        let gap = (i === 0) ? 0 : (log.spinIndex - lastIndex);
        lastIndex = log.spinIndex;
        return { ...log, gap, roi: runningROI };
    });
    
    displayLogs.sort((a, b) => b.spinIndex - a.spinIndex);
    
    const tbody = document.getElementById('patternDetailBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (displayLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-[#8E8E93] italic">No signals recorded yet</td></tr>';
    } else {
        displayLogs.forEach(log => {
            let badgeClass = '';
            if (log.spinNum === 0) badgeClass = 'bg-[#30d158]/20 text-[#30d158] border-[#30d158]/30'; 
            else if (RED_NUMS.includes(log.spinNum)) badgeClass = 'bg-[#ff453a]/20 text-[#ff453a] border-[#ff453a]/30'; 
            else badgeClass = 'bg-[#3a3a3c] text-gray-200 border-white/10'; 
            
            const isWin = log.result === 'WIN';
            const resClass = isWin ? 'text-[#30D158]' : 'text-[#FF453A]';
            const unitClass = log.units > 0 ? 'text-[#30D158]' : 'text-[#FF453A]';
            const roiClass = log.roi >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]';
            const unitSign = log.units > 0 ? '+' : '';
            const roiSign = log.roi > 0 ? '+' : '';
            
            tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-xs">
                    <td class="p-3 text-[#8E8E93] font-mono">#${log.spinIndex + 1}</td>
                    <td class="p-3 text-center">
                        <span class="inline-block w-8 h-6 flex items-center justify-center rounded-md border ${badgeClass} font-bold mx-auto border-opacity-50">
                            ${log.spinNum}
                        </span>
                    </td>
                    <td class="p-3 text-center text-gray-400 font-mono">${log.gap}</td>
                    <td class="p-3 text-center font-bold ${resClass}">${log.result}</td>
                    <td class="p-3 text-right font-mono font-bold ${unitClass}">${unitSign}${log.units}</td>
                    <td class="p-3 text-right font-mono font-bold ${roiClass}">${roiSign}${log.roi}</td>
                </tr>
            `;
        });
    }

    const titleEl = document.getElementById('patternDetailTitle');
    if (titleEl) titleEl.innerText = `LOG: ${escapeAiMarkup(patternName)}`;
    const modal = document.getElementById('patternDetailModal');
    if (modal) modal.classList.remove('hidden');
}

// Ensure obsolete Intelligence functions don't throw errors
function renderIntelligencePanel() {}
function renderAdvancementLog() {}
function renderAiFusionPanel() {}
function renderAiLedger() {}
function renderAiDebugPanel() {}


function renderGapStats() {
    const container = document.getElementById('faceGapContainer');
    if (!container) return;

    container.innerHTML = '';
    for (let f = 1; f <= 5; f++) {
        const gap = faceGaps[f];
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
}

function renderUserAnalytics() {
    const totalBets = userStats.totalWins + userStats.totalLosses;
    const hitRate = totalBets === 0 ? 0 : Math.round((userStats.totalWins / totalBets) * 100);

    const netEl = document.getElementById('userNet');
    netEl.innerText = (userStats.netUnits > 0 ? '+' : '') + userStats.netUnits;
    netEl.className = `text-5xl font-bold tracking-tight ${userStats.netUnits >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;

    document.getElementById('userHitRate').innerText = hitRate + "%";
    document.getElementById('userTotal').innerText = totalBets;

    drawAdvancedGraph(userStats.bankrollHistory, userStats.totalWins, userStats.totalLosses, 'userGraphContainer');
    updateUserBetLog();
}

function drawAdvancedGraph(historyArray, winCount, lossCount, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.className = "flex flex-col h-full w-full rounded-b-xl overflow-hidden relative";

    const chartDiv = document.createElement('div');
    chartDiv.className = "relative h-[80%] w-full bg-black/20 group";
    container.appendChild(chartDiv);

    // HUD
    const hudDiv = document.createElement('div');
    hudDiv.className = "h-[20%] w-full flex justify-between items-center px-4 text-[10px] font-bold bg-white/5 border-t border-white/5 backdrop-blur-sm z-10 relative";
    hudDiv.innerHTML = `
        <span class="text-[#4ade80] drop-shadow-sm tracking-wide">WINS: ${winCount}</span>
        <span class="text-[#e5e7eb] drop-shadow-sm tracking-wide">SPINS: ${historyArray ? Math.max(0, historyArray.length - 1) : 0}</span>
        <span class="text-[#f87171] drop-shadow-sm tracking-wide">LOSSES: ${lossCount}</span>
    `;
    container.appendChild(hudDiv);

    // Dynamic Tooltip Div
    const tooltipId = `tooltip-${containerId}`;
    let tooltipEl = document.getElementById(tooltipId);
    if (!tooltipEl) {
        tooltipEl = document.createElement('div');
        tooltipEl.id = tooltipId;
        tooltipEl.className = "pointer-events-none absolute hidden z-50 rounded-lg py-2 px-3 bg-[#1c1c1e]/95 border border-white/10 shadow-2xl backdrop-blur-md transform -translate-x-1/2 -translate-y-[120%] flex-col items-center justify-center transition-opacity duration-150";
        container.appendChild(tooltipEl);
    }

    if (!historyArray || historyArray.length < 2) {
        chartDiv.innerHTML = `<div class="flex items-center justify-center h-full text-xs text-[#8E8E93] font-mono animate-pulse">Waiting for Data...</div>`;
        return;
    }

    // SVG Logic using Fixed ViewBox
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
    } else {
        zeroOffset = 0;
    }

    const svgContent = `
        <svg id="svg-${containerId}" viewBox="0 0 ${vWidth} ${vHeight}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;" class="cursor-crosshair absolute inset-0 z-0">
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
                  
            <!-- Interactive Elements -->
            <line id="trackerLine-${containerId}" x1="0" y1="0" x2="0" y2="200" stroke="white" stroke-width="1.5" opacity="0" stroke-dasharray="4 4" vector-effect="non-scaling-stroke" class="transition-opacity duration-150" />
            <circle id="trackerDot-${containerId}" cx="0" cy="0" r="4.5" fill="white" opacity="0" style="filter: drop-shadow(0 0 4px rgba(255,255,255,0.8));" class="transition-opacity duration-150" />
            
            <rect id="touchTarget-${containerId}" x="0" y="0" width="${vWidth}" height="${vHeight}" fill="transparent" />
        </svg>
    `;

    chartDiv.innerHTML = svgContent;

    // Attach 120Hz Hover Interactivity
    // Use requestAnimationFrame for smooth performance
    setTimeout(() => {
        const svgArea = document.getElementById(`svg-${containerId}`);
        const touchTarget = document.getElementById(`touchTarget-${containerId}`);
        const trackerLine = document.getElementById(`trackerLine-${containerId}`);
        const trackerDot = document.getElementById(`trackerDot-${containerId}`);
        
        if (!svgArea || !touchTarget) return;

        let ticking = false;
        let lastEvent = null;

        const updateTooltip = () => {
            if (!lastEvent) return;
            
            const rect = svgArea.getBoundingClientRect();
            let rawX = lastEvent.clientX - rect.left;
            let rawY = lastEvent.clientY - rect.top;
            
            const scaleX = vWidth / rect.width;
            let svgX = rawX * scaleX;
            
            if (svgX < padding) svgX = padding;
            if (svgX > vWidth - padding) svgX = vWidth - padding;

            const indexFloat = ((svgX - padding) / (vWidth - 2 * padding)) * (historyArray.length - 1);
            let closestIndex = Math.round(indexFloat);
            if (closestIndex < 0) closestIndex = 0;
            if (closestIndex >= historyArray.length) closestIndex = historyArray.length - 1;

            const snapX = getX(closestIndex);
            
            // Map snapX (which is Viewbox coordinates) back to absolute DOM coordinates for the tooltip div
            const domSnapX = (snapX / vWidth) * rect.width;
            
            const snapY = getY(historyArray[closestIndex]);
            const profitAtPoint = historyArray[closestIndex];

            trackerLine.setAttribute('x1', String(snapX));
            trackerLine.setAttribute('x2', String(snapX));
            trackerLine.setAttribute('opacity', '0.5');
            
            trackerDot.setAttribute('cx', String(snapX));
            trackerDot.setAttribute('cy', String(snapY));
            trackerDot.setAttribute('opacity', '1');

            const netColor = profitAtPoint >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]';
            const netSign = profitAtPoint > 0 ? '+' : '';
            
            tooltipEl.innerHTML = `
                <div class="text-[8px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">Spin #${closestIndex}</div>
                <div class="${netColor} font-bold text-sm tracking-tight leading-none">${netSign}${profitAtPoint} <span class="text-[9px] text-gray-500 uppercase">u</span></div>
            `;
            
            tooltipEl.classList.remove('hidden');
            tooltipEl.classList.add('flex');
            tooltipEl.style.left = `${domSnapX}px`;
            tooltipEl.style.top = `${Math.max(20, rawY)}px`;
            
            ticking = false;
        };

        const handleHover = (e) => {
            lastEvent = e;
            if (!ticking) {
                requestAnimationFrame(updateTooltip);
                ticking = true;
            }
        };

        const hideHover = () => {
            trackerLine.setAttribute('opacity', '0');
            trackerDot.setAttribute('opacity', '0');
            tooltipEl.classList.add('hidden');
            tooltipEl.classList.remove('flex');
        };

        touchTarget.addEventListener('mousemove', handleHover);
        touchTarget.addEventListener('mouseleave', hideHover);
    }, 50);
}

// Duplicate updatePatternHeatmap and openPatternLog removed - using definitions from lines ~2579-2682

function updateUserBetLog() {
    const tbody = document.getElementById('userBetsBody');
    tbody.innerHTML = '';

    if (userStats.betLog.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No confirmed bets yet</td></tr>';
        return;
    }

    userStats.betLog.forEach(log => {
        const resClass = log.result === 'WIN' ? 'text-[#30D158]' : 'text-[#FF453A]';
        const unitsText = log.units > 0 ? `+${log.units}` : log.units;
        tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <td class="p-3 text-[#8E8E93] font-mono text-xs">#${log.id}</td>
                    <td class="p-3 font-bold text-gray-200 tracking-wide">${escapeAiMarkup(log.pattern)}</td>
                    <td class="p-3 text-center font-bold text-white"><span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10 shadow-sm text-xs">F${log.target.replace('F', '')}</span></td>
                    <td class="p-3 text-right">
                        <span class="text-[9px] text-[#8E8E93] mr-2">Spin ${log.spinNum}</span>
                        <span class="font-bold ${resClass} text-sm drop-shadow-sm">${log.result} (${unitsText})</span>
                    </td>
                </tr>
            `;
    });
}

function toggleBetConfirmation(index) {
    if (activeBets[index]) {
        activeBets[index].confirmed = !activeBets[index].confirmed;
        renderDashboard(window.currentAlerts || []);
    }
}

function calculateDominantPerimeterCombo() {
    const stats = calculatePerimeterStats(history, predictionPerimeterWindow);
    if (!stats || !stats.dominantCombo) return null;

    const dominantCount = stats.counts[stats.dominantCombo.label] || 0;
    if (dominantCount <= 0) return null;

    return {
        ...stats.dominantCombo,
        count: dominantCount,
        counts: stats.counts,
        latestPrimaryFace: stats.sequence.length > 0 ? stats.sequence[stats.sequence.length - 1] : null
    };
}

async function scanAllStrategies() {
    return syncPredictionEngine();
}

function renderRow(spin, container = null) {
    const tr = document.createElement('tr');
    tr.className = "history-row relative hover:bg-white/[0.02] transition-colors";
    tr.id = 'row-' + spin.id;

    let bgClass = spin.num === 0 ? 'bg-green' : (RED_NUMS.includes(spin.num) ? 'bg-red' : 'bg-black');

    let faceHTML = '';
    if (spin.faces && spin.faces.length > 0) {
        let faceTags = spin.faces.map(fId => {
            let fStyle = FACES[fId];
            return `<span class="face-tag mb-1 mr-1" data-spin-id="${spin.id}" data-face-id="${fId}" style="color:${fStyle.color}; border:1px solid ${fStyle.border}; background:${fStyle.bg};">F${fId}</span>`;
        }).join('');
        faceHTML = `<div class="flex flex-wrap justify-center">${faceTags}</div>`;
    } else {
        faceHTML = `<span class="text-gray-600">-</span>`;
    }

    // COMBO COLUMN LOGIC
    let comboHTML = `<span class="text-gray-600">-</span>`;
    if (spin.index > 0) {
        const prevSpin = history[spin.index - 1];
        if (prevSpin) {
            let detectedCombo = null;
            let matchedPrevFace = null;
            let matchedCurrFace = null;
            const prevMask = Object.prototype.hasOwnProperty.call(FON_MASK_MAP, prevSpin.num) ? FON_MASK_MAP[prevSpin.num] : 0;
            const currMask = Object.prototype.hasOwnProperty.call(FON_MASK_MAP, spin.num) ? FON_MASK_MAP[spin.num] : 0;

            // Use active strategy's detectBridge via StrategyRegistry
            const activeStrategy = window.StrategyRegistry && window.StrategyRegistry[currentGameplayStrategy];
            if (activeStrategy && typeof activeStrategy.detectBridge === 'function') {
                const bridgeResult = activeStrategy.detectBridge(prevMask, currMask, FACE_MASKS);
                if (bridgeResult) {
                    detectedCombo = bridgeResult;
                    matchedPrevFace = bridgeResult.matchedPrevFace;
                    matchedCurrFace = bridgeResult.matchedCurrFace;
                }
            }

            if (detectedCombo) {
                // VISUAL COMBO BRIDGE: dynamically laid out from tag positions
                comboHTML = `
                    <div class="absolute inset-x-0 top-0 -translate-y-1/2 h-0 pointer-events-none select-none z-[1] flex items-center justify-center">
                        <div class="combo-link-layer absolute overflow-visible"
                             data-prev-spin-id="${prevSpin.id}"
                             data-prev-face="${matchedPrevFace}"
                             data-curr-face="${matchedCurrFace}"
                             data-color="${detectedCombo.color}"></div>
                        <div class="relative z-[2] inline-flex items-center justify-center">
                            <div class="absolute inset-0 rounded-lg blur-md opacity-45" style="background-color: ${detectedCombo.color};"></div>
                            <span class="combo-badge relative px-3 py-1 rounded-md text-[11px] font-black border border-white/10 shadow-lg tracking-wider"
                                  style="color: ${detectedCombo.color}; background-color: #0c0c0e; box-shadow: 0 0 10px ${detectedCombo.color}30;">
                                ${detectedCombo.label}
                            </span>
                        </div>
                    </div>
                `;
            }
        }
    }

    let predHTMLParts = [];
    if (spin.resolvedBets && spin.resolvedBets.length > 0) {
        spin.resolvedBets.forEach(bet => {
            let win = bet.isWin;
            let icon = win ? '<i class="fas fa-check-circle text-[#30D158] mr-1"></i>' : '<i class="fas fa-times-circle text-[#FF453A] mr-1"></i>';
            let status = win ? 'WIN' : 'LOSS';
            let colorClass = win ? 'text-[#30D158]' : 'text-[#FF453A]';
            const summary = bet.signalSource === 'ai'
                ? `${status}: ${bet.comboLabel || 'AI'}${bet.targetFace ? ` -> F${bet.targetFace}` : ''}${Number.isFinite(bet.confidence) ? ` • ${bet.confidence}%` : ''}`
                : `${status}: F${bet.targetFace} (${bet.patternName})`;
            predHTMLParts.push(`<div class="flex items-center text-[10px] font-bold ${colorClass}">${icon}${escapeAiMarkup(summary)}</div>`);
            if (bet.signalSource === 'ai' && bet.reason) {
                predHTMLParts.push(`<div class="ml-5 text-[9px] leading-relaxed text-white/45">${escapeAiMarkup(bet.reason)}</div>`);
            }
        });
    }

    if (spin.newSignals && spin.newSignals.length > 0) {
        spin.newSignals.forEach(signal => {
            if (signal.signalSource !== 'ai') return;

            const signalStatus = String(signal.status || 'GO').toUpperCase();
            const toneClass = signalStatus === 'SIT_OUT' ? 'text-[#FFD60A]' : 'text-[#bf5af2]';
            const icon = signalStatus === 'SIT_OUT'
                ? '<i class="fas fa-pause-circle mr-1"></i>'
                : '<i class="fas fa-brain mr-1"></i>';
            const signalLabel = signalStatus === 'SIT_OUT'
                ? `AI SIT OUT${signal.comboLabel && signal.comboLabel !== 'NONE' ? ` • ${signal.comboLabel}` : ''}`
                : `AI CALL: ${signal.comboLabel || 'READ'}${signal.targetFace ? ` -> F${signal.targetFace}` : ''}${Number.isFinite(signal.confidence) ? ` • ${signal.confidence}%` : ''}`;

            predHTMLParts.push(`<div class="mt-1 flex items-center text-[10px] font-bold ${toneClass}">${icon}${escapeAiMarkup(signalLabel)}</div>`);
            if (signal.reason) {
                predHTMLParts.push(`<div class="ml-5 text-[9px] leading-relaxed text-white/45">${escapeAiMarkup(signal.reason)}</div>`);
            }
        });
    }

    let finalHTML = predHTMLParts.length > 0 ? predHTMLParts.join('') : '<span class="text-gray-600">-</span>';

    tr.innerHTML = `
        <td class="text-center font-mono text-xs text-gray-400">#${spin.index + 1}</td>
        <td class="text-center"><div class="num-box ${bgClass}">${spin.num}</div></td>
        <td class="text-center relative z-[5]">${faceHTML}</td>
        <td class="text-center relative overflow-visible z-[1]">${comboHTML}</td>
        <td class="pl-4">${finalHTML}</td>
    `;
    
    if (container) {
        container.appendChild(tr);
    } else {
        const tbody = document.getElementById('historyBody');
        if (tbody) tbody.appendChild(tr);
        requestAnimationFrame(() => layoutComboBridge(spin.id));

        // Auto-scroll to bottom of the correct container
        const sc = document.querySelector('#scrollContainer > div');
        if (sc) {
            setTimeout(() => {
                sc.scrollTop = sc.scrollHeight;
            }, 50);
        }
    }
}

function layoutComboBridge(spinId) {
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

    const nextGeom = {
        p1: prevPoint,
        p2: currPoint,
        t: targetPoint,
        color: color
    };

    const prevGeom = layer._comboGeom || {
        p1: { ...targetPoint },
        p2: { ...targetPoint },
        t: { ...targetPoint },
        color: color
    };

    animateComboBridge(layer, prevGeom, nextGeom, 260);
    layer._comboGeom = nextGeom;
}

function layoutAllComboBridges() {
    // Only layout bridges that are currently visible on screen to save massive reflows
    if (history.length === 0) return;
    
    // Fallback: Just layout the last 50 to guarantee they appear without massive lag
    const startIndex = Math.max(0, history.length - 50);
    for (let i = startIndex; i < history.length; i++) {
        layoutComboBridge(history[i].id);
    }
}

function ensureComboBridgeElements(layer) {
    let svg = layer.querySelector('svg');
    if (!svg) {
        layer.innerHTML = `
            <svg class="overflow-visible">
                <path class="combo-path-1" fill="none" stroke-linecap="round" stroke-width="2.5" stroke-opacity="0.85" />
                <path class="combo-path-2" fill="none" stroke-linecap="round" stroke-width="2.5" stroke-opacity="0.85" />
                <circle class="combo-dot" r="2.5" />
            </svg>
        `;
        svg = layer.querySelector('svg');
    }

    return {
        svg,
        path1: layer.querySelector('.combo-path-1'),
        path2: layer.querySelector('.combo-path-2'),
        dot: layer.querySelector('.combo-dot')
    };
}

function drawComboBridge(layer, geom) {
    const { svg, path1, path2, dot } = ensureComboBridgeElements(layer);

    const minX = Math.min(geom.p1.x, geom.p2.x, geom.t.x) - 10;
    const maxX = Math.max(geom.p1.x, geom.p2.x, geom.t.x) + 6;
    const minY = Math.min(geom.p1.y, geom.p2.y, geom.t.y) - 12;
    const maxY = Math.max(geom.p1.y, geom.p2.y, geom.t.y) + 12;

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

    const c1x = p1.x + Math.max(12, Math.abs(t.x - p1.x) * 0.45);
    const c2x = p2.x + Math.max(12, Math.abs(t.x - p2.x) * 0.45);
    const cx = t.x - Math.max(10, Math.min(20, Math.abs(t.x - Math.min(p1.x, p2.x)) * 0.2));

    path1.setAttribute('d', `M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${cx} ${t.y}, ${t.x} ${t.y}`);
    path2.setAttribute('d', `M ${p2.x} ${p2.y} C ${c2x} ${p2.y}, ${cx} ${t.y}, ${t.x} ${t.y}`);
    path1.setAttribute('stroke', geom.color);
    path2.setAttribute('stroke', geom.color);

    dot.setAttribute('cx', t.x);
    dot.setAttribute('cy', t.y);
    dot.setAttribute('fill', geom.color);
}

function animateComboBridge(layer, fromGeom, toGeom, duration = 260) {
    if (layer._comboAnimFrame) {
        cancelAnimationFrame(layer._comboAnimFrame);
    }

    const startTime = performance.now();

    const easeInOutCubic = (x) => x < 0.5
        ? 4 * x * x * x
        : 1 - Math.pow(-2 * x + 2, 3) / 2;

    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = (now) => {
        const raw = Math.min(1, (now - startTime) / duration);
        const t = easeInOutCubic(raw);

        const geom = {
            p1: {
                x: lerp(fromGeom.p1.x, toGeom.p1.x, t),
                y: lerp(fromGeom.p1.y, toGeom.p1.y, t)
            },
            p2: {
                x: lerp(fromGeom.p2.x, toGeom.p2.x, t),
                y: lerp(fromGeom.p2.y, toGeom.p2.y, t)
            },
            t: {
                x: lerp(fromGeom.t.x, toGeom.t.x, t),
                y: lerp(fromGeom.t.y, toGeom.t.y, t)
            },
            color: toGeom.color
        };

        drawComboBridge(layer, geom);

        if (raw < 1) {
            layer._comboAnimFrame = requestAnimationFrame(tick);
        } else {
            layer._comboAnimFrame = null;
            layer._comboGeom = toGeom;
        }
    };

    layer._comboAnimFrame = requestAnimationFrame(tick);
}

function renderDashboard(alerts) {
    const dash = document.getElementById('dashboard');
    if (!dash) return;

    let cards = [];
    activeBets.forEach((bet, index) => {
        const filterKey = bet.filterKey || bet.patternName;
        if (patternConfig[filterKey] === false) return;

        const isAiSignal = bet.signalSource === 'ai';
        const subtitle = isAiSignal
            ? (bet.reason || bet.subtitle || 'AI rhythm read active.')
            : (bet.subtitle || (bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName));
        const accent = bet.accentColor || '#FF3B30';
        const title = isAiSignal
            ? `${bet.comboLabel || 'AI PLAY'}${bet.targetFace ? ` -> F${bet.targetFace}` : ''}`
            : `BET F${bet.targetFace}`;
        const metaLabel = isAiSignal
            ? `${String(bet.mode || 'READ').replace(/_/g, ' ')}${Number.isFinite(bet.confidence) ? ` • ${bet.confidence}%` : ''}`
            : '';

        // Dynamic styling based on combo color (Theme Matching)
        const bgStyle = bet.confirmed
            ? `background: linear-gradient(135deg, ${accent}50, ${accent}15)`
            : `background: linear-gradient(135deg, ${accent}25, ${accent}05)`;

        const borderStyle = bet.confirmed
            ? `border-color: ${accent}`
            : `border-color: ${accent}40`;

        cards.push(`
            <div class="min-w-[250px] h-[64px] px-3 py-2 rounded-lg border flex items-center justify-between cursor-pointer select-none transition-all hover:brightness-110"
                 ondblclick="toggleBetConfirmation(${index})"
                 title="Double-click to ${bet.confirmed ? 'unselect' : 'select'}"
                 style="border-left: 3px solid ${accent}; ${borderStyle}; ${bgStyle}; box-shadow: 0 4px 15px ${accent}15;">
                <div class="min-w-0">
                    <div class="text-[15px] leading-tight font-black text-white tracking-wide drop-shadow-sm">${escapeAiMarkup(title)}</div>
                    <div class="text-[11px] leading-tight text-white/80 font-semibold mt-0.5">${escapeAiMarkup(subtitle)}</div>
                </div>
                ${metaLabel ? `<div class="ml-3 shrink-0 rounded-md border border-white/10 bg-black/25 px-2 py-1 text-[9px] font-black tracking-[0.14em] text-white/80">${escapeAiMarkup(metaLabel)}</div>` : ''}
            </div>
        `);
    });

    if (cards.length === 0) {
        if (neuralPredictionEnabled && currentNeuralSignal && currentNeuralSignal.status === 'SIT_OUT') {
            dash.innerHTML = `
                <div class="w-full h-[60px] rounded-xl border border-[#bf5af2]/20 bg-gradient-to-r from-[#bf5af2]/10 to-transparent px-4 py-2 flex items-center justify-between">
                    <div class="min-w-0">
                        <div class="text-[11px] font-black tracking-[0.16em] text-[#bf5af2] uppercase">AI Stand Down</div>
                        <div class="text-[10px] text-white/65 leading-tight mt-1">${escapeAiMarkup(currentNeuralSignal.reason || 'No clean combo edge right now.')}</div>
                    </div>
                    <div class="ml-3 shrink-0 rounded-md border border-[#bf5af2]/25 bg-black/25 px-2 py-1 text-[9px] font-black tracking-[0.14em] text-[#bf5af2]">SIT OUT</div>
                </div>
            `;
            return;
        }

        dash.innerHTML = `<div class="dashboard-empty w-full text-center text-[10px] font-medium text-[#8E8E93]/60 border border-dashed border-white/5 rounded-xl p-2 select-none tracking-wide flex items-center justify-center h-[60px]"><span>NO ACTIVE PREDICTIONS</span></div>`;
        return;
    }

    dash.innerHTML = cards.join('');
}

function refreshHighlights() {
    document.querySelectorAll('.highlight-pair').forEach(el => el.classList.remove('highlight-pair'));
    if (activeBets.length > 0) {
        activeBets.forEach(bet => {
            if (bet.highlightIds) {
                bet.highlightIds.forEach(id => {
                    const tag = document.querySelector(`.face-tag[data-spin-id="${id}"]`);
                    if (tag) tag.classList.add('highlight-pair');
                });
            }
        });
    }
}

function resetData(skipConfirm = false) {
    if (skipConfirm || confirm("Reset all session data?")) {
        history = [];
        activeBets = [];
        spinProcessingQueue = Promise.resolve();
        chatMessageHistory = [];
        advancementLog = [];
        neuralPredictionEnabled = false;
        currentNeuralSignal = null;
        neuralPredictionRequestId++;
        aiSignalLedger = [];
        lastAiFusionSnapshot = null;
        aiPredictionCacheKey = '';
        aiPredictionCacheSignal = null;
        aiPredictionInFlight = null;
        aiRuntimeState = {
            status: 'IDLE',
            provider: aiProvider,
            lastError: '',
            lastRequestMode: '',
            lastLatencyMs: 0,
            lastPromptPreview: '',
            lastResponsePreview: '',
            lastUpdatedLabel: 'Never'
        };
        window.currentAlerts = [];
        engineSnapshot = createEmptyEngineSnapshot(0);
        lastActionableComboLabel = null;
        lastActionableTargetFace = null;
        lastActionableCheckpointSpin = 0;
        strategies = {};
        backgroundBets = {};
        engineStats = {
            totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0,
            bankrollHistory: [0], patternStats: {}, signalLog: []
        };
        userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
        faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        document.getElementById('historyBody').innerHTML = '';
        renderDashboard([]);
        renderAnalytics();
        renderUserAnalytics();
        renderGapStats();
        resetAiChatUi();
        updateNeuralPredictionUi();

        updatePredictionSettingsUI();
        updatePerimeterAnalytics();
        updateAnalyticsHUD();

        if (!skipConfirm) {
            const am = document.getElementById('analyticsModal');
            if (!am.classList.contains('hidden')) am.classList.add('hidden');
        }
        saveSessionData();
    }
}

async function undoSpin() {
    if (history.length === 0) return;
    let oldHist = [...history];
    oldHist.pop();

    resetData(true);
    for (let i = 0; i < oldHist.length; i++) {
        await enqueueSpin(oldHist[i].num, { preserveInput: true });
    }

    updatePerimeterAnalytics();
    updateAnalyticsHUD();
    saveSessionData();
}

function updateAiUiState() {
    const switchBtn = document.getElementById('aiMasterSwitch');
    const switchKnob = document.getElementById('aiSwitchKnob');
    const vaultSection = document.getElementById('aiVaultSection');
    const badge = document.getElementById('aiStatusBadge');

    if (switchBtn && switchKnob && vaultSection && badge) {
        if (aiEnabled) {
            switchBtn.classList.replace('bg-white/10', 'bg-[#30D158]/20');
            switchBtn.classList.replace('border-white/20', 'border-[#30D158]/50');
            switchKnob.classList.replace('bg-gray-400', 'bg-[#30D158]');
            switchKnob.style.transform = 'translateX(24px)';
            vaultSection.classList.remove('hidden');
            badge.innerText = 'ON';
            badge.className = 'text-[9px] font-black bg-[#30D158]/20 px-2.5 py-1 rounded-md text-[#30D158] shadow-inner';
        } else {
            switchBtn.classList.replace('bg-[#30D158]/20', 'bg-white/10');
            switchBtn.classList.replace('border-[#30D158]/50', 'border-white/20');
            switchKnob.classList.replace('bg-[#30D158]', 'bg-gray-400');
            switchKnob.style.transform = 'translateX(0)';
            vaultSection.classList.add('hidden');
            badge.innerText = 'OFF';
            badge.className = 'text-[9px] font-black bg-white/10 px-2.5 py-1 rounded-md text-white/50 shadow-inner';
        }
    }

    const providerSelect = document.getElementById('aiProviderSelect');
    const keyInput = document.getElementById('aiApiKeyInput');
    if (providerSelect) providerSelect.value = aiProvider;
    if (keyInput) keyInput.value = aiApiKey;

    const aiContainer = document.getElementById('aiAnalysisContainer');
    if (aiContainer) {
        if (aiEnabled && aiApiKey) {
            aiContainer.classList.remove('hidden');
            aiContainer.classList.add('flex');
        } else {
            aiContainer.classList.add('hidden');
            aiContainer.classList.remove('flex');
        }
    }

    const headerAiBtn = document.getElementById('headerAiBtn');
    if (headerAiBtn) {
        headerAiBtn.classList.remove('hidden');
        headerAiBtn.classList.add('flex');

        if (aiApiKey) {
            headerAiBtn.classList.remove('bg-[#bf5af2]/10', 'border-[#bf5af2]/30', 'shadow-[0_0_10px_rgba(191,90,242,0.15)]');
            headerAiBtn.classList.add('bg-[#bf5af2]/20', 'border-[#bf5af2]/50', 'shadow-[0_0_18px_rgba(191,90,242,0.35)]');
            headerAiBtn.title = aiEnabled
                ? 'AI chat is connected and ready.'
                : 'API connected. Enable AI in the menu to start chat.';
        } else {
            headerAiBtn.classList.add('bg-[#bf5af2]/10', 'border-[#bf5af2]/30', 'shadow-[0_0_10px_rgba(191,90,242,0.15)]');
            headerAiBtn.classList.remove('bg-[#bf5af2]/20', 'border-[#bf5af2]/50', 'shadow-[0_0_18px_rgba(191,90,242,0.35)]');
            headerAiBtn.title = 'Configure your AI key in the menu to activate chat.';
        }
    }

    if ((!aiEnabled || !aiApiKey) && neuralPredictionEnabled) {
        neuralPredictionEnabled = false;
        currentNeuralSignal = null;
        neuralPredictionRequestId++;
        aiPredictionCacheKey = '';
        aiPredictionCacheSignal = null;
        aiPredictionInFlight = null;
        lastAiFusionSnapshot = null;
        void refreshPredictionEngineUI();
    }
    updateNeuralPredictionUi();
    const analyticsModal = document.getElementById('analyticsModal');
    if (analyticsModal && !analyticsModal.classList.contains('hidden')) {
        renderAnalytics();
    }
}

function toggleAiMasterSwitch() {
    const wasNeuralEnabled = neuralPredictionEnabled;
    aiEnabled = !aiEnabled;
    if (!aiEnabled) {
        neuralPredictionEnabled = false;
        currentNeuralSignal = null;
        neuralPredictionRequestId++;
        aiPredictionCacheKey = '';
        aiPredictionCacheSignal = null;
        aiPredictionInFlight = null;
        lastAiFusionSnapshot = null;
    }
    updateAiUiState();
    if (!aiEnabled && wasNeuralEnabled) {
        void refreshPredictionEngineUI();
    }
    saveSessionData();
}

async function saveAiConfig() {
    const providerSelect = document.getElementById('aiProviderSelect');
    const keyInput = document.getElementById('aiApiKeyInput');
    const btn = document.getElementById('saveAiBtn');
    if (!providerSelect || !keyInput || !btn) return;

    const testProvider = providerSelect.value;
    const testKey = keyInput.value.trim();

    if (!testKey) {
        alert("Please enter an API key first.");
        return;
    }

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i> VERIFYING...';
    btn.disabled = true;
    btn.classList.add('opacity-70');

    try {
        if (testProvider === 'gemini') {
            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`, {
                method: 'GET',
                headers: {
                    'x-goog-api-key': testKey
                }
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `Gemini request failed (${res.status})`);
        } else if (testProvider === 'openai') {
            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${testKey}`
                },
                body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: 'ping' }] })
            });
            const data = await res.json();
            if (!res.ok || data.error) throw new Error((data.error && data.error.message) || `OpenAI request failed (${res.status})`);
        }

        aiProvider = testProvider;
        aiApiKey = testKey;
        stampAiRuntimeState({
            status: 'CONNECTED',
            provider: testProvider,
            lastError: ''
        });
        updateAiUiState();
        saveSessionData();

        btn.innerHTML = '<i class="fas fa-check-circle mr-2"></i> CONNECTED!';
        btn.classList.remove('opacity-70', 'text-[#30D158]');
        btn.classList.add('text-white', 'bg-[#30D158]', 'shadow-[0_0_20px_rgba(48,209,88,0.4)]');

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.classList.remove('text-white', 'bg-[#30D158]', 'shadow-[0_0_20px_rgba(48,209,88,0.4)]');
            btn.classList.add('text-[#30D158]');
            btn.disabled = false;
            toggleModal('aiConfigModal');
        }, 1200);
    } catch (error) {
        console.error("Gemini Connection Error:", error);
        btn.innerHTML = `<i class="fas fa-times-circle mr-2"></i> ${error.message.toUpperCase()}`;
        btn.className = 'flex-[2] py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider text-[#ff1a33] border border-[#ff1a33]/50 bg-[#ff1a33]/10';

        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.className = 'flex-[2] py-2.5 rounded-lg font-bold text-[10px] uppercase tracking-wider bg-[#30D158]/20 hover:bg-[#30D158]/30 text-[#30D158] border border-[#30D158]/30 transition-colors shadow-[0_0_15px_rgba(48,209,88,0.15)]';
            btn.disabled = false;
        }, 5000);
    }
}

function clearAiConfig() {
    const wasNeuralEnabled = neuralPredictionEnabled;
    aiApiKey = '';
    chatMessageHistory = [];
    neuralPredictionEnabled = false;
    currentNeuralSignal = null;
    neuralPredictionRequestId++;
    aiPredictionCacheKey = '';
    aiPredictionCacheSignal = null;
    aiPredictionInFlight = null;
    lastAiFusionSnapshot = null;
    aiRuntimeState = {
        status: 'IDLE',
        provider: aiProvider,
        lastError: '',
        lastRequestMode: '',
        lastLatencyMs: 0,
        lastPromptPreview: '',
        lastResponsePreview: '',
        lastUpdatedLabel: 'Never'
    };
    const keyInput = document.getElementById('aiApiKeyInput');
    if (keyInput) keyInput.value = '';
    updateAiUiState();
    resetAiChatUi();
    if (wasNeuralEnabled) {
        void refreshPredictionEngineUI();
    }
    saveSessionData();
    alert('API Key removed from browser storage.');
}

function escapeAiMarkup(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function resetAiChatUi() {
    const historyContainer = document.getElementById('aiChatHistory');
    if (historyContainer) {
        historyContainer.innerHTML = `
            <div class="flex items-start gap-3">
                <div class="w-8 h-8 rounded-full bg-[#bf5af2]/20 border border-[#bf5af2]/40 flex items-center justify-center text-[#bf5af2] shrink-0 shadow-[0_0_10px_rgba(191,90,242,0.2)]"><i class="fas fa-brain"></i></div>
                <div class="bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-3.5 text-gray-200 leading-relaxed max-w-[85%] shadow-md">
                    System online. I am monitoring your session data in real-time. Ask me about patterns, variance, or strategy recommendations.
                </div>
            </div>
        `;
    }

    const input = document.getElementById('aiChatInput');
    if (input) {
        input.value = '';
        input.disabled = false;
    }

    const sendBtn = document.getElementById('aiSendBtn');
    if (sendBtn) {
        sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

function generateAiPrompt() {
    const recentSpins = history.slice(-60).map(s => s.num).join(', ');
    const recentHits = history.slice(-10).map(s => `F${FON_PRIMARY_FACE_MAP[s.num] || '?'}`).join(' -> ') || 'None yet';
    const gaps = Object.entries(faceGaps).map(([face, gap]) => `F${face}:${gap}`).join(', ');
    const stats = `Wins: ${engineStats.totalWins}, Losses: ${engineStats.totalLosses}, Net: ${engineStats.netUnits}`;
    const totalSignals = engineStats.totalWins + engineStats.totalLosses;
    const hitRate = totalSignals === 0 ? 0 : Math.round((engineStats.totalWins / totalSignals) * 100);
    const combos = PERIMETER_COMBOS.map(c => c.label).join(', ');

    return `ROLE: You are an expert Roulette "Table Boss" and data forensic analyst.
Perform a deep, forensic analysis on the physical variance and math engine's hit rate.

LIVE TELEMETRY:
- Session Stats: ${stats} (Global Hit Rate: ${hitRate}%)
- Current Wheel Gaps: ${gaps}
- Last 10 hitting Rhythm: ${recentHits}
- Last 60 spins (Oldest -> Newest): ${recentSpins}

TASK:
Provide a strict, 3-sentence tactical breakdown of the table. 
1. Is the wheel "Chopping" or "Trending" on specific combo zones (${combos})?
2. Are there any undeniable gaps forming on the faces?
3. What is the explicit physical play right now, or should the player walk away? Do NOT give generic advice.`;
}

async function runAiAnalysis() {
    if (!aiEnabled || !aiApiKey) {
        alert("Please configure your AI API key in the Hamburger Menu first.");
        return;
    }

    const btn = document.getElementById('runAiBtn');
    const responseBox = document.getElementById('aiResponseBox');
    if (!btn || !responseBox) return;

    const originalBtnHTML = btn.innerHTML;

    btn.innerHTML = '<i class="fas fa-spinner fa-spin text-[#bf5af2]"></i> Analyzing Variance...';
    btn.disabled = true;
    responseBox.classList.remove('hidden');
    responseBox.innerText = 'Connecting to neural net...';

    const promptText = generateAiPrompt();

    try {
        const responseText = await requestAiText(promptText, {
            requestMode: 'session-analysis',
            temperature: 0.22,
            maxOutputTokens: 420
        });
        responseBox.innerHTML = `<span class="text-[#30D158] font-bold tracking-wide uppercase text-[10px] block mb-2">Neural Output:</span>${escapeAiMarkup(responseText)}`;
    } catch (error) {
        responseBox.innerHTML = `<span class="text-[#ff1a33] font-bold"><i class="fas fa-exclamation-triangle"></i> Error:</span> ${escapeAiMarkup(error.message)}`;
    } finally {
        btn.innerHTML = originalBtnHTML;
        btn.disabled = false;
    }
}

function openAiChat() {
    if (!aiEnabled || !aiApiKey) {
        alert("Please enable AI and configure your API key in the Hamburger Menu first.");
        return;
    }

    toggleModal('aiChatModal');
    setTimeout(() => {
        const input = document.getElementById('aiChatInput');
        if (input) input.focus();
    }, 100);
}

function appendChatMessage(role, text) {
    const historyContainer = document.getElementById('aiChatHistory');
    if (!historyContainer) return;

    const msgDiv = document.createElement('div');
    msgDiv.className = 'flex items-start gap-3 ' + (role === 'user' ? 'flex-row-reverse' : '');

    let avatarHTML = '';
    let bubbleClass = '';

    if (role === 'user') {
        avatarHTML = '<div class="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-gray-300 shrink-0"><i class="fas fa-user"></i></div>';
        bubbleClass = 'bg-[#30D158]/10 border border-[#30D158]/20 rounded-2xl rounded-tr-sm p-3.5 text-white leading-relaxed max-w-[85%]';
    } else if (role === 'ai') {
        avatarHTML = '<div class="w-8 h-8 rounded-full bg-[#bf5af2]/20 border border-[#bf5af2]/40 flex items-center justify-center text-[#bf5af2] shrink-0 shadow-[0_0_10px_rgba(191,90,242,0.2)]"><i class="fas fa-brain"></i></div>';
        bubbleClass = 'bg-white/5 border border-white/10 rounded-2xl rounded-tl-sm p-3.5 text-gray-200 leading-relaxed max-w-[85%] shadow-md whitespace-pre-wrap';
    } else {
        avatarHTML = '<div class="w-8 h-8 rounded-full bg-[#ff1a33]/20 border border-[#ff1a33]/40 flex items-center justify-center text-[#ff1a33] shrink-0"><i class="fas fa-exclamation-triangle"></i></div>';
        bubbleClass = 'bg-[#ff1a33]/10 border border-[#ff1a33]/20 rounded-2xl rounded-tl-sm p-3.5 text-[#ff1a33] leading-relaxed max-w-[85%] whitespace-pre-wrap';
    }

    msgDiv.innerHTML = `${avatarHTML}<div class="${bubbleClass}">${escapeAiMarkup(text)}</div>`;
    historyContainer.appendChild(msgDiv);
    historyContainer.scrollTop = historyContainer.scrollHeight;
}

async function sendAiChatMessage() {
    const input = document.getElementById('aiChatInput');
    const btn = document.getElementById('aiSendBtn');
    if (!input || !btn) return;

    const message = input.value.trim();
    if (!message) return;

    input.value = '';
    input.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

    appendChatMessage('user', message);
    chatMessageHistory.push({ role: 'user', content: message });

    const systemInstruction = `
ROLE: You are an expert Roulette "Table Boss" standing right over the player's shoulder. Your goal is to keep them grounded and read the wheel rhythms.

SMART PLAY PROTOCOL:
1. THE RHYTHM: You don't just care about the Math; you care about the Table. If a Combo hits 3 times in 8 spins, it is "Trending." If a Combo hasn't hit in 20 spins, don't blindly bet it—it might be dead. Wait for a "Snapback" (a miss after a hit).
2. GHOST PATTERNS: Look for patterns that aren't in the rules but are repeating on the physical wheel right now (e.g., F1 -> F3 -> F1 -> F3).

ADVERSARIAL TASKS:
- Check the current Net Units: ${engineStats.netUnits}. If losing, the table is choppy. Tell the user to tighten up.
- Look at the last 10 hits: ${history.slice(-10).map(s => `F${FON_PRIMARY_FACE_MAP[s.num] || '?'}`).join(' -> ') || 'None'}. Provide a "Smart Entry" based on this physical rhythm.
- If the table is pure chaos, strictly command the user to "SIT OUT."

STRICT DATA LIMIT:
- Use ONLY Faces (F1-F5) and the 4 Perimeter Combos (5-2, 5-3, 1-3, 2-4).
- TALK LIKE A TABLE BOSS. Short, punchy sentences.
`;
    const recentConversation = chatMessageHistory.slice(0, -1).slice(-6).map(entry => `${entry.role.toUpperCase()}: ${entry.content}`).join('\n');
    const fullPrompt = `${systemInstruction}\n\nRECENT CONVERSATION:\n${recentConversation}\n\nUSER INPUT: ${message}`;

    try {
        const responseText = await requestAiText(fullPrompt, {
            requestMode: 'chat-strategy',
            temperature: 0.1,
            maxOutputTokens: 800
        });
        if (responseText.toUpperCase().includes("ADVANCEMENT:") || responseText.toUpperCase().includes("PIVOT:")) {
            const lines = responseText.split('\n');
            const advancementLine = lines.find(line => line.toUpperCase().includes("ADVANCEMENT:") || line.toUpperCase().includes("PIVOT:"));
            if (advancementLine) {
                addAdvancement(advancementLine.replace(/ADVANCEMENT:|PIVOT:/gi, '').trim());
            }
        }
        chatMessageHistory.push({ role: 'assistant', content: responseText });
        appendChatMessage('ai', responseText);
    } catch (error) {
        appendChatMessage('error', `Strategic Link Error: ${error.message}`);
    } finally {
        input.disabled = false;
        input.focus();
        btn.innerHTML = '<i class="fas fa-paper-plane"></i>';
    }
}

function toggleModal(id) {
    document.getElementById(id).classList.toggle('hidden');
}

function exportSpins() {
    if (history.length === 0) {
        alert("No spins to export!");
        return;
    }
    const spins = history.map(h => h.num);
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
}

function importSpins(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data.spins)) {
                // Pause UI and reset core memory arrays
                const bulkSpins = data.spins;
                resetData(true);
                
                // --- BULK IMPORT LOOP ---
                const inputField = document.getElementById('spinInput');
                if (inputField) inputField.disabled = true;

                for (let i = 0; i < bulkSpins.length; i++) {
                    const val = bulkSpins[i];
                    if (val < 0 || val > 36) continue;
                    
                    // Call the full logic pipeline silently (bypasses layout rendering)
                    await processSpinValue(val, { silent: true, preserveInput: true });
                }

                // --- BATCH DOM RENDER ---
                const historyBody = document.getElementById('historyBody');
                if (historyBody) {
                    historyBody.innerHTML = '';
                    const fragment = document.createDocumentFragment();
                    
                    for (let i = 0; i < history.length; i++) {
                        renderRow(history[i], fragment);
                    }
                    
                    historyBody.appendChild(fragment);
                    requestAnimationFrame(layoutAllComboBridges);
                    
                    const sc = document.querySelector('#scrollContainer > div');
                    if (sc) sc.scrollTop = sc.scrollHeight;
                }

                // --- FULL RECALCULATION PIPELINE ---
                renderGapStats();
                await syncPredictionEngine();
                await scanAllStrategies();
                renderDashboard(window.currentAlerts || []);
                renderAnalytics();
                updatePerimeterAnalytics();
                updateAnalyticsHUD();
                updateVisibility();
                refreshHighlights();
                renderIntelligencePanel();
                saveSessionData();

                if (inputField) {
                    inputField.value = '';
                    inputField.disabled = false;
                    inputField.focus();
                }

                alert(`Successfully imported ${history.length} spins.`);
            } else {
                alert("Invalid file format: 'spins' array missing.");
            }
        } catch (err) {
            alert("Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = '';
}

let stopwatchInterval = null;
let stopwatchSeconds = 0;

function formatStopwatchTime(totalSeconds) {
    let hrs = Math.floor(totalSeconds / 3600);
    let mins = Math.floor((totalSeconds % 3600) / 60);
    let secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateStopwatchDisplay() {
    const display = document.getElementById('stopwatchDisplay');
    if (display) display.innerText = formatStopwatchTime(stopwatchSeconds);
}

function toggleStopwatch() {
    const icon = document.getElementById('stopwatchIcon');
    const text = document.getElementById('stopwatchText');
    const btn = document.getElementById('stopwatchToggleBtn');

    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
        if (text) text.innerText = 'Start';
        if (btn) {
            btn.classList.remove('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30');
            btn.classList.add('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30');
        }
    } else {
        stopwatchInterval = setInterval(() => { stopwatchSeconds++; updateStopwatchDisplay(); }, 1000);
        if (icon) { icon.classList.remove('fa-play'); icon.classList.add('fa-pause'); }
        if (text) text.innerText = 'Pause';
        if (btn) {
            btn.classList.remove('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30');
            btn.classList.add('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30');
        }
    }
}

function resetStopwatch() {
    if (stopwatchInterval) { clearInterval(stopwatchInterval); stopwatchInterval = null; }
    stopwatchSeconds = 0;
    updateStopwatchDisplay();
    const icon = document.getElementById('stopwatchIcon');
    const text = document.getElementById('stopwatchText');
    const btn = document.getElementById('stopwatchToggleBtn');
    if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
    if (text) text.innerText = 'Start';
    if (btn) {
        btn.classList.remove('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30');
        btn.classList.add('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30');
    }
}
