/**
 * Engine Contract Boundary
 * Validates and sanitizes data exchanged between engine logic and UI.
 */
(function () {
    'use strict';

    function isObject(value) {
        return value !== null && typeof value === 'object' && !Array.isArray(value);
    }

    function asString(value, fallback = '') {
        return typeof value === 'string' ? value : fallback;
    }

    function asNumber(value, fallback = 0) {
        return Number.isFinite(value) ? value : fallback;
    }

    function asInteger(value, fallback = 0) {
        const n = Number(value);
        return Number.isInteger(n) ? n : fallback;
    }

    function asEnum(value, allowed, fallback) {
        const normalized = String(value || '').toUpperCase();
        return allowed.includes(normalized) ? normalized : fallback;
    }

    function toFace(value) {
        const face = asInteger(value, NaN);
        return face >= 1 && face <= 5 ? face : null;
    }

    function toSpinNumber(value) {
        const n = asInteger(value, NaN);
        return n >= 0 && n <= 36 ? n : null;
    }

    function sanitizeBet(raw) {
        const input = isObject(raw) ? raw : {};
        const status = asEnum(input.status, ['GO', 'WATCH', 'SIT_OUT'], 'GO');
        const targetFace = status === 'SIT_OUT' ? null : toFace(input.targetFace);

        return {
            patternName: asString(input.patternName, 'Unknown Pattern'),
            filterKey: asString(input.filterKey, asString(input.patternName, 'Unknown Pattern')),
            strategy: asString(input.strategy, ''),
            targetFace,
            comboLabel: input.comboLabel == null ? null : asString(input.comboLabel, null),
            confidence: asNumber(input.confidence, 0),
            subtitle: asString(input.subtitle, ''),
            reason: asString(input.reason, ''),
            mode: input.mode == null ? null : asString(input.mode, null),
            status,
            signalSource: asString(input.signalSource, 'math'),
            accentColor: asString(input.accentColor, '')
        };
    }

    function sanitizeAlert(raw) {
        const input = isObject(raw) ? raw : {};
        return {
            type: asEnum(input.type, ['ACTIVE', 'LOCKED', 'INFO'], 'INFO'),
            strategy: asString(input.strategy, ''),
            patternName: asString(input.patternName, ''),
            fA: toFace(input.fA),
            fB: toFace(input.fB),
            count: Math.max(0, asInteger(input.count, 0)),
            confidence: asNumber(input.confidence, 0)
        };
    }

    function sanitizeSyncResult(raw) {
        const input = isObject(raw) ? raw : {};
        const notifications = Array.isArray(input.notifications)
            ? input.notifications.map(sanitizeAlert)
            : [];
        const nextBets = Array.isArray(input.nextBets)
            ? input.nextBets.map(sanitizeBet)
            : [];

        return {
            notifications,
            nextBets
        };
    }

    function validateBetShape(bet, index, errors) {
        if (!isObject(bet)) {
            errors.push(`nextBets[${index}] is not an object`);
            return;
        }
        if (!['GO', 'WATCH', 'SIT_OUT'].includes(String(bet.status || '').toUpperCase())) {
            errors.push(`nextBets[${index}].status is invalid`);
        }
        if (bet.status !== 'SIT_OUT' && bet.targetFace != null && (bet.targetFace < 1 || bet.targetFace > 5)) {
            errors.push(`nextBets[${index}].targetFace out of range`);
        }
    }

    function validateAlertShape(alert, index, errors) {
        if (!isObject(alert)) {
            errors.push(`notifications[${index}] is not an object`);
            return;
        }
        if (!['ACTIVE', 'LOCKED', 'INFO'].includes(String(alert.type || '').toUpperCase())) {
            errors.push(`notifications[${index}].type is invalid`);
        }
    }

    function validateSyncResult(raw) {
        const errors = [];
        if (!isObject(raw)) {
            return { valid: false, errors: ['sync result is not an object'] };
        }
        if (!Array.isArray(raw.notifications)) {
            errors.push('notifications is not an array');
        }
        if (!Array.isArray(raw.nextBets)) {
            errors.push('nextBets is not an array');
        }

        (raw.notifications || []).forEach((alert, index) => validateAlertShape(alert, index, errors));
        (raw.nextBets || []).forEach((bet, index) => validateBetShape(bet, index, errors));

        return {
            valid: errors.length === 0,
            errors
        };
    }

    function sanitizeSpinObject(raw, fallbackIndex = 0) {
        const input = isObject(raw) ? raw : {};
        const num = toSpinNumber(input.num);
        const faces = Array.isArray(input.faces)
            ? input.faces.map(toFace).filter(face => face !== null)
            : [];

        return {
            num: num == null ? 0 : num,
            faces,
            index: asInteger(input.index, fallbackIndex),
            resolvedBets: Array.isArray(input.resolvedBets) ? input.resolvedBets.slice() : [],
            newSignals: Array.isArray(input.newSignals) ? input.newSignals.slice() : [],
            id: input.id == null ? (fallbackIndex + 1) : input.id
        };
    }

    window.EngineContract = {
        sanitizeBet,
        sanitizeAlert,
        sanitizeSyncResult,
        validateSyncResult,
        sanitizeSpinObject,
        toSpinNumber
    };
})();

