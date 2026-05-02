/**
 * 数据同步页面 - 后端配置
 */

const BackendConfig = (() => {
    let _backends = [];
    let _config = null;

    async function loadBackends() {
        try {
            const resp = await API.get('/api/persistence/backends');
            _backends = resp.backends || [];
        } catch (_err) {
            _backends = [];
        }
    }

    async function loadConfig() {
        try {
            const resp = await API.get('/api/persistence/config');
            _config = resp;
        } catch (_err) {
            _config = null;
        }
    }

    function getConfig() {
        return _config;
    }

    function updateLocalConfig(partial) {
        if (_config) {
            Object.assign(_config, partial);
        }
    }

    function buildSection(syncStatus) {
        const currentBackend = syncStatus?.backend || 'none';
        const currentLabel =
            currentBackend === 'git' ? 'Git' : currentBackend === 'hf_buckets' ? 'HF Buckets' : '未配置';
        const configured = syncStatus?.configured;

        const backendListHtml = _backends.length > 0
            ? _backends
                  .map(
                      (b) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                    <div>
                        <span style="font-weight:500">${Components.escapeHtml(b.name)}</span>
                        <span style="font-size:12px;color:var(--text-tertiary);margin-left:8px">${Components.escapeHtml(b.description || '')}</span>
                    </div>
                    ${b.name === currentBackend
                        ? Components.renderBadge('当前', 'green')
                        : `<button class="btn btn-sm btn-ghost" data-action="switchBackend" data-backend="${Components.escapeHtml(b.name)}">切换</button>`}
                </div>
            `,
                  )
                  .join('')
            : '<div style="color:var(--text-tertiary);font-size:13px">暂无可用后端</div>';

        const configHtml = _config
            ? `<div style="margin-top:12px">
                <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">当前配置</div>
                <div class="schema-display">${Components.escapeHtml(JSON.stringify(_config, null, 2))}</div>
            </div>`
            : '';

        return Components.renderSection(
            '后端配置',
            `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <span>当前后端:</span>
                ${Components.renderBadge(currentLabel, configured ? 'green' : 'red')}
            </div>
            ${backendListHtml}
            ${configHtml}
        `,
        );
    }

    async function switchBackend(backend, modules) {
        const ok = await Components.Modal.confirm({
            title: '切换后端',
            message: `确定要将持久化后端切换为 <strong>${Components.escapeHtml(backend)}</strong> 吗？切换后将自动执行一次备份。`,
            confirmText: '切换',
            type: 'warning',
        });
        if (!ok) return;

        try {
            const result = await API.post('/api/persistence/switch', { backend });
            if (result.success !== false) {
                Components.Toast.success(`已切换到 ${backend}`);
                await Promise.all([
                    modules.syncStatus.load(),
                    modules.backendConfig.loadBackends(),
                    modules.backendConfig.loadConfig(),
                ]);
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
            } else {
                Components.Toast.error(`切换失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            Components.Toast.error(`切换失败: ${err.message}`);
        }
    }

    function destroy() {
        _backends = [];
        _config = null;
    }

    return { loadBackends, loadConfig, getConfig, updateLocalConfig, buildSection, switchBackend, destroy };
})();

export default BackendConfig;
