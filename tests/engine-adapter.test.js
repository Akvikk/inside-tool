const test = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox, loadScript } = require('./helpers/browserSandbox');

test('EngineAdapter returns contract-validated sync view', () => {
    const ctx = createSandbox();
    loadScript(ctx, 'engine-contract.js');
    loadScript(ctx, 'engine-adapter.js');

    const view = ctx.EngineAdapter.toSyncView({
        notifications: [{ type: 'active', strategy: 'Sequence' }],
        nextBets: [{ status: 'go', targetFace: 3, patternName: '(123)' }]
    });

    assert.equal(view.valid, true);
    assert.equal(view.notifications[0].type, 'ACTIVE');
    assert.equal(view.nextBets[0].status, 'GO');
    assert.equal(view.nextBets[0].targetFace, 3);
});

test('EngineAdapter builds spin signals consistently', () => {
    const ctx = createSandbox();
    loadScript(ctx, 'engine-adapter.js');

    const signals = ctx.EngineAdapter.toSpinSignals(
        [{ patternName: '(123)', targetFace: 3, status: 'GO' }],
        {}
    );
    assert.equal(signals.length, 1);
    assert.equal(signals[0].patternName, '(123)');
});

