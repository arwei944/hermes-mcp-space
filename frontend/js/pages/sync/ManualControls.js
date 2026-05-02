/**
 * 数据同步页面 - 手动操作（备份/恢复/更新前备份）
 */

const ManualControls = (() => {

    function buildSection() {
        const buttons = `
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <button class="btn btn-primary" data-action="backup">
                    ${Components.icon('upload', 14)} 立即备份
                </button>
                <button class="btn btn-secondary" data-action="restore">
                    ${Components.icon('download', 14)} 立即恢复
                </button>
                <button class="btn btn-ghost" data-action="preUpdateBackup">
                    ${Components.icon('shield', 14)} 更新前备份
                </button>
            </div>
        `;

        return Components.renderSection('手动操作', buttons);
    }

    async function doBackup(modules) {
        modules.syncStatus.setIsSyncing(true);
        const btn = document.querySelector('[data-action="backup"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('upload', 14)} 备份中...`;
        }

        try {
            const result = await API.post('/api/persistence/backup');
            if (result.success !== false) {
                modules.syncStatus.addSyncLog('手动备份', true, '备份完成');
                Components.Toast.success('备份完成');
                await modules.syncStatus.load();
                await modules.backendConfig.loadBackends();
                await modules.backendConfig.loadConfig();
                // 重新渲染
                _rerender(modules);
            } else {
                modules.syncStatus.addSyncLog('手动备份', false, result.error || '未知错误');
                Components.Toast.error(`备份失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            modules.syncStatus.addSyncLog('手动备份', false, err.message);
            Components.Toast.error(`备份失败: ${err.message}`);
        } finally {
            modules.syncStatus.setIsSyncing(false);
        }
    }

    async function doRestore(modules) {
        const ok = await Components.Modal.confirm({
            title: '确认恢复数据',
            message: '将从远程存储恢复所有数据，当前本地数据将被覆盖。此操作不可撤销，确定要继续吗？',
            confirmText: '确认恢复',
            type: 'danger',
        });
        if (!ok) return;

        modules.syncStatus.setIsSyncing(true);
        const btn = document.querySelector('[data-action="restore"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('download', 14)} 恢复中...`;
        }

        try {
            const result = await API.post('/api/persistence/restore');
            if (result.success !== false) {
                modules.syncStatus.addSyncLog('手动恢复', true, '恢复完成');
                Components.Toast.success('恢复完成，建议刷新页面');
                await modules.syncStatus.load();
                _rerender(modules);
            } else {
                modules.syncStatus.addSyncLog('手动恢复', false, result.error || '未知错误');
                Components.Toast.error(`恢复失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            modules.syncStatus.addSyncLog('手动恢复', false, err.message);
            Components.Toast.error(`恢复失败: ${err.message}`);
        } finally {
            modules.syncStatus.setIsSyncing(false);
        }
    }

    async function doPreUpdateBackup() {
        const btn = document.querySelector('[data-action="preUpdateBackup"]');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('shield', 14)} 备份中...`;
        }

        try {
            const result = await API.post('/api/persistence/pre-update');
            if (result.success !== false) {
                Components.Toast.success('更新前备份完成');
            } else {
                Components.Toast.error(`备份失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            Components.Toast.error(`备份失败: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${Components.icon('shield', 14)} 更新前备份`;
            }
        }
    }

    function _rerender(modules) {
        document.getElementById('contentBody').innerHTML = modules.page.buildPage(
            modules.syncStatus.buildSection(),
            modules.autoSync.buildSection(modules.backendConfig.getConfig()),
            modules.manualControls.buildSection(),
            modules.backendConfig.buildSection(modules.syncStatus.getStatus()),
            modules.hotUpdate.buildSection(),
            modules.changelog.buildSection(),
            modules.syncStatus.buildLogsSection(),
        );
        modules.page.bindEvents(modules);
    }

    function destroy() {}

    return { buildSection, doBackup, doRestore, doPreUpdateBackup, destroy };
})();

export default ManualControls;
