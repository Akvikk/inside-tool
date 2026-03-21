(function () {
    'use strict';

    const modalHtml = `
    <div id="betsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-xl transition-opacity duration-500" onclick="toggleModal('betsModal')"></div>
        <div class="relative w-full max-w-2xl bg-[#1C1C1E]/80 backdrop-blur-[40px] saturate-150 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh] animate-apple-in border border-white/[0.08]">
            
            <div class="px-6 py-4 border-b border-white/[0.08] flex justify-between items-center bg-white/[0.02] shrink-0">
                <h3 class="text-sm font-medium tracking-normal text-white/90 flex items-center">
                    <i class="fas fa-list-check mr-2 text-[#0A84FF]"></i> 
                    Personal Analytics & Ledger
                </h3>
                <button onclick="toggleModal('betsModal')" class="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all duration-300 ease-out border border-white/[0.08]">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>

            <div id="userAnalyticsContent" class="flex-1 overflow-y-auto p-5 md:p-6 custom-scroll relative">

                <!-- KPI HEADER (Apple Card Style) -->
                <div class="grid grid-cols-3 gap-3 md:gap-4 mb-5 md:mb-6 relative z-10">
                    <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm transition-all duration-300 ease-out hover:bg-white/[0.05]">
                        <div class="text-xs font-medium text-white/50 tracking-normal mb-1">Total Net</div>
                        <div id="userNet" class="text-2xl md:text-3xl font-semibold tracking-tight text-white/90">0</div>
                    </div>
                    <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm transition-all duration-300 ease-out hover:bg-white/[0.05]">
                        <div class="text-xs font-medium text-white/50 tracking-normal mb-1">Hit Rate</div>
                        <div id="userHitRate" class="text-2xl md:text-3xl font-semibold tracking-tight text-white/90">0%</div>
                    </div>
                    <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm transition-all duration-300 ease-out hover:bg-white/[0.05]">
                        <div class="text-xs font-medium text-white/50 tracking-normal mb-1">Confirmation</div>
                        <div id="userTotal" class="text-2xl md:text-3xl font-semibold tracking-tight text-white/90">0</div>
                    </div>
                </div>

                <!-- VISUAL CHART -->
                <div class="bg-black/20 border border-white/[0.08] rounded-2xl mb-5 md:mb-6 h-[180px] md:h-[200px] overflow-hidden relative shadow-inner" id="userGraphContainer">
                    <div class="flex items-center justify-center h-full text-xs text-white/40 font-medium animate-pulse">Syncing Ledger...</div>
                </div>

                <!-- BET TABLE -->
                <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
                    <div class="bg-white/[0.02] text-white/70 text-sm font-medium p-4 border-b border-white/[0.08]">Session Audit Trail</div>
                    <table class="w-full text-left text-sm">
                        <thead class="bg-black/20 text-white/50 font-medium text-xs border-b border-white/[0.08]">
                            <tr><th class="p-4 font-medium">Index</th><th class="p-4 font-medium">Signature</th><th class="p-4 text-center font-medium">Target</th><th class="p-4 text-right font-medium">Yield</th></tr>
                        </thead>
                        <tbody id="userBetsBody" class="divide-y divide-white/[0.08]">
                            <tr><td colspan="4" class="p-6 text-center text-white/40 italic text-xs">Awaiting protocol activity...</td></tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    window.renderUserAnalytics = function () {
        const stats = window.state ? window.state.userStats : { totalWins: 0, totalLosses: 0, netUnits: 0, betLog: [] };
        if (!stats) return;

        const netEl = document.getElementById('userNet');
        if (netEl) {
            netEl.innerText = (stats.netUnits > 0 ? '+' : '') + stats.netUnits;
            netEl.className = `text-2xl md:text-3xl font-semibold tracking-tight ${stats.netUnits > 0 ? 'text-[#32D74B]' : (stats.netUnits < 0 ? 'text-[#FF453A]' : 'text-white/90')}`;
        }

        const hrEl = document.getElementById('userHitRate');
        if (hrEl) {
            const total = stats.totalWins + stats.totalLosses;
            const hr = total === 0 ? 0 : Math.round((stats.totalWins / total) * 100);
            hrEl.innerText = hr + "%";
            hrEl.className = `text-2xl md:text-3xl font-semibold tracking-tight ${total === 0 ? 'text-white/90' : (hr >= 50 ? 'text-[#32D74B]' : 'text-[#FF453A]')}`;
        }

        const totalEl = document.getElementById('userTotal');
        if (totalEl) totalEl.innerText = stats.totalWins + stats.totalLosses;

        const body = document.getElementById('userBetsBody');
        if (body) {
            if (!stats.betLog || stats.betLog.length === 0) {
                const activeStrategy = window.state ? window.state.currentGameplayStrategy : 'series';
                let emptyText = 'Awaiting protocol activity...';
                if (activeStrategy === 'combo') emptyText = 'Awaiting combo signatures...';
                else if (activeStrategy === 'inside') emptyText = 'Awaiting pattern recognition...';
                else if (activeStrategy === 'series') emptyText = 'Awaiting sequence data...';

                body.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-white/30 italic text-xs">${emptyText}</td></tr>`;
            } else {
                body.innerHTML = stats.betLog.slice().reverse().map((bet, idx) => `
                    <tr class="hover:bg-white/[0.04] transition-colors duration-300 ease-out">
                        <td class="p-4 text-white/40 font-mono text-[10px]">${stats.betLog.length - idx}</td>
                        <td class="p-4"><span class="px-2.5 py-1 rounded-md text-xs font-medium bg-white/5 border border-white/[0.08]" style="color: ${bet.accentColor || '#FFFFFF'};">${bet.patternName}</span></td>
                        <td class="p-4 text-center font-medium text-white/90 text-sm">F${bet.targetFace}</td>
                        <td class="p-4 text-right font-medium ${bet.isWin ? 'text-[#32D74B]' : 'text-[#FF453A]'}">${bet.isWin ? 'SUCCESS' : 'DEFEAT'}</td>
                    </tr>
                `).join('');
            }
        }

        if (window.drawAdvancedGraph) {
            window.drawAdvancedGraph(stats.bankrollHistory, stats.totalWins, stats.totalLosses, 'userGraphContainer');
        }
    };
})();