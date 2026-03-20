(function () {
    'use strict';

    const modalHtml = `
    <div id="analyticsModal" class="modal hidden fixed inset-0 z-[60] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md" onclick="toggleModal('analyticsModal')"></div>
        <div class="relative w-full max-w-4xl bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div class="px-6 py-4 border-b border-white/5 flex flex-wrap gap-4 justify-between items-center bg-white/5 shrink-0">
                <div class="flex gap-6" id="analyticsTabs">
                    <button data-analytics-tab="strategy" data-analytics-panel="strategyAnalyticsPanel" data-analytics-renderer="renderStrategyAnalytics" onclick="window.state.currentAnalyticsTab='strategy'; window.renderAnalytics()" id="tabBtnStrategy" class="pb-2 text-xs font-bold uppercase tracking-widest text-[#30D158] border-b-2 border-[#30D158] transition-all">Strategy</button>
                    <button data-analytics-tab="intelligence" data-analytics-panel="intelligencePanel" data-analytics-renderer="renderIntelligencePanel" onclick="window.state.currentAnalyticsTab='intelligence'; window.renderAnalytics()" id="tabBtnIntelligence" class="pb-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all">Intelligence</button>
                    <button data-analytics-tab="advancements" data-analytics-panel="advancementsPanel" data-analytics-renderer="renderAdvancementAnalytics" onclick="window.state.currentAnalyticsTab='advancements'; window.renderAnalytics()" id="tabBtnAdvancements" class="pb-2 text-xs font-bold uppercase tracking-widest text-gray-400 border-b-2 border-transparent transition-all">Advancements</button>
                </div>
                <div class="flex items-center gap-4">
                    <select id="analyticsStrategySelect" onchange="if(window.setAnalyticsDisplayStrategy) window.setAnalyticsDisplayStrategy(this.value)" class="bg-black/40 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-[#0A84FF]">
                        <option value="series">Series Engine</option>
                        <option value="combo">Combos Engine</option>
                        <option value="inside">Inside Patterns</option>
                    </select>
                    <button onclick="toggleModal('analyticsModal')" class="text-gray-400 hover:text-white transition-colors">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
            <div id="analyticsPanel" class="flex-1 overflow-y-auto p-6 custom-scroll">
                
                <!-- STRATEGY TAB -->
                <div id="strategyAnalyticsPanel" class="space-y-6">
                    
                    <!-- Global Face Heatmap (New) -->
                    <div class="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg p-4">
                        <div class="text-[10px] font-black uppercase tracking-widest text-white/50 mb-3 flex items-center justify-between">
                            <span>Live Face Heatmap (Rolling 100)</span>
                            <i class="fas fa-chart-bar text-white/30"></i>
                        </div>
                        <div id="faceHeatmapGrid" class="grid grid-cols-5 gap-2">
                            <!-- Populated by JS -->
                        </div>
                    </div>
                    
                    <!-- KPI Header -->
                    <div class="grid grid-cols-4 gap-4">
                        <div class="bg-black/40 border border-white/10 rounded-xl p-4 text-center shadow-inner">
                            <div class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Global Hit Rate</div>
                            <div id="kpiHitRate" class="text-3xl font-semibold tracking-tight text-white">0%</div>
                        </div>
                        <div class="bg-black/40 border border-white/10 rounded-xl p-4 text-center shadow-inner">
                            <div class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Theoretical Net</div>
                            <div id="kpiNet" class="text-3xl font-semibold tracking-tight text-white">0</div>
                        </div>
                        <div class="bg-black/40 border border-white/10 rounded-xl p-4 text-center shadow-inner">
                            <div class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Total Signals</div>
                            <div id="kpiSignals" class="text-3xl font-semibold tracking-tight text-white">0</div>
                        </div>
                        <div class="bg-black/40 border border-white/10 rounded-xl p-4 text-center shadow-inner">
                            <div class="text-[10px] font-bold text-white/50 uppercase tracking-wider mb-1">Current Form</div>
                            <div id="kpiForm" class="text-3xl font-semibold tracking-tight text-white">-</div>
                        </div>
                    </div>
                    
                    <!-- Strategy Chart -->
                    <div class="bg-black/20 border border-white/10 rounded-xl h-[240px] overflow-hidden relative" id="graphContainer">
                        <div class="flex items-center justify-center h-full text-xs text-[#8E8E93] font-mono animate-pulse">Waiting for Data...</div>
                    </div>
                    
                    <!-- Pattern Performance -->
                    <div class="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg">
                        <div class="bg-black/30 text-white/40 text-[9px] font-black uppercase tracking-widest p-3 border-b border-white/5">Pattern Performance</div>
                        <table class="w-full text-left text-xs">
                            <thead class="bg-black/10 text-white/30 uppercase text-[9px] tracking-wider border-b border-white/5">
                                <tr><th class="p-3">Pattern</th><th class="p-3 text-right">Wins</th><th class="p-3 text-right">Losses</th><th class="p-3 text-right">Win Rate</th></tr>
                            </thead>
                            <tbody id="heatmapBody" class="divide-y divide-white/5">
                                <tr><td colspan="4" class="p-8 text-center text-[#8E8E93] italic">No patterns recorded yet</td></tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                <!-- INTELLIGENCE TAB -->
                <div id="intelligencePanel" class="hidden">
                    <div class="flex justify-between items-center mb-4">
                        <div class="text-xs font-bold uppercase tracking-widest text-[#bf5af2] flex items-center"><i class="fas fa-brain mr-2"></i> Local Brain Status</div>
                        <div class="flex items-center gap-2">
                            <span class="text-[9px] font-bold uppercase tracking-wider text-white/40">View Mode:</span>
                            <div class="flex bg-black/40 rounded-lg p-1 border border-white/10">
                                <button onclick="window.changeIntelMode && window.changeIntelMode('brief')" class="px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors hover:text-white/80 ${window.state && window.state.currentIntelligenceMode === 'brief' ? 'bg-white/20 text-white' : 'text-white/40'}">Brief</button>
                                <button onclick="window.changeIntelMode && window.changeIntelMode('diagnostic')" class="px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors hover:text-white/80 ${window.state && window.state.currentIntelligenceMode === 'diagnostic' ? 'bg-white/20 text-white' : 'text-white/40'}">Diagnostic</button>
                                <button onclick="window.changeIntelMode && window.changeIntelMode('minimal')" class="px-3 py-1 rounded text-[9px] font-bold uppercase tracking-wider transition-colors hover:text-white/80 ${window.state && window.state.currentIntelligenceMode === 'minimal' ? 'bg-white/20 text-white' : 'text-white/40'}">Minimal</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="flex gap-4 items-center mb-4 p-3 bg-black/30 border border-white/5 rounded-xl">
                        <div id="intelStateChip" class="font-black text-[9px] tracking-widest uppercase text-gray-400 bg-gray-400/10 border border-gray-400/20 px-2 py-0.5 rounded">IDLE</div>
                        <div id="intelCheckpointSummary" class="text-[10px] font-bold tracking-widest uppercase text-gray-500 flex-1">Waiting for valid sample</div>
                        <div class="text-right">
                            <div class="text-[8px] font-bold uppercase tracking-widest text-white/40">Next Read In</div>
                            <div id="intelNextCheckpoint" class="text-lg font-black tracking-tighter text-gray-500">14</div>
                        </div>
                    </div>

                    <div id="intelligenceContent"></div>
                </div>
                
                <!-- ADVANCEMENTS TAB -->
                <div id="advancementsPanel" class="hidden">
                    <div class="bg-white/5 border border-white/10 rounded-xl overflow-hidden shadow-lg">
                        <div class="bg-black/30 text-white/40 text-[9px] font-black uppercase tracking-widest p-4 border-b border-white/5 flex justify-between items-center">
                            <span>Event Ledger</span>
                            <span class="text-[#0A84FF]"><i class="fas fa-satellite-dish mr-1"></i> Live</span>
                        </div>
                        <div id="advancementLogContainer" class="p-0">
                            <!-- Populated by JS -->
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();