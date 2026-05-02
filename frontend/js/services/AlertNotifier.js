// frontend/js/services/AlertNotifier.js
// -*- coding: utf-8 -*-
/**
 * AlertNotifier — 告警通知服务
 *
 * 联动 AlertChecker 和后端告警事件，提供：
 * - Toast 通知（critical 8s / warning 5s / info 3s）
 * - 侧边栏告警角标
 * - 通知中心记录（不在告警页面时）
 * - Store 联动更新
 */

const AlertNotifier = (() => {
    'use strict';

    let _initialized = false;

    function init() {
        if (_initialized) return;
        _initialized = true;

        if (!window.Bus || !window.Events || !window.Store) {
            if (typeof Logger !== 'undefined') Logger.warn('[AlertNotifier]', '依赖模块未就绪，延迟初始化');
            setTimeout(init, 500);
            return;
        }

        // 监听告警事件
        Bus.on(Events.ALERT_TRIGGERED, _onAlert);
        Bus.on(Events.ALERT_ACKNOWLEDGED, _onAcknowledge);

        // 监听 Store 变化更新侧边栏角标
        Store.watch('ops.alerts.unread', _updateSidebarBadge);

        // 监听后端 SSE 告警事件
        Bus.on('sse:ops.alert', function(data) {
            _onAlert(data);
        });

        if (typeof Logger !== 'undefined') Logger.info('[AlertNotifier]', 'Initialized');
    }

    function _onAlert(alert) {
        if (!window.Store || !window.Components) return;

        // 1. 更新 Store
        Store.batch(function() {
            var unread = (Store.get('ops.alerts.unread') || 0) + 1;
            Store.set('ops.alerts.unread', unread);
            Store.set('ops.alerts.lastTriggered', alert);

            var history = Store.get('ops.alertHistory') || [];
            history.unshift(alert);
            Store.set('ops.alertHistory', history.slice(0, 200));
        });

        // 2. Toast 通知
        var duration = alert.level === 'critical' ? 8000 : alert.level === 'warning' ? 5000 : 3000;
        var type = alert.level === 'critical' ? 'error' : alert.level === 'warning' ? 'warning' : 'info';
        if (Components.Toast && Components.Toast[type]) {
            Components.Toast[type]('[' + alert.level.toUpperCase() + '] ' + alert.ruleName + ': ' + alert.message, duration);
        }

        // 3. 如果不在告警页面，记录通知
        var currentPage = Store.get('app.currentPage');
        if (currentPage !== 'ops_alerts') {
            var notifications = Store.get('ui.notifications') || [];
            notifications.unshift(Object.assign({}, alert, { read: false }));
            Store.set('ui.notifications', notifications.slice(0, 50));
        }
    }

    function _onAcknowledge(alertId) {
        if (!window.Store) return;
        var unread = Math.max(0, (Store.get('ops.alerts.unread') || 0) - 1);
        Store.set('ops.alerts.unread', unread);
    }

    function _updateSidebarBadge(unread) {
        var badge = document.querySelector('[data-page="ops_alerts"] .nav-badge');
        if (!badge) return;
        if (unread > 0) {
            badge.textContent = unread > 99 ? '99+' : unread;
            badge.style.display = 'flex';
        } else {
            badge.style.display = 'none';
        }
    }

    return { init: init };
})();

window.AlertNotifier = AlertNotifier;
