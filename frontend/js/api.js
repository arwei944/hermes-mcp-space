/**
 * Hermes Agent API 封装
 * 统一处理所有 API 请求、错误处理、响应解析
 */

// 版本号从后端动态获取，不硬编码
let _metaCache = null;

async function getMeta() {
    if (_metaCache) return _metaCache;
    try {
        const resp = await fetch('/api/meta');
        _metaCache = await resp.json();
    } catch (e) {
        _metaCache = { version: '?', build_time: '?', uptime_human: '', now: '' };
    }
    return _metaCache;
}

function getAppVersion() {
    return _metaCache ? _metaCache.version : '...';
}

const API = (() => {
    const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : '';

    const TIMEOUT = 15000;

    /**
     * 通用请求方法
     */
    async function request(path, options = {}) {
        const url = `${BASE_URL}${path}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.timeout || TIMEOUT);

        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            signal: controller.signal,
            ...options,
        };

        if (['GET', 'HEAD'].includes(config.method?.toUpperCase())) {
            delete config.body;
        }

        try {
            const response = await fetch(url, config);
            clearTimeout(timeout);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const error = new Error(errorData.message || errorData.error || `HTTP ${response.status}`);
                error.status = response.status;
                error.data = errorData;
                throw error;
            }

            if (response.status === 204) {
                return { success: true };
            }

            const data = await response.json();
            return data;
        } catch (err) {
            clearTimeout(timeout);

            if (err.name === 'AbortError') {
                throw new Error('请求超时，请稍后重试');
            }

            if (err.message === 'Failed to fetch') {
                throw new Error('无法连接到服务器，请检查网络连接');
            }

            throw err;
        }
    }

    const get = (path, params) => {
        let url = path;
        if (params) {
            const searchParams = new URLSearchParams();
            Object.entries(params).forEach(([key, value]) => {
                if (value !== undefined && value !== null) {
                    searchParams.append(key, value);
                }
            });
            const qs = searchParams.toString();
            if (qs) url += `?${qs}`;
        }
        return request(url, { method: 'GET' });
    };

    const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) });
    const put = (path, body) => request(path, { method: 'PUT', body: JSON.stringify(body) });
    const del = (path) => request(path, { method: 'DELETE' });

    // ==========================================
    // 会话管理 API（已对齐）
    // ==========================================
    const sessions = {
        list(params) { return get('/api/sessions', params); },
        create(data) { return post('/api/sessions', data); },
        get(id) { return get(`/api/sessions/${id}`); },
        messages(id, params) { return get(`/api/sessions/${id}/messages`, params); },
        addMessage(id, role, content) { return post(`/api/sessions/${id}/messages`, { role, content }); },
        delete(id) { return del(`/api/sessions/${id}`); },
        compress(id) { return post(`/api/sessions/${id}/compress`); },
    };

    // ==========================================
    // 工具管理 API（已对齐）
    // ==========================================
    const tools = {
        list(params) { return get('/api/tools', params); },
        get(name) { return get(`/api/tools/${encodeURIComponent(name)}`); },
        toolsets() { return get('/api/toolsets'); },
        toggle(name, enabled) { return post(`/api/tools/${encodeURIComponent(name)}/toggle`, { enabled }); },
    };

    // ==========================================
    // 技能系统 API（已对齐）
    // ==========================================
    const skills = {
        list(params) { return get('/api/skills', params); },
        get(name) { return get(`/api/skills/${encodeURIComponent(name)}`); },
        content(name) { return get(`/api/skills/${encodeURIComponent(name)}`); },
        create(data) { return post('/api/skills', data); },
        update(name, data) { return put(`/api/skills/${encodeURIComponent(name)}`, data); },
        delete(name) { return del(`/api/skills/${encodeURIComponent(name)}`); },
    };

    // ==========================================
    // 记忆管理 API（已对齐）
    // 后端 PUT /api/memory 接受 { memory, user }
    // ==========================================
    const memory = {
        getMemory() { return get('/api/memory'); },
        saveMemory(content) { return put('/api/memory', { memory: content }); },
        getUser() { return get('/api/memory'); },
        saveUser(content) { return put('/api/memory', { user: content }); },
        stats() { return get('/api/memory'); },
    };

    // ==========================================
    // 定时任务 API（已对齐）
    // 后端路径: /api/cron/jobs
    // ==========================================
    const cron = {
        list() { return get('/api/cron/jobs'); },
        get(id) { return get(`/api/cron/jobs/${id}`); },
        create(data) { return post('/api/cron/jobs', data); },
        update(id, data) { return put(`/api/cron/jobs/${id}`, data); },
        delete(id) { return del(`/api/cron/jobs/${id}`); },
        trigger(id) { return post(`/api/cron/jobs/${id}/trigger`); },
        history(id, params) { return get(`/api/cron/jobs/${id}/output`, params); },
    };

    // ==========================================
    // 子 Agent API（已对齐）
    // ==========================================
    const agents = {
        list() { return get('/api/agents'); },
        get(id) { return get(`/api/agents/${id}`); },
        terminate(id) { return del(`/api/agents/${id}`); },
    };

    // ==========================================
    // MCP 服务 API（已对齐）
    // ==========================================
    const mcp = {
        status() { return get('/api/mcp'); },
        tools() { return get('/api/mcp/tools'); },
        restart() { return post('/api/mcp/restart'); },
        connectionInfo() { return get('/api/mcp'); },
    };

    // ==========================================
    // 系统配置 API（已对齐）
    // ==========================================
    const config = {
        get() { return get('/api/config'); },
        save(data, summary) { return put('/api/config', { config: data, summary: summary || '' }); },
        reset() { return post('/api/config/reset'); },
        versions() { return get('/api/config/versions'); },
        rollback(index) { return post(`/api/config/rollback/${index}`); },
    };

    // ==========================================
    // 系统 API（已对齐）
    // ==========================================
    const system = {
        status() { return get('/api/status'); },
        dashboard() { return get('/api/dashboard'); },
        health() { return get('/api/status'); },
    };

    // ==========================================
    // 热更新检查
    // ==========================================
    let _currentServerVersion = null;
    let _updateCheckTimer = null;

    async function checkForUpdate() {
        try {
            const data = await get('/api/version');
            const serverVersion = data.version || data;

            if (_currentServerVersion === null) {
                _currentServerVersion = serverVersion;
                return;
            }

            if (serverVersion && serverVersion !== _currentServerVersion) {
                _currentServerVersion = serverVersion;
                if (typeof showToast === 'function') {
                    showToast(`检测到新版本 (${serverVersion})，5 秒后自动刷新...`);
                }
                setTimeout(() => {
                    window.location.reload();
                }, 5000);
            }
        } catch (err) {
            // 静默失败，不影响用户体验
        }
    }

    function startUpdateCheck(intervalMs = 30000) {
        if (_updateCheckTimer) clearInterval(_updateCheckTimer);
        _updateCheckTimer = setInterval(checkForUpdate, intervalMs);
    }

    return {
        request, get, post, put, del,
        sessions, tools, skills, memory,
        cron, agents, mcp, config, system,
        BASE_URL,
        checkForUpdate,
        startUpdateCheck,
        rawGet: request,  // 无包装的 get（用于 meta 等非标准响应）
    };
})();

// 兼容旧代码：APP_VERSION 改为动态 getter
Object.defineProperty(window, 'APP_VERSION', {
    get() { return getAppVersion(); },
    configurable: true,
});
