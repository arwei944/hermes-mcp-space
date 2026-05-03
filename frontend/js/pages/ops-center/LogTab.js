/**
 * Ops Center - 事件日志 Tab
 * 操作日志 + SSE 事件 两个子 Tab
 */

var OpsLogTab = (() => {
    var _destroyed = false;
    var _currentSubTab = 'logs';
    var _logs = [];
    var _events = [];
    var _refreshTimer = null;

    // ========== 子 Tab 切换 ==========

    function _buildSubTabs() {
        var tabs = [
            { key: 'logs', label: '操作日志' },
            { key: 'events', label: 'SSE事件' },
        ];

        var tabsHtml = tabs.map(function(tab) {
            var isActive = tab.key === _currentSubTab;
            var activeStyle = isActive
                ? 'background:var(--accent);color:#fff'
                : 'background:var(--bg-secondary);color:var(--text-secondary)';
            return '<button class="btn btn-sm" data-action="switchLogSubTab" data-tab="' + tab.key + '" style="' + activeStyle + ';border:1px solid var(--border);padding:6px 16px;border-radius:var(--radius-tag);cursor:pointer;font-size:12px;transition:all 0.15s">' +
                Components.escapeHtml(tab.label) +
            '</button>';
        }).join('');

        return '<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">' + tabsHtml +
            '<div style="flex:1"></div>' +
            '<button class="btn btn-sm btn-ghost" data-action="refreshLogs" style="font-size:12px">' +
                Components.icon('refreshCw', 12) + ' 刷新' +
            '</button>' +
        '</div>';
    }

    // ========== 操作日志 ==========

    function _buildLogsTable() {
        if (!_logs || _logs.length === 0) {
            return Components.createEmptyState(Components.icon('clipboard', 48), '暂无操作日志', '等待日志收集', '');
        }

        var levelColors = {
            error: 'var(--red)',
            warn: 'var(--orange)',
            warning: 'var(--orange)',
            info: 'var(--blue)',
            success: 'var(--green)',
        };

        var html = '<div class="table-wrapper"><table class="table">' +
            '<thead><tr><th>时间</th><th>级别</th><th>操作</th><th>目标</th><th>详情</th></tr></thead>' +
            '<tbody>';

        _logs.forEach(function(log) {
            var level = log.level || 'info';
            var color = levelColors[level] || 'var(--text-tertiary)';
            var time = log.timestamp || log.created_at || log.ts || '';
            var timeStr = time ? Components.formatDateTime(time) : '-';
            var action = Components.escapeHtml(log.action || log.operation || log.type || '-');
            var target = Components.escapeHtml(log.target || log.resource || log.path || '-');
            var detail = Components.escapeHtml((log.detail || log.message || log.msg || '').slice(0, 80));

            html += '<tr>' +
                '<td style="font-size:11px;color:var(--text-tertiary);white-space:nowrap">' + timeStr + '</td>' +
                '<td><span style="color:' + color + ';font-weight:600;font-size:11px;text-transform:uppercase">' + Components.escapeHtml(level) + '</span></td>' +
                '<td style="font-weight:500">' + action + '</td>' +
                '<td class="mono" style="font-size:12px">' + target + '</td>' +
                '<td style="font-size:12px;color:var(--text-secondary);max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="' + detail + '">' + detail + '</td>' +
            '</tr>';
        });

        html += '</tbody></table></div>';
        return html;
    }

    // ========== SSE 事件时间线 ==========

    function _buildEventsTimeline() {
        if (!_events || _events.length === 0) {
            return Components.createEmptyState(Components.icon('messageCircle', 48), '暂无SSE事件', '等待事件收集', '');
        }

        var html = '<div style="display:flex;flex-direction:column;gap:6px;max-height:500px;overflow-y:auto">';

        _events.forEach(function(evt) {
            var type = evt.type || evt.event_type || 'message';
            var ts = evt.timestamp || evt.ts || evt.created_at || '';
            var timeStr = ts ? Components.formatDateTime(ts) : '';
            var data = evt.data || evt.payload || {};
            var summary = '';

            if (typeof data === 'string') {
                summary = Components.escapeHtml(data.slice(0, 120));
            } else if (typeof data === 'object') {
                var parts = [];
                if (data.tool) parts.push('工具: ' + data.tool);
                if (data.action) parts.push('操作: ' + data.action);
                if (data.message) parts.push(data.message);
                if (data.msg) parts.push(data.msg);
                if (parts.length === 0) parts.push(JSON.stringify(data).slice(0, 120));
                summary = Components.escapeHtml(parts.join(' | ').slice(0, 120));
            }

            var badgeColor = 'blue';
            if (type.indexOf('error') !== -1) badgeColor = 'red';
            else if (type.indexOf('alert') !== -1) badgeColor = 'orange';
            else if (type.indexOf('memory') !== -1 || type.indexOf('skill') !== -1) badgeColor = 'green';
            else if (type.indexOf('session') !== -1) badgeColor = 'purple';

            html += '<div style="display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border-radius:var(--radius-sm);background:var(--bg-secondary);font-size:12px;transition:background 0.15s">' +
                '<div style="width:2px;height:100%;min-height:20px;background:' + (badgeColor === 'red' ? 'var(--red)' : badgeColor === 'orange' ? 'var(--orange)' : badgeColor === 'green' ? 'var(--green)' : badgeColor === 'purple' ? 'var(--purple)' : 'var(--blue)') + ';flex-shrink:0;border-radius:1px"></div>' +
                '<div style="flex:1;min-width:0">' +
                    '<div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">' +
                        Components.renderBadge(type, badgeColor) +
                        '<span style="font-size:10px;color:var(--text-tertiary)">' + timeStr + '</span>' +
                    '</div>' +
                    '<div style="color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + summary + '</div>' +
                '</div>' +
            '</div>';
        });

        html += '</div>';
        return html;
    }

    // ========== 数据加载 ==========

    function _loadData() {
        Promise.all([
            API.get('/api/logs', { limit: 100 }).catch(function() { return []; }),
            API.get('/api/events/history', { limit: 100 }).catch(function() { return []; }),
        ]).then(function(results) {
            if (_destroyed) return;
            _logs = results[0] || [];
            _events = results[1] || [];

            _updateContent();
        }).catch(function() {
            // 静默失败
        });
    }

    function _updateContent() {
        var logsEl = document.getElementById('opsLogContent');
        if (logsEl) {
            logsEl.innerHTML = _currentSubTab === 'logs' ? _buildLogsTable() : _buildEventsTimeline();
        }
    }

    // ========== 事件绑定 ==========

    function bindEvents(container) {
        container.addEventListener('click', function(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;

            if (target.dataset.action === 'switchLogSubTab') {
                _currentSubTab = target.dataset.tab;
                // Update tab styles
                container.querySelectorAll('[data-action="switchLogSubTab"]').forEach(function(btn) {
                    var isActive = btn.dataset.tab === _currentSubTab;
                    btn.style.background = isActive ? 'var(--accent)' : 'var(--bg-secondary)';
                    btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
                });
                _updateContent();
            } else if (target.dataset.action === 'refreshLogs') {
                _loadData();
                Components.Toast.info('正在刷新...');
            }
        });
    }

    // ========== 公开方法 ==========

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        _loadData();

        if (_destroyed) return;

        container.innerHTML =
            _buildSubTabs() +
            '<div id="opsLogContent">' + _buildLogsTable() + '</div>';

        bindEvents(container);
    }

    function destroy() {
        _destroyed = true;
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
        }
    }

    return { render, destroy };
})();

export default OpsLogTab;
