(function () {
    'use strict';

    const modalHtml = `
    <div id="analyticsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md" onclick="toggleModal('analyticsModal')"></div>
        <div class="relative w-full max-w-4xl bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <div class="flex gap-6">
                    <button onclick="state.currentAnalyticsTab='strategy'; renderAnalytics()" id="tabBtnStrategy" class="pb-2 text-xs font-bold uppercase tracking-widest text-[#30D158] border-b-2 border-[#30D158]">Strategy</button>
                    <button onclick="state.currentAnalyticsTab='intelligence'; renderAnalytics()" id="tabBtnIntelligence" class="pb-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-transparent">Intelligence</button>
                </div>
                <button onclick="toggleModal('analyticsModal')" class="text-gray-400 hover:text-white transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="analyticsPanel" class="flex-1 overflow-y-auto p-6 custom-scroll">
                <div id="strategyAnalyticsPanel"></div>
                <div id="intelligencePanel" class="hidden">
                    <div id="intelligenceContent"></div>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();