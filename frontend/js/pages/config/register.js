/**
 * 系统配置页面 - 注册入口
 * V2 目录结构：register.js / page.js / ConfigForm.js
 */

const ConfigPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = (await import('./page.js')).default;
        _modules.configForm = (await import('./ConfigForm.js')).default;
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = _modules.page.buildLayout();
        await _modules.configForm.render('#config-form');
    }

    function onSSEEvent(type, data) {}

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.ConfigPage = ErrorHandler.wrap(ConfigPage);
