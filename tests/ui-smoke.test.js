const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    readLocalScripts,
    collectFunctionNames,
    collectInlineHandlerFunctionCalls,
    collectReferencedIds,
    collectDefinedIds,
    collectDuplicateWindowFunctionAssignments
} = require('./helpers/uiSmoke');

const htmlPath = path.resolve(__dirname, '..', 'index.html');
const baselinePath = path.resolve(__dirname, 'ui-smoke-baseline.json');

const htmlCode = fs.readFileSync(htmlPath, 'utf8');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
const projectRoot = path.resolve(__dirname, '..');
const scriptEntries = readLocalScripts(projectRoot, htmlCode);
const scriptPaths = scriptEntries.map(entry => entry.relativePath);
const combinedCode = scriptEntries.map(entry => entry.code).join('\n');

test('script order keeps safety boundary before app bootstrap', () => {
    const appIndex = scriptPaths.indexOf('app.js');
    const requiredBeforeApp = [
        'js/modules/engine/state.js',
        'js/modules/engine/core.js',
        'js/modules/engine/prediction.js',
        'js/modules/engine/contract.js',
        'js/modules/engine/adapter.js',
        'js/modules/engine/store.js',
        'js/strategies/strategy.series.js',
        'js/strategies/strategy.combo.js',
        'js/modules/ui/renderers.js',
        'js/modules/ui/modals.js',
        'js/modules/ui/hud-manager.js',
        'js/modules/ui/controller.js',
        'js/modules/input/processor.js',
        'js/modules/ai/brain.js'
    ];

    assert.ok(appIndex >= 0, 'app.js script tag missing');
    requiredBeforeApp.forEach(scriptPath => {
        const scriptIndex = scriptPaths.indexOf(scriptPath);
        assert.ok(scriptIndex >= 0 && scriptIndex < appIndex, `${scriptPath} must load before app.js`);
    });
});

test('UI id references do not introduce new missing DOM targets', () => {
    const referenced = collectReferencedIds(combinedCode);
    const defined = collectDefinedIds(htmlCode);
    const missing = [...referenced].filter(id => !defined.has(id)).sort();
    const allowed = new Set(baseline.allowedMissingIds || []);
    const unexpected = missing.filter(id => !allowed.has(id));

    assert.deepEqual(
        unexpected,
        [],
        `Unexpected missing IDs detected:\n${unexpected.join('\n')}`
    );
});

test('inline HTML handlers resolve to declared app functions', () => {
    const declaredFunctions = collectFunctionNames(combinedCode);
    const usedFunctions = collectInlineHandlerFunctionCalls(htmlCode);
    const ignore = new Set(['if', 'event', 'confirm', 'alert']);
    const allowedMissingHandlers = new Set(baseline.allowedMissingHandlers || []);
    const missing = [...usedFunctions]
        .filter(name => !ignore.has(name))
        .filter(name => !declaredFunctions.has(name))
        .filter(name => !allowedMissingHandlers.has(name))
        .sort();

    assert.deepEqual(
        missing,
        [],
        `Missing inline handlers detected:\n${missing.join('\n')}`
    );
});

test('window-level handlers are not assigned in multiple modules', () => {
    const duplicates = collectDuplicateWindowFunctionAssignments(scriptEntries);

    assert.equal(
        duplicates.length,
        0,
        `Duplicate window handlers detected:\n${duplicates.map(entry => `${entry.name}: ${entry.scripts.join(', ')}`).join('\n')}`
    );
});
