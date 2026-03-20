(function () {
    'use strict';

    const modalHtml = `
    <div id="betsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md" onclick="toggleModal('betsModal')"></div>
        <div class="relative w-full max-w-2xl bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 class="text-sm font-bold uppercase tracking-widest text-white">My Bets & Performance</h3>
                <button onclick="toggleModal('betsModal')" class="text-gray-400 hover:text-white transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="userAnalyticsContent" class="flex-1 overflow-y-auto p-6 custom-scroll">
                <div class="text-center py-12 text-white/40 italic">Awaiting session activity...</div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();