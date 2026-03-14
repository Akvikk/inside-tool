
const RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const PERIMETER_RULE_KEY = 'Perimeter Rule';
const PREDICTION_PERIMETER_PATTERN = 'Prediction Perimeter';
const AI_TAKEOVER_PATTERN = 'AI Takeover';
const ENGINE_PRIMARY_WINDOW = 14;
const ENGINE_CONFIRMATION_WINDOW = 5;
const HUD_RECENT_WINDOW = 14;
const GEMINI_MODEL = 'gemini-2.5-flash';
const AI_RELAY_BASE_URL = 'http://127.0.0.1:8787/api/ai';
const AI_RELAY_SENTINEL = '__inside_tool_secure_relay__';
const INTELLIGENCE_VIEW_KEY = 'insideTool.intelligenceViewMode';
const INTELLIGENCE_VIEWS = ['brief', 'diagnostic', 'minimal'];
const RACETRACK_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const BULK_REPLAY_CHUNK_SIZE = 24;
const HISTORY_RENDER_CHUNK_SIZE = 80;

let currentInputLayout = 'grid'; // 'grid' or 'racetrack'
let history = [];
let activeBets = [];
let globalSpinIdCounter = 0;
let spinProcessingQueue = Promise.resolve();
let faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let predictionPerimeterWindow = 14;
let perimeterRuleEnabled = true;
let advancementLog = [];
let chatMessageHistory = [];
let aiEnabled = false;
let aiProvider = 'gemini';
let aiApiKey = '';
let neuralPredictionEnabled = false;
let currentNeuralSignal = null;
let neuralPredictionRequestId = 0;
let aiSignalLedger = [];
let lastAiFusionSnapshot = null;
let aiPredictionCacheKey = '';
let aiPredictionCacheSignal = null;
let aiPredictionInFlight = null;
let aiApiKeyVisible = false;
let aiRelayAvailable = false;
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
let patternConfig = {};
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
let perimeterStatsCache = {};
let currentAnalyticsTab = 'strategy';
let currentIntelligenceMode = 'brief';
let isHudColdMode = false;
let hudHistoryScope = 'all';
let engineSnapshot = null;
let lastActionableComboLabel = null;
let lastActionableTargetFace = null;
let lastActionableCheckpointSpin = 0;
let analyticsDisplayStrategy = 'series';
let historyRenderVersion = 0;
let strategySyncCache = { series: null, combo: null };
window.currentAlerts = [];

export const state = {
    RED_NUMS,
    PERIMETER_RULE_KEY,
    PREDICTION_PERIMETER_PATTERN,
    AI_TAKEOVER_PATTERN,
    ENGINE_PRIMARY_WINDOW,
    ENGINE_CONFIRMATION_WINDOW,
    HUD_RECENT_WINDOW,
    GEMINI_MODEL,
    AI_RELAY_BASE_URL,
    AI_RELAY_SENTINEL,
    INTELLIGENCE_VIEW_KEY,
    INTELLIGENCE_VIEWS,
    RACETRACK_ORDER,
    BULK_REPLAY_CHUNK_SIZE,
    HISTORY_RENDER_CHUNK_SIZE,
    currentInputLayout,
    history,
    activeBets,
    globalSpinIdCounter,
    spinProcessingQueue,
    faceGaps,
    predictionPerimeterWindow,
    perimeterRuleEnabled,
    advancementLog,
    chatMessageHistory,
    aiEnabled,
    aiProvider,
    aiApiKey,
    neuralPredictionEnabled,
    currentNeuralSignal,
    neuralPredictionRequestId,
    aiSignalLedger,
    lastAiFusionSnapshot,
    aiPredictionCacheKey,
    aiPredictionCacheSignal,
    aiPredictionInFlight,
    aiApiKeyVisible,
    aiRelayAvailable,
    aiRuntimeState,
    patternConfig,
    userStats,
    currentPredictionStrategy,
    currentGameplayStrategy,
    strategies,
    changeStrategyTimeout,
    cachedAddSpinBtn,
    perimeterStatsCache,
    currentAnalyticsTab,
    currentIntelligenceMode,
    isHudColdMode,
    hudHistoryScope,
    engineSnapshot,
    lastActionableComboLabel,
    lastActionableTargetFace,
    lastActionableCheckpointSpin,
    analyticsDisplayStrategy,
    historyRenderVersion,
    strategySyncCache,
};
