/**
 * Ops Center - 资源监控 Tab
 * 复用 ops-dashboard 组件: ResourceCards, TrendChart, McpHealth, CronStatus
 */

var ResourceTab = (() => {
    var _destroyed = false;
    var _modules = {};
    var _unwatchers = [];
    var _metrics = null;
    var _historyData = { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
    var _mcpHealth = null;
    var _cronStatus = null;

    // ========== 工具函数 ==========

    function _normalizeHistory(history) {
        if (!Array.isArray(history) || history.length === 0) {
            return { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
        }
        return {
            cpu: history.map(function(h) { return h.cpu; }),
            memory: history.map(function(h) { return h.memory; }),
            disk: history.map(function(h) { return h.disk; }),
            network: history.map(function(h) { return h.network; }),
            timestamps: history.map(function(h) { return h.timestamp; }),
        };
    }

    // ========== Store 订阅 ==========

    function _subscribeStore() {
        _unwatchers.push(
            Store.watch('ops.metrics', function(metrics) {
                if (_destroyed || !metrics) return;
                _metrics = metrics;
                var el = document.getElementById('opsCenterResourceCards');
                if (el && _modules.resourceCards) el.innerHTML = _modules.resourceCards.buildResourceCards(_metrics);
            })
        );
        _unwatchers.push(
            Store.watch('ops.metricsHistory', function(history) {
                if (_destroyed || !history) return;
                _historyData = _normalizeHistory(history);
                var el = document.getElementById('opsCenterTrendChart');
                if (el && _modules.trendChart) el.innerHTML = _modules.trendChart.buildTrendChart(_historyData);
            })
        );
        _unwatchers.push(
            Store.watch('ops.mcpHealth', function(health) {
                if (_destroyed || !health) return;
                _mcpHealth = health;
                var el = document.getElementById('opsCenterMcpHealth');
                if (el && _modules.mcpHealth && _modules.trendChart) {
                    el.innerHTML = _modules.mcpHealth.buildMcpHealth(_mcpHealth, _modules.trendChart.buildHorizontalBar);
                }
            })
        );
        _unwatchers.push(
            Store.watch('ops.cronMonitor', function(cron) {
                if (_destroyed || !cron) return;
                _cronStatus = cron;
                var el = document.getElementById('opsCenterCronStatus');
                if (el && _modules.cronStatus) el.innerHTML = _modules.cronStatus.buildCronStatus(_cronStatus);
            })
        );
    }

    function _unsubscribeStore() {
        _unwatchers.forEach(function(unwatch) { unwatch(); });
        _unwatchers = [];
    }

    // ========== 公开方法 ==========

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // 动态导入 ops-dashboard 组件
        try {
            _modules.resourceCards = (await import('../ops-dashboard/ResourceCards.js')).default;
            _modules.trendChart = (await import('../ops-dashboard/TrendChart.js')).default;
            _modules.mcpHealth = (await import('../ops-dashboard/McpHealth.js')).default;
            _modules.cronStatus = (await import('../ops-dashboard/CronStatus.js')).default;
        } catch (_err) {
            container.innerHTML = '<div style="text-align:center;color:var(--red);padding:40px">组件加载失败</div>';
            return;
        }

        // 从 Store 读取数据
        try {
            var metrics = Store.get('ops.metrics');
            var history = Store.get('ops.metricsHistory');
            var mcpHealth = Store.get('ops.mcpHealth');
            var cronStatus = Store.get('ops.cronMonitor');

            if (metrics) _metrics = metrics;
            if (history) _historyData = _normalizeHistory(history);
            if (mcpHealth) _mcpHealth = mcpHealth;
            if (cronStatus) _cronStatus = cronStatus;
        } catch (_err) {
            // ignore
        }

        if (_destroyed) return;

        // 渲染布局
        var resourceCardsHtml = _modules.resourceCards.buildResourceCards(_metrics || {});
        var trendHtml = _modules.trendChart.buildTrendChart(_historyData);
        var mcpHtml = _modules.mcpHealth.buildMcpHealth(_mcpHealth || {}, _modules.trendChart.buildHorizontalBar);
        var cronHtml = _modules.cronStatus.buildCronStatus(_cronStatus || {});

        container.innerHTML =
            '<div id="opsCenterResourceCards">' + resourceCardsHtml + '</div>' +
            Components.renderSection(
                '资源趋势（最近 10 分钟）',
                '<div id="opsCenterTrendChart">' + trendHtml + '</div>'
            ) +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px" class="ops-resource-two-col">' +
                Components.renderSection('MCP 服务健康', '<div id="opsCenterMcpHealth">' + mcpHtml + '</div>') +
                Components.renderSection('定时任务状态', '<div id="opsCenterCronStatus">' + cronHtml + '</div>') +
            '</div>';

        // 订阅 Store 实时更新
        _subscribeStore();
    }

    function destroy() {
        _destroyed = true;
        _unsubscribeStore();
        _modules = {};
    }

    return { render, destroy };
})();

export default ResourceTab;
