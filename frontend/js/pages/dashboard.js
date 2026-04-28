/**
 * 仪表盘页面 (Mac 极简风格)
 * 接入真实 API 数据，失败时降级为模拟数据
 */

const DashboardPage = (() => {
    let _data = null;
    let _cronJobs = [];
    let _useFallback = false;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [dashData, cronData] = await Promise.all([
                API.system.dashboard(),
                API.cron.list(),
            ]);
            _data = dashData;
            _cronJobs = cronData.jobs || cronData || [];
            _useFallback = false;
        } catch (err) {
            _data = getMockData();
            _cronJobs = getMockCron();
            _useFallback = true;
        }

        container.innerHTML = buildPage();
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

    function getMockCron() {
        return [
            { id: 'cron_001', name: '日报生成', schedule: '0 9 * * *', status: 'active' },
            { id: 'cron_002', name: '缓存清理', schedule: '0 3 * * 0', status: 'active' },
            { id: 'cron_003', name: '模型更新', schedule: '手动', status: 'paused' },
        ];
    }

    function buildPage(data) {
        const s = _data.stats || {};
        const recentSessions = _data.recentSessions || [];
        const sys = _data.systemStatus || {};

        // 降级模式提示
        const fallbackNotice = _useFallback ? `
            <div style="margin-bottom:16px;padding:10px 14px;border-radius:var(--radius-sm);background:#fffbeb;border:1px solid #fde68a;font-size:12px;color:#92400e">
                ⚠️ 当前使用演示数据（后端 API 未连接）。部署到 HF Spaces 后将显示真实数据。
            </div>` : '';

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总会话数', s.sessions || 0, `${s.activeSessions || 0} 活跃`, '💬', 'blue')}
            ${Components.renderStatCard('活跃工具', s.activeTools || 0, `共 ${s.tools || 0} 个`, '🔧', 'green')}
            ${Components.renderStatCard('技能数', s.skills || 0, '', '⚡', 'purple')}
            ${Components.renderStatCard('MCP 连接', s.mcpConnected ? '在线' : '离线', s.mcpConnected ? '● 在线' : '● 离线', '🔌', 'orange')}
        </div>`;

        // 最近会话表格
        const sessionsHtml = Components.renderSection('最近会话', `
            <table class="table">
                <thead><tr><th>ID</th><th>来源</th><th>模型</th><th>消息数</th><th>状态</th><th>时间</th></tr></thead>
                <tbody>
                    ${recentSessions.length === 0 ? `<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--text-tertiary)">暂无会话记录</td></tr>` :
                    recentSessions.map(s => `<tr>
                        <td class="mono">#${Components.truncate(s.id, 12)}</td>
                        <td>${Components.renderBadge(s.source || '-', s.source === 'Trae' ? 'purple' : s.source === 'Web' ? 'blue' : s.source === 'CLI' ? 'green' : 'orange')}</td>
                        <td class="mono">${s.model || '-'}</td>
                        <td>${s.messages || 0}</td>
                        <td>${Components.renderBadge(s.status === 'active' ? '活跃' : '完成', s.status === 'active' ? 'green' : 'blue')}</td>
                        <td>${Components.formatTime(s.createdAt)}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `, '查看全部 →');

        // 定时任务表格
        const cronStatusMap = { active: '运行中', paused: '暂停', disabled: '已禁用', idle: '空闲' };
        const cronBadgeMap = { active: 'green', paused: 'orange', disabled: 'red', idle: 'blue' };
        const cronHtml = Components.renderSection('定时任务', `
            <table class="table">
                <thead><tr><th>名称</th><th>调度</th><th>状态</th></tr></thead>
                <tbody>
                    ${_cronJobs.length === 0 ? `<tr><td colspan="3" style="text-align:center;padding:40px;color:var(--text-tertiary)">暂无定时任务</td></tr>` :
                    _cronJobs.map(j => `<tr>
                        <td>${Components.escapeHtml(j.name || '-')}</td>
                        <td class="mono">${Components.escapeHtml(j.schedule || j.cron || '-')}</td>
                        <td>${Components.renderBadge(cronStatusMap[j.status] || j.status || '-', cronBadgeMap[j.status] || 'blue')}</td>
                    </tr>`).join('')}
                </tbody>
            </table>
        `, '管理 →');

        // 系统状态
        const statusHtml = Components.renderSection('系统状态', `
            <div class="status-list">
                <div class="status-item"><span class="status-item-label">运行时间</span><span class="status-item-value">${sys.uptime || '-'}</span></div>
                <div class="status-item"><span class="status-item-label">版本</span><span class="status-item-value">${sys.version || '-'}</span></div>
                <div class="status-item"><span class="status-item-label">内存使用</span><span class="status-item-value">${sys.memoryUsage || '-'}</span></div>
                <div class="status-item"><span class="status-item-label">CPU 使用率</span><span class="status-item-value">${sys.cpuUsage || '-'}</span></div>
            </div>
        `);

        const twoColHtml = `<div class="two-col">${cronHtml}${statusHtml}</div>`;

        return `${fallbackNotice}${statsHtml}${sessionsHtml}${twoColHtml}`;
    }

    return { render };
})();
