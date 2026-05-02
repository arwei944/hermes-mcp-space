/**
 * 仪表盘页面 - 统计区域模块
 * 负责：统计卡片、智能体信息卡片、系统心跳（含仪表盘）
 */

const StatsSection = (() => {

    function buildStats(data) {
        const s = data.stats || {};
        const sys = data.systemStatus || {};
        return `<div id="dashStats" class="stats">
            ${Components.renderStatCard('总调用', s.totalToolCalls || 0, `成功率 ${s.successRate || 0}%`, 'chart', 'blue')}
            ${Components.renderStatCard('平均延迟', `${s.avgLatency || 0}ms`, '', 'zap', 'green')}
            ${Components.renderStatCard('会话数', s.sessions || 0, `${s.activeSessions || 0} 活跃`, 'messageCircle', 'purple')}
            ${Components.renderStatCard('工具', s.tools || 0, `${s.skills || 0} 技能`, 'wrench', 'orange')}
            ${Components.renderStatCard('成功率', `${s.successRate || 0}%`, '', 'check', 'green')}
            ${Components.renderStatCard('MCP', s.mcpConnected ? '在线' : '离线', sys.version || '', 'plug', s.mcpConnected ? 'green' : 'red')}
        </div>`;
    }

    function updateStats(data) {
        const s = data.stats || {};
        const sys = data.systemStatus || {};
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

    function buildAgentCards(data) {
        const s = data.stats || {};
        const sys = data.systemStatus || {};

        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;margin-top:16px">
            <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;border:1px solid var(--border);border-left:3px solid var(--accent)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    ${Components.icon('ghost', 18)}
                    <span style="font-weight:600;font-size:14px">Hermes Agent</span>
                    ${Components.renderBadge('运行中', 'green')}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.8">
                    <div>版本: <span class="mono">${Components.escapeHtml(sys.version || '-')}</span></div>
                    <div>运行时间: ${Components.escapeHtml(sys.uptime || '-')}</div>
                    <div>MCP 工具: ${s.tools || 0} 个</div>
                    <div>技能: ${s.skills || 0} 个</div>
                </div>
            </div>
            <div style="background:var(--bg-secondary);border-radius:12px;padding:16px;border:1px solid var(--border);border-left:3px solid var(--blue)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                    ${Components.icon('activity', 18)}
                    <span style="font-weight:600;font-size:14px">调用可视化</span>
                </div>
                <div style="font-size:12px;color:var(--text-secondary);line-height:1.8">
                    <div>总调用: <span style="font-weight:600;color:var(--text-primary)">${s.totalToolCalls || 0}</span> 次</div>
                    <div>成功率: <span style="font-weight:600;color:var(--green)">${s.successRate || 0}%</span></div>
                    <div>平均延迟: <span style="font-weight:600">${s.avgLatency || 0}ms</span></div>
                    <div>活跃会话: <span style="font-weight:600;color:var(--blue)">${s.activeSessions || 0}</span></div>
                </div>
            </div>
        </div>`;
    }

    function buildGauge(value, max, label, color, unit) {
        unit = unit || '';
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

    function buildHeartbeat(data) {
        const s = data.stats || {};
        const sys = data.systemStatus || {};
        const memPct = sys.totalMemMb > 0 ? (sys.memMb / sys.totalMemMb) * 100 : 0;

        return Components.renderSection(
            '系统心跳',
            `
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
        `,
        );
    }

    function destroy() {}

    return { buildStats, updateStats, buildAgentCards, buildHeartbeat, destroy };
})();

export default StatsSection;
