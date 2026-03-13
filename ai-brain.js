/**
 * =================================================================
 * AI BRAIN MODULE (ai-brain.js)
 * =================================================================
 * The 'Frontal Lobe' of the application. 
 * This file contains 100% of the AI decision-making logic, 
 * architectural prompts, and model processing. 
 * 
 * CORE GOAL: If you change a prompt or a model parameter, 
 * you do it HERE, and the UI (app.js) stays untouched and safe.
 */

(function() {
    // --- PRIVATE STATE (The Brain's Memory) ---
    const CONFIG = {
        GEMINI_MODEL: 'gemini-2.5-flash',
        TAKEOVER_PATTERN_NAME: 'AI Takeover',
        RECENT_WINDOW: 36,
        AUDIT_WINDOW: 12,
        MIN_NEURAL_SPINS: 12,
        LEDGER_LIMIT: 40
    };

    let aiEnabled = false;
    let aiProvider = 'gemini';
    let aiApiKey = '';
    let aiConnected = false;
    let neuralPredictionEnabled = false;
    let currentNeuralSignal = null;
    let neuralPredictionRequestId = 0;
    let aiSignalLedger = [];
    let lastAiFusionSnapshot = null;
    
    let cache = {
        predictionKey: '',
        predictionSignal: null,
        inFlight: null
    };

    let runtimeState = {
        status: 'IDLE',
        provider: 'gemini',
        lastError: '',
        lastRequestMode: '',
        lastLatencyMs: 0,
        lastPromptPreview: '',
        lastResponsePreview: '',
        lastUpdatedLabel: 'Never'
    };

    // --- PUBLIC INTERFACE ---
    window.AiBrain = {
        // State Accessors
        config: () => ({ ...CONFIG }),
        getState: () => ({
            aiEnabled, aiProvider, aiApiKey, aiConnected, neuralPredictionEnabled,
            currentNeuralSignal, aiSignalLedger, lastAiFusionSnapshot, runtimeState
        }),
        
        // Settings Sync
        updateSettings: (settings) => {
            if (settings.aiEnabled !== undefined) aiEnabled = settings.aiEnabled;
            if (settings.aiProvider !== undefined) aiProvider = settings.aiProvider;
            if (settings.aiApiKey !== undefined) aiApiKey = settings.aiApiKey;
            if (settings.aiConnected !== undefined) aiConnected = settings.aiConnected === true;
            if (settings.neuralPredictionEnabled !== undefined) neuralPredictionEnabled = settings.neuralPredictionEnabled;
        },

        // Primary Logic
        requestNeuralPrediction,
        requestTacticalAudit,
        settleLedger,
        
        // Utils
        getFusionSnapshot: () => lastAiFusionSnapshot,
        resetCache: () => { cache.predictionKey = ''; cache.predictionSignal = null; },
        setNeuralEnabled: (val) => { neuralPredictionEnabled = !!val; },
        isNeuralEnabled: () => neuralPredictionEnabled
    };

    /**
     * --- NEURAL PREDICTION ENGINE ---
     * The live 'per-spin' logic.
     */
    async function requestNeuralPrediction(context, options = {}) {
        if (!neuralPredictionEnabled || !aiEnabled || !aiConnected) return null;
        if (!context || !Array.isArray(context.history) || context.history.length < CONFIG.MIN_NEURAL_SPINS) return null;
        
        const { force = false } = options;
        const cacheKey = `${context.history.length}_${context.strategy}_${context.netUnits}`;

        if (!force && cache.predictionKey === cacheKey) return cache.predictionSignal;
        if (!force && cache.inFlight && cache.inFlight.key === cacheKey) return cache.inFlight.promise;

        const requestId = ++neuralPredictionRequestId;
        const prompt = buildTakeoverPrompt(context);

        const predictionPromise = (async () => {
            try {
                const responseText = await requestAiText(prompt, {
                    requestMode: 'prediction-takeover',
                    temperature: 0.18,
                    maxOutputTokens: 260,
                    responseMimeType: 'application/json',
                    responseSchema: getTakeoverSchema()
                });

                if (requestId !== neuralPredictionRequestId) return currentNeuralSignal;

                let json;
                try {
                    json = extractJson(responseText);
                } catch (e) {
                    json = salvagePayload(responseText);
                }

                const signal = formatSignal(json);
                
                cache.predictionKey = cacheKey;
                cache.predictionSignal = signal;
                currentNeuralSignal = signal;

                updateLedger(signal, context.history.length);
                updateFusionSnapshot(signal, context.mathSignal);

                return signal;
            } catch (err) {
                console.error("AiBrain: Prediction Error", err);
                return null;
            }
        })();

        cache.inFlight = { key: cacheKey, promise: predictionPromise };
        return predictionPromise;
    }

    /**
     * --- TACTICAL BRAIN: AUDIT ---
     * The heavy session hindsight logic.
     */
    async function requestTacticalAudit(context) {
        if (!aiEnabled || !aiConnected) return { error: "AI relay not connected" };
        
        const auditData = compileAuditData(context);
        const prompt = `ROLE: You are the 'TACTICAL BRAIN' auditor... (Full Brain Logic)
DATA: ${JSON.stringify(auditData)}
TASK: Provide a cold, profitable critique and 3 tactical adjustments. Return JSON.`;

        try {
            const responseText = await requestAiText(prompt, {
                requestMode: 'tactical-audit',
                temperature: 0.3,
                maxOutputTokens: 240,
                responseMimeType: 'application/json'
            });
            return extractJson(responseText);
        } catch (err) {
            return { error: err.message };
        }
    }

    // --- CORE MATH & PROMPT BUILDERS ---

    function buildTakeoverPrompt(ctx) {
        const recent = ctx.history.slice(-CONFIG.RECENT_WINDOW).map(s => s.num).join(', ');
        return `ROLE: Table Boss. 
DATA: 10-spin rhythm: ${ctx.recentHits} | Math Engine: ${ctx.mathLabel} -> F${ctx.mathTarget} (${ctx.mathConfidence}%)
WHEEL: ${recent}
TASK: Validate if math is walking into a trap. Return JSON.`;
    }

    function formatSignal(json) {
        const status = String(json.status || 'SIT_OUT').toUpperCase();
        return {
            source: 'ai',
            status,
            targetFace: status === 'SIT_OUT' ? null : Number(json.targetFace),
            comboLabel: json.combo || 'NONE',
            confidence: Number(json.confidence) || 0,
            reason: json.reason || 'No data',
            subtitle: `${json.mode} | MATH: ${json.mathAssessment}`,
            accentColor: '#bf5af2'
        };
    }

    // --- API BRIDGE ---

    async function requestAiText(prompt, options) {
        const startedAt = Date.now();
        updateRuntime({ status: 'WORKING', lastRequestMode: options.requestMode });

        try {
            if (!window.AiRelayClient || typeof window.AiRelayClient.requestText !== 'function') {
                throw new Error('AI relay client is unavailable.');
            }

            const text = await window.AiRelayClient.requestText(prompt, {
                temperature: options.temperature,
                maxOutputTokens: options.maxOutputTokens,
                requestMode: options.requestMode,
                responseMimeType: options.responseMimeType,
                responseSchema: options.responseSchema
            });

            updateRuntime({ status: 'CONNECTED', lastLatencyMs: Date.now() - startedAt });
            return text || '';
        } catch (err) {
            updateRuntime({ status: 'ERROR', lastError: err.message });
            throw err;
        }
    }

    // --- INTERNAL HELPERS ---

    function updateRuntime(next) {
        runtimeState = { ...runtimeState, ...next };
    }

    function extractJson(raw) {
        const match = raw.match(/\{[\s\S]*\}/);
        return JSON.parse(match ? match[0] : raw);
    }

    function salvagePayload(text) {
        // Fallback parsing logic
        return { status: 'SIT_OUT' };
    }

    function updateLedger(signal, spinCount) {
        if (!signal || signal.status === 'SIT_OUT') return;
        aiSignalLedger.unshift({
            issuedAfterSpin: spinCount,
            targetFace: signal.targetFace,
            comboLabel: signal.comboLabel,
            confidence: signal.confidence,
            outcome1: null, outcome3: null, outcome5: null
        });
        if (aiSignalLedger.length > CONFIG.LEDGER_LIMIT) aiSignalLedger.pop();
    }

    function settleLedger(history) {
        aiSignalLedger.forEach(entry => {
            [1, 3, 5].forEach(h => {
                const key = `outcome${h}`;
                if (entry[key] !== null || history.length < entry.issuedAfterSpin + h) return;
                let hit = false;
                for (let i = entry.issuedAfterSpin; i < entry.issuedAfterSpin + h; i++) {
                    if (window.spinContainsFace && window.spinContainsFace(history[i], entry.targetFace)) {
                        hit = true; break;
                    }
                }
                entry[key] = hit ? 'HIT' : 'MISS';
            });
        });
    }

    function updateFusionSnapshot(aiSignal, mathSignal) {
        // Compute the disagreement/agreement logic
        lastAiFusionSnapshot = {
            aiSignal,
            mathSignal,
            stance: aiSignal && aiSignal.status === 'GO' ? 'SYNCED' : 'NEUTRAL'
        };
    }

    function compileAuditData(ctx) {
        return {
            history: ctx.history.slice(-CONFIG.AUDIT_WINDOW).map(s => s.num),
            ledger: aiSignalLedger.slice(0, 3),
            net: ctx.netUnits
        };
    }

    function getTakeoverSchema() {
        return {
            type: 'OBJECT',
            properties: {
                status: { type: 'STRING', enum: ['GO', 'WATCH', 'SIT_OUT'] },
                combo: { type: 'STRING' },
                targetFace: { type: 'NUMBER' },
                confidence: { type: 'NUMBER' },
                mode: { type: 'STRING' },
                mathAssessment: { type: 'STRING' },
                tableState: { type: 'STRING' },
                reason: { type: 'STRING' }
            },
            required: ['status', 'combo', 'confidence', 'mode', 'mathAssessment', 'tableState', 'reason']
        };
    }

})();
