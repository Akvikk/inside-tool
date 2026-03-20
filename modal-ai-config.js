(function () {
    const template = document.createElement('template');
    template.innerHTML = `
    <div id="aiConfigModal" class="fixed inset-0 z-[80] bg-black/60 backdrop-blur-md hidden flex items-center justify-center p-4" onclick="toggleModal('aiConfigModal')">
        <div class="glass-menu modal-surface w-full max-w-md p-6 space-y-5" onclick="event.stopPropagation()">
            <div class="flex items-start justify-between gap-4">
                <div>
                    <h2 class="text-white font-semibold text-lg">AI Configuration</h2>
                    <div id="aiConnectionText" class="text-[11px] text-white/45 mt-1">Turn on AI Master, add your key, then verify the connection.</div>
                </div>
                <div id="aiStatusBadge" class="text-[9px] font-bold bg-white/10 px-2.5 py-1 rounded-md text-white/50 shadow-inner">NOT CONNECTED</div>
            </div>

            <div class="rounded-xl border border-white/10 bg-black/30 p-4">
                <div class="flex items-center justify-between gap-4">
                    <div>
                        <div class="text-xs font-semibold text-white mb-0.5">AI Master</div>
                        <div class="text-[10px] text-gray-400">Unlock chat, audits, and live neural overlays.</div>
                        <div id="aiMasterStatusText" class="text-[10px] text-white/35 mt-1">Disabled</div>
                    </div>
                    <button id="aiMasterSwitch" onclick="toggleAiMasterSwitch()" class="w-14 h-8 rounded-full bg-white/10 border border-white/20 relative transition-colors shrink-0">
                        <div id="aiSwitchKnob" class="absolute top-[3px] left-[3px] w-6 h-6 rounded-full bg-gray-400 transition-all duration-200"></div>
                    </button>
                </div>
            </div>

            <div id="aiVaultSection" class="hidden space-y-4">
                <div>
                    <label for="aiProviderSelect" class="text-[10px] font-semibold uppercase tracking-wider text-gray-300">AI Provider</label>
                    <select id="aiProviderSelect" class="mt-2 w-full bg-black/50 border border-white/10 rounded-lg text-white p-3 text-sm outline-none focus:border-[#0A84FF]/50 transition-colors">
                        <option value="gemini" class="bg-gray-900">Google Gemini</option>
                        <option value="openai" class="bg-gray-900">OpenAI</option>
                    </select>
                </div>

                <div>
                    <label for="aiApiKeyInput" class="text-[10px] font-semibold uppercase tracking-wider text-gray-300">API Key</label>
                    <div class="relative mt-2">
                        <input type="password" id="aiApiKeyInput" class="w-full bg-black/50 border border-white/10 rounded-lg text-white p-3 pr-12" placeholder="Paste your API key" autocomplete="off" spellcheck="false">
                        <button type="button" id="toggleAiKeyVisibilityBtn" onclick="toggleAiApiKeyVisibility()" class="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-md border border-white/10 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white transition-colors flex items-center justify-center">
                            <i id="toggleAiKeyVisibilityIcon" class="fas fa-eye"></i>
                        </button>
                    </div>
                    <div class="mt-2 text-[10px] text-white/40">Stored locally in browser session data for this tool.</div>
                </div>

                <div class="flex gap-2">
                    <button onclick="clearAiConfig()" class="flex-1 py-2.5 rounded-lg font-semibold text-[10px] uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 transition-colors">Clear Key</button>
                    <button id="saveAiBtn" onclick="saveAiConfig()" class="flex-[2] py-2.5 rounded-lg font-semibold text-[10px] uppercase tracking-wider bg-[#30D158]/20 hover:bg-[#30D158]/30 text-[#30D158] border border-[#30D158]/30 transition-colors shadow-[0_0_15px_rgba(48,209,88,0.15)]">Verify & Save</button>
                </div>
            </div>
        </div>
    </div>`;
    document.body.appendChild(template.content);
})();