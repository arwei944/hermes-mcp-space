/**
 * 会话对话页面 (Mac 极简风格)
 * 点击会话后显示消息详情，支持搜索
 */

const ChatPage = (() => {
    let _sessions = [];
    let _currentSession = null;
    let _messages = [];
    let _searchKeyword = '';

    async function render(sessionId) {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            _sessions = await API.sessions.list();
        } catch (err) {
            _sessions = [];
        }

        if (sessionId) {
            await loadSession(sessionId);
        } else if (_sessions.length > 0) {
            await loadSession(_sessions[0].id || _sessions[0].session_id);
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    async function loadSession(sessionId) {
        _currentSession = sessionId;
        try {
            const data = await API.sessions.messages(sessionId);
            _messages = data.messages || data || [];
        } catch (err) {
            _messages = [
                { role: 'user', content: '你好，Hermes！' },
                { role: 'assistant', content: '你好！我是 Hermes Agent，有什么可以帮你的吗？' },
                { role: 'user', content: '帮我查看一下最近的会话记录' },
                { role: 'assistant', content: '好的，我正在查看最近的会话记录...\n\n找到 3 个活跃会话，其中最新的是关于代码重构的讨论。' },
            ];
        }
    }

    function buildPage() {
        const statusMap = { active: '活跃', completed: '完成' };
        const statusColor = { active: 'green', completed: 'blue' };

        // 左侧会话列表
        const sessionListHtml = _sessions.length === 0
            ? `<div style="padding:20px;text-align:center;color:var(--text-tertiary)">暂无会话</div>`
            : _sessions.map(s => {
                const id = s.id || s.session_id;
                const isActive = id === _currentSession;
                return `<div class="session-item ${isActive ? 'active' : ''}" data-session-id="${id}" onclick="ChatPage.selectSession('${id}')">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-weight:500;font-size:13px">${Components.escapeHtml(s.title || s.source || id)}</span>
                        ${Components.renderBadge(statusMap[s.status] || s.status || '-', statusColor[s.status] || 'blue')}
                    </div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
                        ${Components.escapeHtml(s.model || '-')} · ${Components.formatTime(s.created_at || s.createdAt)}
                    </div>
                </div>`;
            }).join('');

        // 右侧消息区域
        const filteredMessages = _searchKeyword
            ? _messages.filter(m => (m.content || '').toLowerCase().includes(_searchKeyword.toLowerCase()))
            : _messages;

        const messagesHtml = filteredMessages.length === 0
            ? `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">${_searchKeyword ? '没有匹配的消息' : '选择一个会话查看消息'}</div>`
            : `<div class="chat-messages">
                ${filteredMessages.map(m => {
                    const isUser = m.role === 'user';
                    const roleText = ({user:'用户',assistant:'助手',system:'系统'})[m.role] || m.role;
                    const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                    return `<div class="chat-message ${isUser ? 'user' : 'assistant'}">
                        <div class="chat-message-header">
                            <span class="chat-message-role">${roleText}</span>
                            <span class="chat-message-time">${m.timestamp ? Components.formatTime(m.timestamp) : ''}</span>
                        </div>
                        <div class="chat-message-content">${Components.renderMarkdown(content)}</div>
                    </div>`;
                }).join('')}
            </div>`;

        return `<div class="chat-layout">
            <div class="chat-sidebar">
                <div class="chat-sidebar-header">
                    <h3>会话列表</h3>
                    <span style="font-size:11px;color:var(--text-tertiary)">${_sessions.length} 个</span>
                </div>
                <div class="chat-sidebar-search">
                    <input type="text" class="form-input" placeholder="搜索消息内容..." value="${Components.escapeHtml(_searchKeyword)}" id="chatSearchInput" oninput="ChatPage.search(this.value)">
                </div>
                <div class="chat-sidebar-list">${sessionListHtml}</div>
            </div>
            <div class="chat-main">
                ${_currentSession ? `<div class="chat-main-header">
                    <span style="font-weight:500">会话 ${Components.truncate(_currentSession, 16)}</span>
                    <span style="font-size:12px;color:var(--text-tertiary)">${filteredMessages.length} 条消息${_searchKeyword ? '（已过滤）' : ''}</span>
                </div>` : ''}
                ${messagesHtml}
            </div>
        </div>`;
    }

    async function selectSession(id) {
        await loadSession(id);
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function search(keyword) {
        _searchKeyword = keyword;
        // 只更新消息区域
        const mainEl = document.querySelector('.chat-main');
        if (mainEl) {
            const filteredMessages = _searchKeyword
                ? _messages.filter(m => (m.content || '').toLowerCase().includes(_searchKeyword.toLowerCase()))
                : _messages;
            const messagesHtml = filteredMessages.length === 0
                ? `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">没有匹配的消息</div>`
                : `<div class="chat-messages">
                    ${filteredMessages.map(m => {
                        const isUser = m.role === 'user';
                        const roleText = ({user:'用户',assistant:'助手',system:'系统'})[m.role] || m.role;
                        const content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
                        return `<div class="chat-message ${isUser ? 'user' : 'assistant'}">
                            <div class="chat-message-header">
                                <span class="chat-message-role">${roleText}</span>
                            </div>
                            <div class="chat-message-content">${Components.renderMarkdown(content)}</div>
                        </div>`;
                    }).join('')}
                </div>`;
            mainEl.innerHTML = messagesHtml;
        }
    }

    function bindEvents() {}

    return { render, selectSession, search };
})();
