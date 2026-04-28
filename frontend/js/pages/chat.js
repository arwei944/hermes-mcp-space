/**
 * 会话对话页面 (Mac 极简风格)
 * 创建会话、发送消息、查看历史、搜索
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
        scrollToBottom();
    }

    async function loadSession(sessionId) {
        _currentSession = sessionId;
        try {
            const data = await API.sessions.messages(sessionId);
            _messages = data.messages || data || [];
        } catch (err) {
            _messages = [];
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
                        <span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.title || s.source || id)}</span>
                        <div style="display:flex;gap:4px;align-items:center">
                            ${Components.renderBadge(statusMap[s.status] || s.status || '-', statusColor[s.status] || 'blue')}
                            <button class="btn btn-sm btn-ghost" style="padding:2px 4px;font-size:11px;color:var(--red);opacity:0.5" onclick="event.stopPropagation();ChatPage.deleteSession('${id}')" title="删除">✕</button>
                        </div>
                    </div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
                        ${Components.escapeHtml(s.model || '-')} · ${Components.formatDateTime(s.created_at || s.createdAt)}
                    </div>
                </div>`;
            }).join('');

        // 右侧消息区域
        const filteredMessages = _searchKeyword
            ? _messages.filter(m => (m.content || '').toLowerCase().includes(_searchKeyword.toLowerCase()))
            : _messages;

        const messagesHtml = !_currentSession && !_searchKeyword
            ? `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">💬</div>
                <div style="font-size:14px;margin-bottom:8px">选择或创建一个会话开始</div>
                <button class="btn btn-primary" onclick="ChatPage.showCreate()">创建新会话</button>
              </div>`
            : filteredMessages.length === 0
            ? `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">${_searchKeyword ? '没有匹配的消息' : '暂无消息，发送第一条消息吧'}</div>`
            : `<div class="chat-messages" id="chatMessages">
                ${filteredMessages.map(m => {
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

        // 输入框
        const inputHtml = _currentSession ? `
            <div class="chat-input-bar">
                <input type="text" class="form-input" id="chatInput" placeholder="输入消息..." style="flex:1" onkeydown="if(event.key==='Enter')ChatPage.sendMessage()">
                <button class="btn btn-primary" onclick="ChatPage.sendMessage()" style="padding:8px 16px">发送</button>
            </div>` : '';

        return `<div class="chat-layout">
            <div class="chat-sidebar">
                <div class="chat-sidebar-header">
                    <h3>会话列表</h3>
                    <button class="btn btn-sm btn-primary" onclick="ChatPage.showCreate()">+ 新建</button>
                </div>
                <div class="chat-sidebar-search">
                    <input type="text" class="form-input" placeholder="搜索消息..." value="${Components.escapeHtml(_searchKeyword)}" id="chatSearchInput" oninput="ChatPage.search(this.value)">
                </div>
                <div class="chat-sidebar-list">${sessionListHtml}</div>
            </div>
            <div class="chat-main">
                ${_currentSession ? `<div class="chat-main-header">
                    <span style="font-weight:500">${Components.escapeHtml(getCurrentTitle())}</span>
                    <div style="display:flex;gap:8px;align-items:center">
                        <span style="font-size:12px;color:var(--text-tertiary)">${filteredMessages.length} 条消息</span>
                        <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="ChatPage.deleteSession('${_currentSession}')">删除会话</button>
                    </div>
                </div>` : ''}
                ${messagesHtml}
                ${inputHtml}
            </div>
        </div>`;
    }

    function getCurrentTitle() {
        if (!_currentSession) return '';
        const s = _sessions.find(s => (s.id || s.session_id) === _currentSession);
        return s ? (s.title || s.id) : _currentSession;
    }

    async function showCreate() {
        try {
            const result = await API.sessions.create({ title: `会话 ${new Date().toLocaleString('zh-CN')}`, source: 'web' });
            Components.Toast.success('会话已创建');
            const newId = result.session?.id;
            if (newId) {
                await render(newId);
            } else {
                await render();
            }
        } catch (err) {
            Components.Toast.error(`创建失败: ${err.message}`);
        }
    }

    async function sendMessage() {
        const input = document.getElementById('chatInput');
        if (!input || !_currentSession) return;
        const content = input.value.trim();
        if (!content) return;
        input.value = '';

        // 乐观更新 UI
        const msg = { role: 'user', content, timestamp: new Date().toISOString() };
        _messages.push(msg);
        appendMessage(msg);
        scrollToBottom();

        try {
            await API.sessions.addMessage(_currentSession, 'user', content);
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

    async function deleteSession(id) {
        try {
            await API.sessions.delete(id);
            Components.Toast.success('会话已删除');
            _currentSession = null;
            _messages = [];
            await render();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function selectSession(id) {
        await loadSession(id);
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
        scrollToBottom();
    }

    function search(keyword) {
        _searchKeyword = keyword;
        const mainEl = document.querySelector('.chat-main');
        if (mainEl) {
            const filteredMessages = _searchKeyword
                ? _messages.filter(m => (m.content || '').toLowerCase().includes(_searchKeyword.toLowerCase()))
                : _messages;
            const messagesHtml = filteredMessages.length === 0
                ? `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">没有匹配的消息</div>`
                : `<div class="chat-messages" id="chatMessages">
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

    return { render, selectSession, search, showCreate, sendMessage, deleteSession };
})();
