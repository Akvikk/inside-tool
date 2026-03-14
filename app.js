
async function yieldToMainThread() {
    if (window.scheduler && typeof window.scheduler.yield === 'function') {
        await window.scheduler.yield();
        return;
    }
    if (typeof window.requestIdleCallback === 'function') {
        await new Promise(resolve => window.requestIdleCallback(() => resolve(), { timeout: 32 }));
        return;
    }
    await new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function cloneStrategySyncCacheEntry(entry) {
    if (!entry) return null;
    return {
        historyLength: entry.historyLength,
        snapshot: entry.snapshot || null,
        notifications: Array.isArray(entry.notifications) ? entry.notifications.slice() : [],
        nextBets: Array.isArray(entry.nextBets) ? entry.nextBets.slice() : []
    };
}

function getCachedStrategySync(strategyKey = state.currentGameplayStrategy) {
    const entry = state.strategySyncCache[strategyKey];
    if (!entry || entry.historyLength !== state.history.length) {
        return null;
    }
    return cloneStrategySyncCacheEntry(entry);
}

function applyCachedStrategySync(strategyKey = state.currentGameplayStrategy) {
    const cached = getCachedStrategySync(strategyKey);
    if (!cached) return false;

    state.engineSnapshot = cached.snapshot || state.engineSnapshot;
    window.currentAlerts = cached.notifications;
    state.activeBets = cached.nextBets;
    return true;
}
