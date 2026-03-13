const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { createSandbox, loadScript } = require('./helpers/browserSandbox');

async function testEngineContract() {
    const ctx = createSandbox();
    loadScript(ctx, 'engine-contract.js');

    const sanitized = ctx.EngineContract.sanitizeSyncResult({
        notifications: [{ type: 'active', strategy: 44, count: '3' }, null],
        nextBets: [{ targetFace: '9', status: 'go' }, 123]
    });

    assert.equal(Array.isArray(sanitized.notifications), true);
    assert.equal(Array.isArray(sanitized.nextBets), true);
    assert.equal(sanitized.nextBets[0].targetFace, null);
    assert.equal(sanitized.nextBets[0].status, 'GO');

    const valid = ctx.EngineContract.validateSyncResult({
        notifications: [{ type: 'ACTIVE', strategy: 'Sequence' }],
        nextBets: [{ status: 'GO', targetFace: 3 }]
    });
    assert.equal(valid.valid, true);
}

async function testEngineAdapter() {
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
}

async function testStore() {
    const ctx = createSandbox();
    loadScript(ctx, 'store.js');

    ctx.AppStore.dispatch('history/set', [{ num: 12 }]);
    ctx.AppStore.dispatch('ui/setStrategy', 'combo');
    ctx.AppStore.dispatch('engine/sync', { activeBets: [{ targetFace: 3 }], alerts: [{ type: 'ACTIVE' }] });

    const state = ctx.AppStore.getState();
    assert.equal(state.history.length, 1);
    assert.equal(state.ui.strategy, 'combo');
    assert.equal(state.activeBets.length, 1);
}

function buildSnapshotFromAnalysis(analysis, spinCount) {
    if (!analysis || !analysis.targetFace || analysis.action === 'WAIT') {
        return {
            engineState: spinCount < 2 ? 'BUILDING' : 'NO_SIGNAL',
            currentPrediction: null
        };
    }
    return {
        engineState: analysis.action === 'BET_AGAINST' ? 'FOLLOW_UP' : 'READY',
        currentPrediction: {
            targetFace: analysis.targetFace,
            comboLabel: analysis.signalLabel || analysis.ruleLabel || 'Signal',
            action: analysis.action,
            confidence: Number.isFinite(analysis.confidence) ? analysis.confidence : 0
        }
    };
}

async function testReplay() {
    const fixturePath = path.resolve(__dirname, 'fixtures', 'replay-basic.json');
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    const ctx = createSandbox();
    loadScript(ctx, 'predictionEngine.js');
    loadScript(ctx, 'strategies/strategy.series.js');
    loadScript(ctx, 'strategies/strategy.combo.js');
    loadScript(ctx, 'engine-core.js');
    loadScript(ctx, 'engine-contract.js');
    loadScript(ctx, 'engine-adapter.js');

    const patternConfig = ctx.StrategyRegistry.series.buildPatternConfig(true);
    const history = [];
    let activeBets = [];

    for (let i = 0; i < fixture.spins.length; i++) {
        const spin = fixture.spins[i];
        const matchedMask = Object.prototype.hasOwnProperty.call(ctx.FON_MASK_MAP, spin)
            ? ctx.FON_MASK_MAP[spin]
            : 0;
        const faces = Object.prototype.hasOwnProperty.call(ctx.FON_MAP, spin)
            ? ctx.FON_MAP[spin].slice()
            : [];

        const resolved = ctx.EngineCore.resolveTurn(
            spin,
            matchedMask,
            activeBets,
            'series',
            null,
            {
                historyLength: history.length,
                faceMasks: ctx.FACE_MASKS,
                faces: ctx.FACES,
                history
            }
        );
        activeBets = [];

        history.push({
            num: spin,
            faces,
            index: i,
            resolvedBets: resolved,
            newSignals: [],
            id: i + 1
        });

        const analysis = await ctx.PredictionEngine.evaluatePredictionEngine(history);
        const snapshot = buildSnapshotFromAnalysis(analysis, history.length);
        const rawResult = await ctx.EngineCore.scanAll(
            history,
            snapshot,
            'series',
            patternConfig,
            { registry: ctx.StrategyRegistry }
        );
        const adapted = ctx.EngineAdapter.toSyncView(rawResult);
        const validation = ctx.EngineContract.validateSyncResult(adapted);
        assert.equal(validation.valid, true, `Invalid sync result at tick ${i + 1}`);
        activeBets = adapted.nextBets;
    }

    assert.equal(history.length, fixture.spins.length);
}

function collectFunctionNames(source) {
    const names = new Set();
    for (const match of source.matchAll(/function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
        names.add(match[1]);
    }
    for (const match of source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g)) {
        names.add(match[1]);
    }
    return names;
}

function collectInlineHandlerFunctionCalls(source) {
    const attrs = [];
    for (const match of source.matchAll(/\bon[a-zA-Z]+\s*=\s*["']([^"']+)["']/g)) {
        attrs.push(match[1]);
    }
    const used = new Set();
    for (const attr of attrs) {
        for (const match of attr.matchAll(/(^|[^.\w$])([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g)) {
            used.add(match[2]);
        }
    }
    return used;
}

function collectReferencedIds(source) {
    const ids = new Set();
    for (const match of source.matchAll(/getElementById\(\s*['"]([^'"]+)['"]\s*\)/g)) {
        ids.add(match[1]);
    }
    return ids;
}

function collectDefinedIds(source) {
    const ids = new Set();
    for (const match of source.matchAll(/\bid\s*=\s*['"]([^'"]+)['"]/g)) {
        ids.add(match[1]);
    }
    return ids;
}

async function testUiSmoke() {
    const appPath = path.resolve(__dirname, '..', 'app.js');
    const htmlPath = path.resolve(__dirname, '..', 'index.html');
    const baselinePath = path.resolve(__dirname, 'ui-smoke-baseline.json');

    const appCode = fs.readFileSync(appPath, 'utf8');
    const htmlCode = fs.readFileSync(htmlPath, 'utf8');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

    const tags = [...htmlCode.matchAll(/<script\s+src="([^"]+)"/g)].map(m => m[1]);
    const appIndex = tags.indexOf('app.js');
    const contractIndex = tags.indexOf('engine-contract.js');
    const adapterIndex = tags.indexOf('engine-adapter.js');
    const storeIndex = tags.indexOf('store.js');
    const renderersIndex = tags.indexOf('ui-renderers.js');

    assert.ok(appIndex >= 0, 'app.js script tag missing');
    assert.ok(contractIndex >= 0 && contractIndex < appIndex, 'engine-contract.js must load before app.js');
    assert.ok(adapterIndex >= 0 && adapterIndex < appIndex, 'engine-adapter.js must load before app.js');
    assert.ok(storeIndex >= 0 && storeIndex < appIndex, 'store.js must load before app.js');
    assert.ok(renderersIndex >= 0 && renderersIndex < appIndex, 'ui-renderers.js must load before app.js');

    const referenced = collectReferencedIds(appCode);
    const defined = collectDefinedIds(htmlCode);
    const missingIds = [...referenced].filter(id => !defined.has(id)).sort();
    const allowedMissingIds = new Set(baseline.allowedMissingIds || []);
    const unexpectedMissingIds = missingIds.filter(id => !allowedMissingIds.has(id));
    assert.deepEqual(unexpectedMissingIds, [], `Unexpected missing IDs:\n${unexpectedMissingIds.join('\n')}`);

    const declaredFunctions = collectFunctionNames(appCode);
    const usedFunctions = collectInlineHandlerFunctionCalls(htmlCode);
    const ignore = new Set(['if', 'event', 'confirm', 'alert']);
    const allowedMissingHandlers = new Set(baseline.allowedMissingHandlers || []);
    const missingHandlers = [...usedFunctions]
        .filter(name => !ignore.has(name))
        .filter(name => !declaredFunctions.has(name))
        .filter(name => !allowedMissingHandlers.has(name))
        .sort();
    assert.deepEqual(missingHandlers, [], `Missing inline handlers:\n${missingHandlers.join('\n')}`);
}

const allTests = [
    { name: 'engine-contract', fn: testEngineContract },
    { name: 'engine-adapter', fn: testEngineAdapter },
    { name: 'store', fn: testStore },
    { name: 'replay', fn: testReplay },
    { name: 'ui-smoke', fn: testUiSmoke }
];

async function main() {
    const filter = (process.argv[2] || 'all').toLowerCase();
    const selected = filter === 'all'
        ? allTests
        : allTests.filter(t => t.name === filter);

    if (selected.length === 0) {
        console.error(`Unknown test filter: ${filter}`);
        process.exit(1);
    }

    let failures = 0;
    for (const testItem of selected) {
        try {
            await testItem.fn();
            console.log(`PASS ${testItem.name}`);
        } catch (error) {
            failures++;
            console.error(`FAIL ${testItem.name}`);
            console.error(error && error.stack ? error.stack : error);
        }
    }

    if (failures > 0) {
        process.exit(1);
    }
    console.log('All selected tests passed.');
}

main().catch(error => {
    console.error(error && error.stack ? error.stack : error);
    process.exit(1);
});

