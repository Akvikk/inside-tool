async function renderHistoryChunked(spins = state.history) {
    const tbody = document.getElementById('historyBody');
    if (!tbody) return;

    const renderVersion = ++state.historyRenderVersion;
    const rows = Array.isArray(spins) ? spins : state.history;
    tbody.innerHTML = '';

    for (let start = 0; start < rows.length; start += state.HISTORY_RENDER_CHUNK_SIZE) {
        if (renderVersion !== state.historyRenderVersion) return;

        const fragment = document.createDocumentFragment();
        const chunk = rows.slice(start, start + state.HISTORY_RENDER_CHUNK_SIZE);
        chunk.forEach(spin => renderRow(spin, fragment));
        tbody.appendChild(fragment);

        if (start + state.HISTORY_RENDER_CHUNK_SIZE < rows.length) {
            await yieldToMainThread();
        }
    }

    if (renderVersion === state.historyRenderVersion) {
        refreshHighlights();
        requestAnimationFrame(layoutAllComboBridges);
    }
}

async function flushRebuiltSessionUi(options = {}) {
    await renderHistoryChunked(state.history);
    renderGapStats();
    renderDashboardSafe(window.currentAlerts || []);

    const analyticsModal = document.getElementById('analyticsModal');
    if (analyticsModal && !analyticsModal.classList.contains('hidden')) {
        renderAnalyticsSafe();
    }

    const betsModal = document.getElementById('betsModal');
    if (betsModal && !betsModal.classList.contains('hidden')) {
        renderUserAnalytics();
    }

    updatePerimeterAnalytics();
    updateAnalyticsHUD();
    refreshHighlights();
    renderIntelligencePanel();
    syncAppStore();
    saveSessionData();

    if (options.scrollToEnd === true) {
        const sc = document.querySelector('#scrollContainer > div');
        if (sc) sc.scrollTop = sc.scrollHeight;
    }
}

async function rebuildSessionFromSpins(spinValues, options = {}) {
    const inputField = document.getElementById('spinInput');
    const normalizedSpins = [];

    if (inputField) inputField.disabled = true;

    try {
        resetData(true);

        const source = Array.isArray(spinValues) ? spinValues : [];
        for (let i = 0; i < source.length; i++) {
            let value = source[i];
            if (typeof value === 'object' && value !== null && 'num' in value) {
                value = value.num;
            }

            const parsed = parseSpinNumber(value);
            if (parsed !== null) {
                normalizedSpins.push(parsed);
            }
        }

        for (let i = 0; i < normalizedSpins.length; i++) {
            await processSpinValue(normalizedSpins[i], {
                silent: true,
                preserveInput: true,
                skipStoreSync: true,
                skipNeural: true
            });

            if ((i + 1) % state.BULK_REPLAY_CHUNK_SIZE === 0) {
                await yieldToMainThread();
            }
        }

        await flushRebuiltSessionUi(options);
        return normalizedSpins.length;
    } finally {
        if (inputField) {
            inputField.value = '';
            inputField.disabled = false;
            inputField.focus();
        }
    }
}
