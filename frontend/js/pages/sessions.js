/**
 * 会话管理页面
 * 会话列表、消息历史查看、搜索过滤、删除、压缩上下文
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
            { id: 'sess_001', source: 'cli', model: 'gpt-4o', messages: 24, createdAt: new Date(Date.now() - 300000).toISOString(), status: 'active' },
            { id: 'sess_002', source: 'api', model: 'gpt-4o', messages: 12, createdAt: new Date(Date.now() - 1800000).toISOString(), status: 'active' },
            { id: 'sess_003', source: 'web', model: 'claude-3-opus', messages: 8, createdAt: new Date(Date.now() - 7200000).toISOString(), status: 'completed' },
            { id: 'sess_004', source: 'cli', model: 'gpt-4o-mini', messages: 56, createdAt: new Date(Date.now() - 86400000).toISOString(), status: 'completed' },
            { id: 'sess_005', source: 'api', model: 'claude-3-sonnet', messages: 3, createdAt: new Date(Date.now() - 172800000).toISOString(), status: 'completed' },
            { id: 'sess_006', source: 'cli', model: 'gpt-4o', messages: 15, createdAt: new Date(Date.now() - 259200000).toISOString(), status: 'completed' },
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

        const tableHtml = Components.createTable({
            columns: [
                {
                    key: 'id', label: '会话 ID',
                    render: (v) => `<span style="font-family:monospace;font-size:0.8rem;color:var(--accent-secondary)">${Components.truncate(v, 16)}</span>`
                },
                {
                    key: 'source', label: '来源',
                    render: (v) => Components.badge(v, v === 'cli' ? 'primary' : v === 'api' ? 'info' : 'muted')
                },
                { key: 'model', label: '模型' },
                { key: 'messages', label: '消息数', render: (v) => `${v} 条` },
                { key: 'createdAt', label: '创建时间', render: (v) => Components.formatTime(v) },
                {
                    key: 'status', label: '状态',
                    render: (v) => Components.badge(
                        v === 'active' ? '活跃' : v === 'completed' ? '已完成' : v,
                        v === 'active' ? 'success' : 'muted'
                    )
                },
            ],
            rows: filtered,
            actions: (row) => `
                <button class="btn btn-sm btn-ghost" onclick="SessionsPage.viewMessages('${row.id}')" title="查看消息">📜</button>
                <button class="btn btn-sm btn-ghost" onclick="SessionsPage.compressSession('${row.id}')" title="压缩上下文">📦</button>
                <button class="btn btn-sm btn-danger" onclick="SessionsPage.deleteSession('${row.id}')" title="删除">🗑</button>
            `,
            emptyText: _searchTerm ? '没有匹配的会话' : '暂无会话记录',
            toolbar: {
                search: {
                    placeholder: '搜索会话 ID、来源、模型...',
                    id: 'sessionSearch',
                },
                actions: `
                    <span style="font-size:0.8rem;color:var(--text-muted)">共 ${filtered.length} 个会话</span>
                `,
            },
        });

        return `
            <div class="page-enter">
                ${tableHtml}
                <div id="messageThreadContainer"></div>
            </div>
        `;
    }

    async function viewMessages(id) {
        const container = document.getElementById('messageThreadContainer');
        if (_expandedId === id) {
            _expandedId = null;
            container.innerHTML = '';
            return;
        }
        _expandedId = id;
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.sessions.messages(id);
            const messages = data.messages || data || [];
            renderMessageThread(messages);
        } catch (err) {
            container.innerHTML = Components.createEmptyState(
                '📜', '消息历史', '无法加载消息历史', ''
            );
        }
    }

    function renderMessageThread(messages) {
        const container = document.getElementById('messageThreadContainer');
        if (!messages || messages.length === 0) {
            container.innerHTML = Components.createEmptyState('📜', '暂无消息', '该会话没有消息记录', '');
            return;
        }

        const messagesHtml = messages.map(msg => `
            <div class="message-item">
                <div class="message-role ${msg.role || 'user'}">${msg.role || 'user'}</div>
                <div class="message-content">${Components.truncate(msg.content || JSON.stringify(msg), 500)}</div>
            </div>
        `).join('');

        container.innerHTML = `
            <div style="margin-top:16px">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                    <span style="font-size:0.85rem;font-weight:600;color:var(--text-heading)">消息历史 (${messages.length} 条)</span>
                    <button class="btn btn-sm btn-ghost" onclick="SessionsPage.closeMessages()">收起</button>
                </div>
                <div class="message-thread">${messagesHtml}</div>
            </div>
        `;
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
            searchInput.value = _searchTerm;
            searchInput.addEventListener('input', Components.debounce((e) => {
                _searchTerm = e.target.value;
                const filtered = getFilteredSessions();
                // 只更新表格部分
                document.getElementById('contentBody').innerHTML = buildPage();
                bindEvents();
            }, 300));
        }
    }

    function init() {}

    return { render, init, viewMessages, deleteSession, compressSession, closeMessages };
})();
