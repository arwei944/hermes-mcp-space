/**
 * 运维监控仪表盘页面 - 注册入口
 * V2 目录结构：register.js / page.js / ResourceCards.js / TrendChart.js / McpHealth.js / CronStatus.js
 */

const OpsDashboardPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.resourceCards = await import('./ResourceCards.js');
        _modules.trendChart = await import('./TrendChart.js');
        _modules.mcpHealth = await import('./McpHealth.js');
        _modules.cronStatus = await import('./CronStatus.js');
    }

    async function render() {
        await _ensureModules();
        await _modules.page.render(_modules);
    }

    function onSSEEvent(type, data) {
        if (type === 'ops.alert') {
            const level = data.level || 'info';
            const msg = data.message || data.msg || '收到运维告警';
            Components.Toast.show(msg, level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info');
        }
    }

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.OpsDashboardPage = ErrorHandler.wrap(OpsDashboardPage);
