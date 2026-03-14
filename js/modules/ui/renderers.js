/**
 * UI Renderer Boundary
 * Central entrypoints so rendering can be swapped/refactored safely.
 */
(function () {
    'use strict';

    const implementations = {
        history: null,
        dashboard: null,
        analytics: null
    };

    function register(nextImpl = {}) {
        if (typeof nextImpl.history === 'function') implementations.history = nextImpl.history;
        if (typeof nextImpl.dashboard === 'function') implementations.dashboard = nextImpl.dashboard;
        if (typeof nextImpl.analytics === 'function') implementations.analytics = nextImpl.analytics;
    }

    function renderHistory(viewModel) {
        if (typeof implementations.history === 'function') {
            return implementations.history(viewModel);
        }
        return null;
    }

    function renderDashboard(viewModel) {
        if (typeof implementations.dashboard === 'function') {
            return implementations.dashboard(viewModel);
        }
        return null;
    }

    function renderAnalytics(viewModel) {
        if (typeof implementations.analytics === 'function') {
            return implementations.analytics(viewModel);
        }
        return null;
    }

    function has(name) {
        return Object.prototype.hasOwnProperty.call(implementations, name) &&
            typeof implementations[name] === 'function';
    }

    window.UiRenderers = {
        register,
        has,
        renderHistory,
        renderDashboard,
        renderAnalytics
    };
})();
