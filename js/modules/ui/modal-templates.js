(function () {
    const modalContainer = document.createElement('div');
    modalContainer.id = 'modal-templates-container';
    modalContainer.innerHTML = `
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
    </div>

    <div id="analyticsModal"
        class="fixed inset-0 bg-black/60 backdrop-blur-md hidden z-50 flex items-center justify-center p-4"
        onclick="toggleModal('analyticsModal')">
        <div class="glass-menu modal-surface w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden"
            onclick="event.stopPropagation()">
            <div class="border-b border-white/5 bg-black/20">
                <div class="px-6 py-3 border-b border-white/5 flex justify-center items-center gap-3">
                    <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Strategy View:</span>
                    <select id="analyticsStrategySelect" onchange="window.setAnalyticsDisplayStrategy && window.setAnalyticsDisplayStrategy(this.value)"
                        class="bg-black/60 border border-white/10 rounded-lg py-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-white focus:outline-none focus:ring-1 focus:ring-[#30D158] transition-all cursor-pointer shadow-2xl backdrop-blur-md">
                        <option value="series">SERIES VIEW</option>
                        <option value="combo">COMBOS VIEW</option>
                        <option value="inside">INSIDE VIEW</option>
                        <option value="user">MY BETS</option>
                    </select>
                </div>
                <div class="px-6 pt-3 flex gap-6">
                    <button onclick="switchAnalyticsTab('strategy')" id="tabBtnStrategy" data-analytics-tab="strategy"
                        data-analytics-panel="strategyAnalyticsPanel" data-analytics-renderer="renderStrategyAnalytics"
                        class="pb-2 text-xs font-semibold uppercase tracking-widest text-[#30D158] border-b-2 border-[#30D158] transition-all">Metrics</button>
                    <button onclick="switchAnalyticsTab('intelligence')" id="tabBtnIntelligence"
                        data-analytics-tab="intelligence" data-analytics-panel="intelligencePanel"
                        data-analytics-renderer="renderIntelligencePanel"
                        class="pb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all">Intelligence</button>
                    <button onclick="switchAnalyticsTab('advancements')" id="tabBtnAdvancements"
                        data-analytics-tab="advancements" data-analytics-panel="advancementsPanel"
                        data-analytics-renderer="renderAdvancementAnalytics"
                        class="pb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all">Advancements</button>
                </div>
            </div>
            <div class="flex-1 overflow-y-auto p-6 space-y-5 custom-scroll">
                <div id="strategyAnalyticsPanel" class="space-y-5">
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div class="frosted-plate p-3 text-center">
                            <div class="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Global Hit
                                Rate</div>
                            <div id="kpiHitRate" class="text-2xl font-mono font-semibold text-white">0%</div>
                        </div>
                        <div class="frosted-plate p-3 text-center">
                            <div class="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">
                                Theoretical Net</div>
                            <div id="kpiNet" class="text-2xl font-mono font-semibold text-white">0</div>
                        </div>
                        <div class="frosted-plate p-3 text-center">
                            <div class="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Total
                                Signals</div>
                            <div id="kpiSignals" class="text-2xl font-mono font-semibold text-white">0</div>
                        </div>
                        <div class="frosted-plate p-3 text-center">
                            <div class="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Form</div>
                            <div id="kpiForm" class="text-2xl font-mono font-semibold text-gray-400">-</div>
                        </div>
                    </div>
                    <div class="frosted-plate p-4 relative z-10">
                        <div class="text-white/45 text-[10px] font-semibold uppercase tracking-wider mb-2">Signal Trend</div>
                        <div id="graphContainer" class="h-36 w-full relative"></div>
                    </div>
                    <div class="frosted-plate overflow-hidden">
                        <table class="w-full text-left text-xs">
                            <thead class="text-white/50 border-b border-white/5">
                                <tr>
                                    <th class="p-3 font-semibold">Name</th>
                                    <th class="p-3 font-semibold text-right">Wins</th>
                                    <th class="p-3 font-semibold text-right">Losses</th>
                                    <th class="p-3 font-semibold text-right w-24">Eff %</th>
                                </tr>
                            </thead>
                            <tbody id="heatmapBody" class="divide-y divide-white/5"></tbody>
                        </table>
                    </div>
                </div>

                <div class="glass-panel p-4 border border-white/5 relative overflow-hidden group">
                    <div class="flex items-center justify-between mb-3">
                        <div class="flex items-center gap-2">
                            <i class="fas fa-brain text-[#bf5af2] drop-shadow-[0_0_8px_rgba(191,90,242,0.5)]"></i>
                            <span class="text-[10px] font-bold tracking-widest text-white/40 uppercase">AI Tactical Brain</span>
                        </div>
                        <div id="aiBrainScore" class="text-[14px] font-bold text-[#bf5af2] opacity-0 transition-opacity duration-500">0%</div>
                    </div>
                    <div id="aiBrainVerdict" class="text-[11px] leading-relaxed text-white/80 italic line-clamp-2 min-h-[2.5em]">Awaiting session data for tactical audit...</div>
                    <div id="aiBrainPivot" class="mt-2 text-[10px] font-semibold text-[#bf5af2]/80 uppercase tracking-wider hidden">Pivot: SERIES DETECTED</div>
                    <button onclick="triggerAiAudit(this)" class="mt-3 w-full py-2 bg-[#bf5af2]/10 hover:bg-[#bf5af2]/20 border border-[#bf5af2]/30 rounded text-[9px] font-black tracking-widest text-[#bf5af2] transition-all uppercase">Initialize Tactical Review</button>
                </div>

                <div id="intelligencePanel" class="hidden space-y-5">
                    <div class="frosted-plate p-4 flex justify-between items-center gap-4">
                        <div class="flex-1">
                            <div class="text-white/40 text-[9px] font-semibold uppercase tracking-wider mb-0.5">Engine Status</div>
                            <div id="intelStateChip" class="intel-state-chip">IDLE</div>
                        </div>
                        <div class="flex-1 text-center border-l border-white/5">
                            <div class="text-white/40 text-[9px] font-semibold uppercase tracking-wider mb-0.5">Checkpoint</div>
                            <div id="intelCheckpointSummary" class="intel-toolbar-title">Sample Incomplete</div>
                        </div>
                        <div class="flex-1 text-right border-l border-white/5">
                            <div class="text-white/40 text-[9px] font-semibold uppercase tracking-wider mb-0.5">Next Window</div>
                            <div id="intelNextCheckpoint" class="intel-next-value">14</div>
                        </div>
                    </div>
                    <div class="flex justify-center items-center gap-3">
                        <span class="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Intelligence Mode:</span>
                        <div class="flex bg-black/40 rounded-lg p-0.5 border border-white/5 w-64 relative">
                            <button onclick="changeIntelMode('brief')" class="flex-1 text-[9px] font-semibold uppercase tracking-wider py-1.5 text-white transition-colors relative z-10">Brief</button>
                            <button onclick="changeIntelMode('diagnostic')" class="flex-1 text-[9px] font-semibold uppercase tracking-wider py-1.5 text-gray-400 transition-colors relative z-10">Diagnostic</button>
                            <button onclick="changeIntelMode('minimal')" class="flex-1 text-[9px] font-semibold uppercase tracking-wider py-1.5 text-gray-400 transition-colors relative z-10">Minimal</button>
                        </div>
                    </div>
                    <div id="intelligenceContent" class="space-y-5"></div>
                </div>

                <div id="advancementsPanel" class="hidden space-y-4">
                    <div id="advancementLogContainer" class="space-y-2"></div>
                </div>

                <div class="text-center pt-2">
                    <button onclick="resetData()" class="text-[10px] font-semibold uppercase tracking-widest border px-4 py-2 rounded-lg transition-colors hover:bg-[#ff1a33]/10 text-[#ff1a33] border-[#ff1a33]/30">RESET SESSION</button>
                </div>
            </div>
        </div>
    </div>

    <div id="patternDetailModal" class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md hidden flex items-center justify-center p-4" onclick="toggleModal('patternDetailModal')">
        <div class="glass-menu modal-surface w-full max-w-xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
            <div id="patternDetailBody"></div>
        </div>
    </div>

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

                <div class="rounded-xl border border-white/10 bg-black/30 p-4">
                    <div class="flex items-center justify-between gap-4">
                        <div>
                            <div class="text-xs font-semibold text-white mb-0.5">AI Hindsight</div>
                            <div class="text-[10px] text-gray-400">Enable neural prediction engine</div>
                        </div>
                        <button id="aiHindsightToggle" onclick="toggleNeuralPrediction()" class="w-10 h-5 rounded-full bg-white/10 border border-white/20 relative transition-colors shrink-0">
                            <div class="absolute top-1 left-1 w-3 h-3 rounded-full bg-gray-500 transition-all"></div>
                        </button>
                    </div>
                </div>

                <div class="flex gap-2">
                    <button onclick="clearAiConfig()" class="flex-1 py-2.5 rounded-lg font-semibold text-[10px] uppercase tracking-wider bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 transition-colors">Clear Key</button>
                    <button id="saveAiBtn" onclick="saveAiConfig()" class="flex-[2] py-2.5 rounded-lg font-semibold text-[10px] uppercase tracking-wider bg-[#30D158]/20 hover:bg-[#30D158]/30 text-[#30D158] border border-[#30D158]/30 transition-colors shadow-[0_0_15px_rgba(48,209,88,0.15)]">Verify & Save</button>
                </div>
            </div>
        </div>
    </div>

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
                    <button id="aiSendBtn" onclick="sendAiChatMessage()" class="h-12 w-12 rounded-xl bg-[#bf5af2]/20 hover:bg-[#bf5af2]/30 text-[#bf5af2] border border-[#bf5af2]/30 transition-colors flex items-center justify-center shrink-0">
                        <i class="fas fa-paper-plane"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <div id="confirmModal" class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md hidden flex items-center justify-center p-4">
        <div class="glass-menu modal-surface p-6 text-center max-w-sm">
            <h3 class="text-white font-semibold text-lg mb-4">Reset Session?</h3>
            <div class="flex gap-3">
                <button onclick="toggleModal('confirmModal')" class="flex-1 py-2 rounded-lg bg-white/5 text-gray-300">Cancel</button>
                <button id="confirmResetBtn" class="flex-1 py-2 rounded-lg bg-[#ff1a33]/20 text-[#ff1a33]">Reset</button>
            </div>
        </div>
    </div>

    <div id="hindsightModal" class="fixed inset-0 z-[90] bg-black/60 backdrop-blur-md hidden flex items-center justify-center p-4" onclick="HindsightModal.close()">
        <div class="glass-menu modal-surface w-full max-w-lg p-6 space-y-5" onclick="event.stopPropagation()">
            <div class="flex justify-between items-center">
                <h2 class="text-white font-semibold text-lg">🧠 AI Hindsight Review</h2>
                <button onclick="HindsightModal.close()" class="text-gray-400 hover:text-white transition-colors">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div id="hindsightContent" class="custom-scroll overflow-y-auto max-h-[60vh]">
                <!-- AI content will be rendered here -->
            </div>
        </div>
    </div>
    `;
    document.body.appendChild(modalContainer);
})();