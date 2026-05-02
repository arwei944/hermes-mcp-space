/**
 * 运维监控仪表盘页面 - SVG 趋势图表
 * 资源趋势折线图（双 Y 轴）+ 水平条形图
 */

const TrendChart = (() => {

    /**
     * 资源趋势折线图（双 Y 轴）
     * 左轴: CPU/内存百分比 (0-100)
     * 右轴: 网络速率
     */
    function buildTrendChart(data) {
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
     * 水平条形图
     */
    function buildHorizontalBar(items, maxBars) {
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

    return { buildTrendChart, buildHorizontalBar };
})();

export default TrendChart;
