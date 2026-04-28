/**
 * 工具管理页面 (Mac 极简风格)
 */

const ToolsPage = (() => {
    let _tools = [];
    let _toolsets = [];
    let _activeFilter = '全部';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [toolsData, toolsetsData] = await Promise.all([API.tools.list(), API.tools.toolsets()]);
            // 后端返回 {name, description, schema, status} 或 {name, description, toolset, enabled}
            const rawTools = toolsData.tools || toolsData || [];
            _tools = rawTools.map(t => ({
                ...t,
                enabled: t.enabled !== undefined ? t.enabled : t.status !== 'inactive',
                toolset: t.toolset || t.name.split('_')[0] || 'default',
            }));
            const rawToolsets = toolsetsData.toolsets || toolsetsData || [];
            _toolsets = rawToolsets.map(ts => typeof ts === 'string' ? ts : ts.name).filter(Boolean);
        } catch (err) {
            const mock = getMockTools();
            _tools = mock.tools;
            _toolsets = mock.toolsets;
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockTools() {
        return {
            tools: [
                { name: 'read_file', description: '读取文件内容，支持文本和图片文件', toolset: 'filesystem', enabled: true },
                { name: 'write_file', description: '写入文件到本地文件系统', toolset: 'filesystem', enabled: true },
                { name: 'edit_file', description: '使用搜索替换方式编辑文件', toolset: 'filesystem', enabled: true },
                { name: 'delete_file', description: '删除指定文件', toolset: 'filesystem', enabled: true },
                { name: 'list_directory', description: '列出目录中的文件和子目录', toolset: 'filesystem', enabled: true },
                { name: 'search_files', description: '使用 glob 模式搜索文件', toolset: 'filesystem', enabled: true },
                { name: 'grep_search', description: '使用正则表达式搜索文件内容', toolset: 'filesystem', enabled: true },
                { name: 'run_command', description: '执行 bash 命令', toolset: 'system', enabled: true },
                { name: 'web_search', description: '搜索互联网获取最新信息', toolset: 'web', enabled: true },
                { name: 'web_fetch', description: '获取指定 URL 的页面内容', toolset: 'web', enabled: true },
                { name: 'generate_image', description: '使用 AI 生成图片', toolset: 'creative', enabled: false },
                { name: 'create_document', description: '创建 Word/PDF/Excel 文档', toolset: 'creative', enabled: true },
                { name: 'manage_cron', description: '管理定时任务', toolset: 'system', enabled: true },
                { name: 'memory_read', description: '读取记忆文件内容', toolset: 'memory', enabled: true },
                { name: 'memory_write', description: '写入记忆文件', toolset: 'memory', enabled: true },
                { name: 'skill_execute', description: '执行指定技能', toolset: 'skills', enabled: true },
                { name: 'mcp_call', description: '调用 MCP 服务', toolset: 'mcp', enabled: true },
                { name: 'code_execute', description: '执行代码片段', toolset: 'system', enabled: true },
            ],
            toolsets: ['filesystem', 'system', 'web', 'creative', 'memory', 'skills', 'mcp'],
        };
    }

    function getFilteredTools() {
        if (_activeFilter === '全部') return _tools;
        return _tools.filter(t => t.toolset === _activeFilter);
    }

    function buildPage() {
        const filtered = getFilteredTools();
        const filterTags = ['全部', ..._toolsets.filter(t => t !== '全部')];
        const filterHtml = Components.createFilterGroup(filterTags, _activeFilter, 'ToolsPage.setFilter');

        const toolsHtml = filtered.length === 0
            ? Components.createEmptyState('🔧', '暂无工具', '没有匹配的工具', '')
            : `<div class="tool-grid">${filtered.map(tool => `
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
            `).join('')}</div>`;

        return `${filterHtml}
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <span style="font-size:12px;color:var(--text-tertiary)">共 ${filtered.length} 个工具</span>
            </div>
            ${toolsHtml}`;
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
            document.getElementById('modalBody').innerHTML = Components.createEmptyState('🔧', '加载失败', err.message, '');
        }
    }

    async function toggleTool(name, enabled) {
        try {
            await API.tools.toggle(name, enabled);
            Components.Toast.success(`工具 ${name} 已${enabled ? '启用' : '禁用'}`);
            const tool = _tools.find(t => t.name === name);
            if (tool) tool.enabled = enabled;
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`操作失败: ${err.message}`);
        }
    }

    function setFilter(filter) {
        _activeFilter = filter;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function bindEvents() {}

    return { render, viewTool, toggleTool, setFilter };
})();
