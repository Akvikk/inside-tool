/**
 * App Store
 * Lightweight centralized state and reducer for core app data.
 */
(function () {
    'use strict';

    function clone(value) {
        if (Array.isArray(value)) return value.slice();
        if (value && typeof value === 'object') return { ...value };
        return value;
    }

    function createInitialState() {
        return {
            history: [],
            activeBets: [],
            alerts: [],
            snapshot: null,
            ui: {
                strategy: 'series',
                inputLayout: 'grid'
            },
            meta: {
                lastAction: 'init',
                updatedAt: Date.now()
            }
        };
    }

    function reduce(state, action) {
        const next = {
            ...state,
            ui: { ...state.ui },
            meta: { ...state.meta, lastAction: action.type, updatedAt: Date.now() }
        };

        switch (action.type) {
            case 'history/set':
                next.history = Array.isArray(action.payload) ? action.payload.slice() : [];
                return next;

            case 'history/append':
                next.history = state.history.concat([action.payload]);
                return next;

            case 'engine/sync': {
                const payload = action.payload || {};
                next.activeBets = Array.isArray(payload.activeBets) ? payload.activeBets.slice() : [];
                next.alerts = Array.isArray(payload.alerts) ? payload.alerts.slice() : [];
                if (payload.snapshot !== undefined) next.snapshot = payload.snapshot;
                return next;
            }

            case 'ui/setStrategy':
                next.ui.strategy = String(action.payload || 'series');
                return next;

            case 'ui/setInputLayout':
                next.ui.inputLayout = String(action.payload || 'grid');
                return next;

            case 'session/reset':
                return {
                    ...createInitialState(),
                    meta: { lastAction: 'session/reset', updatedAt: Date.now() }
                };

            default:
                return state;
        }
    }

    function createStore() {
        let state = createInitialState();
        const listeners = new Set();

        function getState() {
            return state;
        }

        function dispatch(type, payload) {
            const action = typeof type === 'object' && type !== null
                ? type
                : { type, payload };
            if (!action || typeof action.type !== 'string') return state;

            const previous = state;
            state = reduce(state, action);
            if (state !== previous) {
                listeners.forEach(listener => {
                    try {
                        listener(state, action);
                    } catch (error) {
                        console.error('Store listener failed:', error);
                    }
                });
            }
            return state;
        }

        function subscribe(listener) {
            if (typeof listener !== 'function') return function noop() { };
            listeners.add(listener);
            return function unsubscribe() {
                listeners.delete(listener);
            };
        }

        function replaceState(nextState) {
            if (!nextState || typeof nextState !== 'object') return state;
            state = {
                ...state,
                ...clone(nextState),
                meta: { ...state.meta, lastAction: 'replaceState', updatedAt: Date.now() }
            };
            listeners.forEach(listener => {
                try {
                    listener(state, { type: 'replaceState' });
                } catch (error) {
                    console.error('Store listener failed:', error);
                }
            });
            return state;
        }

        return {
            getState,
            dispatch,
            subscribe,
            replaceState
        };
    }

    window.AppStore = createStore();
})();

