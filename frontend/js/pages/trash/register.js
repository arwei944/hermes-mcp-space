/**
 * 回收站页面 - 注册入口
 * V2 目录结构：register.js / page.js / TrashList.js
 */

const TrashPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = (await import('./page.js')).default;
        _modules.trashList = (await import('./TrashList.js')).default;
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = _modules.page.buildLayout();
        await _modules.trashList.render('#trash-list');
    }

    function onSSEEvent(type, data) {}

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.TrashPage = ErrorHandler.wrap(TrashPage);
