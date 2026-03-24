(function () {
    'use strict';

    const modalHtml = `
    <div id="analyticsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-xl transition-opacity duration-500" onclick="toggleModal('analyticsModal')"></div>
        <div class="relative w-full max-w-5xl bg-[#1C1C1E]/80 backdrop-blur-[40px] saturate-150 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] border border-white/[0.08]">
            
            <!-- FUTURISTIC GLASS HEADER -->
            <div class="px-6 py-4 border-b border-white/[0.08] flex flex-wrap gap-6 justify-between items-center bg-white/[0.02] shrink-0">
                <div class="flex gap-6" id="analyticsTabs">
                    <button data-analytics-tab="strategy" data-analytics-panel="strategyAnalyticsPanel" data-analytics-renderer="renderStrategyAnalytics" onclick="window.state.currentAnalyticsTab='strategy'; window.renderAnalytics()" id="tabBtnStrategy" 
                        class="pb-2 text-sm font-medium tracking-normal text-white border-b-2 border-white transition-all duration-300 ease-out">Terminal</button>
                    <button data-analytics-tab="intelligence" data-analytics-panel="intelligencePanel" data-analytics-renderer="renderIntelligencePanel" onclick="window.state.currentAnalyticsTab='intelligence'; window.renderAnalytics()" id="tabBtnIntelligence" 
                        class="pb-2 text-sm font-medium tracking-normal text-white/50 border-b-2 border-transparent hover:text-white/80 transition-all duration-300 ease-out">Intelligence Hub</button>
                    <button data-analytics-tab="advancements" data-analytics-panel="advancementsPanel" data-analytics-renderer="renderAdvancementAnalytics" onclick="window.state.currentAnalyticsTab='advancements'; window.renderAnalytics()" id="tabBtnAdvancements" 
                        class="pb-2 text-sm font-medium tracking-normal text-white/50 border-b-2 border-transparent hover:text-white/80 transition-all duration-300 ease-out">Advancements</button>
                </div>
                
                <div class="flex items-center gap-4">
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-medium text-white/50">Feed:</span>
                        <select id="analyticsStrategySelect" onchange="if(window.setAnalyticsDisplayStrategy) window.setAnalyticsDisplayStrategy(this.value)" 
                            class="bg-white/5 hover:bg-white/10 border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs font-medium text-white/90 focus:outline-none focus:border-[#0A84FF] transition-all duration-300 ease-out appearance-none cursor-pointer">
                            <option value="series">Series Engine</option>
                            <option value="combo">Combos Engine</option>
                            <option value="inside">Inside Patterns</option>
                        </select>
                    </div>
                    <button onclick="toggleModal('analyticsModal')" class="h-7 w-7 rounded-full bg-white/5 flex items-center justify-center text-white/50 hover:text-white hover:bg-white/10 transition-all duration-300 ease-out border border-white/[0.08]">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            </div>

            <div id="analyticsPanel" class="flex-1 overflow-y-auto p-5 md:p-6 custom-scroll relative">
                
                <div class="relative z-10 space-y-5">
                    <!-- STRATEGY TAB -->
                    <div id="strategyAnalyticsPanel" class="space-y-5">
                        
                        <!-- Premium Face Monitor -->
                        <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm p-4 backdrop-blur-xl">
                            <div class="text-xs font-medium text-white/50 mb-3 flex items-center justify-between tracking-normal">
                                <span>Real-Time Face Velocity (100)</span>
                                <div class="h-2 w-2 rounded-full bg-[#32D74B] animate-pulse"></div>
                            </div>
                            <div id="faceHeatmapGrid" class="grid grid-cols-5 gap-2">
                                <!-- Populated by JS: renderGapStats -->
                            </div>
                        </div>
                        
                        <!-- KPI GRID (Apple Card Style) -->
                        <div class="grid grid-cols-4 gap-3">
                            <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm transition-all duration-300 ease-out hover:bg-white/[0.05]">
                                <div class="text-xs font-medium text-white/50 tracking-normal mb-1">Success Ratio</div>
                                <div id="kpiHitRate" class="text-2xl md:text-3xl font-semibold tracking-tight text-white/90">0%</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm transition-all duration-300 ease-out hover:bg-white/[0.05]">
                                <div class="text-xs font-medium text-white/50 tracking-normal mb-1">Yield Gain</div>
                                <div id="kpiNet" class="text-2xl md:text-3xl font-semibold tracking-tight text-white/90">0</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm transition-all duration-300 ease-out hover:bg-white/[0.05]">
                                <div class="text-xs font-medium text-white/50 tracking-normal mb-1">Total Signals</div>
                                <div id="kpiSignals" class="text-2xl md:text-3xl font-semibold tracking-tight text-white/90">0</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm transition-all duration-300 ease-out hover:bg-white/[0.05]">
                                <div class="text-xs font-medium text-white/50 tracking-normal mb-1">Current Form</div>
                                <div id="kpiForm" class="text-2xl md:text-3xl font-semibold tracking-tight text-white/90">-</div>
                            </div>
                        </div>
                        
                        <!-- ADVANCED SPLINE CHART -->
                        <div class="bg-black/20 border border-white/[0.08] rounded-2xl h-[240px] md:h-[260px] overflow-hidden relative shadow-inner" id="graphContainer">
                            <div class="flex items-center justify-center h-full text-xs text-white/40 font-medium animate-pulse">Initializing Data Stream...</div>
                        </div>
                        
                        <!-- PERFORMANCE LEDGER -->
                        <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm backdrop-blur-md">
                            <div class="bg-white/[0.02] text-white/70 text-sm font-medium p-4 border-b border-white/[0.08] flex justify-between items-center">
                                <span>Pattern Performance Analytics</span>
                                <i class="fas fa-microchip text-white/30"></i>
                            </div>
                            <table class="w-full text-left text-sm">
                                <thead class="bg-black/20 text-white/50 font-medium text-xs border-b border-white/[0.08]">
                                    <tr><th id="analyticsStructureHeader" class="p-3 md:p-4 font-medium">Structure</th><th class="p-3 md:p-4 text-right font-medium">Confirmed</th><th class="p-3 md:p-4 text-right font-medium">Defeats</th><th class="p-3 md:p-4 text-right font-medium">Accuracy</th></tr>
                                </thead>
                                <tbody id="heatmapBody" class="divide-y divide-white/[0.08]">
                                    <tr><td colspan="4" class="p-6 md:p-8 text-center text-white/40 italic text-xs">Awaiting pattern recognition...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- INTELLIGENCE TAB -->
                    <div id="intelligencePanel" class="hidden space-y-5">
                        <div class="flex justify-between items-center">
                            <div class="text-xs font-medium text-[#AF52DE] flex items-center bg-[#AF52DE]/10 px-3 py-1.5 rounded-lg border border-[#AF52DE]/20">
                                <i class="fas fa-brain mr-2"></i> Neural Interface Status
                            </div>
                            <div class="flex items-center gap-3">
                                <span class="text-xs font-medium text-white/50">Protocol:</span>
                                <div class="flex bg-black/20 rounded-lg p-0.5 border border-white/[0.08] backdrop-blur-md">
                                    <button onclick="window.changeIntelMode && window.changeIntelMode('brief')" class="px-3 py-1 rounded-md text-xs font-medium transition-all duration-300 ease-out ${window.state && window.state.currentIntelligenceMode === 'brief' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:bg-white/5'}">Brief</button>
                                    <button onclick="window.changeIntelMode && window.changeIntelMode('diagnostic')" class="px-3 py-1 rounded-md text-xs font-medium transition-all duration-300 ease-out ${window.state && window.state.currentIntelligenceMode === 'diagnostic' ? 'bg-white/10 text-white shadow-sm' : 'text-white/50 hover:bg-white/5'}">Diagnostic</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-4 items-center p-5 bg-white/[0.02] border border-white/[0.08] rounded-2xl shadow-sm backdrop-blur-xl">
                            <div class="flex flex-col gap-1">
                                <div class="text-xs font-medium text-white/50">Operational State</div>
                                <div id="intelStateChip" class="w-fit font-medium text-sm text-white/90">IDLE</div>
                            </div>
                            <div class="flex flex-col gap-1 text-center">
                                <div class="text-xs font-medium text-white/50">Logic Summary</div>
                                <div id="intelCheckpointSummary" class="text-sm font-medium text-white/90">Wait for Sample</div>
                            </div>
                            <div class="text-right flex flex-col gap-1">
                                <div class="text-xs font-medium text-white/50">Re-Eval Spin</div>
                                <div id="intelNextCheckpoint" class="text-3xl font-light tracking-tight text-white/90 drop-shadow-sm">14</div>
                            </div>
                        </div>

                        <div id="intelligenceContent" class="space-y-4"></div>
                    </div>

                    <!-- ADVANCEMENTS TAB -->
                    <div id="advancementsPanel" class="hidden space-y-5">
                        <div class="flex justify-between items-center">
                            <div class="text-xs font-medium text-[#FF9F0A] flex items-center bg-[#FF9F0A]/10 px-3 py-1.5 rounded-lg border border-[#FF9F0A]/20">
                                <i class="fas fa-trophy mr-2"></i> Session Milestones
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-4">
                            <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm">
                                <div class="text-xs font-medium text-white/50 mb-1">Total Spins</div>
                                <div id="advTotalSpins" class="text-2xl font-semibold tracking-tight text-white/90">0</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm">
                                <div class="text-xs font-medium text-white/50 mb-1">Signals Fired</div>
                                <div id="advTotalSignals" class="text-2xl font-semibold tracking-tight text-white/90">0</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl p-4 text-center shadow-sm">
                                <div class="text-xs font-medium text-white/50 mb-1">Win Rate</div>
                                <div id="advWinRate" class="text-2xl font-semibold tracking-tight text-white/90">0%</div>
                            </div>
                        </div>

                        <div class="bg-white/[0.02] border border-white/[0.08] rounded-2xl overflow-hidden shadow-sm">
                            <div class="bg-white/[0.02] text-white/70 text-sm font-medium p-4 border-b border-white/[0.08] flex justify-between items-center">
                                <span>Advancement Log</span>
                                <i class="fas fa-stream text-white/30"></i>
                            </div>
                            <div id="advancementLogContainer" class="p-4 min-h-[120px]">
                                <div class="text-white/30 text-center py-8 text-[11px] font-black uppercase tracking-widest">Awaiting threshold breaches.</div>
                            </div>
                        </div>
                    </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();