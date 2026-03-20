const fs = require('fs');
const path = require('path');
const assert = require('assert/strict');
const { createSandbox, loadScript } = require('./helpers/browserSandbox');
const { SCRIPT_PATHS, REQUIRED_SCRIPTS_BEFORE_APP } = require('./helpers/projectScripts');
const {
    readLocalScripts,
    collectFunctionNames,
    collectInlineHandlerFunctionCalls,
    collectReferencedIds,
    collectDefinedIds,
    collectDuplicateWindowFunctionAssignments
} = require('./helpers/uiSmoke');

async function testEngineContract() {
    const ctx = createSandbox();
    loadScript(ctx, SCRIPT_PATHS.contract);

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
    loadScript(ctx, SCRIPT_PATHS.contract);
    loadScript(ctx, SCRIPT_PATHS.adapter);

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
    loadScript(ctx, SCRIPT_PATHS.store);

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
    loadScript(ctx, SCRIPT_PATHS.prediction);
    loadScript(ctx, SCRIPT_PATHS.series);
    loadScript(ctx, SCRIPT_PATHS.combo);
    loadScript(ctx, SCRIPT_PATHS.core);
    loadScript(ctx, SCRIPT_PATHS.contract);
    loadScript(ctx, SCRIPT_PATHS.adapter);

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

async function testUiSmoke() {
    const htmlPath = path.resolve(__dirname, '..', 'index.html');
    const baselinePath = path.resolve(__dirname, 'ui-smoke-baseline.json');
    const htmlCode = fs.readFileSync(htmlPath, 'utf8');
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const projectRoot = path.resolve(__dirname, '..');
    const scriptEntries = readLocalScripts(projectRoot, htmlCode);
    const tags = scriptEntries.map(entry => entry.relativePath);
    const appIndex = tags.indexOf(SCRIPT_PATHS.app);

    assert.ok(appIndex >= 0, 'app.js script tag missing');
    REQUIRED_SCRIPTS_BEFORE_APP.forEach(scriptPath => {
        const scriptIndex = tags.indexOf(scriptPath);
        assert.ok(scriptIndex >= 0 && scriptIndex < appIndex, `${scriptPath} must load before app.js`);
    });

    const combinedCode = scriptEntries.map(entry => entry.code).join('\n');
    const referenced = collectReferencedIds(combinedCode);
    const defined = collectDefinedIds(htmlCode + '\n' + combinedCode);
    const missingIds = [...referenced].filter(id => !defined.has(id)).sort();
    const allowedMissingIds = new Set(baseline.allowedMissingIds || []);
    const unexpectedMissingIds = missingIds.filter(id => !allowedMissingIds.has(id));
    assert.deepEqual(unexpectedMissingIds, [], `Unexpected missing IDs:\n${unexpectedMissingIds.join('\n')}`);

    const declaredFunctions = collectFunctionNames(combinedCode);
    const usedFunctions = collectInlineHandlerFunctionCalls(htmlCode + '\n' + combinedCode);
    const ignore = new Set(['if', 'event', 'confirm', 'alert']);
    const allowedMissingHandlers = new Set(baseline.allowedMissingHandlers || []);
    const missingHandlers = [...usedFunctions]
        .filter(name => !ignore.has(name))
        .filter(name => !declaredFunctions.has(name))
        .filter(name => !allowedMissingHandlers.has(name))
        .sort();
    assert.deepEqual(missingHandlers, [], `Missing inline handlers:\n${missingHandlers.join('\n')}`);

    const duplicates = collectDuplicateWindowFunctionAssignments(scriptEntries);
    assert.equal(
        duplicates.length,
        0,
        `Duplicate window function assignments:\n${duplicates.map(entry => `${entry.name}: ${entry.scripts.join(', ')}`).join('\n')}`
    );
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
