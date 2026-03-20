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
        const container = document.getElementById('faceGapContainer');
        if (!container) return;
        container.innerHTML = '';
        for (let f = 1; f <= 5; f++) {
            const gap = window.state.faceGaps ? window.state.faceGaps[f] || 0 : 0;
            let colorClass = 'text-[#22c55e]';
            if (gap > 10) colorClass = 'text-[#d4af37]';
            if (gap > 15) colorClass = 'text-[#d33838]';
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

    window.sortEngineReadCombos = function (comboStats) { return (comboStats || []).slice().sort((a, b) => (b.hits - a.hits) || ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) || (a.label > b.label ? 1 : -1)); };
    window.getEngineStateTone = function (stateStr) { const tones = { BUILDING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded', WAITING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded', READY: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2 py-0.5 rounded', FOLLOW_UP: 'text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded', WATCHLIST: 'text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded', NO_SIGNAL: 'text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded' }; return tones[stateStr] || 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded'; };
    window.getMetricToneClass = function (metric, value) { switch (metric) { case 'hits': if (value >= 3) return 'text-[#22c55e] drop-shadow-sm font-bold'; if (value === 2) return 'text-[#d4af37] font-bold'; if (value === 1) return 'text-[#d33838]'; return 'text-gray-500 opacity-50'; case 'hotPercent': case 'coldPercent': if (value >= (metric === 'hotPercent' ? 25 : 85)) return 'text-[#22c55e] drop-shadow-sm font-bold'; if (value >= (metric === 'hotPercent' ? 15 : 65)) return 'text-[#d4af37] font-bold'; if (value > 0) return 'text-[#d33838]'; return 'text-gray-500 opacity-50'; case 'margin': if (value >= 2) return 'text-[#22c55e] font-bold'; if (value === 1) return 'text-[#d4af37] font-bold'; if (value === 0) return 'text-[#d33838]'; return 'text-gray-500 opacity-50'; case 'confirmation': return value >= 1 ? 'text-[#22c55e] drop-shadow-sm font-bold' : 'text-[#d33838] font-bold'; case 'lastSeen': if (value === null || value === undefined || value === '-') return 'text-gray-500 opacity-50'; if (value <= 1) return 'text-[#22c55e] font-bold'; if (value <= 3) return 'text-[#d4af37] font-bold'; return 'text-[#d33838] font-bold'; case 'checkpoint': if (value <= 1) return 'text-[#d4af37] font-bold'; if (value <= 3) return 'text-[#d33838] font-bold'; return 'text-gray-500 opacity-50'; default: return 'text-gray-500 opacity-50'; } };
    window.getPredictionToneClass = function (snapshot) { if (!snapshot) return 'text-gray-500'; if (snapshot.currentPrediction) return 'text-[#22c55e] font-bold drop-shadow-sm'; if (snapshot.engineState === 'WATCHLIST') return 'text-[#d4af37] font-bold'; if (snapshot.engineState === 'NO_SIGNAL') return 'text-gray-400'; return 'text-gray-500'; };
    window.formatEnginePrediction = function (snapshot) { if (!snapshot) return 'No engine state available.'; if (snapshot.currentPrediction) { const action = snapshot.currentPrediction.action || 'BET'; const confidence = Number.isFinite(snapshot.currentPrediction.confidence) && snapshot.currentPrediction.confidence > 0 ? ` ${snapshot.currentPrediction.confidence}%` : ''; return `${action} F${snapshot.currentPrediction.targetFace} via ${snapshot.currentPrediction.comboLabel}${confidence}.`; } return snapshot.watchlistMessage || snapshot.leadMessage || 'No actionable signal.'; };

    window.renderIntelligencePanel = function () {
        const content = document.getElementById('intelligenceContent'), stateChip = document.getElementById('intelStateChip'), checkpointSummary = document.getElementById('intelCheckpointSummary'), nextCheckpoint = document.getElementById('intelNextCheckpoint');
        if (!content) return;
        const ENGINE_PRIMARY_WINDOW = window.config ? window.config.ENGINE_PRIMARY_WINDOW : 14, snapshot = window.state.engineSnapshot || {}, rankedCombos = window.sortEngineReadCombos(snapshot.comboCoverage || []), leadCombo = snapshot.dominantCombo, runnerUp = snapshot.runnerUpCombo;
        if (stateChip) { stateChip.innerText = snapshot.engineState || 'IDLE'; stateChip.className = `font-black text-[9px] tracking-widest uppercase ${window.getEngineStateTone(snapshot.engineState)}`; }
        if (checkpointSummary) { checkpointSummary.innerText = snapshot.checkpointStatus || 'Waiting for valid sample'; checkpointSummary.className = `font-bold text-[10px] tracking-widest uppercase ${window.getPredictionToneClass(snapshot)}`; }
        if (nextCheckpoint) { nextCheckpoint.innerText = snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW; nextCheckpoint.className = `text-lg font-black tracking-tighter ${window.getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}`; }
        const comboRows = rankedCombos.map((combo, index) => `<tr class="hover:bg-white/5 transition-colors"><td class="p-3 font-bold tracking-widest text-[10px]" style="color:${combo.color}">${index + 1}. ${combo.label}</td><td class="p-3 font-mono ${window.getMetricToneClass('hits', combo.hits)}">${combo.hits}</td><td class="p-3 font-mono ${window.getMetricToneClass('hotPercent', combo.hotPercent)}">${combo.hotPercent}%</td><td class="p-3 font-mono ${window.getMetricToneClass('coldPercent', combo.coldPercent)}">${combo.coldPercent}%</td><td class="p-3 font-mono ${window.getMetricToneClass('lastSeen', combo.lastSeenDistance ?? '-')}">${combo.lastSeenDistance ?? '-'}</td></tr>`).join('');
        content.innerHTML = `<div class="grid grid-cols-2 gap-3 mt-2"><div class="col-span-2 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-xl p-4 text-center shadow-lg"><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Lead Insight</div><div class="text-lg mb-1 ${window.getPredictionToneClass(snapshot)}">${snapshot.leadMessage || 'Awaiting Valid Sample'}</div><div class="text-[11px] font-medium text-white/70">${window.formatEnginePrediction(snapshot)}</div></div><div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm"><div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Primary Read</div><div class="text-lg font-bold tracking-wide" style="color:${leadCombo ? leadCombo.color : '#f0f0f0'}">${leadCombo ? leadCombo.label : 'No combo'}</div></div><div class="text-[10px] text-white/60 mt-2">${leadCombo ? `<span class="${window.getMetricToneClass('hits', leadCombo.hits)}">${leadCombo.hits} hits</span> in rolling 14` : 'Waiting for a valid sample.'}</div></div><div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm"><div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Runner-Up Margin</div><div class="text-lg font-bold tracking-wide ${window.getMetricToneClass('margin', snapshot.topMargin)}">${leadCombo ? `${(snapshot.topMargin || 0) >= 0 ? '+' : ''}${snapshot.topMargin || 0}` : '-'}</div></div><div class="text-[10px] text-white/60 mt-2">${runnerUp ? `Runner-up is ${runnerUp.label} (${runnerUp.hits} hits)` : 'No runner-up yet.'}</div></div></div><div class="col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden mt-4 shadow-sm"><div class="bg-black/30 text-white/40 text-[9px] font-black uppercase tracking-widest p-3 border-b border-white/5">14-Spin Combo Ranking</div><table class="w-full text-left text-xs"><thead class="bg-black/10 text-white/30 uppercase text-[9px] tracking-wider border-b border-white/5"><tr><th class="p-3">Combo</th><th class="p-3">Hits</th><th class="p-3">Hot</th><th class="p-3">Cold</th><th class="p-3">Last Seen</th></tr></thead><tbody class="divide-y divide-white/5">${comboRows || '<tr><td colspan="5" class="p-6 text-center text-white/30 italic">Awaiting data...</td></tr>'}</tbody></table></div>`;
    };

    window.renderStrategyAnalytics = function () {
        let displayStrategy = 'series';
        if (window.state) {
            if (window.state.analyticsDisplayStrategy === 'combo') displayStrategy = 'combo';
            else if (window.state.analyticsDisplayStrategy === 'inside') displayStrategy = 'inside';
        }
        const coreStats = (window.EngineCore && typeof window.EngineCore.getAnalyticsData === 'function')
            ? window.EngineCore.getAnalyticsData(displayStrategy)
            : { wins: 0, losses: 0, net: 0, streak: 0, history: [0], patterns: {} };

        const totalSignals = coreStats.wins + coreStats.losses;
        const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.wins / totalSignals) * 100);

        const hrEl = document.getElementById('kpiHitRate');
        if (hrEl) {
            hrEl.innerText = hitRate + "%";
            hrEl.className = `text-2xl font-semibold tracking-tight ${totalSignals === 0 ? 'text-white' : (hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]')}`;
        }

        const netEl = document.getElementById('kpiNet');
        if (netEl) {
            netEl.innerText = (coreStats.net > 0 ? '+' : '') + coreStats.net;
            netEl.className = `text-2xl font-semibold tracking-tight ${coreStats.net >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;
        }

        const sigEl = document.getElementById('kpiSignals');
        if (sigEl) {
            sigEl.innerText = totalSignals;
            sigEl.className = "text-2xl font-semibold tracking-tight text-white";
        }

        const s = coreStats.streak || 0;
        const formEl = document.getElementById('kpiForm');
        if (formEl) {
            formEl.innerText = s > 0 ? `W${s}` : (s < 0 ? `L${Math.abs(s)}` : '-');
            formEl.className = `text-2xl font-semibold tracking-tight ${s > 0 ? 'text-[#30D158]' : (s < 0 ? 'text-[#FF453A]' : 'text-gray-400')}`;
        }

        if (window.drawAdvancedGraph) window.drawAdvancedGraph(coreStats.history, coreStats.wins, coreStats.losses, 'graphContainer');
        if (window.updatePatternHeatmap) window.updatePatternHeatmap(coreStats.patterns);
    };

    window.renderUserAnalytics = function () {
        if (!window.state) return;
        const uStats = window.state.userStats || { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
        const totalBets = uStats.totalWins + uStats.totalLosses;
        const hitRate = totalBets === 0 ? 0 : Math.round((uStats.totalWins / totalBets) * 100);

        const netEl = document.getElementById('userNet');
        if (netEl) {
            netEl.innerText = (uStats.netUnits > 0 ? '+' : '') + uStats.netUnits;
            netEl.className = `text-4xl font-semibold tracking-tight ${uStats.netUnits >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;
        }

        const hrEl = document.getElementById('userHitRate');
        if (hrEl) {
            hrEl.innerText = hitRate + "%";
            hrEl.className = `text-4xl font-semibold tracking-tight ${totalBets === 0 ? 'text-white' : (hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]')}`;
        }

        const totEl = document.getElementById('userTotal');
        if (totEl) {
            totEl.innerText = totalBets;
            totEl.className = "text-4xl font-semibold tracking-tight text-white";
        }

        if (window.drawAdvancedGraph) window.drawAdvancedGraph(uStats.bankrollHistory, uStats.totalWins, uStats.totalLosses, 'userGraphContainer');
        if (window.updateUserBetLog) window.updateUserBetLog(uStats.betLog);
    };

    window.drawAdvancedGraph = function (historyArray, winCount, lossCount, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const sourceHistory = Array.isArray(historyArray) ? historyArray.slice() : [];
        const normalizedHistory = sourceHistory.length >= 2 ? sourceHistory : [sourceHistory[0] || 0, sourceHistory[0] || 0];

        container.innerHTML = '';
        container.className = "flex flex-col h-full w-full rounded-b-xl overflow-hidden";

        const chartDiv = document.createElement('div');
        chartDiv.className = "relative h-[80%] w-full bg-black/20";
        container.appendChild(chartDiv);

        const hudDiv = document.createElement('div');
        hudDiv.className = "h-[20%] w-full flex justify-between items-center px-4 text-[10px] font-bold bg-white/5 border-t border-white/5 backdrop-blur-sm";
        hudDiv.innerHTML = `<span class="text-[#4ade80] drop-shadow-sm tracking-wide">WINS: ${winCount || 0}</span><span class="text-[#e5e7eb] drop-shadow-sm tracking-wide">SPINS: ${Math.max(0, sourceHistory.length - 1)}</span><span class="text-[#f87171] drop-shadow-sm tracking-wide">LOSSES: ${lossCount || 0}</span>`;
        container.appendChild(hudDiv);

        const vWidth = 600, vHeight = 200, padding = 10;
        const maxVal = Math.max(...normalizedHistory, 0), minVal = Math.min(...normalizedHistory, 0);
        let range = maxVal - minVal; if (range === 0) range = 2;

        const getX = i => (i / (normalizedHistory.length - 1)) * (vWidth - 2 * padding) + padding;
        const getY = v => vHeight - padding - ((v - minVal) / range) * (vHeight - 2 * padding);

        const points = normalizedHistory.map((v, i) => ({ x: getX(i), y: getY(v) }));
        const controlPoint = (current, previous, next, reverse) => {
            const p = previous || current; const n = next || current; const smoothing = 0.2;
            const o = { length: Math.sqrt(Math.pow(n.x - p.x, 2) + Math.pow(n.y - p.y, 2)) * smoothing, angle: Math.atan2(n.y - p.y, n.x - p.x) };
            const angle = o.angle + (reverse ? Math.PI : 0);
            return [current.x + Math.cos(angle) * o.length, current.y + Math.sin(angle) * o.length];
        };
        const bezierCommand = (point, i, a) => {
            const [cpsX, cpsY] = controlPoint(a[i - 1], a[i - 2], point);
            const [cpeX, cpeY] = controlPoint(point, a[i - 1], a[i + 1], true);
            return `C ${cpsX},${cpsY} ${cpeX},${cpeY} ${point.x},${point.y}`;
        };
        const pathD = points.reduce((acc, p, i, a) => i === 0 ? `M ${p.x},${p.y}` : `${acc} ${bezierCommand(p, i, a)}`, '');

        const zeroY = getY(0);
        let zeroOffset = 0;
        if (maxVal > 0 && minVal < 0) zeroOffset = (maxVal / range) * 100; else if (minVal >= 0) zeroOffset = 100;

        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', `0 0 ${vWidth} ${vHeight}`); svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.setAttribute('preserveAspectRatio', 'none'); svg.style.overflow = 'visible';

        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const strokeGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient'); strokeGradient.id = `profitGrad-${containerId}`; strokeGradient.setAttribute('x1', '0%'); strokeGradient.setAttribute('y1', '0%'); strokeGradient.setAttribute('x2', '0%'); strokeGradient.setAttribute('y2', '100%'); strokeGradient.innerHTML = `<stop offset="0%" stop-color="#4ade80" /><stop offset="${zeroOffset}%" stop-color="#4ade80" /><stop offset="${zeroOffset}%" stop-color="#f87171" /><stop offset="100%" stop-color="#f87171" />`; defs.appendChild(strokeGradient);
        const fillGradient = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient'); fillGradient.id = `profitFillGrad-${containerId}`; fillGradient.setAttribute('x1', '0%'); fillGradient.setAttribute('y1', '0%'); fillGradient.setAttribute('x2', '0%'); fillGradient.setAttribute('y2', '100%'); fillGradient.innerHTML = `<stop offset="0%" stop-color="#4ade80" stop-opacity="0.2" /><stop offset="${zeroOffset}%" stop-color="#4ade80" stop-opacity="0.05" /><stop offset="${zeroOffset}%" stop-color="#f87171" stop-opacity="0.05" /><stop offset="100%" stop-color="#f87171" stop-opacity="0.0" />`; defs.appendChild(fillGradient);
        svg.appendChild(defs);

        const areaPath = document.createElementNS('http://www.w3.org/2000/svg', 'path'); areaPath.setAttribute('d', `${pathD} L ${getX(points.length - 1)},${vHeight} L ${getX(0)},${vHeight} Z`); areaPath.setAttribute('fill', `url(#profitFillGrad-${containerId})`); svg.appendChild(areaPath);
        const zeroLine = document.createElementNS('http://www.w3.org/2000/svg', 'line'); zeroLine.setAttribute('x1', padding); zeroLine.setAttribute('y1', zeroY); zeroLine.setAttribute('x2', vWidth - padding); zeroLine.setAttribute('y2', zeroY); zeroLine.setAttribute('stroke', '#9ca3af'); zeroLine.setAttribute('stroke-width', '1'); zeroLine.setAttribute('stroke-dasharray', '4 4'); zeroLine.setAttribute('opacity', '0.3'); zeroLine.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(zeroLine);
        const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path'); glowPath.setAttribute('d', pathD); glowPath.setAttribute('fill', 'none'); glowPath.setAttribute('stroke', `url(#profitGrad-${containerId})`); glowPath.setAttribute('stroke-width', '5'); glowPath.setAttribute('stroke-linecap', 'round'); glowPath.setAttribute('stroke-linejoin', 'round'); glowPath.setAttribute('vector-effect', 'non-scaling-stroke'); glowPath.style.filter = 'blur(4px)'; glowPath.style.opacity = '0.5'; svg.appendChild(glowPath);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', pathD); path.setAttribute('fill', 'none'); path.setAttribute('stroke', `url(#profitGrad-${containerId})`); path.setAttribute('stroke-width', '2'); path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('vector-effect', 'non-scaling-stroke'); svg.appendChild(path);
        chartDiv.appendChild(svg);
    };

    window.updatePatternHeatmap = function (patternData) {
        const tbody = document.getElementById('heatmapBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        const patterns = Object.entries(patternData || {});
        if (patterns.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No patterns recorded yet</td></tr>'; return; }
        patterns.sort((a, b) => { const rA = a[1].wins / ((a[1].wins + a[1].losses) || 1); const rB = b[1].wins / ((b[1].wins + b[1].losses) || 1); return rB - rA; });
        patterns.forEach(([name, s]) => {
            const total = s.wins + s.losses;
            const rate = total === 0 ? 0 : Math.round((s.wins / total) * 100);
            const color = rate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]';
            const bar = rate >= 50 ? 'bg-[#30D158]' : 'bg-[#FF453A]';
            tbody.innerHTML += `<tr class="hover:bg-white/5 transition-colors"><td class="p-3 font-semibold text-gray-200"><div class="flex items-center justify-between"><span class="tracking-wide">${name}</span><button onclick="event.stopPropagation(); window.openPatternLog && window.openPatternLog('${name}')" class="text-[#8E8E93] hover:text-white cursor-pointer px-2 py-1 rounded-full hover:bg-white/10 transition-colors" title="View Log"><i class="fas fa-list-ul"></i></button></div></td><td class="p-3 text-right text-[#30D158] font-mono font-bold drop-shadow-sm">${s.wins}</td><td class="p-3 text-right text-[#FF453A] font-mono font-bold drop-shadow-sm">${s.losses}</td><td class="p-3 text-right w-24 relative"><div class="absolute inset-y-4 left-2 right-2 bg-[#3a3a3c] rounded-full overflow-hidden h-1.5 mt-2 shadow-inner"><div class="h-full ${bar}" style="width: ${rate}%"></div></div><span class="relative z-10 ${color} font-bold text-[10px] top-[-8px] right-[0px]">${rate}%</span></td></tr>`;
        });
    };

    window.updateUserBetLog = function (betLog) {
        const tbody = document.getElementById('userBetsBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (!betLog || betLog.length === 0) { tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No confirmed bets yet</td></tr>'; return; }
        betLog.forEach(log => {
            const resClass = log.result === 'WIN' ? 'text-[#30D158]' : 'text-[#FF453A]';
            const unitsText = log.units > 0 ? `+${log.units}` : log.units;
            const targetText = String(log.target || '').replace('F', '');
            tbody.innerHTML += `<tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"><td class="p-3 text-[#8E8E93] font-mono text-xs">#${log.id || '-'}</td><td class="p-3 font-bold text-gray-200 tracking-wide">${log.pattern || '-'}</td><td class="p-3 text-center font-bold text-white"><span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10 shadow-sm text-xs">F${targetText}</span></td><td class="p-3 text-right"><span class="text-[9px] text-[#8E8E93] mr-2">Spin ${log.spinNum || '-'}</span><span class="font-bold ${resClass} text-sm drop-shadow-sm">${log.result || '-'} (${unitsText})</span></td></tr>`;
        });
    };

    window.openPatternLog = function (patternName) {
        const stats = window.state && window.state.engineStats ? window.state.engineStats : { signalLog: [] };
        const logs = (stats.signalLog || []).filter(s => s.patternName === patternName);
        logs.sort((a, b) => a.spinIndex - b.spinIndex);

        let runningROI = 0; let lastIndex = -1;
        let displayLogs = logs.map((log, i) => {
            runningROI += log.units; let gap = (i === 0) ? 0 : (log.spinIndex - lastIndex); lastIndex = log.spinIndex;
            return { ...log, gap, roi: runningROI };
        });
        displayLogs.sort((a, b) => b.spinIndex - a.spinIndex);

        const tbody = document.getElementById('patternDetailBody');
        if (!tbody) return;

        if (displayLogs.length === 0) {
            tbody.innerHTML = '<div class="p-8 text-center text-[#8E8E93] italic">No signals recorded yet</div>';
        } else {
            let rows = '';
            displayLogs.forEach(log => {
                let badgeClass = '';
                if (log.spinNum === 0) badgeClass = 'bg-[#30d158]/20 text-[#30d158] border-[#30d158]/30';
                else if (window.config && window.config.RED_NUMS && window.config.RED_NUMS.includes(log.spinNum)) badgeClass = 'bg-[#ff453a]/20 text-[#ff453a] border-[#ff453a]/30';
                else badgeClass = 'bg-[#3a3a3c] text-gray-200 border-white/10';

                const isWin = log.result === 'WIN';
                const resClass = isWin ? 'text-[#30D158]' : 'text-[#FF453A]';
                const unitClass = log.units > 0 ? 'text-[#30D158]' : 'text-[#FF453A]';
                const roiClass = log.roi >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]';
                const unitSign = log.units > 0 ? '+' : ''; const roiSign = log.roi > 0 ? '+' : '';

                rows += `<tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-xs"><td class="p-3 text-[#8E8E93] font-mono">#${log.spinIndex + 1}</td><td class="p-3 text-center"><span class="inline-block w-8 h-6 flex items-center justify-center rounded-md border ${badgeClass} font-bold mx-auto border-opacity-50">${log.spinNum}</span></td><td class="p-3 text-center text-gray-400 font-mono">${log.gap}</td><td class="p-3 text-center font-bold ${resClass}">${log.result}</td><td class="p-3 text-right font-mono font-bold ${unitClass}">${unitSign}${log.units}</td><td class="p-3 text-right font-mono font-bold ${roiClass}">${roiSign}${log.roi}</td></tr>`;
            });

            tbody.innerHTML = `<div class="p-4 glass-header flex justify-between items-center border-b border-white/10 shrink-0"><h2 class="font-semibold text-sm tracking-wide uppercase text-white" id="patternDetailTitle">LOG: ${patternName}</h2><button onclick="toggleModal('patternDetailModal')" class="text-gray-400 hover:text-white transition-colors"><i class="fas fa-times"></i></button></div><div class="flex-1 overflow-y-auto p-0 custom-scroll max-h-[70vh]"><table class="w-full text-left text-xs"><thead class="bg-black/30 text-white/50 border-b border-white/5 sticky top-0 z-10 backdrop-blur-md"><tr><th class="p-3 font-semibold uppercase">Spin</th><th class="p-3 font-semibold uppercase text-center">Hit</th><th class="p-3 font-semibold uppercase text-center">Gap</th><th class="p-3 font-semibold uppercase text-center">Result</th><th class="p-3 font-semibold uppercase text-right">Units</th><th class="p-3 font-semibold uppercase text-right">ROI</th></tr></thead><tbody>${rows}</tbody></table></div>`;
        }

        const modal = document.getElementById('patternDetailModal');
        if (modal) modal.classList.remove('hidden');
    };

})();