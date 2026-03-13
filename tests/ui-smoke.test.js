const fs = require('fs');
const path = require('path');
const test = require('node:test');
const assert = require('node:assert/strict');

const appPath = path.resolve(__dirname, '..', 'app.js');
const htmlPath = path.resolve(__dirname, '..', 'index.html');
const baselinePath = path.resolve(__dirname, 'ui-smoke-baseline.json');

const appCode = fs.readFileSync(appPath, 'utf8');
const htmlCode = fs.readFileSync(htmlPath, 'utf8');
const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));

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

test('script order keeps safety boundary before app bootstrap', () => {
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
});

test('UI id references do not introduce new missing DOM targets', () => {
    const referenced = collectReferencedIds(appCode);
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
    const declaredFunctions = collectFunctionNames(appCode);
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

