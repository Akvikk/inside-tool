(function () {
    window.HindsightModal = {
        init,
        open,
        close,
        render
    };

    let modalElement = null;

    function init() {
        modalElement = document.getElementById('hindsightModal');
        if (modalElement) {
            const closeButton = modalElement.querySelector('.close-button') || modalElement.querySelector('button[onclick="HindsightModal.close()"]');
            if (closeButton && !closeButton.hasAttribute('onclick')) {
                closeButton.addEventListener('click', close);
            }
        }
    }

    function open(analysis = null) {
        if (!modalElement) init();
        if (modalElement) {
            modalElement.classList.remove('hidden');
            modalElement.style.display = 'flex'; // Ensure flex for center alignment
            render(analysis);
        }
    }

    function close() {
        if (modalElement) {
            modalElement.classList.add('hidden');
            modalElement.style.display = 'none';
        }
    }

    function render(analysis) {
        const contentDiv = document.getElementById('hindsightContent');
        if (!contentDiv) return;

        if (!analysis) {
            contentDiv.innerHTML = `
                <div class="flex flex-col items-center justify-center py-8">
                    <i class="fas fa-brain text-[#bf5af2] text-4xl mb-4 animate-pulse"></i>
                    <p class="text-white/70 font-semibold uppercase tracking-wider text-xs">Analyzing session telemetry...</p>
                </div>
            `;
            return;
        }

        if (analysis.error) {
            contentDiv.innerHTML = `
                <div class="p-4 rounded-xl border border-[#ff1a33]/30 bg-[#ff1a33]/10 text-white">
                    <h4 class="font-bold text-[#ff1a33] mb-2"><i class="fas fa-exclamation-triangle mr-2"></i>Analysis Failed</h4>
                    <p class="text-sm">${analysis.error}</p>
                </div>
            `;
            return;
        }

        const { actualProfit, potentialProfit, tacticalCritique } = analysis;

        // Determine if missing out
        const diff = potentialProfit - actualProfit;
        const diffText = diff > 0 ? `+${diff}u Missed` : `Optimized`;
        const diffColor = diff > 0 ? 'text-[#FFD60A]' : 'text-[#30D158]';

        contentDiv.innerHTML = `
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="frosted-plate p-4 text-center rounded-xl border border-white/5">
                    <div class="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1">Actual Net</div>
                    <div class="text-3xl font-bold ${actualProfit >= 0 ? 'text-[#30D158]' : 'text-[#FF453A]'}">${actualProfit >= 0 ? '+' : ''}${actualProfit}u</div>
                </div>
                <div class="frosted-plate p-4 text-center rounded-xl border border-white/5 relative overflow-hidden">
                    <div class="text-white/50 text-[10px] font-bold uppercase tracking-wider mb-1">Shadow Net</div>
                    <div class="text-3xl font-bold text-white">${potentialProfit >= 0 ? '+' : ''}${potentialProfit}u</div>
                    <div class="absolute bottom-1 right-2 text-[9px] font-bold uppercase tracking-wider ${diffColor}">${diffText}</div>
                </div>
            </div>
            <div class="space-y-4">
                <h4 class="text-xs font-black tracking-widest text-[#bf5af2] uppercase flex items-center"><i class="fas fa-crosshairs mr-2"></i> Tactical Critique</h4>
                <div class="space-y-3">
                    ${tacticalCritique}
                </div>
            </div>
        `;
    }

    document.addEventListener('DOMContentLoaded', init);
})();
