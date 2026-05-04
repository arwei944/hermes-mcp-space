// frontend/js/services/AlertChecker.js
// -*- coding: utf-8 -*-
/**
 * AlertChecker — 前端实时告警检查
 *
 * 定期检查 Store 中的运维数据是否触发告警规则。
 * 补充后端告警引擎，提供更实时的前端检测。
 *
 * 检查间隔：10s
 * 冷却时间：使用规则的 cooldown 字段（默认 300s）
 *
 * v14.1: 告警阈值改为动态加载，支持运行时更新
 */

const AlertChecker = (() => {
    'use strict';

    let _timer = null;
    let _active = false;

    // v14.1: 默认阈值（当后端规则未加载时的 fallback）
    const _defaultRules = [
        { type: 'cpu_high', threshold: 80, unit: '%' },
        { type: 'memory_high', threshold: 85, unit: '%' },
        { type: 'disk_high', threshold: 90, unit: '%' },
        { type: 'tool_error_rate', threshold: 20, unit: '%' },
        { type: 'mcp_disconnected', threshold: 1, unit: '' },
    ];

    // 当前生效的规则（优先使用后端规则，fallback 到默认值）
    let _rules = null;

    /**
     * 从后端加载告警规则
     * 如果加载失败，使用 _defaultRules 作为 fallback
     */
    async function loadRules() {
        try {
            if (typeof API !== 'undefined' && API.ops) {
                var rules = await API.ops.alertRules();
                if (Array.isArray(rules) && rules.length > 0) {
                    _rules = rules;
                    if (typeof Logger !== 'undefined') Logger.info('[AlertChecker]', '告警规则已从后端加载:', rules.length + ' 条');
                    return _rules;
                }
            }
        } catch (err) {
            if (typeof Logger !== 'undefined') Logger.warn('[AlertChecker]', '加载告警规则失败，使用默认值:', err.message);
        }
        // fallback: 使用默认规则
        _rules = _defaultRules.map(function(r) {
            return Object.assign({}, r, { enabled: true, name: r.type, cooldown: (typeof AppConfig !== 'undefined' && AppConfig.ALERT_COOLDOWN) || 300 });
        });
        return _rules;
    }

    /**
     * 运行时更新告警规则（供外部调用，如设置页面修改阈值后）
     */
    function updateRules(rules) {
        if (Array.isArray(rules) && rules.length > 0) {
            _rules = rules;
            if (typeof Logger !== 'undefined') Logger.info('[AlertChecker]', '告警规则已更新:', rules.length + ' 条');
        }
    }

    /**
     * 获取当前生效的规则
     */
    function getRules() {
        return _rules;
    }

    /**
     * 获取默认规则（用于 UI 展示参考值）
     */
    function getDefaultRules() {
        return _defaultRules;
    }

    function start() {
        if (_active) return;
        _active = true;
        if (typeof Logger !== 'undefined') Logger.info('[AlertChecker]', '启动前端告警检查');
        // 启动时加载规则
        loadRules().then(function() {
            _timer = setInterval(check, (typeof AppConfig !== 'undefined' && AppConfig.ALERT_CHECK_INTERVAL) || 10000);
        });
    }

    function stop() {
        _active = false;
        if (_timer) { clearInterval(_timer); _timer = null; }
    }

    function isActive() {
        return _active;
    }

    function check() {
        if (!window.Store) return;

        // 优先从 Store 获取后端同步的规则，否则使用本地 _rules
        var rules = (Store.get('ops.alertRules') || []);
        if (rules.length > 0) {
            _rules = rules;
        }
        rules = rules.filter(function(r) { return r.enabled; });

        // 如果没有启用的规则，使用默认规则
        if (rules.length === 0 && _rules) {
            rules = _rules.filter(function(r) { return r.enabled !== false; });
        }
        if (rules.length === 0) return;

        var metrics = Store.get('ops.metrics');
        var mcpHealth = Store.get('ops.mcpHealth');
        var now = Date.now();

        rules.forEach(function(rule) {
            // 冷却时间检查
            if (rule.lastTriggered) {
                var elapsed = now - new Date(rule.lastTriggered).getTime();
                if (elapsed < ((rule.cooldown || (typeof AppConfig !== 'undefined' && AppConfig.ALERT_COOLDOWN) || 300)) * 1000) return;
            }

            var triggered = false;
            var currentValue = 0;

            switch (rule.type) {
                case 'cpu_high':
                    currentValue = (metrics && metrics.cpu) || 0;
                    triggered = currentValue > (rule.threshold || 80);
                    break;
                case 'memory_high':
                    currentValue = (metrics && metrics.memory) || 0;
                    triggered = currentValue > (rule.threshold || 85);
                    break;
                case 'disk_high':
                    currentValue = (metrics && metrics.disk) || 0;
                    triggered = currentValue > (rule.threshold || 90);
                    break;
                case 'tool_error_rate':
                    currentValue = (mcpHealth && mcpHealth.errorRate) || 0;
                    triggered = currentValue > (rule.threshold || 20);
                    break;
                case 'mcp_disconnected':
                    currentValue = (mcpHealth && mcpHealth.status === 'unhealthy') ? 1 : 0;
                    triggered = currentValue > 0;
                    break;
            }

            if (triggered) {
                var alert = {
                    id: 'local_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
                    ruleName: rule.name,
                    type: rule.type,
                    level: _getLevel(rule.type, currentValue, rule.threshold),
                    message: rule.name + ': 当前值 ' + currentValue + (rule.unit || '%') + '，阈值 ' + rule.threshold + (rule.unit || '%'),
                    currentValue: currentValue,
                    threshold: rule.threshold,
                    timestamp: new Date().toISOString(),
                    acknowledged: false,
                    source: 'frontend',
                };

                if (window.Bus && window.Events) {
                    Bus.emit(Events.ALERT_TRIGGERED, alert);
                }

                // 更新规则的 lastTriggered
                var updatedRules = (Store.get('ops.alertRules') || []).map(function(r) {
                    if (r.id === rule.id) return Object.assign({}, r, { lastTriggered: alert.timestamp });
                    return r;
                });
                Store.set('ops.alertRules', updatedRules);
            }
        });
    }

    function _getLevel(type, current, threshold) {
        if (type === 'mcp_disconnected') return 'critical';
        var ratio = threshold > 0 ? current / threshold : 0;
        if (ratio > 1.5) return 'critical';
        if (ratio > 1.2) return 'warning';
        return 'info';
    }

    return {
        start: start,
        stop: stop,
        isActive: isActive,
        check: check,
        loadRules: loadRules,
        updateRules: updateRules,
        getRules: getRules,
        getDefaultRules: getDefaultRules,
    };
})();

window.AlertChecker = AlertChecker;