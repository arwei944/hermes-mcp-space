/**
 * DataService — 统一传输层
 *
 * 职责:
 * 1. 请求去重 — 相同 source + params 的请求自动合并
 * 2. 智能缓存 — TTL(60s) + LRU(100条) + SSE 触发失效
 * 3. 错误恢复 — 分类重试（network/timeout/server/client）
 * 4. 响应格式统一 — 兼容 {success,data} / 直接数组 / {results}
 * 5. 并发控制 — 最多 6 个并发请求
 * 6. 请求取消 — AbortController 支持
 *
 * 依赖: API (全局), Bus (全局), Logger (全局)
 */
const DataService = (() => {
    'use strict';

    // ── Constants ─────────────────────────────────────────
    const CACHE_TTL = 60000;          // 60s
    const CACHE_MAX = 100;            // LRU 上限
    const MAX_CONCURRENT = 6;         // 并发上限

    const RETRY_STRATEGIES = {
        network:  { retry: 3, backoff: [1000, 2000, 4000] },
        timeout:  { retry: 2, backoff: [1000, 2000] },
        server:   { retry: 1, backoff: [2000] },
        client:   { retry: 0 },
        cancelled:{ retry: 0 },
        unknown:  { retry: 0 }
    };

    // SSE 事件 → 缓存失效 source 映射
    const SSE_INVALIDATION_MAP = {
        'sse:knowledge.updated':  ['knowledge'],
        'sse:knowledge.created':  ['knowledge'],
        'sse:knowledge.deleted':  ['knowledge'],
        'sse:rules.updated':      ['rules'],
        'sse:rules.created':      ['rules'],
        'sse:rules.deleted':      ['rules'],
        'sse:experiences.updated':['experiences'],
        'sse:experiences.created':['experiences'],
        'sse:experiences.deleted':['experiences'],
        'sse:memories.updated':   ['memories'],
        'sse:memories.created':   ['memories'],
        'sse:memories.deleted':   ['memories'],
        'sse:reviews.updated':    ['reviews'],
        'sse:sessions.created':   ['sessions'],
        'sse:sessions.updated':   ['sessions'],
        'sse:sessions.deleted':   ['sessions'],
        'sse:cron.updated':       ['cron'],
        'sse:agents.updated':     ['agents'],
        'sse:mcp.tool_call':      ['mcp'],
        'sse:mcp.tool_complete':  ['mcp'],
        'sse:ops.metrics':        ['ops', 'dashboard']
    };

    // source → API 调用映射
    const SOURCE_API_MAP = {
        'knowledge':           () => API.knowledge?.items?.() || API.get('/api/knowledge/items'),
        'rules':               () => API.knowledge?.rules?.() || API.get('/api/knowledge/rules'),
        'experiences':         () => API.knowledge?.experiences?.() || API.get('/api/knowledge/experiences'),
        'memories':            () => API.memory?.getMemory?.() || API.get('/api/memory'),
        'sessions':            () => API.sessions?.list?.() || API.get('/api/sessions'),
        'sessions.recent':     () => API.sessions?.list?.({ limit: 10 }) || API.get('/api/sessions?limit=10'),
        'reviews':             () => API.reviews?.list?.() || API.get('/api/reviews'),
        'reviews.stats':       () => API.reviews?.stats?.() || API.get('/api/reviews/stats'),
        'cron':                () => API.cron?.list?.() || API.get('/api/cron'),
        'agents':              () => API.agents?.list?.() || API.get('/api/agents'),
        'mcp':                 () => API.mcp?.status?.() || API.get('/api/mcp/status'),
        'mcpServers':          () => API.mcpServers?.list?.() || API.get('/api/mcp/servers'),
        'tools':               () => API.tools?.list?.() || API.get('/api/tools'),
        'skills':              () => API.skills?.list?.() || API.get('/api/skills'),
        'system.status':       () => API.system?.status?.() || API.get('/api/system/status'),
        'system.health':       () => API.system?.health?.() || API.get('/api/system/health'),
        'system.dashboard':    () => API.system?.dashboard?.() || API.get('/api/system/dashboard'),
        'ops.metrics':         () => API.ops?.metrics?.() || API.get('/api/ops/metrics'),
        'ops.mcpHealth':       () => API.ops?.mcpHealth?.() || API.get('/api/ops/mcp-health'),
        'ops.alertRules':      () => API.ops?.alertRules?.() || API.get('/api/ops/alert-rules'),
        'ops.alertHistory':    () => API.ops?.alertHistory?.() || API.get('/api/ops/alert-history'),
        'dashboard.activity':  () => API.dashboard?.activity?.() || API.get('/api/dashboard/activity'),
        'dashboard.trend':     () => API.dashboard?.trend?.() || API.get('/api/dashboard/trend'),
        'dashboard.ranking':   () => API.dashboard?.ranking?.() || API.get('/api/dashboard/ranking'),
        'config':              () => API.config?.get?.() || API.get('/api/config'),
        'user.profile':        () => API.memory?.getUser?.() || API.get('/api/memory/user')
    };

    // ── Internal State ────────────────────────────────────
    const _cache = new Map();         // cacheKey → { data, timestamp, accessCount }
    const _pending = new Map();       // cacheKey → { promise, abortController, subscribers: [] }
    const _subscribers = new Map();   // source → Set<callback>
    const _activeCount = { value: 0 };
    const _queue = [];                // 等待队列
    let _initialized = false;
    let _sseCleanupFns = [];

    // ── Cache Manager ─────────────────────────────────────

    /**
     * 生成缓存 key
     */
    function _cacheKey(source, params) {
        return `${source}:${JSON.stringify(params || {})}`;
    }

    /**
     * 获取缓存
     */
    function _cacheGet(key) {
        const entry = _cache.get(key);
        if (!entry) return null;

        // 检查 TTL
        if (Date.now() - entry.timestamp > CACHE_TTL) {
            _cache.delete(key);
            return null;
        }

        // 更新访问计数（LRU）
        entry.accessCount++;
        return entry.data;
    }

    /**
     * 设置缓存
     */
    function _cacheSet(key, data) {
        // LRU 淘汰
        if (_cache.size >= CACHE_MAX) {
            let oldest = null;
            let oldestAccess = Infinity;
            for (const [k, v] of _cache) {
                if (v.accessCount < oldestAccess) {
                    oldestAccess = v.accessCount;
                    oldest = k;
                }
            }
            if (oldest) _cache.delete(oldest);
        }

        _cache.set(key, {
            data,
            timestamp: Date.now(),
            accessCount: 1
        });
    }

    /**
     * 使缓存失效（按 source 前缀匹配）
     */
    function _cacheInvalidate(source) {
        const prefix = `${source}:`;
        for (const key of _cache.keys()) {
            if (key.startsWith(prefix)) {
                _cache.delete(key);
            }
        }
        Logger.debug(`[DataService] Cache invalidated for source: ${source}`);
    }

    /**
     * 清空所有缓存
     */
    function _cacheClear() {
        _cache.clear();
        Logger.debug('[DataService] All cache cleared');
    }

    // ── Response Normalizer ───────────────────────────────

    /**
     * 统一处理多种后端响应格式
     */
    function normalizeResponse(response) {
        if (response == null) return null;

        // 格式1: { success: true, data: {...} }
        if (typeof response === 'object' && 'success' in response) {
            return response.success ? response.data : response;
        }

        // 格式2: { results: [...], total: 100 }
        if (typeof response === 'object' && 'results' in response) {
            return response.results;
        }

        // 格式3: { data: [...] } (no success field)
        if (typeof response === 'object' && 'data' in response && !('success' in response)) {
            return response.data;
        }

        // 格式4: 直接返回数组或对象
        return response;
    }

    // ── Error Classifier ──────────────────────────────────

    /**
     * 分类错误类型
     */
    function _classifyError(error) {
        if (error && error.name === 'AbortError') return 'cancelled';

        const msg = (error && error.message) || '';

        if (msg.includes('timeout') || msg.includes('Timeout') || msg.includes('Timed out')) {
            return 'timeout';
        }
        if (msg.includes('network') || msg.includes('Network') ||
            msg.includes('fetch') || msg.includes('Failed to fetch') ||
            msg.includes('NetWorkError') || msg.includes('ERR_NETWORK')) {
            return 'network';
        }

        // 检查 HTTP 状态码
        if (error && error.status) {
            if (error.status >= 500) return 'server';
            if (error.status >= 400) return 'client';
        }

        return 'unknown';
    }

    // ── Concurrency Control ───────────────────────────────

    /**
     * 请求完成后处理队列
     */
    function _releaseSlot() {
        _activeCount.value--;
        if (_queue.length > 0 && _activeCount.value < MAX_CONCURRENT) {
            const next = _queue.shift();
            _activeCount.value++;
            next();
        }
    }

    /**
     * 获取执行槽位（超过并发限制则排队）
     */
    function _acquireSlot() {
        return new Promise(resolve => {
            if (_activeCount.value < MAX_CONCURRENT) {
                _activeCount.value++;
                resolve();
            } else {
                _queue.push(() => {
                    _activeCount.value++;
                    resolve();
                });
            }
        });
    }

    // ── Core Fetch Logic ──────────────────────────────────

    /**
     * 执行 API 请求（带重试）
     */
    async function _executeRequest(source, params, signal) {
        const apiFn = SOURCE_API_MAP[source];
        if (!apiFn) {
            throw new Error(`[DataService] Unknown source: ${source}`);
        }

        // 检查取消
        if (signal && signal.aborted) {
            const err = new Error('Request cancelled');
            err.name = 'AbortError';
            throw err;
        }

        let lastError = null;
        let attempt = 0;
        const maxAttempts = 1; // 首次尝试

        try {
            const rawResponse = await apiFn();
            return normalizeResponse(rawResponse);
        } catch (error) {
            lastError = error;
            const errorType = _classifyError(error);
            const strategy = RETRY_STRATEGIES[errorType] || RETRY_STRATEGIES.unknown;

            // 重试
            for (let i = 0; i < strategy.retry; i++) {
                attempt++;
                const delay = strategy.backoff[i] || 1000;
                Logger.debug(`[DataService] Retry ${attempt}/${strategy.retry} for ${source} (${errorType}), delay ${delay}ms`);

                await new Promise(r => setTimeout(r, delay));

                // 再次检查取消
                if (signal && signal.aborted) {
                    const err = new Error('Request cancelled');
                    err.name = 'AbortError';
                    throw err;
                }

                try {
                    const rawResponse = await apiFn();
                    return normalizeResponse(rawResponse);
                } catch (retryError) {
                    lastError = retryError;
                }
            }

            // 所有重试都失败
            const finalErrorType = _classifyError(lastError);
            Logger.error(`[DataService] Request failed for ${source} (${finalErrorType}):`, lastError.message);
            throw { _type: finalErrorType, _source: source, ...lastError };
        }
    }

    // ── SSE Integration ───────────────────────────────────

    /**
     * 设置 SSE 事件监听，自动触发缓存失效
     */
    function _setupSSEListeners() {
        for (const [sseEvent, sources] of Object.entries(SSE_INVALIDATION_MAP)) {
            const handler = () => {
                for (const source of sources) {
                    _cacheInvalidate(source);
                }
                // 通知订阅者数据已更新
                for (const source of sources) {
                    _notifySubscribers(source);
                }
            };
            Bus.on(sseEvent, handler);
            _sseCleanupFns.push(() => Bus.off(sseEvent, handler));
        }
    }

    /**
     * 通知 source 的所有订阅者
     */
    function _notifySubscribers(source) {
        const subs = _subscribers.get(source);
        if (!subs || subs.size === 0) return;

        // 重新获取最新数据并通知
        for (const callback of subs) {
            try {
                // 异步刷新，不阻塞
                _fetchWithDedup(source, null, null, true).then(data => {
                    callback(data);
                }).catch(() => {
                    // 静默失败，订阅者会在下次 fetch 时获取错误
                });
            } catch (e) {
                Logger.warn('[DataService] Subscriber notification failed:', e.message);
            }
        }
    }

    // ── Request Deduplication ─────────────────────────────

    /**
     * 带去重的 fetch
     */
    async function _fetchWithDedup(source, params, onUpdate, forceRefresh = false) {
        const key = _cacheKey(source, params);

        // 1. 检查缓存（非强制刷新时）
        if (!forceRefresh) {
            const cached = _cacheGet(key);
            if (cached !== null) {
                Logger.debug(`[DataService] Cache hit: ${source}`);
                return cached;
            }
        }

        // 2. 检查 pending 请求（去重）
        if (_pending.has(key) && !forceRefresh) {
            Logger.debug(`[DataService] Dedup: reusing pending request for ${source}`);
            const pending = _pending.get(key);
            if (onUpdate) {
                pending.subscribers.push(onUpdate);
            }
            return pending.promise;
        }

        // 3. 创建新请求
        const abortController = new AbortController();
        const promise = _acquireSlot().then(async () => {
            try {
                const data = await _executeRequest(source, params, abortController.signal);
                _cacheSet(key, data);
                return data;
            } finally {
                _releaseSlot();
            }
        });

        // 注册 pending
        const pendingEntry = {
            promise,
            abortController,
            subscribers: onUpdate ? [onUpdate] : []
        };
        _pending.set(key, pendingEntry);

        try {
            const data = await promise;
            return data;
        } finally {
            _pending.delete(key);
        }
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 初始化 DataService
     */
    function init() {
        if (_initialized) {
            Logger.warn('[DataService] Already initialized');
            return;
        }

        Logger.info('[DataService] Initializing...');
        _setupSSEListeners();
        _initialized = true;
        Logger.info('[DataService] Initialized successfully');
        Bus.emit('ws:data:ready');
    }

    /**
     * 获取数据
     * @param {string} source - 数据源标识（如 'knowledge', 'sessions.recent'）
     * @param {Object} params - 请求参数
     * @param {Function} onUpdate - 数据更新回调（用于 SSE 推送时通知）
     * @returns {Promise<any>} 数据
     */
    async function fetch(source, params = null, onUpdate = null) {
        return _fetchWithDedup(source, params, onUpdate, false);
    }

    /**
     * 强制刷新数据（跳过缓存）
     */
    async function refresh(source, params = null) {
        return _fetchWithDedup(source, params, null, true);
    }

    /**
     * 批量获取
     * @param {Array<{source, params, onUpdate}>} requests
     * @returns {Promise<Array>} 按顺序返回结果
     */
    async function batch(requests) {
        return Promise.all(
            requests.map(r => fetch(r.source, r.params, r.onUpdate))
        );
    }

    /**
     * 订阅数据源变化
     * @param {string} source - 数据源标识
     * @param {Function} callback - 数据更新回调
     * @returns {Function} 取消订阅函数
     */
    function subscribe(source, callback) {
        if (!_subscribers.has(source)) {
            _subscribers.set(source, new Set());
        }
        _subscribers.get(source).add(callback);

        // 返回取消订阅函数
        return () => {
            const subs = _subscribers.get(source);
            if (subs) {
                subs.delete(callback);
                if (subs.size === 0) {
                    _subscribers.delete(source);
                }
            }
        };
    }

    /**
     * 取消指定 source 的 pending 请求
     */
    function cancel(source, params = null) {
        const key = _cacheKey(source, params);
        const pending = _pending.get(key);
        if (pending) {
            pending.abortController.abort();
            _pending.delete(key);
            Logger.debug(`[DataService] Cancelled request: ${source}`);
        }
    }

    /**
     * 取消所有 pending 请求
     */
    function cancelAll() {
        for (const [key, pending] of _pending) {
            pending.abortController.abort();
        }
        _pending.clear();
        Logger.debug('[DataService] All requests cancelled');
    }

    /**
     * 使指定 source 的缓存失效
     */
    function invalidate(source) {
        _cacheInvalidate(source);
    }

    /**
     * 清空所有缓存
     */
    function clearCache() {
        _cacheClear();
    }

    /**
     * 获取缓存统计（调试用）
     */
    function getCacheStats() {
        return {
            size: _cache.size,
            max: CACHE_MAX,
            pending: _pending.size,
            active: _activeCount.value,
            queued: _queue.length,
            subscribers: _subscribers.size
        };
    }

    /**
     * 注册自定义数据源
     * @param {string} source - 数据源标识
     * @param {Function} fetchFn - 返回 Promise 的获取函数
     */
    function registerSource(source, fetchFn) {
        if (SOURCE_API_MAP[source]) {
            Logger.warn(`[DataService] Overriding existing source: ${source}`);
        }
        SOURCE_API_MAP[source] = fetchFn;
    }

    /**
     * 注册 SSE 事件到缓存失效的映射
     * @param {string} sseEvent - SSE 事件名（不含 sse: 前缀）
     * @param {string[]} sources - 要失效的数据源列表
     */
    function registerSSEMapping(sseEvent, sources) {
        const key = `sse:${sseEvent}`;
        if (SSE_INVALIDATION_MAP[key]) {
            SSE_INVALIDATION_MAP[key] = [...new Set([...SSE_INVALIDATION_MAP[key], ...sources])];
        } else {
            SSE_INVALIDATION_MAP[key] = sources;
            // 动态添加 Bus 监听
            const handler = () => {
                for (const source of sources) {
                    _cacheInvalidate(source);
                }
                for (const source of sources) {
                    _notifySubscribers(source);
                }
            };
            Bus.on(key, handler);
            _sseCleanupFns.push(() => Bus.off(key, handler));
        }
    }

    /**
     * 销毁 DataService
     */
    function destroy() {
        cancelAll();
        _cache.clear();
        _subscribers.clear();
        for (const cleanup of _sseCleanupFns) {
            cleanup();
        }
        _sseCleanupFns = [];
        _initialized = false;
        Logger.info('[DataService] Destroyed');
    }

    // ── Expose ────────────────────────────────────────────
    return {
        init,
        destroy,
        fetch,
        refresh,
        batch,
        subscribe,
        cancel,
        cancelAll,
        invalidate,
        clearCache,
        getCacheStats,
        registerSource,
        registerSSEMapping,
        normalizeResponse
    };
})();
