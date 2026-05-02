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
 */

const AlertChecker = (() => {
    'use strict';

    let _timer = null;
    let _active = false;

    function start() {
        if (_active) return;
        _active = true;
        if (typeof Logger !== 'undefined') Logger.info('[AlertChecker]', '启动前端告警检查');
        _timer = setInterval(check, 10000);
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

        var rules = (Store.get('ops.alertRules') || []).filter(function(r) { return r.enabled; });
        if (rules.length === 0) return;

        var metrics = Store.get('ops.metrics');
        var mcpHealth = Store.get('ops.mcpHealth');
        var now = Date.now();

        rules.forEach(function(rule) {
            // 冷却时间检查
            if (rule.lastTriggered) {
                var elapsed = now - new Date(rule.lastTriggered).getTime();
                if (elapsed < (rule.cooldown || 300) * 1000) return;
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

    return { start: start, stop: stop, isActive: isActive, check: check };
})();

window.AlertChecker = AlertChecker;
