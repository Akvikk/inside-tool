(function () {
    const state = window.state;
    // --- PUBLIC INTERFACE ---
    window.UiController = {
        init,
        openHindsightModal,
        initDesktopGrid,
        showToast
    };

    // Make it globally accessible for the onclick attribute
    window.openHindsightModal = openHindsightModal;

    async function openHindsightModal() {
        if (!window.HindsightModal || !window.AiBrain) {
            console.error("HindsightModal or AiBrain not initialized.");
            return;
        }

        // Show modal immediately with a loading state
        window.HindsightModal.open();

        try {
            // These stats need to be gathered from the engine and user history
            const history = state.history || [];
            const userStats = state.userStats || { netUnits: 0, betLog: [] };
            const engineStats = window.EngineCore ? window.EngineCore.stats : { totalWins: 0, totalLosses: 0, signalLog: [] };

            const analysis = await window.AiBrain.requestFullSessionReview(history, userStats, engineStats);

            if (analysis.error) {
                throw new Error(analysis.error);
            }

            // Reformat the critique for display
            let tacticalHTML = '';
            if (analysis.critique && analysis.critique.critiques) {
                tacticalHTML = analysis.critique.critiques.map(c => `
                    <div class="bg-white/5 border border-white/10 rounded-lg p-3 mb-2">
                        <div class="font-bold text-white text-sm mb-1">${c.title}</div>
                        <div class="text-xs text-white/70 leading-relaxed">${c.suggestion}</div>
                    </div>
                `).join('');
            } else {
                tacticalHTML = `<p class="text-sm text-white/70">No tactical critique provided.</p>`;
            }

            const formattedAnalysis = {
                actualProfit: analysis.actualNet,
                potentialProfit: analysis.potentialNet,
                tacticalCritique: tacticalHTML
            };

            window.HindsightModal.render(formattedAnalysis);
        } catch (error) {
            console.error("Error during AI Hindsight review:", error);
            window.HindsightModal.render({ error: error.message });
        }
    }

    function init() {
        if (window.HindsightModal && typeof window.HindsightModal.init === 'function') {
            window.HindsightModal.init();
        }
        initDesktopGrid();

        // Ensure global toggleModal exists
        if (!window.toggleModal) {
            window.toggleModal = function (id) {
                const el = document.getElementById(id);
                if (el) el.classList.toggle('hidden');
            };
        }

        // Header Buttons Data Bindings
        const betsBtn = document.getElementById('headerBetsBtn');
        if (betsBtn) {
            betsBtn.onclick = function () {
                window.toggleModal('betsModal');
                if (window.renderUserAnalytics) window.renderUserAnalytics();
            };
        }

        const statsBtn = document.getElementById('headerStatsBtn');
        if (statsBtn) {
            statsBtn.onclick = function () {
                window.toggleModal('analyticsModal');
                if (window.renderAnalytics) window.renderAnalytics();
            };
        }
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
        const svgW = 240;
        const svgH = 880;

        const trackThickness = 44;
        const innerR = 40;
        const outerR = innerR + trackThickness; // 84

        const cx = 120;
        const cy1 = 100;
        const cy2 = 740;
        const blockH = 40; // 16 * 40 = 640

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

        let getColorClass = (num) => {
            if (num === 0) return 'rt-green';
            return config.RED_NUMS.includes(num) ? 'rt-red' : 'rt-black';
        };

        let paths = '';
        let texts = '';

        // Inner Area - Transparent but bordered to match UI
        paths += `<path d="M ${cx - innerR} ${cy1} L ${cx - innerR} ${cy2} A ${innerR} ${innerR} 0 0 0 ${cx + innerR} ${cy2} L ${cx + innerR} ${cy1} A ${innerR} ${innerR} 0 0 0 ${cx - innerR} ${cy1} Z" class="rt-inner" />`;

        // Division Lines inside the track
        paths += `<line x1="${cx - innerR}" y1="230" x2="${cx + innerR}" y2="230" stroke="rgba(255,255,255,0.05)" stroke-width="2" />`;
        paths += `<line x1="${cx - innerR}" y1="380" x2="${cx + innerR}" y2="520" stroke="rgba(255,255,255,0.05)" stroke-width="2" />`;
        paths += `<path d="M ${cx - innerR} 640 C ${cx - innerR + 20} 600, ${cx + innerR - 20} 600, ${cx + innerR} 640" fill="none" stroke="rgba(255,255,255,0.05)" stroke-width="2" />`;

        // Zero
        paths += `<path d="${getWedgePath(cx, cy1, innerR, outerR, 180, 360)}" class="rt-zero" onclick="handleGridClick(0)"/>`;
        texts += `<text x="${cx}" y="${cy1 - 50}" class="rt-text">0</text>`;

        // Right side (1st 12 group mixed with others)
        rightArray.forEach((num, i) => {
            paths += `<path d="${getRectPath(cx + innerR, cy1 + i * blockH, trackThickness, blockH)}" class="${getColorClass(num)}" onclick="handleGridClick(${num})"/>`;
            texts += `<text x="${cx + innerR + 22}" y="${cy1 + i * blockH + 25}" class="rt-text" transform="rotate(90, ${cx + innerR + 22}, ${cy1 + i * blockH + 25})">${num}</text>`;
        });

        // Bottom curved part with numbers
        // We'll put some numbers here or leave it for special bets.
        // For simplicity, let's keep it clean since it's a HUD.

        // Left side
        leftArray.forEach((num, i) => {
            // Drawn from bottom up
            const idx = leftArray.length - 1 - i;
            paths += `<path d="${getRectPath(cx - outerR, cy1 + idx * blockH, trackThickness, blockH)}" class="${getColorClass(num)}" onclick="handleGridClick(${num})"/>`;
            texts += `<text x="${cx - outerR + 22}" y="${cy1 + idx * blockH + 25}" class="rt-text" transform="rotate(-90, ${cx - outerR + 22}, ${cy1 + idx * blockH + 25})">${num}</text>`;
        });

        return { paths, texts };
    }

    function initDesktopGrid() {
        const grid = document.getElementById('desktopGrid');
        if (!grid) return;
        grid.innerHTML = '';
        if (state.currentInputLayout === 'racetrack') {
            const { paths, texts } = buildRacetrackSVG();
            grid.innerHTML = `
                <div class="flex items-center justify-center h-full w-full py-4">
                    <svg width="240" height="880" viewBox="0 0 240 880" class="roulette-racetrack drop-shadow-2xl">
                        <g>${paths}</g>
                        <g>${texts}</g>
                    </svg>
                </div>
            `;
            grid.className = "hidden md:block w-[240px] shrink-0 overflow-y-auto custom-scroll refined-glass h-full";
        } else {
            const RED_NUMS = window.config && window.config.RED_NUMS ? window.config.RED_NUMS : [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
            let gridHtml = '<div class="grid grid-cols-3 gap-2 w-full">';
            gridHtml += '<button class="grid-btn grid-green col-span-3 font-bold text-sm" onclick="handleGridClick(0)">ZERO</button>';
            for (let i = 1; i <= 36; i++) {
                const isRed = RED_NUMS.includes(i);
                const colorClass = isRed ? 'grid-red' : 'grid-black';
                gridHtml += `<button class="grid-btn ${colorClass} font-bold text-sm" onclick="handleGridClick(${i})">${i}</button>`;
            }
            gridHtml += '</div>';
            grid.className = "hidden md:block w-[240px] shrink-0 p-3 overflow-y-auto custom-scroll refined-glass h-full";
            grid.innerHTML = gridHtml;
        }
    }

    function showToast(msg, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = `toast-item animate-apple-in ${type}`;
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-20px)';
            setTimeout(() => toast.remove(), 500);
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

    // --- GENERIC UI & MODALS ---
    // --- PATTERN FILTER RECOVERY ---
    window.togglePatternFilterPopover = function (forceOpen = null) {
        const popover = document.getElementById('patternFilterPopover');
        const button = document.getElementById('patternsToggleBtn');
        if (!popover) return;

        const shouldOpen = typeof forceOpen === 'boolean' ? forceOpen : popover.classList.contains('hidden');

        if (shouldOpen) {
            window.renderPatternFilterList();
            popover.classList.remove('hidden');
            if (button) button.classList.add('pattern-toggle-active');
        } else {
            popover.classList.add('hidden');
            if (button) button.classList.remove('pattern-toggle-active');
        }
        if (window.syncPatternFilterButton) window.syncPatternFilterButton();
    };

    window.closePatternFilterPopover = function () {
        const popover = document.getElementById('patternFilterPopover');
        const button = document.getElementById('patternsToggleBtn');
        if (popover) popover.classList.add('hidden');
        if (button) button.classList.remove('pattern-toggle-active');
    };

    window.renderPatternFilterList = function () {
        const list = document.getElementById('patternsList');
        if (!list || !window.state || !window.StrategyRegistry) return;

        const activeStrategyKey = window.state.currentGameplayStrategy || 'series';
        const strategy = window.StrategyRegistry[activeStrategyKey];
        if (!strategy) return;

        const metaData = strategy.PATTERN_FILTER_META || {};
        const config = window.state.patternConfig || {};

        let entries = [];
        for (const key of Object.keys(metaData)) {
            const meta = metaData[key];
            const isEnabled = config[key] !== false;
            const accent = meta.accent || 'var(--apple-p3-blue)';
            
            entries.push(`
                <div class="flex items-center justify-between p-3.5 rounded-xl transition-all duration-300 hover:bg-white/[0.03] active:scale-[0.98] cursor-pointer" onclick="togglePatternFilter('${key}')">
                    <div class="flex flex-col">
                        <span class="text-[10px] font-bold text-white tracking-tight">${meta.label || key}</span>
                        <span class="text-[8px] text-white/30 uppercase tracking-widest mt-0.5">${meta.category || 'Protocol'}</span>
                    </div>
                    
                    <!-- APPLE NATIVE SWITCH -->
                    <div class="h-6 w-11 rounded-full relative transition-all duration-300 ${isEnabled ? 'bg-[#30D158]' : 'bg-white/10'}" 
                         style="${isEnabled ? `box-shadow: 0 0 10px ${accent}20;` : ''}">
                        <div class="absolute top-1 left-1 h-4 w-4 rounded-full bg-white transition-transform duration-300 shadow-md" 
                             style="transform: translateX(${isEnabled ? '20px' : '0'});"></div>
                    </div>
                </div>
            `);
        }

        if (entries.length === 0) {
            list.innerHTML = '<div class="text-[9px] font-bold uppercase tracking-widest text-white/10 text-center py-8 italic">No protocols found for this strategy.</div>';
        } else {
            list.innerHTML = `<div class="divide-y divide-white/[0.03]">${entries.join('')}</div>`;
        }
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
        if (!window.state || !window.state.patternConfig || !window.StrategyRegistry) return;

        const activeStrategyKey = window.state.currentGameplayStrategy || 'series';
        const strategy = window.StrategyRegistry[activeStrategyKey];
        if (!strategy) return;

        const metaData = strategy.PATTERN_FILTER_META || {};
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

        if (popover) {
            popover.className = "pattern-filter-popover refined-glass rounded-[24px] shadow-2xl animate-apple-in " + (popover.classList.contains('hidden') ? 'hidden' : '');
        }

        if (button) {
            button.classList.toggle('text-[#BF5AF2]', enabledCount > 0);
            button.classList.toggle('text-white/40', enabledCount === 0);
        }
    };

    // Close popover when clicking outside
    document.addEventListener('click', (e) => {
        const patternShell = document.getElementById('patternFilterShell');
        const patternPopover = document.getElementById('patternFilterPopover');
        if (patternShell && patternPopover && !patternPopover.classList.contains('hidden') && !patternShell.contains(e.target)) {
            window.closePatternFilterPopover();
        }
    });

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
        if (menu.classList.contains('hidden')) {
            menu.classList.remove('hidden');
            if (backdrop) backdrop.classList.remove('hidden');
        } else {
            menu.classList.add('hidden');
            if (backdrop) backdrop.classList.add('hidden');
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

    // --- AI MODAL CONFIG ---
    window.openAiConfigModal = function () {
        if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
        const keyInput = document.getElementById('aiApiKeyInput');
        const providerSelect = document.getElementById('aiProviderSelect');
        if (keyInput) keyInput.value = window.state.aiApiKey || '';
        if (providerSelect) providerSelect.value = window.state.aiProvider || 'gemini';
        window.toggleModal('aiConfigModal');
    };

    window.openAiChat = function () { window.toggleModal('aiChatModal'); };

    window.toggleAiMasterSwitch = function () {
        if (!window.state) return;
        window.state.aiEnabled = !window.state.aiEnabled;
        if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
        if (window.saveSessionData) window.saveSessionData();
    };

    window.toggleNeuralPrediction = function () {
        if (!window.state) return;
        window.state.neuralPredictionEnabled = !window.state.neuralPredictionEnabled;
        if (window.updateAiConfigModalUI) window.updateAiConfigModalUI();
        if (window.saveSessionData) window.saveSessionData();
    };

    window.toggleAiApiKeyVisibility = function () {
        const input = document.getElementById('aiApiKeyInput');
        const icon = document.getElementById('toggleAiKeyVisibilityIcon');
        if (!input || !icon) return;
        if (input.type === 'password') {
            input.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            input.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    };

    window.updateAiConfigModalUI = function () {
        if (!window.state) return;
        const masterSwitch = document.getElementById('aiMasterSwitch'), knob = document.getElementById('aiSwitchKnob'), statusText = document.getElementById('aiMasterStatusText'), vaultSection = document.getElementById('aiVaultSection'), hindsightToggle = document.getElementById('aiHindsightToggle'), statusBadge = document.getElementById('aiStatusBadge');
        if (masterSwitch && knob && statusText && vaultSection) {
            if (window.state.aiEnabled) { masterSwitch.classList.replace('bg-white/10', 'bg-[#30D158]/20'); masterSwitch.classList.replace('border-white/20', 'border-[#30D158]/30'); knob.classList.replace('bg-gray-400', 'bg-[#30D158]'); knob.style.transform = 'translateX(24px)'; statusText.innerText = 'Enabled'; vaultSection.classList.remove('hidden'); }
            else { masterSwitch.classList.replace('bg-[#30D158]/20', 'bg-white/10'); masterSwitch.classList.replace('border-[#30D158]/30', 'border-white/20'); knob.classList.replace('bg-[#30D158]', 'bg-gray-400'); knob.style.transform = 'translateX(0)'; statusText.innerText = 'Disabled'; vaultSection.classList.add('hidden'); }
        }
        if (hindsightToggle) {
            const hKnob = hindsightToggle.querySelector('div');
            if (window.state.neuralPredictionEnabled) {
                hindsightToggle.classList.replace('bg-white/10', 'bg-[#bf5af2]/30'); hindsightToggle.classList.replace('border-white/20', 'border-[#bf5af2]/50');
                if (hKnob) { hKnob.classList.replace('bg-gray-500', 'bg-[#bf5af2]'); hKnob.style.transform = 'translateX(20px)'; hKnob.style.boxShadow = '0 0 8px rgba(191,90,242,0.6)'; }
            } else {
                hindsightToggle.classList.replace('bg-[#bf5af2]/30', 'bg-white/10'); hindsightToggle.classList.replace('border-[#bf5af2]/50', 'border-white/20');
                if (hKnob) { hKnob.classList.replace('bg-[#bf5af2]', 'bg-gray-500'); hKnob.style.transform = 'translateX(0)'; hKnob.style.boxShadow = 'none'; }
            }
        }
        if (statusBadge) {
            if (window.state.aiRelayAvailable) { statusBadge.innerText = 'CONNECTED'; statusBadge.className = 'text-[9px] font-black bg-[#30D158]/20 px-2.5 py-1 rounded-md text-[#30D158] shadow-inner'; }
            else { statusBadge.innerText = 'NOT CONNECTED'; statusBadge.className = 'text-[9px] font-black bg-white/10 px-2.5 py-1 rounded-md text-white/50 shadow-inner'; }
        }
        const headerAiBtn = document.getElementById('headerAiBtn');
        if (headerAiBtn) {
            if (window.state.aiRelayAvailable) { headerAiBtn.classList.add('ai-connected'); headerAiBtn.classList.remove('ai-offline'); }
            else if (window.state.aiEnabled) { headerAiBtn.classList.add('ai-offline'); headerAiBtn.classList.remove('ai-connected'); }
            else { headerAiBtn.classList.remove('ai-connected'); headerAiBtn.classList.remove('ai-offline'); }
        }
    };
})();
