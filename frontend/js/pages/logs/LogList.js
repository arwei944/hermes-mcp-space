/**
 * 操作日志页面 - 列表模块
 * 包含所有业务逻辑：加载、过滤、搜索、自动刷新、清空
 */

const LogList = (() => {
    let _logs = [];
    let _stats = null;
    let _filterLevel = '全部';
    let _filterSource = '全部';
    let _searchKeyword = '';
    let _autoRefresh = false;
    let _refreshTimer = null;
    let _bound = false;

    async function render(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
            _autoRefresh = false;
        }

        container.innerHTML = Components.createLoading();

        try {
            const [logsData, statsData] = await Promise.all([
                API.request('/api/logs?limit=100'),
                API.request('/api/logs/stats'),
            ]);
            _logs = logsData || [];
            _stats = statsData;
        } catch (_err) {
            _logs = [];
            _stats = null;
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function buildPage() {
        const levelOptions = ['全部', 'info', 'success', 'warning', 'error'];
        const sourceOptions = ['全部', 'system', 'user', 'mcp', 'cron'];

        const filtered = _logs.filter((l) => {
            if (_filterLevel !== '全部' && l.level !== _filterLevel) return false;
            if (_filterSource !== '全部' && l.source !== _filterSource) return false;
            if (_searchKeyword) {
                const kw = _searchKeyword.toLowerCase();
                if (
                    !(l.action || '').toLowerCase().includes(kw) &&
                    !(l.detail || '').toLowerCase().includes(kw) &&
                    !(l.target || '').toLowerCase().includes(kw)
                )
                    return false;
            }
            return true;
        });

        // 统计卡片
        const s = _stats || {};
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总日志', s.total || _logs.length, '', 'clipboard', 'blue')}
            ${Components.renderStatCard('信息', s.byLevel?.info || 0, '', 'info', 'green')}
            ${Components.renderStatCard('成功', s.byLevel?.success || 0, '', Components.icon('check', 14), 'green')}
            ${Components.renderStatCard('错误', s.byLevel?.error || 0, '', 'x', 'red')}
        </div>`;

        // 过滤器
        const filterHtml = `<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
            <input type="text" id="logSearchInput" placeholder="搜索操作/详情..." value="${Components.escapeHtml(_searchKeyword || '')}" style="flex:1;min-width:150px;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none">
            <span style="font-size:12px;color:var(--text-tertiary)">级别:</span>
            ${levelOptions.map((l) => `<button type="button" class="btn btn-sm ${_filterLevel === l ? 'btn-primary' : 'btn-ghost'}" data-action="setFilterLevel" data-level="${l}">${l}</button>`).join('')}
            <span style="font-size:12px;color:var(--text-tertiary)">来源:</span>
            ${sourceOptions.map((s) => `<button type="button" class="btn btn-sm ${_filterSource === s ? 'btn-primary' : 'btn-ghost'}" data-action="setFilterSource" data-source="${s}">${s}</button>`).join('')}
            <label style="font-size:12px;color:var(--text-tertiary);display:flex;align-items:center;gap:4px">
                <input type="checkbox" id="autoRefresh" ${_autoRefresh ? 'checked' : ''} style="accent-color:var(--accent)">
                自动刷新
            </label>
            <button type="button" class="btn btn-sm btn-ghost" data-action="refresh">刷新</button>
            <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="clearLogs">清空</button>
        </div>`;

        // 日志列表
        const levelBadge = { info: 'blue', success: 'green', warning: 'orange', error: 'red' };
        const levelText = { info: '信息', success: '成功', warning: '警告', error: '错误' };
        const sourceText = { system: '系统', user: '用户', mcp: 'MCP', cron: '定时任务' };

        const logsHtml =
            filtered.length === 0
                ? Components.createEmptyState(Components.icon('clipboard', 48), '暂无日志', '没有匹配的操作日志', '')
                : `<div class="table-wrapper"><table class="table">
                <thead><tr><th>时间</th><th>级别</th><th>来源</th><th>操作</th><th>详情</th></tr></thead>
                <tbody>
                    ${filtered
                        .map(
                            (l) => `<tr>
                        <td style="white-space:nowrap;font-size:12px;color:var(--text-tertiary)">${Components.formatDateTime(l.timestamp)}</td>
                        <td>${Components.renderBadge(levelText[l.level] || l.level, levelBadge[l.level] || 'blue')}</td>
                        <td>${Components.renderBadge(sourceText[l.source] || l.source, 'orange')}</td>
                        <td style="font-weight:500">${Components.escapeHtml(l.action)}</td>
                        <td style="font-size:12px;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(l.detail || l.target || '-')}</td>
                    </tr>`,
                        )
                        .join('')}
                </tbody>
            </table></div>`;

        return `${statsHtml}${filterHtml}${logsHtml}`;
    }

    function setFilterLevel(level) {
        _filterLevel = level;
        const container = document.querySelector('#log-list');
        if (container) {
            container.innerHTML = buildPage();
            bindEvents();
        }
    }

    function setFilterSource(source) {
        _filterSource = source;
        const container = document.querySelector('#log-list');
        if (container) {
            container.innerHTML = buildPage();
            bindEvents();
        }
    }

    async function refresh() {
        Components.Toast.info('正在刷新...');
        await render('#log-list');
        Components.Toast.success('已刷新');
    }

    async function clearLogs() {
        const ok = await Components.Modal.confirm({
            title: '清空日志',
            message: '确定要清空所有操作日志吗？此操作不可撤销。',
            confirmText: '清空',
            type: 'danger',
        });
        if (!ok) return;

        try {
            await API.request('/api/logs', { method: 'DELETE' });
            _logs = [];
            _stats = null;
            const container = document.querySelector('#log-list');
            if (container) {
                container.innerHTML = buildPage();
                bindEvents();
            }
            Components.Toast.success('日志已清空');
        } catch (err) {
            Components.Toast.error(`清空失败: ${err.message}`);
        }
    }

    function search(keyword) {
        _searchKeyword = keyword;
        const container = document.querySelector('#log-list');
        if (container) {
            container.innerHTML = buildPage();
            bindEvents();
        }
    }

    function toggleAutoRefresh(enabled) {
        _autoRefresh = enabled;
        if (_refreshTimer) clearInterval(_refreshTimer);
        if (_autoRefresh) {
            _refreshTimer = setInterval(refresh, 5000);
            Components.Toast.info('已开启自动刷新（5秒）');
        } else {
            Components.Toast.info('已关闭自动刷新');
        }
    }

    function bindEvents() {
        const container = document.querySelector('#log-list');
        if (!container) return;

        if (!_bound) {
            container.addEventListener('click', e => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                const action = btn.dataset.action;
                switch (action) {
                    case 'setFilterLevel':
                        setFilterLevel(btn.dataset.level);
                        break;
                    case 'setFilterSource':
                        setFilterSource(btn.dataset.source);
                        break;
                    case 'refresh':
                        refresh();
                        break;
                    case 'clearLogs':
                        clearLogs();
                        break;
                }
            });
            _bound = true;
        }

        const searchInput = document.getElementById('logSearchInput');
        if (searchInput) {
            searchInput.addEventListener('input', e => {
                search(e.target.value);
            });
        }

        const autoRefreshCheckbox = document.getElementById('autoRefresh');
        if (autoRefreshCheckbox) {
            autoRefreshCheckbox.addEventListener('change', e => {
                toggleAutoRefresh(e.target.checked);
            });
        }
    }

    function destroy() {
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
        }
        _logs = [];
        _stats = null;
        _filterLevel = '全部';
        _filterSource = '全部';
        _searchKeyword = '';
        _autoRefresh = false;
        _bound = false;
    }

    return { render, destroy, buildPage, setFilterLevel, setFilterSource, refresh, clearLogs, search, toggleAutoRefresh, bindEvents };
})();

export default LogList;
