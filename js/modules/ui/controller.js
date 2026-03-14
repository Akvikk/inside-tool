(function () {
    const state = window.state;
    // --- PUBLIC INTERFACE ---
    window.UiController = {
        init,
        openHindsightModal,
        initDesktopGrid
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
            return state.RED_NUMS.includes(num) ? 'rt-red' : 'rt-black';
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
                const isRed = state.RED_NUMS.includes(i);
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
})();
