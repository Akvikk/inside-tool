(function () {
    'use strict';

    const modalHtml = `
    <div id="analyticsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/40 backdrop-blur-3xl transition-opacity duration-500" onclick="toggleModal('analyticsModal')"></div>
        <div class="relative w-full max-w-5xl apple-glass rounded-[28px] shadow-[0_24px_80px_rgba(0,0,0,0.5)] overflow-hidden flex flex-col max-h-[92vh] animate-apple-in border-white/5">
            
            <!-- FUTURISTIC GLASS HEADER -->
            <div class="px-8 py-5 border-b border-white/[0.08] flex flex-wrap gap-6 justify-between items-center bg-white/[0.02] shrink-0">
                <div class="flex gap-8" id="analyticsTabs">
                    <button data-analytics-tab="strategy" data-analytics-panel="strategyAnalyticsPanel" data-analytics-renderer="renderStrategyAnalytics" onclick="window.state.currentAnalyticsTab='strategy'; window.renderAnalytics()" id="tabBtnStrategy" 
                        class="pb-3 text-[10px] font-black uppercase tracking-[0.2em] text-[#30D158] border-b-2 border-[#30D158] transition-all hover:text-[#30D158]/80">Terminal</button>
                    <button data-analytics-tab="intelligence" data-analytics-panel="intelligencePanel" data-analytics-renderer="renderIntelligencePanel" onclick="window.state.currentAnalyticsTab='intelligence'; window.renderAnalytics()" id="tabBtnIntelligence" 
                        class="pb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b-2 border-transparent transition-all hover:text-white/60">Intelligence Hub</button>
                    <button data-analytics-tab="advancements" data-analytics-panel="advancementsPanel" data-analytics-renderer="renderAdvancementAnalytics" onclick="window.state.currentAnalyticsTab='advancements'; window.renderAnalytics()" id="tabBtnAdvancements" 
                        class="pb-3 text-[10px] font-black uppercase tracking-[0.2em] text-white/30 border-b-2 border-transparent transition-all hover:text-white/60">Advancements</button>
                </div>
                
                <div class="flex items-center gap-6">
                    <div class="flex items-center gap-3">
                        <span class="text-[9px] font-bold text-white/40 uppercase tracking-widest">Feed:</span>
                        <select id="analyticsStrategySelect" onchange="if(window.setAnalyticsDisplayStrategy) window.setAnalyticsDisplayStrategy(this.value)" 
                            class="bg-white/5 border border-white/10 rounded-full px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white focus:outline-none focus:border-[#0A84FF] transition-all appearance-none cursor-pointer hover:bg-white/10">
                            <option value="series">Series Engine</option>
                            <option value="combo">Combos Engine</option>
                            <option value="inside">Inside Patterns</option>
                        </select>
                    </div>
                    <button onclick="toggleModal('analyticsModal')" class="h-8 w-8 rounded-full bg-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all border border-white/5">
                        <i class="fas fa-times text-xs"></i>
                    </button>
                </div>
            </div>

            <div id="analyticsPanel" class="flex-1 overflow-y-auto p-5 md:p-6 custom-scroll relative">
                <!-- MESH BACKGROUND DECOR -->
                <div class="absolute inset-0 mesh-bg opacity-30 pointer-events-none"></div>
                
                <div class="relative z-10 space-y-5 md:space-y-6">
                    <!-- STRATEGY TAB -->
                    <div id="strategyAnalyticsPanel" class="space-y-5 md:space-y-6 animate-apple-in">
                        
                        <!-- Premium Face Monitor -->
                        <div class="bg-white/[0.03] border border-white/[0.08] rounded-[16px] md:rounded-[20px] overflow-hidden shadow-2xl p-4 md:p-5 backdrop-blur-xl">
                            <div class="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-3 md:mb-4 flex items-center justify-between">
                                <span>Real-Time Face Velocity (100)</span>
                                <div class="h-1.5 w-1.5 rounded-full bg-[#30D158] animate-pulse shadow-[0_0_8px_#30D158]"></div>
                            </div>
                            <div id="faceHeatmapGrid" class="grid grid-cols-5 gap-2 md:gap-3">
                                <!-- Populated by JS: renderGapStats -->
                            </div>
                        </div>
                        
                        <!-- KPI GRID (Apple Card Style) -->
                        <div class="grid grid-cols-4 gap-3 md:gap-4">
                            <div class="bg-white/[0.02] border border-white/[0.05] rounded-[16px] md:rounded-[20px] p-4 md:p-5 text-center shadow-xl group transition-all hover:bg-white/[0.04] hover:border-white/[0.1]">
                                <div class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 group-hover:text-white/50 transition-colors">Success Ratio</div>
                                <div id="kpiHitRate" class="text-3xl md:text-4xl font-black tracking-tighter text-white drop-shadow-md">0%</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.05] rounded-[16px] md:rounded-[20px] p-4 md:p-5 text-center shadow-xl group transition-all hover:bg-white/[0.04] hover:border-white/[0.1]">
                                <div class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 group-hover:text-white/50 transition-colors">Yield Gain</div>
                                <div id="kpiNet" class="text-3xl md:text-4xl font-black tracking-tighter text-white drop-shadow-md">0</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.05] rounded-[16px] md:rounded-[20px] p-4 md:p-5 text-center shadow-xl group transition-all hover:bg-white/[0.04] hover:border-white/[0.1]">
                                <div class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 group-hover:text-white/50 transition-colors">Total Signals</div>
                                <div id="kpiSignals" class="text-3xl md:text-4xl font-black tracking-tighter text-white drop-shadow-md">0</div>
                            </div>
                            <div class="bg-white/[0.02] border border-white/[0.05] rounded-[16px] md:rounded-[20px] p-4 md:p-5 text-center shadow-xl group transition-all hover:bg-white/[0.04] hover:border-white/[0.1]">
                                <div class="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-2 group-hover:text-white/50 transition-colors">Current Form</div>
                                <div id="kpiForm" class="text-3xl md:text-4xl font-black tracking-tighter text-white drop-shadow-md">-</div>
                            </div>
                        </div>
                        
                        <!-- ADVANCED SPLINE CHART -->
                        <div class="bg-black/40 border border-white/[0.1] rounded-[20px] md:rounded-[24px] h-[240px] md:h-[280px] overflow-hidden relative shadow-[inset_0_2px_20px_rgba(0,0,0,0.5)]" id="graphContainer">
                            <div class="flex items-center justify-center h-full text-[10px] text-white/20 font-black uppercase tracking-[0.3em] animate-pulse">Initializing Data Stream...</div>
                        </div>
                        
                        <!-- PERFORMANCE LEDGER -->
                        <div class="bg-white/[0.02] border border-white/[0.05] rounded-[16px] md:rounded-[20px] overflow-hidden shadow-2xl backdrop-blur-md">
                            <div class="bg-white/[0.04] text-white/30 text-[9px] font-black uppercase tracking-[0.3em] p-3 md:p-4 border-b border-white/[0.05] flex justify-between items-center">
                                <span>Pattern Performance Analytics</span>
                                <i class="fas fa-microchip"></i>
                            </div>
                            <table class="w-full text-left text-xs">
                                <thead class="bg-black/20 text-white/30 uppercase text-[9px] font-black tracking-[0.2em] border-b border-white/[0.05]">
                                    <tr><th class="p-3 md:p-4">Structure</th><th class="p-3 md:p-4 text-right">Confirmed</th><th class="p-3 md:p-4 text-right">Defeats</th><th class="p-3 md:p-4 text-right">Accuracy</th></tr>
                                </thead>
                                <tbody id="heatmapBody" class="divide-y divide-white/[0.03]">
                                    <tr><td colspan="4" class="p-6 md:p-8 text-center text-white/20 italic tracking-widest text-[10px]">AWAITING PATTERN RECOGNITION...</td></tr>
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- INTELLIGENCE TAB -->
                    <div id="intelligencePanel" class="hidden animate-apple-in space-y-4 md:space-y-6">
                        <div class="flex justify-between items-center mb-4 md:mb-6">
                            <div class="text-[10px] font-black uppercase tracking-[0.3em] text-[#bf5af2] flex items-center bg-[#bf5af2]/10 px-3 md:px-4 py-1.5 md:py-2 rounded-full border border-[#bf5af2]/20 shadow-[0_0_15px_rgba(191,90,242,0.1)]">
                                <i class="fas fa-brain mr-2 md:mr-3"></i> Neural Interface Status
                            </div>
                            <div class="flex items-center gap-3 md:gap-4">
                                <span class="text-[9px] font-black uppercase tracking-[0.2em] text-white/20">Protocol:</span>
                                <div class="flex bg-black/40 rounded-full p-1 border border-white/10 backdrop-blur-md">
                                    <button onclick="window.changeIntelMode && window.changeIntelMode('brief')" class="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all hover:text-white/80 ${window.state && window.state.currentIntelligenceMode === 'brief' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:bg-white/5'}">Brief</button>
                                    <button onclick="window.changeIntelMode && window.changeIntelMode('diagnostic')" class="px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all hover:text-white/80 ${window.state && window.state.currentIntelligenceMode === 'diagnostic' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30 hover:bg-white/5'}">Diagnostic</button>
                                </div>
                            </div>
                        </div>
                        
                        <div class="grid grid-cols-3 gap-4 md:gap-6 items-center mb-5 md:mb-8 p-4 md:p-6 bg-white/[0.02] border border-white/[0.08] rounded-[16px] md:rounded-[20px] shadow-inner backdrop-blur-xl">
                            <div class="flex flex-col gap-1">
                                <div class="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">Operational State</div>
                                <div id="intelStateChip" class="w-fit font-black text-[11px] tracking-[0.2em] uppercase text-gray-400">IDLE</div>
                            </div>
                            <div class="flex flex-col gap-1 text-center">
                                <div class="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">Logic Summary</div>
                                <div id="intelCheckpointSummary" class="text-[10px] font-black tracking-[0.1em] uppercase text-gray-500">Wait for Sample</div>
                            </div>
                            <div class="text-right flex flex-col gap-1">
                                <div class="text-[8px] font-black uppercase tracking-[0.3em] text-white/20">Re-Eval Spin</div>
                                <div id="intelNextCheckpoint" class="text-2xl font-black tracking-tighter text-gray-500 drop-shadow-md">14</div>
                            </div>
                        </div>

                        <div id="intelligenceContent" class="space-y-4 md:space-y-6"></div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();