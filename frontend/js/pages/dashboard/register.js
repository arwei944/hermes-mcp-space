/**
 * 仪表盘页面 - 注册入口
 * V2 目录结构：register.js / page.js / StatsSection.js / ActivityFeed.js / TrendChart.js
 */

const DashboardPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.statsSection = await import('./StatsSection.js');
        _modules.activityFeed = await import('./ActivityFeed.js');
        _modules.trendChart = await import('./TrendChart.js');
    }

    async function render() {
        await _ensureModules();
        await _modules.page.render();
    }

    function onSSEEvent(type, data) {
        if (!_modules.page) return;
        _modules.page.onSSEEvent(type, data);
    }

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.DashboardPage = ErrorHandler.wrap(DashboardPage);
