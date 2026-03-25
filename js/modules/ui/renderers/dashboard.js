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

            // If "Show Only Perimeter Bets" is on, skip bets with no perimeter hits
            if (state.showOnlyPerimeterBets && state.perimeterRuleEnabled && typeof window.calculatePerimeterFrequency === 'function') {
                const freq = window.calculatePerimeterFrequency(bet);
                if (freq === 0) return;
            }

            const subtitle = bet.subtitle || (bet.comboLabel ? `${bet.comboLabel} combo` : bet.patternName);
            const accent = bet.accentColor || '#FF3B30';

            // --- PERIMETER FREQUENCY ---
            let perimeterBadge = '';
            if (state.perimeterRuleEnabled && typeof window.calculatePerimeterFrequency === 'function') {
                const freq = window.calculatePerimeterFrequency(bet);
                const pWindow = state.predictionPerimeterWindow || 14;
                if (freq > 0) {
                    const freqColor = freq >= 3 ? '#FF453A' : freq >= 2 ? '#FF9F0A' : '#32D74B';
                    perimeterBadge = `<span class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border" style="color:${freqColor}; border-color:${freqColor}40; background:${freqColor}15; margin-left: 8px;">${freq}x in ${pWindow}</span>`;
                }
            }

            // New Premium Glassmorphism Card
            const bgStyle = bet.confirmed
                ? `background: linear-gradient(135deg, ${accent}40, ${accent}10); backdrop-filter: blur(24px) saturate(150%); -webkit-backdrop-filter: blur(24px) saturate(150%);`
                : `background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(24px) saturate(150%); -webkit-backdrop-filter: blur(24px) saturate(150%);`;

            const borderStyle = bet.confirmed
                ? `border: 1px solid ${accent}80; box-shadow: 0 8px 32px ${accent}20, inset 0 1px 1px rgba(255,255,255,0.2);`
                : `border: 1px solid rgba(255, 255, 255, 0.08); box-shadow: 0 4px 16px rgba(0,0,0,0.2), inset 0 1px 1px rgba(255,255,255,0.05);`;

            const iconHTML = bet.confirmed
                ? `<div class="h-6 w-6 rounded-full flex items-center justify-center shadow-lg" style="background: linear-gradient(135deg, ${accent}, ${accent}90)"><i class="fas fa-check text-[10px] text-white"></i></div>`
                : `<div class="h-6 w-6 rounded-full flex items-center justify-center border border-white/20 bg-white/5"><i class="fas fa-crosshairs text-[10px] text-white/40"></i></div>`;

            const titleColor = bet.confirmed ? 'text-white drop-shadow-md' : 'text-white/80';
            const subColor = bet.confirmed ? 'text-white/80' : 'text-white/40';

            let pStats = (window.EngineCore && window.EngineCore.stats && window.EngineCore.stats.patternStats) ? window.EngineCore.stats.patternStats : null;
            if (!pStats && window.state && window.state.engineStats && window.state.engineStats.patternStats) {
                pStats = window.state.engineStats.patternStats;
            }
            if (!pStats) pStats = {};

            const pStat = pStats[filterKey] || pStats[bet.patternName] || { wins: 0, losses: 0 };
            const total = pStat.wins + pStat.losses;
            const accuracy = total > 0 ? Math.round((pStat.wins / total) * 100) : 0;
            const accuracyHTML = total > 0 ? `<span class="text-[10px] font-bold opacity-50 ml-1">(${accuracy}%)</span>` : '';
            const bgClass = bet.confirmed ? 'opacity-100' : 'opacity-90';

            cards.push(`
                <div class="min-w-[160px] min-h-[52px] px-2 py-1.5 rounded-[12px] flex items-center justify-between cursor-pointer select-none transition-all duration-300 hover:bg-white/[0.05] ${bgClass}"
                     ondblclick="if(window.toggleBetConfirmation) window.toggleBetConfirmation(${index})"
                     title="Double-click to ${bet.confirmed ? 'unselect' : 'select'}"
                     style="${bgStyle} ${borderStyle}">
                    <div class="flex items-center gap-2 min-w-0">
                        <div class="w-1 h-6 rounded-full" style="background: ${accent}; box-shadow: 0 0 6px ${accent};"></div>
                        <div class="flex flex-col min-w-0">
                            <div class="flex items-center">
                                <span class="text-[13px] leading-tight font-black tracking-widest uppercase ${titleColor}">F${bet.targetFace}${accuracyHTML}</span>
                                ${perimeterBadge}
                            </div>
                            <span class="text-[8px] leading-tight font-bold tracking-widest uppercase ${subColor} mt-0.5 truncate max-w-[100px]">${subtitle}</span>
                        </div>
                    </div>
                    ${iconHTML}
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

            dash.innerHTML = `<div class="w-full text-center text-[10px] font-black text-white/10 select-none uppercase tracking-[0.3em] h-[68px] flex items-center justify-center">${emptyLabel}</div>`;
            return;
        }

        dash.innerHTML = cards.join('');
    };

    window.toggleBetConfirmation = function (index) {
        if (window.state && window.state.activeBets && window.state.activeBets[index]) {
            window.state.activeBets[index].confirmed = !window.state.activeBets[index].confirmed;
            window.renderDashboardSafe(window.state.activeBets);
            if (window.syncAppStore) window.syncAppStore(); // Ensure state persistence if applicable
        }
    };
})();
