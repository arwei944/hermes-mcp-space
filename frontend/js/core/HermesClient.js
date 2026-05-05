/**
 * HermesClient.js — Hermes Workspace V2 统一通信层
 *
 * 合并 4 个通信模块为统一客户端：
 *   1. api.js        → API 端点定义
 *   2. APIClient.js  → HTTP 重试 / 链路追踪 / 错误上报 / 超时
 *   3. SSEManager    → SSE 连接 / 重连 / 轮询降级
 *   4. DataService   → TTL + LRU 缓存 / 请求去重 / 并发控制 / SSE 失效映射
 *
 * 向后兼容：
 *   window.HermesClient  — 新代码使用
 *   window.API           — 旧代码兼容（指向同一实例）
 *   window.APIClient     — 旧代码兼容（request/get/post/put/del 代理）
 *   window.APP_VERSION   — 动态 getter（通过 Object.defineProperty）
 */
'use strict';

var HermesClient = (function () {
    'use strict';

    // ================================================================
    //  常量与配置
    // ================================================================

    /** BASE_URL 检测：localhost → http://localhost:3000 */
    var BASE_URL = (function () {
        if (typeof window === 'undefined') return '';
        var h = window.location;
        if (h.hostname === 'localhost' || h.hostname === '127.0.0.1') {
            return 'http://' + h.hostname + ':3000';
        }
        return '';  // 同源，使用相对路径
    })();

    /** 默认超时 15s */
    var DEFAULT_TIMEOUT = 15000;

    /** 重试配置：502/503/504 指数退避 1s/2s/4s，最多 3 次 */
    var RETRY_STATUS_CODES = [502, 503, 504];
    var MAX_RETRIES = 3;
    var RETRY_DELAYS = [1000, 2000, 4000];

    /** 缓存配置 */
    var CACHE_TTL = 60000;       // 60 秒
    var CACHE_MAX_SIZE = 100;    // LRU 上限

    /** 并发控制 */
    var MAX_CONCURRENT = 6;

    /** SSE 配置 */
    var SSE_MAX_RECONNECTS = 5;
    var SSE_POLL_INTERVAL = 3000;  // 降级后轮询间隔 3s
    var SSE_DEFAULT_URL = '/api/events';

    /** 错误上报端点 */
    var ERROR_REPORT_URL = '/api/ops/frontend-errors';

    // ================================================================
    //  内部状态
    // ================================================================

    /** 简易事件总线（内嵌，不依赖外部 Bus.js） */
    var _listeners = {};

    /** SSE 状态 */
    var _sseSource = null;
    var _sseReconnectCount = 0;
    var _ssePollTimer = null;
    var _sseConnected = false;
    var _sseUrl = SSE_DEFAULT_URL;

    /** 缓存：Map<cacheKey, { data, timestamp }> */
    var _cache = new Map();

    /** 请求去重：Map<cacheKey, Promise> */
    var _pending = new Map();

    /** 并发控制：当前活跃请求数 */
    var _activeRequests = 0;

    /** 并发等待队列 */
    var _requestQueue = [];

    /** 热更新检查 */
    var _updateCheckTimer = null;
    var _currentVersion = null;

    // ================================================================
    //  工具函数
    // ================================================================

    /**
     * 生成 Trace-Id（链路追踪）
     * 优先使用 crypto.randomUUID，降级为时间戳+随机数
     */
    function generateTraceId() {
        if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
            return crypto.randomUUID();
        }
        return Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
    }

    /**
     * 延迟指定毫秒
     */
    function sleep(ms) {
        return new Promise(function (resolve) { setTimeout(resolve, ms); });
    }

    /**
     * 安全 JSON.stringify（处理循环引用）
     */
    function safeStringify(obj) {
        try {
            return JSON.stringify(obj);
        } catch (e) {
            return '[Circular]';
        }
    }

    /**
     * 统一处理响应格式
     * 兼容后端不一致的响应格式：
     *   { success: true, data: {...} }  → data
     *   { results: [...], total: 100 }  → results
     *   直接数组/对象                   → 原样返回
     */
    function normalizeResponse(response) {
        if (!response) return response;
        if (typeof response !== 'object') return response;
        // 标准格式
        if ('success' in response && response.success) {
            return response.data !== undefined ? response.data : response;
        }
        // 搜索分页格式
        if ('results' in response) {
            return response.results;
        }
        return response;
    }

    /**
     * 错误上报（navigator.sendBeacon）
     * 非阻塞，不影响用户体验
     */
    function reportError(error, context) {
        try {
            var payload = {
                timestamp: new Date().toISOString(),
                message: error.message || String(error),
                stack: error.stack || '',
                url: typeof window !== 'undefined' ? window.location.href : '',
                context: context || {}
            };
            var blob = new Blob([safeStringify(payload)], { type: 'application/json' });
            if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
                navigator.sendBeacon(BASE_URL + ERROR_REPORT_URL, blob);
            }
        } catch (e) {
            // 上报失败静默处理，不影响主流程
        }
    }

    /**
     * 控制台日志前缀
     */
    function _log(tag, msg) {
        if (typeof console !== 'undefined') {
            console.log('[HermesClient:' + tag + '] ' + msg);
        }
    }

    function _warn(tag, msg) {
        if (typeof console !== 'undefined') {
            console.warn('[HermesClient:' + tag + '] ' + msg);
        }
    }

    function _error(tag, msg) {
        if (typeof console !== 'undefined') {
            console.error('[HermesClient:' + tag + '] ' + msg);
        }
    }

    // ================================================================
    //  事件总线（内嵌）
    // ================================================================

    /**
     * 注册事件监听
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     */
    function on(event, handler) {
        if (!_listeners[event]) {
            _listeners[event] = [];
        }
        _listeners[event].push(handler);
    }

    /**
     * 取消事件监听
     * @param {string} event - 事件名
     * @param {Function} handler - 处理函数
     */
    function off(event, handler) {
        if (!_listeners[event]) return;
        _listeners[event] = _listeners[event].filter(function (h) {
            return h !== handler;
        });
        if (_listeners[event].length === 0) {
            delete _listeners[event];
        }
    }

    /**
     * 触发事件
     * @param {string} event - 事件名
     * @param {*} data - 事件数据
     */
    function emit(event, data) {
        if (!_listeners[event]) return;
        // 复制数组防止迭代中修改
        var handlers = _listeners[event].slice();
        for (var i = 0; i < handlers.length; i++) {
            try {
                handlers[i](data);
            } catch (e) {
                _error('Bus', '事件处理异常: ' + event + ' - ' + e.message);
            }
        }
    }

    // ================================================================
    //  HTTP 层
    // ================================================================

    /**
     * 并发控制：等待可用槽位
     */
    function acquireSlot() {
        return new Promise(function (resolve) {
            if (_activeRequests < MAX_CONCURRENT) {
                _activeRequests++;
                resolve();
                return;
            }
            _requestQueue.push(function () {
                _activeRequests++;
                resolve();
            });
        });
    }

    /**
     * 释放并发槽位
     */
    function releaseSlot() {
        _activeRequests--;
        if (_requestQueue.length > 0 && _activeRequests < MAX_CONCURRENT) {
            var next = _requestQueue.shift();
            next();
        }
    }

    /**
     * 核心请求方法
     *
     * 特性：
     *   - AbortController + 超时
     *   - X-Trace-Id 自动注入
     *   - 502/503/504 指数退避重试（最多 3 次）
     *   - 错误自动上报（sendBeacon）
     *   - 并发控制（最多 6 个）
     *   - 响应格式统一处理
     *
     * @param {string} method - HTTP 方法
     * @param {string} url - 请求路径（相对或绝对）
     * @param {Object} [options] - 选项
     * @param {Object} [options.body] - 请求体
     * @param {number} [options.timeout] - 超时毫秒数
     * @param {boolean} [options.raw] - 是否跳过响应格式化
     * @param {boolean} [options.noRetry] - 禁用重试
     * @param {AbortSignal} [options.signal] - 外部 AbortSignal
     * @returns {Promise<*>} 响应数据
     */
    async function request(method, url, options) {
        options = options || {};

        // 并发控制
        await acquireSlot();

        var timeout = options.timeout || DEFAULT_TIMEOUT;
        var retryCount = 0;
        var lastError = null;

        try {
            while (retryCount <= MAX_RETRIES) {
                var controller = new AbortController();
                var timeoutId = setTimeout(function () { controller.abort(); }, timeout);

                // 合并外部 signal
                if (options.signal) {
                    options.signal.addEventListener('abort', function () {
                        controller.abort();
                    });
                }

                var traceId = generateTraceId();
                var fullUrl = url.indexOf('http') === 0 ? url : BASE_URL + url;

                var fetchOptions = {
                    method: method,
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Trace-Id': traceId
                    },
                    signal: controller.signal
                };

                if (options.body && method !== 'GET') {
                    fetchOptions.body = typeof options.body === 'string'
                        ? options.body
                        : safeStringify(options.body);
                }

                try {
                    var response = await fetch(fullUrl, fetchOptions);
                    clearTimeout(timeoutId);

                    // 502/503/504 重试
                    if (RETRY_STATUS_CODES.indexOf(response.status) !== -1 && !options.noRetry && retryCount < MAX_RETRIES) {
                        var delay = RETRY_DELAYS[retryCount] || 4000;
                        _warn('HTTP', method + ' ' + url + ' → ' + response.status + '，第 ' + (retryCount + 1) + ' 次重试（' + delay + 'ms 后）');
                        retryCount++;
                        await sleep(delay);
                        continue;
                    }

                    // 非 2xx 响应
                    if (!response.ok) {
                        var errorBody = null;
                        try {
                            errorBody = await response.json();
                        } catch (e) {
                            errorBody = await response.text().catch(function () { return null; });
                        }

                        var apiError = new Error('HTTP ' + response.status + ': ' + (errorBody && errorBody.detail) || response.statusText);
                        apiError.status = response.status;
                        apiError.body = errorBody;
                        apiError.traceId = traceId;

                        // 4xx 不上报，5xx 上报
                        if (response.status >= 500) {
                            reportError(apiError, { method: method, url: url, traceId: traceId });
                        }

                        throw apiError;
                    }

                    // 解析响应
                    var contentType = response.headers.get('content-type') || '';
                    var data;
                    if (contentType.indexOf('application/json') !== -1) {
                        data = await response.json();
                    } else {
                        data = await response.text();
                    }

                    // 统一响应格式
                    if (!options.raw) {
                        data = normalizeResponse(data);
                    }

                    return data;

                } catch (err) {
                    clearTimeout(timeoutId);

                    // AbortError：取消或超时，不重试
                    if (err.name === 'AbortError') {
                        if (options.signal && options.signal.aborted) {
                            throw err;  // 外部取消
                        }
                        var timeoutError = new Error('请求超时 (' + timeout + 'ms): ' + method + ' ' + url);
                        timeoutError.name = 'TimeoutError';
                        timeoutError.traceId = traceId;
                        reportError(timeoutError, { method: method, url: url, traceId: traceId });
                        throw timeoutError;
                    }

                    // 网络错误重试
                    if (!options.noRetry && retryCount < MAX_RETRIES) {
                        var netDelay = RETRY_DELAYS[retryCount] || 4000;
                        _warn('HTTP', method + ' ' + url + ' → 网络错误，第 ' + (retryCount + 1) + ' 次重试（' + netDelay + 'ms 后）');
                        lastError = err;
                        retryCount++;
                        await sleep(netDelay);
                        continue;
                    }

                    // 重试耗尽
                    err.traceId = traceId;
                    reportError(err, { method: method, url: url, traceId: traceId, retryCount: retryCount });
                    throw err;
                }
            }

            // 不应到达此处
            throw lastError || new Error('请求失败: ' + method + ' ' + url);

        } finally {
            releaseSlot();
        }
    }

    /**
     * GET 请求
     */
    function get(url, options) {
        return request('GET', url, options);
    }

    /**
     * POST 请求
     */
    function post(url, body, options) {
        options = options || {};
        options.body = body;
        return request('POST', url, options);
    }

    /**
     * PUT 请求
     */
    function put(url, body, options) {
        options = options || {};
        options.body = body;
        return request('PUT', url, options);
    }

    /**
     * DELETE 请求
     */
    function del(url, options) {
        return request('DELETE', url, options);
    }

    // ================================================================
    //  SSE 层
    // ================================================================

    /**
     * SSE 事件 → 缓存失效映射
     * 当收到 SSE 事件时，自动清除对应前缀的缓存
     */
    var SSE_CACHE_INVALIDATION_MAP = {
        'knowledge.updated':       ['knowledge'],
        'rules.updated':           ['rules'],
        'experiences.updated':     ['experiences'],
        'memories.updated':        ['memories'],
        'reviews.updated':         ['reviews'],
        'mcp.tool_call':           ['mcp', 'tools'],
        'mcp.tool_complete':       ['mcp', 'tools'],
        'session.created':         ['sessions'],
        'session.updated':         ['sessions'],
        'session.deleted':         ['sessions'],
        'session.message':         ['sessions'],
        'cron.updated':            ['cron'],
        'config.updated':          ['config'],
        'agents.updated':          ['agents'],
        'api.error':               []  // 仅通知，不清缓存
    };

    /**
     * 已知的 SSE 事件类型列表
     * 用于 EventSource 代理
     */
    var KNOWN_SSE_EVENTS = [
        'message',
        'session.created',
        'session.updated',
        'session.deleted',
        'session.message',
        'knowledge.updated',
        'rules.updated',
        'experiences.updated',
        'memories.updated',
        'reviews.updated',
        'mcp.tool_call',
        'mcp.tool_complete',
        'cron.updated',
        'config.updated',
        'agents.updated',
        'api.error'
    ];

    /**
     * 建立 SSE 连接
     * @param {string} [url] - SSE 端点 URL，默认 /api/events
     */
    function connect(url) {
        if (url) _sseUrl = url;

        // 先清理旧连接
        disconnect();

        _log('SSE', '正在连接 ' + BASE_URL + _sseUrl + ' ...');

        try {
            _sseSource = new EventSource(BASE_URL + _sseUrl);
        } catch (e) {
            _error('SSE', 'EventSource 创建失败: ' + e.message);
            _startPolling();
            return;
        }

        _sseSource.onopen = function () {
            _sseReconnectCount = 0;
            _sseConnected = true;
            _log('SSE', '已连接');
            emit('sse:connected', {});
            // 停止轮询（如果正在轮询）
            _stopPolling();
        };

        _sseSource.onerror = function () {
            _sseConnected = false;
            _sseReconnectCount++;
            _warn('SSE', '连接断开（第 ' + _sseReconnectCount + ' 次）');

            if (_sseReconnectCount >= SSE_MAX_RECONNECTS) {
                _warn('SSE', '超过最大重连次数 (' + SSE_MAX_RECONNECTS + ')，降级为轮询');
                emit('sse:degraded', { reconnectCount: _sseReconnectCount });
                _sseSource.close();
                _sseSource = null;
                _startPolling();
            } else {
                emit('sse:reconnecting', { reconnectCount: _sseReconnectCount });
            }
        };

        // 代理所有已知事件类型
        for (var i = 0; i < KNOWN_SSE_EVENTS.length; i++) {
            _bindSSEEvent(KNOWN_SSE_EVENTS[i]);
        }

        // 同时监听通用 message 事件
        _sseSource.onmessage = function (event) {
            var data = null;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                data = event.data;
            }
            emit('sse:message', { type: event.type, data: data, raw: event });
            _handleSSECacheInvalidation('message', data);
        };
    }

    /**
     * 绑定单个 SSE 事件
     */
    function _bindSSEEvent(eventType) {
        if (!_sseSource) return;
        _sseSource.addEventListener(eventType, function (event) {
            var data = null;
            try {
                data = JSON.parse(event.data);
            } catch (e) {
                data = event.data;
            }
            // 通过 Bus 分发，事件名加 sse: 前缀
            emit('sse:' + eventType, { type: eventType, data: data, raw: event });
            // 触发缓存失效
            _handleSSECacheInvalidation(eventType, data);
        });
    }

    /**
     * 处理 SSE 事件触发的缓存失效
     */
    function _handleSSECacheInvalidation(eventType, data) {
        var prefixes = SSE_CACHE_INVALIDATION_MAP[eventType];
        if (!prefixes || prefixes.length === 0) return;

        var invalidated = 0;
        _cache.forEach(function (value, key) {
            for (var i = 0; i < prefixes.length; i++) {
                if (key.indexOf(prefixes[i]) === 0) {
                    _cache.delete(key);
                    invalidated++;
                    break;
                }
            }
        });

        if (invalidated > 0) {
            _log('Cache', 'SSE 事件 "' + eventType + '" 触发 ' + invalidated + ' 条缓存失效');
        }
    }

    /**
     * 断开 SSE 连接
     */
    function disconnect() {
        if (_sseSource) {
            _sseSource.close();
            _sseSource = null;
        }
        _sseConnected = false;
        _stopPolling();
        _log('SSE', '已断开');
        emit('sse:disconnected', {});
    }

    /**
     * 启动轮询降级
     */
    function _startPolling() {
        if (_ssePollTimer) return;
        _log('SSE', '启动轮询降级（间隔 ' + SSE_POLL_INTERVAL + 'ms）');

        _poll();
        _ssePollTimer = setInterval(_poll, SSE_POLL_INTERVAL);
    }

    /**
     * 执行一次轮询
     */
    async function _poll() {
        try {
            var data = await get(_sseUrl, { timeout: SSE_POLL_INTERVAL - 500, noRetry: true });
            if (data && typeof data === 'object') {
                // 轮询返回的数据可能是事件数组
                var events = Array.isArray(data) ? data : [data];
                for (var i = 0; i < events.length; i++) {
                    var evt = events[i];
                    var eventType = evt.type || evt.event || 'message';
                    emit('sse:' + eventType, { type: eventType, data: evt, polled: true });
                    _handleSSECacheInvalidation(eventType, evt);
                }
            }
        } catch (e) {
            // 轮询失败静默处理
        }
    }

    /**
     * 停止轮询
     */
    function _stopPolling() {
        if (_ssePollTimer) {
            clearInterval(_ssePollTimer);
            _ssePollTimer = null;
        }
    }

    /**
     * 获取 SSE 连接状态
     * @returns {Object} { connected, reconnectCount, polling }
     */
    function getSSEStatus() {
        return {
            connected: _sseConnected,
            reconnectCount: _sseReconnectCount,
            polling: !!_ssePollTimer
        };
    }

    // ================================================================
    //  Cache 层
    // ================================================================

    /**
     * 带缓存的 GET 请求
     *
     * 特性：
     *   - TTL 60s 缓存
     *   - LRU 100 条上限
     *   - 请求去重（相同 cacheKey 的并发请求只执行一次）
     *   - 并发控制（最多 6 个）
     *
     * @param {string} cacheKey - 缓存键
     * @param {Function} fetcherFn - 数据获取函数，返回 Promise
     * @param {Object} [options] - 选项
     * @param {number} [options.ttl] - 自定义 TTL（毫秒）
     * @param {boolean} [options.forceRefresh] - 强制刷新，跳过缓存
     * @returns {Promise<*>} 数据
     */
    async function cachedGet(cacheKey, fetcherFn, options) {
        options = options || {};
        var ttl = options.ttl || CACHE_TTL;

        // 1. 检查缓存（除非强制刷新）
        if (!options.forceRefresh && _cache.has(cacheKey)) {
            var cached = _cache.get(cacheKey);
            if (Date.now() - cached.timestamp < ttl) {
                _log('Cache', '命中: ' + cacheKey);
                // 更新 LRU（删除后重新插入）
                _cache.delete(cacheKey);
                _cache.set(cacheKey, cached);
                return cached.data;
            } else {
                // 过期，删除
                _cache.delete(cacheKey);
            }
        }

        // 2. 请求去重：相同 cacheKey 的并发请求只执行一次
        if (_pending.has(cacheKey)) {
            _log('Cache', '去重: ' + cacheKey + '（等待已有请求）');
            return _pending.get(cacheKey);
        }

        // 3. 执行请求
        var fetchPromise = (async function () {
            try {
                var data = await fetcherFn();

                // 写入缓存
                _evictIfNeeded();
                _cache.set(cacheKey, {
                    data: data,
                    timestamp: Date.now()
                });

                _log('Cache', '写入: ' + cacheKey);
                return data;
            } catch (err) {
                throw err;
            } finally {
                _pending.delete(cacheKey);
            }
        })();

        _pending.set(cacheKey, fetchPromise);
        return fetchPromise;
    }

    /**
     * LRU 淘汰：当缓存满时删除最旧的条目
     */
    function _evictIfNeeded() {
        if (_cache.size < CACHE_MAX_SIZE) return;
        // Map 保持插入顺序，第一个就是最旧的
        var firstKey = _cache.keys().next().value;
        if (firstKey !== undefined) {
            _cache.delete(firstKey);
            _log('Cache', 'LRU 淘汰: ' + firstKey);
        }
    }

    /**
     * 失效缓存
     * 支持精确匹配和前缀匹配
     *
     * @param {string} pattern - 缓存键或前缀
     * @returns {number} 失效的条目数
     */
    function invalidate(pattern) {
        var count = 0;
        if (!pattern) {
            count = _cache.size;
            _cache.clear();
            _log('Cache', '清空全部缓存（' + count + ' 条）');
            return count;
        }

        // 前缀匹配
        _cache.forEach(function (value, key) {
            if (key.indexOf(pattern) === 0) {
                _cache.delete(key);
                count++;
            }
        });

        if (count > 0) {
            _log('Cache', '失效 "' + pattern + '"（' + count + ' 条）');
        }
        return count;
    }

    /**
     * 清空全部缓存
     */
    function clearCache() {
        var count = _cache.size;
        _cache.clear();
        _pending.clear();
        _log('Cache', '清空全部缓存（' + count + ' 条）');
        return count;
    }

    /**
     * 获取缓存统计
     * @returns {Object} { size, maxSize, pending }
     */
    function getCacheStats() {
        return {
            size: _cache.size,
            maxSize: CACHE_MAX_SIZE,
            pending: _pending.size
        };
    }

    /**
     * 订阅数据变化
     * 当指定 key 相关的缓存被失效时触发回调
     *
     * @param {string} key - 数据源 key
     * @param {Function} callback - 回调函数
     * @returns {Function} 取消订阅函数
     */
    function subscribe(key, callback) {
        var eventName = 'cache:invalidate:' + key;
        on(eventName, callback);
        return function () {
            off(eventName, callback);
        };
    }

    // 增强 invalidate 方法，在失效时触发订阅回调
    var _originalInvalidate = invalidate;
    invalidate = function (pattern) {
        var count = _originalInvalidate(pattern);
        if (count > 0) {
            emit('cache:invalidate:' + pattern, { pattern: pattern, count: count });
            emit('cache:invalidated', { pattern: pattern, count: count });
        }
        return count;
    };

    // ================================================================
    //  API 端点（向后兼容，保留 api.js 的所有分组）
    // ================================================================

    var sessions = {
        list: function (params) { return get('/api/sessions', { body: params }); },
        get: function (id) { return get('/api/sessions/' + id); },
        create: function (data) { return post('/api/sessions', data); },
        update: function (id, data) { return put('/api/sessions/' + id, data); },
        delete: function (id) { return del('/api/sessions/' + id); },
        sendMessage: function (id, message) { return post('/api/sessions/' + id + '/messages', { message: message }); },
        getMessages: function (id, params) { return get('/api/sessions/' + id + '/messages', { body: params }); }
    };

    var tools = {
        list: function () { return get('/api/tools'); },
        get: function (name) { return get('/api/tools/' + name); },
        call: function (name, args) { return post('/api/tools/' + name + '/call', args); }
    };

    var skills = {
        list: function () { return get('/api/skills'); },
        get: function (name) { return get('/api/skills/' + name); },
        install: function (name) { return post('/api/skills/' + name + '/install'); },
        uninstall: function (name) { return post('/api/skills/' + name + '/uninstall'); }
    };

    var memory = {
        list: function (params) { return get('/api/memory', { body: params }); },
        get: function (id) { return get('/api/memory/' + id); },
        create: function (data) { return post('/api/memory', data); },
        update: function (id, data) { return put('/api/memory/' + id, data); },
        delete: function (id) { return del('/api/memory/' + id); },
        search: function (query, params) { return get('/api/memory/search', { body: Object.assign({ q: query }, params || {}) }); }
    };

    var cron = {
        list: function () { return get('/api/cron'); },
        get: function (id) { return get('/api/cron/' + id); },
        create: function (data) { return post('/api/cron', data); },
        update: function (id, data) { return put('/api/cron/' + id, data); },
        delete: function (id) { return del('/api/cron/' + id); },
        trigger: function (id) { return post('/api/cron/' + id + '/trigger'); },
        pause: function (id) { return post('/api/cron/' + id + '/pause'); },
        resume: function (id) { return post('/api/cron/' + id + '/resume'); }
    };

    var agents = {
        list: function () { return get('/api/agents'); },
        get: function (name) { return get('/api/agents/' + name); },
        create: function (data) { return post('/api/agents', data); },
        update: function (name, data) { return put('/api/agents/' + name, data); },
        delete: function (name) { return del('/api/agents/' + name); },
        terminate: function (name) { return post('/api/agents/' + name + '/terminate'); }
    };

    var mcp = {
        list: function () { return get('/api/mcp'); },
        get: function (name) { return get('/api/mcp/' + name); },
        callTool: function (serverName, toolName, args) {
            return post('/api/mcp/' + serverName + '/tools/' + toolName + '/call', args);
        },
        listTools: function (serverName) { return get('/api/mcp/' + serverName + '/tools'); }
    };

    var mcpServers = {
        list: function () { return get('/api/mcp/servers'); },
        get: function (name) { return get('/api/mcp/servers/' + name); },
        create: function (data) { return post('/api/mcp/servers', data); },
        update: function (name, data) { return put('/api/mcp/servers/' + name, data); },
        delete: function (name) { return del('/api/mcp/servers/' + name); },
        start: function (name) { return post('/api/mcp/servers/' + name + '/start'); },
        stop: function (name) { return post('/api/mcp/servers/' + name + '/stop'); },
        restart: function (name) { return post('/api/mcp/servers/' + name + '/restart'); },
        health: function (name) { return get('/api/mcp/servers/' + name + '/health'); }
    };

    var config = {
        get: function () { return get('/api/config'); },
        update: function (data) { return put('/api/config', data); },
        getBackup: function () { return get('/api/config/backup'); },
        restoreBackup: function (data) { return post('/api/config/backup/restore', data); }
    };

    var system = {
        info: function () { return get('/api/system/info'); },
        health: function () { return get('/api/system/health'); },
        logs: function (params) { return get('/api/system/logs', { body: params }); },
        stats: function () { return get('/api/system/stats'); }
    };

    var ops = {
        getMetrics: function () { return get('/api/ops/metrics'); },
        getAlerts: function (params) { return get('/api/ops/alerts', { body: params }); },
        getDashboard: function () { return get('/api/ops/dashboard'); }
    };

    var dashboard = {
        getStats: function () { return get('/api/dashboard/stats'); },
        getTrend: function (params) { return get('/api/dashboard/trend', { body: params }); },
        getOverview: function () { return get('/api/dashboard/overview'); }
    };

    var reviews = {
        list: function (params) { return get('/api/reviews', { body: params }); },
        get: function (id) { return get('/api/reviews/' + id); },
        approve: function (id) { return post('/api/reviews/' + id + '/approve'); },
        reject: function (id, reason) { return post('/api/reviews/' + id + '/reject', { reason: reason }); },
        batchApprove: function (ids) { return post('/api/reviews/batch-approve', { ids: ids }); },
        batchReject: function (ids, reason) { return post('/api/reviews/batch-reject', { ids: ids, reason: reason }); },
        stats: function () { return get('/api/reviews/stats'); }
    };

    // ================================================================
    //  热更新检查
    // ================================================================

    /**
     * 检查是否有新版本
     * @returns {Promise<{hasUpdate: boolean, currentVersion: string, latestVersion: string}>}
     */
    async function checkForUpdate() {
        try {
            var data = await get('/api/system/version', { timeout: 5000, noRetry: true });
            var latestVersion = data && (data.version || data);
            if (!latestVersion) return { hasUpdate: false, currentVersion: _currentVersion, latestVersion: null };

            _currentVersion = _currentVersion || latestVersion;
            var hasUpdate = latestVersion !== _currentVersion;

            if (hasUpdate) {
                emit('update:available', { currentVersion: _currentVersion, latestVersion: latestVersion });
            }

            return {
                hasUpdate: hasUpdate,
                currentVersion: _currentVersion,
                latestVersion: latestVersion
            };
        } catch (e) {
            return { hasUpdate: false, currentVersion: _currentVersion, latestVersion: null, error: e.message };
        }
    }

    /**
     * 启动定时更新检查
     * @param {number} [intervalMs=60000] - 检查间隔（毫秒）
     */
    function startUpdateCheck(intervalMs) {
        stopUpdateCheck();
        intervalMs = intervalMs || 60000;

        // 立即检查一次
        checkForUpdate();

        // 定时检查
        _updateCheckTimer = setInterval(checkForUpdate, intervalMs);
        _log('Update', '已启动定时检查（间隔 ' + intervalMs + 'ms）');
    }

    /**
     * 停止定时更新检查
     */
    function stopUpdateCheck() {
        if (_updateCheckTimer) {
            clearInterval(_updateCheckTimer);
            _updateCheckTimer = null;
        }
    }

    /**
     * 获取当前应用版本
     * @returns {Promise<string|null>}
     */
    async function getAppVersion() {
        if (_currentVersion) return _currentVersion;
        try {
            var data = await get('/api/system/version', { timeout: 5000, noRetry: true });
            _currentVersion = data && (data.version || data);
            return _currentVersion;
        } catch (e) {
            return null;
        }
    }

    // ================================================================
    //  公共 API
    // ================================================================

    var publicAPI = {
        // === HTTP 层 ===
        request: request,
        get: get,
        post: post,
        put: put,
        del: del,

        // === SSE 层 ===
        connect: connect,
        disconnect: disconnect,
        getSSEStatus: getSSEStatus,

        // === Cache 层 ===
        cachedGet: cachedGet,
        invalidate: invalidate,
        clearCache: clearCache,
        getCacheStats: getCacheStats,
        subscribe: subscribe,

        // === 事件总线 ===
        on: on,
        off: off,
        emit: emit,

        // === API 端点分组 ===
        sessions: sessions,
        tools: tools,
        skills: skills,
        memory: memory,
        cron: cron,
        agents: agents,
        mcp: mcp,
        mcpServers: mcpServers,
        config: config,
        system: system,
        ops: ops,
        dashboard: dashboard,
        reviews: reviews,

        // === 工具 ===
        checkForUpdate: checkForUpdate,
        startUpdateCheck: startUpdateCheck,
        stopUpdateCheck: stopUpdateCheck,
        getAppVersion: getAppVersion,

        // === 常量 ===
        BASE_URL: BASE_URL,
        VERSION: '2.0.0',

        // === 内部状态（只读） ===
        _currentVersion: null  // 由 getAppVersion/checkForUpdate 内部更新
    };

    // 暴露 _currentVersion 的引用到 publicAPI（用于 APP_VERSION getter）
    Object.defineProperty(publicAPI, '_currentVersion', {
        get: function () { return _currentVersion; },
        enumerable: true,
        configurable: true
    });

    return publicAPI;
})();

// ================================================================
//  全局暴露
// ================================================================

window.HermesClient = HermesClient;

// 向后兼容：旧代码通过 window.API 调用
window.API = HermesClient;

// 向后兼容：旧代码通过 window.APIClient 调用 request/get/post/put/del
window.APIClient = {
    request: function () { return HermesClient.request.apply(HermesClient, arguments); },
    get: function () { return HermesClient.get.apply(HermesClient, arguments); },
    post: function () { return HermesClient.post.apply(HermesClient, arguments); },
    put: function () { return HermesClient.put.apply(HermesClient, arguments); },
    del: function () { return HermesClient.del.apply(HermesClient, arguments); }
};

// APP_VERSION 动态 getter（兼容旧代码 window.APP_VERSION）
Object.defineProperty(window, 'APP_VERSION', {
    get: function () {
        return HermesClient._currentVersion || null;
    },
    configurable: true
});
