
    /**
     * --- TACTICAL BRAIN: HINDSIGHT REVIEW ---
     * On-demand, token-optimized session review.
     */
    async function requestFullSessionReview(history, userStats, engineStats) {
        if (!aiEnabled || !aiConnected) return { error: "AI relay not connected" };

        // 1. Local Calculation: Shadow Profits & Missed Opportunities
        const { shadowNet, missedOpportunities } = calculateShadowProfits(userStats, engineStats);

        // 2. Summarize Telemetry
        const telemetry = {
            actualNet: userStats.netUnits,
            potentialNet: shadowNet,
            topMissedPlays: missedOpportunities.slice(0, 3).map(p => ({
                pattern: p.patternName,
                profit: p.units
            })),
            totalSpins: history.length,
            hitRate: (engineStats.totalWins / (engineStats.totalWins + engineStats.totalLosses)) * 100
        };

        // 3. Build the Token-Optimized Prompt
        const prompt = `ROLE: Elite Roulette Coach.
DATA: Actual Net: ${telemetry.actualNet}u. Potential Net (if all signals taken): ${telemetry.potentialNet}u. Hit Rate: ${telemetry.hitRate.toFixed(1)}%. Top missed plays: ${JSON.stringify(telemetry.topMissedPlays)}.
TASK: Provide 2 ultra-dense tactical critiques in JSON format using the schema.`;

        // 4. Request AI analysis with a strict schema
        try {
            const responseText = await requestAiText(prompt, {
                requestMode: 'hindsight-review',
                temperature: 0.2,
                maxOutputTokens: 180,
                responseMimeType: 'application/json',
                responseSchema: getHindsightSchema()
            });
            const aiCritique = extractJson(responseText);
            
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
        const userBetKeys = new Set(userStats.betLog.map(b => `${b.spinNum}-${b.pattern}`));
        let shadowNet = userStats.netUnits;
        const missedOpportunities = [];

        engineStats.signalLog.forEach(signal => {
            const betKey = `${signal.spinIndex + 1}-${signal.patternName}`;
            if (signal.result === 'WIN' && !userBetKeys.has(betKey)) {
                shadowNet += signal.units;
                missedOpportunities.push(signal);
            }
        });

        missedOpportunities.sort((a, b) => b.units - a.units);

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
      
    /**
     * --- TACTICAL BRAIN: AUDIT ---
     * The heavy session hindsight logic.
     */