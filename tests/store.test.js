const test = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox, loadScript } = require('./helpers/browserSandbox');

test('AppStore handles core dispatch actions', () => {
    const ctx = createSandbox();
    loadScript(ctx, 'store.js');

    ctx.AppStore.dispatch('history/set', [{ num: 12 }]);
    ctx.AppStore.dispatch('ui/setStrategy', 'combo');
    ctx.AppStore.dispatch('engine/sync', { activeBets: [{ targetFace: 3 }], alerts: [{ type: 'ACTIVE' }] });

    const state = ctx.AppStore.getState();
    assert.equal(state.history.length, 1);
    assert.equal(state.ui.strategy, 'combo');
    assert.equal(state.activeBets.length, 1);
    assert.equal(state.alerts.length, 1);
});

