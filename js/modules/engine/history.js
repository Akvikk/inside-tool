(function () {
    'use strict';

    function formatPredictionDetail(entry) {
        const parts = [];
        if (entry && entry.targetFace !== undefined && entry.targetFace !== null && entry.targetFace !== '?') parts.push(`F${entry.targetFace}`);
        const label = entry && (entry.comboLabel || entry.patternName);
        if (label) parts.push(label);
        if (entry && Number.isFinite(entry.confidence) && entry.confidence > 0) parts.push(`${entry.confidence}%`);
        return parts.join(' • ');
    }

    window.renderPredictionCell = function (spin) {
        const blocks = [];
        if (spin.resolvedBets && spin.resolvedBets.length > 0) {
            spin.resolvedBets.forEach(bet => {
                if (bet.strategy && window.state && bet.strategy !== window.state.currentGameplayStrategy) return;
                const icon = bet.isWin ? '<i class="fas fa-check-circle"></i>' : '<i class="fas fa-times-circle"></i>';
                const status = bet.isWin ? 'WIN' : 'LOSS';
                const tone = bet.isWin ? 'prediction-entry--win' : 'prediction-entry--loss';
                const detail = formatPredictionDetail(bet) || 'Perimeter';
                blocks.push(`
                    <div class="prediction-entry-block">
                        <div class="prediction-entry ${tone}">
                            <span class="prediction-entry-status">${icon}${status}</span>
                            <span class="prediction-entry-detail">${detail}</span>
                        </div>
                    </div>
                `);
            });
        }

        const signals = spin.newSignals || [];
        signals.forEach(sig => {
            if (sig.strategy && window.state && sig.strategy !== window.state.currentGameplayStrategy) return;
            const detail = formatPredictionDetail(sig) || 'Prediction Perimeter';
            const note = sig.reason ? `<div class="prediction-entry-note">${sig.reason}</div>` : '';
            blocks.push(`
                <div class="prediction-entry-block">
                    <div class="prediction-entry prediction-entry--signal">
                        <span class="prediction-entry-label">Active Signal</span>
                        <span class="prediction-entry-detail">${detail}</span>
                    </div>
                    ${note}
                </div>
            `);
        });

        if (blocks.length === 0) return '<span class="prediction-empty">-</span>';
        return `<div class="prediction-cell-content">${blocks.join('')}</div>`;
    };

    window.renderComboCell = function (spin) {
        const registry = window.StrategyRegistry || {};
        const stratKey = window.state.currentGameplayStrategy || 'series';
        const strategy = registry[stratKey];
        if (!strategy || typeof strategy.detectBridge !== 'function') return '<span class="text-gray-600">-</span>';
        if (spin.index <= 0) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';
        const currMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[spin.num] : 0;
        const prevSpin = window.state.history ? window.state.history[spin.index - 1] : null;
        if (!prevSpin) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';
        const prevMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[prevSpin.num] : 0;
        const bridge = strategy.detectBridge(prevMask, currMask, window.FACE_MASKS);
        if (!bridge || !prevSpin) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';
        return `
            <div class="absolute inset-x-0 top-0 -translate-y-1/2 h-0 pointer-events-none select-none z-[1] flex items-center justify-center">
                <div class="combo-link-layer absolute overflow-visible" data-prev-spin-id="${prevSpin.id}" data-prev-face="${bridge.matchedPrevFace}" data-curr-face="${bridge.matchedCurrFace}" data-color="${bridge.color}"></div>
                <div class="relative z-[2] inline-flex items-center justify-center">
                    <span class="combo-badge relative px-3 py-1 rounded-md text-[10px] font-black font-mono tracking-widest border shadow-2xl transition-all duration-300" style="color:${bridge.color}; border-color:${bridge.color}55; background-color:#0b0b0d; box-shadow: 0 0 8px ${bridge.color}40, inset 0 0 4px ${bridge.color}15;">
                        ${bridge.label}
                    </span>
                </div>
            </div>
        `;
    };

    window.renderRow = function (spin, targetContainer) {
        const tbody = targetContainer || document.getElementById('historyBody');
        if (!tbody) return;
        const tr = document.createElement('tr');
        tr.className = "history-row relative hover:bg-white/[0.02] transition-colors";
        tr.id = 'row-' + spin.id;
        const RED_NUMS = window.config ? window.config.RED_NUMS : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
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
        tr.innerHTML = `<td class="text-center font-mono text-xs text-gray-400">#${spin.index + 1}</td><td class="text-center"><div class="num-box ${bgClass}">${spin.num}</div></td><td class="text-center relative z-[5]">${faceHTML}</td><td class="text-center relative overflow-visible z-[1]">${comboHTML}</td><td class="prediction-cell">${predictionHTML}</td>`;
        tbody.appendChild(tr);
        if (!targetContainer) {
            const sc = document.querySelector('#scrollContainer > div');
            if (sc) { setTimeout(() => { sc.scrollTop = sc.scrollHeight; }, 50); }
            if (window.layoutComboBridge) requestAnimationFrame(() => window.layoutComboBridge(spin.id));
        }
    };

    window.reRenderHistory = function () {
        const tbody = document.getElementById('historyBody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (window.state && window.state.history) {
            const fragment = document.createDocumentFragment();
            window.state.history.forEach(spin => { if (window.renderRow) window.renderRow(spin, fragment); });
            tbody.appendChild(fragment);
        }
        if (window.layoutAllComboBridges) requestAnimationFrame(window.layoutAllComboBridges);
    };

    window.rebuildSessionFromSpins = async function (spins, options = {}) {
        if (window.state) {
            window.state.history = []; window.state.activeBets = []; window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            window.state.globalSpinIdCounter = 0; window.state.userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
            window.state.engineSnapshot = null; window.state.currentNeuralSignal = null; window.state.strategySyncCache = { series: null, combo: null };
        }
        window.currentAlerts = [];
        if (window.EngineCore) window.EngineCore.reset();
        const tbody = document.getElementById('historyBody');
        if (tbody) tbody.innerHTML = '';
        if (window.InputProcessor && window.InputProcessor.processSpinValue) {
            for (const spinNum of spins) await window.InputProcessor.processSpinValue(spinNum, { silent: true, skipStoreSync: true });
        }
        if (window.reRenderHistory) window.reRenderHistory();
        if (window.renderGapStats) window.renderGapStats();
        const alerts = window.scanAllStrategies ? await window.scanAllStrategies() : [];
        if (window.renderDashboardSafe) window.renderDashboardSafe(alerts);
        if (window.HudManager) window.HudManager.update();
        if (window.saveSessionData) window.saveSessionData();
        if (window.syncAppStore) window.syncAppStore();
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
    }

    window.layoutAllComboBridges = function () { if (window.state && window.state.history) window.state.history.forEach(spin => window.layoutComboBridge(spin.id)); }
    window.scheduleComboBridgeRelayout = function () { if (window._comboRelayoutFrame) cancelAnimationFrame(window._comboRelayoutFrame); window._comboRelayoutFrame = requestAnimationFrame(() => { window._comboRelayoutFrame = null; if (window.layoutAllComboBridges) window.layoutAllComboBridges(); }); };
    window.initComboBridgeAutoLayout = function () {
        if (window._comboBridgeAutoLayoutInit) return;
        window._comboBridgeAutoLayoutInit = true;
        window.addEventListener('resize', window.scheduleComboBridgeRelayout, { passive: true });
        window.addEventListener('orientationchange', window.scheduleComboBridgeRelayout, { passive: true });
        if (typeof ResizeObserver === 'undefined') return;
        const observer = new ResizeObserver(() => { if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout(); });
        const scrollPane = document.querySelector('#scrollContainer > div'), historyBody = document.getElementById('historyBody');
        if (scrollPane) observer.observe(scrollPane);
        if (historyBody) observer.observe(historyBody);
        window._comboBridgeResizeObserver = observer;
    };

    window.ensureComboBridgeElements = function (layer) { let svg = layer.querySelector('svg'); if (!svg) { layer.innerHTML = `<svg class="overflow-visible"><path class="combo-path-glow-1" fill="none" stroke-linecap="round" stroke-linejoin="round" /><path class="combo-path-glow-2" fill="none" stroke-linecap="round" stroke-linejoin="round" /><path class="combo-path-glow-merge" fill="none" stroke-linecap="round" stroke-linejoin="round" /><path class="combo-path-core-1" fill="none" stroke-linecap="round" stroke-linejoin="round" /><path class="combo-path-core-2" fill="none" stroke-linecap="round" stroke-linejoin="round" /><path class="combo-path-core-merge" fill="none" stroke-linecap="round" stroke-linejoin="round" /></svg>`; svg = layer.querySelector('svg'); } return { svg, glow1: layer.querySelector('.combo-path-glow-1'), glow2: layer.querySelector('.combo-path-glow-2'), glowMerge: layer.querySelector('.combo-path-glow-merge'), core1: layer.querySelector('.combo-path-core-1'), core2: layer.querySelector('.combo-path-core-2'), coreMerge: layer.querySelector('.combo-path-core-merge') }; }
    window.drawComboBridge = function (layer, geom) { const { svg, glow1, glow2, glowMerge, core1, core2, coreMerge } = window.ensureComboBridgeElements(layer); const minX = Math.min(geom.p1.x, geom.p2.x, geom.m.x, geom.b.x) - 14, maxX = Math.max(geom.p1.x, geom.p2.x, geom.m.x, geom.b.x) + 10, minY = Math.min(geom.p1.y, geom.p2.y, geom.m.y, geom.b.y) - 14, maxY = Math.max(geom.p1.y, geom.p2.y, geom.m.y, geom.b.y) + 14, width = Math.max(24, maxX - minX), height = Math.max(24, maxY - minY); layer.style.left = `${minX}px`; layer.style.top = `${minY}px`; layer.style.width = `${width}px`; layer.style.height = `${height}px`; svg.setAttribute('width', width); svg.setAttribute('height', height); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); const p1 = { x: geom.p1.x - minX, y: geom.p1.y - minY }, p2 = { x: geom.p2.x - minX, y: geom.p2.y - minY }, m = { x: geom.m.x - minX, y: geom.m.y - minY }, b = { x: geom.b.x - minX, y: geom.b.y - minY }; const makeBranchPath = (p) => { const spanX = Math.max(28, m.x - p.x); const startLead = Math.max(16, Math.min(46, spanX * 0.34)); const endLead = Math.max(12, Math.min(28, spanX * 0.26)); return `M ${p.x} ${p.y} C ${p.x + startLead} ${p.y}, ${m.x - endLead} ${m.y}, ${m.x} ${m.y}`; }; const makeMergePath = () => { const spanX = Math.max(0, b.x - m.x); if (spanX < 1) return `M ${m.x} ${m.y}`; const c1x = m.x + Math.max(4, Math.min(12, spanX * 0.58)); const c2x = b.x - Math.max(2, Math.min(8, spanX * 0.28)); return `M ${m.x} ${m.y} C ${c1x} ${m.y}, ${c2x} ${b.y}, ${b.x} ${b.y}`; }; const d1 = makeBranchPath(p1), d2 = makeBranchPath(p2), dMerge = makeMergePath(); const connectorReach = Math.max(36, b.x - Math.min(p1.x, p2.x)), responsiveScale = Math.max(0.58, Math.min(1.04, connectorReach / 156)), coreWidth = (1.9 * responsiveScale).toFixed(2), mergeCoreWidth = (2.05 * responsiveScale).toFixed(2), glowWidth = (4.1 * responsiveScale).toFixed(2), coreOpacity = Math.max(0.8, Math.min(0.95, 0.8 + responsiveScale * 0.12)).toFixed(2), glowOpacity = Math.max(0.18, Math.min(0.32, 0.16 + responsiveScale * 0.15)).toFixed(2), blurPx = Math.max(2, Math.round(5 * responsiveScale));[glow1, glow2].forEach((p, idx) => { p.setAttribute('d', idx === 0 ? d1 : d2); p.setAttribute('stroke', geom.color); p.setAttribute('stroke-width', glowWidth); p.setAttribute('stroke-opacity', glowOpacity); p.style.filter = `drop-shadow(0 0 ${blurPx}px ${geom.color})`; }); glowMerge.setAttribute('d', dMerge); glowMerge.setAttribute('stroke', geom.color); glowMerge.setAttribute('stroke-width', glowWidth); glowMerge.setAttribute('stroke-opacity', (parseFloat(glowOpacity) * 0.94).toFixed(2)); glowMerge.style.filter = `drop-shadow(0 0 ${blurPx + 1}px ${geom.color})`;[core1, core2].forEach((p, idx) => { p.setAttribute('d', idx === 0 ? d1 : d2); p.setAttribute('stroke', geom.color); p.setAttribute('stroke-width', coreWidth); p.setAttribute('stroke-opacity', coreOpacity); }); coreMerge.setAttribute('d', dMerge); coreMerge.setAttribute('stroke', geom.color); coreMerge.setAttribute('stroke-width', mergeCoreWidth); coreMerge.setAttribute('stroke-opacity', Math.min(0.98, parseFloat(coreOpacity) + 0.04).toFixed(2)); }
    window.animateComboBridge = function (layer, fromGeom, toGeom, duration = 260) {
        if (layer._comboAnimFrame) cancelAnimationFrame(layer._comboAnimFrame);
        const startTime = performance.now(), easeInOutCubic = (x) => x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2, lerp = (a, b, t) => a + (b - a) * t;
        const tick = (now) => {
            const raw = Math.min(1, (now - startTime) / duration), t = easeInOutCubic(raw);
            const geom = { p1: { x: lerp(fromGeom.p1.x, toGeom.p1.x, t), y: lerp(fromGeom.p1.y, toGeom.p1.y, t) }, p2: { x: lerp(fromGeom.p2.x, toGeom.p2.x, t), y: lerp(fromGeom.p2.y, toGeom.p2.y, t) }, m: { x: lerp(fromGeom.m.x, toGeom.m.x, t), y: lerp(fromGeom.m.y, toGeom.m.y, t) }, b: { x: lerp(fromGeom.b.x, toGeom.b.x, t), y: lerp(fromGeom.b.y, toGeom.b.y, t) }, color: toGeom.color };
            if (window.drawComboBridge) window.drawComboBridge(layer, geom);
            if (raw < 1) { layer._comboAnimFrame = requestAnimationFrame(tick); } else { layer._comboAnimFrame = null; layer._comboGeom = toGeom; }
        };
        layer._comboAnimFrame = requestAnimationFrame(tick);
    }
})();