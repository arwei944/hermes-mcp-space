/**
 * 插件管理页面
 */

const PluginsPage = (() => {
    let _plugins = [];
    let _showInstall = false;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();
        try {
            const data = await API.request('GET', '/api/plugins');
            _plugins = data.plugins || [];
        } catch (err) { _plugins = []; }
        container.innerHTML = buildPage();
        bindEvents();
    }

    function buildPage() {
        const listHtml = _plugins.length === 0
            ? `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">🧩</div>
                <div style="font-size:14px;margin-bottom:8px">暂无已安装插件</div>
                <div style="font-size:12px;margin-bottom:16px">通过 Git 仓库安装插件来扩展功能</div>
                <button class="btn btn-primary" onclick="PluginsPage.showInstall()">安装插件</button>
              </div>`
            : `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                <span style="font-size:13px;color:var(--text-tertiary)">${_plugins.length} 个插件</span>
                <button class="btn btn-primary btn-sm" onclick="PluginsPage.showInstall()">+ 安装插件</button>
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
                ${_plugins.map(p => `
                    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px">
                        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                            <div>
                                <div style="font-weight:600;font-size:14px">${Components.escapeHtml(p.name)}</div>
                                <div style="font-size:12px;color:var(--text-tertiary)">v${Components.escapeHtml(p.version || '?')} · ${Components.escapeHtml(p.author || '未知作者')}</div>
                            </div>
                            <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="PluginsPage.uninstall('${Components.escapeHtml(p.name)}')">卸载</button>
                        </div>
                        <div style="font-size:12px;color:var(--text-secondary)">${Components.escapeHtml(p.description || '无描述')}</div>
                        ${p.installed_at ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:8px">安装于 ${Components.formatTime(p.installed_at)}</div>` : ''}
                    </div>
                `).join('')}
            </div>`;

        const installHtml = _showInstall ? `
            <div class="modal-overlay" onclick="PluginsPage.hideInstall()">
                <div class="modal" onclick="event.stopPropagation()" style="max-width:480px">
                    <div class="modal-header">
                        <h3>安装插件</h3>
                        <button class="modal-close" onclick="PluginsPage.hideInstall()">✕</button>
                    </div>
                    <div class="modal-body">
                        ${Components.formGroup('Git 仓库 URL', `<input class="form-input" id="pluginSource" placeholder="https://github.com/user/hermes-plugin-xxx">`)}
                        <div style="font-size:12px;color:var(--text-tertiary);margin-top:4px">
                            插件目录结构:<br>
                            <code style="font-size:11px;background:var(--bg);padding:2px 6px;border-radius:4px">
                                plugin.json / tools/*.json / skills/*.md / memory/*.md
                            </code>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button class="btn btn-ghost" onclick="PluginsPage.hideInstall()">取消</button>
                        <button class="btn btn-primary" onclick="PluginsPage.install()">安装</button>
                    </div>
                </div>
            </div>` : '';

        return Components.renderSection('插件管理', listHtml) + installHtml;
    }

    function showInstall() { _showInstall = true; document.getElementById('contentBody').innerHTML = buildPage(); bindEvents(); }
    function hideInstall() { _showInstall = false; document.getElementById('contentBody').innerHTML = buildPage(); bindEvents(); }

    async function install() {
        const source = document.getElementById('pluginSource')?.value.trim();
        if (!source) { Components.Toast.error('请输入 Git 仓库 URL'); return; }
        try {
            await API.request('POST', '/api/plugins/install', { source });
            Components.Toast.success('插件安装成功');
            _showInstall = false;
            await render();
        } catch (err) { Components.Toast.error(`安装失败: ${err.message}`); }
    }

    async function uninstall(name) {
        try {
            await API.request('DELETE', `/api/plugins/${name}`);
            Components.Toast.success('插件已卸载');
            await render();
        } catch (err) { Components.Toast.error(`卸载失败: ${err.message}`); }
    }

    function bindEvents() {}

    return { render, showInstall, hideInstall, install, uninstall };
})();
