/**
 * 仪表盘页面 - 图表可视化模块
 * 负责：SVG 趋势折线图、24h 热力图、工具调用排行条形图
 */

const TrendChart = (() => {

    function buildTrendChart(trend) {
        if (!trend || trend.length === 0)
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无数据</div>';
        const width = 500, height = 160;
        const padL = 35, padR = 10, padT = 10, padB = 25;
        const chartW = width - padL - padR;
        const chartH = height - padT - padB;

        const maxCalls = Math.max(...trend.map((d) => d.tool_calls), 1);
        const maxSessions = Math.max(...trend.map((d) => d.sessions), 1);
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
            const dateLabel = d.date.slice(5);
            labels += `<text x="${x}" y="${height - 4}" text-anchor="middle" fill="var(--text-tertiary)" font-size="9">${dateLabel}</text>`;
        });

        // Y 轴
        let yLabels = '';
        for (let i = 0; i <= 4; i++) {
            const val = Math.round((maxCalls * i) / 4);
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

    function buildHeatmap(heatmap) {
        if (!heatmap || !heatmap.tools || heatmap.tools.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无调用数据</div>';
        }
        const { hours, tools, matrix, max } = heatmap;
        const cellSize = 14;
        const gap = 2;
        const labelW = 90;

        let html = `<div style="overflow-x:auto"><div style="display:inline-block;min-width:${labelW + hours.length * (cellSize + gap) + 10}px">`;

        // 小时标签行
        html += `<div style="display:flex;margin-left:${labelW}px;margin-bottom:2px">`;
        hours.forEach((h) => {
            html += `<div style="width:${cellSize}px;margin-right:${gap}px;text-align:center;font-size:9px;color:var(--text-tertiary)">${h}h</div>`;
        });
        html += '</div>';

        // 工具行
        tools.forEach((tool) => {
            const shortName = tool.length > 12 ? tool.slice(0, 12) + '..' : tool;
            html += `<div style="display:flex;align-items:center;margin-bottom:${gap}px">`;
            html += `<div style="width:${labelW}px;font-size:10px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(tool)}">${Components.escapeHtml(shortName)}</div>`;
            hours.forEach((h) => {
                const val = matrix[`${h}_${tool}`] || 0;
                const intensity = max > 0 ? val / max : 0;
                const bg = intensity === 0 ? 'var(--bg-secondary)' : `rgba(99,102,241,${0.15 + intensity * 0.85})`;
                const title = `${tool} @ ${h}:00 \u2192 ${val} 次`;
                html += `<div style="width:${cellSize}px;height:${cellSize}px;border-radius:var(--radius-tag);background:${bg};margin-right:${gap}px;cursor:pointer;transition:transform 0.15s" title="${Components.escapeHtml(title)}" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'"></div>`;
            });
            html += '</div>';
        });

        html += '</div></div>';
        return html;
    }

    function buildHorizontalBar(data, maxBars) {
        maxBars = maxBars || 10;
        if (!data || data.length === 0)
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无数据</div>';
        const maxVal = Math.max(...data.map((d) => d.total_calls), 1);
        const items = data.slice(0, maxBars);
        let html = '';
        items.forEach((d) => {
            const pct = ((d.total_calls / maxVal) * 100).toFixed(1);
            const rateColor =
                d.success_rate >= 90 ? 'var(--green)' : d.success_rate >= 70 ? 'var(--orange)' : 'var(--red)';
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

    function buildTrendSection(trend) {
        return Components.renderSection('7 天趋势（工具调用 + 会话）', buildTrendChart(trend));
    }

    function buildHeatmapSection(heatmap) {
        return Components.renderSection('24h 工具调用热力图', buildHeatmap(heatmap));
    }

    function buildRankingSection(ranking) {
        return Components.renderSection(
            '工具调用排行',
            `
            <div style="display:flex;gap:12px;margin-bottom:8px;font-size:10px;color:var(--text-tertiary)">
                <span style="width:120px">工具名</span>
                <span style="flex:1">调用频次</span>
                <span style="width:50px;text-align:right">次数</span>
                <span style="width:40px;text-align:right">成功率</span>
            </div>
            ${buildHorizontalBar(ranking, 12)}
        `,
        );
    }

    function destroy() {}

    return { buildTrendSection, buildHeatmapSection, buildRankingSection, destroy };
})();

export default TrendChart;
