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

        // Static text overlays (Rotated down for elegant fit)
        texts += `<text x="${cx}" y="150" transform="rotate(90, ${cx}, 150)" class="rt-label">TIER</text>`;
        texts += `<text x="${cx}" y="300" transform="rotate(90, ${cx}, 300)" class="rt-label">ORPHELINS</text>`;
        texts += `<text x="${cx}" y="480" transform="rotate(90, ${cx}, 480)" class="rt-label">VOISINS</text>`;
        texts += `<text x="${cx}" y="690" transform="rotate(90, ${cx}, 690)" class="rt-label">ZERO</text>`;

        let createGroup = (num, pathD, tx, ty) => {
            return `<g class="rt-seg" onclick="handleGridClick(${num})">
                <path d="${pathD}" />
                <text x="${tx}" y="${ty}" class="rt-num ${getColorClass(num)}" text-anchor="middle" dominant-baseline="central">${num}</text>
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
        let tr = innerR + trackThickness / 2; // 62
        paths += createGroup(3, getWedgePath(cx, cy2, innerR, outerR, 0, 60), cx + tr * Math.cos(30 * Math.PI / 180), cy2 + tr * Math.sin(30 * Math.PI / 180));
        paths += createGroup(26, getWedgePath(cx, cy2, innerR, outerR, 60, 120), cx, cy2 + tr);
        paths += createGroup(0, getWedgePath(cx, cy2, innerR, outerR, 120, 180), cx + tr * Math.cos(150 * Math.PI / 180), cy2 + tr * Math.sin(150 * Math.PI / 180));

        // 4. Top Arc
        paths += createGroup(23, getWedgePath(cx, cy1, innerR, outerR, 180, 270), cx + tr * Math.cos(225 * Math.PI / 180), cy1 + tr * Math.sin(225 * Math.PI / 180));
        paths += createGroup(10, getWedgePath(cx, cy1, innerR, outerR, 270, 360), cx + tr * Math.cos(315 * Math.PI / 180), cy1 + tr * Math.sin(315 * Math.PI / 180));

        return `
            <svg id="racetrackSvg" width="100%" viewBox="0 0 ${svgW} ${svgH}" class="max-w-[220px] pointer-events-auto">
                <style>
                    .rt-num { font-family: 'Space Mono', monospace; font-size: 20px; font-weight: 800; pointer-events: none; }
                    .rt-num.rt-red { fill: #ff5050; text-shadow: 0 0 10px rgba(255,80,80,0.5); }
                    .rt-num.rt-black { fill: #bbbbbb; }
                    .rt-num.rt-green { fill: #00ff66; text-shadow: 0 0 10px rgba(0,255,102,0.5); }
                    
                    .rt-seg path { fill: #2a2a2e; stroke: rgba(255,255,255,0.06); stroke-width: 1px; transition: all 0.15s ease; cursor: pointer; }
                    .rt-seg:hover path { fill: rgba(255, 26, 51, 0.15); stroke: rgba(255, 26, 51, 0.6); filter: drop-shadow(0 0 10px rgba(255,26,51,0.3)); }
                    
                    .rt-inner { fill: transparent; stroke: rgba(255,255,255,0.06); stroke-width: 2px; }
                    .rt-label { font-family: 'Inter', sans-serif; font-size: 14px; font-weight: 800; letter-spacing: 5px; text-anchor: middle; dominant-baseline: central; fill: rgba(255,255,255,0.15); pointer-events: none; }
                </style>
                ${paths}
                ${texts}
            </svg>
        `;
    }

    function initDesktopGrid() {
        const gridWrapper = document.getElementById('desktopGrid');

        if (state.currentInputLayout === 'grid') {
            gridWrapper.className = "hidden md:block w-[240px] shrink-0 mesmer-grid p-3 overflow-y-auto custom-scroll";
            gridWrapper.innerHTML = '<div class="grid grid-cols-3 gap-2 pb-10"></div>';

            const grid = gridWrapper.firstElementChild;
            grid.innerHTML = '<button class="grid-btn grid-green col-span-3 py-4 shadow-sm h-12 flex items-center justify-center" onclick="handleGridClick(0)">0</button>';

            for (let i = 1; i <= 36; i++) {
                let btn = document.createElement('button');
                const isRed = config.RED_NUMS.includes(i);
                btn.className = `grid-btn py-4 shadow-sm h-12 flex items-center justify-center ${isRed ? 'grid-red' : 'grid-black'}`;
                btn.innerText = i;
                btn.onclick = () => handleGridClick(i);
                grid.appendChild(btn);
            }
        } else {
            // RACETRACK LAYOUT (Perfect Theme Integration)
            gridWrapper.className = "hidden md:block w-[240px] shrink-0 mesmer-grid overflow-y-auto custom-scroll";

            // Remove flex center entirely to restore the ability to scroll freely to the top and bottom!
            gridWrapper.innerHTML = '<div class="w-full flex justify-center pt-6 pb-20 fade-in"></div>';

            const grid = gridWrapper.firstElementChild;
            grid.innerHTML = buildRacetrackSVG();
        }
    }

    function showToast(message, type = 'error') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'fixed top-20 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 pointer-events-none';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        const bgColor = type === 'error' ? 'bg-[#ff1a33]/90 border-[#ff1a33]/50' : 'bg-[#30D158]/90 border-[#30D158]/50';
        toast.className = `${bgColor} text-white px-5 py-2.5 rounded-xl shadow-2xl text-xs font-semibold tracking-wider backdrop-blur-md border flex items-center justify-center transition-all duration-300`;

        toast.style.opacity = '0';
        toast.style.transform = 'translateY(-10px)';

        toast.innerHTML = `<i class="fas ${type === 'error' ? 'fa-exclamation-triangle' : 'fa-check-circle'} mr-3 text-sm"></i> ${message}`;

        container.appendChild(toast);

        void toast.offsetWidth; // Trigger reflow
        toast.style.opacity = '1';
        toast.style.transform = 'translateY(0)';

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(-10px)';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // --- IMPORT / EXPORT DATA ---
    window.exportSpins = function () {
        if (!window.state || !window.state.history || window.state.history.length === 0) {
            alert("No spins to export!");
            return;
        }
        const spins = window.state.history.map(h => h.num);
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

    window.importSpins = function (input) {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async function (e) {
            try {
                const data = JSON.parse(e.target.result);
                if (Array.isArray(data.spins)) {
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
