(function () {
    'use strict';

    window.modalBets = {
        init: function () {
            const container = document.getElementById('betsModal');
            if (container) {
                container.innerHTML = `
                <div class="fixed inset-0 flex items-center justify-center p-4 z-50">
                    <!-- BACKGROUND BLUR OVERLAY -->
                    <div class="absolute inset-0 bg-[#030303]/40 backdrop-blur-md" onclick="toggleModal('betsModal')"></div>
                    
                    <!-- MODAL CONTENT -->
                    <div class="refined-glass w-full max-w-4xl max-h-[90vh] rounded-[32px] overflow-hidden flex flex-col shadow-[0_32px_128px_rgba(0,0,0,0.5)] relative z-10 animate-apple-in">
                        <!-- Header -->
                        <div class="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                            <div>
                                <h2 class="text-2xl font-bold text-white tracking-tight">Financial Vault</h2>
                                <p class="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mt-1">Session Transaction History</p>
                            </div>
                            <button onclick="toggleModal('betsModal')" class="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all hover:bg-white/10 border border-white/10">
                                <i class="fas fa-times text-xs"></i>
                            </button>
                        </div>

                        <!-- Content -->
                        <div class="flex-1 overflow-y-auto custom-scroll p-8 bg-black/20">
                            <!-- Stats Strip -->
                            <div class="grid grid-cols-2 md:grid-cols-4 gap-6 mb-10">
                                <div class="p-6 rounded-[24px] bg-white/[0.03] border border-white/[0.03] shadow-sm hover:bg-white/[0.05] transition-all">
                                    <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3">Efficiency</div>
                                    <div id="statSuccessRate" class="text-2xl font-bold text-[#30D158] tracking-tight">0%</div>
                                </div>
                                <div class="p-6 rounded-[24px] bg-white/[0.03] border border-white/[0.03] shadow-sm hover:bg-white/[0.05] transition-all">
                                    <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3">Volume</div>
                                    <div id="statTotalSignals" class="text-2xl font-bold text-white tracking-tight">0</div>
                                </div>
                                <div class="p-6 rounded-[24px] bg-white/[0.03] border border-white/[0.03] shadow-sm hover:bg-white/[0.05] transition-all">
                                    <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3">Margin Avg</div>
                                    <div id="statAvgMargin" class="text-2xl font-bold text-[#FFD60A] tracking-tight">0.0</div>
                                </div>
                                <div class="p-6 rounded-[24px] bg-white/[0.03] border border-white/[0.03] shadow-sm hover:bg-white/[0.05] transition-all">
                                    <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-3">Delta Impact</div>
                                    <div id="statNetUnits" class="text-2xl font-bold text-white tracking-tight">0.0</div>
                                </div>
                            </div>

                            <!-- List -->
                            <div class="space-y-6">
                                <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-white/20 mb-6 ml-1">Live Transaction Ledger</h3>
                                <div id="betLogContainer" class="space-y-3">
                                    <div class="text-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-center py-16 italic">Awaiting secure handshake...</div>
                                </div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="p-6 border-t border-white/[0.05] bg-white/[0.02] flex justify-center">
                             <p class="text-[9px] text-white/20 font-black uppercase tracking-[0.4em]">ENCRYPTED VAULT LAYER ANALYTICS</p>
                        </div>
                    </div>
                </div>`;
                container.classList.add('hidden');
            }
        }
    };

    window.renderUserAnalytics = function () {
        if (!window.state || !window.state.userStats) return;
        const stats = window.state.userStats;
        const log = stats.betLog || [];

        const total = log.length;
        const wins = log.filter(b => b.isWin).length;
        const rate = total === 0 ? 0 : Math.round((wins / total) * 100);

        const rateEl = document.getElementById('statSuccessRate');
        if (rateEl) {
            rateEl.innerText = rate + "%";
            rateEl.className = `text-2xl font-bold tracking-tight ${rate >= 50 ? 'text-[#30D158]' : (rate > 0 ? 'text-[#FF453A]' : 'text-white/20')}`;
        }
        const totalEl = document.getElementById('statTotalSignals');
        if (totalEl) totalEl.innerText = total;

        const netEl = document.getElementById('statNetUnits');
        if (netEl) {
            netEl.innerText = (stats.netUnits > 0 ? '+' : '') + stats.netUnits.toFixed(1);
            netEl.className = `text-2xl font-bold tracking-tight ${stats.netUnits > 0 ? 'text-[#30D158]' : (stats.netUnits < 0 ? 'text-[#FF453A]' : 'text-white')}`;
        }

        const container = document.getElementById('betLogContainer');
        if (!container) return;

        if (log.length === 0) {
            container.innerHTML = '<div class="text-white/10 text-[10px] font-bold uppercase tracking-[0.2em] text-center py-16 italic">Awaiting secure handshake...</div>';
            return;
        }

        container.innerHTML = log.slice().reverse().map(bet => {
            const statusClass = bet.isWin ? 'text-[#30D158] bg-[#30D158]/10 border-[#30D158]/10 shadow-[0_0_15px_rgba(48,209,88,0.1)]' : 'text-[#FF453A] bg-[#FF453A]/10 border-[#FF453A]/10';
            const detail = window.formatPredictionDetail ? window.formatPredictionDetail(bet) : `F${bet.targetFace} ${bet.comboLabel || bet.patternName}`;

            return `
                <div class="bg-white/[0.02] border border-white/[0.03] p-5 rounded-[20px] flex items-center justify-between group hover:bg-white/[0.04] transition-all duration-300">
                    <div class="flex items-center gap-5">
                        <div class="h-12 w-12 rounded-[14px] flex items-center justify-center font-black text-sm ${bet.numColor || 'bg-zinc-900'} text-white border border-white/10 shadow-lg group-hover:scale-105 transition-transform duration-300">
                            ${bet.spinNum}
                        </div>
                        <div>
                            <div class="text-[11px] font-black text-white tracking-normal group-hover:text-blue-400 transition-colors">${detail}</div>
                            <div class="text-[9px] text-white/20 font-bold uppercase tracking-widest mt-1">SPIN #${bet.spinIndex + 1} • STAKE ${bet.stake || 1}U</div>
                        </div>
                    </div>
                    <div class="flex items-center gap-6">
                        <div class="text-right hidden sm:block">
                            <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] mb-1">Status</div>
                            <div class="text-[8px] font-bold text-white/40 tracking-widest">${bet.isWin ? 'CLEARED' : 'VOID'}</div>
                        </div>
                        <div class="px-5 py-2.5 rounded-xl border text-[9px] font-black tracking-[0.2em] ${statusClass}">
                            ${bet.isWin ? 'SUCCESS' : 'DEFEAT'}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };
})();
