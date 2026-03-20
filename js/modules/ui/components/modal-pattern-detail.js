(function () {
    'use strict';

    const modalHtml = `
    <div id="patternDetailModal" class="modal hidden fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-md" onclick="toggleModal('patternDetailModal')"></div>
        <div class="relative w-full max-w-3xl bg-[#1c1c1e] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">
            <div id="patternDetailBody" class="flex flex-col h-full w-full bg-transparent">
                <!-- Analytics.js dynamically injects the header and table here -->
            </div>
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
})();