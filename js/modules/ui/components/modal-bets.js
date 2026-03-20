(function () {
    'use strict';

    const modalHtml = `
    <div id="betsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md" onclick="toggleModal('betsModal')"></div>
        <div class="relative w-full max-w-2xl bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 class="text-sm font-bold uppercase tracking-widest text-white"><i class="fas fa-list-check mr-2 text-[#0A84FF]"></i> My Bets & Performance</h3>
                <button onclick="toggleModal('betsModal')" class="text-gray-400 hover:text-white transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="userAnalyticsContent" class="flex-1 overflow-y-auto p-6 custom-scroll">
                
                <!-- KPI HEADER -->
                <div class="grid grid-cols-3 gap-4 mb-6">
                    <div class="bg-black/40 border border-white/10 rounded-xl p-4 text-center shadow-inner">
                        <div class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Total Net</div>
                        <div id="userNet" class="text-4xl font-semibold tracking-tight text-white">0</div>
                    </div>
                    <div class="bg-black/40 border border-white/10 rounded-xl p-4 text-center shadow-inner">
                        <div class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Hit Rate</div>
                        <div id="userHitRate" class="text-4xl font-semibold tracking-tight text-white">0%</div>
                    </div>
                    <div class="bg-black/40 border border-white/10 rounded-xl p-4 text-center shadow-inner">
                        <div class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Total Bets</div>
                        <div id="userTotal" class="text-4xl font-semibold tracking-tight text-white">0</div>
                    </div>
                </div>

                <!-- VISUAL CHART -->
                <div class="bg-black/20 border border-white/10 rounded-xl mb-6 h-[200px] overflow-hidden relative" id="userGraphContainer">
                    <div class="flex items-center justify-center h-full text-xs text-[#8E8E93] font-mono animate-pulse">Waiting for Data...</div>
                </div>

                <!-- BET TABLE -->
                <div class="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg">
                    <div class="bg-black/30 text-white/40 text-[9px] font-black uppercase tracking-widest p-3 border-b border-white/5">Session Log</div>
                    <table class="w-full text-left text-xs">
                        <thead class="bg-black/10 text-white/30 uppercase text-[9px] tracking-wider border-b border-white/5">
                            <tr><th class="p-3">#</th><th class="p-3">Pattern</th><th class="p-3 text-center">Target</th><th class="p-3 text-right">Result</th></tr>
                        </thead>
                        <tbody id="userBetsBody" class="divide-y divide-white/5">
                            <tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No confirmed bets yet</td></tr>
                        </tbody>
                    </table>
                </div>

            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();