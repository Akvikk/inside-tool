(function () {
    'use strict';

    window.formatPredictionDetail = function (entry) {
        const parts = [];
        if (entry && entry.targetFace !== undefined && entry.targetFace !== null && entry.targetFace !== '?') {
            parts.push(`F${entry.targetFace}`);
        }

        const stratKey = window.state?.currentGameplayStrategy || 'series';
        let label = '';
        if (stratKey === 'series') label = entry?.sequenceName || entry?.patternName || entry?.comboLabel;
        else if (stratKey === 'combo') label = entry?.comboLabel || entry?.patternName;
        else if (stratKey === 'inside') label = entry?.patternName || entry?.comboLabel;
        else label = entry?.comboLabel || entry?.patternName;

        if (label) parts.push(label);
        if (entry && Number.isFinite(entry.confidence) && entry.confidence > 0) {
            parts.push(`${entry.confidence}%`);
        }
        return parts.join(' • ');
    };

    window.renderPredictionCell = function (spin) {
        const blocks = [];

        if (spin.resolvedBets && spin.resolvedBets.length > 0) {
            const resultsHtml = spin.resolvedBets.map(bet => {
                const icon = bet.isWin ? '<i class="fas fa-check-circle text-[10px]"></i>' : '<i class="fas fa-times-circle text-[10px]"></i>';
                const status = bet.isWin ? 'WIN' : 'LOSS';
                const tone = bet.isWin ? 'prediction-entry--win' : 'prediction-entry--loss';
                const detail = window.formatPredictionDetail(bet) || 'Perimeter';
                const color = bet.isWin ? '#30D158' : '#FF453A';

                return `
                    <div class="prediction-entry ${tone} flex items-center gap-1.5 px-2 py-0.5 rounded-md border border-white/5 bg-white/5" style="border-left: 2px solid ${color};">
                        <span class="prediction-entry-status flex items-center gap-1 font-black text-[9px]">${icon}${status}</span>
                        <span class="prediction-entry-detail opacity-60 text-[9px] font-bold">${detail}</span>
                    </div>
                `;
            }).join('');

            blocks.push(`
                <div class="prediction-entry-block flex flex-wrap gap-1 mb-1.5">
                    ${resultsHtml}
                </div>
            `);
        }

        const signals = spin.newSignals || [];
        if (signals.length > 0) {
            const registry = window.StrategyRegistry || {};
            const stratKey = window.state?.currentGameplayStrategy || 'series';
            const strategy = registry[stratKey];

            let tooltipContent = signals.map((sig, index) => {
                const detail = window.formatPredictionDetail(sig) || 'Prediction Perimeter';
                const reasonStr = sig.reason ? `<div class="text-white/50 text-[9px] mt-0.5 leading-tight">${sig.reason}</div>` : '';

                let metaColor = null;
                let metaIcon = 'fa-bolt'; // Default fallback icon
                if (strategy && strategy.PATTERN_FILTER_META && strategy.PATTERN_FILTER_META[sig.filterKey]) {
                    metaColor = strategy.PATTERN_FILTER_META[sig.filterKey].accent;
                    if (strategy.PATTERN_FILTER_META[sig.filterKey].icon) {
                        metaIcon = strategy.PATTERN_FILTER_META[sig.filterKey].icon;
                    }
                }
                const color = sig.accentColor || metaColor || '#BF5AF2';
                const delay = 100 + (index * 75); // Stagger delays by 75ms
                return `<div class="mb-1.5 last:mb-0 opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-300 ease-out" style="transition-delay: ${delay}ms"><div class="font-bold tracking-wide flex items-center gap-1.5" style="color: ${color}; text-shadow: 0 2px 4px rgba(0,0,0,0.5), 0 0 10px currentColor;"><i class="fas ${metaIcon} opacity-80 text-[10px]"></i><span>${detail}</span></div>${reasonStr}</div>`;
            }).join('');

            blocks.push(`
                <div class="prediction-entry-block group relative inline-block w-full">
                    <div class="prediction-entry prediction-entry--signal cursor-help flex items-center justify-between">
                        <span class="prediction-entry-label transition-all duration-300 group-hover:text-[#BF5AF2] group-hover:[text-shadow:0_2px_4px_rgba(0,0,0,0.5),0_0_10px_currentColor]">Active Signals (${signals.length})</span>
                        <span class="prediction-entry-detail text-white/50 group-hover:text-white transition-colors ml-2"><i class="fas fa-info-circle mr-1"></i>Details</span>
                    </div>
                    <div class="absolute bottom-full right-0 mb-2 w-max max-w-[240px] p-2.5 bg-[#1C1C1E]/95 border border-white/[0.08] text-white/90 text-[10px] rounded-xl shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] backdrop-blur-xl whitespace-normal text-left pointer-events-none">
                        ${tooltipContent}
                    </div>
                </div>
            `);
        }

        if (blocks.length === 0) return '<span class="prediction-empty text-white/5">—</span>';
        return `<div class="prediction-cell-content">${blocks.join('')}</div>`;
    };

    window.renderComboCell = function (spin) {
        const registry = window.StrategyRegistry || {};
        const stratKey = window.state?.currentGameplayStrategy || 'series';
        const strategy = registry[stratKey];

        // Strategy might have a bridge connecting previous and current spins visually
        if (strategy && typeof strategy.detectBridge === 'function') {
            if (spin.index > 0) {
                const currMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[spin.num] : 0;
                const prevSpin = window.state?.history ? window.state.history[spin.index - 1] : null;
                if (prevSpin) {
                    const prevMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[prevSpin.num] : 0;
                    const bridge = strategy.detectBridge(prevMask, currMask, window.FACE_MASKS);
                    if (bridge) {
                        return `
                            <div class="absolute inset-x-0 top-0 -translate-y-1/2 h-0 pointer-events-none select-none z-[1] flex items-center justify-center">
                                <div class="combo-link-layer absolute overflow-visible"
                                     data-prev-spin-id="${prevSpin.id}"
                                     data-prev-face="${bridge.matchedPrevFace}"
                                     data-curr-face="${bridge.matchedCurrFace}"
                                     data-color="${bridge.color}"></div>
                                <div class="relative z-[2] inline-flex items-center justify-center">
                            <span class="combo-badge relative px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border shadow-2xl transition-all duration-300"
                                          style="color:${bridge.color}; border-color:${bridge.color}55; background-color:rgba(11,11,13,0.85); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); box-shadow: 0 0 8px ${bridge.color}40, inset 0 0 4px ${bridge.color}15;">
                                        ${bridge.label}
                                    </span>
                                </div>
                            </div>
                        `;
                    }
                }
            }
        }

        // Fallback for strategies that output standard signals/bets rather than drawing bridges
        if (spin.newSignals && spin.newSignals.length > 0) {
            const signal = spin.newSignals[0];
            let label = '-';

            if (stratKey === 'series') label = signal.sequenceName || signal.patternName || 'SEQ';
            else if (stratKey === 'combo') label = signal.comboLabel || signal.patternName || 'COMBO';
            else if (stratKey === 'inside') label = signal.patternName || 'PATTERN';
            else label = signal.patternName || '-';

            let metaColor = null;
            if (strategy && strategy.PATTERN_FILTER_META && strategy.PATTERN_FILTER_META[signal.filterKey]) {
                metaColor = strategy.PATTERN_FILTER_META[signal.filterKey].accent;
            }
            const color = signal.accentColor || metaColor || '#BF5AF2';

            if (label !== '-') {
                return `
                    <div class="relative z-[2] inline-flex items-center justify-center py-1">
                    <span class="combo-badge relative px-3 py-1 rounded-lg text-[10px] font-black tracking-widest uppercase border shadow-2xl transition-all duration-300"
                              style="color:${color}; border-color:${color}55; background-color:rgba(11,11,13,0.85); backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); box-shadow: 0 0 8px ${color}40, inset 0 0 4px ${color}15;">
                            ${label}
                        </span>
                    </div>
                `;
            }
        }

        return '<span class="text-gray-600 font-mono text-[10px]">-</span>';
    };

    window.renderRow = function (spin, targetContainer) {
        if (spin.strategy && window.state && spin.strategy !== window.state.currentGameplayStrategy) return;

        const tbody = targetContainer || document.getElementById('historyBody');
        if (!tbody) return;

        // No spacer needed, the table header provides the context.
        const tr = document.createElement('tr');
        tr.className = "history-row relative transition-all duration-300 bg-transparent hover:bg-white/[0.04]";
        tr.id = `row-${spin.id}`;

        const RED_NUMS = window.config && window.config.RED_NUMS ? window.config.RED_NUMS : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        let bgClass = spin.num === 0 ? 'bg-green' : (RED_NUMS.includes(spin.num) ? 'bg-red' : 'bg-black');

        let faceHTML = '<span class="text-gray-600">-</span>';
        if (spin.faces && spin.faces.length > 0) {
            let faceTags = spin.faces.map(fId => {
                let fStyle = window.FACES ? window.FACES[fId] : { color: '#fff', border: '#fff', bg: '#000' };
                return `<span class="face-tag mb-0.5 mr-1" data-spin-id="${spin.id}" data-face-id="${fId}" style="color:${fStyle.color}; border:1px solid ${fStyle.border}; background:${fStyle.bg};">F${fId}</span>`;
            }).join('');
            faceHTML = `<div class="flex flex-wrap justify-center">${faceTags}</div>`;
        }

        const comboHTML = window.renderComboCell ? window.renderComboCell(spin) : '<span class="text-gray-600">-</span>';
        const predictionHTML = window.renderPredictionCell ? window.renderPredictionCell(spin) : '<span class="text-gray-600">-</span>';

        tr.innerHTML = `
        <td class="text-center text-[11px] font-black tracking-widest text-white/30">#${spin.index + 1}</td>
            <td class="text-center"><div class="num-box ${bgClass}">${spin.num}</div></td>
            <td class="text-center relative z-[5]">${faceHTML}</td>
            <td class="text-center relative overflow-visible z-[1]">${comboHTML}</td>
            <td class="prediction-cell relative overflow-visible z-[10]">${predictionHTML}</td>
        `;
        tbody.appendChild(tr);

        if (!targetContainer) {
            const sc = document.getElementById('historyScrollContainer') || document.querySelector('#scrollContainer > div') || document.getElementById('scrollContainer');
            if (sc) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        sc.scrollTop = sc.scrollHeight + 150;
                    });
                    requestAnimationFrame(() => {
                        sc.scrollTop = sc.scrollHeight + 150;
                    });
                });
            }
            if (window.layoutComboBridge) requestAnimationFrame(() => window.layoutComboBridge(spin.id));
        }
    };

    window.reRenderHistory = function (options = {}) {
        const tbody = document.getElementById('historyBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (window.state && window.state.history) {
            const fragment = document.createDocumentFragment();
            window.state.history.forEach(spin => {
                if (window.renderRow) window.renderRow(spin, fragment);
            });
            tbody.appendChild(fragment);
        }
        if (window.layoutAllComboBridges) {
            requestAnimationFrame(window.layoutAllComboBridges);
        }

        if (options.scrollToEnd !== false) {
            const sc = document.getElementById('historyScrollContainer') || document.querySelector('#scrollContainer > div') || document.getElementById('scrollContainer');
            if (sc) {
                requestAnimationFrame(() => {
                    sc.scrollTop = sc.scrollHeight + 150;
                });
            }
        }
    };

    window.rebuildSessionFromSpins = async function (spins, options = {}) {
        let spinner = document.getElementById('importSpinnerOverlay');
        if (!spinner) {
            spinner = document.createElement('div');
            spinner.id = 'importSpinnerOverlay';
            spinner.className = 'fixed inset-0 bg-[#0b0b0d]/40 z-[9999] flex items-center justify-center backdrop-blur-2xl transition-opacity duration-300';
            spinner.innerHTML = `
                <div class="flex flex-col items-center">
                    <svg class="animate-spin h-10 w-10 text-[#BF5AF2] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <div class="text-white/80 font-mono text-xs font-medium tracking-widest uppercase">Processing Data...</div>
                </div>
            `;
            document.body.appendChild(spinner);
        }
        spinner.classList.remove('hidden');
        spinner.style.opacity = '1';

        await new Promise(r => setTimeout(r, 50));

        try {
            if (!window.state) window.state = {};
            window.state.history = [];
            window.state.activeBets = [];
            window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            window.state.globalSpinIdCounter = 0;
            if (!window.state.userStats) window.state.userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
            if (!window.state.engineStats) window.state.engineStats = { totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0, bankrollHistory: [0], patternStats: {}, signalLog: [] };
            window.state.engineSnapshot = null;
            window.state.currentNeuralSignal = null;
            window.state.strategySyncCache = { series: null, combo: null, inside: null };

            window.currentAlerts = [];
            if (window.EngineCore) window.EngineCore.reset();

            const tbody = document.getElementById('historyBody');
            if (tbody) tbody.innerHTML = '';

            if (spins && spins.length > 0) {
                const stateRef = window.state;
                const fonMap = window.FON_MAP || {};
                const fonMaskMap = window.FON_MASK_MAP || {};
                const faceMasks = window.FACE_MASKS || {};
                const faces = window.FACES || {};

                for (let i = 0; i < spins.length; i++) {
                    const val = spins[i];
                    const matchedFaces = Object.prototype.hasOwnProperty.call(fonMap, val) ? fonMap[val].slice() : [];
                    const matchedFaceMask = Object.prototype.hasOwnProperty.call(fonMaskMap, val) ? fonMaskMap[val] : 0;

                    // 1. Resolve Turn (for the bets made after the PREVIOUS spin)
                    if (window.EngineCore && typeof window.EngineCore.resolveTurn === 'function') {
                        try {
                            window.EngineCore.resolveTurn(val, matchedFaceMask, stateRef.activeBets, stateRef.currentGameplayStrategy, null, {
                                historyLength: stateRef.history.length,
                                faceMasks: faceMasks,
                                faces: faces
                            });
                        } catch (e) { console.error(e); }
                    }

                    // 2. Clear Active Bets (they were just resolved)
                    const previousResolvedBets = (stateRef.activeBets || []).map(bet => {
                        const targetMask = faceMasks[bet.targetFace] || 0;
                        return {
                            patternName: bet.patternName || 'Unknown',
                            filterKey: bet.filterKey || bet.patternName,
                            strategy: bet.strategy || '',
                            targetFace: bet.targetFace,
                            isWin: (matchedFaceMask & targetMask) !== 0,
                            confirmed: bet.confirmed === true
                        };
                    });
                    stateRef.activeBets = [];

                    // 3. Update Gaps
                    for (let f = 1; f <= 5; f++) stateRef.faceGaps[f] = (stateRef.faceGaps[f] || 0) + 1;
                    matchedFaces.forEach(f => stateRef.faceGaps[f] = 0);

                    const spinObj = {
                        num: val,
                        faces: matchedFaces,
                        index: stateRef.history.length,
                        resolvedBets: previousResolvedBets,
                        newSignals: [],
                        id: ++stateRef.globalSpinIdCounter || 1
                    };
                    stateRef.history.push(spinObj);

                    // 4. Generate New Predictions (for the NEXT spin)
                    if (window.scanAllStrategies) {
                        const scanResult = await window.scanAllStrategies({ skipStoreSync: true, silent: true });
                        stateRef.activeBets = scanResult.nextBets || [];

                        if (stateRef.strategySyncCache && typeof stateRef.strategySyncCache === 'object') {
                            stateRef.strategySyncCache[stateRef.currentGameplayStrategy || 'series'] = scanResult;
                        }

                        spinObj.newSignals = stateRef.activeBets.map(b => ({
                            patternName: b.patternName,
                            filterKey: b.filterKey || b.patternName,
                            targetFace: b.targetFace,
                            comboLabel: b.comboLabel || null,
                            confidence: Number.isFinite(b.confidence) ? b.confidence : null,
                            reason: b.reason || b.subtitle || '',
                            status: b.status || 'GO',
                            signalSource: b.signalSource || 'math',
                            accentColor: b.accentColor
                        }));
                    }
                }
            }

            if (window.reRenderHistory) window.reRenderHistory(options);
            if (window.renderGapStats) window.renderGapStats();
            const alerts = window.scanAllStrategies ? await window.scanAllStrategies() : [];
            if (window.renderDashboardSafe) window.renderDashboardSafe(alerts);
            if (window.HudManager) window.HudManager.update();
            if (window.saveSessionData) window.saveSessionData();
            if (window.syncAppStore) window.syncAppStore();
        } finally {
            if (spinner) {
                spinner.style.opacity = '0';
                setTimeout(() => spinner.classList.add('hidden'), 300);
            }
        }
    };

    window.layoutComboBridge = function (spinId) {
        const row = document.getElementById(`row-${spinId}`);
        if (!row) return;
        const layer = row.querySelector('.combo-link-layer'), badge = row.querySelector('.combo-badge'), comboCell = row.querySelector('td:nth-child(4)');
        if (!layer || !badge || !comboCell) return;
        const prevSpinId = layer.dataset.prevSpinId, prevFace = parseInt(layer.dataset.prevFace, 10), currFace = parseInt(layer.dataset.currFace, 10), color = layer.dataset.color || '#ffffff';
        if (!prevSpinId || Number.isNaN(prevFace) || Number.isNaN(currFace)) return;
        const prevTag = document.querySelector(`.face-tag[data-spin-id="${prevSpinId}"][data-face-id="${prevFace}"]`), currTag = row.querySelector(`.face-tag[data-spin-id="${spinId}"][data-face-id="${currFace}"]`);
        if (!prevTag || !currTag) return;
        const cellRect = comboCell.getBoundingClientRect(), prevRect = prevTag.getBoundingClientRect(), currRect = currTag.getBoundingClientRect(), badgeRect = badge.getBoundingClientRect();
        const prevPoint = { x: prevRect.right - cellRect.left + 4, y: prevRect.top + prevRect.height / 2 - cellRect.top }, currPoint = { x: currRect.right - cellRect.left + 4, y: currRect.top + currRect.height / 2 - cellRect.top }, badgePoint = { x: badgeRect.left - cellRect.left + Math.max(5, Math.min(11, badgeRect.width * 0.16)), y: badgeRect.top + badgeRect.height / 2 - cellRect.top };
        const availableReach = Math.max(30, badgePoint.x - Math.max(prevPoint.x, currPoint.x)), mergeBackoff = Math.max(10, Math.min(18, availableReach * 0.18)), mergePoint = { x: badgePoint.x - mergeBackoff, y: badgePoint.y };
        if (Math.abs(prevPoint.y - mergePoint.y) > 1000 || Math.abs(currPoint.y - mergePoint.y) > 1000) { layer.innerHTML = ''; layer._comboGeom = null; return; }
        const nextGeom = { p1: prevPoint, p2: currPoint, m: mergePoint, b: badgePoint, color: color }, prevGeom = layer._comboGeom || { p1: { ...badgePoint }, p2: { ...badgePoint }, m: { ...badgePoint }, b: { ...badgePoint }, color: color };
        if (window.animateComboBridge) window.animateComboBridge(layer, prevGeom, nextGeom, 260);
        layer._comboGeom = nextGeom;
    };

    window.layoutAllComboBridges = function () {
        if (window.state && window.state.history) {
            window.state.history.forEach(spin => {
                if (window.layoutComboBridge) window.layoutComboBridge(spin.id);
            });
        }
    };

    window.scheduleComboBridgeRelayout = function () {
        if (window._comboRelayoutFrame) cancelAnimationFrame(window._comboRelayoutFrame);
        window._comboRelayoutFrame = requestAnimationFrame(() => {
            window._comboRelayoutFrame = null;
            if (window.layoutAllComboBridges) window.layoutAllComboBridges();
        });
    };

    window.initComboBridgeAutoLayout = function () {
        if (window._comboBridgeAutoLayoutInit) return;
        window._comboBridgeAutoLayoutInit = true;
        window.addEventListener('resize', window.scheduleComboBridgeRelayout, { passive: true });
        window.addEventListener('orientationchange', window.scheduleComboBridgeRelayout, { passive: true });
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => {
            if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout();
        });
        const scrollPane = document.querySelector('#scrollContainer > div');
        const historyBody = document.getElementById('historyBody');
        if (scrollPane) observer.observe(scrollPane);
        if (historyBody) observer.observe(historyBody);
        window._comboBridgeResizeObserver = observer;
    };

    window.ensureComboBridgeElements = function (layer) {
        let svg = layer.querySelector('svg');
        if (!svg) {
            layer.innerHTML = `
                <svg class="overflow-visible">
                    <path class="combo-path-glow-1" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                    <path class="combo-path-glow-2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                    <path class="combo-path-glow-merge" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                    <path class="combo-path-core-1" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                    <path class="combo-path-core-2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                    <path class="combo-path-core-merge" fill="none" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
            `;
            svg = layer.querySelector('svg');
        }
        return {
            svg,
            glow1: layer.querySelector('.combo-path-glow-1'),
            glow2: layer.querySelector('.combo-path-glow-2'),
            glowMerge: layer.querySelector('.combo-path-glow-merge'),
            core1: layer.querySelector('.combo-path-core-1'),
            core2: layer.querySelector('.combo-path-core-2'),
            coreMerge: layer.querySelector('.combo-path-core-merge')
        };
    };

    window.drawComboBridge = function (layer, geom) {
        const { svg, glow1, glow2, glowMerge, core1, core2, coreMerge } = window.ensureComboBridgeElements(layer);
        const minX = Math.min(geom.p1.x, geom.p2.x, geom.m.x, geom.b.x) - 14;
        const maxX = Math.max(geom.p1.x, geom.p2.x, geom.m.x, geom.b.x) + 10;
        const minY = Math.min(geom.p1.y, geom.p2.y, geom.m.y, geom.b.y) - 14;
        const maxY = Math.max(geom.p1.y, geom.p2.y, geom.m.y, geom.b.y) + 14;
        const width = Math.max(24, maxX - minX);
        const height = Math.max(24, maxY - minY);

        layer.style.left = `${minX}px`;
        layer.style.top = `${minY}px`;
        layer.style.width = `${width}px`;
        layer.style.height = `${height}px`;

        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

        const p1 = { x: geom.p1.x - minX, y: geom.p1.y - minY };
        const p2 = { x: geom.p2.x - minX, y: geom.p2.y - minY };
        const m = { x: geom.m.x - minX, y: geom.m.y - minY };
        const b = { x: geom.b.x - minX, y: geom.b.y - minY };

        const makeBranchPath = (p) => {
            const spanX = Math.max(28, m.x - p.x);
            const startLead = Math.max(16, Math.min(46, spanX * 0.34));
            const endLead = Math.max(12, Math.min(28, spanX * 0.26));
            return `M ${p.x} ${p.y} C ${p.x + startLead} ${p.y}, ${m.x - endLead} ${m.y}, ${m.x} ${m.y}`;
        };
        const makeMergePath = () => {
            const spanX = Math.max(0, b.x - m.x);
            if (spanX < 1) return `M ${m.x} ${m.y}`;
            const c1x = m.x + Math.max(4, Math.min(12, spanX * 0.58));
            const c2x = b.x - Math.max(2, Math.min(8, spanX * 0.28));
            return `M ${m.x} ${m.y} C ${c1x} ${m.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`;
        };

        const d1 = makeBranchPath(p1);
        const d2 = makeBranchPath(p2);
        const dMerge = makeMergePath();

        const connectorReach = Math.max(36, b.x - Math.min(p1.x, p2.x));
        const responsiveScale = Math.max(0.58, Math.min(1.04, connectorReach / 156));
        const coreWidth = (1.9 * responsiveScale).toFixed(2);
        const mergeCoreWidth = (2.05 * responsiveScale).toFixed(2);
        const glowWidth = (4.1 * responsiveScale).toFixed(2);
        const coreOpacity = Math.max(0.2, Math.min(0.85, 0.4 + responsiveScale * 0.3)).toFixed(2);
        const glowOpacity = Math.max(0.1, Math.min(0.6, 0.2 + responsiveScale * 0.2)).toFixed(2);
        const blurPx = Math.max(2, Math.floor(4 * responsiveScale));

        [glow1, glow2].forEach((p, idx) => {
            p.setAttribute('d', idx === 0 ? d1 : d2);
            p.setAttribute('stroke', geom.color);
            p.setAttribute('stroke-width', glowWidth);
            p.setAttribute('stroke-opacity', glowOpacity);
            p.style.filter = `drop-shadow(0 0 ${blurPx}px ${geom.color}40)`;
        });
        glowMerge.setAttribute('d', dMerge);
        glowMerge.setAttribute('stroke', geom.color);
        glowMerge.setAttribute('stroke-opacity', (parseFloat(glowOpacity) * 0.94).toFixed(2));
        glowMerge.style.filter = `drop-shadow(0 0 ${blurPx + 1}px ${geom.color}40)`;

        [core1, core2].forEach((p, idx) => {
            p.setAttribute('d', idx === 0 ? d1 : d2);
            p.setAttribute('stroke', geom.color);
            p.setAttribute('stroke-opacity', coreOpacity);
        });
        coreMerge.setAttribute('d', dMerge);
        coreMerge.setAttribute('stroke', geom.color);
        coreMerge.setAttribute('stroke-width', mergeCoreWidth);
        coreMerge.setAttribute('stroke-opacity', Math.min(0.98, parseFloat(coreOpacity) + 0.04).toFixed(2));
    };

    window.animateComboBridge = function (layer, fromGeom, toGeom, duration = 260) {
        if (layer._comboAnimFrame) cancelAnimationFrame(layer._comboAnimFrame);
        const startTime = performance.now();
        const easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        const lerp = (a, b, t) => a + (b - a) * t;

        const tick = (now) => {
            const raw = Math.min(1, (now - startTime) / duration);
            const t = easeInOutCubic(raw);
            const geom = {
                p1: { x: lerp(fromGeom.p1.x, toGeom.p1.x, t), y: lerp(fromGeom.p1.y, toGeom.p1.y, t) },
                p2: { x: lerp(fromGeom.p2.x, toGeom.p2.x, t), y: lerp(fromGeom.p2.y, toGeom.p2.y, t) },
                m: { x: lerp(fromGeom.m.x, toGeom.m.x, t), y: lerp(fromGeom.m.y, toGeom.m.y, t) },
                b: { x: lerp(fromGeom.b.x, toGeom.b.x, t), y: lerp(fromGeom.b.y, toGeom.b.y, t) },
                color: toGeom.color
            };
            if (window.drawComboBridge) window.drawComboBridge(layer, geom);
            if (raw < 1) {
                layer._comboAnimFrame = requestAnimationFrame(tick);
            } else {
                layer._comboAnimFrame = null;
                layer._comboGeom = toGeom;
            }
        };
        layer._comboAnimFrame = requestAnimationFrame(tick);
    };
})();