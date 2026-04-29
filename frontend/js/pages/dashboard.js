/**
 * 仪表盘页面 v2 — 实时运维监控台
 * 核心理念：展示"正在发生什么"
 */

const DashboardPage = (() => {
    let _data = null;
    let _activity = [];
    let _trend = [];
    let _ranking = [];
    let _errors = [];
    let _heatmap = null;
    let _pollTimer = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [dashData, activity, trend, ranking, errors, heatmap] = await Promise.all([
                API.system.dashboard(),
                API.get('/api/dashboard/activity'),
                API.get('/api/dashboard/trend?days=7'),
                API.get('/api/dashboard/ranking'),
                API.get('/api/dashboard/errors'),
                API.get('/api/dashboard/heatmap'),
            ]);
            _data = dashData;
            _activity = activity || [];
            _trend = trend || [];
            _ranking = ranking || [];
            _errors = errors || [];
            _heatmap = heatmap || null;
        } catch (err) {
            _data = {};
            _activity = []; _trend = []; _ranking = []; _errors = []; _heatmap = null;
        }

        container.innerHTML = buildPage();
        startPolling();
    }

    function destroy() {
        stopPolling();
    }

    function stopPolling() {
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
    }

    function startPolling() {
        stopPolling();
        _pollTimer = setInterval(async () => {
            try {
                const [dashData, activity] = await Promise.all([
                    API.system.dashboard(),
                    API.get('/api/dashboard/activity?limit=30'),
                ]);
                _data = dashData;
                _activity = activity || [];
                // 增量更新统计卡片
                updateStats();
                // 增量更新活动流
                updateActivityFeed();
            } catch (e) { /* 静默 */ }
        }, 15000); // 15秒轮询
    }

    function updateStats() {
        const s = _data.stats || {};
        const sys = _data.system || {};
        const el = document.getElementById('dashStats');
        if (!el) return;
        el.innerHTML = `
            ${Components.renderStatCard('总调用', s.totalToolCalls || 0, `成功率 ${s.successRate || 0}%`, 'chart', 'blue')}
            ${Components.renderStatCard('平均延迟', `${s.avgLatency || 0}ms`, '', 'zap', 'green')}
            ${Components.renderStatCard('会话数', s.sessions || 0, `${s.activeSessions || 0} 活跃`, 'messageCircle', 'purple')}
            ${Components.renderStatCard('工具', s.tools || 0, `${s.skills || 0} 技能`, 'wrench', 'orange')}
            ${Components.renderStatCard('成功率', `${s.successRate || 0}%`, '', 'check', 'green')}
            ${Components.renderStatCard('MCP', s.mcpConnected ? '在线' : '离线', sys.version || '', 'plug', s.mcpConnected ? 'green' : 'red')}
        `;
    }

    function updateActivityFeed() {
        const el = document.getElementById('activityFeed');
        if (!el) return;
        el.innerHTML = buildActivityFeed(_activity);
    }

    // SSE 实时事件 — 增量更新活动流（不重渲染整个页面）
    function onSSEEvent(type, data) {
        if (type === 'mcp.tool_call' || type === 'mcp.tool_complete') {
            // 立即刷新活动流
            API.get('/api/dashboard/activity?limit=30').then(activity => {
                _activity = activity || [];
                updateActivityFeed();
            }).catch(() => {});
        }
        if (type === 'mcp.tool_complete') {
            // 刷新统计（延迟 500ms 等数据写入）
            setTimeout(() => {
                API.system.dashboard().then(dashData => {
                    _data = dashData;
                    updateStats();
                }).catch(() => {});
            }, 500);
        }
    }

    // ========== 图表工具 ==========

    function buildHeatmap(heatmap) {
        if (!heatmap || !heatmap.tools || heatmap.tools.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无调用数据</div>';
        }
        const { hours, tools, matrix, max } = heatmap;
        const cellSize = 14;
        const gap = 2;
        const labelW = 90;
        const headerH = 20;

        let html = `<div style="overflow-x:auto"><div style="display:inline-block;min-width:${labelW + hours.length * (cellSize + gap) + 10}px">`;

        // 小时标签行
        html += `<div style="display:flex;margin-left:${labelW}px;margin-bottom:2px">`;
        hours.forEach(h => {
            html += `<div style="width:${cellSize}px;margin-right:${gap}px;text-align:center;font-size:9px;color:var(--text-tertiary)">${h}h</div>`;
        });
        html += '</div>';

        // 工具行
        tools.forEach(tool => {
            const shortName = tool.length > 12 ? tool.slice(0, 12) + '..' : tool;
            html += `<div style="display:flex;align-items:center;margin-bottom:${gap}px">`;
            html += `<div style="width:${labelW}px;font-size:10px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(tool)}">${Components.escapeHtml(shortName)}</div>`;
            hours.forEach(h => {
                const val = matrix[`${h}_${tool}`] || 0;
                const intensity = max > 0 ? val / max : 0;
                const bg = intensity === 0 ? 'var(--bg-secondary)' : `rgba(99,102,241,${0.15 + intensity * 0.85})`;
                const title = `${tool} @ ${h}:00 → ${val} 次`;
                html += `<div style="width:${cellSize}px;height:${cellSize}px;border-radius:var(--radius-tag);background:${bg};margin-right:${gap}px;cursor:pointer;transition:transform 0.15s" title="${Components.escapeHtml(title)}" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'"></div>`;
            });
            html += '</div>';
        });

        html += '</div></div>';
        return html;
    }

    function buildHorizontalBar(data, maxBars = 10) {
        if (!data || data.length === 0) return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无数据</div>';
        const maxVal = Math.max(...data.map(d => d.total_calls), 1);
        const items = data.slice(0, maxBars);
        let html = '';
        items.forEach((d, i) => {
            const pct = (d.total_calls / maxVal * 100).toFixed(1);
            const rateColor = d.success_rate >= 90 ? 'var(--green)' : d.success_rate >= 70 ? 'var(--orange)' : 'var(--red)';
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:120px;font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0" title="${Components.escapeHtml(d.tool)}">${Components.escapeHtml(d.tool)}</div>
                <div style="flex:1;height:18px;background:var(--bg-secondary);border-radius:var(--radius-sm);overflow:hidden;position:relative">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:var(--radius-sm);transition:width 0.6s ease"></div>
                </div>
                <div style="width:50px;text-align:right;font-size:11px;color:var(--text-primary);font-weight:600;flex-shrink:0">${d.total_calls}</div>
                <div style="width:40px;text-align:right;font-size:10px;color:${rateColor};flex-shrink:0">${d.success_rate}%</div>
            </div>`;
        });
        return html;
    }

    function buildTrendChart(trend) {
        if (!trend || trend.length === 0) return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无数据</div>';
        const width = 500, height = 160;
        const padL = 35, padR = 10, padT = 10, padB = 25;
        const chartW = width - padL - padR;
        const chartH = height - padT - padB;

        const maxCalls = Math.max(...trend.map(d => d.tool_calls), 1);
        const maxSessions = Math.max(...trend.map(d => d.sessions), 1);
        const stepX = chartW / (trend.length - 1 || 1);

        // 工具调用折线
        let toolPath = '', toolDots = '', toolFill;
        trend.forEach((d, i) => {
            const x = padL + i * stepX;
            const y = padT + chartH - (d.tool_calls / maxCalls) * chartH;
            toolPath += `${i === 0 ? 'M' : 'L'}${x},${y}`;
            toolDots += `<circle cx="${x}" cy="${y}" r="3" fill="var(--accent)"/>`;
        });
        const firstX = padL, lastX = padL + (trend.length - 1) * stepX;
        toolFill = `${toolPath}L${lastX},${padT + chartH}L${firstX},${padT + chartH}Z`;

        // 会话折线
        let sessPath = '', sessDots = '';
        trend.forEach((d, i) => {
            const x = padL + i * stepX;
            const y = padT + chartH - (d.sessions / maxSessions) * chartH;
            sessPath += `${i === 0 ? 'M' : 'L'}${x},${y}`;
            sessDots += `<circle cx="${x}" cy="${y}" r="3" fill="var(--green)"/>`;
        });

        // X 轴标签
        let labels = '';
        trend.forEach((d, i) => {
            const x = padL + i * stepX;
            const dateLabel = d.date.slice(5); // MM-DD
            labels += `<text x="${x}" y="${height - 4}" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">${dateLabel}</text>`;
        });

        // Y 轴
        let yLabels = '';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round(maxCalls * i / 4);
            const y = padT + chartH - (i / 4) * chartH;
            yLabels += `<text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="var(--text-tertiary)" font-size="9">${val}</text>`;
            yLabels += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
        }

        return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="toolFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--accent)" stop-opacity="0.25"/>
                    <stop offset="100%" stop-color="var(--accent)" stop-opacity="0.02"/>
                </linearGradient>
            </defs>
            ${yLabels}
            <path d="${toolFill}" fill="url(#toolFill)"/>
            <path d="${toolPath}" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${toolDots}
            <path d="${sessPath}" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="5,3"/>
            ${sessDots}
            ${labels}
        </svg>
        <div style="display:flex;gap:16px;justify-content:center;margin-top:4px">
            <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-secondary)"><span style="width:12px;height:2px;background:var(--accent);border-radius:1px"></span>工具调用</span>
            <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-secondary)"><span style="width:12px;height:2px;background:var(--green);border-radius:1px;border-top:2px dashed var(--green)"></span>会话数</span>
        </div>`;
    }

    function buildGauge(value, max, label, color, unit = '') {
        const size = 72, sw = 5;
        const r = (size - sw) / 2;
        const cx = size / 2, cy = size / 2;
        const pct = Math.min(value / max, 1);
        const dashArray = `${pct * 2 * Math.PI * r} ${(1 - pct) * 2 * Math.PI * r}`;
        const displayVal = typeof value === 'number' ? (value >= 100 ? Math.round(value) : value.toFixed(1)) : value;
        return `<div style="display:flex;flex-direction:column;align-items:center;gap:2px">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"/>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${dashArray}" stroke-dashoffset="0" transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round" style="transition:stroke-dasharray 0.8s ease"/>
                <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle" fill="var(--text-primary)" font-size="13" font-weight="600">${displayVal}${unit}</text>
            </svg>
            <span style="font-size:10px;color:var(--text-tertiary)">${label}</span>
        </div>`;
    }

    function buildActivityFeed(activities) {
        if (!activities || activities.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:24px">暂无活动记录</div>';
        }
        let html = '<div id="activityFeed" style="display:flex;flex-direction:column;gap:2px;max-height:380px;overflow-y:auto;padding-right:4px">';
        activities.forEach(a => {
            const time = a.ts ? Components.formatTime(a.ts) : '';
            if (a.type === 'tool_call') {
                const icon = a.ok ? Components.icon('check', 20) : Components.icon('x', 14);
                const iconColor = a.ok ? 'var(--green)' : 'var(--red)';
                const bgHover = a.ok ? 'var(--green-bg)' : 'var(--red-bg)';
                const errTip = a.err ? ` title="${Components.escapeHtml(a.err)}"` : '';
                html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:12px;cursor:default;transition:background 0.15s" onmouseover="this.style.background='${bgHover}'" onmouseout="this.style.background='transparent'"${errTip}>
                    <span style="color:${iconColor};font-weight:700;font-size:14px;flex-shrink:0;width:16px;text-align:center">${icon}</span>
                    <span style="color:var(--text-primary);font-weight:500;flex-shrink:0;min-width:100px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(a.tool)}">${Components.escapeHtml(a.tool)}</span>
                    <span style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(a.args_summary || '')}</span>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0">${a.ms}ms</span>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0;min-width:50px;text-align:right">${time}</span>
                </div>`;
            } else if (a.type === 'solo_message') {
                const roleIcon = a.role === 'user' ? Components.icon('user', 12) : Components.icon('bot', 12);
                const roleLabel = a.role === 'user' ? '用户' : 'SOLO';
                const roleColor = a.role === 'user' ? 'var(--blue)' : 'var(--accent)';
                html += `<div style="display:flex;align-items:flex-start;gap:8px;padding:6px 8px;border-radius:6px;font-size:12px;cursor:default;transition:background 0.15s;border-left:2px solid ${roleColor}" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                    <span style="flex-shrink:0;font-size:13px">${roleIcon}</span>
                    <div style="flex:1;min-width:0">
                        <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
                            <span style="color:${roleColor};font-weight:600;font-size:11px">${roleLabel}</span>
                            ${a.tool ? `<span style="color:var(--text-tertiary);font-size:10px;background:var(--bg-secondary);padding:1px 5px;border-radius:var(--radius-tag)">${Components.escapeHtml(a.tool)}</span>` : ''}
                        </div>
                        <div style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(a.content || '')}">${Components.escapeHtml(a.content || '')}</div>
                    </div>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0;min-width:60px;text-align:right;white-space:nowrap">${time}</span>
                </div>`;
            } else {
                const levelColor = { info: 'var(--blue)', success: 'var(--green)', warning: 'var(--orange)', error: 'var(--red)' }[a.level] || 'var(--text-tertiary)';
                const levelIcon = { info: Components.icon('info', 16), success: Components.icon('check', 20), warning: Components.icon('alertTriangle', 14), error: Components.icon('x', 14) }[a.level] || '•';
                html += `<div style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;font-size:12px;cursor:default;transition:background 0.15s" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                    <span style="color:${levelColor};font-weight:700;font-size:13px;flex-shrink:0;width:16px;text-align:center">${levelIcon}</span>
                    <span style="color:var(--text-secondary);flex-shrink:0;min-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(a.action || '')}</span>
                    <span style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(a.detail || a.target || '')}</span>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0;min-width:50px;text-align:right">${time}</span>
                </div>`;
            }
        });
        html += '</div>';
        return html;
    }

    function buildErrorCards(errors) {
        if (!errors || errors.length === 0) {
            return '<div style="text-align:center;color:var(--green);padding:16px;font-size:13px">' + Components.icon('check', 14) + ' 最近没有错误</div>';
        }
        let html = '';
        errors.slice(0, 8).forEach(e => {
            const time = e.ts ? Components.formatTime(e.ts) : '';
            html += `<div style="display:flex;gap:10px;padding:8px 10px;border-radius:8px;background:var(--red-bg);border-left:3px solid var(--red);margin-bottom:6px">
                <div style="flex-shrink:0">
                    <div style="font-size:12px;font-weight:600;color:var(--red)">${Components.escapeHtml(e.tool || '?')}</div>
                    <div style="font-size:10px;color:var(--text-tertiary)">${time}</div>
                </div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(e.err || '')}">${Components.escapeHtml((e.err || '未知错误').slice(0, 120))}</div>
                </div>
                <div style="flex-shrink:0;font-size:10px;color:var(--text-tertiary)">${e.ms}ms</div>
            </div>`;
        });
        return html;
    }

    // ========== 页面构建 ==========

    function buildPage() {
        const s = _data.stats || {};
        const sys = _data.systemStatus || {};

        // --- 顶部统计卡片（6 张） ---
        const statsHtml = `<div id="dashStats" class="stats">
            ${Components.renderStatCard('总调用', s.totalToolCalls || 0, `成功率 ${s.successRate || 0}%`, 'chart', 'blue')}
            ${Components.renderStatCard('平均延迟', `${s.avgLatency || 0}ms`, '', 'zap', 'green')}
            ${Components.renderStatCard('会话数', s.sessions || 0, `${s.activeSessions || 0} 活跃`, 'messageCircle', 'purple')}
            ${Components.renderStatCard('工具', s.tools || 0, `${s.skills || 0} 技能`, 'wrench', 'orange')}
            ${Components.renderStatCard('成功率', `${s.successRate || 0}%`, '', 'check', 'green')}
            ${Components.renderStatCard('MCP', s.mcpConnected ? '在线' : '离线', sys.version || '', 'plug', s.mcpConnected ? 'green' : 'red')}
        </div>`;

        // --- 系统心跳 ---
        const memPct = sys.totalMemMb > 0 ? (sys.memMb / sys.totalMemMb * 100) : 0;
        const heartbeatHtml = Components.renderSection('系统心跳', `
            <div style="display:flex;justify-content:space-around;align-items:center;padding:4px 0">
                ${buildGauge(sys.cpuPct || 0, 100, 'CPU', 'var(--orange)', '%')}
                ${buildGauge(memPct, 100, '内存', 'var(--green)', '%')}
                ${buildGauge(s.activeSessions || 0, 20, '活跃会话', 'var(--blue)', '')}
                ${buildGauge(s.totalToolCalls || 0, Math.max(s.totalToolCalls * 1.2, 100), '总调用', 'var(--accent)', '')}
            </div>
            <div style="display:flex;justify-content:center;gap:20px;margin-top:8px;font-size:11px;color:var(--text-tertiary)">
                <span>${Components.icon('clock', 12)} 运行 ${sys.uptime || '-'}</span>
                <span>${Components.icon('package', 12)} v${sys.version || '-'}</span>
            </div>
        `);

        // --- 活动流 + 错误追踪 ---
        const activityHtml = Components.renderSection('实时活动流', buildActivityFeed(_activity));
        const errorHtml = Components.renderSection('错误追踪', buildErrorCards(_errors));

        // --- 趋势图 + 热力图 ---
        const trendHtml = Components.renderSection('7 天趋势（工具调用 + 会话）', buildTrendChart(_trend));
        const heatmapHtml = Components.renderSection('24h 工具调用热力图', buildHeatmap(_heatmap));

        // --- 工具排行 ---
        const rankHtml = Components.renderSection('工具调用排行', `
            <div style="display:flex;gap:12px;margin-bottom:8px;font-size:10px;color:var(--text-tertiary)">
                <span style="width:120px">工具名</span>
                <span style="flex:1">调用频次</span>
                <span style="width:50px;text-align:right">次数</span>
                <span style="width:40px;text-align:right">成功率</span>
            </div>
            ${buildHorizontalBar(_ranking, 12)}
        `);

        // 组装布局
        return `${statsHtml}
        ${heartbeatHtml}
        <div class="two-col" style="margin-top:16px">
            ${activityHtml}
            ${errorHtml}
        </div>
        <div class="two-col" style="margin-top:16px">
            ${trendHtml}
            ${heatmapHtml}
        </div>
        <div style="margin-top:16px">
            ${rankHtml}
        </div>`;
    }

    return { render };
})();
