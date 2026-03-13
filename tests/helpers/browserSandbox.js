const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

function createSandbox() {
    const sandbox = {
        console,
        setTimeout,
        clearTimeout,
        setInterval,
        clearInterval,
        performance,
        Date,
        Math,
        JSON,
        Object,
        Array,
        Number,
        String,
        Boolean,
        RegExp,
        Promise
    };

    sandbox.window = sandbox;
    sandbox.global = sandbox;
    sandbox.dispatchEvent = function () { };
    sandbox.addEventListener = function () { };
    sandbox.removeEventListener = function () { };
    sandbox.CustomEvent = function CustomEvent(type, init) {
        this.type = type;
        this.detail = init && init.detail;
    };

    return vm.createContext(sandbox);
}

function loadScript(context, relativePath) {
    const absolutePath = path.resolve(__dirname, '..', '..', relativePath);
    const code = fs.readFileSync(absolutePath, 'utf8');
    vm.runInContext(code, context, { filename: absolutePath });
}

module.exports = {
    createSandbox,
    loadScript
};

