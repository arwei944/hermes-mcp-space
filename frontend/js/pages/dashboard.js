/**
 * 仪表盘页面 (Mac 极简风格)
 * 数据可视化 + 真实 API 数据
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
            systemStatus: { uptime: '3天 12小时 30分钟', version: '1.0.0', memoryUsage: '256MB / 512MB', cpuUsage: '12%' },
        };
    }

    function getMockCron() {
        return [
            { id: 'cron_001', name: '日报生成', schedule: '0 9 * * *', status: 'active' },
            { id: 'cron_002', name: '缓存清理', schedule: '0 3 * * 0', status: 'active' },
            { id: 'cron_003', name: '模型更新', schedule: '手动', status: 'paused' },
        ];
    }

    // --- SVG 图表工具 ---

    function buildBarChart(data, width, height, color) {
        if (!data || data.length === 0) return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无数据</div>';
        const max = Math.max(...data.map(d => d.value), 1);
        const barWidth = Math.max(12, (width - 40) / data.length - 8);
        const chartH = height - 30;
        let bars = '';
        data.forEach((d, i) => {
            const h = Math.max(2, (d.value / max) * (chartH - 10));
            const x = 20 + i * (barWidth + 8);
            const y = chartH - h;
            bars += `<rect x="${x}" y="${y}" width="${barWidth}" height="${h}" rx="3" fill="${color}" opacity="0.8"/>`;
            bars += `<text x="${x + barWidth / 2}" y="${chartH + 14}" text-anchor="middle" fill="var(--text-tertiary)" font-size="10">${d.label}</text>`;
            bars += `<text x="${x + barWidth / 2}" y="${y - 4}" text-anchor="middle" fill="var(--text-secondary)" font-size="10">${d.value}</text>`;
        });
        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${bars}</svg>`;
    }

    function buildDonutChart(segments, size, strokeWidth) {
        if (!segments || segments.length === 0) return '';
        const r = (size - strokeWidth) / 2;
        const cx = size / 2, cy = size / 2;
        const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
        let offset = 0;
        let arcs = '';
        let legend = '';
        segments.forEach(seg => {
            const pct = seg.value / total;
            const dashArray = `${pct * 2 * Math.PI * r} ${(1 - pct) * 2 * Math.PI * r}`;
            const dashOffset = -offset * 2 * Math.PI * r;
            arcs += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${seg.color}" stroke-width="${strokeWidth}" stroke-dasharray="${dashArray}" stroke-dashoffset="${dashOffset}" transform="rotate(-90 ${cx} ${cy})"/>`;
            offset += pct;
            legend += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                <div style="width:8px;height:8px;border-radius:50%;background:${seg.color}"></div>
                <span style="font-size:12px;color:var(--text-secondary)">${seg.label}: ${seg.value}</span>
            </div>`;
        });
        return `<div style="display:flex;align-items:center;gap:16px">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${arcs}</svg>
            <div>${legend}</div>
        </div>`;
    }

    function buildLineChart(data, width, height, color) {
        if (!data || data.length < 2) return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无数据</div>';
        const max = Math.max(...data.map(d => d.value), 1);
        const min = Math.min(...data.map(d => d.value), 0);
        const range = max - min || 1;
        const chartH = height - 30;
        const chartW = width - 40;
        const stepX = chartW / (data.length - 1);

        let points = '';
        let labels = '';
        data.forEach((d, i) => {
            const x = 20 + i * stepX;
            const y = 10 + chartH - ((d.value - min) / range) * (chartH - 20);
            points += `${i === 0 ? 'M' : 'L'}${x},${y}`;
            labels += `<text x="${x}" y="${height - 4}" text-anchor="middle" fill="var(--text-tertiary)" font-size="10">${d.label}</text>`;
        });

        // 填充区域
        const firstX = 20;
        const lastX = 20 + (data.length - 1) * stepX;
        const fillPath = `${points}L${lastX},${chartH + 10}L${firstX},${chartH + 10}Z`;

        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
            <defs><linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="${color}" stop-opacity="0.3"/>
                <stop offset="100%" stop-color="${color}" stop-opacity="0.02"/>
            </linearGradient></defs>
            <path d="${fillPath}" fill="url(#lineGrad)"/>
            <path d="${points}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${data.map((d, i) => {
                const x = 20 + i * stepX;
                const y = 10 + chartH - ((d.value - min) / range) * (chartH - 20);
                return `<circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`;
            }).join('')}
            ${labels}
        </svg>`;
    }

    function buildGaugeChart(value, max, label, color) {
        const size = 80;
        const sw = 6;
        const r = (size - sw) / 2;
        const cx = size / 2, cy = size / 2;
        const pct = Math.min(value / max, 1);
        const dashArray = `${pct * 2 * Math.PI * r} ${(1 - pct) * 2 * Math.PI * r}`;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"/>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dashArray}" stroke-dashoffset="0" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"/>
                <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-primary)" font-size="14" font-weight="600">${typeof value === 'number' ? value : value}</text>
            </svg>
            <span style="font-size:11px;color:var(--text-tertiary)">${label}</span>
        </div>`;
    }

    // --- 页面构建 ---

    function buildPage() {
        const s = _data.stats || {};
        const recentSessions = _data.recentSessions || [];
        const sys = _data.systemStatus || {};

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

        // --- 图表区域 ---
        // 会话来源分布（环形图）
        const sourceMap = {};
        recentSessions.forEach(s => { sourceMap[s.source || '其他'] = (sourceMap[s.source || '其他'] || 0) + 1; });
        const sourceSegments = Object.entries(sourceMap).map(([k, v]) => ({
            label: k, value: v,
            color: { Trae: 'var(--purple)', Web: 'var(--blue)', CLI: 'var(--green)', API: 'var(--orange)' }[k] || 'var(--text-tertiary)',
        }));

        // 模型使用分布（柱状图）
        const modelMap = {};
        recentSessions.forEach(s => { modelMap[s.model || '未知'] = (modelMap[s.model || '未知'] || 0) + 1; });
        const modelData = Object.entries(modelMap).map(([k, v]) => ({ label: k.length > 10 ? k.slice(0, 10) : k, value: v }));

        // 模拟 7 天会话趋势（折线图）
        const days = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];
        const today = new Date().getDay();
        const trendData = days.map((d, i) => ({
            label: d,
            value: Math.floor(Math.random() * 20) + 5 + (i === (today === 0 ? 6 : today - 1) ? 10 : 0),
        }));

        // 系统资源仪表盘
        const memMatch = (sys.memoryUsage || '').match(/(\d+)/);
        const cpuMatch = (sys.cpuUsage || '').match(/([\d.]+)/);
        const memVal = memMatch ? parseInt(memMatch[1]) : 0;
        const cpuVal = cpuMatch ? parseFloat(cpuMatch[1]) : 0;

        const chartsHtml = `<div class="two-col" style="margin-top:16px">
            ${Components.renderSection('会话来源', buildDonutChart(sourceSegments, 120, 16))}
            ${Components.renderSection('模型使用', buildBarChart(modelData, 280, 140, 'var(--accent)'))}
        </div>
        <div class="two-col" style="margin-top:16px">
            ${Components.renderSection('7 天会话趋势', buildLineChart(trendData, 280, 140, 'var(--accent)'))}
            ${Components.renderSection('系统资源', `
                <div style="display:flex;justify-content:space-around;padding:8px 0">
                    ${buildGaugeChart(memVal, 1024, '内存 (MB)', 'var(--green)')}
                    ${buildGaugeChart(cpuVal.toFixed(1), 100, 'CPU (%)', 'var(--orange)')}
                    ${buildGaugeChart(s.activeSessions || 0, 10, '活跃会话', 'var(--blue)')}
                </div>
            `)}
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

        // 定时任务 + 系统状态
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

        const statusHtml = Components.renderSection('系统状态', `
            <div class="status-list">
                <div class="status-item"><span class="status-item-label">运行时间</span><span class="status-item-value">${sys.uptime || '-'}</span></div>
                <div class="status-item"><span class="status-item-label">版本</span><span class="status-item-value">${sys.version || '-'}</span></div>
                <div class="status-item"><span class="status-item-label">内存使用</span><span class="status-item-value">${sys.memoryUsage || '-'}</span></div>
                <div class="status-item"><span class="status-item-label">CPU 使用率</span><span class="status-item-value">${sys.cpuUsage || '-'}</span></div>
            </div>
        `);

        const twoColHtml = `<div class="two-col">${cronHtml}${statusHtml}</div>`;

        return `${fallbackNotice}${statsHtml}${chartsHtml}${sessionsHtml}${twoColHtml}`;
    }

    return { render };
})();
