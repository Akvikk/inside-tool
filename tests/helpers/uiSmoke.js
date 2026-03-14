const fs = require('fs');
const path = require('path');

function getLocalScriptPaths(htmlCode) {
    return [...htmlCode.matchAll(/<script\b[^>]*src=['"]([^'"]+)['"]/g)]
        .map(match => match[1])
        .filter(src => !/^(?:https?:)?\/\//i.test(src));
}

function readLocalScripts(projectRoot, htmlCode) {
    return getLocalScriptPaths(htmlCode).map(relativePath => {
        const absolutePath = path.resolve(projectRoot, relativePath);
        return {
            relativePath,
            absolutePath,
            code: fs.readFileSync(absolutePath, 'utf8')
        };
    });
}

function collectFunctionNames(source) {
    const names = new Set();
    const patterns = [
        /function\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*\(/g,
        /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?function\b/g,
        /\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g,
        /window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?function\b/g,
        /window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/g
    ];

    patterns.forEach(pattern => {
        for (const match of source.matchAll(pattern)) {
            names.add(match[1]);
        }
    });

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

function collectDuplicateWindowFunctionAssignments(scriptEntries) {
    const matchesByName = new Map();
    const assignmentPattern = /window\.([A-Za-z_$][A-Za-z0-9_$]*)\s*=\s*(?:async\s*)?(?:function\b|\([^)]*\)\s*=>)/g;

    for (const script of scriptEntries) {
        for (const match of script.code.matchAll(assignmentPattern)) {
            const name = match[1];
            if (!matchesByName.has(name)) {
                matchesByName.set(name, new Set());
            }
            matchesByName.get(name).add(script.relativePath);
        }
    }

    return [...matchesByName.entries()]
        .map(([name, scripts]) => ({ name, scripts: [...scripts].sort() }))
        .filter(entry => entry.scripts.length > 1)
        .sort((a, b) => a.name.localeCompare(b.name));
}

module.exports = {
    getLocalScriptPaths,
    readLocalScripts,
    collectFunctionNames,
    collectInlineHandlerFunctionCalls,
    collectReferencedIds,
    collectDefinedIds,
    collectDuplicateWindowFunctionAssignments
};
