﻿﻿﻿﻿﻿// --- CONFIGURATION ---
const RED_NUMS = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
const PERIMETER_RULE_KEY = 'Perimeter Rule';
const PREDICTION_PERIMETER_PATTERN = 'Prediction Perimeter';

// --- STATE MANAGEMENT ---
let currentInputLayout = 'grid'; // 'grid' or 'racetrack'
const RACETRACK_ORDER = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];

let history = [];
let activeBets = [];
let faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let predictionPerimeterWindow = 14;
let perimeterRuleEnabled = true;

// Constants PERIMETER_COMBOS and FACES are already defined in predictionEngine.js
// Removing duplicate declarations to prevent SyntaxError

// Global Pattern Configuration - The Source of Truth
let patternConfig = {
    [PERIMETER_RULE_KEY]: perimeterRuleEnabled
};

// Independent Simulation Configuration for Analytics
let simulationConfig = {};

let engineStats = {
    totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0,
    bankrollHistory: [0], patternStats: {},
    signalLog: []
};

let userStats = {
    totalWins: 0, totalLosses: 0, netUnits: 0,
    bankrollHistory: [0],
    betLog: []
};

let strategies = {};

let currentAnalyticsTab = 'god';
let isHudColdMode = false;
window.currentAlerts = [];

function resetSession() {
    const modal = document.getElementById('confirmModal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('confirmResetBtn').onclick = () => {
            performReset();
            modal.classList.add('hidden');
        };
    }
}

function performReset() {
    history = [];
    activeBets = [];
    faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    window.currentAlerts = [];

    engineStats = {
        totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0,
        bankrollHistory: [0], patternStats: {},
        signalLog: []
    };

    userStats = {
        totalWins: 0, totalLosses: 0, netUnits: 0,
        bankrollHistory: [0],
        betLog: []
    };

    updatePredictionSettingsUI();
    renderGapStats();
    updatePerimeterAnalytics();
    updateVisibility();
    updateAnalyticsHUD();
    const hm = document.getElementById('hamburgerMenu');
    if (hm) hm.classList.add('hidden');
    const hb = document.getElementById('hamburgerBackdrop');
    if (hb) hb.classList.add('hidden');

    // Clear history body
    const body = document.getElementById('historyBody');
    if (body) body.innerHTML = '';
}

// --- INIT ---
window.onload = () => {
    initDesktopGrid();
    renderFilterMenu();
    renderGapStats();
    syncPerimeterRuleState();
    updatePredictionSettingsUI();
    // Init sim config
    simulationConfig = JSON.parse(JSON.stringify(patternConfig));
    
    updatePerimeterAnalytics();
    updateAnalyticsHUD();

    document.getElementById('spinInput').focus();
    document.getElementById('spinInput').addEventListener("keypress", (e) => {
        if (e.key === "Enter") addSpin();
    });

    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            undoSpin();
        }
    });

    // Global Click listener for menus
    document.addEventListener('click', (e) => {
        // Sim Menu
        const simMenu = document.getElementById('simFilterMenu');
        const simBtn = document.getElementById('simFilterBtn');
        if (simMenu && !simMenu.classList.contains('hidden') && !simMenu.contains(e.target) && !simBtn.contains(e.target)) {
            simMenu.classList.add('hidden');
        }

        // Hamburger Menu
        const burgerMenu = document.getElementById('hamburgerMenu');
        const burgerBtn = burgerMenu ? burgerMenu.previousElementSibling : null;
        if (burgerMenu && !burgerMenu.classList.contains('hidden') && !burgerMenu.contains(e.target) && (!burgerBtn || !burgerBtn.contains(e.target))) {
            burgerMenu.classList.add('hidden');
        }
    });

    window.addEventListener('resize', () => {
        requestAnimationFrame(layoutAllComboBridges);
    });

    // Init HUD
    initAnalyticsHUD();
};

function toggleHamburgerMenu() {
    const menu = document.getElementById('hamburgerMenu');
    const backdrop = document.getElementById('hamburgerBackdrop');

    if (menu.classList.contains('hidden')) {
        menu.classList.remove('hidden');
        if (backdrop) backdrop.classList.remove('hidden');
    } else {
        menu.classList.add('hidden');
        if (backdrop) backdrop.classList.add('hidden');
    }
}

function toggleAccordion(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById(id + 'Icon');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
    }
}

function toggleInputLayout() {
    currentInputLayout = currentInputLayout === 'grid' ? 'racetrack' : 'grid';

    // Update label in Hamburger menu
    const label = document.getElementById('layoutLabel');
    if (label) {
        label.innerText = currentInputLayout.toUpperCase();
        if (currentInputLayout === 'racetrack') {
            label.className = "text-[10px] font-bold bg-[#BF5AF2]/20 px-2 py-1 rounded text-[#BF5AF2]";
        } else {
            label.className = "text-[10px] font-bold bg-white/10 px-2 py-1 rounded text-white";
        }
    }

    initDesktopGrid(); // Re-render the grid
    requestAnimationFrame(layoutAllComboBridges);
}

// --- FLOATING HUD LOGIC ---
function initAnalyticsHUD() {
    const hud = document.getElementById('analyticsHUD');
    const header = document.getElementById('hudHeader');
    const resizer = document.getElementById('hudResizeHandle');

    if (!hud || !header || !resizer) return;

    // DRAG LOGIC
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    header.addEventListener('mousedown', startDrag);
    header.addEventListener('touchstart', startDrag, { passive: false });

    function startDrag(e) {
        if (e.type === 'mousedown') e.preventDefault();
        isDragging = true;
        const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        startX = clientX;
        startY = clientY;
        initialLeft = hud.offsetLeft;
        initialTop = hud.offsetTop;
        document.addEventListener('mousemove', onDrag);
        document.addEventListener('mouseup', stopDrag);
        document.addEventListener('touchmove', onDrag, { passive: false });
        document.addEventListener('touchend', stopDrag);
    }

    function onDrag(e) {
        if (!isDragging) return;
        const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        const dx = clientX - startX;
        const dy = clientY - startY;
        hud.style.left = `${initialLeft + dx}px`;
        hud.style.top = `${initialTop + dy}px`;
        if (e.type === 'touchmove') e.preventDefault(); // Prevent scrolling while dragging
    }

    function stopDrag() {
        isDragging = false;
        document.removeEventListener('mousemove', onDrag);
        document.removeEventListener('mouseup', stopDrag);
        document.removeEventListener('touchmove', onDrag);
        document.removeEventListener('touchend', stopDrag);
    }

    // RESIZE LOGIC
    resizer.addEventListener('mousedown', startResize);
    resizer.addEventListener('touchstart', startResize, { passive: false });

    function startResize(e) {
        if (e.type === 'mousedown') e.preventDefault();
        e.stopPropagation();
        isResizing = true;
        const clientX = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
        startX = clientX;
        startY = clientY;
        startW = hud.offsetWidth;
        startH = hud.offsetHeight;
        document.addEventListener('mousemove', onResize);
        document.addEventListener('mouseup', stopResize);
        document.addEventListener('touchmove', onResize, { passive: false });
        document.addEventListener('touchend', stopResize);
    }

    function onResize(e) {
        if (!isResizing) return;
        const clientX = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
        const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
        const w = startW + (clientX - startX);
        const h = startH + (clientY - startY);
        hud.style.width = `${Math.max(200, w)}px`;
        hud.style.height = `${Math.max(160, h)}px`;
        if (e.type === 'touchmove') e.preventDefault();
    }

    function stopResize() {
        isResizing = false;
        document.removeEventListener('mousemove', onResize);
        document.removeEventListener('mouseup', stopResize);
        document.removeEventListener('touchmove', onResize);
        document.removeEventListener('touchend', stopResize);
    }
}

function toggleAnalyticsHUD() {
    const hud = document.getElementById('analyticsHUD');
    const btn = document.getElementById('hudToggleBtn');

    if (hud.classList.contains('hidden')) {
        hud.classList.remove('hidden');
        hud.classList.add('flex');
        btn.classList.add('bg-white/10');
        updateAnalyticsHUD();
    } else {
        hud.classList.add('hidden');
        hud.classList.remove('flex');
        btn.classList.remove('bg-white/10');
    }
}

function toggleHUDControls() {
    const controls = document.getElementById('hudControls');
    if (controls.classList.contains('hidden')) {
        controls.classList.remove('hidden');
    } else {
        controls.classList.add('hidden');
    }
}

function toggleHudColdMode() {
    isHudColdMode = !isHudColdMode;
    const btn = document.getElementById('hudColdBtn');
    if (btn) {
        if (isHudColdMode) btn.classList.replace('text-gray-500', 'text-[#06b6d4]');
        else btn.classList.replace('text-[#06b6d4]', 'text-gray-500');
    }
    // Refresh HUD
    updateAnalyticsHUD();
}

function updateAnalyticsHUD() {
    const hud = document.getElementById('analyticsHUD');
    if (!hud || hud.classList.contains('hidden')) return;

    // Update Controls
    const hudSlider = document.getElementById('hudWindowSlider');
    const hudLabel = document.getElementById('hudWindowValue');
    if (hudSlider && parseInt(hudSlider.value) !== predictionPerimeterWindow) hudSlider.value = predictionPerimeterWindow;
    
    const themeColor = isHudColdMode ? '#06b6d4' : '#30D158';
    
    if (hudLabel) {
        hudLabel.innerText = `${predictionPerimeterWindow} Spins`;
        hudLabel.style.color = themeColor;
    }
    
    // Update Header Title based on mode
    const headerTitle = hud.querySelector('#hudHeader span');
    if (headerTitle) {
        headerTitle.innerHTML = isHudColdMode 
            ? `<i class="fas fa-snowflake mr-1"></i> Cold Tracker`
            : `<i class="fas fa-satellite-dish mr-1"></i> Live Feed`;
        headerTitle.className = `text-[10px] font-bold tracking-wider uppercase ${isHudColdMode ? 'text-[#06b6d4]' : 'text-[#30D158]'}`;
    }

    // Update Stats Table
    const content = document.getElementById('hudStats');
    if (!content) return;

    const stats = calculatePerimeterStats(history, predictionPerimeterWindow);
    if (!stats || !stats.counts) return;
    const transitionCount = Math.max(0, stats.transitionCount || 0);

    // Sort Combos based on Mode
    let displayCombos = [...PERIMETER_COMBOS];
    if (isHudColdMode) {
        // Cold Mode: Sort by Misses Descending (which is Hits Ascending)
        displayCombos.sort((a, b) => (stats.counts[a.label] || 0) - (stats.counts[b.label] || 0));
    } else {
        // Hot Mode: Sort by Hits Descending
        displayCombos.sort((a, b) => (stats.counts[b.label] || 0) - (stats.counts[a.label] || 0));
    }

    const col2Title = isHudColdMode ? 'Miss' : 'Hits';
    const col3Title = isHudColdMode ? 'Cold %' : '%';

    let html = `
        <table class="w-full text-left text-xs">
            <thead class="text-white/30 border-b border-white/10">
                <tr><th class="pb-1 font-bold">Combo</th><th class="pb-1 text-right font-bold">${col2Title}</th><th class="pb-1 text-right font-bold">${col3Title}</th></tr>
            </thead>
            <tbody class="divide-y divide-white/5">
    `;

    displayCombos.forEach(c => {
        const count = stats.counts[c.label] || 0;
        let val1 = count;
        let val2 = transitionCount > 0 ? Math.round((count / transitionCount) * 100) : 0;
        
        if (isHudColdMode) {
            val1 = Math.max(0, transitionCount - count); // Misses
            val2 = transitionCount > 0 ? Math.max(0, 100 - val2) : 0; // Cold % across real transitions
        }

        const opacity = (isHudColdMode ? val2 > 80 : val2 > 20) ? '1' : '0.5';
        const valColor = (isHudColdMode ? val2 > 80 : val2 > 20) ? themeColor : '#8E8E93';

        html += `
            <tr>
                <td class="py-2 font-bold" style="color:${c.color}; opacity:${opacity}">${c.label}</td>
                <td class="py-2 text-right font-mono text-gray-300" style="opacity:${opacity}">${val1}</td>
                <td class="py-2 text-right font-mono font-bold" style="color:${valColor}; opacity:${opacity}">${val2}%</td>
            </tr>
        `;
    });

    html += `</tbody></table>`;
    content.innerHTML = html;
}

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
        return RED_NUMS.includes(num) ? 'rt-red' : 'rt-black';
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

    if (currentInputLayout === 'grid') {
        gridWrapper.className = "hidden md:block w-[240px] shrink-0 mesmer-grid p-3 overflow-y-auto custom-scroll";
        gridWrapper.innerHTML = '<div class="grid grid-cols-3 gap-2 pb-10"></div>';

        const grid = gridWrapper.firstElementChild;
        grid.innerHTML = '<button class="grid-btn grid-green col-span-3 py-4 shadow-sm h-12 flex items-center justify-center" onclick="handleGridClick(0)">0</button>';

        for (let i = 1; i <= 36; i++) {
            let btn = document.createElement('button');
            const isRed = RED_NUMS.includes(i);
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

function syncPerimeterRuleState() {
    perimeterRuleEnabled = patternConfig[PERIMETER_RULE_KEY] !== false;
    patternConfig[PERIMETER_RULE_KEY] = perimeterRuleEnabled;
}

function updatePredictionSettingsUI() {
    const windowLabel = document.getElementById('perimeterWindowValue');
    if (windowLabel) {
        windowLabel.innerText = `${predictionPerimeterWindow} Spins`;
    }
}

function updatePerimeterAnalytics() {
    const stats = calculatePerimeterStats(history, predictionPerimeterWindow);

    const titleEl = document.getElementById('fonTrackerWindowLabel');
    if (titleEl) {
        titleEl.innerText = `FON Combo Tracker (${stats.windowSize} Spins)`;
    }

    const sequenceDisplay = document.getElementById('fonSequenceDisplay');
    if (sequenceDisplay) {
        if (!stats.sequence || stats.sequence.length === 0) {
            sequenceDisplay.innerHTML = '<span class="italic text-white/10">Awaiting data...</span>';
        } else {
            sequenceDisplay.innerHTML = stats.sequence.join(' <i class="fas fa-arrow-right text-[6px] text-white/20 mx-1"></i> ');
        }
    }

    const c52 = document.getElementById('combo-52');
    const c53 = document.getElementById('combo-53');
    const c13 = document.getElementById('combo-13');
    const c24 = document.getElementById('combo-24');
    if (c52) c52.innerText = stats.counts['5-2'];
    if (c53) c53.innerText = stats.counts['5-3'];
    if (c13) c13.innerText = stats.counts['1-3'];
    if (c24) c24.innerText = stats.counts['2-4'];
}

function calculatePerimeterStats(history, windowSize = 14) {
    if (typeof PredictionEngine !== 'undefined' && typeof PredictionEngine.calculatePerimeterStats === 'function') {
        return PredictionEngine.calculatePerimeterStats(history, windowSize);
    }

    const safeWindow = Math.max(2, Math.min(60, windowSize));
    const recentSpins = history.slice(-safeWindow);
    const transitionCount = Math.max(0, recentSpins.length - 1);

    let counts = { '5-2': 0, '5-3': 0, '1-3': 0, '2-4': 0 };

    for (let i = 1; i < recentSpins.length; i++) {
        const prevSpin = recentSpins[i - 1];
        const currSpin = recentSpins[i];
        if (!prevSpin || !currSpin || !prevSpin.faces || !currSpin.faces) continue;

        PERIMETER_COMBOS.forEach(combo => {
            const matched = (prevSpin.faces.includes(combo.a) && currSpin.faces.includes(combo.b)) ||
                (prevSpin.faces.includes(combo.b) && currSpin.faces.includes(combo.a));
            if (matched) counts[combo.label]++;
        });
    }

    let dominantCombo = null;
    let highestCount = -1;
    PERIMETER_COMBOS.forEach(combo => {
        const count = counts[combo.label] || 0;
        if (count > highestCount) {
            highestCount = count;
            dominantCombo = combo;
        }
    });

    if (highestCount <= 0) dominantCombo = null;

    return {
        windowSize: safeWindow,
        transitionCount: transitionCount,
        sequence: recentSpins.map(s => (s.faces && s.faces.length > 0 ? s.faces[0] : '?')),
        counts: counts,
        dominantCombo: dominantCombo
    };
}

function adjustPredictionPerimeterWindow(delta) {
    const parsedDelta = parseInt(delta, 10);
    if (Number.isNaN(parsedDelta) || parsedDelta === 0) return;

    const nextWindow = Math.max(2, Math.min(60, predictionPerimeterWindow + parsedDelta));
    if (nextWindow === predictionPerimeterWindow) return;

    predictionPerimeterWindow = nextWindow;
    updatePredictionSettingsUI();
    scanAllStrategies();
    updateVisibility();
    updatePerimeterAnalytics();
    updateAnalyticsHUD();
}

function setPerimeterWindow(val) {
    const nextWindow = parseInt(val, 10);
    if (isNaN(nextWindow) || nextWindow < 2 || nextWindow > 60) return;
    if (nextWindow === predictionPerimeterWindow) return;

    predictionPerimeterWindow = nextWindow;
    
    updatePredictionSettingsUI();
    scanAllStrategies();
    updateVisibility();
    updatePerimeterAnalytics();
    updateAnalyticsHUD();
}

function renderFilterMenu() {
    const list = document.getElementById('patternsList');
    list.innerHTML = '';

    // Define display labels for keys
    const labels = {
        [PERIMETER_RULE_KEY]: 'Perimeter Rule'
    };

    for (let key in patternConfig) {
        let isChecked = patternConfig[key];
        let label = labels[key] || key;

        let item = document.createElement('div');
        item.className = "flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5 transition-colors hover:bg-white/10";
        item.innerHTML = `
                <span class="text-gray-200 font-semibold text-xs tracking-wide">${label}</span>
                <label class="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" class="sr-only peer" ${isChecked ? 'checked' : ''} onchange="togglePatternFilter('${key}', this.checked)">
                    <div class="w-10 h-6 bg-black/40 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#30D158] shadow-inner"></div>
                </label>
            `;
        list.appendChild(item);
    }
}

function togglePatternFilter(key, isChecked) {
    patternConfig[key] = isChecked;
    if (key === PERIMETER_RULE_KEY) {
        perimeterRuleEnabled = isChecked;
    }
    scanAllStrategies();
    updateVisibility();
    updatePerimeterAnalytics();
    updateAnalyticsHUD();
}

function updateVisibility() {
    // 1. Re-render Dashboard (Cards)
    renderDashboard(window.currentAlerts || []);

    // 2. Re-render History Table (Rows)
    reRenderHistory();

    // 3. Update Analytics if visible
    if (!document.getElementById('analyticsModal').classList.contains('hidden') && currentAnalyticsTab === 'player') {
        renderAnalytics();
    }
}

function reRenderHistory() {
    const tbody = document.getElementById('historyBody');
    tbody.innerHTML = '';
    history.forEach(spin => renderRow(spin));
    requestAnimationFrame(layoutAllComboBridges);
}

function handleGridClick(n) {
    document.getElementById('spinInput').value = n;
    addSpin();
}

function playNotificationSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(500, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

        osc.start();
        osc.stop(ctx.currentTime + 0.3);
    } catch (e) {
        console.warn("Audio play failed (interaction required)", e);
    }
}

function addSpin() {
    const input = document.getElementById('spinInput');
    const val = parseInt(input.value);
    if (isNaN(val) || val < 0 || val > 36) return;

    // Animate the Plus Icon on Add
    const btn = document.getElementById('addSpinBtn');
    if (btn) {
        const icon = btn.querySelector('.fa-plus');
        if (icon) {
            icon.classList.remove('animate-spin-pop');
            void icon.offsetWidth; // Force reflow
            icon.classList.add('animate-spin-pop');
        }
    }

    // NEW: Detect all matching faces
    let matchedFaces = [];
    for (let f in FACES) {
        if (FACES[f].nums.includes(val)) matchedFaces.push(parseInt(f));
    }

    // Update Gaps for ALL matching faces
    for (let f = 1; f <= 5; f++) faceGaps[f]++;
    matchedFaces.forEach(f => faceGaps[f] = 0);
    renderGapStats();

    const currentSpinIndex = history.length;

    // 1. RESOLVE PREVIOUS BETS
    // We calculate results here and store them as raw data, NOT HTML
    let resolvedBets = [];

    if (activeBets.length > 0) {
        activeBets.forEach(bet => {
            // Check if the bet target is in the matched faces (Overlapping Support)
            let isWin = matchedFaces.includes(bet.targetFace);
            let label = `BET F${bet.targetFace}`;

            let count = 0;
            if (FACES[bet.targetFace]) {
                count = FACES[bet.targetFace].nums.length;
            }

            let unitChange = isWin ? (35 - count) : -count;

            let statsName = bet.patternName;
            let stratKey = bet.filterKey || bet.patternName;

            // Update Engine Stats
            updateEngineStats(isWin, statsName, unitChange, bet.strategy, bet.patternName, currentSpinIndex, val);

            if (bet.confirmed) {
                updateUserStats(isWin, bet, currentSpinIndex, unitChange);
            }

            // Store Data Object
            resolvedBets.push({
                patternName: bet.patternName, // Display Name
                filterKey: stratKey,          // Key for patternConfig
                targetFace: bet.targetFace,
                isWin: isWin,
                label: label
            });
        });
        activeBets = [];
    }

    // 2. ADD TO HISTORY
    const spinObj = {
        num: val,
        faces: matchedFaces, // Store array of matching faces
        index: currentSpinIndex,
        resolvedBets: resolvedBets, // Store results
        newSignals: [],             // Placeholder for signals generated this turn
        id: Date.now() + Math.random()
    };
    history.push(spinObj);

    // 3. SCAN FOR NEW PATTERNS
    const alerts = scanAllStrategies();

    // Check Audio on unfiltered alerts (or filtered? usually audio triggers on ANY detection)
    // Let's trigger audio if ANY active alert exists, visibility handles the rest
    if (alerts.some(a => a.type === 'ACTIVE')) {
        playNotificationSound();
    }

    // 4. PREPARE NEW SIGNALS FOR DISPLAY (Next Spin's Bets)
    // These are what show up on the dashboard, but we also want to show them in the table row
    if (activeBets.length > 0) {
        spinObj.newSignals = activeBets.map(b => ({
            patternName: b.patternName,
            filterKey: b.filterKey || b.patternName,
            targetFace: b.targetFace
        }));
    }

    renderRow(spinObj);
    renderDashboard(alerts);

    if (!document.getElementById('analyticsModal').classList.contains('hidden')) renderAnalytics();
    if (!document.getElementById('betsModal').classList.contains('hidden')) renderUserAnalytics();

    // Update FON tracker in Patterns modal
    updatePerimeterAnalytics();
    updateAnalyticsHUD();

    refreshHighlights();

    input.value = '';
    input.focus();
}

function updateEngineStats(isWin, patternName, unitChange, rawStrategy, rawPattern, spinIndex, spinNum) {
    if (isWin) {
        engineStats.totalWins++;
        engineStats.currentStreak = engineStats.currentStreak >= 0 ? engineStats.currentStreak + 1 : 1;
    } else {
        engineStats.totalLosses++;
        engineStats.currentStreak = engineStats.currentStreak <= 0 ? engineStats.currentStreak - 1 : -1;
    }
    engineStats.netUnits += unitChange;
    engineStats.bankrollHistory.push(engineStats.netUnits);

    if (!engineStats.patternStats[patternName]) {
        engineStats.patternStats[patternName] = { wins: 0, losses: 0 };
    }
    if (isWin) engineStats.patternStats[patternName].wins++;
    else engineStats.patternStats[patternName].losses++;

    engineStats.signalLog.push({
        result: isWin ? 'WIN' : 'LOSS',
        units: unitChange,
        patternName: patternName,
        rawStrategy: rawStrategy,
        rawPattern: rawPattern,
        spinIndex: spinIndex,
        spinNum: spinNum
    });
}

function checkFatigue(patternName) {
    const currentSpin = history.length;
    const windowStart = Math.max(0, currentSpin - 50);

    const recentSignals = engineStats.signalLog.filter(s =>
        s.patternName === patternName && s.spinIndex >= windowStart
    );

    if (recentSignals.length < 3) return false;

    const wins = recentSignals.filter(s => s.result === 'WIN').length;
    const hitRate = wins / recentSignals.length;

    return (hitRate < 0.20);
}

function updateUserStats(isWin, bet, spinIndex, unitChange) {
    if (isWin) {
        userStats.totalWins++;
    } else {
        userStats.totalLosses++;
    }
    userStats.netUnits += unitChange;
    userStats.bankrollHistory.push(userStats.netUnits);

    userStats.betLog.unshift({
        id: userStats.totalWins + userStats.totalLosses,
        pattern: bet.patternName,
        target: `F${bet.targetFace}`,
        result: isWin ? 'WIN' : 'LOSS',
        spinNum: spinIndex + 1,
        units: unitChange
    });
}

function renderAnalytics() {
    let displayStats = {
        wins: 0, losses: 0, net: 0, streak: 0,
        history: [0], patterns: {}
    };

    if (currentAnalyticsTab === 'god') {
        displayStats.wins = engineStats.totalWins;
        displayStats.losses = engineStats.totalLosses;
        displayStats.net = engineStats.netUnits;
        displayStats.streak = engineStats.currentStreak;
        displayStats.history = engineStats.bankrollHistory;
        displayStats.patterns = engineStats.patternStats;

        document.getElementById('graphTitle').innerText = 'Theoretical Bankroll (All Strategies)';
        document.getElementById('labelHitRate').innerText = 'Global Hit Rate';
        document.getElementById('labelNet').innerText = 'Theoretical Net';
        document.getElementById('simFilterBtn').classList.add('hidden'); // Hide Sim button

    } else {
        document.getElementById('graphTitle').innerText = 'Filtered Bankroll (Active Filters Only)';
        document.getElementById('labelHitRate').innerText = 'Filtered Hit Rate';
        document.getElementById('labelNet').innerText = 'Filtered Net';
        document.getElementById('simFilterBtn').classList.remove('hidden'); // Show Sim button

        engineStats.signalLog.forEach(log => {
            let isEnabled = true;

            if (isEnabled) {
                if (log.result === 'WIN') {
                    displayStats.wins++;
                    displayStats.streak = displayStats.streak >= 0 ? displayStats.streak + 1 : 1;
                } else {
                    displayStats.losses++;
                    displayStats.streak = displayStats.streak <= 0 ? displayStats.streak - 1 : -1;
                }
                displayStats.net += log.units;
                displayStats.history.push(displayStats.net);

                if (!displayStats.patterns[log.patternName]) {
                    displayStats.patterns[log.patternName] = { wins: 0, losses: 0 };
                }
                if (log.result === 'WIN') displayStats.patterns[log.patternName].wins++;
                else displayStats.patterns[log.patternName].losses++;
            }
        });
    }

    const totalSignals = displayStats.wins + displayStats.losses;
    const hitRate = totalSignals === 0 ? 0 : Math.round((displayStats.wins / totalSignals) * 100);

    const hrEl = document.getElementById('kpiHitRate');
    hrEl.innerText = hitRate + "%";
    hrEl.className = `text-3xl font-bold tracking-tight ${hitRate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;

    const netEl = document.getElementById('kpiNet');
    netEl.innerText = (displayStats.net > 0 ? '+' : '') + displayStats.net;
    netEl.className = `text-3xl font-bold tracking-tight ${displayStats.net >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;

    document.getElementById('kpiSignals').innerText = totalSignals;

    const s = displayStats.streak;
    const formEl = document.getElementById('kpiForm');
    formEl.innerText = s > 0 ? `W${s}` : (s < 0 ? `L${Math.abs(s)}` : '-');
    formEl.className = `text-3xl font-bold tracking-tight ${s > 0 ? 'text-[#30D158]' : (s < 0 ? 'text-[#FF453A]' : 'text-gray-400')}`;

    drawAdvancedGraph(displayStats.history, displayStats.wins, displayStats.losses, 'graphContainer');
    updatePatternHeatmap(displayStats.patterns);
}

function switchAnalyticsTab(tab) {
    currentAnalyticsTab = tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(tab === 'god' ? 'tabGod' : 'tabPlayer').classList.add('active');

    if (tab === 'player') {
        // Sync simulation config with global pattern config when switching to player view
        simulationConfig = JSON.parse(JSON.stringify(patternConfig));
        renderSimFilterMenu();
    }

    // Hide menu if open
    document.getElementById('simFilterMenu').classList.add('hidden');

    renderAnalytics();
}

function toggleSimMenu() {
    document.getElementById('simFilterMenu').classList.toggle('hidden');
}

function renderSimFilterMenu() {
    const container = document.getElementById('simFilterList');
    container.innerHTML = '';

    const labels = {};

    for (let key in simulationConfig) {
        let isChecked = simulationConfig[key];
        let label = labels[key] || key;

        let item = document.createElement('div');
        item.className = "flex items-center justify-between px-3 py-2 hover:bg-white/10 rounded-lg cursor-pointer transition-colors";
        item.onclick = (e) => {
            e.stopPropagation();
            toggleSimFilter(key);
        };

        item.innerHTML = `
                <span class="text-xs text-gray-300 font-medium">${label}</span>
                <div class="w-4 h-4 rounded flex items-center justify-center border ${isChecked ? 'bg-[#30D158] border-[#30D158]' : 'border-gray-600 bg-black/20'}">
                    ${isChecked ? '<i class="fas fa-check text-[10px] text-black"></i>' : ''}
                </div>
            `;
        container.appendChild(item);
    }
}

function toggleSimFilter(key) {
    simulationConfig[key] = !simulationConfig[key];
    renderSimFilterMenu();
    renderAnalytics();
}

function renderGapStats() {
    const container = document.getElementById('faceGapContainer');
    if (!container) return;

    container.innerHTML = '';
    for (let f = 1; f <= 5; f++) {
        const gap = faceGaps[f];
        let colorClass = 'text-[#30D158]';
        if (gap > 10) colorClass = 'text-[#FFD60A]';
        if (gap > 15) colorClass = 'text-[#FF453A]';

        container.innerHTML += `
                <div class="text-center p-2 rounded-xl bg-white/5 border border-white/5 shadow-sm backdrop-blur-sm transition-all hover:bg-white/10">
                    <span class="block text-gray-400 text-[9px] font-bold mb-0.5 uppercase tracking-wider">F${f}</span>
                    <span class="${colorClass} font-bold text-xl drop-shadow-sm">${gap}</span>
                </div>
            `;
    }
}

function renderUserAnalytics() {
    const totalBets = userStats.totalWins + userStats.totalLosses;
    const hitRate = totalBets === 0 ? 0 : Math.round((userStats.totalWins / totalBets) * 100);

    const netEl = document.getElementById('userNet');
    netEl.innerText = (userStats.netUnits > 0 ? '+' : '') + userStats.netUnits;
    netEl.className = `text-5xl font-bold tracking-tight ${userStats.netUnits >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}`;

    document.getElementById('userHitRate').innerText = hitRate + "%";
    document.getElementById('userTotal').innerText = totalBets;

    drawAdvancedGraph(userStats.bankrollHistory, userStats.totalWins, userStats.totalLosses, 'userGraphContainer');
    updateUserBetLog();
}

// --- ADVANCED GRAPHING ---
function drawAdvancedGraph(historyArray, winCount, lossCount, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    container.className = "flex flex-col h-full w-full rounded-b-xl overflow-hidden";

    const chartDiv = document.createElement('div');
    chartDiv.className = "relative h-[80%] w-full bg-black/20";
    container.appendChild(chartDiv);

    // HUD
    const hudDiv = document.createElement('div');
    hudDiv.className = "h-[20%] w-full flex justify-between items-center px-4 text-[10px] font-bold bg-white/5 border-t border-white/5 backdrop-blur-sm";
    hudDiv.innerHTML = `
            <span class="text-[#4ade80] drop-shadow-sm tracking-wide">WINS: ${winCount}</span>
            <span class="text-[#e5e7eb] drop-shadow-sm tracking-wide">SPINS: ${historyArray ? Math.max(0, historyArray.length - 1) : 0}</span>
            <span class="text-[#f87171] drop-shadow-sm tracking-wide">LOSSES: ${lossCount}</span>
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

    let pathD = `M ${getX(0)} ${getY(historyArray[0])}`;
    for (let i = 1; i < historyArray.length; i++) {
        pathD += ` L ${getX(i)} ${getY(historyArray[i])}`;
    }

    const zeroY = getY(0);

    let zeroOffset = 0;
    if (maxVal > 0 && minVal < 0) {
        zeroOffset = (maxVal / range) * 100;
    } else if (minVal >= 0) {
        zeroOffset = 100;
    } else {
        zeroOffset = 0;
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

function updatePatternHeatmap(patternData) {
    const tbody = document.getElementById('heatmapBody');
    tbody.innerHTML = '';
    const patterns = Object.entries(patternData || {});

    if (patterns.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No patterns recorded yet</td></tr>';
        return;
    }

    patterns.sort((a, b) => {
        const rA = a[1].wins / (a[1].wins + a[1].losses);
        const rB = b[1].wins / (b[1].wins + b[1].losses);
        return rB - rA;
    });

    patterns.forEach(([name, s]) => {
        const total = s.wins + s.losses;
        const rate = total === 0 ? 0 : Math.round((s.wins / total) * 100);
        const color = rate >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]';
        const bar = rate >= 50 ? 'bg-[#30D158]' : 'bg-[#FF453A]';

        tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors">
                    <td class="p-3 font-semibold text-gray-200">
                        <div class="flex items-center justify-between">
                            <span class="tracking-wide">${name}</span>
                            <button onclick="event.stopPropagation(); openPatternLog('${name}')" class="text-[#8E8E93] hover:text-white cursor-pointer px-2 py-1 rounded-full hover:bg-white/10 transition-colors" title="View Log">
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

function openPatternLog(patternName) {
    const logs = engineStats.signalLog.filter(s => s.patternName === patternName);
    logs.sort((a, b) => a.spinIndex - b.spinIndex);

    let runningROI = 0;
    let lastIndex = -1;

    let displayLogs = logs.map((log, i) => {
        runningROI += log.units;
        let gap = (i === 0) ? 0 : (log.spinIndex - lastIndex);
        lastIndex = log.spinIndex;
        return { ...log, gap, roi: runningROI };
    });

    displayLogs.sort((a, b) => b.spinIndex - a.spinIndex);

    const tbody = document.getElementById('patternDetailBody');
    tbody.innerHTML = '';

    if (displayLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="p-8 text-center text-[#8E8E93] italic">No signals recorded yet</td></tr>';
    } else {
        displayLogs.forEach(log => {
            let badgeClass = '';
            if (log.spinNum === 0) badgeClass = 'bg-[#30d158]/20 text-[#30d158] border-[#30d158]/30';
            else if (RED_NUMS.includes(log.spinNum)) badgeClass = 'bg-[#ff453a]/20 text-[#ff453a] border-[#ff453a]/30';
            else badgeClass = 'bg-[#3a3a3c] text-gray-200 border-white/10';

            const isWin = log.result === 'WIN';
            const resClass = isWin ? 'text-[#30D158]' : 'text-[#FF453A]';
            const unitClass = log.units > 0 ? 'text-[#30D158]' : 'text-[#FF453A]';
            const roiClass = log.roi >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]';
            const unitSign = log.units > 0 ? '+' : '';
            const roiSign = log.roi > 0 ? '+' : '';

            tbody.innerHTML += `
                    <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 text-xs">
                        <td class="p-3 text-[#8E8E93] font-mono">#${log.spinIndex + 1}</td>
                        <td class="p-3 text-center">
                            <span class="inline-block w-8 h-6 flex items-center justify-center rounded-md border ${badgeClass} font-bold mx-auto border-opacity-50">
                                ${log.spinNum}
                            </span>
                        </td>
                        <td class="p-3 text-center text-gray-400 font-mono">${log.gap}</td>
                        <td class="p-3 text-center font-bold ${resClass}">${log.result}</td>
                        <td class="p-3 text-right font-mono font-bold ${unitClass}">${unitSign}${log.units}</td>
                        <td class="p-3 text-right font-mono font-bold ${roiClass}">${roiSign}${log.roi}</td>
                    </tr>
                `;
        });
    }

    document.getElementById('patternDetailTitle').innerText = `LOG: ${patternName}`;
    const modal = document.getElementById('patternDetailModal');
    modal.classList.remove('hidden');
}

function updateUserBetLog() {
    const tbody = document.getElementById('userBetsBody');
    tbody.innerHTML = '';

    if (userStats.betLog.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No confirmed bets yet</td></tr>';
        return;
    }

    userStats.betLog.forEach(log => {
        const resClass = log.result === 'WIN' ? 'text-[#30D158]' : 'text-[#FF453A]';
        const unitsText = log.units > 0 ? `+${log.units}` : log.units;
        tbody.innerHTML += `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <td class="p-3 text-[#8E8E93] font-mono text-xs">#${log.id}</td>
                    <td class="p-3 font-bold text-gray-200 tracking-wide">${log.pattern}</td>
                    <td class="p-3 text-center font-bold text-white"><span class="bg-white/10 px-2 py-0.5 rounded-md border border-white/10 shadow-sm text-xs">F${log.target.replace('F', '')}</span></td>
                    <td class="p-3 text-right">
                        <span class="text-[9px] text-[#8E8E93] mr-2">Spin ${log.spinNum}</span>
                        <span class="font-bold ${resClass} text-sm drop-shadow-sm">${log.result} (${unitsText})</span>
                    </td>
                </tr>
            `;
    });
}

function toggleBetConfirmation(index) {
    if (activeBets[index]) {
        activeBets[index].confirmed = !activeBets[index].confirmed;
        renderDashboard(window.currentAlerts || []);
    }
}

function calculateDominantPerimeterCombo() {
    const stats = calculatePerimeterStats(history, predictionPerimeterWindow);
    if (!stats || !stats.dominantCombo) return null;

    const dominantCount = stats.counts[stats.dominantCombo.label] || 0;
    if (dominantCount <= 0) return null;

    return {
        ...stats.dominantCombo,
        count: dominantCount,
        counts: stats.counts,
        latestPrimaryFace: stats.sequence.length > 0 ? stats.sequence[stats.sequence.length - 1] : null
    };
}

function scanAllStrategies() {
    let allNotifications = [];
    let allNextBets = [];

    if (perimeterRuleEnabled) {
        const dominantCombo = calculateDominantPerimeterCombo();
        if (dominantCombo && dominantCombo.latestPrimaryFace) {
            let triggerFace = null;
            if (dominantCombo.latestPrimaryFace === dominantCombo.a) triggerFace = dominantCombo.a;
            else if (dominantCombo.latestPrimaryFace === dominantCombo.b) triggerFace = dominantCombo.b;

            if (triggerFace !== null) {
                const partnerFace = triggerFace === dominantCombo.a ? dominantCombo.b : dominantCombo.a;

                allNextBets.push({
                    patternName: PREDICTION_PERIMETER_PATTERN,
                    filterKey: PERIMETER_RULE_KEY,
                    strategy: PREDICTION_PERIMETER_PATTERN,
                    targetFace: partnerFace,
                    triggerFace: triggerFace,
                    comboLabel: dominantCombo.label,
                    accentColor: dominantCombo.color,
                    confirmed: false
                });

                allNotifications.push({
                    type: 'ACTIVE',
                    patternName: PREDICTION_PERIMETER_PATTERN,
                    targetFace: partnerFace,
                    comboLabel: dominantCombo.label,
                    accentColor: dominantCombo.color
                });
            }
        }
    }

    activeBets = allNextBets;
    window.currentAlerts = allNotifications;
    return allNotifications;
}

function renderRow(spin) {
    const tbody = document.getElementById('historyBody');
    const tr = document.createElement('tr');
    tr.className = "history-row relative hover:bg-white/[0.02] transition-colors";
    tr.id = 'row-' + spin.id;

    let bgClass = spin.num === 0 ? 'bg-green' : (RED_NUMS.includes(spin.num) ? 'bg-red' : 'bg-black');

    let faceHTML = '';
    if (spin.faces && spin.faces.length > 0) {
        let faceTags = spin.faces.map(fId => {
            let fStyle = FACES[fId];
            return `<span class="face-tag mb-1 mr-1" data-spin-id="${spin.id}" data-face-id="${fId}" style="color:${fStyle.color}; border:1px solid ${fStyle.border}; background:${fStyle.bg};">F${fId}</span>`;
        }).join('');
        faceHTML = `<div class="flex flex-wrap justify-center">${faceTags}</div>`;
    } else {
        faceHTML = `<span class="text-gray-600">-</span>`;
    }

    // COMBO COLUMN LOGIC
    let comboHTML = `<span class="text-gray-600">-</span>`;
    if (spin.index > 0) {
        const prevSpin = history[spin.index - 1];
        if (prevSpin && prevSpin.faces && spin.faces) {
            let detectedCombo = null;
            let matchedPrevFace = null;
            let matchedCurrFace = null;
            const tracked = PERIMETER_COMBOS;

            for (let t of tracked) {
                let match = false;
                for (let pf of prevSpin.faces) {
                    for (let cf of spin.faces) {
                        if ((pf === t.a && cf === t.b) || (pf === t.b && cf === t.a)) {
                            match = true;
                            matchedPrevFace = pf;
                            matchedCurrFace = cf;
                            break;
                        }
                    }
                    if (match) break;
                }
                if (match) {
                    detectedCombo = t;
                    break;
                }
            }

            if (detectedCombo) {
                // VISUAL COMBO BRIDGE: dynamically laid out from tag positions
                comboHTML = `
                    <div class="absolute inset-x-0 top-0 -translate-y-1/2 h-0 pointer-events-none select-none z-[1] flex items-center justify-center">
                        <div class="combo-link-layer absolute overflow-visible"
                             data-prev-spin-id="${prevSpin.id}"
                             data-prev-face="${matchedPrevFace}"
                             data-curr-face="${matchedCurrFace}"
                             data-color="${detectedCombo.color}"></div>
                        <div class="relative z-[2] inline-flex items-center justify-center">
                            <div class="absolute inset-0 rounded-lg blur-md opacity-45" style="background-color: ${detectedCombo.color};"></div>
                            <span class="combo-badge relative px-3 py-1 rounded-md text-[11px] font-black border border-white/10 shadow-lg tracking-wider"
                                  style="color: ${detectedCombo.color}; background-color: #0c0c0e; box-shadow: 0 0 10px ${detectedCombo.color}30;">
                                ${detectedCombo.label}
                            </span>
                        </div>
                    </div>
                `;
            }
        }
    }

    let predHTMLParts = [];
    if (spin.resolvedBets && spin.resolvedBets.length > 0) {
        spin.resolvedBets.forEach(bet => {
            let win = bet.isWin;
            let icon = win ? '<i class="fas fa-check-circle text-[#30D158] mr-1"></i>' : '<i class="fas fa-times-circle text-[#FF453A] mr-1"></i>';
            let status = win ? 'WIN' : 'LOSS';
            let colorClass = win ? 'text-[#30D158]' : 'text-[#FF453A]';
            predHTMLParts.push(`<div class="flex items-center text-[10px] font-bold ${colorClass}">${icon}${status}: F${bet.targetFace} (${bet.patternName})</div>`);
        });
    }

    if (spin.newSignals && spin.newSignals.length > 0) {
        spin.newSignals.forEach(sig => {
            if (patternConfig[sig.filterKey]) {
                predHTMLParts.push(`<div class="text-[10px] font-bold text-[#F5F5F7]/40">Active Signal: ${sig.patternName}</div>`);
            }
        });
    }

    let finalHTML = predHTMLParts.length > 0 ? predHTMLParts.join('') : '<span class="text-gray-600">-</span>';

    tr.innerHTML = `
        <td class="text-center font-mono text-xs text-gray-400">#${spin.index + 1}</td>
        <td class="text-center"><div class="num-box ${bgClass}">${spin.num}</div></td>
        <td class="text-center relative z-[5]">${faceHTML}</td>
        <td class="text-center relative overflow-visible z-[1]">${comboHTML}</td>
        <td class="pl-4">${finalHTML}</td>
    `;
    tbody.appendChild(tr);
    requestAnimationFrame(() => layoutComboBridge(spin.id));

    // Auto-scroll to bottom of the correct container
    const sc = document.querySelector('#scrollContainer > div');
    if (sc) {
        setTimeout(() => {
            sc.scrollTop = sc.scrollHeight;
        }, 50);
    }
}

function layoutComboBridge(spinId) {
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
        x: prevRect.right - cellRect.left + 2,
        y: prevRect.top + prevRect.height / 2 - cellRect.top
    };
    const currPoint = {
        x: currRect.right - cellRect.left + 2,
        y: currRect.top + currRect.height / 2 - cellRect.top
    };
    const targetPoint = {
        x: badgeRect.left - cellRect.left + 4,
        y: badgeRect.top + badgeRect.height / 2 - cellRect.top
    };

    const nextGeom = {
        p1: prevPoint,
        p2: currPoint,
        t: targetPoint,
        color: color
    };

    const prevGeom = layer._comboGeom || {
        p1: { ...targetPoint },
        p2: { ...targetPoint },
        t: { ...targetPoint },
        color: color
    };

    animateComboBridge(layer, prevGeom, nextGeom, 260);
    layer._comboGeom = nextGeom;
}

function layoutAllComboBridges() {
    history.forEach(spin => layoutComboBridge(spin.id));
}

function ensureComboBridgeElements(layer) {
    let svg = layer.querySelector('svg');
    if (!svg) {
        layer.innerHTML = `
            <svg class="overflow-visible">
                <path class="combo-path-1" fill="none" stroke-linecap="round" stroke-width="2.5" stroke-opacity="0.85" />
                <path class="combo-path-2" fill="none" stroke-linecap="round" stroke-width="2.5" stroke-opacity="0.85" />
                <circle class="combo-dot" r="2.5" />
            </svg>
        `;
        svg = layer.querySelector('svg');
    }

    return {
        svg,
        path1: layer.querySelector('.combo-path-1'),
        path2: layer.querySelector('.combo-path-2'),
        dot: layer.querySelector('.combo-dot')
    };
}

function drawComboBridge(layer, geom) {
    const { svg, path1, path2, dot } = ensureComboBridgeElements(layer);

    const minX = Math.min(geom.p1.x, geom.p2.x, geom.t.x) - 10;
    const maxX = Math.max(geom.p1.x, geom.p2.x, geom.t.x) + 6;
    const minY = Math.min(geom.p1.y, geom.p2.y, geom.t.y) - 12;
    const maxY = Math.max(geom.p1.y, geom.p2.y, geom.t.y) + 12;

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
    const t = { x: geom.t.x - minX, y: geom.t.y - minY };

    const c1x = p1.x + Math.max(12, Math.abs(t.x - p1.x) * 0.45);
    const c2x = p2.x + Math.max(12, Math.abs(t.x - p2.x) * 0.45);
    const cx = t.x - Math.max(10, Math.min(20, Math.abs(t.x - Math.min(p1.x, p2.x)) * 0.2));

    path1.setAttribute('d', `M ${p1.x} ${p1.y} C ${c1x} ${p1.y}, ${cx} ${t.y}, ${t.x} ${t.y}`);
    path2.setAttribute('d', `M ${p2.x} ${p2.y} C ${c2x} ${p2.y}, ${cx} ${t.y}, ${t.x} ${t.y}`);
    path1.setAttribute('stroke', geom.color);
    path2.setAttribute('stroke', geom.color);

    dot.setAttribute('cx', t.x);
    dot.setAttribute('cy', t.y);
    dot.setAttribute('fill', geom.color);
}

function animateComboBridge(layer, fromGeom, toGeom, duration = 260) {
    if (layer._comboAnimFrame) {
        cancelAnimationFrame(layer._comboAnimFrame);
    }

    const startTime = performance.now();

    const easeInOutCubic = (x) => x < 0.5
        ? 4 * x * x * x
        : 1 - Math.pow(-2 * x + 2, 3) / 2;

    const lerp = (a, b, t) => a + (b - a) * t;

    const tick = (now) => {
        const raw = Math.min(1, (now - startTime) / duration);
        const t = easeInOutCubic(raw);

        const geom = {
            p1: {
                x: lerp(fromGeom.p1.x, toGeom.p1.x, t),
                y: lerp(fromGeom.p1.y, toGeom.p1.y, t)
            },
            p2: {
                x: lerp(fromGeom.p2.x, toGeom.p2.x, t),
                y: lerp(fromGeom.p2.y, toGeom.p2.y, t)
            },
            t: {
                x: lerp(fromGeom.t.x, toGeom.t.x, t),
                y: lerp(fromGeom.t.y, toGeom.t.y, t)
            },
            color: toGeom.color
        };

        drawComboBridge(layer, geom);

        if (raw < 1) {
            layer._comboAnimFrame = requestAnimationFrame(tick);
        } else {
            layer._comboAnimFrame = null;
            layer._comboGeom = toGeom;
        }
    };

    layer._comboAnimFrame = requestAnimationFrame(tick);
}

function renderDashboard(alerts) {
    const dash = document.getElementById('dashboard');
    if (!dash) return;

    let cards = [];
    activeBets.forEach((bet, index) => {
        const filterKey = bet.filterKey || bet.patternName;
        if (patternConfig[filterKey] === false) return;

        const subtitle = bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName;
        const accent = bet.accentColor || '#FF3B30';
        cards.push(`
            <div class="min-w-[250px] h-[64px] px-3 py-2 rounded-lg border bg-[#0f0f12] flex items-center justify-between cursor-pointer select-none"
                 ondblclick="toggleBetConfirmation(${index})"
                 title="Double-click to ${bet.confirmed ? 'unselect' : 'select'}"
                 style="border-left: 3px solid ${accent}; border-color: ${bet.confirmed ? accent : 'rgba(255,255,255,0.1)'}; background: ${bet.confirmed ? 'rgba(255,255,255,0.06)' : '#0f0f12'};">
                <div class="min-w-0">
                    <div class="text-[15px] leading-tight font-black text-white tracking-wide">BET F${bet.targetFace}</div>
                    <div class="text-[11px] leading-tight text-white/75 font-semibold">${subtitle}</div>
                </div>
            </div>
        `);
    });

    if (cards.length === 0) {
        dash.innerHTML = `<div class="dashboard-empty w-full text-center text-[10px] font-medium text-[#8E8E93]/60 border border-dashed border-white/5 rounded-xl p-2 select-none tracking-wide flex items-center justify-center h-[60px]"><span>SCANNING...</span></div>`;
        return;
    }

    dash.innerHTML = cards.join('');
}

function refreshHighlights() {
    document.querySelectorAll('.highlight-pair').forEach(el => el.classList.remove('highlight-pair'));
    if (activeBets.length > 0) {
        activeBets.forEach(bet => {
            if (bet.highlightIds) {
                bet.highlightIds.forEach(id => {
                    const tag = document.querySelector(`.face-tag[data-spin-id="${id}"]`);
                    if (tag) tag.classList.add('highlight-pair');
                });
            }
        });
    }
}

function resetData(skipConfirm = false) {
    if (skipConfirm || confirm("Reset all session data?")) {
        history = [];
        activeBets = [];
        window.currentAlerts = [];
        strategies = {};
        engineStats = {
            totalWins: 0, totalLosses: 0, netUnits: 0, currentStreak: 0,
            bankrollHistory: [0], patternStats: {}, signalLog: []
        };
        userStats = { totalWins: 0, totalLosses: 0, netUnits: 0, bankrollHistory: [0], betLog: [] };
        faceGaps = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        document.getElementById('historyBody').innerHTML = '';
        renderDashboard([]);
        renderAnalytics();
        renderUserAnalytics();
        renderGapStats();

        updatePredictionSettingsUI();
        updatePerimeterAnalytics();
        updateAnalyticsHUD();

        if (!skipConfirm) {
            const am = document.getElementById('analyticsModal');
            if (!am.classList.contains('hidden')) am.classList.add('hidden');
        }
    }
}

function undoSpin() {
    if (history.length === 0) return;
    let oldHist = [...history];
    oldHist.pop();

    resetData(true);
    oldHist.forEach(h => {
        document.getElementById('spinInput').value = h.num;
        addSpin();
    });

    updatePerimeterAnalytics();
    updateAnalyticsHUD();
}

function toggleModal(id) {
    document.getElementById(id).classList.toggle('hidden');
}

function exportSpins() {
    if (history.length === 0) {
        alert("No spins to export!");
        return;
    }
    const spins = history.map(h => h.num);
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
}

function importSpins(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const data = JSON.parse(e.target.result);
            if (Array.isArray(data.spins)) {
                resetData(true);
                const inputField = document.getElementById('spinInput');
                data.spins.forEach(num => {
                    inputField.value = num;
                    addSpin();
                });
                inputField.value = '';
                inputField.focus();
            } else {
                alert("Invalid file format: 'spins' array missing.");
            }
        } catch (err) {
            alert("Error reading file: " + err.message);
        }
    };
    reader.readAsText(file);
    input.value = '';
}

let stopwatchInterval = null;
let stopwatchSeconds = 0;

function formatStopwatchTime(totalSeconds) {
    let hrs = Math.floor(totalSeconds / 3600);
    let mins = Math.floor((totalSeconds % 3600) / 60);
    let secs = totalSeconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function updateStopwatchDisplay() {
    const display = document.getElementById('stopwatchDisplay');
    if (display) display.innerText = formatStopwatchTime(stopwatchSeconds);
}

function toggleStopwatch() {
    const icon = document.getElementById('stopwatchIcon');
    const text = document.getElementById('stopwatchText');
    const btn = document.getElementById('stopwatchToggleBtn');

    if (stopwatchInterval) {
        clearInterval(stopwatchInterval);
        stopwatchInterval = null;
        if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
        if (text) text.innerText = 'Start';
        if (btn) {
            btn.classList.remove('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30');
            btn.classList.add('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30');
        }
    } else {
        stopwatchInterval = setInterval(() => { stopwatchSeconds++; updateStopwatchDisplay(); }, 1000);
        if (icon) { icon.classList.remove('fa-play'); icon.classList.add('fa-pause'); }
        if (text) text.innerText = 'Pause';
        if (btn) {
            btn.classList.remove('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30');
            btn.classList.add('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30');
        }
    }
}

function resetStopwatch() {
    if (stopwatchInterval) { clearInterval(stopwatchInterval); stopwatchInterval = null; }
    stopwatchSeconds = 0;
    updateStopwatchDisplay();
    const icon = document.getElementById('stopwatchIcon');
    const text = document.getElementById('stopwatchText');
    const btn = document.getElementById('stopwatchToggleBtn');
    if (icon) { icon.classList.remove('fa-pause'); icon.classList.add('fa-play'); }
    if (text) text.innerText = 'Start';
    if (btn) {
        btn.classList.remove('bg-[#FFD60A]/20', 'text-[#FFD60A]', 'border-[#FFD60A]/30');
        btn.classList.add('bg-[#30D158]/20', 'text-[#30D158]', 'border-[#30D158]/30');
    }
}
