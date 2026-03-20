(function () {
    const template = document.createElement('template');
    template.innerHTML = `
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
                            <div class="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Global Hit Rate</div>
                            <div id="kpiHitRate" class="text-2xl font-mono font-semibold text-white">0%</div>
                        </div>
                        <div class="frosted-plate p-3 text-center">
                            <div class="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Theoretical Net</div>
                            <div id="kpiNet" class="text-2xl font-mono font-semibold text-white">0</div>
                        </div>
                        <div class="frosted-plate p-3 text-center">
                            <div class="text-white/50 text-[9px] font-semibold uppercase tracking-wider mb-1">Total Signals</div>
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
            </div>
        </div>
    </div>`;
    document.body.appendChild(template.content);
})();