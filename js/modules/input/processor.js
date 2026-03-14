
(function () {
    const state = window.state;
    window.InputProcessor = {
        init,
        addSpin,
        undoSpin,
        handleGridClick,
        processSpinValue,
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
        if (window.rebuildSessionFromSpins) await window.rebuildSessionFromSpins(remainingSpins, { scrollToEnd: false });
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

        const matchedFaces = Object.prototype.hasOwnProperty.call(window.FON_MAP, val)
            ? window.FON_MAP[val].slice()
            : [];
        const matchedFaceMask = Object.prototype.hasOwnProperty.call(window.FON_MASK_MAP, val)
            ? window.FON_MASK_MAP[val]
            : 0;

        // Update Gaps for ALL matching faces
        for (let f = 1; f <= 5; f++) state.faceGaps[f]++;
        matchedFaces.forEach(f => state.faceGaps[f] = 0);

        const currentSpinIndex = state.history.length;

        // 1. RESOLVE PREVIOUS BETS
        // RESOLVE ALL BETS (Active & Background) via EngineCore
        const resolvedBets = window.EngineCore.resolveTurn(
            val,
            matchedFaceMask,
            state.activeBets,
            state.currentGameplayStrategy,
            window.updateUserStats || function () { },
            {
                historyLength: currentSpinIndex,
                faceMasks: window.FACE_MASKS,
                faces: window.FACES
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
        // 3. SCAN FOR NEW PATTERNS
        let scanResult = { nextBets: [], resultsByStrategy: {} };
        try {
            if (window.scanAllStrategies) {
                scanResult = await window.scanAllStrategies({
                    skipStoreSync: options.skipStoreSync === true || options.silent === true
                });
            }
        } catch (error) {
            console.error('Strategy scan failed for this spin:', error);
        }

        // Bridge: Capture the engine's produced bets for dashboard display and next turn resolution
        state.activeBets = scanResult.nextBets || [];
        state.engineSnapshot = scanResult;
        
        // CRITICAL: Attach active signals BEFORE the UI render dispatch
        spinObj.newSignals = state.activeBets;

        // 4. SYNC TO APP STORE (TRIGGER UI RENDER)
        if (options.skipStoreSync !== true && window.AppStore && typeof window.AppStore.dispatch === 'function') {
            const safeSpin = window.EngineContract && typeof window.EngineContract.sanitizeSpinObject === 'function'
                ? window.EngineContract.sanitizeSpinObject(spinObj, currentSpinIndex)
                : spinObj;
            window.AppStore.dispatch('history/append', safeSpin);
        }
        
        console.log('[ENGINE] Scan Result:', scanResult);
        console.log('[ENGINE] Active Bets:', state.activeBets);

        if (state.neuralPredictionEnabled && !options.silent && options.skipNeural !== true) {
            // Run AI in background to keep math engine fast & responsive
            if (window.requestNeuralPrediction) window.requestNeuralPrediction({ renderDashboardNow: true }).catch(error => {
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
                buildPredictionLogSignal: window.buildPredictionLogSignal
            });
        } else if (state.neuralPredictionEnabled && state.currentNeuralSignal) {
            if (window.buildPredictionLogSignal) spinObj.newSignals = [window.buildPredictionLogSignal(state.currentNeuralSignal)];
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

        // UI Rendering is now handled reactively via AppStore.subscribe listening to history/append and engine/sync

        if (!options.preserveInput) {
            const inputField = document.getElementById('spinInput');
            if (inputField) {
                inputField.value = '';
                inputField.focus();
            }
        }

        if (!options.silent) {
            if (window.saveSessionData) window.saveSessionData();
            if (window.syncAppStore) window.syncAppStore();
        }

        return alerts;
    }

    function handleGridClick(n) {
        document.getElementById('spinInput').value = n;
        void addSpin();
    }
})();
