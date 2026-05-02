/**
 * Agent 行为管理页面 - 注册入口
 * V2 目录结构：register.js / page.js / PersonalityTab.js / BehaviorLog.js / StatsTab.js / constants.js
 */

const AgentsBehaviorPage = (() => {
    let _page = null;

    async function _ensureModules() {
        if (_page) return;
        _page = (await import('./page.js')).default;
    }

    async function render() {
        await _ensureModules();
        await _page.render();
    }

    function onSSEEvent(type, data) {
        if (_page) _page.onSSEEvent(type, data);
    }

    function destroy() {
        if (_page) {
            _page.destroy();
            _page = null;
        }
    }

    return { render, onSSEEvent, destroy };
})();

window.AgentsBehaviorPage = ErrorHandler.wrap(AgentsBehaviorPage);
