/**
 * 会话管理页面 (Mac 极简风格)
 */

const SessionsPage = (() => {
    let _sessions = [];
    let _expandedId = null;
    let _searchTerm = '';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.sessions.list();
            _sessions = data.sessions || data || [];
        } catch (err) {
            _sessions = getMockSessions();
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockSessions() {
        return [
            { id: 'sess_001', source: 'Trae', model: 'qwen3-coder', messages: 24, createdAt: new Date(Date.now() - 300000).toISOString(), status: 'active' },
            { id: 'sess_002', source: 'Web', model: 'claude-4', messages: 56, createdAt: new Date(Date.now() - 1800000).toISOString(), status: 'active' },
            { id: 'sess_003', source: 'CLI', model: 'gpt-4o', messages: 12, createdAt: new Date(Date.now() - 7200000).toISOString(), status: 'completed' },
            { id: 'sess_004', source: 'API', model: 'qwen3-coder', messages: 8, createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'completed' },
            { id: 'sess_005', source: 'Trae', model: 'claude-4', messages: 42, createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'completed' },
            { id: 'sess_006', source: 'CLI', model: 'gpt-4o', messages: 15, createdAt: new Date(Date.now() - 259200000).toISOString(), status: 'completed' },
        ];
    }

    function getFilteredSessions() {
        if (!_searchTerm) return _sessions;
        const term = _searchTerm.toLowerCase();
        return _sessions.filter(s =>
            (s.id || '').toLowerCase().includes(term) ||
            (s.source || '').toLowerCase().includes(term) ||
            (s.model || '').toLowerCase().includes(term) ||
            (s.status || '').toLowerCase().includes(term)
        );
    }

    function buildPage() {
        const filtered = getFilteredSessions();

        return Components.renderSection(`会话列表`, `
            <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between">
                <input type="text" id="sessionSearch" placeholder="搜索会话 ID、来源、模型..." style="width:300px;padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none" value="${Components.escapeHtml(_searchTerm)}">
                <span style="font-size:12px;color:var(--text-tertiary)">共 ${filtered.length} 个会话</span>
            </div>
            <table class="table">
                <thead><tr><th>ID</th><th>来源</th><th>模型</th><th>消息数</th><th>状态</th><th>创建时间</th><th>操作</th></tr></thead>
                <tbody>
                    ${filtered.length === 0 ? `<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--text-tertiary)">${_searchTerm ? '没有匹配的会话' : '暂无会话记录'}</td></tr>` :
                    filtered.map(s => `<tr>
                        <td class="mono">${Components.truncate(s.id, 16)}</td>
                        <td>${Components.renderBadge(s.source, s.source === 'Trae' ? 'purple' : s.source === 'Web' ? 'blue' : s.source === 'CLI' ? 'green' : 'orange')}</td>
                        <td class="mono">${s.model}</td>
                        <td>${s.messages} 条</td>
                        <td>${Components.renderBadge(s.status === 'active' ? '活跃' : '完成', s.status === 'active' ? 'green' : 'blue')}</td>
                        <td>${Components.formatTime(s.createdAt)}</td>
                        <td class="table-actions-cell">
                            <button class="btn btn-sm btn-ghost" onclick="SessionsPage.viewMessages('${s.id}')" title="查看消息">详情</button>
                            <button class="btn btn-sm btn-ghost" onclick="SessionsPage.compressSession('${s.id}')" title="压缩">压缩</button>
                            <button class="btn btn-sm btn-danger" onclick="SessionsPage.deleteSession('${s.id}')" title="删除">删除</button>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table>
            <div id="messageThreadContainer"></div>
        `);
    }

    async function viewMessages(id) {
        const container = document.getElementById('messageThreadContainer');
        if (_expandedId === id) { _expandedId = null; container.innerHTML = ''; return; }
        _expandedId = id;
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.sessions.messages(id);
            const messages = data.messages || data || [];
            renderMessageThread(messages);
        } catch (err) {
            container.innerHTML = Components.createEmptyState('\uD83D\uDCDC', '消息历史', '无法加载消息历史', '');
        }
    }

    function renderMessageThread(messages) {
        const container = document.getElementById('messageThreadContainer');
        if (!messages || messages.length === 0) {
            container.innerHTML = Components.createEmptyState('\uD83D\uDCDC', '暂无消息', '该会话没有消息记录', '');
            return;
        }
        container.innerHTML = `<div style="margin-top:16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                <span style="font-size:13px;font-weight:600">消息历史 (${messages.length} 条)</span>
                <button class="btn btn-sm btn-ghost" onclick="SessionsPage.closeMessages()">收起</button>
            </div>
            <div class="message-thread">${messages.map(msg => `
                <div class="message-item">
                    <div class="message-role ${msg.role || 'user'}">${msg.role || 'user'}</div>
                    <div class="message-content">${Components.truncate(msg.content || JSON.stringify(msg), 500)}</div>
                </div>
            `).join('')}</div>
        </div>`;
    }

    async function deleteSession(id) {
        if (!confirm('确定要删除该会话吗？此操作不可撤销。')) return;
        try {
            await API.sessions.delete(id);
            Components.Toast.success('会话已删除');
            _sessions = _sessions.filter(s => s.id !== id);
            _expandedId = null;
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function compressSession(id) {
        try {
            Components.Toast.info('正在压缩上下文...');
            await API.sessions.compress(id);
            Components.Toast.success('上下文压缩完成');
        } catch (err) {
            Components.Toast.error(`压缩失败: ${err.message}`);
        }
    }

    function closeMessages() {
        _expandedId = null;
        const container = document.getElementById('messageThreadContainer');
        if (container) container.innerHTML = '';
    }

    function bindEvents() {
        const searchInput = document.getElementById('sessionSearch');
        if (searchInput) {
            searchInput.addEventListener('input', Components.debounce((e) => {
                _searchTerm = e.target.value;
                document.getElementById('contentBody').innerHTML = buildPage();
                bindEvents();
            }, 300));
        }
    }

    return { render, viewMessages, deleteSession, compressSession, closeMessages };
})();
