
import { state } from '../engine/state.js';

(function() {
    window.InputProcessor = {
        init,
        addSpin,
        undoSpin,
        handleGridClick,
    };

    function init() {
        const spinInputEl = document.getElementById('spinInput');
        if (spinInputEl) {
            // Keep the field strictly numeric even when pasting or using IME.
            spinInputEl.addEventListener('input', () => {
                const digitsOnly = spinInputEl.value.replace(/\D+/g, '').slice(0, 2);
                if (spinInputEl.value !== digitsOnly) {
                    spinInputEl.value = digitsOnly;
                }
            });
            spinInputEl.focus();
        }

        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                e.preventDefault();
                undoSpin();
            }
        });
    }

    function parseSpinNumber(rawValue) {
        const normalized = String(rawValue ?? '').trim();
        if (!/^\d+$/.test(normalized)) return null;

        const parsed = Number(normalized);
        if (!Number.isInteger(parsed) || parsed < 0 || parsed > 36) return null;

        return parsed;
    }

    function enqueueSpin(val) {
        state.spinProcessingQueue = state.spinProcessingQueue
            .catch(error => {
                // Recover the queue so one failed spin does not block all future input.
                console.error('Recovered spin queue after an error:', error);
            })
            .then(() => processSpinValue(val));

        return state.spinProcessingQueue;
    }

    async function addSpin() {
        const input = document.getElementById('spinInput');
        if (!input) return;

        const raw = input.value.trim();
        if (raw === '') return;

        const val = parseSpinNumber(raw);

        if (val === null) {
            input.value = '';
            // Add a visual shake effect for invalid input
            input.classList.remove('input-shake');
            void input.offsetWidth; // Trigger reflow
            input.classList.add('input-shake');
            input.focus();
            return;
        }
        
        // Immediately clear the input for the next entry.
        input.value = ''; 
        input.focus();

        // Enqueue the spin for processing in the background.
        // Do not `await` this call. Let it run asynchronously.
        // This makes the UI responsive and prevents hangs.
        enqueueSpin(val).catch(error => {
            console.error("Error processing spin in background:", error);
            // Here you could show a toast or other non-blocking error message to the user
        });
    }
    async function undoSpin() {
        if (state.history.length === 0) return;

        // 1. Remove the last spin
        state.history.pop();

        // 2. Clone the remaining spins to rebuild state
        const remainingSpins = state.history.map(s => s.num);

        // 3. Rebuild in background so large histories don't lock the UI.
        await rebuildSessionFromSpins(remainingSpins, { scrollToEnd: false });
    }

    async function processSpinValue(val, options = {}) {
        // Animate the Plus Icon on Add
        const btn = state.cachedAddSpinBtn || document.getElementById('addSpinBtn');
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
        for (let f = 1; f <= 5; f++) state.faceGaps[f]++;
        matchedFaces.forEach(f => state.faceGaps[f] = 0);
        if (!options.silent) {
            renderGapStats();
        }

        const currentSpinIndex = state.history.length;

        // 1. RESOLVE PREVIOUS BETS
        // RESOLVE ALL BETS (Active & Background) via EngineCore
        const resolvedBets = window.EngineCore.resolveTurn(
            val,
            matchedFaceMask,
            state.activeBets,
            state.currentGameplayStrategy,
            updateUserStats,
            {
                historyLength: currentSpinIndex,
                faceMasks: FACE_MASKS,
                faces: FACES
            }
        );
        state.activeBets = [];

        // 2. ADD TO HISTORY
        const spinObj = {
            num: val,
            faces: matchedFaces, // Store array of matching faces
            index: currentSpinIndex,
            resolvedBets: resolvedBets, // Store results
            newSignals: [],             // Placeholder for signals generated this turn
            id: ++state.globalSpinIdCounter
        };
        state.history.push(spinObj);
        if (options.skipStoreSync !== true && window.AppStore && typeof window.AppStore.dispatch === 'function') {
            const safeSpin = window.EngineContract && typeof window.EngineContract.sanitizeSpinObject === 'function'
                ? window.EngineContract.sanitizeSpinObject(spinObj, currentSpinIndex)
                : spinObj;
            window.AppStore.dispatch('history/append', safeSpin);
        }
        await refreshAiRelayStatus({ silent: true, updateUi: true });
        window.AiBrain.settleLedger(state.history);
        refreshAdvancementStates();

        // 3. SCAN FOR NEW PATTERNS
        let alerts = [];
        try {
            alerts = await scanAllStrategies({ skipStoreSync: options.skipStoreSync === true || options.silent === true });
        } catch (error) {
            console.error('Strategy scan failed for this spin:', error);
            alerts = window.currentAlerts || [];
        }

        if (state.neuralPredictionEnabled && !options.silent && options.skipNeural !== true) {
            // Run AI in background to keep math engine fast & responsive
            requestNeuralPrediction({ renderDashboardNow: true }).catch(error => {
                console.error('Neural prediction request failed:', error);
            });
            alerts = window.currentAlerts || [];
        }

        // 4. PREPARE NEW SIGNALS FOR DISPLAY (Next Spin's Bets)
        // These are what show up on the dashboard, but we also want to show them in the table row
        if (window.EngineAdapter && typeof window.EngineAdapter.toSpinSignals === 'function') {
            spinObj.newSignals = window.EngineAdapter.toSpinSignals(state.activeBets, {
                neuralPredictionEnabled: state.neuralPredictionEnabled,
                currentNeuralSignal: state.currentNeuralSignal,
                buildPredictionLogSignal
            });
        } else if (state.neuralPredictionEnabled && state.currentNeuralSignal) {
            spinObj.newSignals = [buildPredictionLogSignal(state.currentNeuralSignal)];
        } else if (state.activeBets.length > 0) {
            spinObj.newSignals = state.activeBets.map(b => ({
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
            renderDashboardSafe(alerts);
            debounceHeavyUIUpdates();
        }

        if (!options.preserveInput) {
            const inputField = document.getElementById('spinInput');
            if (inputField) {
                inputField.value = '';
                inputField.focus();
            }
        }
        
        if (!options.silent) {
            saveSessionData();
            syncAppStore();
        }

        return alerts;
    }

    function handleGridClick(n) {
        document.getElementById('spinInput').value = n;
        void addSpin();
    }
})();
