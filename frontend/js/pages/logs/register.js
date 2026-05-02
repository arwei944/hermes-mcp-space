/**
 * 操作日志页面 - 注册入口
 * V2 目录结构：register.js / page.js / LogList.js
 */

const LogsPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.logList = await import('./LogList.js');
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = _modules.page.buildLayout();
        await _modules.logList.render('#log-list');
    }

    function onSSEEvent(type, data) {}

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.LogsPage = ErrorHandler.wrap(LogsPage);
