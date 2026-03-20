(function () {
    'use strict';

    const modalHtml = `
    <div id="aiChatModal" class="modal hidden fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/80 backdrop-blur-xl" onclick="toggleModal('aiChatModal')"></div>
        <div class="relative w-full max-w-lg bg-[#0a0a0c] border border-[#bf5af2]/30 rounded-2xl shadow-[0_0_50px_rgba(191,90,242,0.1)] overflow-hidden flex flex-col h-[600px]">
            <div class="px-6 py-4 border-b border-[#bf5af2]/20 flex justify-between items-center bg-[#bf5af2]/5">
                <div class="flex items-center gap-3">
                    <i class="fas fa-brain text-[#bf5af2]"></i>
                    <h3 class="text-sm font-bold uppercase tracking-widest text-white">Predictive AI Chat</h3>
                </div>
                <button onclick="toggleModal('aiChatModal')" class="text-gray-400 hover:text-white transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="aiChatContainer" class="flex-1 overflow-y-auto p-6 custom-scroll space-y-4">
                <div class="bg-white/5 rounded-xl p-4 border border-white/5 text-xs text-white/60">
                    Neural Net active. Ask about the current table rhythm or strategy drift.
                </div>
            </div>
            <div class="p-4 bg-white/5 border-t border-white/10">
                <div class="flex gap-2">
                    <input type="text" id="aiChatInput" placeholder="Analyze the last 20 spins..." class="flex-1 bg-black/40 border border-white/10 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[#bf5af2]">
                    <button onclick="sendAiChatMessage()" class="bg-[#bf5af2] text-white px-4 py-2 rounded-lg hover:brightness-110">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();