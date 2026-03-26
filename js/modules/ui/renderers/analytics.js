(function () {
    'use strict';

    window.applyAnalyticsTabUI = function () {
        const displayMode = window.state ? window.state.analyticsDisplayStrategy : 'series';
        const select = document.getElementById('analyticsStrategySelect');
        if (select) select.value = displayMode;

        // Highlight active strategy button (SERIES, COMBO, INSIDE)
        ['series', 'combo', 'inside'].forEach(mode => {
            const btn = document.querySelector(`button[onclick="setAnalyticsDisplayStrategy('${mode}')"]`);
            if (btn) {
                if (displayMode === mode) {
                    btn.className = "px-6 py-2.5 text-[10px] font-black tracking-widest rounded-xl transition-all text-[#FFD60A] bg-white/10 shadow-sm";
                } else {
                    btn.className = "px-6 py-2.5 text-[10px] font-black tracking-widest rounded-xl transition-all text-white/20 hover:text-white/60";
                }
            }
        });

        const tabs = window.getAnalyticsTabConfig ? window.getAnalyticsTabConfig() : [];
        const activeTab = window.ensureActiveAnalyticsTab ? window.ensureActiveAnalyticsTab(tabs) : '';
        const activePanelIds = new Set(
            tabs
                .filter(tab => tab.key === activeTab && tab.panelId)
                .map(tab => tab.panelId)
        );
        
        tabs.forEach(tab => {
            const btn = tab.button;
            if (btn) btn.className = tab.key === activeTab ? "pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-[#FFD60A] border-b-2 border-[#FFD60A] transition-all hover:text-[#FFD60A]" : "pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 border-b-2 border-transparent transition-all hover:text-white/60";
        });

        Array.from(new Set(tabs.map(tab => tab.panelId).filter(Boolean))).forEach(panelId => {
            const panel = document.getElementById(panelId);
            if (!panel) return;
            if (activePanelIds.has(panelId)) panel.classList.remove('hidden');
            else panel.classList.add('hidden');
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
            container.innerHTML += `<div class="text-center p-2.5 rounded-[16px] bg-[#1C1C1E]/40 border border-white/[0.05] shadow-sm backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.06]"><span class="block text-white/40 text-[10px] font-black uppercase tracking-widest mb-1">F${f}</span><span class="${colorClass} font-black text-xl">${gap}</span></div>`;
        }
    };

    window.getAnalyticsTabConfig = function () {
        const buttons = Array.from(document.querySelectorAll('[data-analytics-tab]:not(.hidden)'));
        if (buttons.length > 0) return buttons.map(button => ({ key: button.dataset.analyticsTab, button, panelId: button.dataset.analyticsPanel || '', rendererName: button.dataset.analyticsRenderer || '' })).filter(tab => tab.key && tab.panelId);

        // Fallback (Only return non-hidden buttons)
        const allTabs = [
            { key: 'strategy', button: document.getElementById('tabBtnStrategy'), panelId: 'strategyAnalyticsPanel', rendererName: 'renderStrategyAnalytics' },
            { key: 'perimeter', button: document.getElementById('tabBtnPerimeter'), panelId: 'strategyAnalyticsPanel', rendererName: 'renderStrategyAnalytics' },
            { key: 'intelligence', button: document.getElementById('tabBtnIntelligence'), panelId: 'intelligencePanel', rendererName: 'renderIntelligencePanel' },
            { key: 'advancements', button: document.getElementById('tabBtnAdvancements'), panelId: 'advancementsPanel', rendererName: 'renderAdvancementAnalytics' }
        ];
        return allTabs.filter(tab => tab.button && !tab.button.classList.contains('hidden'));
    };

    window.ensureActiveAnalyticsTab = function (tabs) {
        if (!window.state || !Array.isArray(tabs) || tabs.length === 0) return window.state ? window.state.currentAnalyticsTab : '';
        const activeExists = tabs.some(tab => tab.key === window.state.currentAnalyticsTab);
        if (!activeExists) window.state.currentAnalyticsTab = tabs[0].key;
        return window.state.currentAnalyticsTab;
    };

    window.renderAdvancementAnalytics = function () {
        const totalSpins = document.getElementById('advTotalSpins');
        const totalSignals = document.getElementById('advTotalSignals');
        const winRate = document.getElementById('advWinRate');
        const logContainer = document.getElementById('advancementLogContainer');

        const history = (window.state && window.state.history) || [];
        const spins = history.length;

        // Count signals and outcomes
        let signals = 0, wins = 0, losses = 0;
        if (window.EngineCore && window.EngineCore.stats && window.EngineCore.stats.patternStats) {
            const ps = window.EngineCore.stats.patternStats;
            for (const key of Object.keys(ps)) {
                signals += (ps[key].wins || 0) + (ps[key].losses || 0);
                wins += ps[key].wins || 0;
                losses += ps[key].losses || 0;
            }
        }

        const rate = signals > 0 ? Math.round((wins / signals) * 100) : 0;
        const rateColor = rate >= 50 ? 'text-[#32D74B]' : rate > 0 ? 'text-[#FF453A]' : 'text-white/90';

        if (totalSpins) totalSpins.textContent = spins;
        if (totalSignals) totalSignals.textContent = signals;
        if (winRate) { winRate.textContent = `${rate}%`; winRate.className = `text-2xl font-semibold tracking-tight ${rateColor}`; }

        // Milestone log
        if (logContainer) {
            const milestones = [];
            if (spins >= 100) milestones.push({ icon: 'fas fa-fire', label: '100 Spins Reached', color: '#FF9F0A' });
            if (spins >= 50) milestones.push({ icon: 'fas fa-bolt', label: '50 Spins Milestone', color: '#FF9F0A' });
            if (signals >= 20) milestones.push({ icon: 'fas fa-broadcast-tower', label: '20+ Signals Fired', color: '#BF5AF2' });
            if (wins >= 10) milestones.push({ icon: 'fas fa-check-circle', label: '10+ Wins', color: '#32D74B' });
            if (rate >= 60 && signals > 5) milestones.push({ icon: 'fas fa-star', label: `${rate}% Win Rate`, color: '#FFD60A' });

            if (milestones.length > 0) {
                logContainer.innerHTML = milestones.map(m => `
                    <div class="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.05] mb-2">
                        <i class="${m.icon} text-sm" style="color:${m.color}"></i>
                        <span class="text-xs font-bold text-white/80 tracking-wide">${m.label}</span>
                    </div>
                `).join('');
            } else {
                logContainer.innerHTML = '<div class="text-white/30 text-center py-8 text-[11px] font-black uppercase tracking-widest">Awaiting threshold breaches.</div>';
            }
        }
    };

    window.syncAnalyticsVisibility = function() {
        if (!window.state) return;

        const gameplayMode = window.state.currentGameplayStrategy || 'inside';
        const tabBtnPerimeter = document.getElementById('tabBtnPerimeter');
        const perimeterAvailable = gameplayMode === 'inside';

        if (tabBtnPerimeter) {
            if (perimeterAvailable) {
                tabBtnPerimeter.classList.remove('hidden');
            } else {
                tabBtnPerimeter.classList.add('hidden');
            }
        }

        if (!perimeterAvailable && window.state.currentAnalyticsTab === 'perimeter') {
            window.state.currentAnalyticsTab = 'strategy';
        }
    };

    window.renderAnalytics = function () {
        if (!window.state) return;

        if (window.syncAnalyticsVisibility) window.syncAnalyticsVisibility();
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

        const gameplayMode = window.state.currentGameplayStrategy || 'inside';

        // Perimeter is an inside-mode-only analytics tab.
        if (gameplayMode !== 'inside' && window.state.currentAnalyticsTab === 'perimeter') {
            window.state.currentAnalyticsTab = 'strategy';
        }

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
    window.getEngineStateTone = function (stateStr) { const tones = { BUILDING: 'text-white/50 bg-white/5 border border-white/[0.08] px-2 py-0.5 rounded-md', WAITING: 'text-white/50 bg-white/5 border border-white/[0.08] px-2 py-0.5 rounded-md', READY: 'text-[#32D74B] bg-[#32D74B]/10 border border-[#32D74B]/20 px-2 py-0.5 rounded-md', FOLLOW_UP: 'text-[#0A84FF] bg-[#0A84FF]/10 border border-[#0A84FF]/20 px-2 py-0.5 rounded-md', WATCHLIST: 'text-[#FF9F0A] bg-[#FF9F0A]/10 border border-[#FF9F0A]/20 px-2 py-0.5 rounded-md', NO_SIGNAL: 'text-white/50 bg-white/5 border border-white/[0.08] px-2 py-0.5 rounded-md' }; return tones[stateStr] || 'text-white/50 bg-white/5 border border-white/[0.08] px-2 py-0.5 rounded-md'; };
    window.getMetricToneClass = function (metric, value) { switch (metric) { case 'hits': if (value >= 3) return 'text-[#32D74B] font-semibold'; if (value === 2) return 'text-[#FF9F0A] font-medium'; if (value === 1) return 'text-[#FF453A]'; return 'text-white/40'; case 'hotPercent': case 'coldPercent': if (value >= (metric === 'hotPercent' ? 25 : 85)) return 'text-[#32D74B] font-semibold'; if (value >= (metric === 'hotPercent' ? 15 : 65)) return 'text-[#FF9F0A] font-medium'; if (value > 0) return 'text-[#FF453A]'; return 'text-white/40'; case 'margin': if (value >= 2) return 'text-[#32D74B] font-semibold'; if (value === 1) return 'text-[#FF9F0A] font-medium'; if (value === 0) return 'text-[#FF453A]'; return 'text-white/40'; case 'confirmation': return value >= 1 ? 'text-[#32D74B] font-semibold' : 'text-[#FF453A] font-medium'; case 'lastSeen': if (value === null || value === undefined || value === '-') return 'text-white/40'; if (value <= 1) return 'text-[#32D74B] font-medium'; if (value <= 3) return 'text-[#FF9F0A] font-medium'; return 'text-[#FF453A] font-medium'; case 'checkpoint': if (value <= 1) return 'text-[#FF9F0A] font-medium'; if (value <= 3) return 'text-[#FF453A] font-medium'; return 'text-white/50'; default: return 'text-white/40'; } };
    window.getPredictionToneClass = function (snapshot) { if (!snapshot) return 'text-white/50'; if (snapshot.currentPrediction) return 'text-[#32D74B] font-semibold'; if (snapshot.engineState === 'WATCHLIST') return 'text-[#FF9F0A] font-medium'; if (snapshot.engineState === 'NO_SIGNAL') return 'text-white/40'; return 'text-white/50'; };
    window.formatEnginePrediction = function (snapshot) { if (!snapshot) return 'No engine state available.'; if (snapshot.currentPrediction) { const action = snapshot.currentPrediction.action || 'BET'; const confidence = Number.isFinite(snapshot.currentPrediction.confidence) && snapshot.currentPrediction.confidence > 0 ? ` ${snapshot.currentPrediction.confidence}%` : ''; return `${action} F${snapshot.currentPrediction.targetFace} via ${snapshot.currentPrediction.comboLabel}${confidence}.`; } return snapshot.watchlistMessage || snapshot.leadMessage || 'No actionable signal.'; };
    window.renderIntelligencePanel = function () { const content = document.getElementById('intelligenceContent'), stateChip = document.getElementById('intelStateChip'), checkpointSummary = document.getElementById('intelCheckpointSummary'), nextCheckpoint = document.getElementById('intelNextCheckpoint'); if (!content) return; const ENGINE_PRIMARY_WINDOW = window.config ? window.config.ENGINE_PRIMARY_WINDOW : 8, snapshot = window.state.engineSnapshot || {}, rankedCombos = window.sortEngineReadCombos(snapshot.comboCoverage || []), leadCombo = snapshot.dominantCombo, runnerUp = snapshot.runnerUpCombo; if (stateChip) { stateChip.innerText = snapshot.engineState || 'IDLE'; stateChip.className = `font-medium text-[10px] tracking-normal ${window.getEngineStateTone(snapshot.engineState)}`; } if (checkpointSummary) { checkpointSummary.innerText = snapshot.checkpointStatus || 'Waiting for valid sample'; checkpointSummary.className = `font-medium text-xs tracking-normal ${window.getPredictionToneClass(snapshot)}`; } if (nextCheckpoint) { nextCheckpoint.innerText = snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW; nextCheckpoint.className = `text-3xl font-light tracking-tight text-white/90 drop-shadow-sm ${window.getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}`; } const comboRows = rankedCombos.map((combo, index) => `<tr class="hover:bg-white/[0.04] transition-colors duration-300 ease-out border-b border-white/[0.08] last:border-0"><td class="p-3 font-medium text-sm" style="color:${combo.color}">${index + 1}. ${combo.label}</td><td class="p-3 text-sm ${window.getMetricToneClass('hits', combo.hits)}">${combo.hits}</td><td class="p-3 text-sm ${window.getMetricToneClass('hotPercent', combo.hotPercent)}">${combo.hotPercent}%</td><td class="p-3 text-sm ${window.getMetricToneClass('coldPercent', combo.coldPercent)}">${combo.coldPercent}%</td><td class="p-3 text-sm ${window.getMetricToneClass('lastSeen', combo.lastSeenDistance ?? '-')}">${combo.lastSeenDistance ?? '-'}</td></tr>`).join(''); content.innerHTML = `<div class="grid grid-cols-2 gap-4 mt-2"><div class="col-span-2 bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 text-center shadow-sm"><div class="text-white/50 text-xs font-medium mb-2">Lead Insight</div><div class="text-xl font-semibold mb-1 ${window.getPredictionToneClass(snapshot)}">${snapshot.leadMessage || 'Awaiting Valid Sample'}</div><div class="text-sm font-medium text-white/70">${window.formatEnginePrediction(snapshot)}</div></div><div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between shadow-sm"><div><div class="text-white/50 text-xs font-medium mb-2">Primary Read</div><div class="text-xl font-semibold tracking-tight" style="color:${leadCombo ? leadCombo.color : '#f0f0f0'}">${leadCombo ? leadCombo.label : 'No combo'}</div></div><div class="text-sm text-white/60 mt-2">${leadCombo ? `<span class="${window.getMetricToneClass('hits', leadCombo.hits)}">${leadCombo.hits} hits</span> in rolling ${ENGINE_PRIMARY_WINDOW}` : 'Waiting for a valid sample.'}</div></div><div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-5 flex flex-col justify-between shadow-sm"><div><div class="text-white/50 text-xs font-medium mb-2">Runner-Up Margin</div><div class="text-xl font-semibold tracking-tight ${window.getMetricToneClass('margin', snapshot.topMargin)}">${leadCombo ? `${(snapshot.topMargin || 0) >= 0 ? '+' : ''}${snapshot.topMargin || 0}` : '-'}</div></div><div class="text-sm text-white/60 mt-2">${runnerUp ? `Runner-up is ${runnerUp.label} (${runnerUp.hits} hits)` : 'No runner-up yet.'}</div></div></div><div class="col-span-2 bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden mt-5 shadow-sm"><div class="bg-white/[0.02] text-white/70 text-sm font-medium p-4 border-b border-white/[0.08]">${ENGINE_PRIMARY_WINDOW}-Spin Combo Ranking</div><table class="w-full text-left text-sm"><thead class="bg-black/20 text-white/50 text-xs font-medium border-b border-white/[0.08]"><tr><th class="p-3 font-medium">Combo</th><th class="p-3 font-medium">Hits</th><th class="p-3 font-medium">Hot</th><th class="p-3 font-medium">Cold</th><th class="p-3 font-medium">Last Seen</th></tr></thead><tbody class="divide-y divide-white/[0.08]">${comboRows || '<tr><td colspan="5" class="p-6 text-center text-white/40 italic">Awaiting data...</td></tr>'}</tbody></table></div>`; };
    window.renderStrategyAnalytics = function () {
        let displayStrategy = 'series';
        if (window.state) {
            if (window.state.currentAnalyticsTab === 'perimeter') displayStrategy = 'perimeter';
            else if (window.state.analyticsDisplayStrategy === 'combo') displayStrategy = 'combo';
            else if (window.state.analyticsDisplayStrategy === 'inside') displayStrategy = 'inside';
        }

        const structHeader = document.getElementById('analyticsStructureHeader');
        if (structHeader) {
            if (displayStrategy === 'perimeter') structHeader.innerText = 'Signal';
            else if (displayStrategy === 'combo') structHeader.innerText = 'Combo';
            else if (displayStrategy === 'inside') structHeader.innerText = 'Pattern';
            else structHeader.innerText = 'Sequence';
        }

        const coreStats = (window.EngineCore && typeof window.EngineCore.getAnalyticsData === 'function') ? window.EngineCore.getAnalyticsData(displayStrategy) : { wins: 0, losses: 0, net: 0, streak: 0, history: [0], patterns: {} };
        const totalSignals = coreStats.wins + coreStats.losses;
        const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.wins / totalSignals) * 100);
        const hrEl = document.getElementById('kpiHitRate');
        if (hrEl) { hrEl.innerText = hitRate + "%"; hrEl.className = `text-2xl md:text-3xl font-black tracking-wide ${totalSignals === 0 ? 'text-white/90' : (hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]')}`; }
        const netEl = document.getElementById('kpiNet');
        if (netEl) { netEl.innerText = (coreStats.net > 0 ? '+' : '') + coreStats.net; netEl.className = `text-2xl md:text-3xl font-black tracking-wide ${coreStats.net > 0 ? 'text-[#30D158]' : (coreStats.net < 0 ? 'text-[#FF453A]' : 'text-white/90')}`; }
        const sigEl = document.getElementById('kpiSignals');
        if (sigEl) sigEl.innerText = totalSignals;
        const formEl = document.getElementById('kpiForm');
        if (formEl) {
            if (coreStats.form && coreStats.form.length > 0) {
                formEl.innerHTML = `<div class="flex items-center justify-center gap-1.5">${coreStats.form.map(res => `<span class="${res === 'W' ? 'text-[#30D158]' : 'text-[#FF453A]'} font-black text-sm">${res}</span>`).join('')}</div>`;
            } else {
                formEl.innerText = '-';
            }
        }

        if (window.drawAdvancedGraph) {
            window.drawAdvancedGraph(coreStats.history, coreStats.wins, coreStats.losses, 'graphContainer');
        }

        if (window.updatePatternHeatmap) {
            window.updatePatternHeatmap(coreStats.patterns, displayStrategy);
        }
    };

    window.drawAdvancedGraph = function (historyArray, winCount, lossCount, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';
        container.className = "flex flex-col h-full w-full rounded-b-[16px] overflow-hidden";

        const chartDiv = document.createElement('div');
        chartDiv.className = "relative h-[80%] w-full bg-[#1C1C1E]/40 group cursor-crosshair";
        container.appendChild(chartDiv);

        // HUD Overlay for Graph Stats
        const hudDiv = document.createElement('div');
        hudDiv.className = "h-[20%] w-full flex justify-between items-center px-4 text-[10px] font-black uppercase tracking-widest bg-black/20 border-t border-white/[0.05] backdrop-blur-sm";
        hudDiv.innerHTML = `
                <span class="text-[#30D158] drop-shadow-sm">WINS: ${winCount}</span>
                <span class="text-white/70 drop-shadow-sm">SPINS: ${historyArray ? Math.max(0, historyArray.length - 1) : 0}</span>
                <span class="text-[#FF453A] drop-shadow-sm tracking-wide">LOSSES: ${lossCount}</span>
            `;
        container.appendChild(hudDiv);

        if (!historyArray || historyArray.length < 2) {
            chartDiv.innerHTML = `<div class="flex items-center justify-center h-full text-[11px] font-black uppercase tracking-widest text-white/30 animate-pulse">Waiting for Data...</div>`;
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

        const uiOverlays = `<div class="graph-hover-line absolute hidden w-[1px] bg-white/20 pointer-events-none h-full top-0 z-10"></div><div class="graph-hover-hline absolute hidden h-[1px] bg-white/20 pointer-events-none w-full left-0 z-10"></div><div class="graph-hover-dot absolute hidden w-2.5 h-2.5 bg-white border-2 border-[#1C1C1E] rounded-full pointer-events-none transform -translate-x-1/2 -translate-y-1/2 shadow-[0_0_8px_rgba(255,255,255,0.6)] z-20"></div><div class="graph-tooltip absolute hidden bg-[#1C1C1E]/95 border border-white/[0.05] text-white/90 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg pointer-events-none z-30 backdrop-blur-md shadow-xl whitespace-nowrap"></div>`;

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

            tooltip.innerHTML = `<span class="text-white/50 mr-2">Spin ${i}</span><span class="${val >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}">${val > 0 ? '+' : ''}${val}</span>`;

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

    window.updatePatternHeatmap = function (patternData, strategyKey) {
        const tbody = document.getElementById('heatmapBody');
        if (!tbody) return;

        const strategy = window.StrategyRegistry && window.StrategyRegistry[strategyKey];
        const meta = (strategy && strategy.PATTERN_FILTER_META) ? strategy.PATTERN_FILTER_META : {};

        let keys = strategy && strategy.PATTERN_ORDER ? [...strategy.PATTERN_ORDER] : Object.keys(meta);
        if (keys.length === 0) keys = Object.keys(patternData);
        
        // If we are in perimeter mode, try to load labels from Inside strategy if available
        let displayMeta = meta;
        if (strategyKey === 'perimeter' && window.StrategyRegistry && window.StrategyRegistry.inside) {
            displayMeta = window.StrategyRegistry.inside.PATTERN_FILTER_META || {};
        }

        let hasData = false;
        let html = '';

        keys.forEach(key => {
            const data = patternData[key];
            if (!data) return;

            const m = displayMeta[key] || {};
            const label = m.label || key;
            const accent = m.accent || '#30D158';
            // Lookup stats using key first, fallback to label for legacy session data
            const stats = patternData[key] || patternData[label] || { wins: 0, losses: 0 };
            const total = stats.wins + stats.losses;

            hasData = true;
            const accuracy = total > 0 ? Math.round((stats.wins / total) * 100) : 0;
            let accColor = 'text-white/40';
            if (accuracy >= 50 && total > 0) accColor = 'text-[#30D158]';
            else if (total > 0) accColor = 'text-[#FF453A]';

            html += `
                <tr class="hover:bg-white/[0.04] transition-colors duration-300 border-b border-white/[0.08] last:border-0">
                    <td class="p-3 md:p-4 font-medium text-sm text-white/90">${label}</td>
                    <td class="p-3 md:p-4 text-right text-sm text-[#30D158] font-medium">${stats.wins}</td>
                    <td class="p-3 md:p-4 text-right text-sm text-[#FF453A] font-medium">${stats.losses}</td>
                    <td class="p-3 md:p-4 text-right text-sm ${accColor} font-bold tracking-wide">${accuracy}%</td>
                </tr>
            `;
        });

        if (!hasData) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-6 md:p-8 text-center text-white/40 italic text-xs">Awaiting pattern recognition...</td></tr>';
        } else {
            tbody.innerHTML = html;
        }
    };
})();
