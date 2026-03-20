(function () {
    'use strict';

    window.modalAnalytics = {
        init: function () {
            const container = document.getElementById('analyticsModal');
            if (container) {
                container.innerHTML = `
                <div class="fixed inset-0 flex items-center justify-center p-4 z-50">
                    <!-- BACKGROUND BLUR OVERLAY -->
                    <div class="absolute inset-0 bg-[#030303]/40 backdrop-blur-md" onclick="toggleModal('analyticsModal')"></div>
                    
                    <!-- MODAL CONTENT -->
                    <div class="refined-glass w-full max-w-4xl max-h-[90vh] rounded-[32px] overflow-hidden flex flex-col shadow-[0_32px_128px_rgba(0,0,0,0.5)] relative z-10 animate-apple-in">
                        <!-- Header -->
                        <div class="p-8 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                            <div>
                                <h2 class="text-2xl font-bold text-white tracking-tight">Strategy Intelligence</h2>
                                <p class="text-[10px] text-white/30 font-bold uppercase tracking-[0.2em] mt-1">Advanced Pattern Analysis Engine</p>
                            </div>
                            <button onclick="toggleModal('analyticsModal')" class="h-10 w-10 rounded-full bg-white/5 flex items-center justify-center text-white/40 hover:text-white transition-all hover:bg-white/10 border border-white/10">
                                <i class="fas fa-times text-xs"></i>
                            </button>
                        </div>

                        <!-- Content -->
                        <div class="flex-1 overflow-y-auto custom-scroll p-8 bg-black/20">
                            <!-- Strategy Top Bar -->
                            <div class="flex flex-wrap gap-4 items-center justify-between mb-10 overflow-x-auto pb-2">
                                <div class="flex gap-1.5 p-1.5 bg-white/5 rounded-2xl border border-white/5 shadow-inner">
                                    <button onclick="setAnalyticsDisplayStrategy('series')" data-analytics-tab="series" data-analytics-panel="strategyAnalyticsPanel" data-analytics-renderer="renderStrategyAnalytics"
                                        class="px-6 py-2.5 text-[10px] font-black tracking-widest rounded-xl transition-all text-white/20 hover:text-white/60">SERIES</button>
                                    <button onclick="setAnalyticsDisplayStrategy('combo')" data-analytics-tab="combo" data-analytics-panel="strategyAnalyticsPanel" data-analytics-renderer="renderStrategyAnalytics"
                                        class="px-6 py-2.5 text-[10px] font-black tracking-widest rounded-xl transition-all text-white/20 hover:text-white/60">COMBO</button>
                                    <button onclick="setAnalyticsDisplayStrategy('inside')" data-analytics-tab="inside" data-analytics-panel="strategyAnalyticsPanel" data-analytics-renderer="renderStrategyAnalytics"
                                        class="px-6 py-2.5 text-[10px] font-black tracking-widest rounded-xl transition-all text-white/20 hover:text-white/60">INSIDE</button>
                                </div>

                                <div class="flex gap-6">
                                     <button id="tabBtnIntelligence" data-analytics-tab="intelligence" data-analytics-panel="intelligencePanel" data-analytics-renderer="renderIntelligencePanel"
                                        class="pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 border-b-2 border-transparent transition-all hover:text-white/60">AI Intelligence</button>
                                     <button id="tabBtnAdvancements" data-analytics-tab="advancements" data-analytics-panel="advancementsPanel" data-analytics-renderer="renderAdvancementAnalytics"
                                        class="pb-2 text-[10px] font-black uppercase tracking-[0.2em] text-white/20 border-b-2 border-transparent transition-all hover:text-white/60">Advancements</button>
                                </div>
                            </div>

                            <!-- Panel Container -->
                            <div id="strategyAnalyticsPanel" class="space-y-10 animate-apple-in">
                                <!-- KPI Grid -->
                                <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div class="bg-white/[0.03] border border-white/[0.03] p-8 rounded-[24px] shadow-sm group hover:bg-white/[0.05] transition-all">
                                        <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Target Accuracy</div>
                                        <div id="kpiHitRate" class="text-4xl font-bold text-white tracking-tighter">0%</div>
                                        <div class="mt-3 text-[9px] text-white/10 font-bold tracking-widest">REAL-TIME TELEMETRY</div>
                                    </div>
                                    <div class="bg-white/[0.03] border border-white/[0.03] p-8 rounded-[24px] shadow-sm group hover:bg-white/[0.05] transition-all">
                                        <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Total Variance</div>
                                        <div id="kpiNet" class="text-4xl font-bold text-white tracking-tighter">0</div>
                                        <div class="mt-3 text-[9px] text-white/10 font-bold tracking-widest">NET UNIT PERFORMANCE</div>
                                    </div>
                                    <div class="bg-white/[0.03] border border-white/[0.03] p-8 rounded-[24px] shadow-sm group hover:bg-white/[0.05] transition-all">
                                        <div class="text-[9px] font-black text-white/20 uppercase tracking-[0.3em] mb-4">Active Vectors</div>
                                        <div id="kpiSignals" class="text-4xl font-bold text-white tracking-tighter">0</div>
                                        <div class="mt-3 text-[9px] text-white/10 font-bold tracking-widest">PATTERN SIGNAL COUNT</div>
                                    </div>
                                </div>

                                <!-- Graph Area -->
                                <div class="bg-black/40 border border-white/[0.05] rounded-[32px] overflow-hidden shadow-2xl">
                                    <div class="px-8 py-5 border-b border-white/[0.05] flex justify-between items-center bg-white/[0.02]">
                                        <span class="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Equity Trajectory</span>
                                        <div class="flex gap-4 text-[9px] font-black tracking-widest">
                                            <span class="text-[#30D158] opacity-60">PROFIT</span>
                                            <span class="text-[#FF453A] opacity-60">DRAWDOWN</span>
                                        </div>
                                    </div>
                                    <div id="graphContainer" class="h-80 w-full"></div>
                                </div>
                            </div>

                            <div id="intelligencePanel" class="hidden animate-apple-in">
                                <div class="flex justify-between items-center mb-8 px-2">
                                    <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Primary Neural Read</h3>
                                    <div id="intelStateChip" class="scale-110"></div>
                                </div>
                                <div id="intelligenceContent" class="space-y-6"></div>
                            </div>

                            <div id="advancementsPanel" class="hidden animate-apple-in">
                                <div class="flex justify-between items-center mb-8 px-2">
                                    <h3 class="text-[10px] font-black uppercase tracking-[0.3em] text-white/30">Advancement Log</h3>
                                </div>
                                <div id="advancementLogContainer" class="bg-white/[0.03] border border-white/[0.05] rounded-[24px] p-8 shadow-sm"></div>
                            </div>
                        </div>

                        <!-- Footer -->
                        <div class="p-6 border-t border-white/[0.05] bg-white/[0.02] flex justify-center">
                             <p class="text-[9px] text-white/20 font-black uppercase tracking-[0.4em]">NEURAL CORE ANALYTICS SYSTEM • V5.1</p>
                        </div>
                    </div>
                </div>`;
                container.classList.add('hidden');
            }
        }
    };
})();
