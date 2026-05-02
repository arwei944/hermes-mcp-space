/**
 * 会话对话页面 - 消息区域模块
 * 消息展示、发送、搜索过滤
 */

const ChatMessages = (() => {
    let _messages = [];
    let _searchKeyword = '';
    let _currentSession = null;
    let _bound = false;

    async function render(containerSelector, sessionId) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        _currentSession = sessionId || null;
        container.innerHTML = Components.createLoading();

        if (_currentSession) {
            try {
                const data = await API.sessions.messages(_currentSession);
                _messages = data.messages || data || [];
            } catch (_err) {
                _messages = [];
            }
        } else {
            _messages = [];
        }

        container.innerHTML = buildMainContent();
        bindEvents(containerSelector);
        scrollToBottom();
    }

    function buildMainContent() {
        const filteredMessages = _searchKeyword
            ? _messages.filter(m => (m.content || '').toLowerCase().includes(_searchKeyword.toLowerCase()))
            : _messages;

        const headerHtml = _currentSession
            ? `<div class="chat-main-header" id="chatMainHeader">
                    <span style="font-weight:500">${Components.escapeHtml(getCurrentTitle())}</span>
                    <div style="display:flex;gap:8px;align-items:center">
                        <span class="chat-msg-count" style="font-size:12px;color:var(--text-tertiary)">${filteredMessages.length} 条消息</span>
                        <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteCurrentSession">删除会话</button>
                    </div>
                </div>`
            : '';

        const messagesHtml = buildMessagesHtml(filteredMessages);

        const inputHtml = _currentSession
            ? `<div class="chat-input-bar" id="chatInputBar">
                    <input type="text" class="form-input" id="chatInput" placeholder="输入消息..." style="flex:1" data-action="messageInput">
                    <button type="button" class="btn btn-primary" data-action="sendMessage" style="padding:8px 16px">发送</button>
                </div>`
            : '';

        return `${headerHtml}${messagesHtml}${inputHtml}`;
    }

    function buildMessagesHtml(filteredMessages) {
        if (!_currentSession && !_searchKeyword) {
            return `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('messageCircle', 32)}</div>
                <div style="font-size:14px;margin-bottom:8px">选择或创建一个会话开始</div>
              </div>`;
        }

        if (filteredMessages.length === 0) {
            return `<div style="padding:40px;text-align:center;color:var(--text-tertiary)">${_searchKeyword ? '没有匹配的消息' : '暂无消息，发送第一条消息吧'}</div>`;
        }

        return `<div class="chat-messages" id="chatMessages">
            ${filteredMessages.map(m => buildSingleMessageHtml(m)).join('')}
        </div>`;
    }

    function buildSingleMessageHtml(m) {
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

    function getCurrentTitle() {
        if (!_currentSession) return '';
        return _currentSession;
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
        const div = document.createElement('div');
        div.innerHTML = buildSingleMessageHtml(msg);
        container.appendChild(div.firstElementChild);
    }

    function scrollToBottom() {
        setTimeout(() => {
            const el = document.getElementById('chatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        }, 50);
    }

    function bindEvents(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        if (!_bound) {
            container.addEventListener('click', e => {
                const target = e.target.closest('[data-action]');
                if (!target) return;
                const action = target.dataset.action;

                switch (action) {
                    case 'sendMessage':
                        sendMessage();
                        break;
                    case 'deleteCurrentSession':
                        // 由 register.js 的回调处理，这里触发自定义事件
                        container.dispatchEvent(new CustomEvent('chat:deleteSession', {
                            bubbles: true,
                            detail: { sessionId: _currentSession },
                        }));
                        break;
                }
            });

            container.addEventListener('keydown', e => {
                const target = e.target.closest('[data-action="messageInput"]');
                if (target && e.key === 'Enter') {
                    e.preventDefault();
                    sendMessage();
                }
            });

            _bound = true;
        }
    }

    function destroy() {
        _messages = [];
        _searchKeyword = '';
        _currentSession = null;
        _bound = false;
    }

    return { render, sendMessage, appendMessage, scrollToBottom, destroy };
})();

export default ChatMessages;
