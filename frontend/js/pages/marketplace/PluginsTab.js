/**
 * 统一管理页面 - 插件市场 Tab
 */

const PluginsTab = (() => {
    // 状态
    let _market = [];
    let _installed = [];
    let _categories = {};
    let _filterType = '';
    let _filterCategory = '';
    let _pluginKeyword = '';
    let _pluginTab = 'market';
    let _container = null;

    // ==========================================
    // 渲染入口
    // ==========================================
    function render(containerSelector, data) {
        _market = data.market || [];
        _installed = data.installed || [];
        _categories = data.categories || {};
        _container = document.querySelector(containerSelector);
        if (!_container) return;
        _container.dataset.rendered = 'true';
        _container.innerHTML = buildTab();
        bindEvents();
    }

    // ==========================================
    // 辅助函数
    // ==========================================
    function getFilteredPlugins() {
        let result = _market;
        if (_filterType) result = result.filter((p) => p.type === _filterType);
        if (_filterCategory) result = result.filter((p) => p.category === _filterCategory);
        if (_pluginKeyword) {
            const kw = _pluginKeyword.toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(kw) ||
                    p.description.toLowerCase().includes(kw) ||
                    (p.tags || []).some((t) => t.toLowerCase().includes(kw)),
            );
        }
        return result;
    }

    // ==========================================
    // Tab 构建
    // ==========================================
    function buildTab() {
        const typeCounts = {
            all: _market.length,
            tool: _market.filter((p) => p.type === 'tool').length,
            skill: _market.filter((p) => p.type === 'skill').length,
            memory: _market.filter((p) => p.type === 'memory').length,
        };

        const tabHtml = `<div style="display:flex;gap:4px;margin-bottom:16px">
            <button type="button" class="btn ${_pluginTab === 'market' ? 'btn-primary' : 'btn-ghost'}" data-action="switchPluginTab" data-tab="market">插件市场 (${_market.length})</button>
            <button type="button" class="btn ${_pluginTab === 'installed' ? 'btn-primary' : 'btn-ghost'}" data-action="switchPluginTab" data-tab="installed">已安装 (${_installed.length})</button>
        </div>`;

        if (_pluginTab === 'installed') return tabHtml + buildInstalledPlugins();

        const filtered = getFilteredPlugins();

        const filterHtml = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            <input type="text" id="pluginSearch" placeholder="搜索插件..." value="${Components.escapeHtml(_pluginKeyword)}" style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
            <select id="pluginType" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
                <option value="">全部 (${typeCounts.all})</option>
                <option value="tool" ${_filterType === 'tool' ? 'selected' : ''}>工具 (${typeCounts.tool})</option>
                <option value="skill" ${_filterType === 'skill' ? 'selected' : ''}>技能 (${typeCounts.skill})</option>
                <option value="memory" ${_filterType === 'memory' ? 'selected' : ''}>记忆 (${typeCounts.memory})</option>
            </select>
            <select id="pluginCategory" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
                <option value="">所有分类</option>
                ${Object.entries(_categories)
                    .map(([cat, count]) => `<option value="${cat}" ${_filterCategory === cat ? 'selected' : ''}>${cat} (${count})</option>`)
                    .join('')}
            </select>
        </div>`;

        const cardsHtml =
            filtered.length === 0
                ? `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">没有找到匹配的插件</div>`
                : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
                    ${filtered.map((p) => buildPluginCard(p)).join('')}
                </div>`;

        return tabHtml + filterHtml + cardsHtml;
    }

    function buildPluginCard(p) {
        const isInstalled = p.installed;
        const typeLabel = { tool: '工具', skill: '技能', memory: '记忆' }[p.type] || p.type;
        const typeColor = { tool: 'blue', skill: 'purple', memory: 'green' }[p.type] || 'gray';
        const rating = Math.round(p.rating || 0);
        const stars = Components.icon('star', 14).repeat(rating) + Components.icon('star', 14).repeat(5 - rating);

        return `<div style="border:1px solid var(--border);border-radius:var(--radius-xs);padding:16px;transition:border-color 0.2s" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                        <span style="font-weight:600;font-size:14px">${Components.escapeHtml(p.name)}</span>
                        ${Components.renderBadge(typeLabel, typeColor)}
                        ${p.builtin ? Components.renderBadge('内置', 'green') : ''}
                    </div>
                    <div style="font-size:12px;color:var(--text-tertiary)">v${Components.escapeHtml(p.version || '?')} · ${Components.escapeHtml(p.author || '未知')}</div>
                </div>
                ${isInstalled
                    ? `<span style="font-size:11px;color:var(--green);font-weight:500;padding:4px 8px;border:1px solid var(--green);border-radius:var(--radius-xs)">已安装</span>`
                    : `<button type="button" class="btn btn-sm btn-primary" data-action="install" data-name="${Components.escapeHtml(p.name)}">安装</button>`
                }
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.5">${Components.escapeHtml(p.description)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${(p.tags || [])
                        .slice(0, 3)
                        .map((t) => `<span style="font-size:10px;padding:2px 6px;background:var(--surface-secondary);border-radius:var(--radius-xs);color:var(--text-tertiary)">${Components.escapeHtml(t)}</span>`)
                        .join('')}
                </div>
                <div style="font-size:11px;color:var(--text-tertiary)">
                    <span style="color:var(--orange)">${stars}</span>
                    <span style="margin-left:4px">${p.rating || '?'}</span>
                    <span style="margin-left:8px">${(p.downloads || 0).toLocaleString()} 下载</span>
                </div>
            </div>
            ${isInstalled
                ? `<div style="margin-top:8px;text-align:right">
                    <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red);font-size:11px" data-action="uninstall" data-name="${Components.escapeHtml(p.name)}">卸载</button>
                </div>`
                : ''}
        </div>`;
    }

    function buildInstalledPlugins() {
        if (_installed.length === 0) {
            return `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('puzzle', 32)}</div>
                <div style="font-size:14px;margin-bottom:8px">暂无已安装插件</div>
                <div style="font-size:12px">前往插件市场浏览和安装插件</div>
            </div>`;
        }
        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
            ${_installed
                .map(
                    (p) => `
                <div style="border:1px solid var(--border);border-radius:var(--radius-xs);padding:16px">
                    <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                        <div>
                            <div style="font-weight:600;font-size:14px">${Components.escapeHtml(p.name)}</div>
                            <div style="font-size:12px;color:var(--text-tertiary)">v${Components.escapeHtml(p.version || '?')} · ${Components.escapeHtml(p.type || '?')}</div>
                        </div>
                        <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="uninstall" data-name="${Components.escapeHtml(p.name)}">卸载</button>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary)">${Components.escapeHtml(p.description || '无描述')}</div>
                </div>
            `,
                )
                .join('')}
        </div>`;
    }

    // ==========================================
    // 插件操作
    // ==========================================
    async function _reload() {
        const [marketData, installedData] = await Promise.all([
            API.request('GET', '/api/plugins/market').catch(() => ({})),
            API.request('GET', '/api/plugins').catch(() => ({})),
        ]);
        _market = (typeof marketData === 'object' && marketData.plugins) ? marketData.plugins : [];
        _categories = (typeof marketData === 'object' && marketData.categories) ? marketData.categories : {};
        _installed = (typeof installedData === 'object' && installedData.plugins) ? installedData.plugins : [];
        _container.innerHTML = buildTab();
        bindEvents();
    }

    async function installPlugin(name) {
        try {
            await API.request('POST', '/api/plugins/install', { name });
            Components.Toast.success(`插件「${name}」安装成功`);
            await _reload();
        } catch (err) {
            Components.Toast.error(`安装失败: ${err.message}`);
        }
    }

    async function uninstallPlugin(name) {
        const ok = await Components.Modal.confirm({
            title: '卸载插件',
            message: `确定要卸载插件「${name}」吗？卸载后需要重新安装才能使用。`,
            confirmText: '卸载',
            type: 'danger',
        });
        if (!ok) return;
        try {
            await API.request('DELETE', `/api/plugins/${name}`);
            Components.Toast.success(`插件「${name}」已卸载`);
            await _reload();
        } catch (err) {
            Components.Toast.error(`卸载失败: ${err.message}`);
        }
    }

    // ==========================================
    // 事件绑定
    // ==========================================
    function bindEvents() {
        if (!_container) return;

        _container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            switch (action) {
                case 'switchPluginTab':
                    _pluginTab = btn.dataset.tab;
                    _container.innerHTML = buildTab();
                    bindEvents();
                    break;
                case 'install':
                    installPlugin(btn.dataset.name);
                    break;
                case 'uninstall':
                    uninstallPlugin(btn.dataset.name);
                    break;
            }
        });

        // 插件搜索
        const pluginSearch = document.getElementById('pluginSearch');
        if (pluginSearch) {
            pluginSearch.addEventListener(
                'input',
                Components.debounce((e) => {
                    _pluginKeyword = e.target.value;
                    _container.innerHTML = buildTab();
                    bindEvents();
                }, 300),
            );
        }

        // 插件类型筛选
        const pluginType = document.getElementById('pluginType');
        if (pluginType) {
            pluginType.addEventListener('change', (e) => {
                _filterType = e.target.value;
                _container.innerHTML = buildTab();
                bindEvents();
            });
        }

        // 插件分类筛选
        const pluginCategory = document.getElementById('pluginCategory');
        if (pluginCategory) {
            pluginCategory.addEventListener('change', (e) => {
                _filterCategory = e.target.value;
                _container.innerHTML = buildTab();
                bindEvents();
            });
        }
    }

    function destroy() {
        _container = null;
    }

    return { render, destroy };
})();

export default PluginsTab;
