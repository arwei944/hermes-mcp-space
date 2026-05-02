/**
 * 仪表盘页面 - 活动流模块
 * 负责：实时活动流构建、错误追踪卡片
 */

const ActivityFeed = (() => {

    function buildActivityFeed(activities) {
        if (!activities || activities.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:24px">暂无活动记录</div>';
        }
        let html =
            '<div id="activityFeed" style="display:flex;flex-direction:column;gap:2px;max-height:380px;overflow-y:auto;padding-right:4px">';
        activities.forEach((a) => {
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
                const levelColor =
                    { info: 'var(--blue)', success: 'var(--green)', warning: 'var(--orange)', error: 'var(--red)' }[
                        a.level
                    ] || 'var(--text-tertiary)';
                const levelIcon =
                    {
                        info: Components.icon('info', 16),
                        success: Components.icon('check', 20),
                        warning: Components.icon('alertTriangle', 14),
                        error: Components.icon('x', 14),
                    }[a.level] || '\u2022';
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
            return (
                '<div style="text-align:center;color:var(--green);padding:16px;font-size:13px">' +
                Components.icon('check', 14) +
                ' 最近没有错误</div>'
            );
        }
        let html = '';
        errors.slice(0, 8).forEach((e) => {
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

    function buildSection(activities) {
        return Components.renderSection('实时活动流', buildActivityFeed(activities));
    }

    function buildErrorSection(errors) {
        return Components.renderSection('错误追踪', buildErrorCards(errors));
    }

    function updateFeed(activities) {
        const el = document.getElementById('activityFeed');
        if (!el) return;
        el.innerHTML = buildActivityFeed(activities);
    }

    function destroy() {}

    return { buildSection, buildErrorSection, updateFeed, destroy };
})();

export default ActivityFeed;
