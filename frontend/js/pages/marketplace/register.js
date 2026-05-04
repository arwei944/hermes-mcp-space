/**
 * 统一管理页面 - 注册入口
 * V2 目录结构：register.js / page.js / MCPTab.js / MCPOperations.js / MCPConfig.js / SkillsTab.js / SkillEditor.js / SkillTemplates.js / ToolsTab.js / PluginsTab.js
 * 合并自: marketplace.js, mcp.js, skills.js, tools.js, plugins.js
 */

const MarketplacePage = (() => {
    let _modules = {};
    let _activeTab = 'mcp';
    let _data = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = (await import('./page.js')).default;
        _modules.mcpConfig = (await import('./MCPConfig.js')).default;
        _modules.mcpOperations = (await import('./MCPOperations.js')).default;
        _modules.mcpTab = (await import('./MCPTab.js')).default;
        _modules.skillTemplates = (await import('./SkillTemplates.js')).default;
        _modules.skillEditor = (await import('./SkillEditor.js')).default;
        _modules.skillsTab = (await import('./SkillsTab.js')).default;
        _modules.toolsTab = (await import('./ToolsTab.js')).default;
        _modules.pluginsTab = (await import('./PluginsTab.js')).default;
    }

    async function render(tab) {
        await _ensureModules();
        if (tab) _activeTab = tab;
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        // 并行加载所有数据
        const [mcpServers, mcpStatus, apiStatus, skills, toolsData, toolsetsData, marketData, installedData] = await Promise.all([
            API.request('/api/mcp/servers').catch(() => []),
            API.mcp.status().catch(() => ({ status: 'unknown' })),
            API.system.status().catch(() => ({ status: '降级模式', hermes_available: false })),
            API.skills.list().catch(() => []),
            API.tools.list().catch(() => []),
            API.tools.toolsets().catch(() => []),
            API.get('/api/plugins/market').catch(() => ({})),
            API.get('/api/plugins').catch(() => ({})),
        ]);

        // 获取 MCP 工具列表
        let mcpToolsList = [];
        try {
            const baseUrl = window.location.origin;
            const resp = await fetch(`${baseUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
            });
            if (resp.ok) {
                const data = await resp.json();
                mcpToolsList = data.result?.tools || [];
            }
        } catch { /* ignore */ }

        // 处理技能数据
        const skillsList = (typeof skills === 'object' && skills.skills) ? skills.skills : (Array.isArray(skills) ? skills : []);

        // 处理工具数据
        const rawTools = (typeof toolsData === 'object' && toolsData.tools) ? toolsData.tools : (Array.isArray(toolsData) ? toolsData : []);
        const allTools = rawTools.map((t) => ({
            ...t,
            enabled: t.enabled !== undefined ? t.enabled : t.status !== 'inactive',
            toolset: t.toolset || t.name.split('_')[0] || 'default',
        }));
        const rawToolsets = (typeof toolsetsData === 'object' && toolsetsData.toolsets) ? toolsetsData.toolsets : (Array.isArray(toolsetsData) ? toolsetsData : []);
        const toolsets = rawToolsets.map((ts) => (typeof ts === 'string' ? ts : ts.name)).filter(Boolean);

        // 处理插件数据
        const market = (typeof marketData === 'object' && marketData.plugins) ? marketData.plugins : [];
        const categories = (typeof marketData === 'object' && marketData.categories) ? marketData.categories : {};
        const installed = (typeof installedData === 'object' && installedData.plugins) ? installedData.plugins : [];

        _data = {
            mcpServers, mcpStatus, apiStatus, mcpTools: mcpToolsList,
            skills: skillsList,
            allTools, toolsets,
            market, categories, installed,
        };

        // 构建页面骨架
        container.innerHTML = _modules.page.buildLayout(_activeTab, {
            mcpTools: mcpToolsList.length,
            skills: skillsList.length,
            tools: allTools.length,
            plugins: market.length,
        });

        // 渲染当前 Tab
        _renderActiveTab(container);

        // 绑定页面级事件
        _bindPageEvents(container);
    }

    function _renderActiveTab(container) {
        switch (_activeTab) {
            case 'mcp':
                _modules.mcpTab.render('#marketplace-mcp', _data);
                break;
            case 'skills':
                _modules.skillsTab.render('#marketplace-skills', _data);
                break;
            case 'tools':
                _modules.toolsTab.render('#marketplace-tools', _data);
                break;
            case 'plugins':
                _modules.pluginsTab.render('#marketplace-plugins', _data);
                break;
        }
    }

    function _bindPageEvents(container) {
        // 主 Tab 切换
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="switchTab"]');
            if (!btn) return;
            const tab = btn.dataset.tab;
            if (tab === _activeTab) return;
            _activeTab = tab;

            // 隐藏所有面板，显示目标面板
            ['mcp', 'skills', 'tools', 'plugins'].forEach((key) => {
                const el = document.getElementById(`marketplace-${key}`);
                if (el) el.style.display = key === tab ? '' : 'none';
            });

            // 更新 Tab 样式
            container.querySelectorAll('.marketplace-tab').forEach((el) => {
                el.classList.toggle('active', el.dataset.tab === tab);
            });

            // 如果还没渲染过该 Tab，则渲染
            const panel = document.getElementById(`marketplace-${tab}`);
            if (panel && !panel.dataset.rendered) {
                _renderActiveTab(container);
                panel.dataset.rendered = 'true';
            }
        });
    }

    async function switchTab(tab) {
        _activeTab = tab;
        const container = document.getElementById('contentBody');
        if (!container) return;

        ['mcp', 'skills', 'tools', 'plugins'].forEach((key) => {
            const el = document.getElementById(`marketplace-${key}`);
            if (el) el.style.display = key === tab ? '' : 'none';
        });

        container.querySelectorAll('.marketplace-tab').forEach((el) => {
            el.classList.toggle('active', el.dataset.tab === tab);
        });

        const panel = document.getElementById(`marketplace-${tab}`);
        if (panel && !panel.dataset.rendered) {
            _renderActiveTab(container);
            panel.dataset.rendered = 'true';
        }
    }

    function onSSEEvent(type, data) {
        if (['skill.created', 'skill.updated', 'skill.deleted'].includes(type)) {
            _ensureModules().then(() => {
                API.skills.list().catch(() => []).then((skills) => {
                    _data.skills = (typeof skills === 'object' && skills.skills) ? skills.skills : (Array.isArray(skills) ? skills : []);
                    if (_activeTab === 'skills') {
                        _modules.skillsTab.render('#marketplace-skills', _data);
                    }
                });
            }).catch(() => {});
        }
        if (['plugin.installed', 'plugin.uninstalled'].includes(type)) {
            _ensureModules().then(() => {
                Promise.all([
                    API.get('/api/plugins/market').catch(() => ({})),
                    API.get('/api/plugins').catch(() => ({})),
                ]).then(([marketData, installedData]) => {
                    _data.market = (typeof marketData === 'object' && marketData.plugins) ? marketData.plugins : [];
                    _data.categories = (typeof marketData === 'object' && marketData.categories) ? marketData.categories : {};
                    _data.installed = (typeof installedData === 'object' && installedData.plugins) ? installedData.plugins : [];
                    if (_activeTab === 'plugins') {
                        _modules.pluginsTab.render('#marketplace-plugins', _data);
                    }
                });
            }).catch(() => {});
        }
    }

    /** 供 ToolsTab 调用的公开接口 */
    function setToolFilter(filter) {
        _ensureModules().then(() => _modules.toolsTab.setToolFilter(filter)).catch(() => {});
    }

    function viewTool(name) {
        _ensureModules().then(() => _modules.toolsTab.viewTool(name)).catch(() => {});
    }

    function toggleTool(name, enabled) {
        _ensureModules().then(() => _modules.toolsTab.toggleTool(name, enabled)).catch(() => {});
    }

    function destroy() {
        Object.values(_modules).forEach((m) => m.destroy?.());
        _modules = {};
    }

    return { render, switchTab, onSSEEvent, setToolFilter, viewTool, toggleTool, destroy };
})();

window.MarketplacePage = ErrorHandler.wrap(MarketplacePage);
