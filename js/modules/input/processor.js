
(function () {
    function getState() {
        if (!window.state) {
            window.state = { history: [], faceGaps: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }, activeBets: [], currentGameplayStrategy: 'inside' };
        }
        if (!window.state.history) window.state.history = [];
        if (!window.state.faceGaps) window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        if (!window.state.activeBets) window.state.activeBets = [];
        if (!window.state.currentGameplayStrategy) window.state.currentGameplayStrategy = 'inside';
        return window.state;
    }
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

            // Add Enter key listener explicitly
            spinInputEl.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    e.preventDefault();
                    addSpin();
                }
            });
            spinInputEl.focus();
        }

        const addBtn = document.getElementById('addSpinBtn');
        if (addBtn) {
            addBtn.addEventListener('click', (e) => {
                e.preventDefault();
                addSpin();
            });
        }

        // Enforce global routing to bypass legacy script conflicts
        window.addSpin = addSpin;
        window.handleGridClick = handleGridClick;
        window.undoSpin = undoSpin;

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
        const stateRef = getState();
        stateRef.spinProcessingQueue = (stateRef.spinProcessingQueue || Promise.resolve())
            .catch(error => {
                // Recover the queue so one failed spin does not block all future input.
                console.error('Recovered spin queue after an error:', error);
                if (window.UiController && window.UiController.showToast) {
                    window.UiController.showToast('Queue recovery: ' + error.message, 'error');
                }
            })
            .then(() => processSpinValue(val));
        return stateRef.spinProcessingQueue;
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
            if (window.UiController && window.UiController.showToast) {
                window.UiController.showToast('Failed to process spin: ' + error.message, 'error');
            }
        });
    }
    async function undoSpin() {
        const stateRef = getState();
        if (!stateRef.history || stateRef.history.length === 0) return;

        // Lock to prevent multiple spins from being removed by rapid clicks
        if (stateRef.isUndoing) return;
        stateRef.isUndoing = true;

        try {
            // 1. Remove the last spin
            stateRef.history.pop();

            // 2. Clone the remaining spins to rebuild state
            const remainingSpins = stateRef.history.map(s => s.num);

            // 3. Rebuild in background so large histories don't lock the UI.
            if (window.rebuildSessionFromSpins) await window.rebuildSessionFromSpins(remainingSpins, { scrollToEnd: false });
        } finally {
            stateRef.isUndoing = false;
        }
    }

    async function processSpinValue(val, options = {}) {
        // Animate the Plus Icon on Add
        const stateRef = getState();
        const btn = stateRef.cachedAddSpinBtn || document.getElementById('addSpinBtn');
        if (btn && !options.silent) {
            const icon = btn.querySelector('.fa-plus');
            if (icon) {
                icon.classList.remove('animate-spin-pop');
                void icon.offsetWidth; // Force reflow
                icon.classList.add('animate-spin-pop');
            }
        }

        // Safely resolve data maps avoiding ReferenceErrors or TypeErrors
        const fonMap = window.FON_MAP || (typeof FON_MAP !== 'undefined' ? FON_MAP : {});
        const fonMaskMap = window.FON_MASK_MAP || (typeof FON_MASK_MAP !== 'undefined' ? FON_MASK_MAP : {});
        const faceMasks = window.FACE_MASKS || (typeof FACE_MASKS !== 'undefined' ? FACE_MASKS : {});
        const faces = window.FACES || (typeof FACES !== 'undefined' ? FACES : {});

        const matchedFaces = Object.prototype.hasOwnProperty.call(fonMap, val)
            ? fonMap[val].slice()
            : [];
        const matchedFaceMask = Object.prototype.hasOwnProperty.call(fonMaskMap, val)
            ? fonMaskMap[val]
            : 0;

        // Update Gaps for ALL matching faces
        for (let f = 1; f <= 5; f++) stateRef.faceGaps[f] = (stateRef.faceGaps[f] || 0) + 1;
        matchedFaces.forEach(f => stateRef.faceGaps[f] = 0);

        const currentSpinIndex = stateRef.history.length;

        // 1. RESOLVE PREVIOUS BETS
        let resolvedBets = [];
        if (stateRef.activeBets && stateRef.activeBets.length > 0) {
            stateRef.activeBets.forEach(bet => {
                if (bet.status === 'SIT_OUT' || !bet.targetFace) return;
                const targetMask = faceMasks[bet.targetFace] || 0;
                const isWin = (matchedFaceMask & targetMask) !== 0;
                resolvedBets.push({
                    patternName: bet.patternName || 'Unknown',
                    filterKey: bet.filterKey || bet.patternName,
                    strategy: bet.strategy || '',
                    targetFace: bet.targetFace,
                    isWin: isWin,
                    label: `BET F${bet.targetFace}`,
                    confirmed: bet.confirmed === true
                });
            });
        }

        // Also call the engine's internal resolver so it can update its own internal state if needed
        if (window.EngineCore && typeof window.EngineCore.resolveTurn === 'function') {
            try {
                window.EngineCore.resolveTurn(val, matchedFaceMask, stateRef.activeBets, stateRef.currentGameplayStrategy, window.updateUserStats, {
                    historyLength: currentSpinIndex,
                    faceMasks: faceMasks,
                    faces: faces
                });
            } catch (e) { console.error("EngineCore resolve error:", e); }
        }
        stateRef.activeBets = [];

        // 1.5 AMBIENT AUDIO FEEDBACK
        if (!options.silent && resolvedBets.length > 0 && window.AudioEngine) {
            const hasWin = resolvedBets.some(b => b.isWin);
            if (hasWin) {
                window.AudioEngine.playWin();
            } else {
                window.AudioEngine.playLoss();
            }
        }

        // 2. ADD TO HISTORY
        const spinObj = {
            num: val,
            faces: matchedFaces, // Store array of matching faces
            index: currentSpinIndex,
            resolvedBets: resolvedBets, // Store results
            newSignals: [],             // Placeholder for signals generated this turn
            id: ++stateRef.globalSpinIdCounter || 1
        };
        stateRef.history.push(spinObj);
        // 3. SCAN FOR NEW PATTERNS
        let scanResult = { nextBets: [], resultsByStrategy: {} };
        if (!options.fastReplay) {
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
            stateRef.activeBets = scanResult.nextBets || [];
            window.activeBets = stateRef.activeBets;
            window.currentAlerts = Array.isArray(scanResult.notifications) ? scanResult.notifications : [];
            if (stateRef.strategySyncCache && typeof stateRef.strategySyncCache === 'object') {
                const strategyKey = stateRef.currentGameplayStrategy || 'inside';
                stateRef.strategySyncCache[strategyKey] = scanResult;
            }

            // CRITICAL: Attach active MATH signals permanently to history row BEFORE we modify activeBets for AI
            spinObj.newSignals = stateRef.activeBets.map(b => ({
                patternName: b.patternName,
                filterKey: b.filterKey || b.patternName,
                targetFace: b.targetFace,
                comboLabel: b.comboLabel || null,
                confidence: Number.isFinite(b.confidence) ? b.confidence : null,
                reason: b.reason || b.subtitle || '',
                mode: b.mode || null,
                status: b.status || 'GO',
                signalSource: b.signalSource || 'math',
                accentColor: b.accentColor
            }));
        }



        // 4. SYNC TO APP STORE (TRIGGER UI RENDER)
        if (!options.fastReplay) {
            if (options.skipStoreSync !== true && window.AppStore && typeof window.AppStore.dispatch === 'function') {
                const safeSpin = window.EngineContract && typeof window.EngineContract.sanitizeSpinObject === 'function'
                    ? window.EngineContract.sanitizeSpinObject(spinObj, currentSpinIndex)
                    : spinObj;
                window.AppStore.dispatch('history/append', safeSpin);
            } else if (options.skipStoreSync !== true) {
                // MASSIVE FAILSAFE: Direct UI update if AppStore is completely missing
                if (!window.state.engineStats) window.state.engineStats = { totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0, bankrollHistory: [0], patternStats: {}, signalLog: [] };
                const eStats = window.state.engineStats;
                resolvedBets.forEach(bet => {
                    const count = faces[bet.targetFace] ? faces[bet.targetFace].nums.length : 0;
                    const unitChange = bet.isWin ? (35 - count) : -count;
                    const pName = bet.patternName || 'Unknown';
                    if (bet.isWin) { eStats.totalWins++; eStats.currentStreak = eStats.currentStreak >= 0 ? eStats.currentStreak + 1 : 1; }
                    else { eStats.totalLosses++; eStats.currentStreak = eStats.currentStreak <= 0 ? eStats.currentStreak - 1 : -1; }
                    eStats.netUnits += unitChange;
                    eStats.bankrollHistory.push(eStats.netUnits);
                    if (!eStats.patternStats[pName]) eStats.patternStats[pName] = { wins: 0, losses: 0 };
                    if (bet.isWin) eStats.patternStats[pName].wins++; else eStats.patternStats[pName].losses++;
                    eStats.signalLog.push({ result: bet.isWin ? 'WIN' : 'LOSS', units: unitChange, patternName: pName, spinIndex: spinObj.index, spinNum: spinObj.num });
                    if (bet.confirmed && window.updateUserStats) window.updateUserStats(bet.isWin, bet, spinObj.index, unitChange);
                });

                if (window.renderRow) window.renderRow(spinObj);
                if (window.renderGapStats) window.renderGapStats();
                if (window.renderDashboardSafe) window.renderDashboardSafe(stateRef.activeBets || []);
                else if (window.renderDashboard) window.renderDashboard(window.currentAlerts || []);
            }
        }

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

        return scanResult;
    }

    function handleGridClick(n) {
        document.getElementById('spinInput').value = n;
        if (window.AudioEngine) {
            window.AudioEngine.playChip();
        }
        void addSpin();
    }
})();
