window.HindsightModal = (function() {
    let modalElement = null;

    function createModal() {
        if (document.getElementById('hindsightModal')) {
            return;
        }

        const modalHTML = `
            <div id="hindsightModal" class="modal-glassmorphism" style="display: none;">
                <div class="modal-content">
                    <button class="close-button">&times;</button>
                    <h2>🧠 AI Hindsight Review</h2>
                    <div id="hindsightContent">
                        <p>Requesting analysis...</p>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalElement = document.getElementById('hindsightModal');

        const closeButton = modalElement.querySelector('.close-button');
        closeButton.addEventListener('click', hide);
    }

    function show(analysis) {
        if (!modalElement) {
            createModal();
        }
        updateContent(analysis);
        modalElement.style.display = 'block';
    }

    function hide() {
        if (modalElement) {
            modalElement.style.display = 'none';
        }
    }

    function updateContent(analysis) {
        const contentDiv = modalElement.querySelector('#hindsightContent');
        if (!analysis) {
            contentDiv.innerHTML = '<p>Awaiting analysis. Please wait.</p>';
            return;
        }

        const { actualProfit, potentialProfit, tacticalCritique } = analysis;

        contentDiv.innerHTML = `
            <h4>Profit Analysis</h4>
            <p><strong>Actual Profit:</strong> ${actualProfit}</p>
            <p><strong>Potential Profit (Shadow Net):</strong> ${potentialProfit}</p>
            <h4>AI Tactical Critique</h4>
            <p>${tacticalCritique}</p>
        `;
    }

    document.addEventListener('DOMContentLoaded', createModal);

    return {
        show,
        hide
    };
})();
