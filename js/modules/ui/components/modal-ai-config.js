(function () {
    'use strict';

    const modalHtml = `
    <div id="aiConfigModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md" onclick="toggleModal('aiConfigModal')"></div>
        <div class="relative w-full max-w-md bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div class="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/5">
                <h3 class="text-sm font-bold uppercase tracking-widest text-[#bf5af2]"><i class="fas fa-brain mr-2"></i>AI Configuration</h3>
                <button onclick="toggleModal('aiConfigModal')" class="text-gray-400 hover:text-white transition-colors"><i class="fas fa-times"></i></button>
            </div>
            <div class="p-6 space-y-4">
                <div class="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 cursor-pointer transition-colors hover:bg-white/10" onclick="toggleAiMasterSwitch()">
                    <div>
                        <div class="font-bold text-white text-sm">Master Switch</div>
                        <div class="text-xs text-white/50" id="aiMasterStatusText">Disabled</div>
                    </div>
                    <div id="aiMasterSwitch" class="w-12 h-6 bg-white/10 border border-white/20 rounded-full relative transition-colors"><div id="aiSwitchKnob" class="absolute left-1 top-1 w-4 h-4 bg-gray-400 rounded-full transition-transform"></div></div>
                </div>
                <div id="aiVaultSection" class="hidden space-y-4">
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-white/50 uppercase tracking-wider">AI Provider</label>
                        <select id="aiProviderSelect" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#bf5af2]/50">
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI</option>
                        </select>
                    </div>
                    <div class="space-y-2">
                        <label class="text-xs font-bold text-white/50 uppercase tracking-wider">API Key</label>
                        <div class="relative">
                            <input type="password" id="aiApiKeyInput" class="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-white focus:outline-none focus:border-[#bf5af2]/50 pr-10" placeholder="sk-...">
                            <button onclick="toggleAiApiKeyVisibility()" class="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white"><i id="toggleAiKeyVisibilityIcon" class="fas fa-eye"></i></button>
                        </div>
                    </div>
                    <button id="saveAiBtn" onclick="saveAiConfig()" class="w-full py-3 rounded-xl bg-[#bf5af2]/20 text-[#bf5af2] font-bold tracking-widest uppercase border border-[#bf5af2]/30 hover:bg-[#bf5af2]/30 transition-colors">Verify & Save</button>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();