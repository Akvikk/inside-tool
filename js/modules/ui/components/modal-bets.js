(function () {
    'use strict';

    const modalHtml = `
    <div id="betsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-3xl transition-opacity duration-500" onclick="toggleModal('betsModal')"></div>
        <div class="relative w-full max-w-2xl apple-glass rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[82vh] animate-apple-in border-white/5">
            
            <div class="px-8 py-5 border-b border-white/[0.08] flex justify-between items-center bg-white/[0.02] shrink-0">
                <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-white/50 flex items-center">
                    <i class="fas fa-list-check mr-3 text-[#0A84FF] drop-shadow-[0_0_8px_rgba(10,132,255,0.4)]"></i> 
                    Personal Analytics & Ledger
                </h3>
                <button onclick="toggleModal('betsModal')" class="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                    <i class="fas fa-times text-xs"></i>
                </button>
            </div>

            <div id="userAnalyticsContent" class="flex-1 overflow-y-auto p-8 custom-scroll relative">
                <!-- MESH BACKGROUND DECOR -->
                <div class="absolute inset-0 radial-gradient(at 50% 0%, rgba(10, 132, 255, 0.05) 0px, transparent 50%) pointer-events-none"></div>

                <!-- KPI HEADER (Apple Card Style) -->
                <div class="grid grid-cols-3 gap-5 mb-8 relative z-10">
                    <div class="bg-white/[0.02] border border-white/[0.05] rounded-[24px] p-5 text-center shadow-xl group transition-all hover:bg-white/[0.04]">
                        <div class="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Total Net</div>
                        <div id="userNet" class="text-3xl font-black tracking-tighter text-white">0</div>
                    </div>
                    <div class="bg-white/[0.02] border border-white/[0.05] rounded-[24px] p-5 text-center shadow-xl group transition-all hover:bg-white/[0.04]">
                        <div class="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Hit Rate</div>
                        <div id="userHitRate" class="text-3xl font-black tracking-tighter text-white">0%</div>
                    </div>
                    <div class="bg-white/[0.02] border border-white/[0.05] rounded-[24px] p-5 text-center shadow-xl group transition-all hover:bg-white/[0.04]">
                        <div class="text-[8px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Confirmation</div>
                        <div id="userTotal" class="text-3xl font-black tracking-tighter text-white">0</div>
                    </div>
                </div>

                <!-- VISUAL CHART -->
                <div class="bg-black/30 border border-white/[0.08] rounded-[24px] mb-8 h-[200px] overflow-hidden relative shadow-inner" id="userGraphContainer">
                    <div class="flex items-center justify-center h-full text-[9px] text-white/10 font-black uppercase tracking-[0.3em] animate-pulse">Syncing Ledger...</div>
                </div>

                <!-- BET TABLE -->
                <div class="bg-white/[0.02] border border-white/[0.05] rounded-[24px] overflow-hidden shadow-2xl backdrop-blur-md">
                    <div class="bg-white/[0.04] text-white/30 text-[9px] font-black uppercase tracking-[0.3em] p-4 border-b border-white/[0.05]">Session Audit Trail</div>
                    <table class="w-full text-left text-xs">
                        <thead class="bg-black/20 text-white/30 uppercase text-[9px] font-black tracking-[0.2em] border-b border-white/[0.05]">
                            <tr><th class="p-4">Index</th><th class="p-4">Signature</th><th class="p-4 text-center">Target</th><th class="p-4 text-right">Yield</th></tr>
                        </thead>
                        <tbody id="userBetsBody" class="divide-y divide-white/[0.03]">
                            <tr><td colspan="4" class="p-10 text-center text-white/10 italic tracking-widest text-[9px]">AWAITING PROTOCOL ACTIVITY...</td></tr>
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
            netEl.className = `text-3xl font-black tracking-tighter ${stats.netUnits > 0 ? 'text-[#30D158]' : (stats.netUnits < 0 ? 'text-[#FF453A]' : 'text-white')}`;
        }

        const hrEl = document.getElementById('userHitRate');
        if (hrEl) {
            const total = stats.totalWins + stats.totalLosses;
            const hr = total === 0 ? 0 : Math.round((stats.totalWins / total) * 100);
            hrEl.innerText = hr + "%";
            hrEl.className = `text-3xl font-black tracking-tighter ${total === 0 ? 'text-white' : (hr >= 50 ? 'text-[#30D158]' : 'text-[#FF453A]')}`;
        }

        const totalEl = document.getElementById('userTotal');
        if (totalEl) totalEl.innerText = stats.totalWins + stats.totalLosses;

        const body = document.getElementById('userBetsBody');
        if (body) {
            if (!stats.betLog || stats.betLog.length === 0) {
                body.innerHTML = '<tr><td colspan="4" class="p-10 text-center text-white/10 italic tracking-widest text-[9px]">AWAITING PROTOCOL ACTIVITY...</td></tr>';
            } else {
                body.innerHTML = stats.betLog.slice().reverse().map((bet, idx) => `
                    <tr class="hover:bg-white/[0.03] transition-colors">
                        <td class="p-4 text-white/20 font-mono text-[10px]">${stats.betLog.length - idx}</td>
                        <td class="p-4"><span class="px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest bg-white/5 border border-white/5" style="color: ${bet.accentColor || '#FFFFFF'}; shadow: 0 0 8px ${bet.accentColor}40;">${bet.patternName}</span></td>
                        <td class="p-4 text-center font-black text-white/90 text-sm tracking-tighter">F${bet.targetFace}</td>
                        <td class="p-4 text-right font-black tracking-tighter ${bet.isWin ? 'text-[#30D158]' : 'text-[#FF453A]'}">${bet.isWin ? 'SUCCESS' : 'DEFEAT'}</td>
                    </tr>
                `).join('');
            }
        }

        if (window.drawAdvancedGraph) {
            window.drawAdvancedGraph(stats.bankrollHistory, stats.totalWins, stats.totalLosses, 'userGraphContainer');
        }
    };
})();