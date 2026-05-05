// -*- coding: utf-8 -*-
/**
 * init.js - Store 初始化脚本
 * 定义所有状态域、中间件和计算属性
 */
(function initStore() {
    'use strict';

    // 1. 注册中间件（Logger 中间件在 afterSet 中打印变更）
    Store.use(function({ action, path, value, oldValue }) {
        if (action === 'set' && Store.get('app.debugMode')) {
            console.log('%c[Store] ' + path, 'color: #0071e3; font-weight: bold', { from: oldValue, to: value });
        }
        return { value, cancelled: false };
    });

    // 2. 定义状态域
    Store.define('app', { theme: 'light', sidebarOpen: false, currentPage: 'dashboard', debugMode: false, backendConnected: false });
    Store.define('sessions', { list: [], current: null, tags: [], filter: { search: '', tag: null } });
    Store.define('tools', { list: [], filter: '', enabledSet: [] });
    Store.define('skills', { list: [], current: null });
    Store.define('memory', { content: '', userProfile: '', learnings: [], _dirty: false });
    Store.define('cron', { jobs: [], filter: 'all' });
    Store.define('knowledge', { rules: [], items: [], experiences: [], memories: [], reviews: [], activeTab: 'overview', searchQuery: '' });
    Store.define('ops', {
        metrics: { cpu: 0, memory: 0, disk: 0, network: { up: 0, down: 0 } },
        metricsHistory: [],
        mcpHealth: { status: 'unknown', successRate: 0, avgLatency: 0, totalCalls: 0, errorRate: 0 },
        cronMonitor: { total: 0, active: 0, paused: 0, successCount: 0, failCount: 0 },
        alertRules: [],
        alertHistory: [],
        alerts: { unread: 0, lastTriggered: null },
        frontendErrors: [],
        apiErrors: [],
        recentErrors: [],
        recentEvents: [],
        evalSummary: null,
        evalTools: [],
        evalErrors: [],
        evalTrend: [],
    });
    Store.define('ui', { loading: {}, modals: [], toasts: [], notifications: [] });

    // 3. 计算属性
    Store.computed('sessions.activeCount', () => {
        return (Store.get('sessions.list') || []).filter(s => s.active !== false).length;
    }, ['sessions.list']);

    Store.computed('ops.alerts.criticalCount', () => {
        return (Store.get('ops.alertHistory') || []).filter(h => h.level === 'critical' && !h.acknowledged).length;
    }, ['ops.alertHistory']);

    // 4. Workspace 状态域（由 StateManager.init() 动态定义）
    //    workspace / desktops / cards 命名空间在 StateManager.init() 中创建
    //    这里只做标记，实际初始化在 App.init() 中调用 StateManager.init()

    Logger.info('[Store] 状态初始化完成');
})();
