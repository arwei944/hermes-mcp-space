/**
 * 仪表盘页面 - 页面骨架与数据管理
 * 负责：数据加载、轮询管理、页面布局组装、SSE 事件分发
 */

const DashboardPageLayout = (() => {
    let _data = null;
    let _activity = [];
    let _trend = [];
    let _ranking = [];
    let _errors = [];
    let _heatmap = null;
    let _pollTimer = null;
    let _modules = {};

    async function _ensureModules() {
        if (_modules.statsSection) return;
        _modules.statsSection = (await import('./StatsSection.js')).default;
        _modules.activityFeed = (await import('./ActivityFeed.js')).default;
        _modules.trendChart = (await import('./TrendChart.js')).default;
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [dashData, activity, trend, ranking, errors, heatmap] = await Promise.all([
                API.system.dashboard(),
                API.dashboard.activity(),
                API.dashboard.trend({ days: 7 }),
                API.dashboard.ranking(),
                API.dashboard.errors(),
                API.dashboard.heatmap(),
            ]);
            _data = dashData;
            _activity = activity || [];
            _trend = trend || [];
            _ranking = ranking || [];
            _errors = errors || [];
            _heatmap = heatmap || null;
        } catch (_err) {
            _data = {};
            _activity = [];
            _trend = [];
            _ranking = [];
            _errors = [];
            _heatmap = null;
        }

        container.innerHTML = buildLayout();
        startPolling();
    }

    function stopPolling() {
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }
    }

    function startPolling() {
        stopPolling();
        _pollTimer = setInterval(async () => {
            try {
                const [dashData, activity] = await Promise.all([
                    API.system.dashboard(),
                    API.dashboard.activity({ limit: 30 }),
                ]);
                _data = dashData;
                _activity = activity || [];
                updateStats();
                updateActivityFeed();
            } catch (_e) {
                /* 静默 */
            }
        }, 15000);
    }

    function updateStats() {
        if (_modules.statsSection) {
            _modules.statsSection.updateStats(_data);
        }
    }

    function updateActivityFeed() {
        if (_modules.activityFeed) {
            _modules.activityFeed.updateFeed(_activity);
        }
    }

    function onSSEEvent(type, data) {
        if (type === 'mcp.tool_call' || type === 'mcp.tool_complete') {
            API.dashboard.activity({ limit: 30 })
                .then((activity) => {
                    _activity = activity || [];
                    updateActivityFeed();
                })
                .catch(() => {});
        }
        if (type === 'mcp.tool_complete') {
            setTimeout(() => {
                API.system
                    .dashboard()
                    .then((dashData) => {
                        _data = dashData;
                        updateStats();
                    })
                    .catch(() => {});
            }, 500);
        }
    }

    function buildLayout() {
        const statsHtml = _modules.statsSection.buildStats(_data);
        const agentCardHtml = _modules.statsSection.buildAgentCards(_data);
        const heartbeatHtml = _modules.statsSection.buildHeartbeat(_data);
        const activityHtml = _modules.activityFeed.buildSection(_activity);
        const errorHtml = _modules.activityFeed.buildErrorSection(_errors);
        const trendHtml = _modules.trendChart.buildTrendSection(_trend);
        const heatmapHtml = _modules.trendChart.buildHeatmapSection(_heatmap);
        const rankHtml = _modules.trendChart.buildRankingSection(_ranking);

        return `${statsHtml}
        ${agentCardHtml}
        ${heartbeatHtml}
        <div class="two-col" style="margin-top:16px">
            ${activityHtml}
            ${errorHtml}
        </div>
        <div class="two-col" style="margin-top:16px">
            ${trendHtml}
            ${heatmapHtml}
        </div>
        <div style="margin-top:16px">
            ${rankHtml}
        </div>`;
    }

    function destroy() {
        stopPolling();
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

export default DashboardPageLayout;
