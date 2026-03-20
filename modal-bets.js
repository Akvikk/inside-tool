(function () {
    const template = document.createElement('template');
    template.innerHTML = `
    <div id="betsModal"
        class="fixed inset-0 bg-black/60 backdrop-blur-md hidden z-50 flex items-center justify-center p-4"
        onclick="toggleModal('betsModal')">
        <div class="glass-menu modal-surface w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden"
            onclick="event.stopPropagation()">
            <div class="p-4 glass-header flex justify-between items-center">
                <h2 class="font-semibold text-sm tracking-wide uppercase text-white">Bet History</h2>
                <button onclick="toggleModal('betsModal')" class="text-gray-400 hover:text-white transition-colors"><i
                        class="fas fa-times"></i></button>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scroll">
                <div class="grid grid-cols-3 gap-4">
                    <div class="frosted-plate p-4 text-center">
                        <div class="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-1">Net Units
                        </div>
                        <div id="userNet" class="text-4xl font-mono font-semibold text-white">0</div>
                    </div>
                    <div class="frosted-plate p-4 text-center">
                        <div class="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-1">Hit Rate
                        </div>
                        <div id="userHitRate" class="text-4xl font-mono font-semibold text-white">0%</div>
                    </div>
                    <div class="frosted-plate p-4 text-center">
                        <div class="text-white/50 text-[10px] font-semibold uppercase tracking-wider mb-1">Total Bets
                        </div>
                        <div id="userTotal" class="text-4xl font-mono font-semibold text-white">0</div>
                    </div>
                </div>
                <div class="frosted-plate p-4">
                    <div class="text-white/45 text-[10px] font-semibold uppercase tracking-wider mb-2">Bet Trend</div>
                    <div id="userGraphContainer" class="h-36 w-full relative"></div>
                </div>
                <div class="bg-white/5 border border-white/5 rounded-xl overflow-hidden">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-black/30 text-white/50 border-b border-white/5">
                            <tr>
                                <th class="p-3 font-semibold uppercase">#</th>
                                <th class="p-3 font-semibold uppercase">Pattern</th>
                                <th class="p-3 font-semibold uppercase text-center">Target</th>
                                <th class="p-3 font-semibold uppercase text-right">Result</th>
                            </tr>
                        </thead>
                        <tbody id="userBetsBody" class="divide-y divide-white/5"></tbody>
                    </table>
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(template.content);
})();