/**
 * 插件市场页面
 * 内置插件索引 + 分类浏览 + 一键安装
 */

const PluginsPage = (() => {
    let _market = [];
    let _installed = [];
    let _categories = {};
    let _filterType = '';
    let _filterCategory = '';
    let _keyword = '';
    let _tab = 'market'; // market | installed

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();
        try {
            const [marketData, installedData] = await Promise.all([
                API.request('GET', '/api/plugins/market'),
                API.request('GET', '/api/plugins'),
            ]);
            _market = marketData.plugins || [];
            _categories = marketData.categories || {};
            _installed = installedData.plugins || [];
        } catch (_err) {
            _market = [];
            _installed = [];
        }
        container.innerHTML = buildPage();
        bindEvents();
    }

    function getFiltered() {
        let result = _market;
        if (_filterType) result = result.filter((p) => p.type === _filterType);
        if (_filterCategory) result = result.filter((p) => p.category === _filterCategory);
        if (_keyword) {
            const kw = _keyword.toLowerCase();
            result = result.filter(
                (p) =>
                    p.name.toLowerCase().includes(kw) ||
                    p.description.toLowerCase().includes(kw) ||
                    (p.tags || []).some((t) => t.toLowerCase().includes(kw)),
            );
        }
        return result;
    }

    function buildPage() {
        const filtered = getFiltered();
        const typeCounts = {
            all: _market.length,
            tool: _market.filter((p) => p.type === 'tool').length,
            skill: _market.filter((p) => p.type === 'skill').length,
            memory: _market.filter((p) => p.type === 'memory').length,
        };

        // Tab 切换
        const tabHtml = `<div style="display:flex;gap:4px;margin-bottom:16px">
            <button class="btn ${_tab === 'market' ? 'btn-primary' : 'btn-ghost'}" onclick="PluginsPage.switchTab('market')">插件市场 (${_market.length})</button>
            <button class="btn ${_tab === 'installed' ? 'btn-primary' : 'btn-ghost'}" onclick="PluginsPage.switchTab('installed')">已安装 (${_installed.length})</button>
        </div>`;

        if (_tab === 'installed') return tabHtml + buildInstalled();

        // 搜索 + 筛选
        const filterHtml = `<div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
            <input type="text" id="pluginSearch" placeholder="搜索插件..." value="${Components.escapeHtml(_keyword)}" style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
            <select id="pluginType" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
                <option value="">全部 (${typeCounts.all})</option>
                <option value="tool" ${_filterType === 'tool' ? 'selected' : ''}>工具 (${typeCounts.tool})</option>
                <option value="skill" ${_filterType === 'skill' ? 'selected' : ''}>技能 (${typeCounts.skill})</option>
                <option value="memory" ${_filterType === 'memory' ? 'selected' : ''}>记忆 (${typeCounts.memory})</option>
            </select>
            <select id="pluginCategory" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
                <option value="">所有分类</option>
                ${Object.entries(_categories)
                    .map(
                        ([cat, count]) =>
                            `<option value="${cat}" ${_filterCategory === cat ? 'selected' : ''}>${cat} (${count})</option>`,
                    )
                    .join('')}
            </select>
        </div>`;

        // 插件卡片
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
        const stars =
            Components.icon('star', 14).repeat(Math.round(p.rating || 0)) +
            Components.icon('star', 14).repeat(5 - Math.round(p.rating || 0));

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
                ${
                    isInstalled
                        ? `<span style="font-size:11px;color:var(--green);font-weight:500;padding:4px 8px;border:1px solid var(--green);border-radius:var(--radius-xs)">已安装</span>`
                        : `<button class="btn btn-sm btn-primary" onclick="PluginsPage.install('${Components.escapeHtml(p.name)}')">安装</button>`
                }
            </div>
            <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;line-height:1.5">${Components.escapeHtml(p.description)}</div>
            <div style="display:flex;justify-content:space-between;align-items:center">
                <div style="display:flex;gap:4px;flex-wrap:wrap">
                    ${(p.tags || [])
                        .slice(0, 3)
                        .map(
                            (t) =>
                                `<span style="font-size:10px;padding:2px 6px;background:var(--surface-secondary);border-radius:var(--radius-xs);color:var(--text-tertiary)">${Components.escapeHtml(t)}</span>`,
                        )
                        .join('')}
                </div>
                <div style="font-size:11px;color:var(--text-tertiary)">
                    <span style="color:var(--orange)">${stars}</span>
                    <span style="margin-left:4px">${p.rating || '?'}</span>
                    <span style="margin-left:8px">${(p.downloads || 0).toLocaleString()} 下载</span>
                </div>
            </div>
            ${
                isInstalled
                    ? `<div style="margin-top:8px;text-align:right">
                <button class="btn btn-sm btn-ghost" style="color:var(--red);font-size:11px" onclick="PluginsPage.uninstall('${Components.escapeHtml(p.name)}')">卸载</button>
            </div>`
                    : ''
            }
        </div>`;
    }

    function buildInstalled() {
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
                        <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="PluginsPage.uninstall('${Components.escapeHtml(p.name)}')">卸载</button>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary)">${Components.escapeHtml(p.description || '无描述')}</div>
                </div>
            `,
                )
                .join('')}
        </div>`;
    }

    function switchTab(tab) {
        _tab = tab;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    async function install(name) {
        try {
            await API.request('POST', '/api/plugins/install', { name });
            Components.Toast.success(`插件「${name}」安装成功`);
            await render();
        } catch (err) {
            Components.Toast.error(`安装失败: ${err.message}`);
        }
    }

    async function uninstall(name) {
        try {
            await API.request('DELETE', `/api/plugins/${name}`);
            Components.Toast.success(`插件「${name}」已卸载`);
            await render();
        } catch (err) {
            Components.Toast.error(`.*${err.message}`);
        }
    }

    function bindEvents() {
        const search = document.getElementById('pluginSearch');
        if (search)
            search.addEventListener(
                'input',
                Components.debounce((e) => {
                    _keyword = e.target.value;
                    document.getElementById('contentBody').innerHTML = buildPage();
                    bindEvents();
                }, 300),
            );
        const typeSelect = document.getElementById('pluginType');
        if (typeSelect)
            typeSelect.addEventListener('change', (e) => {
                _filterType = e.target.value;
                document.getElementById('contentBody').innerHTML = buildPage();
                bindEvents();
            });
        const catSelect = document.getElementById('pluginCategory');
        if (catSelect)
            catSelect.addEventListener('change', (e) => {
                _filterCategory = e.target.value;
                document.getElementById('contentBody').innerHTML = buildPage();
                bindEvents();
            });
    }

    return { render, switchTab, install, uninstall };
})();
