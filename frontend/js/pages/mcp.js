/**
 * MCP 服务页面
 * 连接状态、暴露的工具列表、连接信息、重启服务
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
                API.mcp.status(),
                API.mcp.tools(),
                API.mcp.connectionInfo(),
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
        return {
            running: true,
            uptime: '2天 5小时',
            port: 3000,
            protocol: 'stdio',
            connections: 1,
        };
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
            transport: 'stdio',
            command: 'node',
            args: ['/path/to/hermes-mcp/index.js'],
            env: {
                HERMES_PORT: '3000',
                HERMES_HOST: 'localhost',
            },
            traeConfig: {
                mcpServers: {
                    hermes: {
                        command: 'node',
                        args: ['/path/to/hermes-mcp/index.js'],
                        env: {
                            HERMES_PORT: '3000',
                        },
                    },
                },
            },
        };
    }

    function buildPage() {
        const s = _status || {};

        // 状态卡片
        const statusCards = Components.createStatsGrid([
            {
                icon: '🔌',
                value: s.running ? '运行中' : '已停止',
                label: 'MCP 服务状态',
                change: s.uptime || '',
                changeType: s.running ? 'positive' : 'negative',
            },
            { icon: '🌐', value: s.port || '-', label: '端口' },
            { icon: '📡', value: s.protocol || '-', label: '协议' },
            { icon: '🔗', value: s.connections || 0, label: '活跃连接' },
        ]);

        // 暴露的工具
        const toolsHtml = _tools.length > 0
            ? Components.createTable({
                columns: [
                    {
                        key: 'name', label: '工具名称',
                        render: (v) => `<span style="font-family:monospace;color:var(--accent-secondary)">${Components.escapeHtml(v)}</span>`
                    },
                    { key: 'description', label: '描述' },
                    {
                        key: 'category', label: '分类',
                        render: (v) => Components.badge(v || 'default', 'primary')
                    },
                ],
                rows: _tools,
                emptyText: '没有暴露的工具',
            })
            : Components.createEmptyState('🔌', '暂无工具', 'MCP 服务没有暴露任何工具', '');

        // 连接信息
        const connInfo = _connectionInfo || {};
        const connHtml = `
            <div class="connection-info">
                <div><span class="info-label">传输方式:</span><span class="info-value">${connInfo.transport || '-'}</span></div>
                <div><span class="info-label">命令:</span><span class="info-value">${connInfo.command || '-'}</span></div>
                <div><span class="info-label">参数:</span><span class="info-value">${(connInfo.args || []).join(' ')}</span></div>
            </div>
        `;

        // Trae 配置
        const traeConfig = connInfo.traeConfig || {};
        const traeJson = JSON.stringify(traeConfig, null, 2);

        return `
            <div class="page-enter">
                ${statusCards}

                <div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:8px">
                    <button class="btn btn-secondary" onclick="McpPage.restartService()">重启 MCP 服务</button>
                </div>

                ${Components.sectionTitle('暴露的工具')}
                ${toolsHtml}

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-top:24px">
                    <div>
                        ${Components.sectionTitle('连接信息')}
                        ${Components.createCard({ content: connHtml })}
                    </div>
                    <div>
                        ${Components.sectionTitle('Trae 配置')}
                        <div class="card">
                            <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                                <button class="btn btn-sm btn-ghost" onclick="McpPage.copyConfig()" title="复制配置">📋 复制</button>
                            </div>
                            <div class="schema-display" id="traeConfigDisplay">${Components.escapeHtml(traeJson)}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    async function restartService() {
        if (!confirm('确定要重启 MCP 服务吗？')) return;

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
        const el = document.getElementById('traeConfigDisplay');
        if (!el) return;

        const text = el.textContent;
        navigator.clipboard.writeText(text).then(() => {
            Components.Toast.success('配置已复制到剪贴板');
        }).catch(() => {
            // Fallback
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

    function init() {}

    return { render, init, restartService, copyConfig };
})();
