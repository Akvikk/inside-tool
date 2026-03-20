(function () {
    const template = document.createElement('template');
    template.innerHTML = `
    <div id="aiChatModal" class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md hidden flex items-center justify-center p-4" onclick="toggleModal('aiChatModal')">
        <div class="glass-menu modal-surface w-full max-w-3xl h-[80vh] flex flex-col overflow-hidden" onclick="event.stopPropagation()">
            <div class="p-4 glass-header flex justify-between items-center gap-3 border-b border-white/10">
                <div>
                    <div class="text-white font-semibold uppercase tracking-wider text-sm">AI Chat</div>
                    <div class="text-[10px] text-white/40">Live table-boss guidance based on your current session.</div>
                </div>
                <div class="flex items-center gap-2">
                    <button onclick="toggleModal('aiChatModal'); openAiConfigModal()" class="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider rounded-lg border border-[#bf5af2]/30 bg-[#bf5af2]/10 text-[#bf5af2] hover:bg-[#bf5af2]/20 transition-colors">AI Settings</button>
                    <button onclick="toggleModal('aiChatModal')" class="text-gray-400 hover:text-white transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div id="aiChatHistory" class="flex-1 overflow-y-auto p-4 space-y-4 custom-scroll"></div>
            <div class="p-4 border-t border-white/10 bg-black/20">
                <div class="flex gap-3 items-end">
                    <textarea id="aiChatInput" rows="2" onkeydown="if(event.key==='Enter' && !event.shiftKey){ event.preventDefault(); sendAiChatMessage(); }" class="flex-1 bg-black/50 border border-white/10 rounded-xl text-white p-3 resize-none outline-none focus:border-[#bf5af2]/50 transition-colors" placeholder="Ask about rhythm, variance, or whether the table is worth touching."></textarea>
                    <button id="aiSendBtn" onclick="sendAiChatMessage()" class="h-12 w-12 rounded-xl bg-[#bf5af2]/20 hover:bg-[#bf5af2]/30 text-[#bf5af2] border border-[#bf5af2]/30 transition-colors flex items-center justify-center shrink-0"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(template.content);
})();