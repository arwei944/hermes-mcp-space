/**
 * 仪表盘页面 (Mac 极简风格)
 */

const DashboardPage = (() => {
    let _data = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            _data = await API.system.dashboard();
        } catch (err) {
            _data = getMockData();
        }

        container.innerHTML = buildPage(_data);
    }

    function getMockData() {
        return {
            stats: { sessions: 128, activeSessions: 3, tools: 24, activeTools: 18, skills: 7, cronJobs: 4, activeCronJobs: 3, mcpConnected: true },
            recentSessions: [
                { id: 'sess_001', source: 'Trae', model: 'qwen3-coder', messages: 24, createdAt: new Date(Date.now() - 120000).toISOString(), status: 'active' },
                { id: 'sess_002', source: 'Web', model: 'claude-4', messages: 56, createdAt: new Date(Date.now() - 900000).toISOString(), status: 'active' },
                { id: 'sess_003', source: 'CLI', model: 'gpt-4o', messages: 12, createdAt: new Date(Date.now() - 3600000).toISOString(), status: 'completed' },
                { id: 'sess_004', source: 'API', model: 'qwen3-coder', messages: 8, createdAt: new Date(Date.now() - 10800000).toISOString(), status: 'completed' },
                { id: 'sess_005', source: 'Trae', model: 'claude-4', messages: 42, createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'completed' },
            ],
            systemStatus: { uptime: '3天 12小时', version: '1.0.0', memoryUsage: '256MB / 512MB', cpuUsage: '12%' },
        };
    }

    function buildPage(data) {
        const s = data.stats || {};
        const recentSessions = data.recentSessions || [];
        const sys = data.systemStatus || {};

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总会话数', s.sessions || 0, `${s.activeSessions || 0} 活跃`, '\uD83D\uDCAC', 'blue')}
            ${Components.renderStatCard('活跃工具', s.activeTools || 0, `共 ${s.tools || 0} 个`, '\uD83D\uDD27', 'green')}
            ${Components.renderStatCard('技能数', s.skills || 0, '', '\u26A1', 'purple')}
            ${Components.renderStatCard('MCP 连接', s.mcpConnected ? '在线' : '离线', s.mcpConnected ? '\u25CF 在线' : '\u25CF 离线', '\uD83D\uDD0C', 'orange')}
        </div>`;

        // 最近会话表格
        const sessionsHtml = Components.renderSection('最近会话', `
            <table class="table">
                <thead><tr><th>ID</th><th>来源</th><th>模型</th><th>消息数</th><th>状态</th><th>时间</th></tr></thead>
                <tbody>
                    ${recentSessions.map(s => `<tr>
                        <td class="mono">#${Components.truncate(s.id, 12)}</td>
                        <td>${Components.renderBadge(s.source, s.source === 'Trae' ? 'purple' : s.source === 'Web' ? 'blue' : s.source === 'CLI' ? 'green' : 'orange')}</td>
                        <td class="mono">${s.model}</td>
                        <td>${s.messages}</td>
                        <td>${Components.renderBadge(s.status === 'active' ? '活跃' : '完成', s.status === 'active' ? 'green' : 'blue')}</td>
                        <td>${Components.formatTime(s.createdAt)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `, '查看全部 \u2192');

        // 两栏布局
        const twoColHtml = `<div class="two-col">
            ${Components.renderSection('定时任务', `
                <table class="table">
                    <thead><tr><th>名称</th><th>调度</th><th>状态</th></tr></thead>
                    <tbody>
                        <tr><td>日报生成</td><td class="mono">0 9 * * *</td><td>${Components.renderBadge('运行中', 'green')}</td></tr>
                        <tr><td>缓存清理</td><td class="mono">0 3 * * 0</td><td>${Components.renderBadge('运行中', 'green')}</td></tr>
                        <tr><td>模型更新</td><td class="mono">手动</td><td>${Components.renderBadge('暂停', 'orange')}</td></tr>
                    </tbody>
                </table>
            `, '管理 \u2192')}
            ${Components.renderSection('系统状态', `
                <div class="status-list">
                    <div class="status-item"><span class="status-item-label">运行时间</span><span class="status-item-value">${sys.uptime || '-'}</span></div>
                    <div class="status-item"><span class="status-item-label">版本</span><span class="status-item-value">${sys.version || '-'}</span></div>
                    <div class="status-item"><span class="status-item-label">内存使用</span><span class="status-item-value">${sys.memoryUsage || '-'}</span></div>
                    <div class="status-item"><span class="status-item-label">CPU 使用率</span><span class="status-item-value">${sys.cpuUsage || '-'}</span></div>
                </div>
            `)}
        </div>`;

        return `${statsHtml}${sessionsHtml}${twoColHtml}`;
    }

    return { render };
})();
