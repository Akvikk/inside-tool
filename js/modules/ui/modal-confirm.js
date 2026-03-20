(function () {
    const template = document.createElement('template');
    template.innerHTML = `
    <div id="confirmModal" class="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md hidden flex items-center justify-center p-4">
        <div class="glass-menu modal-surface p-6 text-center max-w-sm">
            <h3 class="text-white font-semibold text-lg mb-4">Reset Session?</h3>
            <div class="flex gap-3">
                <button onclick="toggleModal('confirmModal')" class="flex-1 py-2 rounded-lg bg-white/5 text-gray-300">Cancel</button>
                <button id="confirmResetBtn" class="flex-1 py-2 rounded-lg bg-[#ff1a33]/20 text-[#ff1a33]">Reset</button>
            </div>
        </div>
    </div>`;
    document.body.appendChild(template.content);
})();