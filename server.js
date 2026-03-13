const http = require('node:http');
const { URL } = require('node:url');

const HOST = '127.0.0.1';
const PORT = Number(process.env.AI_RELAY_PORT || 8787);
const GEMINI_MODEL = 'gemini-2.5-flash';
const OPENAI_MODEL = 'gpt-4o-mini';
const REQUEST_CACHE_TTL_MS = 30_000;
const REQUEST_CACHE_LIMIT = 60;
const ALLOWED_ORIGINS = new Set([
    'null',
    'http://127.0.0.1',
    'http://localhost',
    `http://${HOST}:${PORT}`
]);

let connection = {
    provider: '',
    apiKey: '',
    connectedAt: 0
};
const responseCache = new Map();

function getCorsOrigin(req) {
    const origin = req.headers.origin;
    if (!origin) return '*';
    return ALLOWED_ORIGINS.has(origin) ? origin : null;
}

function sendJson(req, res, statusCode, payload) {
    const corsOrigin = getCorsOrigin(req);
    if (req.headers.origin && !corsOrigin) {
        res.writeHead(403, {
            'Content-Type': 'application/json; charset=utf-8',
            'Cache-Control': 'no-store',
            'Vary': 'Origin'
        });
        res.end(JSON.stringify({ error: 'Origin not allowed.' }));
        return;
    }

    res.writeHead(statusCode, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': corsOrigin,
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Vary': 'Origin'
    });
    res.end(JSON.stringify(payload));
}

function isConnected() {
    return Boolean(connection.provider && connection.apiKey);
}

function buildStatusPayload() {
    return {
        ok: true,
        relay: 'local-memory',
        connected: isConnected(),
        provider: connection.provider || null,
        connectedAt: connection.connectedAt || null
    };
}

function getCacheKey(prompt, options) {
    return JSON.stringify({
        provider: connection.provider,
        prompt,
        options: options || {}
    });
}

function pruneResponseCache() {
    const now = Date.now();
    for (const [key, entry] of responseCache.entries()) {
        if (!entry || now - entry.createdAt > REQUEST_CACHE_TTL_MS) {
            responseCache.delete(key);
        }
    }

    while (responseCache.size > REQUEST_CACHE_LIMIT) {
        const oldestKey = responseCache.keys().next().value;
        if (!oldestKey) break;
        responseCache.delete(oldestKey);
    }
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => {
            raw += chunk;
            if (raw.length > 1_000_000) {
                reject(new Error('Payload too large.'));
                req.destroy();
            }
        });
        req.on('end', () => {
            if (!raw) {
                resolve({});
                return;
            }
            try {
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(new Error('Invalid JSON payload.'));
            }
        });
        req.on('error', reject);
    });
}

function createTimeoutController(timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return { controller, timeoutId };
}

async function verifyProviderKey(provider, apiKey) {
    if (provider === 'gemini') {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}`, {
            method: 'GET',
            headers: {
                'x-goog-api-key': apiKey
            }
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error((data.error && data.error.message) || `Gemini verification failed (${res.status})`);
        }
        return;
    }

    if (provider === 'openai') {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                max_tokens: 8,
                messages: [{ role: 'user', content: 'ping' }]
            })
        });
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error((data.error && data.error.message) || `OpenAI verification failed (${res.status})`);
        }
        return;
    }

    throw new Error('Unsupported AI provider.');
}

async function requestProviderText(prompt, options = {}) {
    if (!isConnected()) {
        throw new Error('No AI key is connected in the local relay.');
    }

    pruneResponseCache();
    const cacheKey = getCacheKey(prompt, options);
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt <= REQUEST_CACHE_TTL_MS) {
        return cached.text;
    }

    const temperature = typeof options.temperature === 'number' ? options.temperature : 0.2;
    const maxOutputTokens = Number.isFinite(options.maxOutputTokens) ? options.maxOutputTokens : 320;
    const responseMimeType = options.responseMimeType || null;
    const responseSchema = options.responseSchema || null;
    const { controller, timeoutId } = createTimeoutController(15000);

    try {
        if (connection.provider === 'gemini') {
            const generationConfig = {
                temperature,
                maxOutputTokens,
                ...(responseMimeType ? { responseMimeType } : {}),
                ...(responseSchema ? { responseSchema } : {})
            };

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': connection.apiKey
                },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig
                }),
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error((data.error && data.error.message) || `Gemini request failed (${res.status})`);
            }

            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
            responseCache.set(cacheKey, { text, createdAt: Date.now() });
            return text;
        }

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${connection.apiKey}`
            },
            body: JSON.stringify({
                model: OPENAI_MODEL,
                temperature,
                max_tokens: maxOutputTokens,
                messages: [{ role: 'user', content: prompt }],
                ...(responseMimeType === 'application/json'
                    ? { response_format: { type: 'json_object' } }
                    : {})
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        const data = await res.json();
        if (!res.ok || data.error) {
            throw new Error((data.error && data.error.message) || `OpenAI request failed (${res.status})`);
        }

        const text = data?.choices?.[0]?.message?.content || '';
        responseCache.set(cacheKey, { text, createdAt: Date.now() });
        return text;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function handleRequest(req, res) {
    if (req.method === 'OPTIONS') {
        sendJson(req, res, 204, {});
        return;
    }

    const url = new URL(req.url, `http://${HOST}:${PORT}`);

    if (req.method === 'GET' && url.pathname === '/api/ai/status') {
        sendJson(req, res, 200, buildStatusPayload());
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/connect') {
        const body = await readJsonBody(req);
        const provider = String(body.provider || '').trim().toLowerCase();
        const apiKey = String(body.apiKey || '').trim();
        if (!provider || !apiKey) {
            sendJson(req, res, 400, { error: 'Provider and API key are required.' });
            return;
        }

        await verifyProviderKey(provider, apiKey);
        connection = {
            provider,
            apiKey,
            connectedAt: Date.now()
        };
        responseCache.clear();
        sendJson(req, res, 200, buildStatusPayload());
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/disconnect') {
        connection = {
            provider: '',
            apiKey: '',
            connectedAt: 0
        };
        responseCache.clear();
        sendJson(req, res, 200, buildStatusPayload());
        return;
    }

    if (req.method === 'POST' && url.pathname === '/api/ai/request') {
        const body = await readJsonBody(req);
        const prompt = String(body.prompt || '');
        if (!prompt.trim()) {
            sendJson(req, res, 400, { error: 'Prompt is required.' });
            return;
        }

        const text = await requestProviderText(prompt, body.options || {});
        sendJson(req, res, 200, {
            ok: true,
            text,
            provider: connection.provider
        });
        return;
    }

    if (req.method === 'GET' && url.pathname === '/') {
        sendJson(req, res, 200, {
            ok: true,
            message: 'INSIDE tool AI relay is running.',
            ...buildStatusPayload()
        });
        return;
    }

    sendJson(req, res, 404, { error: 'Not found.' });
}

const server = http.createServer((req, res) => {
    handleRequest(req, res).catch(error => {
        sendJson(req, res, 500, {
            error: error && error.message ? error.message : 'Unknown relay error.'
        });
    });
});

server.listen(PORT, HOST, () => {
    console.log(`AI relay listening on http://${HOST}:${PORT}`);
});
