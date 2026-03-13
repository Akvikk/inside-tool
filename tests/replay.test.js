const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const { createSandbox, loadScript } = require('./helpers/browserSandbox');

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

test('Replay fixture remains engine-contract safe across ticks', async () => {
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

        assert.equal(validation.valid, true, `Tick ${i + 1} produced invalid sync result`);
        activeBets = adapted.nextBets;
    }

    assert.equal(history.length, fixture.spins.length);
});

