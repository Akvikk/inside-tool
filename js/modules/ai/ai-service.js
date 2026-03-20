(function () {
    window.requestTacticalAudit = async function () {
        if (!window.AiBrain || typeof window.AiBrain.requestTacticalAudit !== 'function') {
            return { error: 'AI module unavailable.' };
        }
        return window.AiBrain.requestTacticalAudit({
            history: window.state.history,
            netUnits: window.state && window.state.engineStats
                ? window.state.engineStats.netUnits
                : 0
        });
    };

    window.requestNeuralPrediction = async function (options = {}) {
        if (!window.AiBrain || typeof window.AiBrain.requestNeuralPrediction !== 'function') {
            return null;
        }

        const opts = options && typeof options === 'object' ? options : {};
        const renderDashboardNow = opts.renderDashboardNow === true;
        const brainOptions = { force: opts.force === true };

        const mathSignal = window.state.engineSnapshot && window.state.engineSnapshot.currentPrediction ? window.state.engineSnapshot.currentPrediction : null;
        const recentHits = window.state.history.slice(-10)
            .map(spin => `F${window.FON_PRIMARY_FACE_MAP[spin.num] || '?'}`)
            .join(' -> ') || 'None';

        const signal = await window.AiBrain.requestNeuralPrediction({
            history: window.state.history,
            strategy: window.state.currentGameplayStrategy,
            netUnits: window.state && window.state.engineStats
                ? window.state.engineStats.netUnits
                : 0,
            recentHits,
            mathLabel: mathSignal ? (mathSignal.comboLabel || mathSignal.action || 'Math') : 'No math signal',
            mathTarget: mathSignal ? mathSignal.targetFace : null,
            mathConfidence: mathSignal && Number.isFinite(mathSignal.confidence) ? mathSignal.confidence : 0,
            mathSignal
        }, brainOptions);

        if (signal) {
            window.state.currentNeuralSignal = signal;
            if (window.updateAiFusionSnapshot) window.updateAiFusionSnapshot(window.state.currentNeuralSignal);

            // Map AI signal to activeBets so it controls the Dashboard Cards
            if (signal.status === 'GO' && signal.targetFace) {
                window.state.activeBets = [{
                    patternName: 'Neural Net',
                    targetFace: signal.targetFace,
                    confidence: signal.confidence || 0,
                    subtitle: signal.reason || 'AI Tactical Read',
                    accentColor: '#bf5af2', // Purple AI theme
                    confirmed: false
                }];
            } else {
                window.state.activeBets = [];
            }
        } else {
            // Fallback to Math Engine Cards if AI is unreachable
            const getLatestMathBets = function () {
                const strategyKey = window.state && window.state.currentGameplayStrategy ? window.state.currentGameplayStrategy : 'series';
                const cachedResult = window.state && window.state.strategySyncCache
                    ? window.state.strategySyncCache[strategyKey]
                    : null;
                return cachedResult && Array.isArray(cachedResult.nextBets) ? cachedResult.nextBets.slice() : [];
            };
            window.state.activeBets = getLatestMathBets();
        }

        if (renderDashboardNow) {
            if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
            if (window.syncAppStore) window.syncAppStore(); // Broadcast the update
        }

        return signal;
    };

    window.triggerAiAudit = async function (btn) {
        if (!btn) return;
        const originalText = btn.innerText;
        btn.innerText = 'AUDITING...';
        btn.disabled = true;

        const audit = await window.requestTacticalAudit();
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
    };

    window.sendAiChatMessage = async function () {
        const input = document.getElementById('aiChatInput');
        const historyContainer = document.getElementById('aiChatHistory');
        if (!input || !historyContainer || !input.value.trim()) return;

        const message = input.value.trim();
        input.value = '';

        historyContainer.innerHTML += `
            <div class="flex justify-end">
                <div class="bg-[#bf5af2]/20 border border-[#bf5af2]/30 text-white p-3 rounded-xl rounded-tr-sm max-w-[85%] text-xs shadow-md">
                    ${message}
                </div>
            </div>
        `;
        historyContainer.scrollTop = historyContainer.scrollHeight;

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
                for (let i = 0; i < original.length; i++) {
                    if (original[i] === ' ') scrambled += ' ';
                    else scrambled += Math.random() > 0.75 ? chars[Math.floor(Math.random() * chars.length)] : original[i];
                }
                el.innerText = scrambled;
            }
        }, 50);

        try {
            if (!window.AiBrain) throw new Error("AI module unavailable.");
            const context = window.state ? `Recent history: ${window.state.history.slice(-12).map(s => s.num).join(', ')}. Net: ${window.state.userStats ? window.state.userStats.netUnits : 0}u.` : "";

            const responseText = await window.AiBrain.requestAiText(`ROLE: Elite Roulette Table Boss.\nCONTEXT: ${context}\nUSER: ${message}`, { requestMode: 'chat', maxOutputTokens: 250 });
            clearInterval(scrambleInterval);
            document.getElementById(typingId).remove();
            historyContainer.innerHTML += `<div class="flex justify-start"><div class="bg-black/40 border border-white/10 text-white p-3 rounded-xl rounded-tl-sm max-w-[85%] text-xs shadow-md leading-relaxed whitespace-pre-wrap">${responseText.trim()}</div></div>`;
        } catch (error) {
            clearInterval(scrambleInterval);
            document.getElementById(typingId).remove();
            historyContainer.innerHTML += `<div class="flex justify-start"><div class="bg-[#ff1a33]/20 border border-[#ff1a33]/30 text-[#ff1a33] p-3 rounded-xl rounded-tl-sm max-w-[85%] text-xs shadow-md">Error: ${error.message}</div></div>`;
        }
        historyContainer.scrollTop = historyContainer.scrollHeight;
    };
})();