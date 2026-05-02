/**
 * Agent 行为管理页面 - 行为统计 Tab
 * 统计卡片 + 工具调用排行 + 行为分析（错误模式/最佳实践/用户偏好）
 */

import BehaviorLog from './BehaviorLog.js';

const StatsTab = (() => {
    // ========== 私有状态 ==========
    let _ranking = [];
    let _analysis = null;

    // ========== 数据加载 ==========

    async function loadData() {
        const [ranking, analysis] = await Promise.all([
            API.get('/api/dashboard/ranking').catch(() => []),
            API.get('/api/knowledge/analysis').catch(() => null),
        ]);
        _ranking = ranking || [];
        _analysis = analysis || null;
    }

    // ========== SSE 事件处理 ==========

    function onSSEEvent(type, _data) {
        if (type === 'mcp.tool_complete') {
            // 刷新统计
            _loadRanking();
            _loadAnalysis();
        }
    }

    function _loadRanking() {
        API.get('/api/dashboard/ranking')
            .then((data) => {
                _ranking = data || [];
                updateStatsTab();
            })
            .catch(() => {});
    }

    function _loadAnalysis() {
        API.get('/api/knowledge/analysis')
            .then((data) => {
                _analysis = data || null;
                updateStatsTab();
            })
            .catch(() => {});
    }

    // ========== 内容构建 ==========

    function buildContent() {
        const rankingHtml = buildRankingSection();
        const analysisHtml = buildAnalysisSection();
        const logStatsHtml = buildLogStatsSection();

        return `<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${Components.icon('barChart', 16)} 行为统计</span>
            <button type="button" class="btn btn-sm btn-ghost" data-action="refreshStats" style="margin-left:auto">${Components.icon('refresh', 12)} 刷新</button>
        </div>
        ${logStatsHtml}
        <div style="margin-top:16px">
            ${rankingHtml}
        </div>
        <div style="margin-top:16px">
            ${analysisHtml}
        </div>`;
    }

    // ========== 统计卡片 ==========

    function buildLogStatsSection() {
        const log = BehaviorLog.getLog();
        const total = log.length;
        const successCount = log.filter((e) => e.success).length;
        const failCount = total - successCount;
        const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0.0';
        const avgDuration = total > 0 ? Math.round(log.reduce((sum, e) => sum + (e.duration || 0), 0) / total) : 0;

        // 工具调用频率统计
        const toolFreq = {};
        log.forEach((e) => {
            const t = e.tool || 'unknown';
            toolFreq[t] = (toolFreq[t] || 0) + 1;
        });
        const topTools = Object.entries(toolFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        let topToolsHtml = '';
        if (topTools.length > 0) {
            topToolsHtml = '<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">最近行为 Top 工具</div>';
            topTools.forEach(([tool, count]) => {
                const pct = ((count / total) * 100).toFixed(1);
                topToolsHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span style="width:140px;font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0" title="${Components.escapeHtml(tool)}">${Components.escapeHtml(tool)}</span>
                    <div style="flex:1;height:14px;background:var(--bg-secondary);border-radius:var(--radius-sm);overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:var(--radius-sm);transition:width 0.6s ease"></div>
                    </div>
                    <span style="width:40px;text-align:right;font-size:11px;color:var(--text-primary);font-weight:600;flex-shrink:0">${count}</span>
                </div>`;
            });
            topToolsHtml += '</div>';
        }

        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
            ${_buildStatCard(Components.icon('activity', 20), '行为事件', total, 'SSE 实时推送', 'var(--blue)')}
            ${_buildStatCard(Components.icon('check', 20), '成功', successCount, `成功率 ${successRate}%`, 'var(--green)')}
            ${_buildStatCard(Components.icon('x', 20), '失败', failCount, total > 0 ? `${((failCount / total) * 100).toFixed(1)}%` : '-', 'var(--red)')}
            ${_buildStatCard(Components.icon('zap', 20), '平均耗时', `${avgDuration}ms`, '工具调用延迟', 'var(--orange)')}
        </div>
        ${topToolsHtml}`;
    }

    function _buildStatCard(icon, label, value, desc, color) {
        return `<div style="background:var(--bg-secondary);border-radius:12px;padding:16px;border-left:3px solid ${color};cursor:default;transition:transform 0.15s">
            <div style="font-size:20px;margin-bottom:4px">${icon}</div>
            <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${value}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${label}</div>
            <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">${desc}</div>
        </div>`;
    }

    // ========== 工具调用排行 ==========

    function buildRankingSection() {
        if (!_ranking || _ranking.length === 0) {
            return Components.renderSection('工具调用排行', '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无排行数据</div>');
        }

        const maxVal = Math.max(..._ranking.map((d) => d.total_calls || 0), 1);
        const items = _ranking.slice(0, 10);

        let barsHtml = '';
        items.forEach((d) => {
            const calls = d.total_calls || 0;
            const pct = ((calls / maxVal) * 100).toFixed(1);
            const rate = d.success_rate || 0;
            const rateColor = rate >= 90 ? 'var(--green)' : rate >= 70 ? 'var(--orange)' : 'var(--red)';
            barsHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:140px;font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0" title="${Components.escapeHtml(d.tool)}">${Components.escapeHtml(d.tool)}</div>
                <div style="flex:1;height:18px;background:var(--bg-secondary);border-radius:var(--radius-sm);overflow:hidden;position:relative">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:var(--radius-sm);transition:width 0.6s ease"></div>
                </div>
                <div style="width:50px;text-align:right;font-size:11px;color:var(--text-primary);font-weight:600;flex-shrink:0">${calls}</div>
                <div style="width:40px;text-align:right;font-size:10px;color:${rateColor};flex-shrink:0">${rate}%</div>
            </div>`;
        });

        return Components.renderSection(
            '工具调用排行',
            `<div style="display:flex;gap:12px;margin-bottom:8px;font-size:10px;color:var(--text-tertiary)">
                <span style="width:140px">工具名</span>
                <span style="flex:1">调用频次</span>
                <span style="width:50px;text-align:right">次数</span>
                <span style="width:40px;text-align:right">成功率</span>
            </div>
            ${barsHtml}`,
        );
    }

    // ========== 行为分析 ==========

    function buildAnalysisSection() {
        const a = _analysis || {};
        const errors = a.errors || [];
        const patterns = a.patterns || [];
        const prefs = a.preferences || [];

        let html = '';

        // 错误模式
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('alertTriangle', 14)} 错误模式 (${errors.length})</div>`;
        if (errors.length === 0) {
            html += `<div style="font-size:12px;color:var(--green);padding:8px">${Components.icon('check', 12)} 没有检测到错误模式</div>`;
        } else {
            errors.slice(0, 6).forEach((e) => {
                const statusColor = e.is_fixed ? 'var(--green)' : 'var(--red)';
                const statusText = e.is_fixed ? Components.icon('check', 10) + ' 已修复' : Components.icon('alertTriangle', 10) + ' 未修复';
                const severityColor = e.severity === 'high' ? 'var(--red)' : e.severity === 'medium' ? 'var(--orange)' : 'var(--text-tertiary)';
                html += `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;border-left:3px solid ${statusColor}">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(e.tool)}</span>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span style="font-size:10px;color:${severityColor};background:${severityColor}15;padding:2px 6px;border-radius:var(--radius-tag)">${e.severity}</span>
                            <span style="font-size:10px;color:${statusColor}">${statusText}</span>
                            <span style="font-size:10px;color:var(--text-tertiary)">${e.count}次</span>
                        </div>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">${Components.escapeHtml(e.error_type)}</div>
                    <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(e.latest_err || '')}">${Components.escapeHtml(e.latest_err || '')}</div>
                </div>`;
            });
        }
        html += '</div>';

        // 最佳实践
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('checkCircle', 14)} 最佳实践 (${patterns.length})</div>`;
        if (patterns.length === 0) {
            html += '<div style="font-size:12px;color:var(--text-tertiary);padding:8px">暂无足够数据</div>';
        } else {
            patterns.slice(0, 5).forEach((p) => {
                html += `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;border-left:3px solid var(--green)">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(p.tool)}</span>
                        <span style="font-size:10px;color:var(--green)">${p.success_rate}% 成功 · ${p.avg_latency_ms}ms</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">${Components.escapeHtml(p.recommendation)}</div>
                </div>`;
            });
        }
        html += '</div>';

        // 用户偏好
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('brain', 14)} 用户偏好 (${prefs.length})</div>`;
        if (prefs.length === 0) {
            html += '<div style="font-size:12px;color:var(--text-tertiary);padding:8px">暂无足够数据</div>';
        } else {
            prefs.slice(0, 5).forEach((p) => {
                const confColor = p.confidence === 'high' ? 'var(--green)' : p.confidence === 'medium' ? 'var(--orange)' : 'var(--text-tertiary)';
                html += `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;border-left:3px solid var(--blue)">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                        <span style="font-size:12px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(p.category)}</span>
                        <span style="font-size:10px;color:${confColor};background:${confColor}15;padding:1px 5px;border-radius:var(--radius-tag)">${p.confidence}</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">${Components.escapeHtml(p.content)}</div>
                </div>`;
            });
        }
        html += '</div>';

        return Components.renderSection('行为分析', html);
    }

    // ========== 增量更新 ==========

    function updateStatsTab() {
        const el = document.getElementById('abContent');
        if (!el) return;
        el.innerHTML = buildContent();
    }

    // ========== 操作函数 ==========

    function refreshStats() {
        Components.Toast.info('正在刷新统计数据...');
        _loadRanking();
        _loadAnalysis();
    }

    // ========== 生命周期 ==========

    function destroy() {
        _ranking = [];
        _analysis = null;
    }

    return {
        loadData,
        onSSEEvent,
        buildContent,
        refreshStats,
        destroy,
    };
})();

export default StatsTab;
