// frontend/js/services/OpsSyncService.js
// -*- coding: utf-8 -*-
/**
 * OpsSyncService — 运维数据同步服务
 *
 * 统一管理运维数据的轮询同步：
 * - 系统指标 (5s)
 * - MCP 健康状态 (30s)
 * - 定时任务监控 (30s)
 * - 告警数据 (30s)
 *
 * 数据写入 Store，供所有页面通过 Store.watch 响应式消费
 * 支持 visibility API 优化（页面不可见时暂停轮询）
 */

const OpsSyncService = (() => {
    'use strict';

    let _timers = {};
    let _active = false;

    function start() {
        if (_active) return;
        _active = true;
        if (typeof Logger !== 'undefined') Logger.info('[OpsSync]', '启动运维数据同步');

        // 立即同步一次
        _syncMetrics();
        _syncMcpHealth();
        _syncCronMonitor();
        _syncAlerts();
        _syncFrontendErrors();
        _syncApiErrors();
        _syncRecentEvents();
        _syncEvalData();

        // 页面可见性优化
        document.addEventListener('visibilitychange', _onVisibilityChange);
    }

    function stop() {
        _active = false;
        Object.values(_timers).forEach(clearInterval);
        _timers = {};
        document.removeEventListener('visibilitychange', _onVisibilityChange);
        if (typeof Logger !== 'undefined') Logger.info('[OpsSync]', '停止运维数据同步');
    }

    function isActive() {
        return _active;
    }

    function _onVisibilityChange() {
        if (document.hidden) {
            stop();
        } else {
            start();
        }
    }

    async function _syncMetrics() {
        try {
            const data = await API.get('/api/ops/metrics');
            if (window.Store) {
                Store.batch(function() {
                    Store.set('ops.metrics', data);
                    var history = Store.get('ops.metricsHistory') || [];
                    history.push(Object.assign({}, data, { timestamp: Date.now() }));
                    if (history.length > 360) history.shift();
                    Store.set('ops.metricsHistory', history);
                });
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', '指标同步失败:', err.message);
        }
        if (_active) {
            _timers.metrics = setInterval(_syncMetrics, 5000);
        }
    }

    async function _syncMcpHealth() {
        try {
            var data = await API.get('/api/ops/mcp-health');
            if (window.Store) {
                Store.set('ops.mcpHealth', data);
            }
            // MCP 降级时发送全局事件
            if (data && (data.status === 'unhealthy' || data.status === 'degraded')) {
                if (window.Bus && window.Events) {
                    Bus.emit(Events.OPS_MCP_DEGRADED, data);
                }
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', 'MCP健康同步失败:', err.message);
        }
        if (_active) {
            _timers.mcpHealth = setInterval(_syncMcpHealth, 30000);
        }
    }

    async function _syncCronMonitor() {
        try {
            var data = await API.get('/api/ops/cron');
            if (window.Store) {
                Store.set('ops.cronMonitor', data);
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', '定时任务同步失败:', err.message);
        }
        if (_active) {
            _timers.cron = setInterval(_syncCronMonitor, 30000);
        }
    }

    async function _syncAlerts() {
        try {
            var results = await Promise.all([
                API.get('/api/ops/alerts/rules'),
                API.get('/api/ops/alerts/history?limit=50'),
            ]);
            var rules = results[0];
            var history = results[1];
            if (window.Store) {
                Store.batch(function() {
                    Store.set('ops.alertRules', rules);
                    Store.set('ops.alertHistory', history);
                    Store.set('ops.alerts.unread', history.filter(function(h) { return !h.acknowledged; }).length);
                });
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', '告警同步失败:', err.message);
        }
        if (_active) {
            _timers.alerts = setInterval(_syncAlerts, 30000);
        }
    }

    async function _syncFrontendErrors() {
        try {
            var data = await API.get('/api/ops/frontend-errors?limit=50');
            if (window.Store) {
                Store.set('ops.frontendErrors', data || []);
                // 更新最近错误列表（合并前端+API错误）
                _updateRecentErrors();
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', '前端错误同步失败:', err.message);
        }
        if (_active) {
            _timers.frontendErrors = setInterval(_syncFrontendErrors, 10000);
        }
    }

    async function _syncApiErrors() {
        try {
            var data = await API.get('/api/ops/api-errors?limit=50');
            if (window.Store) {
                Store.set('ops.apiErrors', data || []);
                _updateRecentErrors();
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', 'API错误同步失败:', err.message);
        }
        if (_active) {
            _timers.apiErrors = setInterval(_syncApiErrors, 10000);
        }
    }

    function _updateRecentErrors() {
        var fe = Store.get('ops.frontendErrors') || [];
        var ae = Store.get('ops.apiErrors') || [];
        var all = [];
        fe.forEach(function(e) { all.push(Object.assign({}, e, { _source: 'frontend' })); });
        ae.forEach(function(e) { all.push(Object.assign({}, e, { _source: 'api' })); });
        all.sort(function(a, b) { return (b.timestamp || '').localeCompare(a.timestamp || ''); });
        Store.set('ops.recentErrors', all.slice(0, 30));
    }

    async function _syncRecentEvents() {
        try {
            var data = await API.get('/api/events/history?limit=30');
            if (window.Store) {
                Store.set('ops.recentEvents', data || []);
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', '事件同步失败:', err.message);
        }
        if (_active) {
            _timers.events = setInterval(_syncRecentEvents, 10000);
        }
    }

    async function _syncEvalData() {
        try {
            var results = await Promise.all([
                API.get('/api/evals/summary'),
                API.get('/api/evals/tools'),
                API.get('/api/evals/errors'),
                API.get('/api/evals/trend?days=7'),
            ]);
            if (window.Store) {
                Store.batch(function() {
                    Store.set('ops.evalSummary', results[0]);
                    Store.set('ops.evalTools', results[1] || []);
                    Store.set('ops.evalErrors', results[2] || []);
                    Store.set('ops.evalTrend', results[3] || []);
                });
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[OpsSync]', '评估数据同步失败:', err.message);
        }
        if (_active) {
            _timers.eval = setInterval(_syncEvalData, 30000);
        }
    }

    return { start: start, stop: stop, isActive: isActive };
})();

window.OpsSyncService = OpsSyncService;
