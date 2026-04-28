/**
 * 操作日志页面 (Mac 极简风格)
 */

const LogsPage = (() => {
    let _logs = [];
    let _stats = null;
    let _filterLevel = '全部';
    let _filterSource = '全部';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [logsData, statsData] = await Promise.all([
                API.request('/api/logs?limit=100'),
                API.request('/api/logs/stats'),
            ]);
            _logs = logsData || [];
            _stats = statsData;
        } catch (err) {
            _logs = getMockLogs();
            _stats = null;
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockLogs() {
        const now = new Date();
        return [
            { id: '1', timestamp: new Date(now - 60000).toISOString(), action: '系统启动', target: 'Hermes Agent', detail: '服务启动成功', level: 'success', source: 'system' },
            { id: '2', timestamp: new Date(now - 30000).toISOString(), action: 'API 调用', target: '/api/dashboard', detail: '获取仪表盘数据', level: 'info', source: 'user' },
            { id: '3', timestamp: new Date(now - 10000).toISOString(), action: 'MCP 连接', target: 'initialize', detail: 'MCP 客户端初始化', level: 'info', source: 'mcp' },
            { id: '4', timestamp: new Date(now - 5000).toISOString(), action: '记忆更新', target: 'MEMORY.md', detail: '写入记忆内容', level: 'success', source: 'user' },
        ];
    }

    function buildPage() {
        const levelOptions = ['全部', 'info', 'success', 'warning', 'error'];
        const sourceOptions = ['全部', 'system', 'user', 'mcp', 'cron'];

        const filtered = _logs.filter(l => {
            if (_filterLevel !== '全部' && l.level !== _filterLevel) return false;
            if (_filterSource !== '全部' && l.source !== _filterSource) return false;
            return true;
        });

        // 统计卡片
        const s = _stats || {};
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总日志', s.total || _logs.length, '', '📋', 'blue')}
            ${Components.renderStatCard('信息', s.byLevel?.info || 0, '', 'ℹ️', 'green')}
            ${Components.renderStatCard('成功', s.byLevel?.success || 0, '', '✅', 'green')}
            ${Components.renderStatCard('错误', s.byLevel?.error || 0, '', '❌', 'red')}
        </div>`;

        // 过滤器
        const filterHtml = `<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
            <span style="font-size:12px;color:var(--text-tertiary)">级别:</span>
            ${levelOptions.map(l => `<button class="btn btn-sm ${_filterLevel === l ? 'btn-primary' : 'btn-ghost'}" onclick="LogsPage.setFilterLevel('${l}')">${l}</button>`).join('')}
            <span style="margin-left:12px;font-size:12px;color:var(--text-tertiary)">来源:</span>
            ${sourceOptions.map(s => `<button class="btn btn-sm ${_filterSource === s ? 'btn-primary' : 'btn-ghost'}" onclick="LogsPage.setFilterSource('${s}')">${s}</button>`).join('')}
            <div style="flex:1"></div>
            <button class="btn btn-sm btn-ghost" onclick="LogsPage.refresh()">刷新</button>
            <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="LogsPage.clearLogs()">清空</button>
        </div>`;

        // 日志列表
        const levelBadge = { info: 'blue', success: 'green', warning: 'orange', error: 'red' };
        const levelText = { info: '信息', success: '成功', warning: '警告', error: '错误' };
        const sourceText = { system: '系统', user: '用户', mcp: 'MCP', cron: '定时任务' };

        const logsHtml = filtered.length === 0
            ? Components.createEmptyState('📋', '暂无日志', '没有匹配的操作日志', '')
            : `<div class="table-wrapper"><table class="table">
                <thead><tr><th>时间</th><th>级别</th><th>来源</th><th>操作</th><th>详情</th></tr></thead>
                <tbody>
                    ${filtered.map(l => `<tr>
                        <td style="white-space:nowrap;font-size:12px;color:var(--text-tertiary)">${Components.formatTime(l.timestamp)}</td>
                        <td>${Components.renderBadge(levelText[l.level] || l.level, levelBadge[l.level] || 'blue')}</td>
                        <td>${Components.renderBadge(sourceText[l.source] || l.source, 'orange')}</td>
                        <td style="font-weight:500">${Components.escapeHtml(l.action)}</td>
                        <td style="font-size:12px;color:var(--text-secondary);max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(l.detail || l.target || '-')}</td>
                    </tr>`).join('')}
                </tbody>
            </table></div>`;

        return `${statsHtml}${filterHtml}${logsHtml}`;
    }

    function setFilterLevel(level) {
        _filterLevel = level;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function setFilterSource(source) {
        _filterSource = source;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    async function refresh() {
        Components.Toast.info('正在刷新...');
        await render();
        Components.Toast.success('已刷新');
    }

    async function clearLogs() {
        if (!confirm('确定要清空所有日志吗？')) return;
        try {
            await API.request('/api/logs', { method: 'DELETE' });
            _logs = [];
            _stats = null;
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
            Components.Toast.success('日志已清空');
        } catch (err) {
            Components.Toast.error(`清空失败: ${err.message}`);
        }
    }

    function bindEvents() {}

    return { render, setFilterLevel, setFilterSource, refresh, clearLogs };
})();
