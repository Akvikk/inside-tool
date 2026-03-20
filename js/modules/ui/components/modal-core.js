(function () {
    'use strict';

    window.toggleModal = function (id) {
        const modal = document.getElementById(id);
        if (!modal) {
            console.warn(`[ModalSystem] Modal not found: ${id}`);
            // Don't alert here to avoid spamming the user if a specific modal is truly missing
            return;
        }
        modal.classList.toggle('hidden');
        
        // Handle backdrop if necessary
        const backdrop = document.getElementById('modalBackdrop');
        if (backdrop) {
            const anyOpen = document.querySelectorAll('.modal:not(.hidden)').length > 0;
            backdrop.classList.toggle('hidden', !anyOpen);
        }
    };

    window.closeModal = function (id) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.add('hidden');
    };
})();
