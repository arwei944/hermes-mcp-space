/**
 * MCP 服务页面 (Mac 极简风格)
 * 展示 MCP 服务状态、暴露工具、Trae 连接配置
 */

const McpPage = (() => {
    let _status = null;
    let _mcpTools = [];
    let _apiStatus = null;
    let _mcpTestResult = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [statusData, apiStatus] = await Promise.all([
                API.mcp.status(),
                API.system.status(),
            ]);
            _status = statusData;
            _apiStatus = apiStatus;
        } catch (err) {
            _status = getMockStatus();
            _apiStatus = { status: '降级模式', hermes_available: false };
        }

        // 尝试获取 MCP 暴露的工具列表
        try {
            const mcpBaseUrl = window.location.origin;
            const resp = await fetch(`${mcpBaseUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list', params: {} }),
            });
            if (resp.ok) {
                const data = await resp.json();
                _mcpTools = data.result?.tools || [];
            }
        } catch (err) {
            _mcpTools = getMockTools();
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockStatus() {
        return { status: 'unavailable', message: 'Hermes Agent 未安装', servers: [] };
    }

    function getMockTools() {
        return [
            { name: 'list_sessions', description: '列出最近的会话列表' },
            { name: 'get_session_messages', description: '获取会话消息历史' },
            { name: 'list_tools', description: '列出所有可用工具' },
            { name: 'list_skills', description: '列出所有可用技能' },
            { name: 'read_memory', description: '读取 Agent 长期记忆' },
            { name: 'write_memory', description: '写入 Agent 长期记忆' },
            { name: 'get_system_status', description: '获取系统状态' },
            { name: 'get_dashboard_summary', description: '获取仪表盘摘要' },
        ];
    }

    function buildPage() {
        const s = _status || {};
        const api = _apiStatus || {};
        const isOnline = s.status === 'running';
        const hermesOk = api.hermes_available === true;
        const baseUrl = window.location.origin;

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('MCP 服务', isOnline ? '运行中' : '未运行', isOnline ? '服务正常' : '服务未启动', '🔌', isOnline ? 'green' : 'red')}
            ${Components.renderStatCard('Hermes 主程序', hermesOk ? '已连接' : '未连接', hermesOk ? '数据实时同步' : '使用降级数据', '🤖', hermesOk ? 'green' : 'orange')}
            ${Components.renderStatCard('暴露工具', _mcpTools.length + ' 个', 'MCP 协议可用', '🔧', 'blue')}
            ${Components.renderStatCard('后端状态', api.status === 'ok' ? '正常' : '降级', api.status || '-', '📡', api.status === 'ok' ? 'green' : 'orange')}
        </div>`;

        // 操作按钮
        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:8px">
            <button class="btn btn-secondary" onclick="McpPage.testConnection()">测试 MCP 连接</button>
            <button class="btn btn-secondary" onclick="McpPage.restartService()">重启 MCP 服务</button>
        </div>`;

        // MCP 测试结果
        const testResultHtml = _mcpTestResult ? `
            <div style="margin-bottom:16px;padding:12px 16px;border-radius:var(--radius-sm);background:${_mcpTestResult.ok ? 'var(--success-bg, #f0fdf4)' : 'var(--error-bg, #fef2f2)'};border:1px solid ${_mcpTestResult.ok ? 'var(--success-border, #bbf7d0)' : 'var(--error-border, #fecaca)'}">
                <div style="font-size:13px;font-weight:600;color:${_mcpTestResult.ok ? 'var(--success, #16a34a)' : 'var(--error, #dc2626)'}">${_mcpTestResult.ok ? '✅ MCP 连接正常' : '❌ MCP 连接失败'}</div>
                ${_mcpTestResult.detail ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${_mcpTestResult.detail}</div>` : ''}
            </div>
        ` : '';

        // 暴露的工具
        const toolsHtml = Components.renderSection('MCP 暴露的工具', `
            <table class="table">
                <thead><tr><th>工具名称</th><th>描述</th></tr></thead>
                <tbody>
                    ${_mcpTools.length === 0 ? `<tr><td colspan="2" style="text-align:center;padding:40px;color:var(--text-tertiary)">没有暴露的工具</td></tr>` :
                    _mcpTools.map(t => `<tr>
                        <td class="mono" style="color:var(--accent)">${Components.escapeHtml(t.name)}</td>
                        <td>${Components.escapeHtml(t.description || '无描述')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `);

        // 两栏布局：端点信息 + Trae 配置
        const traeConfig = {
            mcpServers: {
                hermes: {
                    url: `${baseUrl}/mcp`
                }
            }
        };
        const traeJson = JSON.stringify(traeConfig, null, 2);

        const twoColHtml = `<div class="two-col">
            ${Components.renderSection('服务端点', `
                <div class="connection-info">
                    <div><span class="info-label">Streamable HTTP:</span><span class="info-value mono">${baseUrl}/mcp</span></div>
                    <div><span class="info-label">SSE (兼容):</span><span class="info-value mono">${baseUrl}/sse</span></div>
                    <div><span class="info-label">协议版本:</span><span class="info-value">MCP 2025-03-26</span></div>
                    <div><span class="info-label">Hermes 可用:</span><span class="info-value">${hermesOk ? '是' : '否（使用降级数据）'}</span></div>
                </div>
            `)}
            ${Components.renderSection('Trae 配置', `
                <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">在 Trae 中打开 设置 → MCP → 添加配置，粘贴以下 JSON：</p>
                <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                    <button class="btn btn-sm btn-ghost" onclick="McpPage.copyConfig()">复制配置</button>
                </div>
                <div class="schema-display" id="traeConfigDisplay">${Components.escapeHtml(traeJson)}</div>
            `)}
        </div>`;

        return `${statsHtml}${actionsHtml}${testResultHtml}${toolsHtml}${twoColHtml}`;
    }

    async function testConnection() {
        Components.Toast.info('正在测试 MCP 连接...');
        try {
            const baseUrl = window.location.origin;
            const resp = await fetch(`${baseUrl}/mcp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0', id: 1,
                    method: 'initialize',
                    params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0' } }
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
    }

    async function restartService() {
        try {
            Components.Toast.info('正在重启 MCP 服务...');
            await API.mcp.restart();
            Components.Toast.success('MCP 服务已重启');
            render();
        } catch (err) { Components.Toast.error(`重启失败: ${err.message}`); }
    }

    function copyConfig() {
        const el = document.getElementById('traeConfigDisplay');
        if (!el) return;
        const text = el.textContent;
        navigator.clipboard.writeText(text).then(() => {
            Components.Toast.success('配置已复制到剪贴板');
        }).catch(() => {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            Components.Toast.success('配置已复制到剪贴板');
        });
    }

    function bindEvents() {}

    return { render, restartService, copyConfig, testConnection };
})();
