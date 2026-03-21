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
                <div class="min-w-[250px] h-[64px] px-3 py-2 rounded-[14px] border border-white/10 flex items-center justify-between cursor-pointer select-none transition-all hover:brightness-110"
                     ondblclick="if(window.toggleBetConfirmation) window.toggleBetConfirmation(${index})"
                     title="Double-click to ${bet.confirmed ? 'unselect' : 'select'}"
                     style="border-left: 4px solid ${accent}; ${borderStyle}; ${bgStyle}; backdrop-filter: blur(20px); box-shadow: 0 8px 24px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.15);">
                    <div class="min-w-0">
                        <div class="text-[15px] leading-tight font-black text-white tracking-wide drop-shadow-sm">BET F${bet.targetFace}</div>
                        <div class="text-[11px] leading-tight text-white/80 font-semibold mt-0.5">${subtitle}</div>
                    </div>
                </div>
            `);
        });

        if (cards.length === 0) {
            const snapshot = state.engineSnapshot || { engineState: 'WAITING', spinsUntilNextCheckpoint: '-' };
            let emptyLabel = 'SCANNING...';

            if (snapshot.engineState === 'BUILDING') {
                emptyLabel = `BUILDING ENGINE • ${snapshot.spinsUntilNextCheckpoint} SPINS UNTIL FIRST READ`;
            } else if (snapshot.engineState === 'WAITING') {
                emptyLabel = `NEXT READ IN ${snapshot.spinsUntilNextCheckpoint} SPINS`;
            } else if (snapshot.engineState === 'WATCHLIST') {
                emptyLabel = `WATCHLIST • ${snapshot.dominantCombo ? snapshot.dominantCombo.label : 'NO ACTION'}`;
            } else if (snapshot.engineState === 'NO_SIGNAL') {
                emptyLabel = 'NO SIGNAL • CHECKPOINT CLEAR';
            }

            dash.innerHTML = `<div class="dashboard-empty w-full text-center text-[10px] font-bold text-white/50 border border-white/10 rounded-[14px] bg-white/5 backdrop-blur-md p-2 select-none tracking-widest flex items-center justify-center h-[60px] shadow-inner uppercase"><span>${emptyLabel}</span></div>`;
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
