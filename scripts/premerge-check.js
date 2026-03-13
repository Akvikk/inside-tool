const { spawnSync } = require('child_process');
const path = require('path');

const root = path.resolve(__dirname, '..');

const commands = [
    { cmd: 'node', args: ['--check', 'app.js'] },
    { cmd: 'node', args: ['--check', 'engine-core.js'] },
    { cmd: 'node', args: ['--check', 'predictionEngine.js'] },
    { cmd: 'node', args: ['--check', 'ai-brain.js'] },
    { cmd: 'node', args: ['--check', 'engine-contract.js'] },
    { cmd: 'node', args: ['--check', 'engine-adapter.js'] },
    { cmd: 'node', args: ['--check', 'store.js'] },
    { cmd: 'node', args: ['--check', 'ui-renderers.js'] },
    { cmd: 'node', args: ['tests/run-tests.js'] }
];

for (const step of commands) {
    const pretty = `${step.cmd} ${step.args.join(' ')}`;
    console.log(`\n> ${pretty}`);
    const result = spawnSync(step.cmd, step.args, {
        cwd: root,
        stdio: 'inherit',
        shell: false
    });

    if (result.status !== 0) {
        console.error(`\nPre-merge check failed at: ${pretty}`);
        process.exit(result.status || 1);
    }
}

console.log('\nAll pre-merge checks passed.');
