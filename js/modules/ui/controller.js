(function () {
    // --- PUBLIC INTERFACE ---
    window.UiController = {
        init,
        initDesktopGrid,
        showToast
    };


    function init() {

        initDesktopGrid();

        // Ensure global toggleModal exists
        if (!window.toggleModal) {
            window.toggleModal = function (id) {
                const el = document.getElementById(id);
                if (!el) return;

                if (!el.classList.contains('transition-all')) {
                    el.classList.add('transition-all', 'duration-300');
                }

                const isHidden = el.classList.contains('hidden') || el.classList.contains('opacity-0');
                const innerPanel = el.querySelector('.relative.w-full');

                if (innerPanel && !innerPanel.classList.contains('transition-all')) {
                    innerPanel.classList.add('transition-all', 'duration-300', 'transform', 'scale-95');
                }

                if (isHidden) {
                    el.classList.remove('hidden');
                    void el.offsetWidth; // Force Reflow
                    el.classList.remove('opacity-0', 'pointer-events-none');
                    el.classList.add('opacity-100');
                    if (innerPanel) { innerPanel.classList.remove('scale-95'); innerPanel.classList.add('scale-100'); }
                } else {
                    el.classList.remove('opacity-100');
                    el.classList.add('opacity-0', 'pointer-events-none');
                    if (innerPanel) { innerPanel.classList.remove('scale-100'); innerPanel.classList.add('scale-95'); }
                    setTimeout(() => { if (el.classList.contains('opacity-0')) el.classList.add('hidden'); }, 300);
                }
            };
        }

        // Header Buttons Data Bindings
        const betsBtn = document.getElementById('headerBetsBtn');
        if (betsBtn) {
            betsBtn.addEventListener('click', function () {
                window.toggleModal('betsModal');
                if (window.renderUserAnalytics) window.renderUserAnalytics();
            });
        }

        const statsBtn = document.getElementById('headerStatsBtn');
        if (statsBtn) {
            statsBtn.addEventListener('click', function () {
                if (window.setAnalyticsDisplayStrategy && window.state && window.state.currentGameplayStrategy) {
                    window.setAnalyticsDisplayStrategy(window.state.currentGameplayStrategy);
                }
                window.toggleModal('analyticsModal');
                if (window.renderAnalytics) window.renderAnalytics();
            });
        }

        const patternBtn = document.getElementById('patternsToggleBtn');
        if (patternBtn) {
            patternBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                window.togglePatternFilterPopover();
            });
        }

        const menuBtn = document.getElementById('headerMenuBtn');
        if (menuBtn) {
            menuBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                window.toggleHamburgerMenu();
            });
        }

        // Global document click to close popovers and menus
        document.addEventListener('click', function (e) {
            const patternShell = document.getElementById('patternFilterShell');
            const patternPopover = document.getElementById('patternFilterPopover');
            if (patternShell && patternPopover && !patternPopover.classList.contains('hidden') && !patternShell.contains(e.target)) {
                if (window.closePatternFilterPopover) window.closePatternFilterPopover();
            }

            const hamburgerMenu = document.getElementById('hamburgerMenu');
            if (hamburgerMenu && !hamburgerMenu.classList.contains('hidden')) {
                if (!hamburgerMenu.contains(e.target) && (!menuBtn || !menuBtn.contains(e.target))) {
                    window.toggleHamburgerMenu();
                }
            }
        });
    }

    function handleGridClick(n) {
        // This will be moved later
        document.getElementById('spinInput').value = n;
        if (window.InputProcessor) {
            void window.InputProcessor.addSpin();
        }
    }
    window.handleGridClick = handleGridClick;

    function buildRacetrackSVG() {
        const svgW = 200;
        const svgH = 520;

        const trackThickness = 36;
        const innerR = 26;
        const outerR = innerR + trackThickness; // 62

        const cx = 100;
        const cy1 = 84;
        const cy2 = 436; // 84 + (16 * 22)
        const blockH = 22; // 16 * 22 = 352

        const rightArray = [5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35];
        const leftArray = [32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8];

        let getWedgePath = (cx, cy, rIn, rOut, a1Deg, a2Deg) => {
            const a1 = a1Deg * Math.PI / 180;
            const a2 = a2Deg * Math.PI / 180;
            const p1x = cx + rOut * Math.cos(a1);
            const p1y = cy + rOut * Math.sin(a1);
            const p2x = cx + rOut * Math.cos(a2);
            const p2y = cy + rOut * Math.sin(a2);
            const p3x = cx + rIn * Math.cos(a2);
            const p3y = cy + rIn * Math.sin(a2);
            const p4x = cx + rIn * Math.cos(a1);
            const p4y = cy + rIn * Math.sin(a1);
            return `M ${p1x} ${p1y} A ${rOut} ${rOut} 0 0 1 ${p2x} ${p2y} L ${p3x} ${p3y} A ${rIn} ${rIn} 0 0 0 ${p4x} ${p4y} Z`;
        };

        let getRectPath = (x, y, width, height) => {
            return `M ${x} ${y} h ${width} v ${height} h ${-width} Z`;
        };

        const RED_NUMS = window.config && window.config.RED_NUMS ? window.config.RED_NUMS : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
        let getColorClass = (num) => {
            if (num === 0) return 'rt-num-green';
            return RED_NUMS.includes(num) ? 'rt-num-red' : 'rt-num-black';
        };

        let paths = '';
        let texts = '';

        // Inner Area - Transparent but bordered to match UI
        paths += `<path d="M ${cx - innerR} ${cy1} L ${cx - innerR} ${cy2} A ${innerR} ${innerR} 0 0 0 ${cx + innerR} ${cy2} L ${cx + innerR} ${cy1} A ${innerR} ${innerR} 0 0 0 ${cx - innerR} ${cy1} Z" class="rt-inner" />`;

        // Division Lines inside the track
        paths += `<line x1="${cx - innerR}" y1="180" x2="${cx + innerR}" y2="180" class="rt-div-line" />`;
        paths += `<line x1="${cx - innerR}" y1="280" x2="${cx + innerR}" y2="280" class="rt-div-line" />`;
        paths += `<path d="M ${cx - innerR} 380 C ${cx - innerR + 10} 360, ${cx + innerR - 10} 360, ${cx + innerR} 380" fill="none" class="rt-div-line" />`;

        // Static text overlays (Rotated down for elegant fit)
        texts += `<text x="${cx}" y="130" transform="rotate(90, ${cx}, 130)" class="rt-label">TIER</text>`;
        texts += `<text x="${cx}" y="230" transform="rotate(90, ${cx}, 230)" class="rt-label">ORPHELINS</text>`;
        texts += `<text x="${cx}" y="330" transform="rotate(90, ${cx}, 330)" class="rt-label">VOISINS</text>`;
        texts += `<text x="${cx}" y="415" transform="rotate(90, ${cx}, 415)" class="rt-label">ZERO</text>`;

        let createGroup = (num, pathD, tx, ty) => {
            return `<g class="rt-seg cursor-pointer transition-all duration-300 hover:brightness-125 active:scale-[0.92] origin-center" style="transform-box: fill-box;" onclick="handleGridClick(${num})">
                <path d="${pathD}" class="transition-colors duration-300" />
                <text x="${tx}" y="${ty}" class="rt-num ${getColorClass(num)} font-black">${num}</text>
            </g>`;
        };

        // 1. Right Straight (Top down)
        for (let i = 0; i < 16; i++) {
            let n = rightArray[i];
            let x = cx + innerR;
            let y = cy1 + i * blockH;
            paths += createGroup(n, getRectPath(x, y, trackThickness, blockH), x + trackThickness / 2, y + blockH / 2);
        }

        // 2. Left Straight (Bottom up to match clockwise)
        for (let i = 0; i < 16; i++) {
            let n = leftArray[i];
            let x = cx - outerR;
            let y = cy2 - (i + 1) * blockH;
            paths += createGroup(n, getRectPath(x, y, trackThickness, blockH), x + trackThickness / 2, y + blockH / 2);
        }

        // 3. Bottom Arc
        let tr = innerR + trackThickness / 2; // 44
        paths += createGroup(3, getWedgePath(cx, cy2, innerR, outerR, 0, 60), cx + tr * Math.cos(30 * Math.PI / 180), cy2 + tr * Math.sin(30 * Math.PI / 180));
        paths += createGroup(26, getWedgePath(cx, cy2, innerR, outerR, 60, 120), cx, cy2 + tr);
        paths += createGroup(0, getWedgePath(cx, cy2, innerR, outerR, 120, 180), cx + tr * Math.cos(150 * Math.PI / 180), cy2 + tr * Math.sin(150 * Math.PI / 180));

        // 4. Top Arc
        paths += createGroup(23, getWedgePath(cx, cy1, innerR, outerR, 180, 270), cx + tr * Math.cos(225 * Math.PI / 180), cy1 + tr * Math.sin(225 * Math.PI / 180));
        paths += createGroup(10, getWedgePath(cx, cy1, innerR, outerR, 270, 360), cx + tr * Math.cos(315 * Math.PI / 180), cy1 + tr * Math.sin(315 * Math.PI / 180));

        return `
            <svg id="racetrackSvg" width="100%" viewBox="0 0 ${svgW} ${svgH}" class="roulette-racetrack">
                ${paths}
                ${texts}
            </svg>
        `;
    }

    function initDesktopGrid() {
        const grid = document.getElementById('desktopGrid');
        if (!grid) return;
        const layout = (window.state && window.state.currentInputLayout) ? window.state.currentInputLayout : 'grid';
        if (layout === 'racetrack') {
            grid.innerHTML = `
                <div class="flex items-center justify-center h-full w-full py-4 fade-in">
                    ${buildRacetrackSVG()}
                </div>
            `;
            grid.classList.remove('p-3');
        } else {
            const RED_NUMS = window.config && window.config.RED_NUMS ? window.config.RED_NUMS : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
            let gridHtml = '<div class="grid grid-cols-3 gap-2 w-full" style="display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 0.5rem;">';
            gridHtml += '<button class="grid-btn grid-green col-span-3 font-black text-[12px] tracking-widest text-white rounded-xl transition-all duration-300 active:scale-[0.94] min-h-[44px]" style="grid-column: span 3 / span 3;" onclick="handleGridClick(0)">ZERO</button>';
            for (let i = 1; i <= 36; i++) {
                const isRed = RED_NUMS.includes(i);
                const colorClass = isRed ? 'grid-red' : 'grid-black';
                gridHtml += `<button class="grid-btn ${colorClass} font-black text-[14px] text-white rounded-xl transition-all duration-300 active:scale-[0.94] min-h-[44px]" onclick="handleGridClick(${i})">${i}</button>`;
            }
            gridHtml += '</div>';
            grid.classList.add('p-3');
            grid.innerHTML = gridHtml;
        }
    }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast-item ${type} transition-all duration-300 transform opacity-0 translate-y-4 scale-95`;
        toast.innerText = msg;
        container.appendChild(toast);

        void toast.offsetWidth;
        toast.classList.remove('opacity-0', 'translate-y-4', 'scale-95');
        toast.classList.add('opacity-100', 'translate-y-0', 'scale-100');

        setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0', 'scale-100');
            toast.classList.add('opacity-0', '-translate-y-4', 'scale-95');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    function importLogFile(input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = JSON.parse(e.target.result);
                if (data.spins && Array.isArray(data.spins)) {
                    if (window.rebuildSessionFromSpins) {
                        if (window.toggleHamburgerMenu) window.toggleHamburgerMenu();
                        await window.rebuildSessionFromSpins(data.spins);
                        const inputField = document.getElementById('spinInput');
                        if (inputField) {
                            inputField.value = '';
                            inputField.focus();
                        }
                    }
                } else {
                    alert("Invalid file format: 'spins' array missing.");
                }
            } catch (err) {
                alert("Error reading file: " + err.message);
            }
        };
        reader.readAsText(file);
        input.value = '';
    };

    window.importLogFile = importLogFile;
    window.importSpins = importLogFile;

    window.exportSpins = function () {
        const historyRef = (window.state && window.state.history) ? window.state.history : [];
        if (historyRef.length === 0) {
            alert("No spins to export!");
            return;
        }
        const spins = historyRef.map(h => h.num);
        const data = { timestamp: Date.now(), spins: spins };
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const dateStr = new Date().toISOString().slice(0, 10);
        a.download = `Roulette_Spins_${dateStr}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    function getPatternMetaData() {
        const activeStrategyKey = (window.state && window.state.currentGameplayStrategy) ? window.state.currentGameplayStrategy : 'series';
        const strategy = window.StrategyRegistry ? window.StrategyRegistry[activeStrategyKey] : null;
        if (strategy && strategy.PATTERN_FILTER_META) {
            return strategy.PATTERN_FILTER_META;
        }
        return {};
    }

    // --- GENERIC UI & MODALS ---
    // --- PATTERN FILTER RECOVERY ---
    window.togglePatternFilterPopover = function (forceOpen = null) {
        const popover = document.getElementById('patternFilterPopover');
        const button = document.getElementById('patternsToggleBtn');
        const backdrop = document.getElementById('patternFilterBackdrop');
        if (!popover) return;

        const isHidden = popover.classList.contains('hidden') || popover.classList.contains('opacity-0');
        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : isHidden;

        if (shouldOpen) {
            window.renderPatternFilterList();
            popover.classList.remove('hidden');
            void popover.offsetWidth; // Force Reflow
            popover.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
            popover.classList.add('opacity-100', 'scale-100');
            if (button) button.classList.add('pattern-toggle-active');
            if (backdrop) {
                backdrop.classList.remove('opacity-0', 'pointer-events-none');
                backdrop.classList.add('opacity-100');
            }
        } else {
            popover.classList.remove('opacity-100', 'scale-100');
            popover.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
            setTimeout(() => { if (popover.classList.contains('opacity-0')) popover.classList.add('hidden'); }, 300);
            if (button) button.classList.remove('pattern-toggle-active');
            if (backdrop) {
                backdrop.classList.remove('opacity-100');
                backdrop.classList.add('opacity-0', 'pointer-events-none');
            }
        }
        if (window.syncPatternFilterButton) window.syncPatternFilterButton();
    };

    window.closePatternFilterPopover = function () {
        const popover = document.getElementById('patternFilterPopover');
        const button = document.getElementById('patternsToggleBtn');
        const backdrop = document.getElementById('patternFilterBackdrop');
        if (popover) popover.classList.add('hidden');
        if (button) button.classList.remove('pattern-toggle-active');
        if (backdrop) {
            backdrop.classList.remove('opacity-100');
            backdrop.classList.add('opacity-0', 'pointer-events-none');
        }
    };

    window.cyclePatternSort = function () {
        if (!window.state) return;
        const modes = ['chrono', 'best', 'worst'];
        let currentIdx = modes.indexOf(window.state.patternSortMode || 'chrono');
        window.state.patternSortMode = modes[(currentIdx + 1) % modes.length];
        window.renderPatternFilterList();
    };

    window.toggleAllPatternFilters = function () {
        if (!window.state) return;
        if (!window.state.patternConfig) window.state.patternConfig = {};
        const metaData = getPatternMetaData();
        const keys = Object.keys(metaData);

        // Check if ALL are currently on
        const allOn = keys.every(k => window.state.patternConfig[k] !== false);
        const newState = !allOn;

        for (const key of keys) {
            window.state.patternConfig[key] = newState;
        }

        // Sync the toggle switch visual
        window.syncSelectAllSwitch(newState);

        window.renderPatternFilterList();
        if (window.syncPatternFilterButton) window.syncPatternFilterButton();
        if (window.saveSessionData) window.saveSessionData();
        if (window.scanAllStrategies) {
            window.scanAllStrategies({ silent: true }).then(() => {
                if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
            }).catch(err => console.error("Toggle all scan error:", err));
        }
    };

    window.syncSelectAllSwitch = function (isAllOn) {
        const sw = document.getElementById('selectAllSwitch');
        const knob = document.getElementById('selectAllKnob');
        if (!sw || !knob) return;
        if (isAllOn) {
            sw.className = 'h-5 w-9 rounded-full relative transition-all duration-500 flex-shrink-0 bg-[#30D158] shadow-[0_0_15px_rgba(48,209,88,0.5)] hover:scale-110 cursor-pointer';
            knob.style.left = '18px';
        } else {
            sw.className = 'h-5 w-9 rounded-full relative transition-all duration-500 flex-shrink-0 bg-white/20 hover:scale-110 cursor-pointer';
            knob.style.left = '3px';
        }
    };

    window.renderPatternFilterList = function () {
        const list = document.getElementById('patternsList');
        if (!list || !window.state) return;

        const metaData = getPatternMetaData();

        if (!window.state.patternSortMode) window.state.patternSortMode = 'chrono';

        // Initialize pattern configs — default ALL keys to ON
        if (!window.state.patternConfig) window.state.patternConfig = {};
        for (const key of Object.keys(metaData)) {
            if (window.state.patternConfig[key] === undefined) {
                window.state.patternConfig[key] = true;
            }
        }

        const config = window.state.patternConfig;

        let patternItems = Object.keys(metaData).map(key => {
            const meta = metaData[key];
            const isEnabled = config[key] !== false;

            // Fetch accuracy stats
            let accuracyText = '';
            let pct = -1;
            if (window.EngineCore && window.EngineCore.stats && window.EngineCore.stats.patternStats) {
                const labelMatch = meta.label || key;
                const pStats = window.EngineCore.stats.patternStats[labelMatch] || window.EngineCore.stats.patternStats[key];
                if (pStats) {
                    const total = pStats.wins + pStats.losses;
                    if (total > 0) {
                        pct = Math.round((pStats.wins / total) * 100);
                        accuracyText = ` <span class="opacity-40">(${pct}%)</span>`;
                    }
                }
            }
            return { key, meta, isEnabled, pct, accuracyText };
        });

        if (window.state.patternSortMode === 'best') {
            patternItems.sort((a, b) => b.pct - a.pct);
        } else if (window.state.patternSortMode === 'worst') {
            patternItems.sort((a, b) => {
                if (a.pct === -1) return 1; // Keep unplayed at the bottom
                if (b.pct === -1) return -1;
                return a.pct - b.pct;
            });
        } else {
            // Default: Chronological ordering
            const activeStrategyKey = (window.state && window.state.currentGameplayStrategy) ? window.state.currentGameplayStrategy : 'inside';
            const strategy = window.StrategyRegistry ? window.StrategyRegistry[activeStrategyKey] : null;
            if (strategy && strategy.PATTERN_ORDER) {
                const order = strategy.PATTERN_ORDER;
                patternItems.sort((a, b) => {
                    const idxA = order.indexOf(a.key);
                    const idxB = order.indexOf(b.key);
                    if (idxA === -1) return 1;
                    if (idxB === -1) return -1;
                    return idxA - idxB;
                });
            }
        }

        let entries = [];
        for (const item of patternItems) {
            const { key, meta, isEnabled, accuracyText, pct } = item;
            const accent = meta.accent || '#BF5AF2';

            // pct is -1 if no data, 0-100 otherwise
            const barWidth = pct >= 0 ? pct : 0;
            const bgGradient = isEnabled ? `background: linear-gradient(90deg, ${accent}20 ${barWidth}%, transparent ${barWidth}%);` : '';

            entries.push(`
                <div class="flex items-center justify-between p-3.5 px-4 rounded-2xl transition-all duration-300 group/item cursor-pointer border
                    ${isEnabled ? 'border-white/5 shadow-lg' : 'bg-white/[0.02] border-transparent hover:bg-white/5'}"
                    style="${bgGradient}"
                    onclick="event.stopPropagation(); togglePatternFilter('${key}')">
                    
                    <div class="flex flex-col flex-1 min-w-0 pr-4">
                        <span class="font-black text-[10px] tracking-widest ${isEnabled ? 'text-white' : 'text-white/60'} transition-colors duration-300 truncate uppercase">
                            ${meta.label || key}${accuracyText}
                        </span>
                    </div>
                    
                    <!-- Apple Switch -->
                    <div class="h-5 w-9 rounded-full relative transition-all duration-500 flex-shrink-0 hover:scale-110
                        ${isEnabled ? 'bg-[#30D158] shadow-[0_0_15px_rgba(48,209,88,0.5)]' : 'bg-white/20'}"
                        style="border: 1px solid rgba(255,255,255,0.1);">
                        <div class="absolute top-[2px] transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] h-3.5 w-3.5 rounded-full bg-white shadow-sm" 
                             style="left: ${isEnabled ? '18px' : '3px'}; transform: scale(${isEnabled ? '1' : '0.95'});"></div>
                    </div>
                </div>
            `);
        }

        // Update Header Sort Button
        const headerTitle = document.getElementById('patternFilterHeaderTitle');
        if (headerTitle) {
            const sortModes = {
                'chrono': '<i class="fas fa-clock mr-1.5"></i> Chrono',
                'best': '<i class="fas fa-arrow-up mr-1.5"></i> Best',
                'worst': '<i class="fas fa-arrow-down mr-1.5"></i> Worst'
            };
            const currentSortLabel = sortModes[window.state.patternSortMode] || sortModes['chrono'];
            headerTitle.innerHTML = `
                <button onclick="event.stopPropagation(); window.cyclePatternSort()" class="text-[9px] font-black tracking-widest uppercase text-[#BF5AF2] hover:text-white transition-all bg-[#BF5AF2]/10 px-2.5 py-1.5 rounded-lg border border-[#BF5AF2]/20 shadow-lg active:scale-[0.95] flex items-center">
                    ${currentSortLabel}
                </button>
            `;
        }

        if (entries.length === 0) {
            list.innerHTML = '<div class="text-[9px] font-bold uppercase tracking-widest text-white/10 text-center py-8 italic">No filters found for this strategy.</div>';
        } else {
            list.innerHTML = `<div class="divide-y divide-white/[0.03]">${entries.join('')}</div>`;
        }

        // Sync the master ALL toggle
        const metaKeys = Object.keys(metaData);
        const allOn = metaKeys.length > 0 && metaKeys.every(k => config[k] !== false);
        if (window.syncSelectAllSwitch) window.syncSelectAllSwitch(allOn);
    };

    window.togglePatternFilter = function (key) {
        if (!window.state) return;
        if (!window.state.patternConfig) window.state.patternConfig = {};

        const currentState = window.state.patternConfig[key] !== false;
        window.state.patternConfig[key] = !currentState;

        window.renderPatternFilterList();
        if (window.syncPatternFilterButton) window.syncPatternFilterButton();
        if (window.saveSessionData) window.saveSessionData();

        if (window.scanAllStrategies) {
            window.scanAllStrategies({ silent: true }).then(result => {
                if (window.renderDashboardSafe) window.renderDashboardSafe(window.state.activeBets || []);
            }).catch(err => console.error("Filter scan error:", err));
        }
    };

    window.syncPatternFilterButton = function () {
        const button = document.getElementById('patternsToggleBtn');
        const summary = document.getElementById('patternFilterSummary');
        const popover = document.getElementById('patternFilterPopover');
        const badge = document.getElementById('patternsActiveCount');
        if (!window.state || !window.state.patternConfig) return;

        const metaData = getPatternMetaData();
        const config = window.state.patternConfig;

        let enabledCount = 0;
        let totalCount = 0;

        for (const key of Object.keys(metaData)) {
            totalCount++;
            if (config[key] !== false) enabledCount++;
        }

        if (summary) {
            summary.innerText = `${enabledCount} of ${totalCount} active`;
        }

        if (badge) {
            badge.innerText = String(enabledCount);
            if (enabledCount === 0) {
                badge.style.opacity = '0.3';
                badge.style.boxShadow = 'none';
                badge.style.backgroundColor = 'rgba(255,255,255,0.1)';
            } else {
                badge.style.opacity = '1';
                badge.style.boxShadow = '0 0 15px rgba(191,90,242,0.5)';
                badge.style.backgroundColor = '#BF5AF2';
            }
        }

        if (button) {
            if (enabledCount === 0) {
                button.classList.add('opacity-40');
                button.classList.remove('hover:border-[#BF5AF2]/40', 'hover:bg-[#BF5AF2]/5');
            } else {
                button.classList.remove('opacity-40');
                button.classList.add('hover:border-[#BF5AF2]/40', 'hover:bg-[#BF5AF2]/5');
            }
        }
    };


    window.resetSession = function () {
        if (window.toggleHamburgerMenu) window.toggleHamburgerMenu();
        if (window.toggleModal) {
            window.toggleModal('confirmModal');
        }
    };

    window.toggleAccordion = function (id) {
        const content = document.getElementById(id);
        const icon = document.getElementById(id + 'Icon');
        if (!content) return;
        if (content.classList.contains('hidden')) {
            content.classList.remove('hidden');
            if (icon) icon.style.transform = 'rotate(180deg)';
        } else {
            content.classList.add('hidden');
            if (icon) icon.style.transform = 'rotate(0deg)';
        }
    };

    window.toggleHamburgerMenu = function () {
        const menu = document.getElementById('hamburgerMenu');
        const backdrop = document.getElementById('hamburgerBackdrop');
        if (!menu) return;

        const isHidden = menu.classList.contains('hidden') || menu.classList.contains('opacity-0');
        if (isHidden) {
            menu.classList.remove('hidden');
            void menu.offsetWidth;
            menu.classList.remove('opacity-0', 'pointer-events-none', 'scale-95');
            menu.classList.add('opacity-100', 'scale-100');
            if (backdrop) {
                backdrop.classList.remove('opacity-0', 'pointer-events-none');
                backdrop.classList.add('opacity-100');
            }
        } else {
            menu.classList.remove('opacity-100', 'scale-100');
            menu.classList.add('opacity-0', 'pointer-events-none', 'scale-95');
            setTimeout(() => { if (menu.classList.contains('opacity-0')) menu.classList.add('hidden'); }, 300);
            if (backdrop) {
                backdrop.classList.remove('opacity-100');
                backdrop.classList.add('opacity-0', 'pointer-events-none');
            }
        }
    };

    window.toggleInputLayout = function () {
        if (!window.state) return;
        window.state.currentInputLayout = window.state.currentInputLayout === 'grid' ? 'racetrack' : 'grid';
        const label = document.getElementById('layoutLabel');
        if (label) {
            label.innerText = window.state.currentInputLayout.toUpperCase();
            if (window.state.currentInputLayout === 'racetrack') {
                label.className = "text-[9px] font-black bg-[#BF5AF2]/20 px-2.5 py-1 rounded-md text-[#BF5AF2] shadow-inner";
            } else {
                label.className = "text-[9px] font-black bg-white/10 px-2.5 py-1 rounded-md text-white shadow-inner";
            }
        }
        window.UiController.initDesktopGrid();
        if (window.scheduleComboBridgeRelayout) window.scheduleComboBridgeRelayout();
        if (window.saveSessionData) window.saveSessionData();
    };

    // --- STOPWATCH ---
    let stopwatchInterval = null;
    let stopwatchSeconds = 0;

    window.updateStopwatchDisplay = function () {
        const display = document.getElementById('stopwatchDisplay');
        if (display) {
            let hrs = Math.floor(stopwatchSeconds / 3600);
            let mins = Math.floor((stopwatchSeconds % 3600) / 60);
            let secs = stopwatchSeconds % 60;
            display.innerText = `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
    };

    window.toggleStopwatch = function () {
        const icon = document.getElementById('stopwatchIcon');
        const text = document.getElementById('stopwatchText');
        const btn = document.getElementById('stopwatchToggleBtn');
        if (stopwatchInterval) {
            clearInterval(stopwatchInterval);
            stopwatchInterval = null;
            if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
            if (text) text.innerText = 'Start';
            if (btn) { btn.classList.remove('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30'); btn.classList.add('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30'); }
        } else {
            stopwatchInterval = setInterval(() => { stopwatchSeconds++; window.updateStopwatchDisplay(); }, 1000);
            if (icon) { icon.classList.remove('fa-play'); icon.classList.add('fa-pause'); }
            if (text) text.innerText = 'Pause';
            if (btn) { btn.classList.remove('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30'); btn.classList.add('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30'); }
        }
    };

    window.resetStopwatch = function () {
        if (stopwatchInterval) { clearInterval(stopwatchInterval); stopwatchInterval = null; }
        stopwatchSeconds = 0;
        window.updateStopwatchDisplay();
        const icon = document.getElementById('stopwatchIcon');
        const text = document.getElementById('stopwatchText');
        const btn = document.getElementById('stopwatchToggleBtn');
        if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
        if (text) text.innerText = 'Start';
        if (btn) { btn.classList.remove('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30'); btn.classList.add('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30'); }
    };


})();
