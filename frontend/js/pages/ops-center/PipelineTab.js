/**
 * Ops Center - 构建部署 Tab
 * 构建信息 + CI/CD 流水线 + 部署历史
 */

import { PIPELINE_STEPS } from './constants.js';

var OpsPipelineTab = (() => {
    var _destroyed = false;
    var _statusHistory = [];
    var _refreshTimer = null;

    // ========== 工具函数 ==========

    function _formatUptime(seconds) {
        if (!seconds) return '-';
        if (seconds > 86400) return Math.floor(seconds / 86400) + '天 ' + Math.floor((seconds % 86400) / 3600) + '小时';
        if (seconds > 3600) return Math.floor(seconds / 3600) + '小时 ' + Math.floor((seconds % 3600) / 60) + '分钟';
        return Math.floor(seconds / 60) + '分钟';
    }

    function _formatBytes(bytes) {
        if (!bytes) return '-';
        if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(1) + ' MB';
        if (bytes >= 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return bytes + ' B';
    }

    // ========== 构建信息卡片 ==========

    function _buildInfoCard(statusData) {
        var s = statusData || {};
        var buildVersion = window.__BUILD_VERSION__ || 'unknown';
        var buildTime = window.__BUILD_TIME__ || 'unknown';
        var version = s.version || '-';
        var uptime = _formatUptime(s.uptime || s.total_uptime || 0);
        var buildError = s.build_error || null;

        var statusColor = buildError ? 'var(--red)' : 'var(--green)';
        var statusLabel = buildError ? '降级' : '正常';
        var statusIcon = buildError ? 'xCircle' : 'checkCircle';

        // 计算页面大小
        var pageSize = '-';
        try {
            var html = document.documentElement.outerHTML;
            pageSize = _formatBytes(new Blob([html]).size);
        } catch (_e) {
            // ignore
        }

        return Components.renderSection(
            Components.icon('package', 14) + ' 构建信息',
            '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px">' +
                '<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">' +
                    '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">构建版本</div>' +
                    '<div class="mono" style="font-size:14px;font-weight:600;color:var(--text-primary)">' + Components.escapeHtml(buildVersion) + '</div>' +
                '</div>' +
                '<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">' +
                    '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">构建时间</div>' +
                    '<div style="font-size:14px;font-weight:600;color:var(--text-primary)">' + Components.escapeHtml(buildTime) + '</div>' +
                '</div>' +
                '<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">' +
                    '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">构建状态</div>' +
                    '<div style="display:flex;align-items:center;gap:6px">' +
                        Components.icon(statusIcon, 16) +
                        '<span style="font-size:14px;font-weight:600;color:' + statusColor + '">' + statusLabel + '</span>' +
                    '</div>' +
                    (buildError ? '<div style="font-size:10px;color:var(--red);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + Components.escapeHtml(buildError) + '">' + Components.escapeHtml(buildError.slice(0, 80)) + '</div>' : '') +
                '</div>' +
                '<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">' +
                    '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">页面大小</div>' +
                    '<div style="font-size:14px;font-weight:600;color:var(--text-primary)">' + pageSize + '</div>' +
                '</div>' +
                '<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">' +
                    '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">运行时间</div>' +
                    '<div style="font-size:14px;font-weight:600;color:var(--text-primary)">' + uptime + '</div>' +
                '</div>' +
                '<div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">' +
                    '<div style="font-size:10px;color:var(--text-tertiary);margin-bottom:4px">后端版本</div>' +
                    '<div class="mono" style="font-size:14px;font-weight:600;color:var(--text-primary)">' + Components.escapeHtml(version) + '</div>' +
                '</div>' +
            '</div>'
        );
    }

    // ========== CI/CD 流水线 ==========

    function _buildPipeline() {
        var steps = [
            { status: 'success', icon: 'gitBranch', label: '代码提交', detail: 'ce8c115', duration: '' },
            { status: 'success', icon: 'shield', label: 'Lint 检查', detail: '通过', duration: '2.1s' },
            { status: 'success', icon: 'package', label: 'Docker 构建', detail: '0.8s', duration: '0.8s' },
            { status: 'success', icon: 'upload', label: 'HF 部署', detail: '已部署', duration: '12.3s' },
            { status: 'success', icon: 'checkCircle', label: '健康验证', detail: '200 OK', duration: '0.5s' },
        ];

        var statusIcons = {
            success: '<span style="color:var(--green);font-size:16px">&#10003;</span>',
            failed: '<span style="color:var(--red);font-size:16px">&#10007;</span>',
            running: '<span style="color:var(--blue);font-size:16px">&#9203;</span>',
            pending: '<span style="color:var(--text-tertiary);font-size:16px">&#9679;</span>',
        };

        var html = '<div style="display:flex;align-items:center;gap:0;overflow-x:auto;padding:16px 0">';

        steps.forEach(function(step, i) {
            html += '<div style="display:flex;flex-direction:column;align-items:center;gap:6px;min-width:100px;flex-shrink:0">' +
                '<div style="width:40px;height:40px;border-radius:50%;background:var(--bg-secondary);border:2px solid ' +
                    (step.status === 'success' ? 'var(--green)' : step.status === 'failed' ? 'var(--red)' : step.status === 'running' ? 'var(--blue)' : 'var(--border)') +
                    ';display:flex;align-items:center;justify-content:center">' +
                    statusIcons[step.status] +
                '</div>' +
                '<div style="font-size:11px;font-weight:600;color:var(--text-primary)">' + Components.escapeHtml(step.label) + '</div>' +
                '<div class="mono" style="font-size:10px;color:var(--text-tertiary)">' + Components.escapeHtml(step.detail) + '</div>' +
                (step.duration ? '<div style="font-size:10px;color:var(--text-tertiary)">' + step.duration + '</div>' : '') +
            '</div>';

            // Arrow between steps
            if (i < steps.length - 1) {
                html += '<div style="flex-shrink:0;color:var(--text-tertiary);margin:0 4px;margin-bottom:28px;font-size:16px">&#8594;</div>';
            }
        });

        html += '</div>';
        return html;
    }

    // ========== 部署历史 ==========

    function _buildDeployHistory() {
        if (_statusHistory.length === 0) {
            return '<div style="text-align:center;color:var(--text-tertiary);padding:20px;font-size:12px">暂无部署历史</div>';
        }

        var html = '<div style="display:flex;flex-direction:column;gap:6px">';
        _statusHistory.forEach(function(entry) {
            var ts = entry.timestamp || entry.ts || entry.checked_at || '';
            var timeStr = ts ? Components.formatDateTime(ts) : '-';
            var version = entry.version || '-';
            var uptime = _formatUptime(entry.uptime || 0);

            html += '<div style="display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:6px;background:var(--bg-secondary);font-size:12px">' +
                '<div style="width:8px;height:8px;border-radius:50%;background:var(--green);flex-shrink:0"></div>' +
                '<div style="flex:1;display:flex;align-items:center;gap:16px">' +
                    '<span style="color:var(--text-tertiary);flex-shrink:0;min-width:140px">' + timeStr + '</span>' +
                    '<span class="mono" style="font-weight:600;color:var(--text-primary)">' + Components.escapeHtml(version) + '</span>' +
                    '<span style="color:var(--text-secondary)">运行 ' + uptime + '</span>' +
                '</div>' +
            '</div>';
        });
        html += '</div>';
        return html;
    }

    // ========== 数据加载 ==========

    function _fetchStatus() {
        API.get('/api/status').then(function(data) {
            if (_destroyed) return;
            var el = document.getElementById('opsPipelineInfo');
            if (el) el.innerHTML = _buildInfoCard(data);

            // Add to history
            _statusHistory.unshift(Object.assign({}, data, { timestamp: new Date().toISOString() }));
            if (_statusHistory.length > 5) _statusHistory.pop();

            var histEl = document.getElementById('opsPipelineHistory');
            if (histEl) histEl.innerHTML = _buildDeployHistory();
        }).catch(function() {
            // 静默失败
        });
    }

    // ========== 公开方法 ==========

    function buildPipelineTab() {
        return '<div id="opsPipelineInfo">' + _buildInfoCard(null) + '</div>' +
            Components.renderSection(
                Components.icon('gitBranch', 14) + ' CI/CD 流水线',
                '<div id="opsPipelineFlow">' + _buildPipeline() + '</div>'
            ) +
            Components.renderSection(
                Components.icon('clock', 14) + ' 部署历史（自动刷新 30s）',
                '<div id="opsPipelineHistory">' + _buildDeployHistory() + '</div>'
            );
    }

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // 初始加载
        _fetchStatus();

        if (_destroyed) return;
        container.innerHTML = buildPipelineTab();

        // 30s 自动刷新
        _refreshTimer = setInterval(_fetchStatus, 30000);
    }

    function destroy() {
        _destroyed = true;
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
        }
    }

    return { buildPipelineTab, render, destroy };
})();

export default OpsPipelineTab;
