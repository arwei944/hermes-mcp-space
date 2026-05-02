/**
 * 定时任务页面 - 注册入口
 * V2 目录结构：register.js / page.js / CronList.js
 */

const CronPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.cronList = await import('./CronList.js');
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = _modules.page.buildLayout();
        await _modules.cronList.render('#cron-list');
    }

    function onSSEEvent(type, data) {}

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.CronPage = ErrorHandler.wrap(CronPage);
