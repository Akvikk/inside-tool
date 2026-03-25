(function () {
    'use strict';

    /**
     * PERIMETER MODULE
     * Scans the spin history within a rolling window to calculate
     * how many times a specific pattern+face combination has occurred.
     * Works across ALL strategies: Series, Combos, Inside Patterns.
     */

    /**
     * Calculate how many times a given signal (pattern + face) has occurred
     * within the perimeter window of recent spins.
     *
     * @param {Object} signal - The active bet/signal object.
     *   Must have: { filterKey, patternName, targetFace, comboLabel? }
     * @param {number} [windowOverride] - Optional override for the window size.
     * @returns {number} The frequency count within the perimeter window.
     */
    window.calculatePerimeterFrequency = function (signal, windowOverride) {
        const state = window.state;
        // --- ONLY AVAILABLE IN PATTERN MODE ---
        if (state.currentGameplayStrategy !== 'inside') return 0;

        const history = state.history || [];
        const windowSize = windowOverride || state.predictionPerimeterWindow || 14;

        if (history.length === 0) return 0;

        // Determine the slice of history to scan (most recent N spins)
        const startIndex = Math.max(0, history.length - windowSize);
        const recentSpins = history.slice(startIndex);

        // Build the match key from the signal
        const targetFace = signal.targetFace;
        const signalKey = _buildSignalKey(signal);

        let count = 0;

        for (let i = 0; i < recentSpins.length; i++) {
            const spin = recentSpins[i];
            if (!spin) continue;

            // Check if this spin's result matches the target face
            // History entries store faces as an array (spin.faces), primary face is [0].
            // Fall back to spin.face / spin.faceIndex for any legacy entries.
            const spinFace = (Array.isArray(spin.faces) && spin.faces.length > 0)
                ? spin.faces[0]
                : (spin.face !== undefined ? spin.face : spin.faceIndex);
            if (spinFace == null || spinFace != targetFace) continue; // eslint-disable-line eqeqeq

            // Check if any signal on this spin matches the pattern key
            const spinSignals = spin.newSignals || [];
            for (let s = 0; s < spinSignals.length; s++) {
                const ss = spinSignals[s];
                const ssKey = _buildSignalKey(ss);
                if (ssKey === signalKey) {
                    count++;
                    break; // Only count once per spin
                }
            }
        }

        return count;
    };

    /**
     * Batch-calculate perimeter frequencies for all active bets.
     * Returns an array of counts in the same order as activeBets.
     *
     * @returns {number[]} Array of frequency counts.
     */
    window.calculateAllPerimeterFrequencies = function () {
        const state = window.state;
        if (!state || !state.perimeterRuleEnabled) return [];

        const bets = state.activeBets || [];
        return bets.map(function (bet) {
            return window.calculatePerimeterFrequency(bet);
        });
    };

    /**
     * Build a unique key for a signal to use in matching.
     * Strategy-agnostic: works for Series, Combos, and Inside.
     */
    function _buildSignalKey(signal) {
        if (!signal) return '';

        // Use filterKey if available (most reliable for inside patterns)
        if (signal.filterKey) return signal.filterKey;

        // For combos, use comboLabel
        if (signal.comboLabel) return 'combo:' + signal.comboLabel;

        // For series, use sequenceName or patternName
        if (signal.sequenceName) return 'seq:' + signal.sequenceName;

        // Fallback to patternName
        return signal.patternName || 'unknown';
    }

    /**
     * Toggle the perimeter feature on/off.
     */
    window.togglePerimeterEnabled = function () {
        const state = window.state;
        if (!state) return;

        state.perimeterRuleEnabled = !state.perimeterRuleEnabled;

        // Sync the main enable toggle UI
        const toggle = document.getElementById('perimeterToggle');
        if (toggle) toggle.checked = state.perimeterRuleEnabled;

        // Sync slider visibility
        const sliderContainer = document.getElementById('perimeterSliderContainer');
        if (sliderContainer) {
            sliderContainer.style.opacity = state.perimeterRuleEnabled ? '1' : '0.3';
            sliderContainer.style.pointerEvents = state.perimeterRuleEnabled ? 'auto' : 'none';
        }

        // When perimeter is disabled, reset & grey-out the "show only" filter toggle
        const filterToggleRow = document.getElementById('showOnlyPerimeterRow');
        const filterToggle = document.getElementById('showOnlyPerimeterToggle');
        if (!state.perimeterRuleEnabled) {
            state.showOnlyPerimeterBets = false;
            if (filterToggle) filterToggle.checked = false;
        }
        if (filterToggleRow) {
            filterToggleRow.style.opacity = state.perimeterRuleEnabled ? '1' : '0.3';
            filterToggleRow.style.pointerEvents = state.perimeterRuleEnabled ? 'auto' : 'none';
        }

        // Re-render dashboard to show/hide perimeter badges
        if (window.renderDashboardSafe) {
            window.renderDashboardSafe(state.activeBets || []);
        }

        if (window.saveSessionData) window.saveSessionData();
    };

    /**
     * Toggle the "show only perimeter bets" filter on/off.
     * When on, the dashboard only renders bets that have freq > 0 in the perimeter window.
     */
    window.toggleShowOnlyPerimeterBets = function () {
        const state = window.state;
        if (!state || !state.perimeterRuleEnabled) return;

        state.showOnlyPerimeterBets = !state.showOnlyPerimeterBets;

        // Sync the checkbox
        const toggle = document.getElementById('showOnlyPerimeterToggle');
        if (toggle) toggle.checked = state.showOnlyPerimeterBets;

        // Re-render dashboard with the new filter applied
        if (window.renderDashboardSafe) {
            window.renderDashboardSafe(state.activeBets || []);
        }

        if (window.saveSessionData) window.saveSessionData();
    };

    /**
     * Update the perimeter window size from the slider.
     */
    window.updatePerimeterWindow = function (value) {
        const state = window.state;
        if (!state) return;

        const val = parseInt(value, 10);
        if (isNaN(val) || val < 14 || val > 50) return;

        state.predictionPerimeterWindow = val;

        // Update label
        const label = document.getElementById('perimeterWindowLabel');
        if (label) label.textContent = val;

        // Re-render dashboard with new window
        if (window.renderDashboardSafe) {
            window.renderDashboardSafe(state.activeBets || []);
        }

        if (window.saveSessionData) window.saveSessionData();
    };

    /**
     * Initialize the perimeter UI controls to match state.
     */
    window.initPerimeterUI = function () {
        const state = window.state;
        if (!state) return;

        const enabled = state.perimeterRuleEnabled !== false;

        const toggle = document.getElementById('perimeterToggle');
        const slider = document.getElementById('perimeterSlider');
        const label = document.getElementById('perimeterWindowLabel');
        const sliderContainer = document.getElementById('perimeterSliderContainer');
        const filterToggleRow = document.getElementById('showOnlyPerimeterRow');
        const filterToggle = document.getElementById('showOnlyPerimeterToggle');

        if (toggle) toggle.checked = enabled;
        if (slider) slider.value = state.predictionPerimeterWindow || 14;
        if (label) label.textContent = state.predictionPerimeterWindow || 14;
        if (sliderContainer) {
            sliderContainer.style.opacity = enabled ? '1' : '0.3';
            sliderContainer.style.pointerEvents = enabled ? 'auto' : 'none';
        }

        // Sync the "show only" filter toggle
        if (filterToggle) filterToggle.checked = enabled ? (state.showOnlyPerimeterBets === true) : false;
        if (filterToggleRow) {
            filterToggleRow.style.opacity = enabled ? '1' : '0.3';
            filterToggleRow.style.pointerEvents = enabled ? 'auto' : 'none';
        }
    };

})();
