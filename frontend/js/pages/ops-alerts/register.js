/**
 * 告警管理页面 - 注册入口
 * V2 目录结构：register.js / page.js / RulesTab.js / HistoryTab.js
 */

const OpsAlertsPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.rulesTab = await import('./RulesTab.js');
        _modules.historyTab = await import('./HistoryTab.js');
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            await Promise.all([
                _modules.rulesTab.loadData(),
                _modules.historyTab.loadData(),
            ]);
        } catch (_err) {
            // 静默处理
        }

        container.innerHTML = _modules.page.buildLayout();
        _modules.page.bindEvents();

        await _modules.rulesTab.render('#ops-alerts-rules');
        await _modules.historyTab.render('#ops-alerts-history');
    }

    function onSSEEvent(type, data) {
        if (type === 'ops.alert') {
            _modules.historyTab?.onSSEAlert?.();
        }
    }

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.OpsAlertsPage = ErrorHandler.wrap(OpsAlertsPage);
