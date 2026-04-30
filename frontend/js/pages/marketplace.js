/**
 * 统一管理页面 - MCP 服务 / 技能 / 工具 / 插件市场 四合一
 * 合并自: marketplace.js, mcp.js, skills.js, tools.js, plugins.js
 */

const MarketplacePage = (() => {
    // ==========================================
    // 状态变量
    // ==========================================
    let _activeTab = 'mcp'; // mcp | skills | tools | plugins

    // MCP 相关
    let _mcpServers = [];
    let _mcpStatus = null;
    let _apiStatus = null;
    let _mcpTools = [];
    let _mcpTestResult = null;
    let _configTab = 'trae'; // trae | claude | vscode | cursor | prompt

    // 技能相关
    let _skills = [];
    let _currentSkill = null;
    let _editorContent = '';
    let _showEditor = false;
    let _isCreating = false;
    let _skillSearchKeyword = '';
    let _skillCategoryFilter = '';

    // 工具相关
    let _allTools = [];
    let _localTools = [];
    let _externalTools = [];
    let _toolsets = [];
    let _activeToolFilter = '全部';
    let _toolSearchKeyword = '';

    // 插件相关
    let _market = [];
    let _installed = [];
    let _categories = {};
    let _filterType = '';
    let _filterCategory = '';
    let _pluginKeyword = '';
    let _pluginTab = 'market'; // market | installed

    // ==========================================
    // 渲染入口
    // ==========================================
    async function render(tab) {
        if (tab) _activeTab = tab;
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        await Promise.all([loadMCPServers(), loadSkills(), loadTools(), loadMCPStatus(), loadPlugins()]);

        container.innerHTML = buildPage();
        bindEvents();
    }

    // ==========================================
    // 数据加载
    // ==========================================
    async function loadMCPServers() {
        try {
            _mcpServers = await API.request('/api/mcp/servers');
        } catch {
            _mcpServers = [];
        }
    }

    async function loadMCPStatus() {
        try {
            const [statusData, apiStatus] = await Promise.all([API.mcp.status(), API.system.status()]);
            _mcpStatus = statusData;
            _apiStatus = apiStatus;
        } catch {
            _mcpStatus = { status: 'unknown' };
            _apiStatus = { status: '降级模式', hermes_available: false };
        }
        try {
            const baseUrl = window.location.origin;
            const resp = await fetch(`${baseUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
            });
            if (resp.ok) {
                const data = await resp.json();
                _mcpTools = data.result?.tools || [];
            }
        } catch {
            _mcpTools = [];
        }
    }

    async function loadSkills() {
        try {
            const data = await API.skills.list();
            _skills = data.skills || data || [];
        } catch {
            _skills = [];
        }
    }

    async function loadTools() {
        try {
            const [toolsData, toolsetsData] = await Promise.all([API.tools.list(), API.tools.toolsets()]);
            const rawTools = toolsData.tools || toolsData || [];
            _allTools = rawTools.map((t) => ({
                ...t,
                enabled: t.enabled !== undefined ? t.enabled : t.status !== 'inactive',
                toolset: t.toolset || t.name.split('_')[0] || 'default',
            }));
            const rawToolsets = toolsetsData.toolsets || toolsetsData || [];
            _toolsets = rawToolsets.map((ts) => (typeof ts === 'string' ? ts : ts.name)).filter(Boolean);
            _localTools = _allTools.filter((t) => !t.name.startsWith('mcp_'));
            _externalTools = _allTools.filter((t) => t.name.startsWith('mcp_'));
        } catch {
            _allTools = [];
            _localTools = [];
            _externalTools = [];
            _toolsets = [];
        }
    }

    async function loadPlugins() {
        try {
            const [marketData, installedData] = await Promise.all([
                API.request('GET', '/api/plugins/market'),
                API.request('GET', '/api/plugins'),
            ]);
            _market = marketData.plugins || [];
            _categories = marketData.categories || {};
            _installed = installedData.plugins || [];
        } catch {
            _market = [];
            _installed = [];
            _categories = {};
        }
    }

    // ==========================================
    // 页面构建 - 主框架
    // ==========================================
    function buildPage() {
        const tabs = [
            { key: 'mcp', label: 'MCP服务', icon: Components.icon('plug', 14), count: _mcpTools.length },
            { key: 'skills', label: '技能', icon: Components.icon('zap', 16), count: _skills.length },
            { key: 'tools', label: '工具', icon: Components.icon('wrench', 16), count: _allTools.length },
            { key: 'plugins', label: '插件市场', icon: Components.icon('puzzle', 16), count: _market.length },
        ];

        const tabHtml = `<div class="marketplace-tabs">
            ${tabs
                .map(
                    (t) => `
                <button type="button" class="marketplace-tab ${_activeTab === t.key ? 'active' : ''}" data-action="switchTab" data-tab="${t.key}">
                    <span>${t.icon}</span>
                    <span>${t.label}</span>
                    <span class="tab-count">${t.count}</span>
                </button>
            `,
                )
                .join('')}
        </div>`;

        let contentHtml = '';
        if (_activeTab === 'mcp') contentHtml = buildMCPTab();
        else if (_activeTab === 'skills') contentHtml = buildSkillsTab();
        else if (_activeTab === 'tools') contentHtml = buildToolsTab();
        else if (_activeTab === 'plugins') contentHtml = buildPluginsTab();

        return `${tabHtml}<div class="marketplace-content">${contentHtml}</div>`;
    }

    // ==========================================
    // Tab 1: MCP 服务
    // ==========================================
    function buildMCPTab() {
        const s = _mcpStatus || {};
        const api = _apiStatus || {};
        const isOnline = s.status === 'running';
        const hermesOk = api.hermes_available === true;
        const baseUrl = window.location.origin;
        const configs = getConfigs();

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('MCP 服务状态', isOnline ? '运行中' : '未运行', isOnline ? '服务正常' : '服务未启动', Components.icon('plug', 16), isOnline ? 'green' : 'red')}
            ${Components.renderStatCard('Hermes 主程序', hermesOk ? '已连接' : '未连接', hermesOk ? '数据实时同步' : '使用降级数据', Components.icon('bot', 16), hermesOk ? 'green' : 'orange')}
            ${Components.renderStatCard('暴露工具数', _mcpTools.length + ' 个', 'MCP 协议可用', Components.icon('wrench', 16), 'blue')}
            ${Components.renderStatCard('后端状态', api.status === 'ok' ? '正常' : '降级', api.status || '-', Components.icon('radio', 16), api.status === 'ok' ? 'green' : 'orange')}
        </div>`;

        // 操作按钮
        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:8px">
            <button type="button" class="btn btn-secondary" data-action="testConnection">测试 MCP 连接</button>
            <button type="button" class="btn btn-secondary" data-action="restartService">重启 MCP 服务</button>
        </div>`;

        // MCP 测试结果
        const testResultHtml = _mcpTestResult
            ? `<div style="margin-bottom:16px;padding:12px 16px;border-radius:var(--radius-sm);background:${_mcpTestResult.ok ? 'var(--green-bg)' : 'var(--red-bg)'};border:1px solid ${_mcpTestResult.ok ? 'var(--green)' : 'var(--red)'}">
                <div style="font-size:13px;font-weight:600;color:${_mcpTestResult.ok ? 'var(--green)' : 'var(--red)'}">${_mcpTestResult.ok ? 'MCP 连接正常' : 'MCP 连接失败'}</div>
                ${_mcpTestResult.detail ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${Components.escapeHtml(_mcpTestResult.detail)}</div>` : ''}
            </div>`
            : '';

        // MCP 暴露工具表
        const toolsHtml = Components.renderSection(
            'MCP 暴露的工具',
            `<table class="table">
                <thead><tr><th>工具名称</th><th>描述</th></tr></thead>
                <tbody>
                    ${_mcpTools.length === 0
                        ? `<tr><td colspan="2" style="text-align:center;padding:40px;color:var(--text-tertiary)">没有暴露的工具</td></tr>`
                        : _mcpTools
                              .map(
                                  (t) => `<tr>
                        <td class="mono" style="color:var(--accent)">${Components.escapeHtml(t.name)}</td>
                        <td>${Components.escapeHtml(t.description || '无描述')}</td>
                    </tr>`,
                              )
                              .join('')
                    }
                </tbody>
            </table>`,
        );

        // 配置子 Tab
        const configTabKeys = Object.keys(configs);
        const configTabHtml = `<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
            ${configTabKeys
                .map(
                    (k) => `<button type="button" class="btn btn-sm ${_configTab === k ? 'btn-primary' : 'btn-ghost'}" data-action="switchConfigTab" data-tab="${k}">${configs[k].icon} ${configs[k].label}</button>`,
                )
                .join('')}
            <button type="button" class="btn btn-sm ${_configTab === 'prompt' ? 'btn-primary' : 'btn-ghost'}" data-action="switchConfigTab" data-tab="prompt">${Components.icon('clipboard', 14)} System Prompt</button>
        </div>`;

        // 配置内容区
        let configContentHtml = '';
        if (_configTab === 'prompt') {
            const prompt = getSystemPrompt();
            configContentHtml = Components.renderSection(
                'System Prompt 模板',
                `<p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">将以下内容添加到 Trae / Claude / Cursor 的 System Prompt 或自定义指令中：</p>
                <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                    <button type="button" class="btn btn-sm btn-ghost" data-action="copyPrompt">${Components.icon('clipboard', 14)} 复制 Prompt</button>
                </div>
                <div class="schema-display" id="systemPromptDisplay" style="white-space:pre-wrap;font-size:13px;line-height:1.7">${Components.escapeHtml(prompt)}</div>`,
            );
        } else {
            const cfg = configs[_configTab];
            if (cfg) {
                configContentHtml = Components.renderSection(
                    `${cfg.icon} ${cfg.label} 配置`,
                    `<p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">${cfg.description}</p>
                    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                        <button type="button" class="btn btn-sm btn-ghost" data-action="copyConfig">${Components.icon('clipboard', 14)} 复制配置</button>
                    </div>
                    <div class="schema-display" id="configDisplay">${Components.escapeHtml(cfg.config)}</div>
                    <div style="margin-top:16px">
                        <div style="font-size:13px;font-weight:600;margin-bottom:8px">配置步骤</div>
                        <ol style="margin:0;padding-left:20px;font-size:12px;color:var(--text-secondary);line-height:2">
                            ${cfg.steps.map((st) => `<li>${st}</li>`).join('')}
                        </ol>
                    </div>`,
                );
            }
        }

        // 服务端点信息
        const endpointHtml = Components.renderSection(
            '服务端点',
            `<div class="connection-info">
                <div><span class="info-label">Streamable HTTP:</span><span class="info-value mono">${baseUrl}/mcp</span></div>
                <div><span class="info-label">SSE (兼容):</span><span class="info-value mono">${baseUrl}/sse</span></div>
                <div><span class="info-label">协议版本:</span><span class="info-value">MCP 2025-03-26</span></div>
                <div><span class="info-label">Hermes 可用:</span><span class="info-value">${hermesOk ? '是' : '否（使用降级数据）'}</span></div>
            </div>`,
        );

        // 外部 MCP 服务器管理
        const addFormHtml = `<div class="mp-card" style="margin-bottom:16px">
            <div style="font-weight:600;margin-bottom:12px">添加外部 MCP 服务器</div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <input type="text" id="mcpServerName" placeholder="名称（如 github）" style="flex:1;min-width:120px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                <input type="text" id="mcpServerUrl" placeholder="MCP URL（如 http://localhost:3001/mcp）" style="flex:2;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                <input type="text" id="mcpServerPrefix" placeholder="前缀（可选，默认 mcp_{name}_）" style="flex:1;min-width:140px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                <button type="button" class="btn btn-primary" data-action="addMCPServer">添加</button>
            </div>
        </div>`;

        const serverListHtml =
            _mcpServers.length === 0
                ? `<div style="text-align:center;padding:40px;color:var(--text-tertiary)">
                    <div style="font-size:32px;margin-bottom:8px">${Components.icon('globe', 32)}</div>
                    <div>暂无外部 MCP 服务器</div>
                    <div style="font-size:12px;margin-top:4px">添加外部服务器后，其工具将自动聚合到工具列表</div>
                  </div>`
                : `<div class="mp-server-list">
                    ${_mcpServers
                        .map(
                            (sv) => `
                        <div class="mp-server-card">
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <div>
                                    <div style="font-weight:600;font-size:14px">${Components.escapeHtml(sv.name)}</div>
                                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${Components.escapeHtml(sv.url)}</div>
                                </div>
                                <div style="display:flex;gap:6px;align-items:center">
                                    ${Components.renderBadge(sv.status === 'connected' ? '已连接' : sv.status || '未知', sv.status === 'connected' ? 'green' : 'orange')}
                                    <span style="font-size:11px;color:var(--text-tertiary)">${sv.tools_count || 0} 工具</span>
                                    <button type="button" class="btn btn-sm btn-ghost" data-action="refreshMCPServer" data-name="${Components.escapeHtml(sv.name)}">刷新</button>
                                    <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="removeMCPServer" data-name="${Components.escapeHtml(sv.name)}">删除</button>
                                </div>
                            </div>
                            ${sv.prefix ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">前缀: <code style="background:var(--bg-secondary);padding:1px 4px;border-radius:var(--radius-tag)">${Components.escapeHtml(sv.prefix)}</code></div>` : ''}
                            ${sv.last_check ? `<div style="font-size:11px;color:var(--text-tertiary)">最后检查: ${sv.last_check}</div>` : ''}
                        </div>
                    `,
                        )
                        .join('')}
                </div>`;

        const externalSectionHtml = Components.renderSection('外部 MCP 服务器', addFormHtml + serverListHtml);

        return `${statsHtml}${actionsHtml}${testResultHtml}${toolsHtml}
            ${Components.renderSection('连接配置', `${configTabHtml}${configContentHtml}`)}
            ${endpointHtml}
            ${externalSectionHtml}`;
    }

    // ==========================================
    // MCP 配置生成器
    // ==========================================
    function getConfigs() {
        const baseUrl = window.location.origin;
        return {
            trae: {
                label: 'Trae',
                icon: Components.icon('zap', 16),
                description: 'Trae IDE 内置 MCP 客户端',
                config: JSON.stringify({ mcpServers: { hermes: { url: `${baseUrl}/mcp` } } }, null, 2),
                steps: ['打开 Trae → 设置 → MCP', '点击「添加 MCP Server」', '粘贴上方 JSON 配置', '重启 Trae 使配置生效'],
            },
            claude: {
                label: 'Claude Desktop',
                icon: Components.icon('bot', 16),
                description: 'Claude 桌面版 MCP 客户端',
                config: JSON.stringify({ mcpServers: { hermes: { url: `${baseUrl}/mcp`, type: 'streamable-http' } } }, null, 2),
                steps: ['打开 Claude Desktop 配置文件', '路径: ~/Library/Application Support/Claude/claude_desktop_config.json', '粘贴上方 JSON 配置', '重启 Claude Desktop'],
            },
            vscode: {
                label: 'VS Code (Copilot)',
                icon: Components.icon('monitor', 16),
                description: 'VS Code + GitHub Copilot MCP',
                config: JSON.stringify({ servers: { hermes: { url: `${baseUrl}/mcp`, type: 'streamable-http' } } }, null, 2),
                steps: ['打开 VS Code 设置 (JSON)', '添加 mcp.servers 配置', '粘贴上方 JSON 配置', '重新加载窗口'],
            },
            cursor: {
                label: 'Cursor',
                icon: Components.icon('monitor', 16),
                description: 'Cursor IDE MCP 客户端',
                config: JSON.stringify({ mcpServers: { hermes: { url: `${baseUrl}/mcp` } } }, null, 2),
                steps: ['打开 Cursor → Settings → MCP', '点击「Add MCP Server」', '粘贴上方 JSON 配置', '重启 Cursor'],
            },
        };
    }

    function getSystemPrompt() {
        return `你连接了 Hermes Agent MCP 服务。每次对话时请遵循以下规则：

1. 新话题开始时，调用 create_session 创建会话：
   - title: 话题摘要（简洁明了）
   - source: "trae"（或其他客户端名称）

2. 用户发消息后，调用 log_conversation 记录：
   - role: "user"
   - content: 用户消息原文
   - session_id: 当前会话ID

3. 你回复后，调用 log_conversation 记录：
   - role: "assistant"
   - content: 回复摘要（精简到 2-3 句，保留关键信息）
   - session_id: 当前会话ID

4. 遇到以下重要信息时，调用 write_memory 更新记忆：
   - 用户偏好（语言、框架、工具）
   - 项目信息（名称、技术栈、架构）
   - 重要决策（方案选择、设计约定）
   - 错误解决方案（bug 和修复方法）
   - 待办事项（用户提到的后续任务）

5. MCP 调用失败时静默忽略，不影响正常对话流程。`;
    }

    // ==========================================
    // MCP 操作
    // ==========================================
    async function testConnection() {
        Components.Toast.info('正在测试 MCP 连接...');
        try {
            const baseUrl = window.location.origin;
            const resp = await fetch(`${baseUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'initialize',
                    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } },
                }),
            });
            if (resp.ok) {
                const data = await resp.json();
                const serverInfo = data.result?.serverInfo || {};
                _mcpTestResult = {
                    ok: true,
                    detail: `服务器: ${serverInfo.name || 'Hermes Agent'} v${serverInfo.version || '?'}，协议: ${data.result?.protocolVersion || '?'}，${_mcpTools.length} 个工具可用`,
                };
                Components.Toast.success('MCP 连接正常');
            } else {
                _mcpTestResult = { ok: false, detail: `HTTP ${resp.status}: ${resp.statusText}` };
                Components.Toast.error('MCP 连接失败');
            }
        } catch (err) {
            _mcpTestResult = { ok: false, detail: err.message };
            Components.Toast.error(`连接失败: ${err.message}`);
        }
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    async function restartService() {
        const ok = await Components.Modal.confirm({
            title: '重启 MCP 服务',
            message: '确定要重启 MCP 服务吗？重启期间服务将暂时不可用。',
            confirmText: '重启',
            type: 'warning',
        });
        if (!ok) return;
        try {
            Components.Toast.info('正在重启 MCP 服务...');
            await API.mcp.restart();
            Components.Toast.success('MCP 服务已重启');
            render();
        } catch (err) {
            Components.Toast.error(`重启失败: ${err.message}`);
        }
    }

    function copyConfig() {
        const el = document.getElementById('configDisplay');
        if (!el) return;
        copyText(el.textContent);
    }

    function copyPrompt() {
        const el = document.getElementById('systemPromptDisplay');
        if (!el) return;
        copyText(el.textContent);
    }

    function copyText(text) {
        navigator.clipboard
            .writeText(text)
            .then(() => Components.Toast.success('已复制到剪贴板'))
            .catch(() => {
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand('copy');
                document.body.removeChild(textarea);
                Components.Toast.success('已复制到剪贴板');
            });
    }

    async function addMCPServer() {
        const name = document.getElementById('mcpServerName')?.value.trim();
        const url = document.getElementById('mcpServerUrl')?.value.trim();
        const prefix = document.getElementById('mcpServerPrefix')?.value.trim();
        if (!name || !url) {
            Components.Toast.error('名称和 URL 不能为空');
            return;
        }
        Components.Toast.info('正在连接...');
        try {
            const resp = await API.request('/api/mcp/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, prefix }),
            });
            Components.Toast.success(resp.message || '添加成功');
            await loadMCPServers();
            await loadTools();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`添加失败: ${err.message}`);
        }
    }

    async function removeMCPServer(name) {
        const ok = await Components.Modal.confirm({
            title: '删除 MCP 服务器',
            message: `确定要删除 MCP 服务器「${name}」吗？该服务器提供的所有工具将被移除。`,
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;
        try {
            await API.request(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' });
            Components.Toast.success(`已移除 ${name}`);
            await loadMCPServers();
            await loadTools();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`移除失败: ${err.message}`);
        }
    }

    async function refreshMCPServer(name) {
        Components.Toast.info('正在刷新...');
        try {
            await API.request(`/api/mcp/servers/${encodeURIComponent(name)}/refresh`, { method: 'POST' });
            Components.Toast.success(`${name} 已刷新`);
            await loadMCPServers();
            await loadTools();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`刷新失败: ${err.message}`);
        }
    }

    // ==========================================
    // Tab 2: 技能
    // ==========================================

    // 内置技能模板库
    const SKILL_TEMPLATES = [
        { name: 'batch-rename', category: '文件操作', description: '批量重命名文件', content: '# 批量重命名\n\n## 描述\n批量重命名指定目录下的文件，支持正则表达式匹配。\n\n## 使用方法\n1. 指定目标目录\n2. 设置匹配规则（正则表达式）\n3. 设置替换模板\n4. 预览变更后确认执行\n\n## 参数\n- `directory`: 目标目录路径\n- `pattern`: 文件名匹配模式\n- `replacement`: 替换模板\n- `dry_run`: 预览模式（默认 true）\n\n## 注意事项\n- 建议先使用 dry_run 预览\n- 操作不可撤销，请确保有备份' },
        { name: 'log-analyzer', category: '文件操作', description: '日志分析工具', content: '# 日志分析\n\n## 描述\n分析日志文件，提取关键信息、统计错误和警告。\n\n## 功能\n- 按时间范围过滤\n- 错误/警告级别统计\n- 频率 Top N 分析\n- 正则模式匹配\n\n## 使用方法\n1. 指定日志文件路径\n2. 设置过滤条件\n3. 查看分析报告' },
        { name: 'web-monitor', category: 'Web 操作', description: '网页内容监控', content: '# 网页监控\n\n## 描述\n定期检查网页内容变化，发现更新时发送通知。\n\n## 配置\n- `url`: 监控的网页地址\n- `selector`: CSS 选择器（可选）\n- `interval`: 检查间隔（分钟）\n- `keyword`: 关键词过滤（可选）' },
        { name: 'api-tester', category: 'Web 操作', description: 'API 接口测试', content: '# API 测试\n\n## 描述\n快速测试 REST API 接口，支持多种 HTTP 方法。\n\n## 功能\n- GET/POST/PUT/DELETE 请求\n- 自定义 Headers\n- JSON Body 编辑\n- 响应格式化展示\n- 请求历史记录' },
        { name: 'csv-processor', category: '数据处理', description: 'CSV 数据处理', content: '# CSV 处理\n\n## 描述\n读取、过滤、转换和导出 CSV 数据。\n\n## 功能\n- 读取 CSV/TSV 文件\n- 列过滤和排序\n- 数据清洗（去重、空值处理）\n- 格式转换（CSV ↔ JSON）\n- 聚合统计' },
        { name: 'json-formatter', category: '数据处理', description: 'JSON 格式化工具', content: '# JSON 格式化\n\n## 描述\n格式化、验证和转换 JSON 数据。\n\n## 功能\n- 美化/压缩 JSON\n- JSON Schema 验证\n- JSON ↔ YAML 转换\n- JSON Path 查询\n- Diff 对比' },
        { name: 'health-check', category: '系统管理', description: '系统健康检查', content: '# 系统健康检查\n\n## 描述\n检查系统运行状态，包括 CPU、内存、磁盘、网络等。\n\n## 检查项\n- CPU 使用率\n- 内存使用情况\n- 磁盘空间\n- 网络连通性\n- 进程状态\n- 服务可用性' },
        { name: 'backup-manager', category: '系统管理', description: '备份管理工具', content: '# 备份管理\n\n## 描述\n管理文件和数据库的备份任务。\n\n## 功能\n- 创建备份任务\n- 定时自动备份\n- 备份版本管理\n- 一键恢复\n- 备份空间清理' },
    ];

    function getSkillCategories() {
        const categories = new Set(_skills.map((s) => s.category || '未分类').filter(Boolean));
        SKILL_TEMPLATES.forEach((t) => categories.add(t.category));
        return Array.from(categories).sort();
    }

    function getFilteredSkills() {
        let result = _skills;
        if (_skillCategoryFilter) {
            result = result.filter((s) => (s.category || '未分类') === _skillCategoryFilter);
        }
        if (!_skillSearchKeyword) return result;
        const kw = _skillSearchKeyword.toLowerCase();
        return result.filter(
            (s) => (s.name || '').toLowerCase().includes(kw) || (s.description || '').toLowerCase().includes(kw),
        );
    }

    function buildSkillsTab() {
        const categories = getSkillCategories();
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('技能总数', _skills.length, '', Components.icon('zap', 16), 'purple')}
            ${Components.renderStatCard('已激活', _skills.filter((s) => s.status !== 'disabled').length, '', Components.icon('check', 14), 'green')}
            ${Components.renderStatCard('分类数', categories.length, '', Components.icon('package', 14), 'blue')}
        </div>`;

        const actionsHtml = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
            <button type="button" class="btn btn-ghost" data-action="showTemplateLibrary">从模板创建</button>
            <button type="button" class="btn btn-primary" data-action="showCreate">创建技能</button>
        </div>`;

        const filterHtml = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <div style="position:relative;flex:1">
                ${Components.icon('search', 14, 'var(--text-tertiary)', 'position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none')}
                <input type="text" id="skillSearchInput" placeholder="搜索技能名称或描述..." value="${Components.escapeHtml(_skillSearchKeyword)}" style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
            </div>
            <select id="skillCategoryFilter" style="padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text);min-width:100px">
                <option value="">全部分类</option>
                ${categories.map((c) => `<option value="${c}" ${_skillCategoryFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
        </div>`;

        const editorHtml = _showEditor ? buildEditor() : '';
        const skillsHtml = buildSkillsTable();

        return `${statsHtml}${actionsHtml}${filterHtml}${editorHtml}<div id="skillListContainer">${skillsHtml}</div>`;
    }

    function buildSkillsTable() {
        const filtered = getFilteredSkills();
        if (filtered.length === 0) {
            return Components.createEmptyState(
                Components.icon('zap', 16),
                '暂无技能',
                _skillSearchKeyword ? '没有匹配的技能' : '点击「创建技能」添加第一个技能',
                '',
            );
        }
        return `<div class="table-wrapper"><table class="table">
                <thead><tr><th>名称</th><th>描述</th><th>标签</th><th>操作</th></tr></thead>
                <tbody>
                    ${filtered
                        .map(
                            (s) => `<tr>
                        <td class="mono" style="color:var(--accent);font-weight:500">${Components.escapeHtml(s.name || '-')}</td>
                        <td style="font-size:12px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.description || '-')}</td>
                        <td>${(s.tags || []).map((t) => Components.renderBadge(t, 'blue')).join(' ') || '-'}</td>
                        <td>
                            <div style="display:flex;gap:4px">
                                <button type="button" class="btn btn-sm btn-ghost" data-action="viewSkill" data-name="${Components.escapeHtml(s.name)}" title="查看">${Components.icon('eye', 14)}</button>
                                <button type="button" class="btn btn-sm btn-ghost" data-action="editSkill" data-name="${Components.escapeHtml(s.name)}" title="编辑">${Components.icon('edit', 14)}</button>
                                <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteSkill" data-name="${Components.escapeHtml(s.name)}" title="删除">${Components.icon('trash', 16)}</button>
                            </div>
                        </td>
                    </tr>`,
                        )
                        .join('')}
                </tbody>
            </table></div>`;
    }

    function updateSkillList() {
        const container = document.getElementById('skillListContainer');
        if (!container) return;
        container.innerHTML = buildSkillsTable();
    }

    function buildEditor() {
        const title = _isCreating ? '创建技能' : _currentSkill ? `编辑: ${_currentSkill}` : '编辑技能';
        return `<div class="modal-overlay" data-action="hideEditor">
            <div class="modal" style="max-width:800px;width:90%" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button type="button" class="modal-close" data-action="hideEditor">${Components.icon('x', 14)}</button>
                </div>
                <div class="modal-body">
                    ${_isCreating ? Components.formGroup('技能名称', `<input class="form-input" id="skillName" placeholder="例如: my-skill">`, '英文、数字、下划线') : ''}
                    ${Components.formGroup('描述', `<input class="form-input" id="skillDesc" placeholder="技能描述" value="${Components.escapeHtml(_currentSkill?.description || '')}">`)}
                    ${Components.formGroup('标签', `<input class="form-input" id="skillTags" placeholder="例如: 开发, 工具" value="${Components.escapeHtml((_currentSkill?.tags || []).join(', '))}">`, '逗号分隔')}
                    ${Components.formGroup(
                        '内容',
                        `<div style="display:flex;gap:8px;margin-bottom:8px">
                            <button type="button" class="btn btn-sm btn-ghost" data-action="previewContent">预览</button>
                            <button type="button" class="btn btn-sm btn-ghost" data-action="insertTemplate">插入模板</button>
                        </div>
                        <textarea class="form-input" id="skillContent" rows="12" placeholder="# 技能说明\n\n描述该技能的功能和使用方法..." style="font-family:var(--mono-font, monospace);font-size:13px">${Components.escapeHtml(_editorContent)}</textarea>`,
                    )}
                    <div id="skillPreview" style="display:none;margin-top:12px;padding:16px;border-radius:var(--radius-sm);background:var(--surface-secondary);border:1px solid var(--border)">
                        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">预览</div>
                        <div class="markdown-body" id="skillPreviewContent"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" data-action="hideEditor">取消</button>
                    <button type="button" class="btn btn-primary" data-action="saveSkill">保存</button>
                </div>
            </div>
        </div>`;
    }

    function showCreate() {
        _isCreating = true;
        _currentSkill = null;
        _editorContent = '';
        _showEditor = true;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    async function editSkill(name) {
        try {
            const data = await API.skills.content(name);
            _currentSkill = name;
            _editorContent = typeof data === 'string' ? data : data.content || '';
            _isCreating = false;
            _showEditor = true;
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`加载失败: ${err.message}`);
        }
    }

    async function viewSkill(name) {
        try {
            const data = await API.skills.content(name);
            const content = typeof data === 'string' ? data : data.content || '';
            _currentSkill = name;
            _editorContent = content;
            _isCreating = false;
            _showEditor = true;
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`加载失败: ${err.message}`);
        }
    }

    function hideEditor() {
        _showEditor = false;
        _currentSkill = null;
        _editorContent = '';
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function previewContent() {
        const textarea = document.getElementById('skillContent');
        const preview = document.getElementById('skillPreview');
        const previewContent = document.getElementById('skillPreviewContent');
        if (textarea && preview && previewContent) {
            previewContent.innerHTML = Components.renderMarkdown(textarea.value);
            preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
        }
    }

    function insertTemplate() {
        const textarea = document.getElementById('skillContent');
        if (textarea) {
            textarea.value = `# 技能名称

## 描述
描述该技能的功能和用途。

## 使用方法
1. 步骤一
2. 步骤二
3. 步骤三

## 注意事项
- 注意事项一
- 注意事项二

## 示例
\`\`\`
示例代码或命令
\`\`\`
`;
        }
    }

    /** 显示模板库 Modal */
    function showTemplateLibrary() {
        const categories = [...new Set(SKILL_TEMPLATES.map((t) => t.category))].sort();
        const modalHtml = `<div class="modal-overlay" data-action="hideTemplateLibrary">
            <div class="modal" style="max-width:700px;width:90%;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>技能模板库</h3>
                    <button type="button" class="modal-close" data-action="hideTemplateLibrary">${Components.icon('x', 14)}</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">选择一个模板快速创建技能，内容将预填到编辑器中。</p>
                    ${categories
                        .map(
                            (cat) => `<div style="margin-bottom:16px">
                                <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary)">${Components.escapeHtml(cat)}</h4>
                                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
                                    ${SKILL_TEMPLATES.filter((t) => t.category === cat)
                                        .map(
                                            (t) => `<div class="template-card" data-action="useTemplate" data-template="${Components.escapeHtml(t.name)}" style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;transition:border-color 0.2s">
                                            <div style="font-weight:500;font-size:13px;margin-bottom:4px">${Components.escapeHtml(t.name)}</div>
                                            <div style="font-size:11px;color:var(--text-tertiary)">${Components.escapeHtml(t.description)}</div>
                                        </div>`,
                                        )
                                        .join('')}
                                </div>
                            </div>`,
                        )
                        .join('')}
                </div>
            </div>
        </div>`;
        // 插入到页面
        const container = document.getElementById('contentBody');
        if (container) {
            const div = document.createElement('div');
            div.id = 'templateLibraryModal';
            div.innerHTML = modalHtml;
            container.appendChild(div);
        }
    }

    function hideTemplateLibrary() {
        const modal = document.getElementById('templateLibraryModal');
        if (modal) modal.remove();
    }

    /** 使用模板创建技能 */
    function useTemplate(templateName) {
        const template = SKILL_TEMPLATES.find((t) => t.name === templateName);
        if (!template) return;
        hideTemplateLibrary();
        _isCreating = true;
        _currentSkill = null;
        _editorContent = template.content;
        _showEditor = true;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
        // 预填名称
        const nameInput = document.getElementById('skillName');
        if (nameInput) nameInput.value = template.name;
        const descInput = document.getElementById('skillDesc');
        if (descInput) descInput.value = template.description;
        const tagsInput = document.getElementById('skillTags');
        if (tagsInput) tagsInput.value = template.category;
    }

    async function saveSkill() {
        const content = document.getElementById('skillContent')?.value || '';
        const desc = document.getElementById('skillDesc')?.value || '';
        try {
            if (_isCreating) {
                const name = document.getElementById('skillName')?.value.trim();
                if (!name) {
                    Components.Toast.error('请填写技能名称');
                    return;
                }
                const tags = (document.getElementById('skillTags')?.value || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                await API.skills.create({ name, content, description: desc, tags });
                Components.Toast.success('技能已创建');
            } else {
                await API.skills.update(_currentSkill, { content, description: desc });
                Components.Toast.success('技能已更新');
            }
            _showEditor = false;
            await render();
        } catch (err) {
            Components.Toast.error(`保存失败: ${err.message}`);
        }
    }

    async function deleteSkill(name) {
        const ok = await Components.Modal.confirm({
            title: '删除技能',
            message: `确定要删除技能「${name}」吗？删除后可在回收站恢复。`,
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;
        try {
            let skillData = '';
            try {
                const data = await API.skills.content(name);
                skillData = typeof data === 'string' ? data : data.content || '';
            } catch (_e) { /* ignore */ }
            await API.skills.delete(name);
            try {
                await API.request('POST', '/api/trash', {
                    type: 'skill',
                    item_id: name,
                    item_name: name,
                    data: skillData,
                    metadata: { description: '' },
                });
            } catch (_e) { /* ignore */ }
            Components.Toast.success('技能已删除（可在回收站恢复）');
            await render();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    // ==========================================
    // Tab 3: 工具
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

    function buildToolsTab() {
        const filtered = getFilteredTools();
        const filterTags = ['全部', ..._toolsets.filter((t) => t !== '全部')];
        const filterHtml = Components.createFilterGroup(filterTags, _activeToolFilter, 'MarketplacePage.setToolFilter');

        const searchHtml = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <div style="position:relative;flex:1">
                ${Components.icon('search', 14, 'var(--text-tertiary)', 'position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none')}
                <input type="text" id="toolSearchInput" placeholder="搜索工具名称或描述..." value="${Components.escapeHtml(_toolSearchKeyword)}" style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
            </div>
        </div>`;

        const toolsHtml =
            filtered.length === 0
                ? Components.createEmptyState(Components.icon('wrench', 16), '暂无工具', '没有匹配的工具', '')
                : `<div class="tool-grid">${filtered
                      .map(
                          (tool) => `
                <div class="tool-card">
                    <div class="tool-card-header" style="cursor:pointer" onclick="MarketplacePage.viewTool('${Components.escapeHtml(tool.name)}')">
                        <span class="tool-name">${Components.escapeHtml(tool.name)}</span>
                        <label style="cursor:pointer;margin:0" onclick="event.stopPropagation()">
                            <input type="checkbox" ${tool.enabled ? 'checked' : ''} onchange="MarketplacePage.toggleTool('${Components.escapeHtml(tool.name)}', this.checked)" style="margin-right:4px;accent-color:var(--accent)">
                            <span style="font-size:11px;color:var(--text-tertiary)">${tool.enabled ? '启用' : '禁用'}</span>
                        </label>
                    </div>
                    <div class="tool-desc" style="cursor:pointer" onclick="MarketplacePage.viewTool('${Components.escapeHtml(tool.name)}')">${Components.escapeHtml(tool.description || '无描述')}</div>
                    <div class="tool-card-meta">
                        ${Components.renderBadge(tool.toolset || 'default', 'blue')}
                        <button class="btn btn-sm btn-ghost" onclick="MarketplacePage.viewTool('${Components.escapeHtml(tool.name)}')" style="margin-left:auto">详情</button>
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
        const container = document.getElementById('toolListContainer');
        if (!container) return;

        const toolsHtml =
            filtered.length === 0
                ? Components.createEmptyState(Components.icon('wrench', 16), '暂无工具', '没有匹配的工具', '')
                : `<div class="tool-grid">${filtered
                      .map(
                          (tool) => `
                <div class="tool-card">
                    <div class="tool-card-header" style="cursor:pointer" onclick="MarketplacePage.viewTool('${Components.escapeHtml(tool.name)}')">
                        <span class="tool-name">${Components.escapeHtml(tool.name)}</span>
                        <label style="cursor:pointer;margin:0" onclick="event.stopPropagation()">
                            <input type="checkbox" ${tool.enabled ? 'checked' : ''} onchange="MarketplacePage.toggleTool('${Components.escapeHtml(tool.name)}', this.checked)" style="margin-right:4px;accent-color:var(--accent)">
                            <span style="font-size:11px;color:var(--text-tertiary)">${tool.enabled ? '启用' : '禁用'}</span>
                        </label>
                    </div>
                    <div class="tool-desc" style="cursor:pointer" onclick="MarketplacePage.viewTool('${Components.escapeHtml(tool.name)}')">${Components.escapeHtml(tool.description || '无描述')}</div>
                    <div class="tool-card-meta">
                        ${Components.renderBadge(tool.toolset || 'default', 'blue')}
                        <button class="btn btn-sm btn-ghost" onclick="MarketplacePage.viewTool('${Components.escapeHtml(tool.name)}')" style="margin-left:auto">详情</button>
                    </div>
                </div>
            `,
                      )
                      .join('')}</div>`;

        container.innerHTML = toolsHtml;
        const countSpan = document.querySelector('#contentBody .tool-count');
        if (countSpan) countSpan.textContent = `共 ${filtered.length} 个工具`;
    }

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
    // Tab 4: 插件市场
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

    function buildPluginsTab() {
        const filtered = getFilteredPlugins();
        const typeCounts = {
            all: _market.length,
            tool: _market.filter((p) => p.type === 'tool').length,
            skill: _market.filter((p) => p.type === 'skill').length,
            memory: _market.filter((p) => p.type === 'memory').length,
        };

        // 子 Tab 切换
        const tabHtml = `<div style="display:flex;gap:4px;margin-bottom:16px">
            <button type="button" class="btn ${_pluginTab === 'market' ? 'btn-primary' : 'btn-ghost'}" data-action="switchPluginTab" data-tab="market">插件市场 (${_market.length})</button>
            <button type="button" class="btn ${_pluginTab === 'installed' ? 'btn-primary' : 'btn-ghost'}" data-action="switchPluginTab" data-tab="installed">已安装 (${_installed.length})</button>
        </div>`;

        if (_pluginTab === 'installed') return tabHtml + buildInstalledPlugins();

        // 搜索 + 筛选
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

    async function installPlugin(name) {
        try {
            await API.request('POST', '/api/plugins/install', { name });
            Components.Toast.success(`插件「${name}」安装成功`);
            await loadPlugins();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
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
            await loadPlugins();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`卸载失败: ${err.message}`);
        }
    }

    // ==========================================
    // SSE 事件处理
    // ==========================================
    function onSSEEvent(type, _data) {
        if (['skill.created', 'skill.updated', 'skill.deleted'].includes(type)) {
            loadSkills()
                .then(() => {
                    if (_activeTab === 'skills') {
                        document.getElementById('contentBody').innerHTML = buildPage();
                        bindEvents();
                    }
                })
                .catch(() => {});
        }
        if (['plugin.installed', 'plugin.uninstalled'].includes(type)) {
            loadPlugins()
                .then(() => {
                    if (_activeTab === 'plugins') {
                        document.getElementById('contentBody').innerHTML = buildPage();
                        bindEvents();
                    }
                })
                .catch(() => {});
        }
    }

    // ==========================================
    // 事件绑定
    // ==========================================
    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        // 主点击事件委托
        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            switch (action) {
                // 主 Tab 切换
                case 'switchTab':
                    _activeTab = btn.dataset.tab;
                    container.innerHTML = buildPage();
                    bindEvents();
                    break;

                // MCP 配置子 Tab
                case 'switchConfigTab':
                    _configTab = btn.dataset.tab;
                    container.innerHTML = buildPage();
                    bindEvents();
                    break;

                // 插件子 Tab
                case 'switchPluginTab':
                    _pluginTab = btn.dataset.tab;
                    container.innerHTML = buildPage();
                    bindEvents();
                    break;

                // MCP 操作
                case 'testConnection':
                    testConnection();
                    break;
                case 'restartService':
                    restartService();
                    break;
                case 'copyConfig':
                    copyConfig();
                    break;
                case 'copyPrompt':
                    copyPrompt();
                    break;
                case 'addMCPServer':
                    await addMCPServer();
                    break;
                case 'removeMCPServer':
                    await removeMCPServer(btn.dataset.name);
                    break;
                case 'refreshMCPServer':
                    await refreshMCPServer(btn.dataset.name);
                    break;

                // 技能操作
                case 'showCreate':
                    showCreate();
                    break;
                case 'editSkill':
                    editSkill(btn.dataset.name);
                    break;
                case 'viewSkill':
                    viewSkill(btn.dataset.name);
                    break;
                case 'deleteSkill':
                    deleteSkill(btn.dataset.name);
                    break;
                case 'hideEditor':
                    hideEditor();
                    break;
                case 'saveSkill':
                    saveSkill();
                    break;
                case 'previewContent':
                    previewContent();
                    break;
                case 'insertTemplate':
                    insertTemplate();
                    break;
                case 'showTemplateLibrary':
                    showTemplateLibrary();
                    break;
                case 'hideTemplateLibrary':
                    hideTemplateLibrary();
                    break;
                case 'useTemplate':
                    useTemplate(btn.dataset.template);
                    break;

                // 插件操作
                case 'install':
                    installPlugin(btn.dataset.name);
                    break;
                case 'uninstall':
                    uninstallPlugin(btn.dataset.name);
                    break;
            }
        });

        // 技能搜索
        const skillSearchInput = document.getElementById('skillSearchInput');
        if (skillSearchInput) {
            skillSearchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _skillSearchKeyword = e.target.value;
                    updateSkillList();
                }, 300),
            );
        }

        // 技能分类过滤
        const skillCategoryFilter = document.getElementById('skillCategoryFilter');
        if (skillCategoryFilter) {
            skillCategoryFilter.addEventListener('change', (e) => {
                _skillCategoryFilter = e.target.value;
                updateSkillList();
            });
        }

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

        // 插件搜索
        const pluginSearch = document.getElementById('pluginSearch');
        if (pluginSearch) {
            pluginSearch.addEventListener(
                'input',
                Components.debounce((e) => {
                    _pluginKeyword = e.target.value;
                    container.innerHTML = buildPage();
                    bindEvents();
                }, 300),
            );
        }

        // 插件类型筛选
        const pluginType = document.getElementById('pluginType');
        if (pluginType) {
            pluginType.addEventListener('change', (e) => {
                _filterType = e.target.value;
                container.innerHTML = buildPage();
                bindEvents();
            });
        }

        // 插件分类筛选
        const pluginCategory = document.getElementById('pluginCategory');
        if (pluginCategory) {
            pluginCategory.addEventListener('change', (e) => {
                _filterCategory = e.target.value;
                container.innerHTML = buildPage();
                bindEvents();
            });
        }
    }

    // ==========================================
    // 公开接口
    // ==========================================
    return { render, onSSEEvent, setToolFilter, viewTool, toggleTool };
})();
