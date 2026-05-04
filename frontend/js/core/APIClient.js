// -*- coding: utf-8 -*-
/**
 * APIClient - 增强版 API 客户端
 * 支持超时控制、指数退避自动重试、事件通知、链路追踪
 * v12: 注入 X-Trace-Id 请求头，API 错误自动上报
 */
(function APIClientModule() {
    'use strict';

    const RETRIABLE_STATUS = [502, 503, 504];
    const MAX_RETRIES = 3;
    const RETRY_DELAYS = [1000, 2000, 4000];
    const DEFAULT_TIMEOUT = 15000;

    function _generateTraceId() {
        if (typeof crypto !== 'undefined' && crypto.randomUUID) {
            return crypto.randomUUID().slice(0, 8);
        }
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    }

    function _reportApiError(url, error, traceId) {
        try {
            var payload = {
                type: 'api_error',
                message: (error.message || String(error)) + ' (' + url + ')',
                context: 'API:' + url + ' [' + traceId + ']',
                url: typeof location !== 'undefined' ? location.pathname : '',
                build_version: (typeof window !== 'undefined' && window.__BUILD_VERSION__) ? window.__BUILD_VERSION__ : 'unknown',
            };
            if (navigator && navigator.sendBeacon) {
                var _endpoint = '/api/ops/frontend-errors';
                navigator.sendBeacon(_endpoint, JSON.stringify(payload));
            }
        } catch (_) { /* ignore */ }
    }

    // v14.1: api.js 是规范的 API 层，此处简化为相对路径
    // 所有请求走同源，BASE_URL 由 api.js 统一管理
    function _getBaseUrl() {
        // 优先使用 api.js 的 BASE_URL（如果已加载）
        if (typeof API !== 'undefined' && API.BASE_URL) return API.BASE_URL;
        return '';
    }

    const client = {
        baseUrl: _getBaseUrl(),
        defaultHeaders: { 'Content-Type': 'application/json' },
        defaultTimeout: DEFAULT_TIMEOUT,

        /**
         * 配置 API 客户端
         * @param {Object} options - { baseUrl, defaultHeaders, defaultTimeout }
         */
        configure(options) {
            if (options.baseUrl !== undefined) this.baseUrl = options.baseUrl;
            if (options.defaultHeaders) this.defaultHeaders = { ...this.defaultHeaders, ...options.defaultHeaders };
            if (options.defaultTimeout !== undefined) this.defaultTimeout = options.defaultTimeout;
        },

        /**
         * 构建带查询参数的完整 URL
         */
        _buildUrl(path, params) {
            let url = this.baseUrl + path;
            if (params && typeof params === 'object' && Object.keys(params).length > 0) {
                const qs = new URLSearchParams(params).toString();
                url += (url.includes('?') ? '&' : '?') + qs;
            }
            return url;
        },

        /**
         * 延迟指定毫秒
         */
        _delay(ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /**
         * 核心请求方法
         * @param {string} path - 请求路径
         * @param {Object} [options] - { method, body, headers, params, timeout }
         * @returns {Promise<Object>} 响应 JSON 数据
         */
        async request(path, options = {}) {
            const method = (options.method || 'GET').toUpperCase();
            const timeout = options.timeout !== undefined ? options.timeout : this.defaultTimeout;
            const url = this._buildUrl(path, options.params);
            const traceId = _generateTraceId();

            const headers = { ...this.defaultHeaders, ...(options.headers || {}), 'X-Trace-Id': traceId };
            const fetchOptions = { method, headers };
            if (options.body && method !== 'GET' && method !== 'HEAD') {
                fetchOptions.body = typeof options.body === 'string' ? options.body : JSON.stringify(options.body);
            }

            let lastError = null;

            for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeout);
                fetchOptions.signal = controller.signal;

                try {
                    const response = await fetch(url, fetchOptions);
                    clearTimeout(timer);

                    if (!response.ok) {
                        const status = response.status;
                        if (RETRIABLE_STATUS.includes(status) && attempt < MAX_RETRIES) {
                            lastError = new Error(`HTTP ${status} from ${method} ${path}`);
                            await this._delay(RETRY_DELAYS[attempt]);
                            continue;
                        }
                        // 不可重试错误（4xx 等）直接抛出
                        let errorBody;
                        try { errorBody = await response.json(); } catch (_) { errorBody = await response.text(); }
                        const err = new Error(`HTTP ${status}: ${response.statusText}`);
                        err.status = status;
                        err.body = errorBody;
                        throw err;
                    }

                    const text = await response.text();
                    try { return JSON.parse(text); } catch (_) { return text; }

                } catch (err) {
                    clearTimeout(timer);

                    // AbortError 表示超时
                    if (err.name === 'AbortError') {
                        lastError = new Error(`Request timeout (${timeout}ms) for ${method} ${path}`);
                        if (attempt < MAX_RETRIES) {
                            await this._delay(RETRY_DELAYS[attempt]);
                            continue;
                        }
                        break;
                    }

                    // 网络错误可重试
                    if (err instanceof TypeError && attempt < MAX_RETRIES) {
                        lastError = err;
                        await this._delay(RETRY_DELAYS[attempt]);
                        continue;
                    }

                    // 其他错误直接抛出
                    throw err;
                }
            }

            // 全部重试失败
            if (window.Bus) {
                Bus.emit('api:error', { path, error: lastError, traceId });
            }
            _reportApiError(path, lastError, traceId);
            throw lastError;
        },

        /** GET 请求 */
        get(path, params) {
            return this.request(path, { method: 'GET', params });
        },

        /** POST 请求 */
        post(path, body) {
            return this.request(path, { method: 'POST', body });
        },

        /** PUT 请求 */
        put(path, body) {
            return this.request(path, { method: 'PUT', body });
        },

        /** DELETE 请求 */
        del(path) {
            return this.request(path, { method: 'DELETE' });
        },
    };

    window.APIClient = client;
})();
