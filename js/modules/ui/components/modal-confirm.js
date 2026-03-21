(function () {
    'use strict';

    const modalHtml = `
    <div id="confirmModal" class="modal hidden fixed inset-0 z-[80] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-xl transition-opacity duration-500" onclick="toggleModal('confirmModal')"></div>
        <div class="relative w-full max-w-sm bg-[#1C1C1E]/80 backdrop-blur-[40px] saturate-150 border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div class="p-6 text-center">
                <div class="w-12 h-12 rounded-full bg-[#FF453A]/10 text-[#FF453A] flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-exclamation-triangle text-xl"></i>
                </div>
                <h3 class="text-lg font-semibold text-white/90 mb-2 tracking-normal">Reset Session Data?</h3>
                <p class="text-sm text-white/50 mb-6 tracking-normal">This will clear all history, active bets, and engine state. This action cannot be undone.</p>
                <div class="flex gap-3">
                    <button onclick="toggleModal('confirmModal')" class="flex-1 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/[0.08] text-white/90 font-medium transition-all duration-300 ease-out text-sm">Cancel</button>
                    <button id="confirmResetBtn" class="flex-1 py-2.5 rounded-lg bg-[#FF453A] text-white hover:bg-[#FF3B30] font-medium transition-all duration-300 ease-out text-sm shadow-sm border-none">Reset Data</button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();