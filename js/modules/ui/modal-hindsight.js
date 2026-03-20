(function () {
    const template = document.createElement('template');
    template.innerHTML = `
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
    </div>`;
    document.body.appendChild(template.content);
})();
// This file has been moved to js/modules/ui/components/modal-hindsight.js
// You can safely delete this file.