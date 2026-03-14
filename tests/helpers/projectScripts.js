const SCRIPT_PATHS = Object.freeze({
    state: 'js/modules/engine/state.js',
    core: 'js/modules/engine/core.js',
    prediction: 'js/modules/engine/prediction.js',
    contract: 'js/modules/engine/contract.js',
    adapter: 'js/modules/engine/adapter.js',
    store: 'js/modules/engine/store.js',
    series: 'js/strategies/strategy.series.js',
    combo: 'js/strategies/strategy.combo.js',
    renderers: 'js/modules/ui/renderers.js',
    modals: 'js/modules/ui/modals.js',
    hudManager: 'js/modules/ui/hud-manager.js',
    controller: 'js/modules/ui/controller.js',
    processor: 'js/modules/input/processor.js',
    brain: 'js/modules/ai/brain.js',
    app: 'app.js'
});

const REQUIRED_SCRIPTS_BEFORE_APP = Object.freeze([
    SCRIPT_PATHS.state,
    SCRIPT_PATHS.core,
    SCRIPT_PATHS.prediction,
    SCRIPT_PATHS.contract,
    SCRIPT_PATHS.adapter,
    SCRIPT_PATHS.store,
    SCRIPT_PATHS.series,
    SCRIPT_PATHS.combo,
    SCRIPT_PATHS.renderers,
    SCRIPT_PATHS.modals,
    SCRIPT_PATHS.hudManager,
    SCRIPT_PATHS.controller,
    SCRIPT_PATHS.processor,
    SCRIPT_PATHS.brain
]);

module.exports = {
    SCRIPT_PATHS,
    REQUIRED_SCRIPTS_BEFORE_APP
};
