/**
 * Hermes Agent API 封装
 * 统一处理所有 API 请求、错误处理、响应解析
 */

const API = (() => {
    const BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : '';

    // 默认请求超时
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

        // 不设置 body 的请求方法
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

            // 204 No Content
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

    // 便捷方法
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
    // 会话管理 API
    // ==========================================
    const sessions = {
        /** 获取会话列表 */
        list(params) {
            return get('/api/sessions', params);
        },
        /** 获取单个会话详情 */
        get(id) {
            return get(`/api/sessions/${id}`);
        },
        /** 获取会话消息历史 */
        messages(id, params) {
            return get(`/api/sessions/${id}/messages`, params);
        },
        /** 删除会话 */
        delete(id) {
            return del(`/api/sessions/${id}`);
        },
        /** 压缩会话上下文 */
        compress(id) {
            return post(`/api/sessions/${id}/compress`);
        },
    };

    // ==========================================
    // 工具管理 API
    // ==========================================
    const tools = {
        /** 获取所有工具 */
        list(params) {
            return get('/api/tools', params);
        },
        /** 获取单个工具详情 */
        get(name) {
            return get(`/api/tools/${encodeURIComponent(name)}`);
        },
        /** 获取工具集列表 */
        toolsets() {
            return get('/api/tools/toolsets');
        },
        /** 启用/禁用工具 */
        toggle(name, enabled) {
            return put(`/api/tools/${encodeURIComponent(name)}`, { enabled });
        },
    };

    // ==========================================
    // 技能系统 API
    // ==========================================
    const skills = {
        /** 获取技能列表 */
        list(params) {
            return get('/api/skills', params);
        },
        /** 获取技能详情 */
        get(name) {
            return get(`/api/skills/${encodeURIComponent(name)}`);
        },
        /** 获取技能的 SKILL.md 内容 */
        content(name) {
            return get(`/api/skills/${encodeURIComponent(name)}/content`);
        },
        /** 创建技能 */
        create(data) {
            return post('/api/skills', data);
        },
        /** 更新技能 */
        update(name, data) {
            return put(`/api/skills/${encodeURIComponent(name)}`, data);
        },
        /** 删除技能 */
        delete(name) {
            return del(`/api/skills/${encodeURIComponent(name)}`);
        },
    };

    // ==========================================
    // 记忆管理 API
    // ==========================================
    const memory = {
        /** 获取 MEMORY.md 内容 */
        getMemory() {
            return get('/api/memory');
        },
        /** 保存 MEMORY.md */
        saveMemory(content) {
            return put('/api/memory', { content });
        },
        /** 获取 USER.md 内容 */
        getUser() {
            return get('/api/memory/user');
        },
        /** 保存 USER.md */
        saveUser(content) {
            return put('/api/memory/user', { content });
        },
        /** 获取记忆统计 */
        stats() {
            return get('/api/memory/stats');
        },
    };

    // ==========================================
    // 定时任务 API
    // ==========================================
    const cron = {
        /** 获取定时任务列表 */
        list() {
            return get('/api/cron');
        },
        /** 获取单个任务详情 */
        get(id) {
            return get(`/api/cron/${id}`);
        },
        /** 创建定时任务 */
        create(data) {
            return post('/api/cron', data);
        },
        /** 更新定时任务 */
        update(id, data) {
            return put(`/api/cron/${id}`, data);
        },
        /** 删除定时任务 */
        delete(id) {
            return del(`/api/cron/${id}`);
        },
        /** 手动触发任务 */
        trigger(id) {
            return post(`/api/cron/${id}/trigger`);
        },
        /** 获取任务执行历史 */
        history(id, params) {
            return get(`/api/cron/${id}/history`, params);
        },
    };

    // ==========================================
    // 子 Agent API
    // ==========================================
    const agents = {
        /** 获取活跃子 Agent 列表 */
        list() {
            return get('/api/agents');
        },
        /** 获取单个 Agent 状态 */
        get(id) {
            return get(`/api/agents/${id}`);
        },
        /** 终止 Agent */
        terminate(id) {
            return del(`/api/agents/${id}`);
        },
    };

    // ==========================================
    // MCP 服务 API
    // ==========================================
    const mcp = {
        /** 获取 MCP 状态 */
        status() {
            return get('/api/mcp');
        },
        /** 获取 MCP 暴露的工具 */
        tools() {
            return get('/api/mcp/tools');
        },
        /** 重启 MCP 服务 */
        restart() {
            return post('/api/mcp/restart');
        },
        /** 获取连接信息 */
        connectionInfo() {
            return get('/api/mcp/connection');
        },
    };

    // ==========================================
    // 系统配置 API
    // ==========================================
    const config = {
        /** 获取配置 */
        get() {
            return get('/api/config');
        },
        /** 保存配置 */
        save(data) {
            return put('/api/config', data);
        },
        /** 重置配置 */
        reset() {
            return post('/api/config/reset');
        },
    };

    // ==========================================
    // 系统 API
    // ==========================================
    const system = {
        /** 获取系统状态 */
        status() {
            return get('/api/status');
        },
        /** 获取仪表盘统计数据 */
        dashboard() {
            return get('/api/dashboard');
        },
        /** 健康检查 */
        health() {
            return get('/api/health');
        },
    };

    return {
        request, get, post, put, del,
        sessions, tools, skills, memory,
        cron, agents, mcp, config, system,
        BASE_URL,
    };
})();
