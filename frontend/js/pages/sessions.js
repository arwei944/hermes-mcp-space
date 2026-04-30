/**
 * 会话页面 - 智能体与用户对话实时记录器
 * 只读模式：会话由智能体通过 MCP 自动创建，消息实时推送展示
 */

const SessionsPage = (() => {
    let _sessions = [];
    let _currentId = null;
    let _messages = [];
    let _searchTerm = '';
    let _statusFilter = '';
    let _stats = { total: 0, active: 0, messages: 0, today: 0 };

    async function render(sessionId) {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            _sessions = await API.sessions.list();
        } catch (_err) {
            _sessions = [];
        }

        // 加载统计数据
        try {
            _stats = await API.get('/api/sessions/stats');
        } catch (_err) {
            _stats = { total: 0, active: 0, messages: 0, today: 0 };
        }

        if (sessionId) {
            _currentId = sessionId;
            await loadMessages(sessionId);
        } else if (_sessions.length > 0) {
            _currentId = _sessions[0].id || _sessions[0].session_id;
            await loadMessages(_currentId);
        }

        container.innerHTML = buildPage();
        bindEvents();
        scrollToBottom();
    }

    async function loadMessages(id) {
        _currentId = id;
        try {
            const data = await API.sessions.messages(id);
            _messages = data.messages || data || [];
        } catch (_err) {
            _messages = [];
        }
    }

    function getFilteredSessions() {
        let result = _sessions;
        if (_statusFilter) {
            result = result.filter((s) => (s.status || '') === _statusFilter);
        }
        if (_searchTerm) {
            const term = _searchTerm.toLowerCase();
            result = result.filter(
                (s) =>
                    (s.id || '').toLowerCase().includes(term) ||
                    (s.title || '').toLowerCase().includes(term) ||
                    (s.source || '').toLowerCase().includes(term) ||
                    (s.model || '').toLowerCase().includes(term),
            );
        }
        return result;
    }

    // ==========================================
    // 抽取的公共渲染函数 — 消除重复代码
    // ==========================================

    /** 渲染会话列表项 */
    function buildSessionItem(s) {
        const id = s.id || s.session_id;
        const isActive = id === _currentId;
        const msgCount = s.message_count || s.messages || 0;
        return `<div class="session-item ${isActive ? 'active' : ''}" data-action="select" data-id="${id}">
            <div style="display:flex;justify-content:space-between;align-items:center">
                <span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.title || s.source || id)}</span>
                <div style="display:flex;gap:4px;align-items:center">
                    ${Components.renderBadge(s.status === 'active' ? '活跃' : '完成', s.status === 'active' ? 'green' : 'blue')}
                    <button type="button" class="btn btn-sm btn-ghost" style="padding:2px 4px;font-size:11px;color:var(--red);opacity:0.5" data-action="deleteSession" data-id="${id}" title="删除">${Components.icon('x', 14)}</button>
                </div>
            </div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;display:flex;gap:8px">
                <span>${Components.escapeHtml(s.source || '-')}</span>
                <span>${Components.escapeHtml(s.model || '-')}</span>
                <span>${msgCount} 条消息</span>
            </div>
        </div>`;
    }

    /** 渲染会话列表（空状态或列表） */
    function buildSessionList(filtered) {
        if (filtered.length === 0) {
            return `<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('radio', 32)}</div>
                <div style="font-size:14px;margin-bottom:4px">等待智能体创建会话</div>
                <div style="font-size:12px">会话将通过 MCP 自动创建并实时同步</div>
            </div>`;
        }
        return filtered.map(buildSessionItem).join('');
    }

    /** 渲染消息列表（空状态或消息列表） */
    function buildMessageList(messages) {
        if (!_currentId) {
            return `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('radio', 32)}</div>
                <div style="font-size:14px;margin-bottom:4px">选择左侧会话查看对话记录</div>
                <div style="font-size:12px">会话由智能体自动创建，消息实时同步</div>
            </div>`;
        }
        if (messages.length === 0) {
            return `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:24px;margin-bottom:8px">${Components.icon('edit', 24)}</div>
                <div>等待消息...</div>
            </div>`;
        }
        return `<div class="chat-messages" id="chatMessages">
            ${messages.map(buildMessageItem).join('')}
        </div>`;
    }

    /** 渲染单条消息 */
    function buildMessageItem(m) {
        const isUser = m.role === 'user';
        const roleText = { user: '用户', assistant: '助手', system: '系统' }[m.role] || m.role;
        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return `<div class="chat-message ${isUser ? 'user' : 'assistant'}">
            <div class="chat-message-header">
                <span class="chat-message-role">${roleText}</span>
                <span class="chat-message-time">${m.timestamp ? Components.formatDateTime(m.timestamp) : ''}</span>
            </div>
            <div class="chat-message-content">${Components.renderMarkdown(content)}</div>
        </div>`;
    }

    /** 渲染会话头部信息 */
    function buildSessionHeader(currentSession) {
        if (!currentSession) return '';
        return `<div class="chat-main-header">
            <div style="display:flex;align-items:center;gap:8px">
                <span style="font-weight:500">${Components.escapeHtml(currentSession.title || currentSession.id)}</span>
                ${Components.renderBadge(currentSession.source, currentSession.source === 'Trae' ? 'purple' : currentSession.source === 'Web' ? 'blue' : 'green')}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:12px;color:var(--text-tertiary)">${_messages.length} 条消息</span>
                <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteSession" data-id="${_currentId}">删除</button>
            </div>
        </div>`;
    }

    /** 渲染统计栏 */
    function buildStatsBar() {
        return `<div style="display:flex;gap:12px;margin-bottom:16px">
            <div class="stat-card" style="flex:1;padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <div style="font-size:20px;font-weight:600;color:var(--text-primary)">${_stats.total}</div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">总会话</div>
            </div>
            <div class="stat-card" style="flex:1;padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <div style="font-size:20px;font-weight:600;color:var(--green)">${_stats.active}</div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">活跃</div>
            </div>
            <div class="stat-card" style="flex:1;padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <div style="font-size:20px;font-weight:600;color:var(--text-primary)">${_stats.messages}</div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">总消息</div>
            </div>
            <div class="stat-card" style="flex:1;padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border)">
                <div style="font-size:20px;font-weight:600;color:var(--blue)">${_stats.today}</div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">今日新增</div>
            </div>
        </div>`;
    }

    /** 渲染筛选器选项 */
    function buildFilterOptions() {
        const activeCount = _sessions.filter((s) => s.status === 'active').length;
        return `
            <option value="">全部 (${_sessions.length})</option>
            <option value="active" ${_statusFilter === 'active' ? 'selected' : ''}>活跃 (${activeCount})</option>
            <option value="completed" ${_statusFilter === 'completed' ? 'selected' : ''}>完成 (${_sessions.length - activeCount})</option>
        `;
    }

    // ==========================================
    // 页面构建
    // ==========================================

    function buildPage() {
        const filtered = getFilteredSessions();
        const currentSession = _sessions.find((s) => (s.id || s.session_id) === _currentId);

        return `<div class="chat-layout">
            <div class="chat-sidebar">
                <div class="chat-sidebar-header">
                    <h3>对话记录</h3>
                    <span style="font-size:11px;color:var(--text-tertiary)">实时同步</span>
                </div>
                <div class="chat-sidebar-search">
                    <input type="text" id="sessionSearch" placeholder="搜索会话..." value="${Components.escapeHtml(_searchTerm)}">
                </div>
                <div style="padding:4px 12px;display:flex;gap:4px">
                    <select id="statusFilter" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:11px;outline:none;color:var(--text-secondary)">
                        ${buildFilterOptions()}
                    </select>
                </div>
                <div class="chat-sidebar-list">${buildSessionList(filtered)}</div>
            </div>
            <div class="chat-main">
                ${buildSessionHeader(currentSession)}
                ${buildMessageList(_messages)}
            </div>
        </div>`;
    }

    // ---- 局部更新：只刷新左侧列表 ----
    function refreshSidebar() {
        const listEl = document.querySelector('.chat-sidebar-list');
        if (!listEl) return;
        const filtered = getFilteredSessions();
        listEl.innerHTML = buildSessionList(filtered);

        // 更新筛选器计数
        const filterEl = document.getElementById('statusFilter');
        if (filterEl) {
            filterEl.innerHTML = buildFilterOptions();
        }
    }

    // ---- 局部更新：只刷新右侧对话区 ----
    function refreshMain() {
        const mainEl = document.querySelector('.chat-main');
        if (!mainEl) return;
        const currentSession = _sessions.find((s) => (s.id || s.session_id) === _currentId);
        mainEl.innerHTML = buildSessionHeader(currentSession) + buildMessageList(_messages);
        scrollToBottom();
    }

    async function select(id) {
        await loadMessages(id);
        document.querySelectorAll('.session-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.id === id);
        });
        refreshMain();
    }

    function appendMessage(msg) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        const div = document.createElement('div');
        div.innerHTML = buildMessageItem(msg);
        container.appendChild(div.firstElementChild);
    }

    function scrollToBottom() {
        setTimeout(() => {
            const el = document.getElementById('chatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);
    }

    // ---- 删除会话 ----
    async function deleteSession(id) {
        const ok = await Components.Modal.confirm({
            title: '删除会话',
            message: '确定要删除此会话吗？会话中的所有消息将被删除，此操作不可撤销。',
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;

        try {
            await API.sessions.delete(id);
            _sessions = _sessions.filter((s) => (s.id || s.session_id) !== id);
            if (_currentId === id) {
                _currentId = null;
                _messages = [];
                if (_sessions.length > 0) {
                    const nextId = _sessions[0].id || _sessions[0].session_id;
                    await loadMessages(nextId);
                }
            }
            refreshSidebar();
            refreshMain();
            Components.Toast.success('会话已删除');
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        // 事件委托：select 和 deleteSession
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'deleteSession') {
                e.stopPropagation();
                deleteSession(btn.dataset.id);
                return;
            }
            if (btn.dataset.action === 'select') {
                select(btn.dataset.id);
            }
        });

        // 搜索
        const searchInput = document.getElementById('sessionSearch');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _searchTerm = e.target.value;
                    refreshSidebar();
                }, 300),
            );
        }

        // 状态筛选
        const statusSelect = document.getElementById('statusFilter');
        if (statusSelect) {
            statusSelect.addEventListener('change', (e) => {
                _statusFilter = e.target.value;
                refreshSidebar();
            });
        }
    }

    // ---- SSE 实时事件处理 ----
    function onSSEEvent(type, data) {
        if (type === 'session.message' && data) {
            const sid = data.session_id;
            const msg = {
                role: data.role,
                content: data.content,
                timestamp: data.timestamp,
            };

            if (sid === _currentId) {
                // 当前会话有新消息 → 直接追加到 DOM
                _messages.push(msg);
                appendMessage(msg);
                scrollToBottom();
            } else {
                // 其他会话有新消息 → 刷新侧边栏
                const exists = _sessions.some((s) => (s.id || s.session_id) === sid);
                if (!exists) {
                    API.sessions
                        .list()
                        .then((list) => {
                            _sessions = list;
                            refreshSidebar();
                        })
                        .catch(() => {});
                }
            }
        }

        if (type === 'session.updated' || type === 'session.deleted') {
            API.sessions
                .list()
                .then((list) => {
                    _sessions = list;
                    refreshSidebar();
                })
                .catch(() => {});
        }
    }

    return { render, select, onSSEEvent };
})();
