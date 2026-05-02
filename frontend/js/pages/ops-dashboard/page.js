/**
 * 运维监控仪表盘页面 - 页面骨架 + 轮询逻辑
 */

const OpsDashboardLayout = (() => {
    // ========== 状态 ==========
    let _pollTimer = null;
    let _historyTimer = null;
    let _serviceTimer = null;
    let _metrics = null;
    let _historyData = { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
    let _mcpHealth = null;
    let _cronStatus = null;
    let _modules = null;

    // ========== 公开方法 ==========

    async function render(modules) {
        _modules = modules;
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [metrics, history, mcpHealth, cronStatus] = await Promise.all([
                API.get('/api/ops/metrics'),
                API.get('/api/ops/metrics/history'),
                API.get('/api/ops/mcp-health'),
                API.get('/api/ops/cron'),
            ]);
            _metrics = metrics || {};
            _historyData = history || { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
            _mcpHealth = mcpHealth || {};
            _cronStatus = cronStatus || {};
        } catch (_err) {
            _metrics = {};
            _historyData = { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
            _mcpHealth = {};
            _cronStatus = {};
        }

        container.innerHTML = _buildPage();
        _startPolling();
    }

    function destroy() {
        _stopPolling();
    }

    // ========== 轮询 ==========

    function _startPolling() {
        _stopPolling();

        // 每 5 秒更新实时指标
        _pollTimer = setInterval(async () => {
            try {
                _metrics = await API.get('/api/ops/metrics') || {};
                _updateResourceCards();
            } catch (_e) { /* 静默 */ }
        }, 5000);

        // 每 30 秒更新趋势图
        _historyTimer = setInterval(async () => {
            try {
                _historyData = await API.get('/api/ops/metrics/history') || { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
                _updateTrendChart();
            } catch (_e) { /* 静默 */ }
        }, 30000);

        // 每 30 秒更新 MCP 健康和定时任务
        _serviceTimer = setInterval(async () => {
            try {
                const [mcpHealth, cronStatus] = await Promise.all([
                    API.get('/api/ops/mcp-health'),
                    API.get('/api/ops/cron'),
                ]);
                _mcpHealth = mcpHealth || {};
                _cronStatus = cronStatus || {};
                _updateMcpHealth();
                _updateCronStatus();
            } catch (_e) { /* 静默 */ }
        }, 30000);
    }

    function _stopPolling() {
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        if (_historyTimer) { clearInterval(_historyTimer); _historyTimer = null; }
        if (_serviceTimer) { clearInterval(_serviceTimer); _serviceTimer = null; }
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
