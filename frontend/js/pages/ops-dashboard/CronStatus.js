/**
 * 运维监控仪表盘页面 - 定时任务状态
 * 统计卡片 + 最近执行记录列表
 */

const CronStatus = (() => {

    /**
     * 构建定时任务状态区域
     */
    function buildCronStatus(cron) {
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

                recordsHtml += `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:6px;font-size:12px;transition:background 0.15s;border-bottom:1px solid var(--border)" data-action="cron-row-hover">
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

    return { buildCronStatus };
})();

export default CronStatus;
