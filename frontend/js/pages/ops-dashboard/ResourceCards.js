/**
 * 运维监控仪表盘页面 - 系统资源统计卡片
 * CPU / 内存 / 磁盘 / 网络吞吐
 */

const ResourceCards = (() => {

    /**
     * 环形仪表盘
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
     * 网络速率格式化
     */
    function _formatNetSpeed(bytes) {
        if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB/s';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB/s';
        return bytes.toFixed(0) + ' B/s';
    }

    /**
     * 构建实时资源监控卡片（顶部 4 个横排）
     */
    function buildResourceCards(metrics) {
        const m = metrics || {};
        const cpu = m.cpu_pct != null ? m.cpu_pct : 0;
        const mem = m.memory_pct != null ? m.memory_pct : 0;
        const disk = m.disk_pct != null ? m.disk_pct : 0;
        const netUp = m.network_up || 0;
        const netDown = m.network_down || 0;

        // 网络卡片
        const netCard = `<div class="stat-card" style="display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px">
            <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                ${Components.icon('activity', 16)}
                <span style="font-size:11px;color:var(--text-tertiary);font-weight:500">网络吞吐</span>
            </div>
            <div style="display:flex;gap:20px;align-items:center">
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                    <span style="font-size:10px;color:var(--blue);font-weight:500">${Components.icon('upload', 12)} 上行</span>
                    <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${_formatNetSpeed(netUp)}</span>
                </div>
                <div style="width:1px;height:30px;background:var(--border)"></div>
                <div style="display:flex;flex-direction:column;align-items:center;gap:2px">
                    <span style="font-size:10px;color:var(--purple);font-weight:500">${Components.icon('download', 12)} 下行</span>
                    <span style="font-size:16px;font-weight:700;color:var(--text-primary)">${_formatNetSpeed(netDown)}</span>
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

    return { buildResourceCards };
})();

export default ResourceCards;
