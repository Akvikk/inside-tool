const test = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox, loadScript } = require('./helpers/browserSandbox');

test('EngineContract sanitizes malformed sync result safely', () => {
    const ctx = createSandbox();
    loadScript(ctx, 'engine-contract.js');

    const sanitized = ctx.EngineContract.sanitizeSyncResult({
        notifications: [{ type: 'active', strategy: 44, count: '3' }, null],
        nextBets: [{ targetFace: '9', status: 'go' }, 123]
    });

    assert.equal(Array.isArray(sanitized.notifications), true);
    assert.equal(Array.isArray(sanitized.nextBets), true);
    assert.equal(sanitized.notifications.length, 2);
    assert.equal(sanitized.nextBets.length, 2);
    assert.equal(sanitized.nextBets[0].targetFace, null);
    assert.equal(sanitized.nextBets[0].status, 'GO');
});

test('EngineContract validates sync result shape', () => {
    const ctx = createSandbox();
    loadScript(ctx, 'engine-contract.js');

    const valid = ctx.EngineContract.validateSyncResult({
        notifications: [{ type: 'ACTIVE', strategy: 'Sequence' }],
        nextBets: [{ status: 'GO', targetFace: 3 }]
    });
    assert.equal(valid.valid, true);

    const invalid = ctx.EngineContract.validateSyncResult({
        notifications: {},
        nextBets: [{ status: 'BROKEN', targetFace: 99 }]
    });
    assert.equal(invalid.valid, false);
    assert.equal(invalid.errors.length > 0, true);
});

