const fs = require('fs');
const path = require('path');

const cssDir = path.join(__dirname, 'assets', 'css');
const inputFile = path.join(cssDir, 'style.css');

if (!fs.existsSync(inputFile)) {
    console.error('style.css not found');
    process.exit(1);
}

const content = fs.readFileSync(inputFile, 'utf-8');
const lines = content.split(/\r?\n/);

let currentFile = 'base.css'; // Global scope gets put into base.css
let filesData = {};
filesData[currentFile] = [];

// Clean up block names to filenames
function formatFilename(header) {
    let name = header.replace(/\/\*\s*---/g, '')
                     .replace(/---\s*\*\//g, '')
                     .replace(/[^a-zA-Z0-9\s]/g, '')
                     .trim()
                     .replace(/\s+/g, '-')
                     .toLowerCase();
    
    // Some hardcoded friendly names
    if (name.includes('core')) return 'layout.css';
    if (name.includes('premium')) return 'theme.css';
    if (name.includes('signal')) return 'signals.css';
    if (name.includes('racetrack')) return 'racetrack.css';
    if (name.includes('modal')) return 'modals.css';
    if (name.includes('history')) return 'history.css';
    if (name.includes('history-heatmap')) return 'heatmap.css';
    if (name.includes('bet-card')) return 'bets.css';
    if (name.includes('hamburger')) return 'navigation.css';
    if (name.includes('ambient')) return 'ambient.css';

    return name + '.css';
}

for (let line of lines) {
    if (line.trim().startsWith('/* ---') && line.trim().endsWith('--- */')) {
        currentFile = formatFilename(line);
        if (!filesData[currentFile]) {
            filesData[currentFile] = [];
        }
    }
    // We add the line to whatever the current file is.
    filesData[currentFile].push(line);
}

// Generate the new files
const importStatements = [];
for (const [filename, linesArray] of Object.entries(filesData)) {
    if (linesArray.join('').trim() === '') continue; // Skip empty chunks
    
    const outPath = path.join(cssDir, filename);
    fs.writeFileSync(outPath, linesArray.join('\n'), 'utf-8');
    
    // Add to imports
    importStatements.push(`@import url('${filename}');`);
    console.log(`Generated ${filename} with ${linesArray.length} lines.`);
}

// Re-write style.css
const newStyleCss = `/**
 * INSIDE TOOL - Modular CSS Entry Point
 * All styles have been modularized for maintainability.
 */\n\n` + importStatements.join('\n');

fs.writeFileSync(inputFile, newStyleCss, 'utf-8');
console.log('Successfully modularized style.css!');
