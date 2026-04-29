/**
 * MCP 服务页面 (Mac 极简风格)
 * 展示 MCP 服务状态、暴露工具、多平台连接配置、System Prompt 模板
 */

const McpPage = (() => {
    let _status = null;
    let _mcpTools = [];
    let _apiStatus = null;
    let _mcpTestResult = null;
    let _activeTab = 'trae';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [statusData, apiStatus] = await Promise.all([API.mcp.status(), API.system.status()]);
            _status = statusData;
            _apiStatus = apiStatus;
        } catch (_err) {
            _status = { status: 'unknown' };
            _apiStatus = { status: '降级模式', hermes_available: false };
        }

        try {
            const mcpBaseUrl = window.location.origin;
            const resp = await fetch(`${mcpBaseUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
            });
            if (resp.ok) {
                const data = await resp.json();
                _mcpTools = data.result?.tools || [];
            }
        } catch (_err) {
            _mcpTools = [];
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getConfigs() {
        const baseUrl = window.location.origin;
        return {
            trae: {
                label: 'Trae',
                icon: Components.icon('zap', 16),
                description: 'Trae IDE 内置 MCP 客户端',
                config: JSON.stringify(
                    {
                        mcpServers: {
                            hermes: { url: `${baseUrl}/mcp` },
                        },
                    },
                    null,
                    2,
                ),
                steps: [
                    '打开 Trae → 设置 → MCP',
                    '点击「添加 MCP Server」',
                    '粘贴上方 JSON 配置',
                    '重启 Trae 使配置生效',
                ],
            },
            claude: {
                label: 'Claude Desktop',
                icon: Components.icon('bot', 16),
                description: 'Claude 桌面版 MCP 客户端',
                config: JSON.stringify(
                    {
                        mcpServers: {
                            hermes: {
                                url: `${baseUrl}/mcp`,
                                type: 'streamable-http',
                            },
                        },
                    },
                    null,
                    2,
                ),
                steps: [
                    '打开 Claude Desktop 配置文件',
                    '路径: ~/Library/Application Support/Claude/claude_desktop_config.json',
                    '粘贴上方 JSON 配置',
                    '重启 Claude Desktop',
                ],
            },
            vscode: {
                label: 'VS Code (Copilot)',
                icon: Components.icon('monitor', 16),
                description: 'VS Code + GitHub Copilot MCP',
                config: JSON.stringify(
                    {
                        servers: {
                            hermes: {
                                url: `${baseUrl}/mcp`,
                                type: 'streamable-http',
                            },
                        },
                    },
                    null,
                    2,
                ),
                steps: ['打开 VS Code 设置 (JSON)', '添加 mcp.servers 配置', '粘贴上方 JSON 配置', '重新加载窗口'],
            },
            cursor: {
                label: 'Cursor',
                icon: '🖱️',
                description: 'Cursor IDE MCP 客户端',
                config: JSON.stringify(
                    {
                        mcpServers: {
                            hermes: { url: `${baseUrl}/mcp` },
                        },
                    },
                    null,
                    2,
                ),
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

    function buildPage() {
        const s = _status || {};
        const api = _apiStatus || {};
        const isOnline = s.status === 'running';
        const hermesOk = api.hermes_available === true;
        const baseUrl = window.location.origin;
        const configs = getConfigs();

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('MCP 服务', isOnline ? '运行中' : '未运行', isOnline ? '服务正常' : '服务未启动', Components.icon('plug', 16), isOnline ? 'green' : 'red')}
            ${Components.renderStatCard('Hermes 主程序', hermesOk ? '已连接' : '未连接', hermesOk ? '数据实时同步' : '使用降级数据', Components.icon('bot', 16), hermesOk ? 'green' : 'orange')}
            ${Components.renderStatCard('暴露工具', _mcpTools.length + ' 个', 'MCP 协议可用', Components.icon('wrench', 16), 'blue')}
            ${Components.renderStatCard('后端状态', api.status === 'ok' ? '正常' : '降级', api.status || '-', Components.icon('radio', 16), api.status === 'ok' ? 'green' : 'orange')}
        </div>`;

        // 操作按钮
        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:8px">
            <button type="button" class="btn btn-secondary" data-action="testConnection">测试 MCP 连接</button>
            <button type="button" class="btn btn-secondary" data-action="restartService">重启 MCP 服务</button>
        </div>`;

        // MCP 测试结果
        const testResultHtml = _mcpTestResult
            ? `
            <div style="margin-bottom:16px;padding:12px 16px;border-radius:var(--radius-sm);background:${_mcpTestResult.ok ? 'var(--green-bg)' : 'var(--red-bg)'};border:1px solid ${_mcpTestResult.ok ? 'var(--green)' : 'var(--red)'}">
                <div style="font-size:13px;font-weight:600;color:${_mcpTestResult.ok ? 'var(--green)' : 'var(--red)'}">${_mcpTestResult.ok ? '✅ MCP 连接正常' : '❌ MCP 连接失败'}</div>
                ${_mcpTestResult.detail ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${_mcpTestResult.detail}</div>` : ''}
            </div>
        `
            : '';

        // 工具列表
        const toolsHtml = Components.renderSection(
            'MCP 暴露的工具',
            `
            <table class="table">
                <thead><tr><th>工具名称</th><th>描述</th></tr></thead>
                <tbody>
                    ${
                        _mcpTools.length === 0
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
            </table>
        `,
        );

        // 平台 Tab 切换
        const tabKeys = Object.keys(configs);
        const tabHtml = `<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
            ${tabKeys.map((k) => `<button type="button" class="btn btn-sm ${_activeTab === k ? 'btn-primary' : 'btn-ghost'}" data-action="switchTab" data-tab="${k}">${configs[k].icon} ${configs[k].label}</button>`).join('')}
            <button type="button" class="btn btn-sm ${_activeTab === 'prompt' ? 'btn-primary' : 'btn-ghost'}" data-action="switchTab" data-tab="prompt">${Components.icon('clipboard', 14)} System Prompt</button>
        </div>`;

        // 配置内容区
        let configContentHtml = '';
        if (_activeTab === 'prompt') {
            const prompt = getSystemPrompt();
            configContentHtml = Components.renderSection(
                'System Prompt 模板',
                `
                <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">将以下内容添加到 Trae / Claude / Cursor 的 System Prompt 或自定义指令中：</p>
                <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                    <button type="button" class="btn btn-sm btn-ghost" data-action="copyPrompt">${Components.icon('clipboard', 14)} 复制 Prompt</button>
                </div>
                <div class="schema-display" id="systemPromptDisplay" style="white-space:pre-wrap;font-size:13px;line-height:1.7">${Components.escapeHtml(prompt)}</div>
            `,
            );
        } else {
            const cfg = configs[_activeTab];
            if (cfg) {
                configContentHtml = Components.renderSection(
                    `${cfg.icon} ${cfg.label} 配置`,
                    `
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">${cfg.description}</p>
                    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                        <button type="button" class="btn btn-sm btn-ghost" data-action="copyConfig">${Components.icon('clipboard', 14)} 复制配置</button>
                    </div>
                    <div class="schema-display" id="traeConfigDisplay">${Components.escapeHtml(cfg.config)}</div>
                    <div style="margin-top:16px">
                        <div style="font-size:13px;font-weight:600;margin-bottom:8px">配置步骤</div>
                        <ol style="margin:0;padding-left:20px;font-size:12px;color:var(--text-secondary);line-height:2">
                            ${cfg.steps.map((s) => `<li>${s}</li>`).join('')}
                        </ol>
                    </div>
                `,
                );
            }
        }

        // 服务端点信息
        const endpointHtml = Components.renderSection(
            '服务端点',
            `
            <div class="connection-info">
                <div><span class="info-label">Streamable HTTP:</span><span class="info-value mono">${baseUrl}/mcp</span></div>
                <div><span class="info-label">SSE (兼容):</span><span class="info-value mono">${baseUrl}/sse</span></div>
                <div><span class="info-label">协议版本:</span><span class="info-value">MCP 2025-03-26</span></div>
                <div><span class="info-label">Hermes 可用:</span><span class="info-value">${hermesOk ? '是' : '否（使用降级数据）'}</span></div>
            </div>
        `,
        );

        return `${statsHtml}${actionsHtml}${testResultHtml}${toolsHtml}
            ${Components.renderSection('连接配置', `${tabHtml}${configContentHtml}`)}
            ${endpointHtml}`;
    }

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
                    params: {
                        protocolVersion: '2025-03-26',
                        capabilities: {},
                        clientInfo: { name: 'test', version: '1.0' },
                    },
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
            Components.Toast.error(`.*${err.message}`);
        }
    }

    function copyConfig() {
        const el = document.getElementById('traeConfigDisplay');
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
            .then(() => {
                Components.Toast.success('已复制到剪贴板');
            })
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

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            switch (action) {
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
                case 'switchTab':
                    _activeTab = btn.dataset.tab;
                    document.getElementById('contentBody').innerHTML = buildPage();
                    bindEvents();
                    break;
            }
        });
    }

    return { render, restartService, copyConfig, copyPrompt, testConnection };
})();
