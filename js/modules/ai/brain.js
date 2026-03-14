(function () {
    window.AiBrain = {
        requestFullSessionReview,
        requestAiText,
        settleLedger,
        requestTacticalAudit,
        requestNeuralPrediction
    };

    async function requestAiText(prompt, options = {}) {
        const state = window.state;
        if (!state.aiEnabled && !options.force) {
            throw new Error("AI is disabled in settings.");
        }

        try {
            const response = await fetch(`${state.AI_RELAY_BASE_URL}/request`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, options })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'AI Request failed');
            return data.text;
        } catch (error) {
            console.error('AI Request Error:', error);
            throw error;
        }
    }

    function extractJson(text) {
        try {
            const start = text.indexOf('{');
            const end = text.lastIndexOf('}');
            if (start !== -1 && end !== -1) {
                return JSON.parse(text.substring(start, end + 1));
            }
            return JSON.parse(text);
        } catch (e) {
            console.error("Failed to parse JSON from AI response:", text);
            return null;
        }
    }

    async function requestFullSessionReview(history, userStats, engineStats) {
        const state = window.state;
        if (!state.aiEnabled) return { error: "AI relay not connected" };

        const { shadowNet, missedOpportunities } = calculateShadowProfits(userStats, engineStats);

        const hitRate = (engineStats.totalWins + engineStats.totalLosses) > 0
            ? (engineStats.totalWins / (engineStats.totalWins + engineStats.totalLosses)) * 100
            : 0;

        const telemetry = {
            actualNet: userStats.netUnits,
            potentialNet: shadowNet,
            topMissedPlays: missedOpportunities.slice(0, 3).map(p => ({
                pattern: p.patternName,
                profit: p.units
            })),
            totalSpins: history.length,
            hitRate: hitRate
        };

        const prompt = `ROLE: Elite Roulette Coach.
DATA: Actual Net: ${telemetry.actualNet}u. Potential Net (if all signals taken): ${telemetry.potentialNet}u. Hit Rate: ${telemetry.hitRate.toFixed(1)}%. Top missed plays: ${JSON.stringify(telemetry.topMissedPlays)}.
TASK: Provide 2 ultra-dense tactical critiques in JSON format using the schema.`;

        try {
            const responseText = await requestAiText(prompt, {
                requestMode: 'hindsight-review',
                temperature: 0.2,
                maxOutputTokens: 180,
                responseMimeType: 'application/json',
                responseSchema: getHindsightSchema()
            });
            const aiCritique = extractJson(responseText);
            
            if (!aiCritique) {
                return {
                    actualNet: telemetry.actualNet,
                    potentialNet: telemetry.potentialNet,
                    critique: {
                        critiques: [{ title: "Review", suggestion: responseText.replace(/```json/g, '').replace(/```/g, '').trim() }]
                    }
                };
            }

            return {
                actualNet: telemetry.actualNet,
                potentialNet: telemetry.potentialNet,
                critique: aiCritique
            };

        } catch (err) {
            return { error: err.message };
        }
    }

    function calculateShadowProfits(userStats, engineStats) {
        const userBetKeys = new Set((userStats.betLog || []).map(b => `${b.spinNum}-${b.pattern}`));
        let shadowNet = userStats.netUnits || 0;
        const missedOpportunities = [];

        if (engineStats && engineStats.signalLog) {
            engineStats.signalLog.forEach(signal => {
                const betKey = `${signal.spinIndex + 1}-${signal.patternName}`;
                if (signal.result === 'WIN' && !userBetKeys.has(betKey)) {
                    shadowNet += signal.units;
                    missedOpportunities.push(signal);
                }
            });
            missedOpportunities.sort((a, b) => b.units - a.units);
        }

        return { shadowNet, missedOpportunities };
    }

    function getHindsightSchema() {
        return {
            type: 'OBJECT',
            properties: {
                critiques: {
                    type: 'ARRAY',
                    items: {
                        type: 'OBJECT',
                        properties: {
                            title: { type: 'STRING' },
                            suggestion: { type: 'STRING' }
                        },
                        required: ['title', 'suggestion']
                    }
                }
            },
            required: ['critiques']
        };
    }

    function settleLedger(history) {
        const state = window.state;
        if (!state || !state.aiSignalLedger) return;

        if (history.length === 0) return;
        const lastSpin = history[history.length - 1];

        state.aiSignalLedger.forEach(signal => {
            if (!signal.settled && signal.targetSpinIndex === lastSpin.index) {
                const matchedFaces = window.FON_MAP ? window.FON_MAP[lastSpin.num] : [];
                if (matchedFaces && matchedFaces.includes(signal.targetFace)) {
                    signal.result = 'WIN';
                } else {
                    signal.result = 'LOSS';
                }
                signal.settled = true;
            }
        });
    }

    async function requestTacticalAudit(context) {
        const state = window.state;
        if (!state.aiEnabled) return { error: "AI is disabled in settings." };

        const recentSpins = (context.history || []).slice(-15).map(s => s.num).join(', ');
        const prompt = `ROLE: Elite Roulette Table Boss.
CONTEXT: 
- Last 15 hits: ${recentSpins}
- Net Units: ${context.netUnits}

TASK: Provide a tactical audit of the current table state.
SCHEMA:
{
  "predictabilityScore": number (0-100),
  "verdict": "string, 1-2 short sentences",
  "profitPivot": "string, 1 short actionable advice"
}`;

        try {
            const responseText = await requestAiText(prompt, {
                requestMode: 'tactical-audit',
                temperature: 0.3,
                maxOutputTokens: 150,
                responseMimeType: 'application/json'
            });
            const data = extractJson(responseText);
            if (data && data.verdict) return data;
            
            return {
                predictabilityScore: 50,
                verdict: responseText.replace(/```json/g, '').replace(/```/g, '').trim(),
                profitPivot: "Review engine stats."
            };
        } catch (error) {
            console.error('AI Tactical Audit failed:', error);
            return { error: error.message };
        }
    }

    async function requestNeuralPrediction(context, options = {}) {
        const state = window.state;
        if (!state.aiEnabled && !options.force) return null;

        const prompt = `ROLE: Roulette AI Table Boss.
CONTEXT: 
- Last 10 hits: ${context.recentHits}.
- Math Engine Suggests: ${context.mathLabel} -> F${context.mathTarget} (${context.mathConfidence}%).
- Net Units: ${context.netUnits}.

TASK: Output ONLY a JSON object evaluating the next best Face (1-5).
SCHEMA:
{
  "status": "GO" or "SIT_OUT",
  "targetFace": number (1-5) or null,
  "confidence": number (0-100),
  "reason": "short strategic string max 50 chars"
}`;

        try {
            const responseText = await requestAiText(prompt, {
                requestMode: 'neural-prediction',
                temperature: 0.2,
                maxOutputTokens: 100,
                responseMimeType: 'application/json'
            });
            const data = extractJson(responseText);
            if (data && data.status) return data;
            return null;
        } catch (error) {
            console.error('AI Neural Prediction failed:', error);
            return null;
        }
    }
})();