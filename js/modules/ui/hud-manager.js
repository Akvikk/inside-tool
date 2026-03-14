/**
 * HUD MANAGER MODULE (hud-manager.js)
 * Handles all logic for the floating Analytics HUD.
 */

(function () {
    // --- PRIVATE STATE ---
    let isHudColdMode = false;
    let hudHistoryScope = 'all';
    const HUD_RECENT_WINDOW = 14;

    // --- PUBLIC INTERFACE ---
    window.HudManager = {
        init: initAnalyticsHUD,
        toggle: toggleAnalyticsHUD,
        update: updateAnalyticsHUD,
        toggleColdMode: toggleHudColdMode,
        toggleScope: toggleHudHistoryScope,
        fit: fitAnalyticsHUD,
        getIsColdMode: () => isHudColdMode,
        getScope: () => hudHistoryScope
    };

    // Export to window for global access (backward compatibility for index.html)
    window.toggleAnalyticsHUD = toggleAnalyticsHUD;
    window.toggleHudColdMode = toggleHudColdMode;
    window.toggleHudHistoryScope = toggleHudHistoryScope;

    function fitAnalyticsHUD() {
        const hud = document.getElementById('analyticsHUD');
        const header = document.getElementById('hudHeader');
        const body = hud ? hud.querySelector('.flex-1.flex.flex-col.overflow-hidden.relative') : null;
        if (!hud || !header || !body || hud.classList.contains('hidden')) return;

        requestAnimationFrame(() => {
            const maxHeight = Math.max(180, window.innerHeight - hud.offsetTop - 8);
            const desiredHeight = Math.ceil(header.offsetHeight + body.scrollHeight);
            hud.style.height = `${Math.min(desiredHeight, maxHeight)}px`;
        });
    }

    function initAnalyticsHUD() {
        const hud = document.getElementById('analyticsHUD');
        const header = document.getElementById('hudHeader');
        const resizer = document.getElementById('hudResizeHandle');

        if (!hud || !header || !resizer) return;
        if (hud.dataset.initialized === 'true') return;
        hud.dataset.initialized = 'true';

        let interaction = null;
        let rafId = null;
        let pendingFrame = null;

        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

        function scheduleHUDFrame(nextValues) {
            pendingFrame = { ...(pendingFrame || {}), ...nextValues };
            if (rafId !== null) return;

            rafId = requestAnimationFrame(() => {
                if (!pendingFrame) {
                    rafId = null;
                    return;
                }

                if (typeof pendingFrame.left === 'number') {
                    hud.style.left = `${pendingFrame.left}px`;
                }
                if (typeof pendingFrame.top === 'number') {
                    hud.style.top = `${pendingFrame.top}px`;
                }
                if (typeof pendingFrame.width === 'number') {
                    hud.style.width = `${pendingFrame.width}px`;
                }
                if (typeof pendingFrame.height === 'number') {
                    hud.style.height = `${pendingFrame.height}px`;
                }

                pendingFrame = null;
                rafId = null;
            });
        }

        function startInteraction(type, e) {
            if (e.button !== undefined && e.button !== 0) return;
            if (type === 'drag' && e.target.closest('button')) return;
            if (e.cancelable) e.preventDefault();
            e.stopPropagation();

            // Convert from right-anchored initial position to left-anchored dragging.
            if (!hud.style.left || hud.style.left === 'auto') {
                hud.style.left = `${hud.offsetLeft}px`;
            }
            hud.style.right = 'auto';

            interaction = {
                type,
                pointerId: e.pointerId,
                startX: e.clientX,
                startY: e.clientY,
                startLeft: hud.offsetLeft,
                startTop: hud.offsetTop,
                startWidth: hud.offsetWidth,
                startHeight: hud.offsetHeight
            };

            hud.classList.add('hud-interacting');
            document.body.classList.add('hud-no-select');

            if (type === 'drag') {
                header.setPointerCapture?.(e.pointerId);
            } else {
                resizer.setPointerCapture?.(e.pointerId);
            }
        }

        function onPointerMove(e) {
            if (!interaction) return;
            if (interaction.pointerId !== undefined && e.pointerId !== undefined && interaction.pointerId !== e.pointerId) return;
            if (e.cancelable) e.preventDefault();

            const dx = e.clientX - interaction.startX;
            const dy = e.clientY - interaction.startY;

            if (interaction.type === 'drag') {
                const maxLeft = Math.max(8, window.innerWidth - hud.offsetWidth - 8);
                const maxTop = Math.max(8, window.innerHeight - hud.offsetHeight - 8);
                scheduleHUDFrame({
                    left: clamp(interaction.startLeft + dx, 8, maxLeft),
                    top: clamp(interaction.startTop + dy, 8, maxTop)
                });
                return;
            }

            const maxWidth = Math.max(192, window.innerWidth - interaction.startLeft - 8);
            scheduleHUDFrame({
                width: clamp(interaction.startWidth + dx, 192, maxWidth)
            });
        }

        function stopInteraction(e) {
            if (!interaction) return;
            if (interaction.pointerId !== undefined && e && e.pointerId !== undefined && interaction.pointerId !== e.pointerId) return;

            if (interaction.type === 'drag') {
                header.releasePointerCapture?.(interaction.pointerId);
            } else {
                resizer.releasePointerCapture?.(interaction.pointerId);
            }

            interaction = null;
            hud.classList.remove('hud-interacting');
            document.body.classList.remove('hud-no-select');
            fitAnalyticsHUD();
        }

        header.addEventListener('pointerdown', (e) => startInteraction('drag', e));
        resizer.addEventListener('pointerdown', (e) => startInteraction('resize', e));
        window.addEventListener('pointermove', onPointerMove, { passive: false });
        window.addEventListener('pointerup', stopInteraction);
        window.addEventListener('pointercancel', stopInteraction);
    }

    function toggleAnalyticsHUD() {
        const hud = document.getElementById('analyticsHUD');
        const btn = document.getElementById('hudToggleBtn');
        if (!hud || !btn) return;

        if (hud.classList.contains('hidden')) {
            hud.classList.remove('hidden');
            hud.classList.add('flex');
            btn.classList.add('bg-white/10', 'is-active');
            initAnalyticsHUD();
            updateAnalyticsHUD();
            fitAnalyticsHUD();
        } else {
            hud.classList.add('hidden');
            hud.classList.remove('flex');
            btn.classList.remove('bg-white/10', 'is-active');
        }
    }

    function toggleHudColdMode() {
        isHudColdMode = !isHudColdMode;
        const btn = document.getElementById('hudColdBtn');
        if (btn) {
            if (isHudColdMode) btn.classList.replace('text-gray-500', 'text-[#06b6d4]');
            else btn.classList.replace('text-[#06b6d4]', 'text-gray-500');
        }
        updateAnalyticsHUD();
    }

    function toggleHudHistoryScope() {
        hudHistoryScope = hudHistoryScope === 'all' ? 'recent' : 'all';
        updateAnalyticsHUD();
    }

    function getHudScopeSummary() {
        const history = window.state ? window.state.history : [];
        if (hudHistoryScope === 'recent') {
            return history.length > 0
                ? `Last ${Math.min(HUD_RECENT_WINDOW, history.length)} Spins`
                : `Last ${HUD_RECENT_WINDOW} Spins`;
        }
        return history.length > 0 ? `All ${history.length} Spins` : 'All History';
    }

    function updateAnalyticsHUD() {
        const hud = document.getElementById('analyticsHUD');
        if (!hud || hud.classList.contains('hidden')) return;

        const hudLabel = document.getElementById('hudWindowValue');
        const hudScopeBtn = document.getElementById('hudScopeBtn');

        const themeColor = isHudColdMode ? '#06b6d4' : '#30D158';

        if (hudLabel) {
            hudLabel.innerText = getHudScopeSummary();
            hudLabel.style.color = themeColor;
        }

        const history = window.state ? window.state.history : [];

        if (hudScopeBtn) {
            const isRecentScope = hudHistoryScope === 'recent';
            const scopeLabel = hudHistoryScope === 'all' ? 'ALL' : HUD_RECENT_WINDOW;
            hudScopeBtn.innerText = `${history.length} / ${scopeLabel}`;
            hudScopeBtn.title = hudHistoryScope === 'all' ? 'Switch to 14-spin rolling window' : 'Switch to all history';
            hudScopeBtn.className = 'px-1.5 min-w-[28px] h-5 flex items-center justify-center rounded-md text-[8px] font-black tracking-[0.12em] border transition-colors';
            hudScopeBtn.style.color = isRecentScope ? themeColor : 'rgba(255,255,255,0.88)';
            hudScopeBtn.style.borderColor = isRecentScope
                ? `${themeColor}55`
                : 'rgba(255,255,255,0.22)';
            hudScopeBtn.style.background = isRecentScope
                ? `${themeColor}22`
                : 'rgba(255,255,255,0.10)';
        }

        const headerTitle = hud.querySelector('#hudHeader span');
        if (headerTitle) {
            headerTitle.innerHTML = isHudColdMode
                ? `<i class="fas fa-snowflake mr-1"></i> Cold Tracker`
                : `<i class="fas fa-satellite-dish mr-1"></i> Live Feed`;
            headerTitle.className = `text-[9px] font-bold tracking-[0.18em] uppercase ${isHudColdMode ? 'text-[#06b6d4]' : 'text-[#30D158]'}`;
        }

        const content = document.getElementById('hudStats');
        if (!content) return;

        // Bridge to window functions
        if (!window.PredictionEngine) return;

        const windowSetting = hudHistoryScope === 'recent' ? HUD_RECENT_WINDOW : 'all';
        const stats = window.PredictionEngine.calculatePerimeterStats(history, windowSetting);
        if (!stats || !stats.counts) return;

        const comboStats = stats.comboStats || [];
        const sampleSize = comboStats.length > 0 ? comboStats[0].sampleSize : 0;

        let displayCombos = comboStats.slice();
        if (isHudColdMode) {
            displayCombos.sort((a, b) => b.coldPercent - a.coldPercent || b.sampleMisses - a.sampleMisses || a.hits - b.hits);
        } else {
            displayCombos.sort((a, b) => b.hotPercent - a.hotPercent || b.hits - a.hits || a.sampleMisses - b.sampleMisses);
        }

        const col2Title = 'H / S';
        const col3Title = isHudColdMode ? 'C%' : 'H%';

        let html = `
            <div class="space-y-0.5">
                <div class="grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-1.5 px-0.5 pb-1 text-[8px] uppercase tracking-[0.12em] text-white/28 border-b border-white/10">
                    <div class="font-bold">Combo</div>
                    <div class="text-center font-bold">${col2Title}</div>
                    <div class="text-right font-bold">${col3Title}</div>
                </div>
        `;

        if (sampleSize === 0) {
            html += `<div class="py-4 text-center text-white/35 italic">Awaiting spins...</div>`;
        } else {
            displayCombos.forEach(c => {
                const ratioSampleSize = Number.isFinite(c.sampleSize) ? c.sampleSize : sampleSize;
                const val1 = `${c.hits}/${ratioSampleSize}`;
                const val2 = isHudColdMode ? c.coldPercent : c.hotPercent;
                const opacity = (isHudColdMode ? val2 > 80 : val2 > 20) ? '1' : '0.5';
                const valColor = (isHudColdMode ? val2 > 80 : val2 > 20) ? themeColor : '#8E8E93';

                html += `
                    <div class="grid grid-cols-[34px_minmax(0,1fr)_32px] items-center gap-1.5 px-0.5 py-1">
                        <div class="text-[12px] font-black tracking-[0.08em]" style="color:${c.color}; opacity:${opacity}">${c.label}</div>
                        <div class="text-center font-mono text-[10px] text-gray-200" style="opacity:${opacity}">${val1}</div>
                        <div class="text-right font-mono text-[10px] font-bold" style="color:${valColor}; opacity:${opacity}">${val2}%</div>
                    </div>
                `;
            });
        }

        html += `</div>`;
        content.innerHTML = html;
        fitAnalyticsHUD();
    }

})();
