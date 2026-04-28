/**
 * 会话页面 (Mac 极简风格)
 * 融合会话管理 + 会话对话：左侧列表，右侧对话
 * 无感操作：新建/删除不刷新整个页面
 */

const SessionsPage = (() => {
    let _sessions = [];
    let _currentId = null;
    let _messages = [];
    let _searchTerm = '';
    let _statusFilter = '';

    async function render(sessionId) {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            _sessions = await API.sessions.list();
        } catch (err) {
            _sessions = [];
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
        } catch (err) {
            _messages = [];
        }
    }

    function getFilteredSessions() {
        let result = _sessions;
        if (_statusFilter) {
            result = result.filter(s => (s.status || '') === _statusFilter);
        }
        if (_searchTerm) {
            const term = _searchTerm.toLowerCase();
            result = result.filter(s =>
                (s.id || '').toLowerCase().includes(term) ||
                (s.title || '').toLowerCase().includes(term) ||
                (s.source || '').toLowerCase().includes(term) ||
                (s.model || '').toLowerCase().includes(term)
            );
        }
        return result;
    }

    function buildPage() {
        const filtered = getFilteredSessions();
        const activeCount = _sessions.filter(s => s.status === 'active').length;

        const listHtml = filtered.length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--text-tertiary)">暂无会话</div>`
            : filtered.map(s => {
                const id = s.id || s.session_id;
                const isActive = id === _currentId;
                const msgCount = s.message_count || s.messages || 0;
                return `<div class="session-item ${isActive ? 'active' : ''}" data-action="select" data-id="${id}">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.title || s.source || id)}</span>
                        <div style="display:flex;gap:4px;align-items:center">
                            ${Components.renderBadge(s.status === 'active' ? '活跃' : '完成', s.status === 'active' ? 'green' : 'blue')}
                            <button type="button" class="btn btn-sm btn-ghost" style="padding:2px 4px;font-size:11px;color:var(--red);opacity:0.5" data-action="deleteSession" data-id="${id}" title="删除">✕</button>
                        </div>
                    </div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;display:flex;gap:8px">
                        <span>${Components.escapeHtml(s.source || '-')}</span>
                        <span>${Components.escapeHtml(s.model || '-')}</span>
                        <span>${msgCount} 条消息</span>
                    </div>
                </div>`;
            }).join('');

        const currentSession = _sessions.find(s => (s.id || s.session_id) === _currentId);
        const headerHtml = currentSession ? `
            <div class="chat-main-header">
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:500">${Components.escapeHtml(currentSession.title || currentSession.id)}</span>
                    ${Components.renderBadge(currentSession.source, currentSession.source === 'Trae' ? 'purple' : currentSession.source === 'Web' ? 'blue' : 'green')}
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <span style="font-size:12px;color:var(--text-tertiary)">${_messages.length} 条消息</span>
                    <button type="button" class="btn btn-sm btn-ghost" data-action="compressSession" data-id="${_currentId}">压缩</button>
                    <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteSession" data-id="${_currentId}">删除</button>
                </div>
            </div>` : '';

        const messagesHtml = !_currentId
            ? `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">💬</div>
                <div style="font-size:14px;margin-bottom:8px">选择或创建一个会话</div>
                <button type="button" class="btn btn-primary" data-action="showCreate">创建新会话</button>
              </div>`
            : _messages.length === 0
            ? `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">暂无消息，发送第一条消息吧</div>`
            : `<div class="chat-messages" id="chatMessages">
                ${_messages.map(m => {
                    const isUser = m.role === 'user';
                    const roleText = ({user:'用户',assistant:'助手',system:'系统'})[m.role] || m.role;
                    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                    return `<div class="chat-message ${isUser ? 'user' : 'assistant'}">
                        <div class="chat-message-header">
                            <span class="chat-message-role">${roleText}</span>
                            <span class="chat-message-time">${m.timestamp ? Components.formatDateTime(m.timestamp) : ''}</span>
                        </div>
                        <div class="chat-message-content">${Components.renderMarkdown(content)}</div>
                    </div>`;
                }).join('')}
            </div>`;

        const inputHtml = _currentId ? `
            <div class="chat-input-bar">
                <input type="text" class="form-input" id="chatInput" placeholder="输入消息..." style="flex:1">
                <button type="button" class="btn btn-primary" data-action="sendMessage" style="padding:8px 16px">发送</button>
            </div>` : '';

        return `<div class="chat-layout">
            <div class="chat-sidebar">
                <div class="chat-sidebar-header">
                    <h3>会话</h3>
                    <button type="button" class="btn btn-sm btn-primary" data-action="showCreate">+ 新建</button>
                </div>
                <div class="chat-sidebar-search">
                    <input type="text" id="sessionSearch" placeholder="搜索会话..." value="${Components.escapeHtml(_searchTerm)}">
                </div>
                <div style="padding:4px 12px;display:flex;gap:4px">
                    <select id="statusFilter" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:11px;outline:none;color:var(--text-secondary)">
                        <option value="">全部 (${_sessions.length})</option>
                        <option value="active" ${_statusFilter==='active'?'selected':''}>活跃 (${activeCount})</option>
                        <option value="completed" ${_statusFilter==='completed'?'selected':''}>完成 (${_sessions.length - activeCount})</option>
                    </select>
                </div>
                <div class="chat-sidebar-list">${listHtml}</div>
            </div>
            <div class="chat-main">
                ${headerHtml}
                ${messagesHtml}
                ${inputHtml}
            </div>
        </div>`;
    }

    // ---- 局部更新：只刷新左侧列表 ----
    function refreshSidebar() {
        const listEl = document.querySelector('.chat-sidebar-list');
        if (!listEl) return;
        const filtered = getFilteredSessions();
        const activeCount = _sessions.filter(s => s.status === 'active').length;

        if (filtered.length === 0) {
            listEl.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">暂无会话</div>';
        } else {
            listEl.innerHTML = filtered.map(s => {
                const id = s.id || s.session_id;
                const isActive = id === _currentId;
                const msgCount = s.message_count || s.messages || 0;
                return `<div class="session-item ${isActive ? 'active' : ''}" data-action="select" data-id="${id}">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.title || s.source || id)}</span>
                        <div style="display:flex;gap:4px;align-items:center">
                            ${Components.renderBadge(s.status === 'active' ? '活跃' : '完成', s.status === 'active' ? 'green' : 'blue')}
                            <button type="button" class="btn btn-sm btn-ghost" style="padding:2px 4px;font-size:11px;color:var(--red);opacity:0.5" data-action="deleteSession" data-id="${id}" title="删除">✕</button>
                        </div>
                    </div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;display:flex;gap:8px">
                        <span>${Components.escapeHtml(s.source || '-')}</span>
                        <span>${Components.escapeHtml(s.model || '-')}</span>
                        <span>${msgCount} 条消息</span>
                    </div>
                </div>`;
            }).join('');
        }

        // 更新筛选器计数
        const filterEl = document.getElementById('statusFilter');
        if (filterEl) {
            filterEl.innerHTML = `
                <option value="">全部 (${_sessions.length})</option>
                <option value="active" ${_statusFilter==='active'?'selected':''}>活跃 (${activeCount})</option>
                <option value="completed" ${_statusFilter==='completed'?'selected':''}>完成 (${_sessions.length - activeCount})</option>
            `;
        }
    }

    // ---- 局部更新：只刷新右侧对话区 ----
    function refreshMain() {
        const mainEl = document.querySelector('.chat-main');
        if (!mainEl) return;

        const currentSession = _sessions.find(s => (s.id || s.session_id) === _currentId);
        const headerHtml = currentSession ? `
            <div class="chat-main-header">
                <div style="display:flex;align-items:center;gap:8px">
                    <span style="font-weight:500">${Components.escapeHtml(currentSession.title || currentSession.id)}</span>
                    ${Components.renderBadge(currentSession.source, currentSession.source === 'Trae' ? 'purple' : currentSession.source === 'Web' ? 'blue' : 'green')}
                </div>
                <div style="display:flex;gap:8px;align-items:center">
                    <span style="font-size:12px;color:var(--text-tertiary)">${_messages.length} 条消息</span>
                    <button type="button" class="btn btn-sm btn-ghost" data-action="compressSession" data-id="${_currentId}">压缩</button>
                    <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteSession" data-id="${_currentId}">删除</button>
                </div>
            </div>` : '';

        const messagesHtml = !_currentId
            ? `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">💬</div>
                <div style="font-size:14px;margin-bottom:8px">选择或创建一个会话</div>
                <button type="button" class="btn btn-primary" data-action="showCreate">创建新会话</button>
              </div>`
            : _messages.length === 0
            ? `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">暂无消息，发送第一条消息吧</div>`
            : `<div class="chat-messages" id="chatMessages">
                ${_messages.map(m => {
                    const isUser = m.role === 'user';
                    const roleText = ({user:'用户',assistant:'助手',system:'系统'})[m.role] || m.role;
                    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                    return `<div class="chat-message ${isUser ? 'user' : 'assistant'}">
                        <div class="chat-message-header">
                            <span class="chat-message-role">${roleText}</span>
                            <span class="chat-message-time">${m.timestamp ? Components.formatDateTime(m.timestamp) : ''}</span>
                        </div>
                        <div class="chat-message-content">${Components.renderMarkdown(content)}</div>
                    </div>`;
                }).join('')}
            </div>`;

        const inputHtml = _currentId ? `
            <div class="chat-input-bar">
                <input type="text" class="form-input" id="chatInput" placeholder="输入消息..." style="flex:1">
                <button type="button" class="btn btn-primary" data-action="sendMessage" style="padding:8px 16px">发送</button>
            </div>` : '';

        mainEl.innerHTML = headerHtml + messagesHtml + inputHtml;
        scrollToBottom();
    }

    async function select(id) {
        await loadMessages(id);
        // 只更新列表高亮 + 右侧内容，不重建整个页面
        document.querySelectorAll('.session-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === id);
        });
        refreshMain();
    }

    async function sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input || !_currentId) return;
        const content = input.value.trim();
        if (!content) return;
        input.value = '';

        const msg = { role: 'user', content, timestamp: new Date().toISOString() };
        _messages.push(msg);
        appendMessage(msg);
        scrollToBottom();

        try {
            await API.sessions.addMessage(_currentId, 'user', content);
        } catch (err) {
            Components.Toast.error(`发送失败: ${err.message}`);
        }
    }

    function appendMessage(msg) {
        const container = document.getElementById('chatMessages');
        if (!container) return;
        const isUser = msg.role === 'user';
        const roleText = ({user:'用户',assistant:'助手',system:'系统'})[msg.role] || msg.role;
        const content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content);
        const div = document.createElement('div');
        div.className = `chat-message ${isUser ? 'user' : 'assistant'}`;
        div.innerHTML = `<div class="chat-message-header">
            <span class="chat-message-role">${roleText}</span>
            <span class="chat-message-time">${msg.timestamp ? Components.formatDateTime(msg.timestamp) : ''}</span>
        </div>
        <div class="chat-message-content">${Components.renderMarkdown(content)}</div>`;
        container.appendChild(div);
    }

    function scrollToBottom() {
        setTimeout(() => {
            const el = document.getElementById('chatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);
    }

    // ---- 无感新建：创建后直接切换，不刷新页面 ----
    async function showCreate() {
        try {
            const result = await API.sessions.create({ title: `会话 ${new Date().toLocaleString('zh-CN')}`, source: 'web' });
            const newSession = result.session || result;
            const newId = newSession.id || newSession.session_id;

            // 更新本地数据
            _sessions.unshift(newSession);
            _currentId = newId;
            _messages = [];

            // 局部更新
            refreshSidebar();
            refreshMain();
            Components.Toast.success('会话已创建');
        } catch (err) {
            Components.Toast.error(`创建失败: ${err.message}`);
        }
    }

    // ---- 无感删除：删除后局部更新，不刷新页面 ----
    async function deleteSession(id) {
        try {
            await API.sessions.delete(id);

            // 更新本地数据
            _sessions = _sessions.filter(s => (s.id || s.session_id) !== id);

            if (_currentId === id) {
                // 删除的是当前会话，切换到下一个
                _currentId = null;
                _messages = [];
                if (_sessions.length > 0) {
                    const nextId = _sessions[0].id || _sessions[0].session_id;
                    await loadMessages(nextId);
                }
            }

            // 局部更新
            refreshSidebar();
            refreshMain();
            Components.Toast.success('会话已删除');
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function compressSession(id) {
        try {
            Components.Toast.info('正在压缩...');
            await API.sessions.compress(id);
            Components.Toast.success('压缩完成');
        } catch (err) {
            Components.Toast.error(`压缩失败: ${err.message}`);
        }
    }

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        // 事件委托：所有 data-action 按钮
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;

            // 如果点击的是删除按钮，阻止冒泡到 session-item 的 select
            if (btn.dataset.action === 'deleteSession') {
                e.stopPropagation();
            }

            const action = btn.dataset.action;
            const id = btn.dataset.id;

            switch (action) {
                case 'showCreate': showCreate(); break;
                case 'select': select(id); break;
                case 'deleteSession': deleteSession(id); break;
                case 'compressSession': compressSession(id); break;
                case 'sendMessage': sendMessage(); break;
            }
        });

        // Enter 发送消息
        container.addEventListener('keydown', (e) => {
            if (e.target.id === 'chatInput' && e.key === 'Enter') {
                sendMessage();
            }
        });

        // 搜索
        const searchInput = document.getElementById('sessionSearch');
        if (searchInput) {
            searchInput.addEventListener('input', Components.debounce((e) => {
                _searchTerm = e.target.value;
                refreshSidebar();
            }, 300));
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
                // 更新消息计数
                const countEl = document.querySelector('.chat-main-header span:last-of-type');
                // 不需要额外操作，appendMessage 已处理
            } else {
                // 其他会话有新消息 → 更新侧边栏（如果有新会话则刷新列表）
                const exists = _sessions.some(s => (s.id || s.session_id) === sid);
                if (!exists) {
                    // 新会话被创建（通过 MCP），刷新整个列表
                    API.sessions.list().then(list => {
                        _sessions = list;
                        refreshSidebar();
                    }).catch(() => {});
                }
            }
        }

        if (type === 'session.updated' || type === 'session.deleted') {
            // 会话列表变化 → 刷新侧边栏
            API.sessions.list().then(list => {
                _sessions = list;
                refreshSidebar();
            }).catch(() => {});
        }
    }

    return { render, select, sendMessage, showCreate, deleteSession, compressSession, onSSEEvent };
})();
