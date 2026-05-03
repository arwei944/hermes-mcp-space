/**
 * Ops Center - 代码质量 Tab
 * AI 调用评估: 摘要卡片 + 工具性能表 + 错误模式 + 7天趋势
 */

var QualityTab = (() => {
    var _destroyed = false;
    var _summary = null;
    var _tools = [];
    var _errors = [];
    var _trend = [];

    // ========== 摘要卡片 ==========

    function _buildSummaryCards() {
        var s = _summary || {};
        var totalCalls = s.total_calls || 0;
        var successRate = s.success_rate != null ? s.success_rate : 0;
        var avgLatency = s.avg_latency_ms || 0;
        var errorToolCount = _errors.length;

        var rateColor = successRate >= 95 ? 'var(--green)' : successRate >= 80 ? 'var(--orange)' : 'var(--red)';

        return '<div class="stats">' +
            Components.renderStatCard('总调用次数', totalCalls, '', 'activity', 'blue') +
            Components.renderStatCard('成功率', successRate.toFixed(1) + '%', '', 'checkCircle', successRate >= 95 ? 'green' : successRate >= 80 ? 'orange' : 'red') +
            Components.renderStatCard('平均延迟', avgLatency + 'ms', '', 'clock', 'blue') +
            Components.renderStatCard('错误工具数', errorToolCount, '', 'alertTriangle', errorToolCount > 0 ? 'red' : 'green') +
        '</div>';
    }

    // ========== 工具性能表 ==========

    function _buildToolsTable() {
        if (!_tools || _tools.length === 0) {
            return Components.createEmptyState(Components.icon('cpu', 48), '暂无工具数据', '等待评估数据收集', '');
        }

        // 按调用次数降序排序
        var sorted = _tools.slice().sort(function(a, b) {
            return (b.total_calls || b.count || 0) - (a.total_calls || a.count || 0);
        });

        var html = '<div class="table-wrapper"><table class="table">' +
            '<thead><tr><th>工具名</th><th>调用次数</th><th>成功率</th><th>平均延迟</th><th>状态</th></tr></thead>' +
            '<tbody>';

        sorted.forEach(function(tool) {
            var name = tool.tool || tool.name || '-';
            var calls = tool.total_calls || tool.count || 0;
            var rate = tool.success_rate != null ? tool.success_rate : 0;
            var latency = tool.avg_latency_ms || tool.avg_latency || 0;

            var rateColor = rate >= 95 ? 'var(--green)' : rate >= 80 ? 'var(--orange)' : 'var(--red)';
            var statusBadge = rate >= 95 ? Components.renderBadge('正常', 'green') : rate >= 80 ? Components.renderBadge('注意', 'orange') : Components.renderBadge('异常', 'red');

            html += '<tr>' +
                '<td style="font-weight:500" title="' + Components.escapeHtml(name) + '">' +
                    '<span style="display:inline-flex;align-items:center;gap:4px">' +
                        Components.icon('bot', 12) +
                        Components.escapeHtml(name.length > 30 ? name.slice(0, 30) + '...' : name) +
                    '</span>' +
                '</td>' +
                '<td class="mono" style="font-weight:600">' + calls + '</td>' +
                '<td class="mono" style="font-weight:600;color:' + rateColor + '">' + rate.toFixed(1) + '%</td>' +
                '<td class="mono" style="font-size:12px">' + latency.toFixed(0) + 'ms</td>' +
                '<td>' + statusBadge + '</td>' +
            '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    // ========== 错误模式 ==========

    function _buildErrorPatterns() {
        if (!_errors || _errors.length === 0) {
            return '<div style="text-align:center;color:var(--green);padding:20px;font-size:12px">' +
                Components.icon('checkCircle', 16) + ' 没有错误模式</div>';
        }

        var top5 = _errors.slice(0, 5);
        var html = '<div style="display:flex;flex-direction:column;gap:8px">';

        top5.forEach(function(err) {
            var toolName = err.tool || err.name || '-';
            var message = err.error || err.message || err.error_message || '未知错误';
            var count = err.count || err.occurrences || 1;
            var lastSeen = err.last_seen || err.last_occurrence || '';

            html += '<div style="padding:12px;border-radius:var(--radius-sm);background:var(--red-bg);border-left:3px solid var(--red)">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
                    '<span style="font-weight:600;color:var(--red);font-size:13px">' + Components.escapeHtml(toolName) + '</span>' +
                    Components.renderBadge(count + ' 次', 'red') +
                '</div>' +
                '<div style="font-size:12px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + Components.escapeHtml(message) + '">' +
                    Components.escapeHtml(message.slice(0, 100)) +
                '</div>' +
                (lastSeen ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:4px">最后出现: ' + Components.formatDateTime(lastSeen) + '</div>' : '') +
            '</div>';
        });

        html += '</div>';
        return html;
    }

    // ========== 7天趋势 ==========

    function _buildTrendChart() {
        if (!_trend || _trend.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:12px">暂无趋势数据</div>';
        }

        var maxVal = 1;
        _trend.forEach(function(d) {
            var total = (d.success_count || d.success || 0) + (d.error_count || d.error || 0);
            if (total > maxVal) maxVal = total;
        });

        var html = '<div style="display:flex;align-items:flex-end;gap:8px;height:160px;padding:0 4px">';

        _trend.forEach(function(d) {
            var success = d.success_count || d.success || 0;
            var error = d.error_count || d.error || 0;
            var date = d.date || d.day || '';
            var label = date.length > 5 ? date.slice(5) : date; // MM-DD

            var successH = maxVal > 0 ? (success / maxVal * 140) : 0;
            var errorH = maxVal > 0 ? (error / maxVal * 140) : 0;

            html += '<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0">' +
                '<div style="display:flex;align-items:flex-end;gap:2px;height:140px">' +
                    '<div style="width:12px;height:' + Math.max(successH, 2) + 'px;background:var(--green);border-radius:2px 2px 0 0;transition:height 0.3s" title="成功: ' + success + '"></div>' +
                    '<div style="width:12px;height:' + Math.max(errorH, error > 0 ? 2 : 0) + 'px;background:var(--red);border-radius:2px 2px 0 0;transition:height 0.3s" title="错误: ' + error + '"></div>' +
                '</div>' +
                '<div style="font-size:9px;color:var(--text-tertiary);white-space:nowrap">' + Components.escapeHtml(label) + '</div>' +
            '</div>';
        });

        html += '</div>';

        // Legend
        html += '<div style="display:flex;align-items:center;gap:16px;justify-content:center;margin-top:8px;font-size:10px;color:var(--text-tertiary)">' +
            '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--green);border-radius:2px"></span>成功</span>' +
            '<span style="display:flex;align-items:center;gap:4px"><span style="width:10px;height:10px;background:var(--red);border-radius:2px"></span>错误</span>' +
        '</div>';

        return html;
    }

    // ========== 数据加载 ==========

    function _loadData() {
        Promise.all([
            API.get('/api/evals/summary').catch(function() { return null; }),
            API.get('/api/evals/tools').catch(function() { return []; }),
            API.get('/api/evals/errors').catch(function() { return []; }),
            API.get('/api/evals/trend', { days: 7 }).catch(function() { return []; }),
        ]).then(function(results) {
            if (_destroyed) return;
            _summary = results[0] || {};
            _tools = results[1] || [];
            _errors = results[2] || [];
            _trend = results[3] || [];

            // 增量更新各区域
            var summaryEl = document.getElementById('opsQualitySummary');
            if (summaryEl) summaryEl.innerHTML = _buildSummaryCards();

            var toolsEl = document.getElementById('opsQualityTools');
            if (toolsEl) toolsEl.innerHTML = _buildToolsTable();

            var errorsEl = document.getElementById('opsQualityErrors');
            if (errorsEl) errorsEl.innerHTML = _buildErrorPatterns();

            var trendEl = document.getElementById('opsQualityTrend');
            if (trendEl) trendEl.innerHTML = _buildTrendChart();
        }).catch(function() {
            // 静默失败
        });
    }

    // ========== 公开方法 ==========

    function buildQualityTab() {
        return '<div id="opsQualitySummary">' + _buildSummaryCards() + '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px" class="ops-quality-two-col">' +
                Components.renderSection(
                    Components.icon('bot', 14) + ' 工具性能排行',
                    '<div id="opsQualityTools">' + _buildToolsTable() + '</div>'
                ) +
                Components.renderSection(
                    Components.icon('alertTriangle', 14) + ' 错误模式 TOP 5',
                    '<div id="opsQualityErrors">' + _buildErrorPatterns() + '</div>'
                ) +
            '</div>' +
            Components.renderSection(
                Components.icon('activity', 14) + ' 7 天调用趋势',
                '<div id="opsQualityTrend">' + _buildTrendChart() + '</div>'
            );
    }

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // 加载数据
        _loadData();

        if (_destroyed) return;
        container.innerHTML = buildQualityTab();
    }

    function destroy() {
        _destroyed = true;
    }

    return { buildQualityTab, render, destroy };
})();

export default QualityTab;
