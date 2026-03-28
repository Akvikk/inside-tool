(function () {
    'use strict';

    function ensureExibitlStats() {
        if (!window.state) window.state = {};
        if (!window.state.exibitlStats) {
            window.state.exibitlStats = {
                totalWins: 0,
                totalLosses: 0,
                netUnits: 0,
                currentStreak: 0,
                bankrollHistory: [0],
                patternStats: {},
                signalLog: []
            };
        }
        return window.state.exibitlStats;
    }

    window.ExibitlAnalytics = {
        /**
         * Resolves bets for ExibitL without touching the core Strategy engine metrics.
         * Processes the win/loss state for custom prediction targetNums arrays.
         */
        resolve(val, activeBets, currentSpinIndex) {
            if (!activeBets || activeBets.length === 0) return [];
            
            const stats = ensureExibitlStats();
            const resolvedBets = [];

            activeBets.forEach(bet => {
                if (bet.status === 'SIT_OUT' || !bet.targetNums) return;

                // Is Win logic: did the spun number land squarely inside the array of targets?
                const isWin = bet.targetNums.includes(val);
                
                // Mathematics of analytics: unit change
                // Standard bet size is assumed 1 unit per target number.
                // Payout is 35-to-1. Total return = 36 if hit, minus total numbers backed.
                const unitsBet = bet.targetNums.length;
                const unitChange = isWin ? (36 - unitsBet) : -unitsBet;

                // Update Stats
                if (isWin) {
                    stats.totalWins++;
                    stats.currentStreak = stats.currentStreak >= 0 ? stats.currentStreak + 1 : 1;
                } else {
                    stats.totalLosses++;
                    stats.currentStreak = stats.currentStreak <= 0 ? stats.currentStreak - 1 : -1;
                }

                stats.netUnits += unitChange;
                stats.bankrollHistory.push(stats.netUnits);

                const pName = bet.patternName || 'ExibitL';
                if (!stats.patternStats[pName]) stats.patternStats[pName] = { wins: 0, losses: 0 };
                
                if (isWin) stats.patternStats[pName].wins++;
                else stats.patternStats[pName].losses++;

                stats.signalLog.push({
                    result: isWin ? 'WIN' : 'LOSS',
                    units: unitChange,
                    patternName: pName,
                    spinIndex: currentSpinIndex,
                    spinNum: val
                });

                // Update standard generic userStats so the DOM modals still render something.
                if (bet.confirmed && window.updateUserStats) {
                    window.updateUserStats(isWin, bet, currentSpinIndex, unitChange);
                }

                resolvedBets.push({
                    patternName: pName,
                    filterKey: bet.filterKey || pName,
                    strategy: 'exibitl',
                    targetNums: bet.targetNums,
                    isWin: isWin,
                    label: `BET [${unitsBet} nums]`,
                    unitChange: unitChange,
                    confirmed: bet.confirmed === true
                });
            });

            return resolvedBets;
        },

        getStats() {
            return ensureExibitlStats();
        },

        reset() {
            if (window.state) {
                window.state.exibitlStats = null;
            }
            ensureExibitlStats();
        }
    };
})();
