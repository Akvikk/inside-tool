/**
 * HUD MANAGER MODULE (hud-manager.js)
 * Handles all logic for the floating Analytics HUD.
 */

(function () {
    const DEFAULT_HUD_RECENT_WINDOW = 14;

    function getSharedState() {
        if (!window.state || typeof window.state !== 'object') {
            window.state = {};
        }
        return window.state;
    }

    function getRecentWindow() {
        const sharedState = getSharedState();
        return Number.isInteger(sharedState.HUD_RECENT_WINDOW)
            ? sharedState.HUD_RECENT_WINDOW
            : DEFAULT_HUD_RECENT_WINDOW;
    }

    function getHudColdMode() {
        return getSharedState().isHudColdMode === true;
    }

    function setHudColdMode(nextValue) {
        const sharedState = getSharedState();
        sharedState.isHudColdMode = nextValue === true;
        return sharedState.isHudColdMode;
    }

    function getHudScope() {
        return getSharedState().hudHistoryScope === 'recent' ? 'recent' : 'all';
    }

    function getHudAnalyticsStrategy() {
        return getSharedState().analyticsDisplayStrategy === 'combo' ? 'combo' : 'series';
    }

    function setHudScope(nextScope) {
        const sharedState = getSharedState();
        sharedState.hudHistoryScope = nextScope === 'recent' ? 'recent' : 'all';
        return sharedState.hudHistoryScope;
    }

    function syncHudStrategyButtons(activeStrategy) {
        const seriesBtn = document.getElementById('hudStrategySeriesBtn');
        const comboBtn = document.getElementById('hudStrategyComboBtn');
        const isSeries = activeStrategy !== 'combo';

        if (seriesBtn) {
            seriesBtn.className = `hud-segment-btn ${isSeries ? 'is-active' : ''}`.trim();
        }

        if (comboBtn) {
            comboBtn.className = `hud-segment-btn ${isSeries ? '' : 'is-active'}`.trim();
        }
    }

    function syncHudColdButton(isColdMode) {
        const btn = document.getElementById('hudColdBtn');
        if (!btn) return;

        btn.className = 'hud-toolbar-btn';
        btn.style.color = isColdMode ? '#06b6d4' : '#ff9f0a';
        btn.style.borderColor = isColdMode ? 'rgba(6, 182, 212, 0.22)' : 'rgba(255, 159, 10, 0.22)';
        btn.style.background = isColdMode ? 'rgba(6, 182, 212, 0.08)' : 'rgba(255, 159, 10, 0.08)';
        btn.title = isColdMode ? 'Switch to hot view' : 'Switch to cold view';
        btn.innerHTML = `<i class="fas ${isColdMode ? 'fa-snowflake' : 'fa-fire'}"></i><span id="hudColdBtnLabel">${isColdMode ? 'Cold' : 'Hot'}</span>`;
    }

    function buildSeriesHudStats(history, windowSetting) {
        const historyArray = Array.isArray(history) ? history : [];
        const parsedWindow = Number.parseInt(windowSetting, 10);
        const useAllHistory = windowSetting === 'all' || windowSetting === Infinity || windowSetting === null;
        const safeWindow = useAllHistory
            ? Math.max(2, historyArray.length)
            : (Number.isNaN(parsedWindow) ? DEFAULT_HUD_RECENT_WINDOW : Math.max(2, Math.min(60, parsedWindow)));
        const recentSpins = historyArray.slice(-safeWindow);
        const sampleSize = Math.max(0, recentSpins.length - 1);
        const strategy = window.StrategyRegistry && window.StrategyRegistry.series
            ? window.StrategyRegistry.series
            : null;
        const sequences = strategy && Array.isArray(strategy.SEQUENCES) ? strategy.SEQUENCES : [];
        const colors = strategy && Array.isArray(strategy.SEQUENCE_COLORS) ? strategy.SEQUENCE_COLORS : [];

        const sequenceStats = sequences.map((seq, index) => {
            let hits = 0;
            let lastSeenIndex = -1;

            for (let spinIndex = 1; spinIndex < recentSpins.length; spinIndex++) {
                const prevSpin = recentSpins[spinIndex - 1];
                const currSpin = recentSpins[spinIndex];
                const prevFaces = Array.isArray(prevSpin && prevSpin.faces) ? prevSpin.faces : [];
                const currFaces = Array.isArray(currSpin && currSpin.faces) ? currSpin.faces : [];

                if (prevFaces.includes(seq.a) && currFaces.includes(seq.b)) {
                    hits++;
                    lastSeenIndex = spinIndex - 1;
                }
            }

            const sampleMisses = Math.max(0, sampleSize - hits);
            const hotPercent = sampleSize > 0 ? Math.round((hits / sampleSize) * 100) : 0;
            const coldPercent = sampleSize > 0 ? Math.round((sampleMisses / sampleSize) * 100) : 0;

            return {
                label: `(${String(seq.name || '').replace(/-/g, '')})`,
                color: colors[index % Math.max(1, colors.length)] || '#8E8E93',
                hits,
                sampleSize,
                sampleMisses,
                hotPercent,
                coldPercent,
                lastSeenDistance: lastSeenIndex < 0 ? '-' : Math.max(0, sampleSize - 1 - lastSeenIndex)
            };
        });

        return {
            sampleSize,
            items: sequenceStats,
            label: strategy && strategy.tableHeader ? strategy.tableHeader : 'SEQUENCE'
        };
    }

    function buildHudSummary(options) {
        const {
            displayLabel,
            strategyCopy,
            sampleValue,
            sampleCopy,
            leader,
            leaderPercent,
            leaderSampleSize,
            modeLabel
        } = options;

        const leaderRatio = leader
            ? `${leader.hits}/${Math.max(0, leaderSampleSize || 0)}`
            : '0/0';
        const leaderCopy = leader
            ? `${leaderRatio} | ${leaderPercent}% ${modeLabel.toLowerCase()}`
            : 'No dominant read';

        return `
            <div class="hud-summary-card">
                <div class="hud-summary-label">Strategy</div>
                <div class="hud-summary-value">${displayLabel}</div>
                <div class="hud-summary-copy">${strategyCopy}</div>
            </div>
            <div class="hud-summary-card">
                <div class="hud-summary-label">Sample</div>
                <div class="hud-summary-value">${sampleValue}</div>
                <div class="hud-summary-copy">${sampleCopy}</div>
            </div>
            <div class="hud-summary-card">
                <div class="hud-summary-label">Leader</div>
                <div class="hud-summary-value">${leader ? leader.label : '--'}</div>
                <div class="hud-summary-copy">${leaderCopy}</div>
            </div>
        `;
    }

    function buildHudEmptyState(message) {
        return `<div class="hud-empty-state">${message}</div>`;
    }

    function buildHudRowHtml(item, sampleSize, isHudColdMode, themeColor) {
        const ratioSampleSize = Number.isFinite(item.sampleSize) ? item.sampleSize : sampleSize;
        const percent = isHudColdMode ? item.coldPercent : item.hotPercent;
        const emphasis = isHudColdMode ? percent >= 80 : percent >= 20;
        const opacity = emphasis ? '1' : '0.62';
        const barColor = emphasis ? themeColor : 'rgba(255,255,255,0.28)';

        return `
            <div class="hud-row">
                <div class="hud-row-label" style="color:${item.color}; opacity:${opacity}">${item.label}</div>
                <div class="hud-row-metrics" style="opacity:${opacity}">
                    <div class="hud-row-ratio">${item.hits}/${ratioSampleSize}</div>
                    <div class="hud-row-bar">
                        <span class="hud-row-bar-fill" style="width:${Math.max(0, Math.min(100, percent))}%; background:${barColor};"></span>
                    </div>
                </div>
                <div class="hud-row-percent" style="color:${barColor}; opacity:${opacity}">${percent}%</div>
            </div>
        `;
    }

    function getHudScopeSummary() {
        const history = window.state ? window.state.history : [];
        const hudHistoryScope = getHudScope();
        const recentWindow = getRecentWindow();
        if (hudHistoryScope === 'recent') {
            return history.length > 0
                ? `Last ${Math.min(recentWindow, history.length)} Spins`
                : `Last ${recentWindow} Spins`;
        }
        return history.length > 0 ? `All ${history.length} Spins` : 'All History';
    }

    function getHudDisplayData(history, hudStrategy, windowSetting) {
        if (hudStrategy === 'series') {
            const seriesStats = buildSeriesHudStats(history, windowSetting);
            return {
                columnLabel: 'Sequence',
                strategyLabel: 'Series',
                strategyCopy: 'Sequence transition telemetry',
                items: Array.isArray(seriesStats.items) ? seriesStats.items.slice() : [],
                sampleSize: Number.isFinite(seriesStats.sampleSize) ? seriesStats.sampleSize : 0,
                sampleCopy: Number.isFinite(seriesStats.sampleSize) && seriesStats.sampleSize === 1
                    ? '1 transition measured'
                    : `${Number.isFinite(seriesStats.sampleSize) ? seriesStats.sampleSize : 0} transitions measured`
            };
        }

        if (!window.PredictionEngine || typeof window.PredictionEngine.calculatePerimeterStats !== 'function') {
            return {
                columnLabel: 'Combo',
                strategyLabel: 'Combo',
                strategyCopy: 'Perimeter pair telemetry',
                items: [],
                sampleSize: 0,
                sampleCopy: 'Prediction engine unavailable'
            };
        }

        const comboStats = window.PredictionEngine.calculatePerimeterStats(history, windowSetting);
        if (!comboStats || !comboStats.counts) {
            return {
                columnLabel: 'Combo',
                strategyLabel: 'Combo',
                strategyCopy: 'Perimeter pair telemetry',
                items: [],
                sampleSize: 0,
                sampleCopy: 'Awaiting telemetry'
            };
        }

        const transitionCount = Number.isFinite(comboStats.transitionCount) ? comboStats.transitionCount : 0;
        return {
            columnLabel: 'Combo',
            strategyLabel: 'Combo',
            strategyCopy: 'Perimeter pair telemetry',
            items: Array.isArray(comboStats.comboStats) ? comboStats.comboStats.slice() : [],
            sampleSize: Number.isFinite(comboStats.sampleSize) ? comboStats.sampleSize : 0,
            sampleCopy: transitionCount === 1
                ? '1 transition measured'
                : `${transitionCount} transitions measured`
        };
    }

    // --- PUBLIC INTERFACE ---
    window.HudManager = {
        init: initAnalyticsHUD,
        toggle: toggleAnalyticsHUD,
        update: updateAnalyticsHUD,
        toggleColdMode: toggleHudColdMode,
        toggleScope: toggleHudHistoryScope,
        setStrategy: setHudAnalyticsStrategy,
        getStrategy: getHudAnalyticsStrategy,
        fit: fitAnalyticsHUD,
        getIsColdMode: getHudColdMode,
        getScope: getHudScope
    };

    // Export to window for global access (backward compatibility for index.html)
    window.toggleAnalyticsHUD = toggleAnalyticsHUD;
    window.toggleHudColdMode = toggleHudColdMode;
    window.toggleHudHistoryScope = toggleHudHistoryScope;
    window.setHudAnalyticsStrategy = setHudAnalyticsStrategy;

    function fitAnalyticsHUD() {
        const hud = document.getElementById('analyticsHUD');
        const header = document.getElementById('hudHeader');
        const body = document.getElementById('hudBody');
        if (!hud || !header || !body || hud.classList.contains('hidden')) return;

        requestAnimationFrame(() => {
            const maxHeight = Math.max(240, window.innerHeight - hud.offsetTop - 8);
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

            if (!hud.style.left || hud.style.left === 'auto') {
                hud.style.left = `${hud.offsetLeft}px`;
            }
            hud.style.right = 'auto';

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
        if (!hud || !btn) return;

        if (hud.classList.contains('hidden')) {
            hud.classList.remove('hidden');
            hud.classList.add('flex');
            btn.classList.add('bg-white/10', 'is-active');
            initAnalyticsHUD();
            updateAnalyticsHUD();
            fitAnalyticsHUD();
        } else {
            hud.classList.add('hidden');
            hud.classList.remove('flex');
            btn.classList.remove('bg-white/10', 'is-active');
        }
    }

    function toggleHudColdMode() {
        setHudColdMode(!getHudColdMode());
        if (window.saveSessionData) window.saveSessionData();
        updateAnalyticsHUD();
    }

    function toggleHudHistoryScope() {
        const nextScope = getHudScope() === 'all' ? 'recent' : 'all';
        setHudScope(nextScope);
        if (window.saveSessionData) window.saveSessionData();
        updateAnalyticsHUD();
    }

    function setHudAnalyticsStrategy(nextStrategy) {
        const normalized = nextStrategy === 'combo' ? 'combo' : 'series';
        const sharedState = getSharedState();
        sharedState.analyticsDisplayStrategy = normalized;
        syncHudStrategyButtons(normalized);
        if (window.saveSessionData) window.saveSessionData();
        if (window.renderAnalytics) window.renderAnalytics();
        updateAnalyticsHUD();
        return normalized;
    }

    function updateAnalyticsHUD() {
        const hud = document.getElementById('analyticsHUD');
        if (!hud || hud.classList.contains('hidden')) return;

        const headerTitle = document.getElementById('hudHeaderTitle');
        const hudLabel = document.getElementById('hudWindowValue');
        const hudScopeBtn = document.getElementById('hudScopeBtn');
        const hudSummary = document.getElementById('hudSummary');
        const hudColumnLabel = document.getElementById('hudColumnLabel');
        const hudMetricLabel = document.getElementById('hudMetricLabel');
        const hudRateLabel = document.getElementById('hudRateLabel');
        const content = document.getElementById('hudStats');
        if (!content) return;

        const isHudColdMode = getHudColdMode();
        const hudHistoryScope = getHudScope();
        const hudStrategy = getHudAnalyticsStrategy();
        const recentWindow = getRecentWindow();
        const history = window.state ? window.state.history : [];
        const themeColor = isHudColdMode ? '#06b6d4' : '#30D158';
        const modeLabel = isHudColdMode ? 'Cold' : 'Hot';
        const isRecentScope = hudHistoryScope === 'recent';
        const scopeSummary = getHudScopeSummary();
        const displayData = getHudDisplayData(history, hudStrategy, isRecentScope ? recentWindow : 'all');
        const displayCombos = Array.isArray(displayData.items) ? displayData.items.slice() : [];
        const sampleSize = Number.isFinite(displayData.sampleSize) ? displayData.sampleSize : 0;

        if (isHudColdMode) {
            displayCombos.sort((a, b) => b.coldPercent - a.coldPercent || b.sampleMisses - a.sampleMisses || a.hits - b.hits);
        } else {
            displayCombos.sort((a, b) => b.hotPercent - a.hotPercent || b.hits - a.hits || a.sampleMisses - b.sampleMisses);
        }

        const leader = sampleSize > 0 && displayCombos.length > 0 ? displayCombos[0] : null;
        const leaderPercent = leader ? (isHudColdMode ? leader.coldPercent : leader.hotPercent) : 0;
        const leaderSampleSize = leader
            ? (Number.isFinite(leader.sampleSize) ? leader.sampleSize : sampleSize)
            : sampleSize;

        syncHudStrategyButtons(hudStrategy);
        syncHudColdButton(isHudColdMode);
        if (document.body && document.body.classList) {
            document.body.classList.toggle('hud-cold-mode', isHudColdMode);
        }

        if (headerTitle) {
            const iconClass = isHudColdMode
                ? 'fa-snowflake'
                : (hudStrategy === 'combo' ? 'fa-chart-line' : 'fa-wave-square');
            headerTitle.innerHTML = `<i class="fas ${iconClass}"></i><span>${displayData.strategyLabel} ${isHudColdMode ? 'Cold Scan' : 'Live Feed'}</span>`;
            headerTitle.style.color = themeColor;
        }

        if (hudLabel) {
            hudLabel.innerText = scopeSummary;
            hudLabel.style.color = themeColor;
        }

        if (hudScopeBtn) {
            hudScopeBtn.innerText = isRecentScope ? String(recentWindow) : 'ALL';
            hudScopeBtn.title = hudHistoryScope === 'all'
                ? `Switch to ${recentWindow}-spin rolling window`
                : 'Switch to all history';
            hudScopeBtn.className = 'hud-toolbar-btn';
            hudScopeBtn.style.color = isRecentScope ? themeColor : 'rgba(255,255,255,0.88)';
            hudScopeBtn.style.borderColor = isRecentScope ? `${themeColor}55` : 'rgba(255,255,255,0.22)';
            hudScopeBtn.style.background = isRecentScope ? `${themeColor}22` : 'rgba(255,255,255,0.10)';
        }

        if (hudSummary) {
            hudSummary.innerHTML = buildHudSummary({
                displayLabel: displayData.strategyLabel,
                strategyCopy: `${displayData.strategyCopy} | ${modeLabel}`,
                sampleValue: `${sampleSize}`,
                sampleCopy: `${scopeSummary} | ${displayData.sampleCopy}`,
                leader,
                leaderPercent,
                leaderSampleSize,
                modeLabel
            });
        }

        if (hudColumnLabel) hudColumnLabel.innerText = displayData.columnLabel;
        if (hudMetricLabel) hudMetricLabel.innerText = 'Activity';
        if (hudRateLabel) hudRateLabel.innerText = `${modeLabel} %`;

        if (sampleSize === 0 || displayCombos.length === 0) {
            content.innerHTML = buildHudEmptyState('Awaiting telemetry...');
            fitAnalyticsHUD();
            return;
        }

        content.innerHTML = displayCombos
            .map((item) => buildHudRowHtml(item, sampleSize, isHudColdMode, themeColor))
            .join('');

        fitAnalyticsHUD();
    }

})();
