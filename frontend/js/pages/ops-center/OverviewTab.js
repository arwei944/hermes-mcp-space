/**
 * Ops Center - 实时总览 Tab
 * 健康卡片 + 实时错误流 + SSE 事件流 + API 热力图
 */

import { ERROR_TYPES, HEALTH_THRESHOLDS } from './constants.js';

var OverviewTab = (() => {
    var _destroyed = false;
    var _unwatchers = [];
    var _heatmapData = null;

    // ========== 健康卡片 ==========

    function _getHealthLevel(metrics) {
        var m = metrics || {};
        var cpu = m.cpu_pct != null ? m.cpu_pct : 0;
        var mem = m.memory_pct != null ? m.memory_pct : 0;
        var disk = m.disk_pct != null ? m.disk_pct : 0;

        var t = HEALTH_THRESHOLDS;
        if (cpu >= t.cpu.critical || mem >= t.memory.critical || disk >= t.disk.critical) return 'red';
        if (cpu >= t.cpu.warning || mem >= t.memory.warning || disk >= t.disk.warning) return 'yellow';
        return 'green';
    }

    function _buildHealthCards() {
        var metrics = Store.get('ops.metrics') || {};
        var mcpHealth = Store.get('ops.mcpHealth') || {};
        var frontendErrors = Store.get('ops.frontendErrors') || [];
        var recentErrors = Store.get('ops.recentErrors') || [];

        // 1h 前时间戳
        var oneHourAgo = Date.now() - 3600000;
        var recentCount = recentErrors.filter(function(e) {
            var ts = e.timestamp || e.ts || 0;
            return new Date(ts).getTime() > oneHourAgo;
        }).length;

        var healthLevel = _getHealthLevel(metrics);
        var healthColors = { green: 'var(--green)', yellow: 'var(--yellow)', red: 'var(--red)' };
        var healthLabels = { green: '正常', yellow: '告警', red: '异常' };
        var healthBg = { green: 'var(--green-bg)', yellow: 'var(--yellow-bg)', red: 'var(--red-bg)' };

        var successRate = mcpHealth.success_rate != null ? mcpHealth.success_rate : 0;
        var mcpStatus = mcpHealth.status || 'unknown';
        var mcpStatusMap = {
            healthy: { label: '健康', color: 'var(--green)' },
            warning: { label: '告警', color: 'var(--orange)' },
            critical: { label: '异常', color: 'var(--red)' },
            unknown: { label: '未知', color: 'var(--text-tertiary)' },
        };
        var mcpSt = mcpStatusMap[mcpStatus] || mcpStatusMap.unknown;

        var sseStatus = '已连接';
        var sseColor = 'var(--green)';
        if (typeof SSEManager !== 'undefined' && SSEManager.isPolling()) {
            sseStatus = '轮询';
            sseColor = 'var(--orange)';
        }

        return '<div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px;margin-bottom:20px" class="ops-health-grid">' +
            // 系统健康
            '<div class="stat-card" style="padding:16px;display:flex;flex-direction:column;gap:8px">' +
                '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);font-weight:500">' +
                    Components.icon('activity', 14) + ' 系统健康' +
                '</div>' +
                '<div style="display:flex;align-items:center;gap:8px">' +
                    '<div style="width:10px;height:10px;border-radius:50%;background:' + healthColors[healthLevel] + ';box-shadow:0 0 8px ' + healthColors[healthLevel] + '"></div>' +
                    '<span style="font-size:18px;font-weight:700;color:' + healthColors[healthLevel] + '">' + healthLabels[healthLevel] + '</span>' +
                '</div>' +
                '<div style="font-size:11px;color:var(--text-tertiary)">CPU ' + (metrics.cpu_pct != null ? metrics.cpu_pct.toFixed(1) : 0) + '% / 内存 ' + (metrics.memory_pct != null ? metrics.memory_pct.toFixed(1) : 0) + '%</div>' +
            '</div>' +
            // API 成功率
            '<div class="stat-card" style="padding:16px;display:flex;flex-direction:column;gap:8px">' +
                '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);font-weight:500">' +
                    Components.icon('zap', 14) + ' API 成功率' +
                '</div>' +
                '<span style="font-size:18px;font-weight:700;color:' + (successRate >= 90 ? 'var(--green)' : successRate >= 70 ? 'var(--orange)' : 'var(--red)') + '">' + successRate.toFixed(1) + '%</span>' +
                '<div style="font-size:11px;color:var(--text-tertiary)">总调用 ' + (mcpHealth.total_calls || 0) + ' 次</div>' +
            '</div>' +
            // 前端错误
            '<div class="stat-card" style="padding:16px;display:flex;flex-direction:column;gap:8px">' +
                '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);font-weight:500">' +
                    Components.icon('alertTriangle', 14) + ' 前端错误' +
                '</div>' +
                '<span style="font-size:18px;font-weight:700;color:' + (recentCount > 0 ? 'var(--red)' : 'var(--green)') + '">' + recentCount + '</span>' +
                '<div style="font-size:11px;color:var(--text-tertiary)">最近 1 小时</div>' +
            '</div>' +
            // MCP 状态
            '<div class="stat-card" style="padding:16px;display:flex;flex-direction:column;gap:8px">' +
                '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);font-weight:500">' +
                    Components.icon('cpu', 14) + ' MCP 状态' +
                '</div>' +
                '<span style="font-size:18px;font-weight:700;color:' + mcpSt.color + '">' + mcpSt.label + '</span>' +
                '<div style="font-size:11px;color:var(--text-tertiary)">' + Components.escapeHtml(mcpHealth.summary || mcpHealth.detail || '') + '</div>' +
            '</div>' +
            // SSE 连接
            '<div class="stat-card" style="padding:16px;display:flex;flex-direction:column;gap:8px">' +
                '<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-tertiary);font-weight:500">' +
                    Components.icon('messageCircle', 14) + ' SSE 连接' +
                '</div>' +
                '<span style="font-size:18px;font-weight:700;color:' + sseColor + '">' + sseStatus + '</span>' +
                '<div style="font-size:11px;color:var(--text-tertiary)">实时事件推送</div>' +
            '</div>' +
        '</div>';
    }

    // ========== 实时错误流 ==========

    function _buildErrorStream() {
        var errors = Store.get('ops.recentErrors') || [];
        var display = errors.slice(0, 20);

        if (display.length === 0) {
            return '<div style="text-align:center;color:var(--green);padding:20px;font-size:12px">' +
                Components.icon('checkCircle', 16) + ' 最近没有错误</div>';
        }

        var html = '<div style="display:flex;flex-direction:column;gap:6px;max-height:360px;overflow-y:auto">';
        display.forEach(function(err) {
            var type = err.type || 'js_error';
            var typeConfig = ERROR_TYPES[type] || ERROR_TYPES.js_error;
            var ts = err.timestamp || err.ts || '';
            var timeStr = ts ? Components.formatTime(ts) : '';
            var msg = Components.escapeHtml((err.message || err.msg || '未知错误').slice(0, 120));
            var ctx = Components.escapeHtml(err.context || err.file || err.url || '');

            html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:6px;background:var(--bg-secondary);font-size:12px;transition:background 0.15s">' +
                '<div style="width:8px;height:8px;border-radius:50%;background:' + typeConfig.dot + ';flex-shrink:0;margin-top:4px"></div>' +
                '<div style="flex:1;min-width:0">' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">' +
                        '<span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0">' + timeStr + '</span>' +
                        Components.renderBadge(typeConfig.label, typeConfig.badge) +
                    '</div>' +
                    '<div style="color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + msg + '">' + msg + '</div>' +
                    (ctx ? '<div style="font-size:10px;color:var(--text-tertiary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + ctx + '</div>' : '') +
                '</div>' +
            '</div>';
        });
        html += '</div>';
        return html;
    }

    // ========== SSE 事件流 ==========

    function _buildEventStream() {
        var events = Store.get('ops.recentEvents') || [];
        var display = events.slice(0, 20);

        if (display.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:12px">' +
                Components.icon('clock', 16) + ' 暂无 SSE 事件</div>';
        }

        var html = '<div style="display:flex;flex-direction:column;gap:6px;max-height:360px;overflow-y:auto">';
        display.forEach(function(evt) {
            var type = evt.type || evt.event_type || 'message';
            var ts = evt.timestamp || evt.ts || evt.created_at || '';
            var timeStr = ts ? Components.formatTime(ts) : '';
            var data = evt.data || evt.payload || {};
            var summary = '';

            if (typeof data === 'string') {
                summary = Components.escapeHtml(data.slice(0, 100));
            } else if (typeof data === 'object') {
                summary = Components.escapeHtml(
                    (data.message || data.msg || data.tool || data.action || JSON.stringify(data)).slice(0, 100)
                );
            }

            var badgeColor = 'blue';
            if (type.indexOf('error') !== -1) badgeColor = 'red';
            else if (type.indexOf('alert') !== -1) badgeColor = 'orange';
            else if (type.indexOf('memory') !== -1 || type.indexOf('skill') !== -1) badgeColor = 'green';

            html += '<div style="display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border-radius:6px;background:var(--bg-secondary);font-size:12px">' +
                '<div style="flex:1;min-width:0">' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">' +
                        '<span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0">' + timeStr + '</span>' +
                        Components.renderBadge(type, badgeColor) +
                    '</div>' +
                    '<div style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + summary + '</div>' +
                '</div>' +
            '</div>';
        });
        html += '</div>';
        return html;
    }

    // ========== API 热力图 ==========

    function _buildHeatmap() {
        if (!_heatmapData || !_heatmapData.endpoints || _heatmapData.endpoints.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:30px;font-size:12px">暂无热力图数据</div>';
        }

        var endpoints = _heatmapData.endpoints;
        var hours = _heatmapData.hours || 24;
        var maxCount = _heatmapData.max_count || 1;

        var html = '<div style="overflow-x:auto">' +
            '<div style="display:grid;grid-template-columns:140px repeat(' + hours + ', 1fr);gap:2px;min-width:700px;font-size:10px">';

        // Header row: hour labels
        html += '<div style="padding:4px"></div>';
        for (var h = 0; h < hours; h++) {
            html += '<div style="text-align:center;padding:2px;color:var(--text-tertiary)">' + h + '</div>';
        }

        // Data rows
        endpoints.forEach(function(ep) {
            html += '<div style="padding:4px 6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text-secondary);font-size:10px" title="' + Components.escapeHtml(ep.path || ep.name || '') + '">' +
                Components.escapeHtml((ep.path || ep.name || '').split('/').slice(-2).join('/')) +
            '</div>';
            var counts = ep.counts || ep.data || [];
            for (var h2 = 0; h2 < hours; h2++) {
                var count = counts[h2] || 0;
                var intensity = maxCount > 0 ? count / maxCount : 0;
                var bg = 'var(--bg-secondary)';
                if (intensity > 0) {
                    if (intensity > 0.75) bg = 'rgba(239,68,68,' + (0.3 + intensity * 0.7) + ')';
                    else if (intensity > 0.5) bg = 'rgba(249,115,22,' + (0.3 + intensity * 0.5) + ')';
                    else if (intensity > 0.25) bg = 'rgba(234,179,8,' + (0.3 + intensity * 0.4) + ')';
                    else bg = 'rgba(34,197,94,' + (0.2 + intensity * 0.5) + ')';
                }
                html += '<div style="padding:4px 2px;text-align:center;background:' + bg + ';border-radius:2px;min-height:20px;color:var(--text-tertiary)" title="' + Components.escapeHtml(ep.path || ep.name || '') + ' ' + h2 + ':00 - ' + count + ' 次">' +
                    (count > 0 ? count : '') +
                '</div>';
            }
        });

        html += '</div></div>';

        // Legend
        html += '<div style="display:flex;align-items:center;gap:8px;margin-top:8px;justify-content:flex-end;font-size:10px;color:var(--text-tertiary)">' +
            '<span>少</span>' +
            '<div style="width:12px;height:12px;border-radius:2px;background:rgba(34,197,94,0.3)"></div>' +
            '<div style="width:12px;height:12px;border-radius:2px;background:rgba(234,179,8,0.5)"></div>' +
            '<div style="width:12px;height:12px;border-radius:2px;background:rgba(249,115,22,0.6)"></div>' +
            '<div style="width:12px;height:12px;border-radius:2px;background:rgba(239,68,68,0.8)"></div>' +
            '<span>多</span>' +
        '</div>';

        return html;
    }

    // ========== 数据加载 ==========

    function _loadHeatmap() {
        API.get('/api/dashboard/heatmap').then(function(data) {
            if (_destroyed) return;
            _heatmapData = data;
            var el = document.getElementById('opsOverviewHeatmap');
            if (el) el.innerHTML = _buildHeatmap();
        }).catch(function() {
            // 静默失败
        });
    }

    // ========== Store 订阅 ==========

    function _subscribeStore() {
        _unwatchers.push(
            Store.watch('ops.metrics', function() {
                if (_destroyed) return;
                var el = document.getElementById('opsOverviewHealthCards');
                if (el) el.innerHTML = _buildHealthCards();
            })
        );
        _unwatchers.push(
            Store.watch('ops.mcpHealth', function() {
                if (_destroyed) return;
                var el = document.getElementById('opsOverviewHealthCards');
                if (el) el.innerHTML = _buildHealthCards();
            })
        );
        _unwatchers.push(
            Store.watch('ops.recentErrors', function() {
                if (_destroyed) return;
                var el = document.getElementById('opsOverviewErrorStream');
                if (el) el.innerHTML = _buildErrorStream();
                // Also update health cards (error count)
                var hc = document.getElementById('opsOverviewHealthCards');
                if (hc) hc.innerHTML = _buildHealthCards();
            })
        );
        _unwatchers.push(
            Store.watch('ops.recentEvents', function() {
                if (_destroyed) return;
                var el = document.getElementById('opsOverviewEventStream');
                if (el) el.innerHTML = _buildEventStream();
            })
        );
    }

    function _unsubscribeStore() {
        _unwatchers.forEach(function(unwatch) { unwatch(); });
        _unwatchers = [];
    }

    // ========== 公开方法 ==========

    function buildOverviewTab() {
        return '<div id="opsOverviewHealthCards">' + _buildHealthCards() + '</div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px" class="ops-overview-two-col">' +
                Components.renderSection(
                    Components.icon('alertTriangle', 14) + ' 实时错误流',
                    '<div id="opsOverviewErrorStream">' + _buildErrorStream() + '</div>'
                ) +
                Components.renderSection(
                    Components.icon('messageCircle', 14) + ' SSE 事件流',
                    '<div id="opsOverviewEventStream">' + _buildEventStream() + '</div>'
                ) +
            '</div>' +
            Components.renderSection(
                Components.icon('activity', 14) + ' API 调用热力图（24小时）',
                '<div id="opsOverviewHeatmap">' + _buildHeatmap() + '</div>'
            );
    }

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // 加载热力图数据
        _loadHeatmap();

        if (_destroyed) return;
        container.innerHTML = buildOverviewTab();

        // 订阅 Store 实时更新
        _subscribeStore();
    }

    function destroy() {
        _destroyed = true;
        _unsubscribeStore();
    }

    return { buildOverviewTab, render, destroy };
})();

export default OverviewTab;
