/**
 * 运维监控仪表盘页面 - MCP 服务健康状态
 * 整体健康状态 / 成功率 / 最近错误 / TOP 10 工具排行
 */

const McpHealth = (() => {

    /**
     * 环形仪表盘（MCP 成功率用）
     * @param {number} value - 当前值
     * @param {number} max - 最大值
     * @param {string} label - 标签
     * @param {string} color - 颜色
     * @param {string} unit - 单位
     * @param {number} size - SVG 尺寸
     */
    function _buildGauge(value, max, label, color, unit, size) {
        size = size || 72;
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
     * 构建 MCP 服务健康区域
     * @param {object} health - MCP 健康数据
     * @param {function} buildHorizontalBar - 水平条形图构建函数（来自 TrendChart 模块）
     */
    function buildMcpHealth(health, buildHorizontalBar) {
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
                ${buildHorizontalBar(ranking, 10)}
            </div>
        </div>`;
    }

    return { buildMcpHealth };
})();

export default McpHealth;
