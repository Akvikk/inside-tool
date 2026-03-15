(function () {
    window.config = {
        RED_NUMS: [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36],
        PERIMETER_RULE_KEY: 'Perimeter Rule',
        PREDICTION_PERIMETER_PATTERN: 'Prediction Perimeter',
        AI_TAKEOVER_PATTERN: 'AI Takeover',
        ENGINE_PRIMARY_WINDOW: 14,
        ENGINE_CONFIRMATION_WINDOW: 5,
        HUD_RECENT_WINDOW: 14,
        GEMINI_MODEL: 'gemini-2.5-flash',
        AI_RELAY_BASE_URL: 'http://127.0.0.1:8787/api/ai',
        AI_RELAY_SENTINEL: '__inside_tool_secure_relay__',
        INTELLIGENCE_VIEW_KEY: 'insideTool.intelligenceViewMode',
        INTELLIGENCE_VIEWS: ['brief', 'diagnostic', 'minimal'],
        RACETRACK_ORDER: [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26],
        BULK_REPLAY_CHUNK_SIZE: 24,
        HISTORY_RENDER_CHUNK_SIZE: 80,
    };
})();
