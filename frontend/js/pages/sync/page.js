/**
 * 数据同步页面 - 页面骨架与事件委托
 */

const SyncPageLayout = (() => {

    function buildPage(syncStatusHtml, autoSyncHtml, manualHtml, backendHtml, hotUpdateHtml, changelogHtml, logsHtml) {
        return `<div style="max-width:860px">
            ${syncStatusHtml}
            ${autoSyncHtml}
            ${manualHtml}
            ${backendHtml}
            ${hotUpdateHtml}
            ${changelogHtml}
            ${logsHtml}
        </div>`;
    }

    function bindEvents(modules) {
        // 事件委托：统一处理所有 data-action 按钮
        const container = document.getElementById('contentBody');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            switch (btn.dataset.action) {
                case 'backup':
                    modules.manualControls.doBackup(modules);
                    break;
                case 'restore':
                    modules.manualControls.doRestore(modules);
                    break;
                case 'preUpdateBackup':
                    modules.manualControls.doPreUpdateBackup();
                    break;
                case 'checkUpdate':
                    modules.hotUpdate.checkUpdate(modules);
                    break;
                case 'hotUpdate':
                    modules.hotUpdate.execute(modules);
                    break;
                case 'switchBackend':
                    modules.backendConfig.switchBackend(btn.dataset.backend, modules);
                    break;
                case 'saveAutoSyncConfig':
                    modules.autoSync.saveConfig(modules);
                    break;
            }
        });
    }

    return { buildPage, bindEvents };
})();

export default SyncPageLayout;
