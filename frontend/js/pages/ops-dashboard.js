/**
 * 运维监控仪表盘页面
 * 实时资源监控 + MCP 服务健康 + 定时任务状态
 */

const OpsDashboardPage = (() => {
    // ========== 状态 ==========
    let _pollTimer = null;
    let _historyTimer = null;
    let _serviceTimer = null;
    let _metrics = null;
    let _historyData = { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
    let _mcpHealth = null;
    let _cronStatus = null;

    // ========== 公开方法 ==========

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [metrics, history, mcpHealth, cronStatus] = await Promise.all([
                API.get('/api/ops/metrics'),
                API.get('/api/ops/metrics/history'),
                API.get('/api/ops/mcp-health'),
                API.get('/api/ops/cron'),
            ]);
            _metrics = metrics || {};
            _historyData = history || { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
            _mcpHealth = mcpHealth || {};
            _cronStatus = cronStatus || {};
        } catch (_err) {
            _metrics = {};
            _historyData = { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
            _mcpHealth = {};
            _cronStatus = {};
        }

        container.innerHTML = _buildPage();
        _startPolling();
    }

    function onSSEEvent(type, data) {
        if (type === 'ops.alert') {
            const level = data.level || 'info';
            const msg = data.message || data.msg || '收到运维告警';
            Components.Toast.show(msg, level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info');
        }
    }

    function destroy() {
        _stopPolling();
    }

    // ========== 轮询 ==========

    function _startPolling() {
        _stopPolling();

        // 每 5 秒更新实时指标
        _pollTimer = setInterval(async () => {
            try {
                _metrics = await API.get('/api/ops/metrics') || {};
                _updateResourceCards();
            } catch (_e) { /* 静默 */ }
        }, 5000);

        // 每 30 秒更新趋势图
        _historyTimer = setInterval(async () => {
            try {
                _historyData = await API.get('/api/ops/metrics/history') || { cpu: [], memory: [], disk: [], network: [], timestamps: [] };
                _updateTrendChart();
            } catch (_e) { /* 静默 */ }
        }, 30000);

        // 每 30 秒更新 MCP 健康和定时任务
        _serviceTimer = setInterval(async () => {
            try {
                const [mcpHealth, cronStatus] = await Promise.all([
                    API.get('/api/ops/mcp-health'),
                    API.get('/api/ops/cron'),
                ]);
                _mcpHealth = mcpHealth || {};
                _cronStatus = cronStatus || {};
                _updateMcpHealth();
                _updateCronStatus();
            } catch (_e) { /* 静默 */ }
        }, 30000);
    }

    function _stopPolling() {
        if (_pollTimer) { clearInterval(_pollTimer); _pollTimer = null; }
        if (_historyTimer) { clearInterval(_historyTimer); _historyTimer = null; }
        if (_serviceTimer) { clearInterval(_serviceTimer); _serviceTimer = null; }
    }

    // ========== 增量更新 ==========

    function _updateResourceCards() {
        const el = document.getElementById('opsResourceCards');
        if (!el || !_metrics) return;
        el.innerHTML = _buildResourceCards(_metrics);
    }

    function _updateTrendChart() {
        const el = document.getElementById('opsTrendChart');
        if (!el) return;
        el.innerHTML = _buildTrendChart(_historyData);
    }

    function _updateMcpHealth() {
        const el = document.getElementById('opsMcpHealth');
        if (!el) return;
        el.innerHTML = _buildMcpHealth(_mcpHealth);
    }

    function _updateCronStatus() {
        const el = document.getElementById('opsCronStatus');
        if (!el) return;
        el.innerHTML = _buildCronStatus(_cronStatus);
    }

    // ========== SVG 图表工具 ==========

    /**
     * 环形仪表盘（参考 dashboard.js buildGauge）
     * @param {number} value - 当前值
     * @param {number} max - 最大值
     * @param {string} label - 标签
     * @param {string} color - 颜色（CSS 变量或色值）
     * @param {string} unit - 单位
     * @param {number} size - SVG 尺寸
     */
    function _buildGauge(value, max, label, color, unit, size) {
        size = size || 88;
        const sw = 6;
        const r = (size - sw) / 2;
        const cx = size / 2;
        const cy = size / 2;
        const pct = Math.min(value / max, 1);
        const circumference = 2 * Math.PI * r;
        const dashArray = `${pct * circumference} ${(1 - pct) * circumference}`;
        const displayVal = typeof value === 'number'
            ? (value >= 100 ? Math.round(value) : value.toFixed(1))
            : value;

        // 根据百分比动态调整颜色
        let strokeColor = color;
        if (pct >= 0.9) strokeColor = 'var(--red)';
        else if (pct >= 0.75) strokeColor = 'var(--orange)';

        return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px">
            <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--border)" stroke-width="${sw}"/>
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${strokeColor}" stroke-width="${sw}"
                    stroke-dasharray="${dashArray}" stroke-dashoffset="0"
                    transform="rotate(-90 ${cx} ${cy})" stroke-linecap="round"
                    style="transition:stroke-dasharray 0.8s ease"/>
                <text x="${cx}" y="${cy + 1}" text-anchor="middle" dominant-baseline="middle"
                    fill="var(--text-primary)" font-size="16" font-weight="700">${displayVal}${unit || ''}</text>
            </svg>
            <span style="font-size:11px;color:var(--text-tertiary);font-weight:500">${Components.escapeHtml(label)}</span>
        </div>`;
    }

    /**
     * 资源趋势折线图（双 Y 轴）
     * 左轴: CPU/内存百分比 (0-100)
     * 右轴: 网络速率
     */
    function _buildTrendChart(data) {
        if (!data || !data.timestamps || data.timestamps.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无趋势数据</div>';
        }

        const width = 600;
        const height = 200;
        const padL = 40;
        const padR = 45;
        const padT = 15;
        const padB = 30;
        const chartW = width - padL - padR;
        const chartH = height - padT - padB;

        const points = data.timestamps.length;
        const stepX = points > 1 ? chartW / (points - 1) : chartW;

        // 构建折线辅助函数
        function buildLine(values, maxVal, color, dashed) {
            if (!values || values.length === 0) return { path: '', dots: '', fill: '' };
            let path = '';
            let dots = '';
            let fillPath = '';
            values.forEach((v, i) => {
                const x = padL + i * stepX;
                const y = padT + chartH - (Math.min(v, maxVal) / maxVal) * chartH;
                path += `${i === 0 ? 'M' : 'L'}${x},${y}`;
                dots += `<circle cx="${x}" cy="${y}" r="2.5" fill="${color}" style="opacity:0.8"/>`;
            });
            const firstX = padL;
            const lastX = padL + (values.length - 1) * stepX;
            fillPath = `${path}L${lastX},${padT + chartH}L${firstX},${padT + chartH}Z`;
            return { path, dots, fill: fillPath };
        }

        // CPU 折线
        const cpuLine = buildLine(data.cpu, 100, 'var(--orange)');
        // 内存折线
        const memLine = buildLine(data.memory, 100, 'var(--green)');
        // 网络上行
        const netMax = Math.max(
            ...(data.network || []).map(n => Math.max(n.upload || 0, n.download || 0)),
            1
        );
        const uploadVals = (data.network || []).map(n => n.upload || 0);
        const downloadVals = (data.network || []).map(n => n.download || 0);
        const uploadLine = buildLine(uploadVals, netMax, 'var(--blue)');
        const downloadLine = buildLine(downloadVals, netMax, 'var(--purple)');

        // 左 Y 轴标签 (0-100%)
        let leftYLabels = '';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round((100 * i) / 4);
            const y = padT + chartH - (i / 4) * chartH;
            leftYLabels += `<text x="${padL - 6}" y="${y + 3}" text-anchor="end" fill="var(--text-tertiary)" font-size="9">${val}%</text>`;
            leftYLabels += `<line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="var(--border)" stroke-width="0.5" stroke-dasharray="3,3"/>`;
        }

        // 右 Y 轴标签 (网络速率)
        let rightYLabels = '';
        const netMaxDisplay = netMax >= 1000 ? (netMax / 1000).toFixed(1) : netMax.toFixed(0);
        const netUnit = netMax >= 1000 ? 'GB/s' : 'MB/s';
        for (let i = 0; i <= 4; i++) {
            const val = ((netMax * i) / 4);
            const displayVal = val >= 1000 ? (val / 1000).toFixed(1) : val.toFixed(0);
            const y = padT + chartH - (i / 4) * chartH;
            rightYLabels += `<text x="${width - padR + 6}" y="${y + 3}" text-anchor="start" fill="var(--text-tertiary)" font-size="9">${displayVal}</text>`;
        }

        // X 轴时间标签（智能间隔）
        let labels = '';
        const maxLabels = 10;
        const interval = Math.max(1, Math.floor(points / maxLabels));
        data.timestamps.forEach((ts, i) => {
            if (i % interval !== 0 && i !== points - 1) return;
            const x = padL + i * stepX;
            const date = new Date(ts);
            const timeStr = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
            labels += `<text x="${x}" y="${height - 6}" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">${timeStr}</text>`;
        });

        // 渐变定义
        const gradientId = 'opsCpuFill';
        const gradientId2 = 'opsMemFill';

        return `<svg width="100%" height="${height}" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
            <defs>
                <linearGradient id="${gradientId}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--orange)" stop-opacity="0.2"/>
                    <stop offset="100%" stop-color="var(--orange)" stop-opacity="0.01"/>
                </linearGradient>
                <linearGradient id="${gradientId2}" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stop-color="var(--green)" stop-opacity="0.15"/>
                    <stop offset="100%" stop-color="var(--green)" stop-opacity="0.01"/>
                </linearGradient>
            </defs>
            ${leftYLabels}
            ${rightYLabels}
            <!-- CPU 填充 -->
            <path d="${cpuLine.fill}" fill="url(#${gradientId})"/>
            <!-- 内存填充 -->
            <path d="${memLine.fill}" fill="url(#${gradientId2})"/>
            <!-- CPU 折线 -->
            <path d="${cpuLine.path}" fill="none" stroke="var(--orange)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${cpuLine.dots}
            <!-- 内存折线 -->
            <path d="${memLine.path}" fill="none" stroke="var(--green)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            ${memLine.dots}
            <!-- 网络上行 -->
            <path d="${uploadLine.path}" fill="none" stroke="var(--blue)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="4,2"/>
            ${uploadLine.dots}
            <!-- 网络下行 -->
            <path d="${downloadLine.path}" fill="none" stroke="var(--purple)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="6,3"/>
            ${downloadLine.dots}
            ${labels}
        </svg>
        <div style="display:flex;gap:16px;justify-content:center;margin-top:6px;flex-wrap:wrap">
            <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-secondary)"><span style="width:14px;height:2px;background:var(--orange);border-radius:1px"></span>CPU</span>
            <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-secondary)"><span style="width:14px;height:2px;background:var(--green);border-radius:1px"></span>内存</span>
            <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-secondary)"><span style="width:14px;height:2px;background:var(--blue);border-radius:1px;border-top:2px dashed var(--blue)"></span>上行</span>
            <span style="display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text-secondary)"><span style="width:14px;height:2px;background:var(--purple);border-radius:1px;border-top:2px dashed var(--purple)"></span>下行</span>
        </div>`;
    }

    /**
     * 水平条形图（参考 dashboard.js buildHorizontalBar）
     */
    function _buildHorizontalBar(items, maxBars) {
        maxBars = maxBars || 10;
        if (!items || items.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无数据</div>';
        }
        const maxVal = Math.max(...items.map(d => d.total_calls || d.count || d.value || 0), 1);
        const list = items.slice(0, maxBars);
        let html = '';
        list.forEach(d => {
            const val = d.total_calls || d.count || d.value || 0;
            const pct = ((val / maxVal) * 100).toFixed(1);
            const name = d.tool || d.name || '-';
            const rate = d.success_rate;
            const rateColor = rate >= 90 ? 'var(--green)' : rate >= 70 ? 'var(--orange)' : 'var(--red)';
            html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:120px;font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0" title="${Components.escapeHtml(name)}">${Components.escapeHtml(name.length > 16 ? name.slice(0, 16) + '..' : name)}</div>
                <div style="flex:1;height:18px;background:var(--bg-secondary);border-radius:var(--radius-sm);overflow:hidden;position:relative">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:var(--radius-sm);transition:width 0.6s ease"></div>
                </div>
                <div style="width:50px;text-align:right;font-size:11px;color:var(--text-primary);font-weight:600;flex-shrink:0">${val}</div>
                ${rate !== undefined ? `<div style="width:40px;text-align:right;font-size:10px;color:${rateColor};flex-shrink:0">${rate}%</div>` : ''}
            </div>`;
        });
        return html;
    }

    // ========== 区域构建 ==========

    /**
     * 区域 1：实时资源监控卡片（顶部 4 个横排）
     */
    function _buildResourceCards(metrics) {
        const m = metrics || {};
        const cpu = m.cpu_pct != null ? m.cpu_pct : 0;
        const mem = m.memory_pct != null ? m.memory_pct : 0;
        const disk = m.disk_pct != null ? m.disk_pct : 0;
        const netUp = m.network_up || 0;
        const netDown = m.network_down || 0;

        // 网络速率格式化
        function formatNetSpeed(bytes) {
            if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB/s';
            if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
            return bytes.toFixed(0) + ' B/s';
        }

        // 网络卡片
        const netCard = `<div class="stat-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                ${Components.icon('activity', 16)}
                <span style="font-size:11px;color:var(--text-tertiary);font-weight:500">网络吞吐</span>
            </div>
            <div style="display:flex;gap:20px;align-items:center">
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                    <span style="font-size:10px;color:var(--blue);font-weight:500">${Components.icon('upload', 12)} 上行</span>
                    <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${formatNetSpeed(netUp)}</span>
                </div>
                <div style="width:1px;height:30px;background:var(--border)"></div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                    <span style="font-size:10px;color:var(--purple);font-weight:500">${Components.icon('download', 12)} 下行</span>
                    <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${formatNetSpeed(netDown)}</span>
                </div>
            </div>
        </div>`;

        return `<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:20px" class="ops-resource-grid">
            <div class="stat-card" style="display:flex;align-items:center;justify-content:center">
                ${_buildGauge(cpu, 100, 'CPU 使用率', 'var(--orange)', '%', 88)}
            </div>
            <div class="stat-card" style="display:flex;align-items:center;justify-content:center">
                ${_buildGauge(mem, 100, '内存使用率', 'var(--green)', '%', 88)}
            </div>
            <div class="stat-card" style="display:flex;align-items:center;justify-content:center">
                ${_buildGauge(disk, 100, '磁盘使用率', 'var(--blue)', '%', 88)}
            </div>
            ${netCard}
        </div>`;
    }

    /**
     * 区域 2：资源趋势图（中部）
     */
    function _buildTrendSection(historyData) {
        return Components.renderSection(
            '资源趋势（最近 10 分钟）',
            `<div id="opsTrendChart">${_buildTrendChart(historyData)}</div>`,
        );
    }

    /**
     * 区域 3：MCP 服务健康（左下）
     */
    function _buildMcpHealth(health) {
        const h = health || {};
        const overallStatus = h.status || 'unknown';
        const statusMap = {
            healthy: { label: '健康', color: 'var(--green)', bg: 'var(--green-bg)' },
            warning: { label: '告警', color: 'var(--orange)', bg: 'var(--orange-bg)' },
            critical: { label: '异常', color: 'var(--red)', bg: 'var(--red-bg)' },
            unknown: { label: '未知', color: 'var(--text-tertiary)', bg: 'var(--bg-secondary)' },
        };
        const st = statusMap[overallStatus] || statusMap.unknown;

        // 成功率环形图
        const successRate = h.success_rate != null ? h.success_rate : 0;
        const rateColor = successRate >= 90 ? 'var(--green)' : successRate >= 70 ? 'var(--orange)' : 'var(--red)';

        // 最近错误列表
        const errors = h.recent_errors || [];
        let errorsHtml = '';
        if (errors.length === 0) {
            errorsHtml = '<div style="text-align:center;color:var(--green);padding:12px;font-size:12px">' +
                Components.icon('check', 14) + ' 最近没有错误</div>';
        } else {
            errors.slice(0, 5).forEach(e => {
                const time = e.ts ? Components.formatTime(e.ts) : '';
                errorsHtml += `<div style="display:flex;gap:8px;padding:6px 8px;border-radius:6px;background:var(--red-bg);border-left:3px solid var(--red);margin-bottom:4px;font-size:11px">
                    <div style="flex-shrink:0">
                        <div style="font-weight:600;color:var(--red)">${Components.escapeHtml(e.tool || e.name || '?')}</div>
                        <div style="font-size:10px;color:var(--text-tertiary)">${time}</div>
                    </div>
                    <div style="flex:1;min-width:0;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(e.error || e.err || e.message || '')}">${Components.escapeHtml((e.error || e.err || e.message || '未知错误').slice(0, 80))}</div>
                </div>`;
            });
        }

        // TOP 10 工具调用排行
        const ranking = h.tool_ranking || h.ranking || [];

        return `<div id="opsMcpHealth">
            <!-- 整体健康状态 -->
            <div style="display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:var(--radius-sm);background:${st.bg};margin-bottom:12px">
                <div style="width:10px;height:10px;border-radius:50%;background:${st.color};box-shadow:0 0 8px ${st.color};flex-shrink:0"></div>
                <span style="font-size:14px;font-weight:600;color:${st.color}">${st.label}</span>
                <span style="font-size:12px;color:var(--text-secondary);flex:1">${Components.escapeHtml(h.summary || h.detail || '')}</span>
                ${Components.icon('shield', 18)}
            </div>

            <!-- 成功率 + 统计 -->
            <div style="display:flex;align-items:center;gap:20px;margin-bottom:16px;padding:0 4px">
                ${_buildGauge(successRate, 100, '工具调用成功率', rateColor, '%', 72)}
                <div style="flex:1;display:flex;flex-direction:column;gap:6px">
                    <div style="display:flex;justify-content:space-between;font-size:12px">
                        <span style="color:var(--text-secondary)">总调用</span>
                        <span style="color:var(--text-primary);font-weight:600">${h.total_calls || 0}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px">
                        <span style="color:var(--text-secondary)">成功</span>
                        <span style="color:var(--green);font-weight:600">${h.success_count || 0}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px">
                        <span style="color:var(--text-secondary)">失败</span>
                        <span style="color:var(--red);font-weight:600">${h.error_count || 0}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between;font-size:12px">
                        <span style="color:var(--text-secondary)">平均延迟</span>
                        <span style="color:var(--text-primary);font-weight:600">${h.avg_latency || 0}ms</span>
                    </div>
                </div>
            </div>

            <!-- 最近错误 -->
            <div style="margin-bottom:16px">
                <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px">${Components.icon('alertTriangle', 14)} 最近错误</div>
                ${errorsHtml}
            </div>

            <!-- TOP 10 工具排行 -->
            <div>
                <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px">${Components.icon('chart', 14)} TOP 10 工具调用</div>
                <div style="display:flex;gap:12px;margin-bottom:6px;font-size:10px;color:var(--text-tertiary)">
                    <span style="width:120px">工具名</span>
                    <span style="flex:1">调用频次</span>
                    <span style="width:50px;text-align:right">次数</span>
                    <span style="width:40px;text-align:right">成功率</span>
                </div>
                ${_buildHorizontalBar(ranking, 10)}
            </div>
        </div>`;
    }

    /**
     * 区域 4：定时任务状态（右下）
     */
    function _buildCronStatus(cron) {
        const c = cron || {};
        const total = c.total || c.count || 0;
        const success = c.success || c.success_count || 0;
        const failed = c.failed || c.error_count || 0;
        const running = c.running || c.active || 0;

        // 最近执行记录
        const records = c.recent || c.records || c.history || [];
        let recordsHtml = '';
        if (records.length === 0) {
            recordsHtml = '<div style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:12px">暂无执行记录</div>';
        } else {
            records.slice(0, 10).forEach(r => {
                const status = r.status || (r.success ? 'success' : (r.error ? 'error' : 'unknown'));
                const statusBadge = status === 'success'
                    ? Components.renderBadge('成功', 'green')
                    : status === 'error' || status === 'failed'
                        ? Components.renderBadge('失败', 'red')
                        : status === 'running'
                            ? Components.renderBadge('运行中', 'blue')
                            : Components.renderBadge(status, 'blue');
                const time = r.ts || r.time || r.executed_at || r.last_run || '';
                const duration = r.duration || r.ms || '';
                const durationStr = duration ? `${duration}ms` : '';
                const name = r.name || r.job_name || r.task || '-';

                recordsHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;font-size:12px;transition:background 0.15s;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--bg-secondary)'" onmouseout="this.style.background='transparent'">
                    <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-weight:500;color:var(--text-primary)" title="${Components.escapeHtml(name)}">${Components.escapeHtml(name)}</div>
                    ${statusBadge}
                    <span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;min-width:50px;text-align:right">${durationStr}</span>
                    <span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;min-width:60px;text-align:right">${time ? Components.formatTime(time) : '-'}</span>
                </div>`;
            });
        }

        return `<div id="opsCronStatus">
            <!-- 统计卡片 -->
            <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:16px">
                <div style="text-align:center;padding:10px 8px;border-radius:var(--radius-sm);background:var(--blue-bg)">
                    <div style="font-size:20px;font-weight:700;color:var(--blue)">${total}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">任务总数</div>
                </div>
                <div style="text-align:center;padding:10px 8px;border-radius:var(--radius-sm);background:var(--green-bg)">
                    <div style="font-size:20px;font-weight:700;color:var(--green)">${success}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">成功</div>
                </div>
                <div style="text-align:center;padding:10px 8px;border-radius:var(--radius-sm);background:var(--red-bg)">
                    <div style="font-size:20px;font-weight:700;color:var(--red)">${failed}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">失败</div>
                </div>
                <div style="text-align:center;padding:10px 8px;border-radius:var(--radius-sm);background:var(--orange-bg)">
                    <div style="font-size:20px;font-weight:700;color:var(--orange)">${running}</div>
                    <div style="font-size:10px;color:var(--text-secondary);margin-top:2px">运行中</div>
                </div>
            </div>

            <!-- 最近执行记录 -->
            <div>
                <div style="font-size:12px;font-weight:600;color:var(--text-primary);margin-bottom:8px">${Components.icon('clock', 14)} 最近执行记录</div>
                ${recordsHtml}
            </div>
        </div>`;
    }

    // ========== 页面组装 ==========

    function _buildPage() {
        // 区域 1：实时资源监控卡片
        const resourceHtml = _buildResourceCards(_metrics);

        // 区域 2：资源趋势图
        const trendHtml = _buildTrendSection(_historyData);

        // 区域 3 + 4：左右两栏
        const mcpSection = Components.renderSection('MCP 服务健康', _buildMcpHealth(_mcpHealth));
        const cronSection = Components.renderSection('定时任务状态', _buildCronStatus(_cronStatus));

        return `<div class="page-container">
            <h2 class="page-title">运维监控</h2>

            <!-- 区域 1：实时资源监控 -->
            <div id="opsResourceCards">${resourceHtml}</div>

            <!-- 区域 2：资源趋势图 -->
            ${trendHtml}

            <!-- 区域 3 + 4：MCP 健康 + 定时任务 -->
            <div class="two-col" style="margin-top:16px">
                ${mcpSection}
                ${cronSection}
            </div>
        </div>
        <style>
            .ops-resource-grid {
                grid-template-columns: repeat(4, 1fr);
            }
            @media (max-width: 1024px) {
                .ops-resource-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
            }
            @media (max-width: 480px) {
                .ops-resource-grid {
                    grid-template-columns: 1fr;
                }
            }
        </style>`;
    }

    return { render, onSSEEvent, destroy };
})();
