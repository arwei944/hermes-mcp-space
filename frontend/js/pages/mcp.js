/**
 * MCP 服务页面 (Mac 极简风格)
 */

const McpPage = (() => {
    let _status = null;
    let _tools = [];
    let _connectionInfo = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [statusData, toolsData, connData] = await Promise.all([
                API.mcp.status(), API.mcp.tools(), API.mcp.connectionInfo(),
            ]);
            _status = statusData;
            _tools = toolsData.tools || toolsData || [];
            _connectionInfo = connData;
        } catch (err) {
            _status = getMockStatus();
            _tools = getMockTools();
            _connectionInfo = getMockConnection();
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockStatus() {
        return { running: true, uptime: '2天 5小时', port: 3000, protocol: 'stdio', connections: 1 };
    }

    function getMockTools() {
        return [
            { name: 'hermes_chat', description: '与 Hermes Agent 对话', category: 'core' },
            { name: 'hermes_search', description: '搜索 Hermes 知识库', category: 'core' },
            { name: 'hermes_execute', description: '执行 Hermes 技能', category: 'core' },
            { name: 'hermes_memory', description: '读写 Hermes 记忆', category: 'memory' },
            { name: 'hermes_config', description: '管理 Hermes 配置', category: 'system' },
            { name: 'hermes_status', description: '获取 Hermes 状态', category: 'system' },
        ];
    }

    function getMockConnection() {
        return {
            transport: 'stdio', command: 'node', args: ['/path/to/hermes-mcp/index.js'],
            env: { HERMES_PORT: '3000', HERMES_HOST: 'localhost' },
            traeConfig: { mcpServers: { hermes: { command: 'node', args: ['/path/to/hermes-mcp/index.js'], env: { HERMES_PORT: '3000' } } } },
        };
    }

    function buildPage() {
        const s = _status || {};

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('MCP 服务', s.running ? '运行中' : '已停止', s.uptime || '', '\uD83D\uDD0C', s.running ? 'green' : 'red')}
            ${Components.renderStatCard('端口', s.port || '-', '', '\uD83C\uDF10', 'blue')}
            ${Components.renderStatCard('协议', s.protocol || '-', '', '\uD83D\uDCE1', 'purple')}
            ${Components.renderStatCard('活跃连接', s.connections || 0, '', '\uD83D\uDD17', 'orange')}
        </div>`;

        // 操作按钮
        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:8px">
            <button class="btn btn-secondary" onclick="McpPage.restartService()">重启 MCP 服务</button>
        </div>`;

        // 暴露的工具
        const toolsHtml = Components.renderSection('暴露的工具', `
            <table class="table">
                <thead><tr><th>工具名称</th><th>描述</th><th>分类</th></tr></thead>
                <tbody>
                    ${_tools.length === 0 ? `<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-tertiary)">没有暴露的工具</td></tr>` :
                    _tools.map(t => `<tr>
                        <td class="mono" style="color:var(--accent)">${Components.escapeHtml(t.name)}</td>
                        <td>${Components.escapeHtml(t.description)}</td>
                        <td>${Components.renderBadge(t.category || 'default', 'blue')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `);

        // 两栏布局
        const connInfo = _connectionInfo || {};
        const traeConfig = connInfo.traeConfig || {};
        const traeJson = JSON.stringify(traeConfig, null, 2);

        const twoColHtml = `<div class="two-col">
            ${Components.renderSection('连接信息', `
                <div class="connection-info">
                    <div><span class="info-label">传输方式:</span><span class="info-value">${connInfo.transport || '-'}</span></div>
                    <div><span class="info-label">命令:</span><span class="info-value">${connInfo.command || '-'}</span></div>
                    <div><span class="info-label">参数:</span><span class="info-value">${(connInfo.args || []).join(' ')}</span></div>
                </div>
            `)}
            ${Components.renderSection('Trae 配置', `
                <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                    <button class="btn btn-sm btn-ghost" onclick="McpPage.copyConfig()">复制配置</button>
                </div>
                <div class="schema-display" id="traeConfigDisplay">${Components.escapeHtml(traeJson)}</div>
            `)}
        </div>`;

        return `${statsHtml}${actionsHtml}${toolsHtml}${twoColHtml}`;
    }

    async function restartService() {
        if (!confirm('确定要重启 MCP 服务吗？')) return;
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

    return { render, restartService, copyConfig };
})();
