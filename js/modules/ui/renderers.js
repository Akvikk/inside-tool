(function () {
    'use strict';

    function buildStrategicBrainSummary() {
        const coreStats = window.EngineCore && window.EngineCore.stats
            ? window.EngineCore.stats
            : { totalWins: 0, totalLosses: 0, netUnits: 0 };
        const totalSignals = coreStats.totalWins + coreStats.totalLosses;
        const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.totalWins / totalSignals) * 100);
        const recentFaces = state.history.slice(-8).map(spin => window.FON_PRIMARY_FACE_MAP[spin.num] || 0).filter(Boolean);
        const faceCounts = recentFaces.reduce((acc, face) => {
            acc[face] = (acc[face] || 0) + 1;
            return acc;
        }, {});
        const dominantFaceEntry = Object.entries(faceCounts).sort((a, b) => b[1] - a[1])[0] || null;
        const dominantFace = dominantFaceEntry ? Number(dominantFaceEntry[0]) : null;
        const dominantHits = dominantFaceEntry ? dominantFaceEntry[1] : 0;
        const topGapEntry = Object.entries(state.faceGaps).sort((a, b) => b[1] - a[1])[0] || ['0', 0];
        const topGapFace = Number(topGapEntry[0]) || null;
        const topGapValue = Number(topGapEntry[1]) || 0;
        const neuralConfidence = state.currentNeuralSignal && Number.isFinite(state.currentNeuralSignal.confidence)
            ? state.currentNeuralSignal.confidence
            : 0;
        const trendBonus = dominantHits >= 4 ? 16 : dominantHits >= 3 ? 8 : 0;
        const gapBonus = topGapValue >= 8 ? 10 : topGapValue >= 6 ? 5 : 0;
        const pnlPenalty = coreStats.netUnits < 0 ? Math.min(18, Math.abs(coreStats.netUnits) * 3) : 0;
        const chaosPenalty = recentFaces.length >= 6 && new Set(recentFaces).size >= 5 ? 14 : 0;
        const predictabilityScore = Math.max(8, Math.min(96, Math.round(hitRate * 0.45 + neuralConfidence * 0.35 + trendBonus + gapBonus - pnlPenalty - chaosPenalty)));

        let verdict = 'Feed more spins to the local brain before acting.';
        let pivot = '';

        if (state.history.length < 8) {
            verdict = 'Sample too thin. Let the wheel print a cleaner rhythm before trusting any push.';
        } else if (state.currentNeuralSignal && state.currentNeuralSignal.status === 'SIT_OUT') {
            verdict = state.currentNeuralSignal.reason || 'Noise detected. Local brain says stand down and wait for a cleaner edge.';
            pivot = 'Pivot: sit out until the table stops chopping.';
        } else if (coreStats.netUnits <= -4) {
            verdict = 'The session is bleeding. Tighten exposure and only touch a signal if math and rhythm agree.';
            pivot = 'Pivot: reduce aggression and wait for confirmation.';
        } else if (dominantFace && dominantHits >= 4) {
            verdict = `F${dominantFace} is repeating inside the last 8 hits. The table is leaning instead of spraying.`;
            pivot = `Pivot: watch F${dominantFace} for continuation or first clean snapback.`;
        } else if (topGapFace && topGapValue >= 8) {
            verdict = `F${topGapFace} is stretched to a ${topGapValue}-spin gap. That is the cleanest tension point on the board.`;
            pivot = `Pivot: monitor F${topGapFace} for a controlled re-entry setup.`;
        } else {
            verdict = 'The wheel is mixed. Use the math engine first and demand a strong reason before you press.';
            pivot = 'Pivot: let structure form before increasing risk.';
        }

        if (state.currentNeuralSignal && state.currentNeuralSignal.status === 'GO' && state.currentNeuralSignal.targetFace) {
            pivot = `Pivot: AI leans F${state.currentNeuralSignal.targetFace} at ${state.currentNeuralSignal.confidence || 0}% confidence.`;
        }

        return {
            predictabilityScore,
            verdict,
            profitPivot: pivot
        };
    }

    function renderStrategicBrainSummary() {
        const verdictEl = document.getElementById('aiBrainVerdict');
        const scoreEl = document.getElementById('aiBrainScore');
        const pivotEl = document.getElementById('aiBrainPivot');
        if (!verdictEl || !scoreEl || !pivotEl) return;

        const summary = buildStrategicBrainSummary();
        verdictEl.innerText = summary.verdict;
        scoreEl.innerText = `${summary.predictabilityScore}%`;
        scoreEl.classList.remove('opacity-0');

        if (summary.profitPivot) {
            pivotEl.innerText = summary.profitPivot;
            pivotEl.classList.remove('hidden');
        } else {
            pivotEl.classList.add('hidden');
        }
    }

    window.renderGapStats = function () {
        const container = document.getElementById('faceGapContainer');
        if (!container) return;

        container.innerHTML = '';
        for (let f = 1; f <= 5; f++) {
            const gap = state.faceGaps[f] || 0;
            let colorClass = 'text-[#22c55e]';
            if (gap > 10) colorClass = 'text-[#d4af37]';
            if (gap > 15) colorClass = 'text-[#d33838]';

            container.innerHTML += `
                <div class="text-center p-2 rounded-xl bg-white/5 border border-white/5 shadow-sm backdrop-blur-sm transition-all hover:bg-white/10">
                    <span class="block text-gray-400 text-[9px] font-bold mb-0.5 uppercase tracking-wider">F${f}</span>
                    <span class="${colorClass} font-bold text-xl drop-shadow-sm">${gap}</span>
                </div>
            `;
        }
    };

    window.toggleBetConfirmation = function (index) {
        if (!window.state || !Array.isArray(window.state.activeBets)) return;

        const betIndex = Number(index);
        if (!Number.isInteger(betIndex) || betIndex < 0 || betIndex >= window.state.activeBets.length) return;

        const bet = window.state.activeBets[betIndex];
        if (!bet || !bet.targetFace || bet.targetFace === '?') return;

        bet.confirmed = bet.confirmed !== true;

        if (window.renderDashboardSafe) {
            window.renderDashboardSafe(window.state.activeBets);
        }
        if (window.syncAppStore) {
            window.syncAppStore();
        }
        if (window.saveSessionData) {
            window.saveSessionData();
        }
    };

    window.renderDashboardSafe = function (items) {
        if (window.aiScrambleInterval) {
            clearInterval(window.aiScrambleInterval);
            window.aiScrambleInterval = null;
        }

        const dash = document.getElementById('dashboard');
        if (!dash) return;

        // Handle both raw nextBets array and scanResult objects
        const signals = Array.isArray(items) ? items : (items && items.nextBets ? items.nextBets : []);
        let cards = [];

        signals.forEach((bet, index) => {
            const subtitle = bet.subtitle || (bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName);
            const accent = bet.accentColor || '#FF3B30';
            const bgStyle = bet.confirmed
                ? `background: linear-gradient(135deg, ${accent}35, ${accent}10)`
                : `background: linear-gradient(135deg, ${accent}15, ${accent}05)`;

            const borderBase = bet.confirmed ? accent : `${accent}40`;
            const borderPulse = accent;
            const shadowBase = `0 4px 12px ${accent}15`;
            const shadowPulse = `0 4px 20px ${accent}35, inset 0 0 8px ${accent}20`;

            // Screenshot sync: Add hit rate stats
            const hitRate = bet.hitRate ? `${bet.hitRate}% Hit Rate` : 'Evaluating...';
            const hits = bet.hits !== undefined ? `${bet.hits}/${bet.totalHits || 14} Hits` : '';

            const isAiLoading = bet.patternName === 'Neural Net' && bet.targetFace === '?';
            const mainText = isAiLoading ? 'SYNCING NEURAL NET' : `BET F${bet.targetFace}`;
            const subText = isAiLoading ? subtitle : `${hits} (${hitRate})`;
            const titleClass = isAiLoading ? 'ai-scramble-text text-[#bf5af2]' : 'text-white';
            const confirmationLabel = isAiLoading
                ? 'ANALYZING'
                : (bet.confirmed ? 'CONFIRMED' : 'TAP TO CONFIRM');
            const confirmationTone = isAiLoading
                ? 'text-[#bf5af2]'
                : (bet.confirmed ? 'text-[#22c55e]' : 'text-white/45');

            cards.push(`
                <div class="min-w-[250px] h-[72px] px-4 py-2 rounded-lg border flex flex-col justify-center cursor-pointer select-none transition-all hover:brightness-110 signal-card"
                     data-bet-index="${index}"
                     title="${isAiLoading ? 'AI read in progress' : 'Click to toggle confirmation'}"
                     style="--border-base: ${borderBase}; --border-pulse: ${borderPulse}; --shadow-base: ${shadowBase}; --shadow-pulse: ${shadowPulse}; border-left: 4px solid ${accent}; ${bgStyle};">
                    <div class="flex items-start justify-between gap-3">
e                         <div class="text-[14px] leading-tight font-bold tracking-wide drop-shadow-sm uppercase ${titleClass}" data-text="${mainText}">${mainText}</div>
                        <div class="text-[9px] font-bold tracking-[0.18em] uppercase ${confirmationTone}">${confirmationLabel}</div>
                    </div>
                    <div class="text-[10px] leading-tight text-white/70 font-semibold mt-1 font-mono">${subText}</div>
                </div>
            `);
        });

        if (cards.length === 0) {
            dash.innerHTML = `<div class="dashboard-empty w-full text-center text-[10px] font-medium text-[#8E8E93]/60 border border-dashed border-white/5 rounded-xl p-2 select-none tracking-wide flex items-center justify-center h-[60px]"><span>AWAITING SIGNALS...</span></div>`;
            return;
        }

        dash.innerHTML = cards.join('');

        dash.querySelectorAll('.signal-card[data-bet-index]').forEach(card => {
            card.addEventListener('click', () => {
                const idx = Number(card.getAttribute('data-bet-index'));
                if (window.toggleBetConfirmation) {
                    window.toggleBetConfirmation(idx);
                }
            });
        });

        // Initiate Hacker Terminal Scramble Effect
        const scramblers = dash.querySelectorAll('.ai-scramble-text');
        if (scramblers.length > 0) {
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*!';
            window.aiScrambleInterval = setInterval(() => {
                scramblers.forEach(el => {
                    const original = el.dataset.text;
                    let scrambled = '';
                    for (let i = 0; i < original.length; i++) {
                        if (original[i] === ' ') scrambled += ' ';
                        else scrambled += Math.random() > 0.75 ? chars[Math.floor(Math.random() * chars.length)] : original[i];
                    }
                    el.innerText = scrambled;
                });
            }, 50);
        }
    };

    function formatPredictionDetail(entry) {
        const parts = [];
        if (entry && entry.targetFace !== undefined && entry.targetFace !== null && entry.targetFace !== '?') {
            parts.push(`F${entry.targetFace}`);
        }

        const label = entry && (entry.comboLabel || entry.patternName);
        if (label) parts.push(label);

        if (entry && Number.isFinite(entry.confidence) && entry.confidence > 0) {
            parts.push(`${entry.confidence}%`);
        }

        return parts.join(' • ');
    }

    window.renderPredictionCell = function (spin) {
        const blocks = [];

        if (spin.resolvedBets && spin.resolvedBets.length > 0) {
            spin.resolvedBets.forEach(bet => {
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
            const detail = formatPredictionDetail(sig) || 'Prediction Perimeter';
            const note = sig.reason
                ? `<div class="prediction-entry-note">${sig.reason}</div>`
                : '';

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

        if (blocks.length === 0) {
            return '<span class="prediction-empty">-</span>';
        }

        return `<div class="prediction-cell-content">${blocks.join('')}</div>`;
    };

    window.renderComboCell = function (spin) {
        const registry = window.StrategyRegistry || {};
        const stratKey = state.currentGameplayStrategy || 'series';
        const strategy = registry[stratKey];
        if (!strategy || typeof strategy.detectBridge !== 'function') return '<span class="text-gray-600">-</span>';
        if (spin.index <= 0) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';

        const currMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[spin.num] : 0;
        const prevSpin = state.history[spin.index - 1];
        if (!prevSpin) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';

        const prevMask = window.FON_MASK_MAP ? window.FON_MASK_MAP[prevSpin.num] : 0;
        const bridge = strategy.detectBridge(prevMask, currMask, window.FACE_MASKS);

        if (!bridge || !prevSpin) return '<span class="text-gray-600 font-mono text-[10px]">-</span>';

        // Combo badge + dynamic bridge between matched faces
        return `
            <div class="absolute inset-x-0 top-0 -translate-y-1/2 h-0 pointer-events-none select-none z-[1] flex items-center justify-center">
                <div class="combo-link-layer absolute overflow-visible"
                     data-prev-spin-id="${prevSpin.id}"
                     data-prev-face="${bridge.matchedPrevFace}"
                     data-curr-face="${bridge.matchedCurrFace}"
                     data-color="${bridge.color}"></div>
                <div class="relative z-[2] inline-flex items-center justify-center">
                    <span class="combo-badge relative px-3 py-1 rounded-md text-[10px] font-black font-mono tracking-widest border shadow-2xl transition-all duration-300"
                          style="color:${bridge.color}; border-color:${bridge.color}55; background-color:#0b0b0d; box-shadow: 0 0 8px ${bridge.color}40, inset 0 0 4px ${bridge.color}15;">
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

        const RED_NUMS = config.RED_NUMS || [];
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
            <td class="text-center font-mono text-xs text-gray-400">#${spin.index + 1}</td>
            <td class="text-center"><div class="num-box ${bgClass}">${spin.num}</div></td>
            <td class="text-center relative z-[5]">${faceHTML}</td>
            <td class="text-center relative overflow-visible z-[1]">${comboHTML}</td>
            <td class="prediction-cell">${predictionHTML}</td>
        `;
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
            window.state.history.forEach(spin => {
                if (window.renderRow) window.renderRow(spin, fragment);
            });
            tbody.appendChild(fragment);
        }
        if (window.layoutAllComboBridges) {
            requestAnimationFrame(window.layoutAllComboBridges);
        }
    };

    window.rebuildSessionFromSpins = async function (spins, options = {}) {
        // 1. Hard reset of state
        if (window.state) {
            window.state.history = [];
            window.state.activeBets = [];
            window.state.faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
            window.state.globalSpinIdCounter = 0;
            window.state.userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
            window.state.engineSnapshot = null;
            window.state.currentNeuralSignal = null;
            window.state.strategySyncCache = { series: null, combo: null };
        }
        window.currentAlerts = [];
        if (window.EngineCore) window.EngineCore.reset();
        const tbody = document.getElementById('historyBody');
        if (tbody) tbody.innerHTML = '';

        // 2. Reprocess spins silently
        if (window.InputProcessor && window.InputProcessor.processSpinValue) {
            for (const spinNum of spins) {
                await window.InputProcessor.processSpinValue(spinNum, { silent: true, skipStoreSync: true });
            }
        }

        // 3. Re-render the entire history table from the new state.history
        if (window.reRenderHistory) window.reRenderHistory();

        // 4. Final UI updates
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

        const layer = row.querySelector('.combo-link-layer');
        const badge = row.querySelector('.combo-badge');
        const comboCell = row.querySelector('td:nth-child(4)');
        if (!layer || !badge || !comboCell) return;

        const prevSpinId = layer.dataset.prevSpinId;
        const prevFace = parseInt(layer.dataset.prevFace, 10);
        const currFace = parseInt(layer.dataset.currFace, 10);
        const color = layer.dataset.color || '#ffffff';

        if (!prevSpinId || Number.isNaN(prevFace) || Number.isNaN(currFace)) return;

        const prevTag = document.querySelector(`.face-tag[data-spin-id="${prevSpinId}"][data-face-id="${prevFace}"]`);
        const currTag = row.querySelector(`.face-tag[data-spin-id="${spinId}"][data-face-id="${currFace}"]`);
        if (!prevTag || !currTag) return;

        const cellRect = comboCell.getBoundingClientRect();
        const prevRect = prevTag.getBoundingClientRect();
        const currRect = currTag.getBoundingClientRect();
        const badgeRect = badge.getBoundingClientRect();

        const prevPoint = {
            x: prevRect.right - cellRect.left + 4,
            y: prevRect.top + prevRect.height / 2 - cellRect.top
        };
        const currPoint = {
            x: currRect.right - cellRect.left + 4,
            y: currRect.top + currRect.height / 2 - cellRect.top
        };
        const badgePoint = {
            x: badgeRect.left - cellRect.left + Math.max(5, Math.min(11, badgeRect.width * 0.16)),
            y: badgeRect.top + badgeRect.height / 2 - cellRect.top
        };
        const availableReach = Math.max(30, badgePoint.x - Math.max(prevPoint.x, currPoint.x));
        const mergeBackoff = Math.max(10, Math.min(18, availableReach * 0.18));
        const mergePoint = {
            x: badgePoint.x - mergeBackoff,
            y: badgePoint.y
        };
        const maxAllowedSpan = Math.max(comboCell.offsetHeight * 2.4, 140);
        if (
            Math.abs(prevPoint.y - mergePoint.y) > maxAllowedSpan ||
            Math.abs(currPoint.y - mergePoint.y) > maxAllowedSpan
        ) {
            layer.innerHTML = '';
            layer._comboGeom = null;
            return;
        }

        const nextGeom = {
            p1: prevPoint,
            p2: currPoint,
            m: mergePoint,
            b: badgePoint,
            color: color
        };
        const prevGeom = layer._comboGeom || {
            p1: { ...badgePoint },
            p2: { ...badgePoint },
            m: { ...badgePoint },
            b: { ...badgePoint },
            color: color
        };

        if (window.animateComboBridge) window.animateComboBridge(layer, prevGeom, nextGeom, 260);
        layer._comboGeom = nextGeom;
    }

    window.layoutAllComboBridges = function () {
        if (window.state && window.state.history) {
            window.state.history.forEach(spin => window.layoutComboBridge(spin.id));
        }
    }

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
    }

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
        const coreOpacity = Math.max(0.8, Math.min(0.95, 0.8 + responsiveScale * 0.12)).toFixed(2);
        const glowOpacity = Math.max(0.18, Math.min(0.32, 0.16 + responsiveScale * 0.15)).toFixed(2);
        const blurPx = Math.max(2, Math.round(5 * responsiveScale));

        [glow1, glow2].forEach((p, idx) => {
            p.setAttribute('d', idx === 0 ? d1 : d2);
            p.setAttribute('stroke', geom.color);
            p.setAttribute('stroke-width', glowWidth);
            p.setAttribute('stroke-opacity', glowOpacity);
            p.style.filter = `drop-shadow(0 0 ${blurPx}px ${geom.color})`;
        });
        glowMerge.setAttribute('d', dMerge);
        glowMerge.setAttribute('stroke', geom.color);
        glowMerge.setAttribute('stroke-width', glowWidth);
        glowMerge.setAttribute('stroke-opacity', (parseFloat(glowOpacity) * 0.94).toFixed(2));
        glowMerge.style.filter = `drop-shadow(0 0 ${blurPx + 1}px ${geom.color})`;

        [core1, core2].forEach((p, idx) => {
            p.setAttribute('d', idx === 0 ? d1 : d2);
            p.setAttribute('stroke', geom.color);
            p.setAttribute('stroke-width', coreWidth);
            p.setAttribute('stroke-opacity', coreOpacity);
        });
        coreMerge.setAttribute('d', dMerge);
        coreMerge.setAttribute('stroke', geom.color);
        coreMerge.setAttribute('stroke-width', mergeCoreWidth);
        coreMerge.setAttribute('stroke-opacity', Math.min(0.98, parseFloat(coreOpacity) + 0.04).toFixed(2));
    }

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
    }

    function getAnalyticsTabConfig() {
        const buttons = Array.from(document.querySelectorAll('[data-analytics-tab]'));
        if (buttons.length > 0) {
            return buttons.map(button => ({
                key: button.dataset.analyticsTab,
                button,
                panelId: button.dataset.analyticsPanel || '',
                rendererName: button.dataset.analyticsRenderer || ''
            })).filter(tab => tab.key && tab.panelId);
        }

        return [
            { key: 'strategy', button: document.getElementById('tabBtnStrategy'), panelId: 'strategyAnalyticsPanel', rendererName: 'renderStrategyAnalytics' },
            { key: 'intelligence', button: document.getElementById('tabBtnIntelligence'), panelId: 'intelligencePanel', rendererName: 'renderIntelligencePanel' },
            { key: 'advancements', button: document.getElementById('tabBtnAdvancements'), panelId: 'advancementsPanel', rendererName: 'renderAdvancementAnalytics' }
        ].filter(tab => tab.button);
    }

    function ensureActiveAnalyticsTab(tabs) {
        if (!state || !Array.isArray(tabs) || tabs.length === 0) {
            return state ? state.currentAnalyticsTab : '';
        }

        const activeExists = tabs.some(tab => tab.key === state.currentAnalyticsTab);
        if (!activeExists) {
            state.currentAnalyticsTab = tabs[0].key;
        }
        return state.currentAnalyticsTab;
    }

    function applyAnalyticsTabUI() {
        const tabs = getAnalyticsTabConfig();
        const activeTab = ensureActiveAnalyticsTab(tabs);

        tabs.forEach(tab => {
            const btn = tab.button;
            const panel = document.getElementById(tab.panelId);

            if (btn) {
                if (tab.key === activeTab) {
                    btn.className = "pb-2 text-xs font-bold uppercase tracking-widest text-[#30D158] border-b-2 border-[#30D158] transition-all";
                } else {
                    btn.className = "pb-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all";
                }
            }
            if (panel) {
                if (tab.key === activeTab) {
                    panel.classList.remove('hidden');
                } else {
                    panel.classList.add('hidden');
                }
            }
        });
    }

    window.renderAdvancementAnalytics = function () {
        const advPanel = document.getElementById('advancementLogContainer');
        if (advPanel) {
            advPanel.innerHTML = '<div class="text-white/40 text-center py-6 text-xs italic tracking-wide">Advancements tracking active. Awaiting threshold breaches.</div>';
        }
    };

    window.renderAnalytics = function () {
        if (!state) return;
        const tabs = getAnalyticsTabConfig();
        const activeTab = ensureActiveAnalyticsTab(tabs);
        applyAnalyticsTabUI();

        const activeConfig = tabs.find(tab => tab.key === activeTab);
        if (!activeConfig || !activeConfig.rendererName) return;

        const renderer = window[activeConfig.rendererName];
        if (typeof renderer === 'function') {
            renderer();
        }
    };

    window.sortEngineReadCombos = function (comboStats) {
        return (comboStats || []).slice().sort((a, b) =>
            (b.hits - a.hits) ||
            ((b.lastSeenIndex ?? -1) - (a.lastSeenIndex ?? -1)) ||
            (a.label > b.label ? 1 : -1)
        );
    };

    window.getEngineStateTone = function (stateStr) {
        const tones = {
            BUILDING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded',
            WAITING: 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded',
            READY: 'text-[#22c55e] bg-[#22c55e]/10 border border-[#22c55e]/20 px-2 py-0.5 rounded',
            FOLLOW_UP: 'text-[#3b82f6] bg-[#3b82f6]/10 border border-[#3b82f6]/20 px-2 py-0.5 rounded',
            WATCHLIST: 'text-[#d4af37] bg-[#d4af37]/10 border border-[#d4af37]/20 px-2 py-0.5 rounded',
            NO_SIGNAL: 'text-gray-500 bg-gray-500/10 border border-gray-500/20 px-2 py-0.5 rounded'
        };
        return tones[stateStr] || 'text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded';
    };

    window.getMetricToneClass = function (metric, value) {
        switch (metric) {
            case 'hits':
                if (value >= 3) return 'text-[#22c55e] drop-shadow-sm font-bold';
                if (value === 2) return 'text-[#d4af37] font-bold';
                if (value === 1) return 'text-[#d33838]';
                return 'text-gray-500 opacity-50';
            case 'hotPercent':
            case 'coldPercent':
                if (value >= (metric === 'hotPercent' ? 25 : 85)) return 'text-[#22c55e] drop-shadow-sm font-bold';
                if (value >= (metric === 'hotPercent' ? 15 : 65)) return 'text-[#d4af37] font-bold';
                if (value > 0) return 'text-[#d33838]';
                return 'text-gray-500 opacity-50';
            case 'margin':
                if (value >= 2) return 'text-[#22c55e] font-bold';
                if (value === 1) return 'text-[#d4af37] font-bold';
                if (value === 0) return 'text-[#d33838]';
                return 'text-gray-500 opacity-50';
            case 'confirmation':
                return value >= 1 ? 'text-[#22c55e] drop-shadow-sm font-bold' : 'text-[#d33838] font-bold';
            case 'lastSeen':
                if (value === null || value === undefined || value === '-') return 'text-gray-500 opacity-50';
                if (value <= 1) return 'text-[#22c55e] font-bold';
                if (value <= 3) return 'text-[#d4af37] font-bold';
                return 'text-[#d33838] font-bold';
            case 'checkpoint':
                if (value <= 1) return 'text-[#d4af37] font-bold';
                if (value <= 3) return 'text-[#d33838] font-bold';
                return 'text-gray-500 opacity-50';
            default:
                return 'text-gray-500 opacity-50';
        }
    };

    window.getPredictionToneClass = function (snapshot) {
        if (!snapshot) return 'text-gray-500';
        if (snapshot.currentPrediction) return 'text-[#22c55e] font-bold drop-shadow-sm';
        if (snapshot.engineState === 'WATCHLIST') return 'text-[#d4af37] font-bold';
        if (snapshot.engineState === 'NO_SIGNAL') return 'text-gray-400';
        return 'text-gray-500';
    };

    window.formatEnginePrediction = function (snapshot) {
        if (!snapshot) return 'No engine state available.';
        if (snapshot.currentPrediction) {
            const action = snapshot.currentPrediction.action || 'BET';
            const confidence = Number.isFinite(snapshot.currentPrediction.confidence) && snapshot.currentPrediction.confidence > 0
                ? ` ${snapshot.currentPrediction.confidence}%`
                : '';
            return `${action} F${snapshot.currentPrediction.targetFace} via ${snapshot.currentPrediction.comboLabel}${confidence}.`;
        }
        return snapshot.watchlistMessage || snapshot.leadMessage || 'No actionable signal.';
    };

    window.renderIntelligencePanel = function () {
        const content = document.getElementById('intelligenceContent');
        const stateChip = document.getElementById('intelStateChip');
        const checkpointSummary = document.getElementById('intelCheckpointSummary');
        const nextCheckpoint = document.getElementById('intelNextCheckpoint');
        if (!content) return;

        const ENGINE_PRIMARY_WINDOW = window.config ? window.config.ENGINE_PRIMARY_WINDOW : 14;

        const snapshot = window.state.engineSnapshot || {};
        const rankedCombos = window.sortEngineReadCombos(snapshot.comboCoverage || []);
        const leadCombo = snapshot.dominantCombo;
        const runnerUp = snapshot.runnerUpCombo;

        if (stateChip) {
            stateChip.innerText = snapshot.engineState || 'IDLE';
            stateChip.className = `font-black text-[9px] tracking-widest uppercase ${window.getEngineStateTone(snapshot.engineState)}`;
        }

        if (checkpointSummary) {
            checkpointSummary.innerText = snapshot.checkpointStatus || 'Waiting for valid sample';
            checkpointSummary.className = `font-bold text-[10px] tracking-widest uppercase ${window.getPredictionToneClass(snapshot)}`;
        }

        if (nextCheckpoint) {
            nextCheckpoint.innerText = snapshot.nextCheckpointSpin || ENGINE_PRIMARY_WINDOW;
            nextCheckpoint.className = `text-lg font-black tracking-tighter ${window.getMetricToneClass('checkpoint', snapshot.spinsUntilNextCheckpoint)}`;
        }

        const comboRows = rankedCombos.map((combo, index) => `
            <tr class="hover:bg-white/5 transition-colors">
                <td class="p-3 font-bold tracking-widest text-[10px]" style="color:${combo.color}">${index + 1}. ${combo.label}</td>
                <td class="p-3 font-mono ${window.getMetricToneClass('hits', combo.hits)}">${combo.hits}</td>
                <td class="p-3 font-mono ${window.getMetricToneClass('hotPercent', combo.hotPercent)}">${combo.hotPercent}%</td>
                <td class="p-3 font-mono ${window.getMetricToneClass('coldPercent', combo.coldPercent)}">${combo.coldPercent}%</td>
                <td class="p-3 font-mono ${window.getMetricToneClass('lastSeen', combo.lastSeenDistance ?? '-')}">${combo.lastSeenDistance ?? '-'}</td>
            </tr>
        `).join('');

        content.innerHTML = `
            <div class="grid grid-cols-2 gap-3 mt-2">
                <div class="col-span-2 bg-gradient-to-b from-white/10 to-white/5 border border-white/10 rounded-xl p-4 text-center shadow-lg">
                    <div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Lead Insight</div>
                    <div class="text-lg mb-1 ${window.getPredictionToneClass(snapshot)}">${snapshot.leadMessage || 'Awaiting Valid Sample'}</div>
                    <div class="text-[11px] font-medium text-white/70">${window.formatEnginePrediction(snapshot)}</div>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Primary Read</div><div class="text-lg font-bold tracking-wide" style="color:${leadCombo ? leadCombo.color : '#f0f0f0'}">${leadCombo ? leadCombo.label : 'No combo'}</div></div>
                    <div class="text-[10px] text-white/60 mt-2">${leadCombo ? `<span class="${window.getMetricToneClass('hits', leadCombo.hits)}">${leadCombo.hits} hits</span> in rolling 14` : 'Waiting for a valid sample.'}</div>
                </div>
                <div class="bg-white/5 border border-white/10 rounded-xl p-4 flex flex-col justify-between shadow-sm">
                    <div><div class="text-white/40 text-[9px] font-black uppercase tracking-widest mb-1.5">Runner-Up Margin</div><div class="text-lg font-bold tracking-wide ${window.getMetricToneClass('margin', snapshot.topMargin)}">${leadCombo ? `${(snapshot.topMargin || 0) >= 0 ? '+' : ''}${snapshot.topMargin || 0}` : '-'}</div></div>
                    <div class="text-[10px] text-white/60 mt-2">${runnerUp ? `Runner-up is ${runnerUp.label} (${runnerUp.hits} hits)` : 'No runner-up yet.'}</div>
                </div>
            </div>
            <div class="col-span-2 bg-white/5 border border-white/10 rounded-xl overflow-hidden mt-4 shadow-sm">
                <div class="bg-black/30 text-white/40 text-[9px] font-black uppercase tracking-widest p-3 border-b border-white/5">14-Spin Combo Ranking</div>
                <table class="w-full text-left text-xs">
                    <thead class="bg-black/10 text-white/30 uppercase text-[9px] tracking-wider border-b border-white/5">
                        <tr><th class="p-3">Combo</th><th class="p-3">Hits</th><th class="p-3">Hot</th><th class="p-3">Cold</th><th class="p-3">Last Seen</th></tr>
                    </thead>
                    <tbody class="divide-y divide-white/5">${comboRows || '<tr><td colspan="5" class="p-6 text-center text-white/30 italic">Awaiting data...</td></tr>'}</tbody>
                </table>
            </div>
        `;
    };

    function renderStrategyAnalytics() {
        const displayStrategy = state && state.analyticsDisplayStrategy === 'combo' ? 'combo' : 'series';
        const analytics = window.EngineCore && typeof window.EngineCore.getAnalyticsData === 'function'
            ? window.EngineCore.getAnalyticsData(displayStrategy)
            : null;
        const coreStats = analytics || {
            wins: 0,
            losses: 0,
            net: 0,
            streak: 0,
            history: [0],
            patterns: {}
        };

        const totalSignals = coreStats.wins + coreStats.losses;
        const hitRate = totalSignals === 0 ? 0 : Math.round((coreStats.wins / totalSignals) * 100);

        const hrEl = document.getElementById('kpiHitRate');
        if (hrEl) {
            hrEl.innerText = hitRate + "%";
            hrEl.className = `text-2xl font-semibold tracking-tight ${totalSignals === 0 ? 'text-white' : (hitRate >= 50 ? 'text-[#22c55e]' : 'text-[#d33838]')}`;
        }

        const netEl = document.getElementById('kpiNet');
        if (netEl) {
            netEl.innerText = (coreStats.net > 0 ? '+' : '') + coreStats.net;
            netEl.className = `text-2xl font-semibold tracking-tight ${coreStats.net > 0 ? 'text-[#22c55e]' : (coreStats.net < 0 ? 'text-[#d33838]' : 'text-white')}`;
        }

        const sigEl = document.getElementById('kpiSignals');
        if (sigEl) sigEl.innerText = totalSignals;

        const s = coreStats.streak || 0;
        const formEl = document.getElementById('kpiForm');
        if (formEl) {
            formEl.innerText = s > 0 ? `W${s}` : (s < 0 ? `L${Math.abs(s)}` : '-');
            formEl.className = `text-2xl font-semibold tracking-tight ${s > 0 ? 'text-[#22c55e]' : (s < 0 ? 'text-[#d33838]' : 'text-gray-400')}`;
        }

        drawAdvancedGraph(coreStats.history, coreStats.wins, coreStats.losses, 'graphContainer');
        updatePatternHeatmap(coreStats.patterns);
    }

    window.renderUserAnalytics = function () {
        if (!state) return;
        const uStats = state.userStats || { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
        const totalBets = uStats.totalWins + uStats.totalLosses;
        const hitRate = totalBets === 0 ? 0 : Math.round((uStats.totalWins / totalBets) * 100);

        const netEl = document.getElementById('userNet');
        if (netEl) {
            netEl.innerText = (uStats.netUnits > 0 ? '+' : '') + uStats.netUnits;
            netEl.className = `text-4xl font-semibold tracking-tight ${uStats.netUnits > 0 ? 'text-[#22c55e]' : (uStats.netUnits < 0 ? 'text-[#d33838]' : 'text-white')}`;
        }

        const hrEl = document.getElementById('userHitRate');
        if (hrEl) {
            hrEl.innerText = hitRate + "%";
            hrEl.className = `text-4xl font-semibold tracking-tight ${totalBets === 0 ? 'text-white' : (hitRate >= 50 ? 'text-[#22c55e]' : 'text-[#d33838]')}`;
        }

        const totEl = document.getElementById('userTotal');
        if (totEl) totEl.innerText = totalBets;

        drawAdvancedGraph(uStats.bankrollHistory, uStats.totalWins, uStats.totalLosses, 'userGraphContainer');
        updateUserBetLog(uStats.betLog);
    };

    function drawAdvancedGraph(historyArray, winCount, lossCount, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const sourceHistory = Array.isArray(historyArray) ? historyArray.slice() : [];
        const normalizedHistory = sourceHistory.length >= 2
            ? sourceHistory
            : [sourceHistory[0] || 0, sourceHistory[0] || 0];

        container.innerHTML = '';
        container.className = "flex flex-col h-full w-full rounded-b-xl overflow-hidden";

        const chartDiv = document.createElement('div');
        chartDiv.className = "relative h-[80%] w-full bg-black/20";
        container.appendChild(chartDiv);

        const hudDiv = document.createElement('div');
        hudDiv.className = "h-[20%] w-full flex justify-between items-center px-4 text-[10px] font-bold bg-white/5 border-t border-white/5 backdrop-blur-sm";
        hudDiv.innerHTML = `
            <span class="text-[#4ade80] drop-shadow-sm tracking-wide">WINS: ${winCount || 0}</span>
            <span class="text-[#e5e7eb] drop-shadow-sm tracking-wide">SPINS: ${Math.max(0, sourceHistory.length - 1)}</span>
            <span class="text-[#f87171] drop-shadow-sm tracking-wide">LOSSES: ${lossCount || 0}</span>
        `;
        container.appendChild(hudDiv);

        const vWidth = 600;
        const vHeight = 200;
        const padding = 10;

        const maxVal = Math.max(...normalizedHistory);
        const minVal = Math.min(...normalizedHistory);
        let range = maxVal - minVal;
        if (range === 0) range = 2;

        const getX = i => (i / (normalizedHistory.length - 1)) * (vWidth - 2 * padding) + padding;
        const getY = v => vHeight - padding - ((v - minVal) / range) * (vHeight - 2 * padding);

        let pathD = `M ${getX(0)} ${getY(normalizedHistory[0])}`;
        for (let i = 1; i < normalizedHistory.length; i++) {
            pathD += ` L ${getX(i)} ${getY(normalizedHistory[i])}`;
        }

        const zeroY = getY(0);
        let zeroOffset = 0;
        if (maxVal > 0 && minVal < 0) {
            zeroOffset = (maxVal / range) * 100;
        } else if (minVal >= 0) {
            zeroOffset = 100;
        }

        const svgContent = `
            <svg viewBox="0 0 ${vWidth} ${vHeight}" width="100%" height="100%" preserveAspectRatio="none" style="overflow: visible;">
                <defs>
                    <linearGradient id="profitGrad-${containerId}" x1="0%" y1="0%" x2="0%" y2="100%">
                        <stop offset="0%" stop-color="#4ade80" />
                        <stop offset="${zeroOffset}%" stop-color="#4ade80" />
                        <stop offset="${zeroOffset}%" stop-color="#f87171" />
                        <stop offset="100%" stop-color="#f87171" />
                    </linearGradient>
                </defs>
                <line x1="${padding}" y1="${zeroY}" x2="${vWidth - padding}" y2="${zeroY}" 
                      stroke="#9ca3af" stroke-width="2" stroke-dasharray="6 6" opacity="0.3" vector-effect="non-scaling-stroke" />
                <path d="${pathD}" fill="none" stroke="url(#profitGrad-${containerId})" 
                      stroke-width="3" stroke-linecap="round" stroke-linejoin="round" 
                      vector-effect="non-scaling-stroke" 
                      style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));" />
            </svg>
        `;

        chartDiv.innerHTML = svgContent;
    }

    window.drawAdvancedGraph = drawAdvancedGraph;

    function updatePatternHeatmap(patternData) {
        const tbody = document.getElementById('heatmapBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        const patterns = Object.entries(patternData || {});

        if (patterns.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No patterns recorded yet</td></tr>';
            return;
        }

        patterns.sort((a, b) => {
            const rA = a[1].wins / ((a[1].wins + a[1].losses) || 1);
            const rB = b[1].wins / ((b[1].wins + b[1].losses) || 1);
            return rB - rA;
        });

        patterns.forEach(([name, s]) => {
            const total = s.wins + s.losses;
            const rate = total === 0 ? 0 : Math.round((s.wins / total) * 100);
            const color = rate >= 50 ? 'text-[#22c55e]' : 'text-[#d33838]';
            const bar = rate >= 50 ? 'bg-[#22c55e]' : 'bg-[#d33838]';

            tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-3 font-semibold text-gray-200">
                        <div class="flex items-center justify-between">
                            <span class="tracking-wide">${name}</span>
                            <button onclick="event.stopPropagation(); window.openPatternLog && window.openPatternLog('${name}')" class="text-[#8E8E93] hover:text-white cursor-pointer px-2 py-1 rounded-full hover:bg-white/10 transition-colors" title="View Log">
                                <i class="fas fa-list-ul"></i>
                            </button>
                        </div>
                    </td>
                    <td class="p-3 text-right text-[#30D158] font-mono font-bold drop-shadow-sm">${s.wins}</td>
                    <td class="p-3 text-right text-[#FF453A] font-mono font-bold drop-shadow-sm">${s.losses}</td>
                    <td class="p-3 text-right w-24 relative">
                        <div class="absolute inset-y-4 left-2 right-2 bg-[#3a3a3c] rounded-full overflow-hidden h-1.5 mt-2 shadow-inner">
                            <div class="h-full ${bar}" style="width: ${rate}%"></div>
                        </div>
                        <span class="relative z-10 ${color} font-bold text-[10px] top-[-8px] right-[0px]">${rate}%</span>
                    </td>
                </tr>
            `;
        });
    }

    function updateUserBetLog(betLog) {
        const tbody = document.getElementById('userBetsBody');
        if (!tbody) return;
        tbody.innerHTML = '';

        if (!betLog || betLog.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No confirmed bets yet</td></tr>';
            return;
        }

        betLog.forEach(log => {
            const resClass = log.result === 'WIN' ? 'text-[#22c55e]' : 'text-[#d33838]';
            const unitsText = log.units > 0 ? `+${log.units}` : log.units;
            const targetText = String(log.target || '').replace('F', '');

            tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <td class="p-3 text-[#8E8E93] font-mono text-xs">#${log.id || '-'}</td>
                    <td class="p-3 font-bold text-gray-200 tracking-wide">${log.pattern || '-'}</td>
                    <td class="p-3 text-center font-bold text-white"><span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10 shadow-sm text-xs">F${targetText}</span></td>
                    <td class="p-3 text-right">
                        <span class="text-[9px] text-[#8E8E93] mr-2">Spin ${log.spinNum || '-'}</span>
                        <span class="font-bold ${resClass} text-sm drop-shadow-sm">${log.result || '-'} (${unitsText})</span>
                    </td>
                </tr>
            `;
        });
    }

})();
