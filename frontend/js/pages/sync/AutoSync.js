/**
 * 数据同步页面 - 自动同步策略
 */

const AutoSync = (() => {

    function buildSection(config) {
        const autoSync = config?.auto_sync || false;
        const interval = config?.sync_interval || 30;

        return Components.renderSection(
            '自动同步策略',
            `<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">
                <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px">
                    <input type="checkbox" id="autoSyncToggle" ${autoSync ? 'checked' : ''} style="width:16px;height:16px;accent-color:var(--accent)">
                    启用自动同步
                </label>
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-size:12px;color:var(--text-tertiary)">同步间隔:</span>
                    <select id="syncInterval" style="padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
                        <option value="10" ${interval === 10 ? 'selected' : ''}>10 分钟</option>
                        <option value="30" ${interval === 30 ? 'selected' : ''}>30 分钟</option>
                        <option value="60" ${interval === 60 ? 'selected' : ''}>1 小时</option>
                        <option value="120" ${interval === 120 ? 'selected' : ''}>2 小时</option>
                    </select>
                </div>
                <button type="button" class="btn btn-sm btn-ghost" data-action="saveAutoSyncConfig">保存设置</button>
            </div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">
                ${autoSync ? `<span style="color:var(--green)">● 自动同步已启用</span>，每 ${interval} 分钟自动备份一次` : '自动同步未启用，数据仅在手动操作时同步'}
            </div>`,
        );
    }

    async function saveConfig(modules) {
        const enabled = document.getElementById('autoSyncToggle')?.checked || false;
        const interval = parseInt(document.getElementById('syncInterval')?.value || '30', 10);
        try {
            await API.post('/api/persistence/config', { auto_sync: enabled, sync_interval: interval });
            modules.backendConfig.updateLocalConfig({ auto_sync: enabled, sync_interval: interval });
            modules.syncStatus.addSyncLog('保存自动同步配置', true, `${enabled ? '启用' : '禁用'}, 间隔 ${interval} 分钟`);
            Components.Toast.success('自动同步配置已保存');
            // 重新渲染页面
            modules.page.buildPage(
                modules.syncStatus.buildSection(),
                modules.autoSync.buildSection(modules.backendConfig.getConfig()),
                modules.manualControls.buildSection(),
                modules.backendConfig.buildSection(modules.syncStatus.getStatus()),
                modules.hotUpdate.buildSection(),
                modules.changelog.buildSection(),
                modules.syncStatus.buildLogsSection(),
            );
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
        } catch (err) {
            modules.syncStatus.addSyncLog('保存自动同步配置', false, err.message);
            Components.Toast.error('保存失败: ' + err.message);
        }
    }

    function destroy() {}

    return { buildSection, saveConfig, destroy };
})();

export default AutoSync;
