(function () {
    'use strict';

    window.applyAnalyticsTabUI = function () {
        const displayMode = window.state ? window.state.analyticsDisplayStrategy : 'series';
        const select = document.getElementById('analyticsStrategySelect');
        if (select) select.value = displayMode;

        const tabs = window.getAnalyticsTabConfig ? window.getAnalyticsTabConfig() : [];
        const activeTab = window.ensureActiveAnalyticsTab ? window.ensureActiveAnalyticsTab(tabs) : '';
        tabs.forEach(tab => {
            const btn = tab.button;
            const panel = document.getElementById(tab.panelId);
            if (btn) btn.className = tab.key === activeTab ? "pb-2 text-xs font-bold uppercase tracking-widest text-[#30D158] border-b-2 border-[#30D158] transition-all" : "pb-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all";
            if (panel) { if (tab.key === activeTab) panel.classList.remove('hidden'); else panel.classList.add('hidden'); }
        });
    };

    window.renderGapStats = function () {
        const container = document.getElementById('faceHeatmapGrid') || document.getElementById('faceGapContainer');
        if (!container) return;
        container.innerHTML = '';
        for (let f = 1; f <= 5; f++) {
            const gap = window.state.faceGaps ? window.state.faceGaps[f] || 0 : 0;
            let colorClass = 'text-[#30D158]';
            if (gap > 10) colorClass = 'text-[#FFD60A]';
            if (gap > 15) colorClass = 'text-[#FF453A]';
            container.innerHTML += `<div class="text-center p-2 rounded-xl bg-white/5 border border-white/5 shadow-sm backdrop-blur-sm transition-all hover:bg-white/10"><span class="block text-gray-400 text-[9px] font-bold mb-0.5 uppercase tracking-wider">F${f}</span><span class="${colorClass} font-bold text-xl drop-shadow-sm">${gap}</span></div>`;
        }
    };

    window.getAnalyticsTabConfig = function () {
        const buttons = Array.from(document.querySelectorAll('[data-analytics-tab]'));
        if (buttons.length > 0) return buttons.map(button => ({ key: button.dataset.analyticsTab, button, panelId: button.dataset.analyticsPanel || '', rendererName: button.dataset.analyticsRenderer || '' })).filter(tab => tab.key && tab.panelId);
        return [{ key: 'strategy', button: document.getElementById('tabBtnStrategy'), panelId: 'strategyAnalyticsPanel', rendererName: 'renderStrategyAnalytics' }, { key: 'intelligence', button: document.getElementById('tabBtnIntelligence'), panelId: 'intelligencePanel', rendererName: 'renderIntelligencePanel' }, { key: 'advancements', button: document.getElementById('tabBtnAdvancements'), panelId: 'advancementsPanel', rendererName: 'renderAdvancementAnalytics' }].filter(tab => tab.button);
    };

    window.ensureActiveAnalyticsTab = function (tabs) {
        if (!window.state || !Array.isArray(tabs) || tabs.length === 0) return window.state ? window.state.currentAnalyticsTab : '';
        const activeExists = tabs.some(tab => tab.key === window.state.currentAnalyticsTab);
        if (!activeExists) window.state.currentAnalyticsTab = tabs[0].key;
        return window.state.currentAnalyticsTab;
    };

    window.renderAdvancementAnalytics = function () {
        const advPanel = document.getElementById('advancementLogContainer');
        if (advPanel) advPanel.innerHTML = '<div class="text-white/40 text-center py-6 text-xs italic tracking-wide">Advancements tracking active. Awaiting threshold breaches.</div>';
    };

    window.renderAnalytics = function () {
        if (!window.state) return;
        const tabs = window.getAnalyticsTabConfig(), activeTab = window.ensureActiveAnalyticsTab(tabs);
        window.applyAnalyticsTabUI();
        const activeConfig = tabs.find(tab => tab.key === activeTab);
        if (!activeConfig || !activeConfig.rendererName) return;
        const renderer = window[activeConfig.rendererName];
        if (typeof renderer === 'function') renderer();
    };

    window.setAnalyticsDisplayStrategy = function (val) {
        if (!window.state) return;
        window.state.analyticsDisplayStrategy = val;
        window.renderAnalytics();
        if (window.saveSessionData) window.saveSessionData();
    };

    window.changeIntelMode = function (mode) {
        if (!window.state) return;
        window.state.currentIntelligenceMode = mode;
        window.renderAnalytics();
        if (window.saveSessionData) window.saveSessionData();
    };

    window.sortEngineReadCombos = function (comboStats) { return (comboStats || []).slice().sort((a, b) => (b.hits - a.hits) || ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) || (a.label > b.label ? 1 : -1)); };
    window.getEngineStateTone = function (stateStr) { const tones = { BUILDING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded', WAITING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded', READY: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2 py-0.5 rounded', FOLLOW_UP: 'text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded', WATCHLIST: 'text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded', NO_SIGNAL: 'text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded' }; return tones[stateStr] || 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded'; };
    window.getMetricToneClass = function (metric, value) { switch (metric) { case 'hits': if (value >= 3) return 'text-[#22c55e] drop-shadow-sm font-bold'; if (value === 2) return 'text-[#d4af37] font-bold'; if (value === 1) return 'text-[#d33838]'; return 'text-gray-500 opacity-50'; case 'hotPercent': case 'coldPercent': if (value >= (metric === 'hotPercent' ? 25 : 85)) return 'text-[#22c55e] drop-shadow-sm font-bold'; if (value >= (metric === 'hotPercent' ? 15 : 65)) return 'text-[#d4af37] font-bold'; if (value > 0) return 'text-[#d33838]'; return 'text-gray-500 opacity-50'; case 'margin': if (value >= 2) return 'text-[#22c55e] font-bold'; if (value === 1) return 'text-[#d4af37] font-bold'; if (value === 0) return 'text-[#d33838]'; return 'text-gray-500 opacity-50'; case 'confirmation': return value >= 1 ? 'text-[#22c55e] drop-shadow-sm font-bold' : 'text-[#d33838] font-bold'; case 'lastSeen': if (value === null || value === undefined || value === '-') return 'text-gray-500 opacity-50'; if (value <= 1) return 'text-[#22c55e] font-bold'; if (value <= 3) return 'text-[#d4af37] font-bold'; return 'text-[#d33838] font-bold'; case 'checkpoint': if (value <= 1) return 'text-[#d4af37] font-bold'; if (value <= 3) return 'text-[#d33838] font-bold'; return 'text-gray-500 opacity-50'; default: return 'text-gray-500 opacity-50'; } };
    window.getPredictionToneClass = function (snapshot) { if (!snapshot) return 'text-gray-500'; if (snapshot.currentPrediction) return 'text-[#22c55e] font-bold drop-shadow-sm'; if (snapshot.engineState === 'WATCHLIST') return 'text-[#d4af37] font-bold'; if (snapshot.engineState === 'NO_SIGNAL') return 'text-gray-400'; return 'text-gray-500'; };
    window.formatEnginePrediction = function (snapshot) { if (!snapshot) return 'No engine state available.'; if (snapshot.currentPrediction) { const action = snapshot.currentPrediction.action || 'BET'; const confidence = Number.isFinite(snapshot.currentPrediction.confidence) && snapshot.currentPrediction.confidence > 0 ? ` ${snapshot.currentPrediction.confidence}%` : ''; return `${action} F${snapshot.currentPrediction.targetFace} via ${snapshot.currentPrediction.comboLabel}${confidence}.`; } return snapshot.watchlistMessage || snapshot.leadMessage || 'No actionable signal.'; };
    window.renderIntelligencePanel = function () { const content = document.getElementById('intelligenceContent'), stateChip = document.getElementById('intelStateChip'), checkpointSummary = document.getElementById('intelCheckpointSummary'), nextCheckpoint = document.getElementById('intelNextCheckpoint'); if (!content) return; const ENGINE_PRIMARY_WINDOW = window.config ? window.config.ENGINE_PRIMARY_WINDOW : 14, snapshot = window.state.engineSnapshot || {}, rankedCombos = window.sortEngineReadCombos(snapshot.comboCoverage || []), leadCombo = snapshot.dominantCombo, runnerUp = snapshot.runnerUpCombo; if (stateChip) { stateChip.innerText = snapshot.engineState || 'IDLE'; stateChip.className = `font-black text-[9px] tracking-widest uppercase ${window.getEngineStateTone(snapshot.engineState)}`; } if (checkpointSummary) { checkpointSummary.innerText = snapshot.checkpointStatus || 'Waiting for valid sample'; checkpointSummary.className = `font-bold text-[10px] tracking-widest uppercase ${window.getPredictionToneClass(snapshot)}`; } if (nextCheckpoint) { nextCheckpoint.innerText = snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW; nextCheckpoint.className = `text-lg font-black tracking-tighter ${window.getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}`; } const comboRows = rankedCombos.map((combo, index) => `<tr class="hover:bg-white/5 transition-colors"><td class="p-3 font-bold tracking-widest text-[10px]" style="color:${combo.color}">${index + 1}. ${combo.label}</td><td class="p-3 font-mono ${window.getMetricToneClass('hits', combo.hits)}">${combo.hits}</td><td class="p-3 font-mono ${window.getMetricToneClass('hotPercent', combo.hotPercent)}">${combo.hotPercent}%</td><td class="p-3 font-mono ${window.getMetricToneClass('coldPercent', combo.coldPercent)}">${combo.coldPercent}%</td><td class="p-3 font-mono ${window.getMetricToneClass('lastSeen', combo.lastSeenDistance ?? '-')}">${combo.lastSeenDistance ?? '-'}</td></tr>`).join(''); content.innerHTML = `<div class="grid grid-cols-2 gap-3 mt-2"><div class="col-span-2 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-xl p-4 text-center shadow-lg"><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Lead Insight</div><div class="text-lg mb-1 ${window.getPredictionToneClass(snapshot)}">${snapshot.leadMessage || 'Awaiting Valid Sample'}</div><div class="text-[11px] font-medium text-white/70">${window.formatEnginePrediction(snapshot)}</div></div><div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm"><div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Primary Read</div><div class="text-lg font-bold tracking-wide" style="color:${leadCombo ? leadCombo.color : '#f0f0f0'}">${leadCombo ? leadCombo.label : 'No combo'}</div></div><div class="text-[10px] text-white/60 mt-2">${leadCombo ? `<span class="${window.getMetricToneClass('hits', leadCombo.hits)}">${leadCombo.hits} hits</span> in rolling 14` : 'Waiting for a valid sample.'}</div></div><div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm"><div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Runner-Up Margin</div><div class="text-lg font-bold tracking-wide ${window.getMetricToneClass('margin', snapshot.topMargin)}">${leadCombo ? `${(snapshot.topMargin || 0) >= 0 ? '+' : ''}${snapshot.topMargin || 0}` : '-'}</div></div><div class="text-[10px] text-white/60 mt-2">${runnerUp ? `Runner-up is ${runnerUp.label} (${runnerUp.hits} hits)` : 'No runner-up yet.'}</div></div></div><div class="col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden mt-4 shadow-sm"><div class="bg-black/30 text-white/40 text-[9px] font-black uppercase tracking-widest p-3 border-b border-white/5">14-Spin Combo Ranking</div><table class="w-full text-left text-xs"><thead class="bg-black/10 text-white/30 uppercase text-[9px] tracking-wider border-b border-white/5"><tr><th class="p-3">Combo</th><th class="p-3">Hits</th><th class="p-3">Hot</th><th class="p-3">Cold</th><th class="p-3">Last Seen</th></tr></thead><tbody class="divide-y divide-white/5">${comboRows || '<tr><td colspan="5" class="p-6 text-center text-white/30 italic">Awaiting data...</td></tr>'}</tbody></table></div>`; };
    window.renderStrategyAnalytics = function () {
        let displayStrategy = 'series'; if (window.state) { if (window.state.analyticsDisplayStrategy === 'combo') displayStrategy = 'combo'; else if (window.state.analyticsDisplayStrategy === 'inside') displayStrategy = 'inside'; } const coreStats = (window.EngineCore && typeof window.EngineCore.getAnalyticsData === 'function') ? window.EngineCore.getAnalyticsData(displayStrategy) : { wins: 0, losses: 0, net: 0, streak: 0, history: [0], patterns: {} }; const totalSignals = coreStats.wins + coreStats.losses; const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.wins / totalSignals) * 100); const hrEl = document.getElementById('kpiHitRate'); if (hrEl) { hrEl.innerText = hitRate + "%"; hrEl.className = `text-2xl font-semibold tracking-tight ${totalSignals === 0 ? 'text-white' : (hitRate >= 50 ? 'text-[#22c55e]' : 'text-[#d33838]')}`; } const netEl = document.getElementById('kpiNet'); if (netEl) { netEl.innerText = (coreStats.net > 0 ? '+' : '') + coreStats.net; netEl.className = `text-2xl font-semibold tracking-tight ${coreStats.net > 0 ? 'text-[#22c55e]' : (coreStats.net < 0 ? 'text-[#d33838]' : 'text-white')}`; } const sigEl = document.getElementById('kpiSignals');
        if (sigEl) sigEl.innerText = totalSignals;

        if (window.drawAdvancedGraph) {
            window.drawAdvancedGraph(coreStats.history, coreStats.wins, coreStats.losses, 'graphContainer');
        }
    };

    window.drawAdvancedGraph = function (historyArray, winCount, lossCount, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        container.className = "flex flex-col h-full w-full rounded-b-xl overflow-hidden";

        const chartDiv = document.createElement('div');
        chartDiv.className = "relative h-[80%] w-full bg-black/20 group cursor-crosshair";
        container.appendChild(chartDiv);

        // HUD Overlay for Graph Stats
        const hudDiv = document.createElement('div');
        hudDiv.className = "h-[20%] w-full flex justify-between items-center px-4 text-[10px] font-bold bg-white/5 border-t border-white/5 backdrop-blur-sm";
        hudDiv.innerHTML = `
                <span class="text-[#30D158] drop-shadow-sm tracking-wide">WINS: ${winCount}</span>
                <span class="text-[#e5e7eb] drop-shadow-sm tracking-wide">SPINS: ${historyArray ? Math.max(0, historyArray.length - 1) : 0}</span>
                <span class="text-[#FF453A] drop-shadow-sm tracking-wide">LOSSES: ${lossCount}</span>
            `;
        container.appendChild(hudDiv);

        if (!historyArray || historyArray.length < 2) {
            chartDiv.innerHTML = `<div class="flex items-center justify-center h-full text-xs text-[#8E8E93] font-mono animate-pulse">Waiting for Data...</div>`;
            return;
        }

        // SVG Logic using Fixed ViewBox
        const vWidth = 600;
        const vHeight = 200;
        const padding = 10;

        const maxVal = Math.max(...historyArray);
        const minVal = Math.min(...historyArray);
        let range = maxVal - minVal;
        if (range === 0) range = 2;

        const getX = i => (i / (historyArray.length - 1)) * (vWidth - 2 * padding) + padding;
        const getY = v => vHeight - padding - ((v - minVal) / range) * (vHeight - 2 * padding);

        const points = historyArray.map((val, i) => ({ x: getX(i), y: getY(val) }));
        let pathD = `M ${points[0].x} ${points[0].y}`;

        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i === 0 ? 0 : i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

            const tension = 0.15; // Tight curve tension eliminates loopy curls
            const cp1x = p1.x + (p2.x - p0.x) * tension;
            const cp1y = p1.y + (p2.y - p0.y) * tension;
            const cp2x = p2.x - (p3.x - p1.x) * tension;
            const cp2y = p2.y - (p3.y - p1.y) * tension;

            pathD += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
        }

        const zeroY = getY(0);
        let zeroOffset = 0;
        if (maxVal > 0 && minVal < 0) { zeroOffset = (maxVal / range) * 100; }
        else if (minVal >= 0) { zeroOffset = 100; }
        else { zeroOffset = 0; }

        const fillPathD = `${pathD} L ${points[points.length - 1].x} ${zeroY} L ${points[0].x} ${zeroY} Z`;
        const svgContent = `<svg viewBox="0 0 ${vWidth} ${vHeight}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;"><defs><linearGradient id="profitGrad-${containerId}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#30D158" /><stop offset="${zeroOffset}%" stop-color="#30D158" /><stop offset="${zeroOffset}%" stop-color="#FF453A" /><stop offset="100%" stop-color="#FF453A" /></linearGradient><linearGradient id="fillGrad-${containerId}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#30D158" stop-opacity="0.35"/><stop offset="${zeroOffset}%" stop-color="#30D158" stop-opacity="0.0"/><stop offset="${zeroOffset}%" stop-color="#FF453A" stop-opacity="0.0"/><stop offset="100%" stop-color="#FF453A" stop-opacity="0.35"/></linearGradient></defs><line x1="${padding}" y1="${zeroY}" x2="${vWidth - padding}" y2="${zeroY}" stroke="#9ca3af" stroke-width="2" stroke-dasharray="6 6" opacity="0.3" vector-effect="non-scaling-stroke" /><path d="${fillPathD}" fill="url(#fillGrad-${containerId})" opacity="0.8" /><path d="${pathD}" fill="none" stroke="url(#profitGrad-${containerId})" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" /></svg>`;

        const uiOverlays = `<div class="graph-hover-line absolute hidden w-[1px] bg-white/20 pointer-events-none h-full top-0 z-10"></div><div class="graph-hover-hline absolute hidden h-[1px] bg-white/20 pointer-events-none w-full left-0 z-10"></div><div class="graph-hover-dot absolute hidden w-2.5 h-2.5 bg-white border-2 border-[#1C1C1E] rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(255,255,255,0.6)] z-20"></div><div class="graph-tooltip absolute hidden bg-[#1C1C1E]/95 border border-white/10 text-white text-[10px] px-2.5 py-1.5 rounded-lg pointer-events-none z-30 backdrop-blur-md shadow-xl whitespace-nowrap font-mono tracking-wide"></div>`;

        chartDiv.innerHTML = svgContent + uiOverlays;

        // Tooltip Interaction Logic
        const tooltip = chartDiv.querySelector('.graph-tooltip');
        const hoverLine = chartDiv.querySelector('.graph-hover-line');
        const hoverHLine = chartDiv.querySelector('.graph-hover-hline');
        const hoverDot = chartDiv.querySelector('.graph-hover-dot');

        chartDiv.addEventListener('mousemove', (e) => {
            const rect = chartDiv.getBoundingClientRect();
            const xPos = e.clientX - rect.left;
            const yPos = e.clientY - rect.top;

            let rawI = ((xPos / rect.width * vWidth) - padding) / (vWidth - 2 * padding) * (historyArray.length - 1);
            let i = Math.max(0, Math.min(Math.round(rawI), historyArray.length - 1));

            const val = historyArray[i];
            const pxX = (getX(i) / vWidth) * rect.width;
            const pxY = (getY(val) / vHeight) * rect.height;

            hoverLine.style.left = xPos + 'px';
            hoverLine.classList.remove('hidden');

            hoverHLine.style.top = yPos + 'px';
            hoverHLine.classList.remove('hidden');

            hoverDot.style.left = pxX + 'px';
            hoverDot.style.top = pxY + 'px';
            hoverDot.style.borderColor = val >= 0 ? '#30D158' : '#FF453A';
            hoverDot.classList.remove('hidden');

            tooltip.innerHTML = `<span class="text-white/50 mr-2">Spin ${i}</span><span class="font-bold ${val >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}">${val > 0 ? '+' : ''}${val}</span>`;

            let ttLeft = xPos + 15;
            let ttTop = yPos + 15;
            if (ttLeft + 110 > rect.width) ttLeft = xPos - 110;
            if (ttTop + 35 > rect.height) ttTop = yPos - 35;

            tooltip.style.left = ttLeft + 'px';
            tooltip.style.top = ttTop + 'px';
            tooltip.classList.remove('hidden');
        });

        chartDiv.addEventListener('mouseleave', () => {
 [hoverLine, hoverHLine, hoverDot, tooltip].forEach(el => el.classList.add('hidden'));
        });
    };
})();
