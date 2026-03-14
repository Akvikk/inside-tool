
(function() {
    // --- PRIVATE STATE ---
    let isModalOpen = false;

    // --- PUBLIC INTERFACE ---
    window.HindsightModal = {
        init: initHindsightModal,
        open: openHindsightModal,
        close: closeHindsightModal,
        render: renderHindsightModal,
    };

    // Export to window for global access
    window.openHindsightModal = openHindsightModal;

    function initHindsightModal() {
        const modal = document.getElementById('hindsightModal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    closeHindsightModal();
                }
            });
        }
    }

    async function openHindsightModal() {
        if (isModalOpen) return;

        const modal = document.getElementById('hindsightModal');
        if (!modal) return;

        isModalOpen = true;
        modal.classList.remove('hidden');

        // Show loading state
        renderHindsightModal({ isLoading: true });

        try {
            const { history, userStats, engineStats } = window;
            const review = await window.AiBrain.requestFullSessionReview(history, userStats, engineStats);
            renderHindsightModal({ review });
        } catch (error) {
            renderHindsightModal({ error });
        }
    }

    function closeHindsightModal() {
        const modal = document.getElementById('hindsightModal');
        if (modal) {
            modal.classList.add('hidden');
        }
        isModalOpen = false;
    }

    function renderHindsightModal(data) {
        const content = document.getElementById('hindsightContent');
        if (!content) return;

        if (data.isLoading) {
            content.innerHTML = '<div class="text-center p-8 text-white/50">🧠 Analyzing session...</div>';
            return;
        }

        if (data.error) {
            content.innerHTML = `<div class="text-center p-8 text-red-400">Error: ${data.error.message}</div>`;
            return;
        }
        
        const { review } = data;
        const potentialNetColor = review.potentialNet >= review.actualNet ? 'text-green-400' : 'text-yellow-400';

        let critiquesHtml = '';
        if (review.critique && review.critique.critiques) {
            critiquesHtml = review.critique.critiques.map(c => `
                <div class="bg-white/5 p-4 rounded-lg border border-white/10">
                    <h4 class="font-bold text-sm text-amber-300">${c.title}</h4>
                    <p class="text-xs text-white/80 mt-1">${c.suggestion}</p>
                </div>
            `).join('');
        }

        content.innerHTML = `
            <div class="grid grid-cols-2 gap-4 mb-6">
                <div class="bg-black/20 p-4 rounded-lg text-center">
                    <div class="text-xs text-white/50 uppercase font-bold">Actual Net</div>
                    <div class="text-3xl font-bold ${review.actualNet >= 0 ? 'text-green-400' : 'text-red-400'}">${review.actualNet.toFixed(2)}u</div>
                </div>
                <div class="bg-black/20 p-4 rounded-lg text-center">
                    <div class="text-xs text-white/50 uppercase font-bold">Potential Net</div>
                    <div class="text-3xl font-bold ${potentialNetColor}">${review.potentialNet.toFixed(2)}u</div>
                </div>
            </div>
            <h3 class="text-sm font-bold uppercase text-white/40 mb-3">AI Tactical Critique</h3>
            <div class="space-y-3">
                ${critiquesHtml || '<div class="text-center p-8 text-white/50">No critique available.</div>'}
            </div>
        `;
    }
})();
