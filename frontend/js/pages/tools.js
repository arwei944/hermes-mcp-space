/**
 * 工具管理页面 (Mac 极简风格)
 */

const ToolsPage = (() => {
    let _tools = [];
    let _toolsets = [];
    let _activeFilter = '全部';
    let _searchKeyword = '';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [toolsData, toolsetsData] = await Promise.all([API.tools.list(), API.tools.toolsets()]);
            // 后端返回 {name, description, schema, status} 或 {name, description, toolset, enabled}
            const rawTools = toolsData.tools || toolsData || [];
            _tools = rawTools.map((t) => ({
                ...t,
                enabled: t.enabled !== undefined ? t.enabled : t.status !== 'inactive',
                toolset: t.toolset || t.name.split('_')[0] || 'default',
            }));
            const rawToolsets = toolsetsData.toolsets || toolsetsData || [];
            _toolsets = rawToolsets.map((ts) => (typeof ts === 'string' ? ts : ts.name)).filter(Boolean);
        } catch (_err) {
            const mock = { tools: [], toolsets: [] };
            _tools = mock.tools;
            _toolsets = mock.toolsets;
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getFilteredTools() {
        let result = _tools;
        if (_activeFilter !== '全部') {
            result = result.filter((t) => t.toolset === _activeFilter);
        }
        if (_searchKeyword) {
            const kw = _searchKeyword.toLowerCase();
            result = result.filter(
                (t) => (t.name || '').toLowerCase().includes(kw) || (t.description || '').toLowerCase().includes(kw),
            );
        }
        return result;
    }

    function buildPage() {
        const filtered = getFilteredTools();
        const filterTags = ['全部', ..._toolsets.filter((t) => t !== '全部')];
        const filterHtml = Components.createFilterGroup(filterTags, _activeFilter, 'ToolsPage.setFilter');

        const searchHtml = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <div style="position:relative;flex:1">
                ${Components.icon('search', 14, 'var(--text-tertiary)', 'position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none')}
                <input type="text" id="toolSearchInput" placeholder="搜索工具名称或描述..." value="${Components.escapeHtml(_searchKeyword)}" style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
            </div>
        </div>`;

        const toolsHtml =
            filtered.length === 0
                ? Components.createEmptyState(Components.icon('wrench', 16), '暂无工具', '没有匹配的工具', '')
                : `<div class="tool-grid">${filtered
                      .map(
                          (tool) => `
                <div class="tool-card">
                    <div class="tool-card-header" style="cursor:pointer" onclick="ToolsPage.viewTool('${Components.escapeHtml(tool.name)}')">
                        <span class="tool-name">${Components.escapeHtml(tool.name)}</span>
                        <label style="cursor:pointer;margin:0" onclick="event.stopPropagation()">
                            <input type="checkbox" ${tool.enabled ? 'checked' : ''} onchange="ToolsPage.toggleTool('${Components.escapeHtml(tool.name)}', this.checked)" style="margin-right:4px;accent-color:var(--accent)">
                            <span style="font-size:11px;color:var(--text-tertiary)">${tool.enabled ? '启用' : '禁用'}</span>
                        </label>
                    </div>
                    <div class="tool-desc" style="cursor:pointer" onclick="ToolsPage.viewTool('${Components.escapeHtml(tool.name)}')">${Components.escapeHtml(tool.description || '无描述')}</div>
                    <div class="tool-card-meta">
                        ${Components.renderBadge(tool.toolset || 'default', 'blue')}
                        <button class="btn btn-sm btn-ghost" onclick="ToolsPage.viewTool('${Components.escapeHtml(tool.name)}')" style="margin-left:auto">详情</button>
                    </div>
                </div>
            `,
                      )
                      .join('')}</div>`;

        return `${filterHtml}
            ${searchHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <span class="tool-count" style="font-size:12px;color:var(--text-tertiary)">共 ${filtered.length} 个工具</span>
            </div>
            <div id="toolListContainer">${toolsHtml}</div>`;
    }

    function updateToolList() {
        const filtered = getFilteredTools();
        // 更新计数
        const container = document.getElementById('toolListContainer');
        if (!container) return;

        const toolsHtml =
            filtered.length === 0
                ? Components.createEmptyState(Components.icon('wrench', 16), '暂无工具', '没有匹配的工具', '')
                : `<div class="tool-grid">${filtered
                      .map(
                          (tool) => `
                <div class="tool-card">
                    <div class="tool-card-header" style="cursor:pointer" onclick="ToolsPage.viewTool('${Components.escapeHtml(tool.name)}')">
                        <span class="tool-name">${Components.escapeHtml(tool.name)}</span>
                        <label style="cursor:pointer;margin:0" onclick="event.stopPropagation()">
                            <input type="checkbox" ${tool.enabled ? 'checked' : ''} onchange="ToolsPage.toggleTool('${Components.escapeHtml(tool.name)}', this.checked)" style="margin-right:4px;accent-color:var(--accent)">
                            <span style="font-size:11px;color:var(--text-tertiary)">${tool.enabled ? '启用' : '禁用'}</span>
                        </label>
                    </div>
                    <div class="tool-desc" style="cursor:pointer" onclick="ToolsPage.viewTool('${Components.escapeHtml(tool.name)}')">${Components.escapeHtml(tool.description || '无描述')}</div>
                    <div class="tool-card-meta">
                        ${Components.renderBadge(tool.toolset || 'default', 'blue')}
                        <button class="btn btn-sm btn-ghost" onclick="ToolsPage.viewTool('${Components.escapeHtml(tool.name)}')" style="margin-left:auto">详情</button>
                    </div>
                </div>
            `,
                      )
                      .join('')}</div>`;

        container.innerHTML = toolsHtml;

        // 更新计数文本
        const countSpan = document.querySelector('#contentBody .tool-count');
        if (countSpan) {
            countSpan.textContent = `共 ${filtered.length} 个工具`;
        }
    }

    function search(keyword) {
        _searchKeyword = keyword;
        updateToolList();
    }

    async function viewTool(name) {
        Components.Modal.open({ title: `工具详情: ${name}`, size: 'lg', content: Components.createLoading() });
        try {
            const data = await API.tools.get(name);
            const tool = data.tool || data;
            document.getElementById('modalBody').innerHTML = `
                <div style="margin-bottom:16px">
                    <h3 style="font-size:15px;font-weight:600;margin-bottom:8px">${Components.escapeHtml(tool.name)}</h3>
                    <p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">${Components.escapeHtml(tool.description)}</p>
                    <div style="display:flex;gap:8px;align-items:center">
                        ${Components.renderBadge(tool.toolset || 'default', 'blue')}
                        ${tool.enabled ? Components.renderBadge('已启用', 'green') : Components.renderBadge('已禁用', 'orange')}
                    </div>
                </div>
                ${Components.sectionTitle('参数定义')}
                ${Components.renderJson(tool.schema || tool.inputSchema || tool.parameters || {})}
            `;
        } catch (err) {
            document.getElementById('modalBody').innerHTML = Components.createEmptyState(
                Components.icon('wrench', 16),
                '加载失败',
                err.message,
                '',
            );
        }
    }

    async function toggleTool(name, enabled) {
        try {
            await API.tools.toggle(name, enabled);
            Components.Toast.success(`工具 ${name} 已${enabled ? '启用' : '禁用'}`);
            const tool = _tools.find((t) => t.name === name);
            if (tool) tool.enabled = enabled;
            updateToolList();
        } catch (err) {
            Components.Toast.error(`操作失败: ${err.message}`);
        }
    }

    function setFilter(filter) {
        _activeFilter = filter;
        updateToolList();
    }

    function bindEvents() {
        const searchInput = document.getElementById('toolSearchInput');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    search(e.target.value);
                }, 300),
            );
        }
    }

    return { render, viewTool, toggleTool, setFilter, search };
})();
