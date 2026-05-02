/**
 * 统一管理页面 - 工具管理 Tab
 */

const ToolsTab = (() => {
    // 状态
    let _allTools = [];
    let _toolsets = [];
    let _activeToolFilter = '全部';
    let _toolSearchKeyword = '';
    let _container = null;

    // ==========================================
    // 渲染入口
    // ==========================================
    function render(containerSelector, data) {
        _allTools = data.allTools || [];
        _toolsets = data.toolsets || [];
        _container = document.querySelector(containerSelector);
        if (!_container) return;
        _container.dataset.rendered = 'true';
        _container.innerHTML = buildTab();
        bindEvents();
    }

    // ==========================================
    // 辅助函数
    // ==========================================
    function getFilteredTools() {
        let result = _allTools;
        if (_activeToolFilter !== '全部') {
            result = result.filter((t) => t.toolset === _activeToolFilter);
        }
        if (_toolSearchKeyword) {
            const kw = _toolSearchKeyword.toLowerCase();
            result = result.filter(
                (t) => (t.name || '').toLowerCase().includes(kw) || (t.description || '').toLowerCase().includes(kw),
            );
        }
        return result;
    }

    function buildToolCard(tool) {
        return `<div class="tool-card">
            <div class="tool-card-header" style="cursor:pointer" data-action="viewTool" data-name="${Components.escapeHtml(tool.name)}">
                <span class="tool-name">${Components.escapeHtml(tool.name)}</span>
                <label style="cursor:pointer;margin:0" data-action="stopPropagation">
                    <input type="checkbox" ${tool.enabled ? 'checked' : ''} data-action="toggleTool" data-name="${Components.escapeHtml(tool.name)}" style="margin-right:4px;accent-color:var(--accent)">
                    <span style="font-size:11px;color:var(--text-tertiary)">${tool.enabled ? '启用' : '禁用'}</span>
                </label>
            </div>
            <div class="tool-desc" style="cursor:pointer" data-action="viewTool" data-name="${Components.escapeHtml(tool.name)}">${Components.escapeHtml(tool.description || '无描述')}</div>
            <div class="tool-card-meta">
                ${Components.renderBadge(tool.toolset || 'default', 'blue')}
                <button type="button" class="btn btn-sm btn-ghost" data-action="viewTool" data-name="${Components.escapeHtml(tool.name)}" style="margin-left:auto">详情</button>
            </div>
        </div>`;
    }

    function buildToolGrid(filtered) {
        if (filtered.length === 0) {
            return Components.createEmptyState(Components.icon('wrench', 16), '暂无工具', '没有匹配的工具', '');
        }
        return `<div class="tool-grid">${filtered.map(buildToolCard).join('')}</div>`;
    }

    // ==========================================
    // Tab 构建
    // ==========================================
    function buildTab() {
        const filtered = getFilteredTools();
        const filterTags = ['全部', ..._toolsets.filter((t) => t !== '全部')];
        const filterHtml = Components.createFilterGroup(filterTags, _activeToolFilter, 'MarketplacePage.setToolFilter');

        const searchHtml = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <div style="position:relative;flex:1">
                ${Components.icon('search', 14, 'var(--text-tertiary)', 'position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none')}
                <input type="text" id="toolSearchInput" placeholder="搜索工具名称或描述..." value="${Components.escapeHtml(_toolSearchKeyword)}" style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
            </div>
        </div>`;

        return `${filterHtml}
            ${searchHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <span class="tool-count" style="font-size:12px;color:var(--text-tertiary)">共 ${filtered.length} 个工具</span>
            </div>
            <div id="toolListContainer">${buildToolGrid(filtered)}</div>`;
    }

    function updateToolList() {
        const filtered = getFilteredTools();
        const container = document.getElementById('toolListContainer');
        if (!container) return;
        container.innerHTML = buildToolGrid(filtered);
        const countSpan = document.querySelector('#marketplace-tools .tool-count');
        if (countSpan) countSpan.textContent = `共 ${filtered.length} 个工具`;
    }

    // ==========================================
    // 工具操作（公开接口，供 register.js 转发）
    // ==========================================
    function setToolFilter(filter) {
        _activeToolFilter = filter;
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
                ${Components.renderJson(tool.schema || tool.inputSchema || tool.parameters || {})}`;
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
            const tool = _allTools.find((t) => t.name === name);
            if (tool) tool.enabled = enabled;
            updateToolList();
        } catch (err) {
            Components.Toast.error(`操作失败: ${err.message}`);
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

            // 阻止 checkbox 的 label 冒泡
            if (action === 'stopPropagation') {
                e.stopPropagation();
                return;
            }

            switch (action) {
                case 'viewTool':
                    viewTool(btn.dataset.name);
                    break;
                case 'toggleTool':
                    // checkbox change 事件单独处理
                    break;
            }
        });

        // checkbox change 事件委托
        _container.addEventListener('change', (e) => {
            if (e.target.matches('[data-action="toggleTool"]')) {
                const name = e.target.dataset.name;
                const enabled = e.target.checked;
                toggleTool(name, enabled);
            }
        });

        // 工具搜索
        const toolSearchInput = document.getElementById('toolSearchInput');
        if (toolSearchInput) {
            toolSearchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _toolSearchKeyword = e.target.value;
                    updateToolList();
                }, 300),
            );
        }
    }

    function destroy() {
        _container = null;
    }

    return { render, destroy, setToolFilter, viewTool, toggleTool };
})();

export default ToolsTab;
