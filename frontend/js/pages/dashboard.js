/**
 * 仪表盘页面
 * 展示系统概览、统计数据、最近会话、快捷操作
 */

const DashboardPage = (() => {
    let _data = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            _data = await API.system.dashboard();
        } catch (err) {
            // 如果 API 不可用，使用模拟数据展示 UI
            _data = getMockData();
        }

        container.innerHTML = buildPage(_data);
        bindEvents();
    }

    function getMockData() {
        return {
            stats: {
                sessions: 42,
                activeSessions: 3,
                tools: 18,
                activeTools: 15,
                skills: 7,
                cronJobs: 4,
                activeCronJobs: 3,
                mcpConnected: true,
            },
            recentSessions: [
                { id: 'sess_001', source: 'cli', model: 'gpt-4o', messages: 24, createdAt: new Date(Date.now() - 300000).toISOString(), status: 'active' },
                { id: 'sess_002', source: 'api', model: 'gpt-4o', messages: 12, createdAt: new Date(Date.now() - 1800000).toISOString(), status: 'active' },
                { id: 'sess_003', source: 'web', model: 'claude-3', messages: 8, createdAt: new Date(Date.now() - 7200000).toISOString(), status: 'completed' },
                { id: 'sess_004', source: 'cli', model: 'gpt-4o', messages: 56, createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'completed' },
                { id: 'sess_005', source: 'api', model: 'claude-3', messages: 3, createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'completed' },
            ],
            systemStatus: {
                uptime: '3天 12小时',
                version: '1.0.0',
                memoryUsage: '256MB / 512MB',
                cpuUsage: '12%',
            },
        };
    }

    function buildPage(data) {
        const stats = data.stats || {};
        const recentSessions = data.recentSessions || [];
        const systemStatus = data.systemStatus || {};

        // 统计卡片
        const statsHtml = Components.createStatsGrid([
            { icon: '💬', value: stats.sessions || 0, label: '总会话数', change: `${stats.activeSessions || 0} 活跃`, changeType: 'positive' },
            { icon: '🔧', value: stats.activeTools || 0, label: '活跃工具', change: `共 ${stats.tools || 0} 个`, changeType: '' },
            { icon: '⚡', value: stats.skills || 0, label: '技能数', change: '', changeType: '' },
            { icon: '⏰', value: stats.activeCronJobs || 0, label: '运行中任务', change: `共 ${stats.cronJobs || 0} 个`, changeType: '' },
            { icon: '🔌', value: stats.mcpConnected ? '在线' : '离线', label: 'MCP 状态', change: '', changeType: stats.mcpConnected ? 'positive' : 'negative' },
        ]);

        // 最近会话
        const sessionsHtml = Components.createTable({
            columns: [
                { key: 'id', label: '会话 ID' },
                { key: 'source', label: '来源', render: (v) => Components.badge(v, v === 'cli' ? 'primary' : v === 'api' ? 'info' : 'muted') },
                { key: 'model', label: '模型' },
                { key: 'messages', label: '消息数' },
                { key: 'createdAt', label: '创建时间', render: (v) => Components.formatTime(v) },
                { key: 'status', label: '状态', render: (v) => Components.badge(v === 'active' ? '活跃' : '已完成', v === 'active' ? 'success' : 'muted') },
            ],
            rows: recentSessions,
            emptyText: '暂无会话记录',
            toolbar: null,
        });

        // 系统状态
        const statusItems = [
            { label: '运行时间', value: systemStatus.uptime || '-' },
            { label: '版本', value: systemStatus.version || '-' },
            { label: '内存使用', value: systemStatus.memoryUsage || '-' },
            { label: 'CPU 使用率', value: systemStatus.cpuUsage || '-' },
        ];

        const statusHtml = `
            <div class="status-list">
                ${statusItems.map(item => `
                    <div class="status-item">
                        <span class="status-item-label">${item.label}</span>
                        <span class="status-item-value">${item.value}</span>
                    </div>
                `).join('')}
            </div>
        `;

        // 快捷操作
        const quickActionsHtml = `
            <div class="quick-actions">
                <button class="quick-action-btn" onclick="location.hash='#sessions'">
                    <span class="action-icon">💬</span>
                    <span class="action-label">新建会话</span>
                </button>
                <button class="quick-action-btn" onclick="location.hash='#skills'">
                    <span class="action-icon">⚡</span>
                    <span class="action-label">管理技能</span>
                </button>
                <button class="quick-action-btn" onclick="location.hash='#memory'">
                    <span class="action-icon">🧠</span>
                    <span class="action-label">编辑记忆</span>
                </button>
                <button class="quick-action-btn" onclick="location.hash='#cron'">
                    <span class="action-icon">⏰</span>
                    <span class="action-label">定时任务</span>
                </button>
                <button class="quick-action-btn" onclick="location.hash='#config'">
                    <span class="action-icon">⚙️</span>
                    <span class="action-label">系统配置</span>
                </button>
            </div>
        `;

        return `
            <div class="page-enter">
                ${statsHtml}

                <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
                    <div>
                        ${Components.sectionTitle('快捷操作')}
                        ${quickActionsHtml}
                    </div>
                    <div>
                        ${Components.sectionTitle('系统状态')}
                        ${statusHtml}
                    </div>
                </div>

                ${Components.sectionTitle('最近会话')}
                ${sessionsHtml}
            </div>
        `;
    }

    function bindEvents() {
        // 仪表盘页面的事件绑定
    }

    function init() {
        // 初始化
    }

    return { render, init };
})();
