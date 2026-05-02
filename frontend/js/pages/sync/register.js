/**
 * 数据同步页面 - 注册入口
 * V2 目录结构：register.js / page.js / SyncStatus.js / AutoSync.js / ManualControls.js / BackendConfig.js / HotUpdate.js / Changelog.js
 */

const SyncPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = (await import('./page.js')).default;
        _modules.syncStatus = (await import('./SyncStatus.js')).default;
        _modules.autoSync = (await import('./AutoSync.js')).default;
        _modules.manualControls = (await import('./ManualControls.js')).default;
        _modules.backendConfig = (await import('./BackendConfig.js')).default;
        _modules.hotUpdate = (await import('./HotUpdate.js')).default;
        _modules.changelog = (await import('./Changelog.js')).default;
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            await Promise.all([
                _modules.syncStatus.load(),
                _modules.backendConfig.loadBackends(),
                _modules.backendConfig.loadConfig(),
                _modules.changelog.load(),
            ]);
        } catch (_err) {
            // 部分加载失败不阻塞页面渲染
        }

        container.innerHTML = _modules.page.buildPage(
            _modules.syncStatus.buildSection(),
            _modules.autoSync.buildSection(_modules.backendConfig.getConfig()),
            _modules.manualControls.buildSection(),
            _modules.backendConfig.buildSection(_modules.syncStatus.getStatus()),
            _modules.hotUpdate.buildSection(),
            _modules.changelog.buildSection(),
            _modules.syncStatus.buildLogsSection(),
        );
        _modules.page.bindEvents(_modules);
    }

    function onSSEEvent(type, data) {
        // SSE 事件暂不处理，预留扩展
    }

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.SyncPage = ErrorHandler.wrap(SyncPage);
