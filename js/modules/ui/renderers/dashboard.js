(function () {
    'use strict';

    window.renderDashboardSafe = function (betsList) {
        const state = window.state || {};
        const bets = Array.isArray(betsList) ? betsList : (state.activeBets || []);
        const patternConf = state.patternConfig || {};

        const dash = document.getElementById('dashboard');
        if (!dash) return;

        let cards = [];
        bets.forEach((bet, index) => {
            const filterKey = bet.filterKey || bet.patternName;
            if (patternConf[filterKey] === false) return;

            const subtitle = bet.subtitle || (bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName);
            const accent = bet.accentColor || '#FF3B30';

            const bgStyle = bet.confirmed
                ? `background: linear-gradient(135deg, ${accent}70, ${accent}20)`
                : `background: linear-gradient(135deg, ${accent}30, ${accent}05)`;

            const borderStyle = bet.confirmed
                ? `border-color: ${accent}`
                : `border-color: ${accent}40`;

            cards.push(`
                <div class="min-w-[220px] h-[46px] px-3 py-1.5 rounded-xl border border-white/10 flex items-center justify-between cursor-pointer select-none transition-all hover:brightness-110"
                     ondblclick="if(window.toggleBetConfirmation) window.toggleBetConfirmation(${index})"
                     title="Double-click to ${bet.confirmed ? 'unselect' : 'select'}"
                     style="border-left: 3px solid ${accent}; ${borderStyle}; ${bgStyle}; backdrop-filter: blur(20px); box-shadow: 0 4px 12px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.15);">
                    <div class="min-w-0">
                        <div class="text-[13px] leading-tight font-black text-white tracking-wide uppercase">BET F${bet.targetFace}</div>
                        <div class="text-[10px] leading-tight text-white/50 font-bold mt-0.5 truncate">${subtitle}</div>
                    </div>
                </div>
            `);
        });

        if (cards.length === 0) {
            const snapshot = state.engineSnapshot || { engineState: 'WAITING', spinsUntilNextCheckpoint: '-' };
            let emptyLabel = 'AWAITING PROTOCOL...';

            if (snapshot.engineState === 'BUILDING') {
                emptyLabel = `SCANNING SESSION • ${snapshot.spinsUntilNextCheckpoint} SPINS TO START`;
            } else if (snapshot.engineState === 'WAITING') {
                emptyLabel = `NEXT ENGINE READ IN ${snapshot.spinsUntilNextCheckpoint} SPINS`;
            } else if (snapshot.engineState === 'WATCHLIST') {
                emptyLabel = `WATCHLIST • ${snapshot.dominantCombo ? snapshot.dominantCombo.label : 'IDLE'}`;
            } else if (snapshot.engineState === 'NO_SIGNAL') {
                emptyLabel = 'SIGNAL CLEAR • STANDBY';
            }

            dash.innerHTML = `<div class="w-full text-center text-[9px] font-black text-white/10 select-none uppercase tracking-[0.3em] py-4 h-14 flex items-center justify-center">${emptyLabel}</div>`;
            return;
        }

        dash.innerHTML = cards.join('');
    };

    window.toggleBetConfirmation = function(index) {
        if (window.state && window.state.activeBets && window.state.activeBets[index]) {
            window.state.activeBets[index].confirmed = !window.state.activeBets[index].confirmed;
            window.renderDashboardSafe(window.state.activeBets);
            if (window.syncAppStore) window.syncAppStore(); // Ensure state persistence if applicable
        }
    };
})();
