(function () {
    let stopwatchInterval = null;
    let stopwatchSeconds = 0;

    function getState() {
        return window.state || null;
    }

    function toggleClass(id, className = 'hidden') {
        if (typeof document === 'undefined') return null;
        const element = document.getElementById(id);
        if (element) {
            element.classList.toggle(className);
        }
        return element;
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function getCurrentStrategyKey() {
        const state = getState();
        return state && state.currentGameplayStrategy ? state.currentGameplayStrategy : 'series';
    }

    function getStrategyDefinition(strategyKey = getCurrentStrategyKey()) {
        const registry = window.StrategyRegistry || {};
        return registry[strategyKey] || null;
    }

    function getPatternMeta(strategyKey = getCurrentStrategyKey()) {
        const strategy = getStrategyDefinition(strategyKey);
        const meta = strategy && strategy.PATTERN_FILTER_META && typeof strategy.PATTERN_FILTER_META === 'object'
            ? strategy.PATTERN_FILTER_META
            : {};
        return meta && typeof meta === 'object' ? meta : {};
    }

    function buildDefaultPatternConfig(strategyKey = getCurrentStrategyKey()) {
        const strategy = getStrategyDefinition(strategyKey);
        if (strategy && typeof strategy.buildPatternConfig === 'function') {
            return strategy.buildPatternConfig(true) || {};
        }

        const meta = getPatternMeta(strategyKey);
        return Object.fromEntries(Object.keys(meta).map(key => [key, true]));
    }

    function normalizePatternConfig(defaults, existing) {
        const normalized = { ...defaults };
        const source = existing && typeof existing === 'object' ? existing : {};

        Object.keys(defaults).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(source, key)) {
                normalized[key] = source[key] !== false;
            }
        });

        return normalized;
    }

    function getLegacyPatternConfig(defaults) {
        const state = getState();
        if (!state || !state.patternConfig || typeof state.patternConfig !== 'object') {
            return null;
        }

        const legacy = state.patternConfig;
        const defaultKeys = Object.keys(defaults);
        if (defaultKeys.length === 0) return legacy;

        const hasOverlap = defaultKeys.some(key => Object.prototype.hasOwnProperty.call(legacy, key));
        return hasOverlap ? legacy : null;
    }

    function ensureActivePatternConfig(strategyKey = getCurrentStrategyKey()) {
        const state = getState();
        if (!state) return {};

        if (!state.patternConfigs || typeof state.patternConfigs !== 'object' || Array.isArray(state.patternConfigs)) {
            state.patternConfigs = {};
        }

        const defaults = buildDefaultPatternConfig(strategyKey);
        const existing = state.patternConfigs[strategyKey] || getLegacyPatternConfig(defaults);
        const normalized = normalizePatternConfig(defaults, existing);

        state.patternConfigs[strategyKey] = normalized;
        if (strategyKey === getCurrentStrategyKey()) {
            state.patternConfig = normalized;
        }

        return normalized;
    }

    function getPatternFilterEnabledCount(strategyKey = getCurrentStrategyKey()) {
        const config = ensureActivePatternConfig(strategyKey);
        return Object.keys(config).reduce((count, key) => count + (config[key] !== false ? 1 : 0), 0);
    }

    function syncPatternFilterButton() {
        if (typeof document === 'undefined') return;

        const button = document.getElementById('patternsToggleBtn');
        const badge = document.getElementById('patternsActiveCount');
        const summary = document.getElementById('patternFilterSummary');
        const popover = document.getElementById('patternFilterPopover');
        const config = ensureActivePatternConfig();
        const enabledCount = getPatternFilterEnabledCount();
        const totalCount = Object.keys(config).length;
        const isOpen = !!popover && !popover.classList.contains('hidden');

        if (badge) {
            badge.innerText = String(enabledCount);
            badge.classList.toggle('pattern-toggle-badge-off', enabledCount === 0);
        }

        if (summary) {
            summary.innerText = `${enabledCount} of ${totalCount} active`;
        }

        if (button) {
            button.classList.toggle('pattern-toggle-active', isOpen);
        }
    }

    function renderFilterMenu() {
        if (typeof document === 'undefined') return;

        const list = document.getElementById('patternsList');
        if (!list) return;

        const config = ensureActivePatternConfig();
        const meta = getPatternMeta();
        const keys = Object.keys(config);

        if (keys.length === 0) {
            list.innerHTML = '<div class="pattern-filter-card pattern-filter-card-off"><div class="pattern-filter-title">No filters available</div></div>';
            syncPatternFilterButton();
            return;
        }

        list.innerHTML = keys.map(key => {
            const itemMeta = meta[key] || {};
            const label = escapeHtml(itemMeta.label || key);
            const hint = escapeHtml(itemMeta.hint || 'No description configured yet.');
            const accent = escapeHtml(itemMeta.accent || '#8E8E93');
            const isEnabled = config[key] !== false;

            return `
                <div class="pattern-filter-card ${isEnabled ? 'pattern-filter-card-on' : 'pattern-filter-card-off'}"
                     style="--pattern-accent:${accent};">
                    <div class="pattern-filter-title">${label}</div>
                    <button class="pattern-filter-switch ${isEnabled ? 'pattern-filter-switch-on' : 'pattern-filter-switch-off'}"
                            onclick="event.stopPropagation(); togglePatternFilter('${key}')"
                            aria-label="Toggle ${label}"
                            title="${hint}">
                        <span class="pattern-filter-switch-knob"></span>
                    </button>
                </div>
            `;
        }).join('');

        syncPatternFilterButton();
    }

    async function refreshPatternFilteredView() {
        const result = window.scanAllStrategies
            ? await window.scanAllStrategies()
            : { notifications: [], nextBets: [] };

        if (window.renderDashboardSafe) {
            window.renderDashboardSafe(result);
        }
        if (window.reRenderHistory) {
            window.reRenderHistory();
        }
        if (window.syncAppStore) {
            window.syncAppStore();
        }
        if (window.debounceHeavyUIUpdates) {
            window.debounceHeavyUIUpdates();
        }
    }

    function renderPatternFilterUi() {
        ensureActivePatternConfig();
        renderFilterMenu();
        syncPatternFilterButton();
    }

    window.toggleHamburgerMenu = function () {
        toggleClass('hamburgerMenu');
        toggleClass('hamburgerBackdrop');
    };

    window.toggleAccordion = function (id) {
        const content = document.getElementById(id);
        const icon = document.getElementById(`${id}Icon`);
        if (!content) return;

        content.classList.toggle('hidden');
        if (icon) {
            icon.style.transform = content.classList.contains('hidden')
                ? 'rotate(0deg)'
                : 'rotate(180deg)';
        }
    };

    window.toggleModal = function (id) {
        return toggleClass(id);
    };

    window.togglePatternFilterPopover = function (forceOpen = null) {
        if (typeof document === 'undefined') return null;

        const popover = document.getElementById('patternFilterPopover');
        if (!popover) return null;

        const shouldOpen = typeof forceOpen === 'boolean'
            ? forceOpen
            : popover.classList.contains('hidden');

        if (shouldOpen) {
            renderPatternFilterUi();
            popover.classList.remove('hidden');
        } else {
            popover.classList.add('hidden');
        }

        syncPatternFilterButton();
        return popover;
    };

    window.closePatternFilterPopover = function () {
        if (typeof document === 'undefined') return;
        const popover = document.getElementById('patternFilterPopover');
        if (popover) {
            popover.classList.add('hidden');
        }
        syncPatternFilterButton();
    };

    window.ensureActivePatternConfig = ensureActivePatternConfig;
    window.renderPatternFilterUi = renderPatternFilterUi;
    window.syncPatternFilterButton = syncPatternFilterButton;
    window.togglePatternFilter = function (key, isChecked = null) {
        const config = ensureActivePatternConfig();
        if (!Object.prototype.hasOwnProperty.call(config, key)) return;

        const nextState = typeof isChecked === 'boolean' ? isChecked : config[key] === false;
        config[key] = nextState;

        const state = getState();
        if (state && state.patternConfigs) {
            state.patternConfigs[getCurrentStrategyKey()] = config;
            state.patternConfig = config;
        }

        renderPatternFilterUi();
        if (window.saveSessionData) {
            window.saveSessionData();
        }
        void refreshPatternFilteredView();
    };

    window.resetSession = function () {
        if (window.toggleModal) {
            window.toggleModal('confirmModal');
        }
    };

    window.toggleStopwatch = function () {
        const icon = document.getElementById('stopwatchIcon');
        const text = document.getElementById('stopwatchText');
        const display = document.getElementById('stopwatchDisplay');

        if (stopwatchInterval) {
            clearInterval(stopwatchInterval);
            stopwatchInterval = null;
            if (icon) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            }
            if (text) {
                text.innerText = 'Start';
            }
            return;
        }

        stopwatchInterval = setInterval(() => {
            stopwatchSeconds++;
            if (!display) return;

            const hours = Math.floor(stopwatchSeconds / 3600);
            const minutes = Math.floor((stopwatchSeconds % 3600) / 60);
            const seconds = stopwatchSeconds % 60;
            display.innerText = `${hours.toString().padStart(2, '0')}:${minutes
                .toString()
                .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);

        if (icon) {
            icon.classList.remove('fa-play');
            icon.classList.add('fa-pause');
        }
        if (text) {
            text.innerText = 'Pause';
        }
    };

    window.resetStopwatch = function () {
        if (stopwatchInterval) {
            clearInterval(stopwatchInterval);
        }
        stopwatchInterval = null;
        stopwatchSeconds = 0;

        const display = document.getElementById('stopwatchDisplay');
        const icon = document.getElementById('stopwatchIcon');
        const text = document.getElementById('stopwatchText');

        if (display) {
            display.innerText = '00:00:00';
        }
        if (icon) {
            icon.classList.remove('fa-pause');
            icon.classList.add('fa-play');
        }
        if (text) {
            text.innerText = 'Start';
        }
    };

    if (typeof document !== 'undefined' && document.addEventListener) {
        document.addEventListener('click', event => {
            const shell = document.getElementById('patternFilterShell');
            const popover = document.getElementById('patternFilterPopover');

            if (shell && popover && !popover.classList.contains('hidden') && !shell.contains(event.target)) {
                window.closePatternFilterPopover();
            }
        });
    }
})();
