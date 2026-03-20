(function () {
    const template = document.createElement('template');
    template.innerHTML = `
    <div id="patternDetailModal" class="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md hidden flex items-center justify-center p-4" onclick="toggleModal('patternDetailModal')">
        <div class="glass-menu modal-surface w-full max-w-xl flex flex-col overflow-hidden" onclick="event.stopPropagation()">
            <div id="patternDetailBody"></div>
        </div>
    </div>`;
    document.body.appendChild(template.content);
})();