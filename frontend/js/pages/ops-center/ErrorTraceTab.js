/**
 * Ops Center - 错误追踪 Tab
 * 统一错误视图: 前端JS + API + 工具错误
 */

import { ERROR_TYPES } from './constants.js';

var OpsErrorTraceTab = (() => {
    var _destroyed = false;
    var _filterType = 'all';
    var _autoRefresh = false;
    var _refreshTimer = null;
    var _frontendErrors = [];
    var _apiErrors = [];
    var _stats = null;

    // ========== 工具函数 ==========

    function _relativeTime(ts) {
        if (!ts) return '-';
        var now = Date.now();
        var then = new Date(ts).getTime();
        var diff = now - then;
        if (diff < 60000) return Math.floor(diff / 1000) + '秒前';
        if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
        if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
        return Math.floor(diff / 86400000) + '天前';
    }

    function _mergeErrors() {
        var merged = [];

        _frontendErrors.forEach(function(e) {
            merged.push({
                type: 'js_error',
                timestamp: e.timestamp || e.created_at || '',
                message: e.message || e.msg || '',
                context: e.context || e.file || e.url || '',
                stack: e.stack || '',
                build_version: e.build_version || '',
            });
        });

        _apiErrors.forEach(function(e) {
            merged.push({
                type: 'api_error',
                timestamp: e.timestamp || e.created_at || '',
                message: e.message || e.msg || e.error || '',
                context: e.path || e.url || e.endpoint || '',
                stack: e.detail || '',
                build_version: e.build_version || '',
            });
        });

        // 按时间降序排序
        merged.sort(function(a, b) {
            return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        });

        return merged;
    }

    function _filterErrors(errors) {
        if (_filterType === 'all') return errors;
        return errors.filter(function(e) { return e.type === _filterType; });
    }

    // ========== 过滤栏 ==========

    function _buildFilterBar() {
        var filters = [
            { key: 'all', label: '全部' },
            { key: 'js_error', label: '前端JS' },
            { key: 'api_error', label: 'API错误' },
            { key: 'tool_error', label: '工具错误' },
        ];

        var html = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;flex-wrap:wrap">';

        filters.forEach(function(f) {
            var isActive = _filterType === f.key;
            var activeStyle = isActive
                ? 'background:var(--accent);color:#fff;border-color:var(--accent)'
                : 'background:var(--bg-secondary);color:var(--text-secondary);border-color:var(--border)';
            html += '<button class="btn btn-sm" data-action="setErrorFilter" data-type="' + f.key + '" style="' + activeStyle + ';border:1px solid;padding:4px 12px;border-radius:var(--radius-tag);cursor:pointer;font-size:12px;transition:all 0.15s">' +
                Components.escapeHtml(f.label) +
            '</button>';
        });

        // Auto-refresh toggle
        var refreshStyle = _autoRefresh
            ? 'background:var(--green);color:#fff'
            : 'background:var(--bg-secondary);color:var(--text-secondary)';
        html += '<div style="flex:1"></div>' +
            '<button class="btn btn-sm" data-action="toggleAutoRefresh" style="' + refreshStyle + ';border:1px solid var(--border);padding:4px 12px;border-radius:var(--radius-tag);cursor:pointer;font-size:12px;display:flex;align-items:center;gap:4px">' +
                Components.icon('refreshCw', 12) + (_autoRefresh ? ' 自动刷新中' : ' 自动刷新') +
            '</button>' +
            '<button class="btn btn-sm btn-ghost" data-action="refreshErrors" style="font-size:12px">' +
                Components.icon('refreshCw', 12) + ' 刷新' +
            '</button>';

        html += '</div>';
        return html;
    }

    // ========== 错误列表 ==========

    function _buildErrorList() {
        var merged = _mergeErrors();
        var filtered = _filterErrors(merged);

        if (filtered.length === 0) {
            return Components.createEmptyState(Components.icon('checkCircle', 48), '暂无错误', '所有系统运行正常', '');
        }

        var html = '<div style="display:flex;flex-direction:column;gap:6px;max-height:500px;overflow-y:auto">';

        filtered.slice(0, 50).forEach(function(err, idx) {
            var typeConfig = ERROR_TYPES[err.type] || ERROR_TYPES.js_error;
            var msg = Components.escapeHtml((err.message || '未知错误').slice(0, 100));
            var fullMsg = Components.escapeHtml(err.message || '');
            var ctx = Components.escapeHtml(err.context || '');
            var relTime = _relativeTime(err.timestamp);
            var absTime = err.timestamp ? Components.formatDateTime(err.timestamp) : '';
            var hasMore = (err.message || '').length > 100;
            var hasStack = !!(err.stack && err.stack.length > 0);

            html += '<div style="padding:10px 12px;border-radius:var(--radius-sm);background:var(--bg-secondary);border-left:3px solid ' + typeConfig.dot + ';font-size:12px;transition:background 0.15s">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">' +
                    Components.renderBadge(typeConfig.label, typeConfig.badge) +
                    '<span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0" title="' + absTime + '">' + relTime + '</span>' +
                    (err.build_version ? '<span class="mono" style="font-size:10px;color:var(--text-tertiary)">v' + Components.escapeHtml(err.build_version) + '</span>' : '') +
                '</div>' +
                '<div style="color:var(--text-primary);margin-bottom:2px;word-break:break-all">' +
                    '<span class="error-msg-short" id="err-msg-' + idx + '">' + msg + '</span>' +
                    (hasMore ? '<span class="error-msg-full" id="err-msg-full-' + idx + '" style="display:none">' + fullMsg + '</span>' +
                        ' <button class="btn btn-sm btn-ghost" data-action="toggleErrorDetail" data-idx="' + idx + '" style="font-size:10px;padding:0 4px;color:var(--accent)">展开</button>' : '') +
                '</div>' +
                (ctx ? '<div style="font-size:10px;color:var(--text-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + ctx + '">' + Components.icon('terminal', 10) + ' ' + ctx + '</div>' : '') +
                (hasStack ? '<div class="error-stack" id="err-stack-' + idx + '" style="display:none;margin-top:6px;padding:8px;background:var(--bg-card);border-radius:4px;font-size:10px;color:var(--text-tertiary);max-height:120px;overflow-y:auto;white-space:pre-wrap;word-break:break-all">' + Components.escapeHtml(err.stack) + '</div>' +
                    '<button class="btn btn-sm btn-ghost" data-action="toggleStack" data-idx="' + idx + '" style="font-size:10px;padding:0 4px;color:var(--accent);margin-top:2px">堆栈</button>' : '') +
            '</div>';
        });

        html += '</div>';
        return html;
    }

    // ========== 统计页脚 ==========

    function _buildStatsFooter() {
        var merged = _mergeErrors();
        var total = merged.length;
        var oneHourAgo = Date.now() - 3600000;
        var last1h = merged.filter(function(e) {
            return new Date(e.timestamp).getTime() > oneHourAgo;
        }).length;

        var jsCount = merged.filter(function(e) { return e.type === 'js_error'; }).length;
        var apiCount = merged.filter(function(e) { return e.type === 'api_error'; }).length;
        var toolCount = merged.filter(function(e) { return e.type === 'tool_error'; }).length;

        return '<div style="display:flex;gap:16px;padding:12px 0;border-top:1px solid var(--border);margin-top:12px;font-size:12px;color:var(--text-tertiary);flex-wrap:wrap">' +
            '<span>总计: <strong style="color:var(--text-primary)">' + total + '</strong></span>' +
            '<span>最近1h: <strong style="color:var(--text-primary)">' + last1h + '</strong></span>' +
            '<span style="color:var(--red)">JS: ' + jsCount + '</span>' +
            '<span style="color:var(--orange)">API: ' + apiCount + '</span>' +
            '<span style="color:var(--yellow)">工具: ' + toolCount + '</span>' +
        '</div>';
    }

    // ========== 数据加载 ==========

    function _loadErrors() {
        Promise.all([
            API.ops.frontendErrors({ limit: 50 }).catch(function() { return []; }),
            API.ops.apiErrors({ limit: 50 }).catch(function() { return []; }),
            API.ops.frontendErrorsStats().catch(function() { return null; }),
        ]).then(function(results) {
            if (_destroyed) return;
            _frontendErrors = results[0] || [];
            _apiErrors = results[1] || [];
            _stats = results[2];

            var listEl = document.getElementById('opsErrorTraceList');
            if (listEl) listEl.innerHTML = _buildErrorList();

            var statsEl = document.getElementById('opsErrorTraceStats');
            if (statsEl) statsEl.innerHTML = _buildStatsFooter();
        }).catch(function() {
            // 静默失败
        });
    }

    // ========== 事件绑定 ==========

    function bindEvents(container) {
        container.addEventListener('click', function(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;
            var action = target.dataset.action;

            if (action === 'setErrorFilter') {
                _filterType = target.dataset.type;
                _rerenderContent(container);
            } else if (action === 'toggleAutoRefresh') {
                _autoRefresh = !_autoRefresh;
                if (_autoRefresh) {
                    _refreshTimer = setInterval(_loadErrors, 10000);
                    Components.Toast.info('已开启自动刷新（10s）');
                } else {
                    if (_refreshTimer) { clearInterval(_refreshTimer); _refreshTimer = null; }
                    Components.Toast.info('已关闭自动刷新');
                }
                _rerenderContent(container);
            } else if (action === 'refreshErrors') {
                _loadErrors();
                Components.Toast.info('正在刷新...');
            } else if (action === 'toggleErrorDetail') {
                var idx = target.dataset.idx;
                var shortEl = document.getElementById('err-msg-' + idx);
                var fullEl = document.getElementById('err-msg-full-' + idx);
                if (shortEl && fullEl) {
                    var isHidden = fullEl.style.display === 'none';
                    fullEl.style.display = isHidden ? 'inline' : 'none';
                    shortEl.style.display = isHidden ? 'none' : 'inline';
                    target.textContent = isHidden ? '收起' : '展开';
                }
            } else if (action === 'toggleStack') {
                var idx2 = target.dataset.idx;
                var stackEl = document.getElementById('err-stack-' + idx2);
                if (stackEl) {
                    var isHidden2 = stackEl.style.display === 'none';
                    stackEl.style.display = isHidden2 ? 'block' : 'none';
                    target.textContent = isHidden2 ? '隐藏堆栈' : '堆栈';
                }
            }
        });
    }

    function _rerenderContent(container) {
        var filterEl = document.getElementById('opsErrorTraceFilter');
        if (filterEl) filterEl.innerHTML = _buildFilterBar();
        var listEl = document.getElementById('opsErrorTraceList');
        if (listEl) listEl.innerHTML = _buildErrorList();
        var statsEl = document.getElementById('opsErrorTraceStats');
        if (statsEl) statsEl.innerHTML = _buildStatsFooter();
        bindEvents(container);
    }

    // ========== 公开方法 ==========

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        _loadErrors();

        if (_destroyed) return;

        container.innerHTML =
            '<div id="opsErrorTraceFilter">' + _buildFilterBar() + '</div>' +
            '<div id="opsErrorTraceList">' + _buildErrorList() + '</div>' +
            '<div id="opsErrorTraceStats">' + _buildStatsFooter() + '</div>';

        bindEvents(container);
    }

    function destroy() {
        _destroyed = true;
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
        }
        _autoRefresh = false;
    }

    return { render, destroy };
})();

export default OpsErrorTraceTab;
