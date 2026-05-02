/**
 * 运维监控仪表盘页面 - 页面骨架 + Store 响应式订阅
 *
 * 数据由 OpsSyncService 统一轮询并写入 Store，
 * 本页面仅通过 Store.watch() 响应式消费数据，不再直接调用 API。
 */

const OpsDashboardLayout = (() => {
    // ========== 状态 ==========
    let _metrics = null;
    let _historyData = { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
    let _mcpHealth = null;
    let _cronStatus = null;
    let _modules = null;
    let _unwatchers = [];   // Store.watch 取消函数列表

    // ========== 公开方法 ==========

    async function render(modules) {
        _modules = modules;
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        // ---- 初始数据加载：优先从 Store 读取，无数据时回退到 API ----
        try {
            const metrics = Store.get('ops.metrics');
            const history = Store.get('ops.metricsHistory');
            const mcpHealth = Store.get('ops.mcpHealth');
            const cronStatus = Store.get('ops.cronMonitor');

            if (metrics && mcpHealth && cronStatus) {
                // Store 已有数据（OpsSyncService 已运行过），直接使用
                _metrics = metrics;
                _historyData = _normalizeHistory(history);
                _mcpHealth = mcpHealth;
                _cronStatus = cronStatus;
            } else {
                // Store 无数据，回退到直接 API 调用（首次渲染）
                const [apiMetrics, apiHistory, apiMcpHealth, apiCronStatus] = await Promise.all([
                    API.get('/api/ops/metrics'),
                    API.get('/api/ops/metrics/history'),
                    API.get('/api/ops/mcp-health'),
                    API.get('/api/ops/cron'),
                ]);
                _metrics = apiMetrics || {};
                _historyData = apiHistory || { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
                _mcpHealth = apiMcpHealth || {};
                _cronStatus = apiCronStatus || {};
            }
        } catch (_err) {
            _metrics = {};
            _historyData = { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
            _mcpHealth = {};
            _cronStatus = {};
        }

        // ---- 渲染页面骨架 ----
        container.innerHTML = _buildPage();

        // ---- 订阅 Store 变化，实现响应式更新 ----
        _subscribeStore();
    }

    function destroy() {
        _unsubscribeStore();
    }

    // ========== Store 订阅 ==========

    function _subscribeStore() {
        _unsubscribeStore();

        // 监听实时指标（5s 由 OpsSyncService 更新）
        _unwatchers.push(
            Store.watch('ops.metrics', function(metrics) {
                if (!metrics) return;
                _metrics = metrics;
                _updateResourceCards();
            })
        );

        // 监听趋势历史数据
        _unwatchers.push(
            Store.watch('ops.metricsHistory', function(history) {
                if (!history) return;
                _historyData = _normalizeHistory(history);
                _updateTrendChart();
            })
        );

        // 监听 MCP 健康状态（30s 由 OpsSyncService 更新）
        _unwatchers.push(
            Store.watch('ops.mcpHealth', function(health) {
                if (!health) return;
                _mcpHealth = health;
                _updateMcpHealth();
            })
        );

        // 监听定时任务状态（30s 由 OpsSyncService 更新）
        _unwatchers.push(
            Store.watch('ops.cronMonitor', function(cron) {
                if (!cron) return;
                _cronStatus = cron;
                _updateCronStatus();
            })
        );
    }

    function _unsubscribeStore() {
        _unwatchers.forEach(function(unwatch) { unwatch(); });
        _unwatchers = [];
    }

    // ========== 工具函数 ==========

    /**
     * 将 Store 中的 metricsHistory 数组转换为 TrendChart 所需格式
     * Store 中每条记录包含 { cpu, memory, disk, network, timestamp }
     */
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

    // ========== 增量更新 ==========

    function _updateResourceCards() {
        const el = document.getElementById('opsResourceCards');
        if (!el || !_metrics) return;
        el.innerHTML = _modules.resourceCards.buildResourceCards(_metrics);
    }

    function _updateTrendChart() {
        const el = document.getElementById('opsTrendChart');
        if (!el) return;
        el.innerHTML = _modules.trendChart.buildTrendChart(_historyData);
    }

    function _updateMcpHealth() {
        const el = document.getElementById('opsMcpHealth');
        if (!el) return;
        el.innerHTML = _modules.mcpHealth.buildMcpHealth(_mcpHealth, _modules.trendChart.buildHorizontalBar);
    }

    function _updateCronStatus() {
        const el = document.getElementById('opsCronStatus');
        if (!el) return;
        el.innerHTML = _modules.cronStatus.buildCronStatus(_cronStatus);
    }

    // ========== 页面组装 ==========

    function _buildPage() {
        // 区域 1：实时资源监控卡片
        const resourceHtml = _modules.resourceCards.buildResourceCards(_metrics);

        // 区域 2：资源趋势图
        const trendHtml = Components.renderSection(
            '资源趋势（最近 10 分钟）',
            `<div id="opsTrendChart">${_modules.trendChart.buildTrendChart(_historyData)}</div>`,
        );

        // 区域 3 + 4：左右两栏
        const mcpSection = Components.renderSection('MCP 服务健康', _modules.mcpHealth.buildMcpHealth(_mcpHealth, _modules.trendChart.buildHorizontalBar));
        const cronSection = Components.renderSection('定时任务状态', _modules.cronStatus.buildCronStatus(_cronStatus));

        return `<div class="page-container">
            <h2 class="page-title">运维监控</h2>

            <!-- 区域 1：实时资源监控 -->
            <div id="opsResourceCards">${resourceHtml}</div>

            <!-- 区域 2：资源趋势图 -->
            ${trendHtml}

            <!-- 区域 3 + 4：MCP 健康 + 定时任务 -->
            <div class="two-col" style="margin-top:16px">
                ${mcpSection}
                ${cronSection}
            </div>
        </div>
        <style>
            .ops-resource-grid {
                grid-template-columns: repeat(4, 1fr);
            }
            @media (max-width: 1024px) {
                .ops-resource-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            @media (max-width: 480px) {
                .ops-resource-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>`;
    }

    return { render, destroy };
})();

export default OpsDashboardLayout;
