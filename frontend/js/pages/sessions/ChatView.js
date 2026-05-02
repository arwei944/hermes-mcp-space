/**
 * 会话页面 - 聊天视图模块
 * 消息列表渲染、状态栏、会话头部、消息追加/滚动
 */

const ChatView = (() => {
    var _sessions = [], _currentId = null, _messages = [], _toolCards = {};
    var _isTyping = false, _userScrolledUp = false, _sseConnected = false;

    function currentSession() { return _sessions.find(function (s) { return (s.id || s.session_id) === _currentId; }); }
    function scrollToBottom() { requestAnimationFrame(function () { var el = document.getElementById('chatMessages'); if (el) el.scrollTop = el.scrollHeight; }); }

    function buildStatusBar() {
        var cs = currentSession();
        var dotColor = _sseConnected ? 'var(--green)' : 'var(--red)', statusText = _sseConnected ? '已连接' : '未连接';
        var sessionName = cs ? Components.escapeHtml(cs.title || cs.source || cs.id) : '未选择会话';
        return '<div class="session-status-bar" style="display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border);font-size:12px;color:var(--text-secondary)">' +
            '<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:' + dotColor + ';display:inline-block"></span>' + statusText + '</span>' +
            '<span style="color:var(--text-tertiary)">|</span><span style="display:flex;align-items:center;gap:4px">' + Components.icon('messageCircle', 13) + sessionName + '</span>' +
            '<span style="color:var(--text-tertiary)">|</span><span>' + _messages.length + ' 条消息</span></div>';
    }

    function buildMessageItem(m) {
        var isUser = m.role === 'user';
        var roleText = { user: '用户', assistant: '助手', system: '系统' }[m.role] || m.role;
        var content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return '<div class="chat-message ' + (isUser ? 'user' : 'assistant') + '"><div class="chat-message-header"><span class="chat-message-role">' + roleText + '</span><span class="chat-message-time">' + (m.timestamp ? Components.formatDateTime(m.timestamp) : '') + '</span></div><div class="chat-message-content">' + Components.renderMarkdown(content) + '</div></div>';
    }

    function buildToolCard(key, data) {
        var success = data.success !== false, statusColor = success ? 'var(--green)' : 'var(--red)', statusText = success ? '成功' : '失败';
        var duration = data.duration ? (data.duration + 'ms') : '';
        var resultStr = typeof data.result === 'string' ? data.result : JSON.stringify(data.result || {}, null, 2);
        return '<div class="tool-call-card" data-action="toggleToolCard" data-key="' + Components.escapeHtml(key) + '" style="margin:8px 0;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-secondary);cursor:pointer">' +
            '<div style="display:flex;align-items:center;gap:8px"><span style="color:var(--accent)">' + Components.icon('zap', 14) + '</span>' +
            '<span style="font-size:12px;font-weight:500">' + Components.escapeHtml(data.tool_name || data.name || '工具调用') + '</span>' +
            '<span style="font-size:11px;color:' + statusColor + '">' + Components.icon('check', 11) + ' ' + statusText + '</span>' +
            (duration ? '<span style="font-size:10px;color:var(--text-tertiary)">' + Components.icon('clock', 10) + ' ' + duration + '</span>' : '') +
            '<span style="margin-left:auto;color:var(--text-tertiary)">' + Components.icon('chevronDown', 12) + '</span></div>' +
            '<div class="tool-card-result" style="display:none;margin-top:8px;padding:8px;background:var(--bg);border-radius:var(--radius-xs);font-size:11px;max-height:200px;overflow:auto;white-space:pre-wrap;color:var(--text-secondary)">' + Components.escapeHtml(resultStr) + '</div></div>';
    }

    function buildTypingIndicator() {
        if (!_isTyping) return '';
        return '<div class="chat-message assistant typing-indicator"><div class="chat-message-header"><span class="chat-message-role">助手</span></div><div style="display:flex;gap:4px;padding:8px 0">' +
            '<span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--text-tertiary);animation:typingBounce .6s infinite alternate"></span>' +
            '<span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--text-tertiary);animation:typingBounce .6s .2s infinite alternate"></span>' +
            '<span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--text-tertiary);animation:typingBounce .6s .4s infinite alternate"></span></div></div>';
    }

    function buildMessageList(messages) {
        if (!_currentId) return '<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)"><div style="font-size:32px;margin-bottom:12px">' + Components.icon('radio', 32) + '</div><div style="font-size:14px;margin-bottom:4px">选择左侧会话查看对话记录</div><div style="font-size:12px">会话由智能体自动创建，消息实时同步</div></div>';
        if (messages.length === 0 && Object.keys(_toolCards).length === 0) return '<div style="padding:40px;text-align:center;color:var(--text-tertiary)"><div style="font-size:24px;margin-bottom:8px">' + Components.icon('edit', 24) + '</div><div>等待消息...</div></div>';
        var summaryHtml = '', cs = currentSession();
        if (cs && cs.summary) {
            summaryHtml = '<div class="session-summary-card" style="margin:12px 16px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-secondary);overflow:hidden"><div class="summary-header" data-action="toggleSummary" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;user-select:none"><span style="font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px">' + Components.icon('clipboard', 13) + ' 会话摘要</span><span class="summary-chevron" style="font-size:10px;color:var(--text-tertiary);transition:transform .2s">' + Components.icon('chevronDown', 12) + '</span></div><div class="summary-content" style="padding:0 12px 10px;font-size:12px;color:var(--text-secondary);line-height:1.6;display:none">' + Components.renderMarkdown(cs.summary) + '</div></div>';
        }
        var toolCardsHtml = Object.keys(_toolCards).map(function (k) { return buildToolCard(k, _toolCards[k]); }).join('');
        return '<div class="chat-messages" id="chatMessages">' + summaryHtml + toolCardsHtml + messages.map(buildMessageItem).join('') + buildTypingIndicator() + '</div>';
    }

    function buildSessionHeader(cs) {
        if (!cs) return '';
        var pinned = cs.pinned;
        return '<div class="chat-main-header"><div style="display:flex;align-items:center;gap:8px"><span class="session-title" data-action="editTitle" data-id="' + _currentId + '" style="font-weight:500;cursor:pointer" title="双击编辑">' + Components.escapeHtml(cs.title || cs.id) + '</span>' + (cs.model ? Components.renderBadge(cs.model, 'blue') : '') + '</div>' +
            '<div style="display:flex;gap:6px;align-items:center"><span style="font-size:12px;color:var(--text-tertiary)">' + _messages.length + ' 条消息</span>' +
            '<div style="position:relative" class="knowledge-dropdown-wrap"><button type="button" class="btn btn-sm btn-ghost" data-action="toggleKnowledge" style="color:var(--text-secondary)" title="知识提取">' + Components.icon('lightbulb', 14) + '</button>' +
            '<div class="knowledge-dropdown" style="display:none;position:absolute;right:0;top:100%;z-index:50;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:4px;min-width:150px">' +
            '<div data-action="knowledgeAction" data-kaction="summarize" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('clipboard', 13) + ' 生成摘要</div>' +
            '<div data-action="knowledgeAction" data-kaction="extract" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('brain', 13) + ' 提取信息</div>' +
            '<div style="height:1px;background:var(--border);margin:3px 0"></div>' +
            '<div data-action="knowledgeAction" data-kaction="toSkill" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('book', 13) + ' 转为技能</div>' +
            '<div data-action="knowledgeAction" data-kaction="toMemory" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('brain', 13) + ' 转为记忆</div>' +
            '<div data-action="knowledgeAction" data-kaction="toLearning" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('book', 13) + ' 转为学习记录</div></div></div>' +
            '<div style="position:relative" class="export-dropdown-wrap"><button type="button" class="btn btn-sm btn-ghost" data-action="toggleExport" style="color:var(--text-secondary)">' + Components.icon('download', 14) + '</button>' +
            '<div class="export-dropdown" style="display:none;position:absolute;right:0;top:100%;z-index:50;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:4px;min-width:120px">' +
            '<div data-action="export" data-format="markdown" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('file', 13) + ' Markdown</div>' +
            '<div data-action="export" data-format="json" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('code', 13) + ' JSON</div>' +
            '<div data-action="export" data-format="csv" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('table', 13) + ' CSV</div></div></div>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="archiveSession" data-id="' + _currentId + '" style="color:var(--text-secondary)" title="归档">' + Components.icon('archive', 14) + '</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="pinSession" data-id="' + _currentId + '" data-pinned="' + (pinned ? 'false' : 'true') + '" style="color:' + (pinned ? 'var(--orange)' : 'var(--text-secondary)') + '" title="置顶">' + Components.icon('star', 14) + '</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="deleteSession" data-id="' + _currentId + '" style="color:var(--red)" title="删除">' + Components.icon('trash', 14) + '</button></div></div>';
    }

    function render(containerSelector, sessions, currentId, messages) {
        var container = document.querySelector(containerSelector);
        if (!container) return;
        _sessions = sessions; _currentId = currentId; _messages = messages; _toolCards = {};
        container.innerHTML = buildStatusBar() + buildSessionHeader(currentSession()) + buildMessageList(_messages);
        bindEvents(containerSelector);
        scrollToBottom();
    }

    function refreshMain() {
        var mainEl = document.querySelector('#sessions-main');
        if (!mainEl) return;
        mainEl.innerHTML = buildStatusBar() + buildSessionHeader(currentSession()) + buildMessageList(_messages);
        bindEvents('#sessions-main');
        scrollToBottom();
    }

    function refreshStatusBar() { var bar = document.querySelector('.session-status-bar'); if (bar) bar.outerHTML = buildStatusBar(); }

    function appendMessage(msg) {
        var container = document.getElementById('chatMessages');
        if (!container) return;
        var typing = container.querySelector('.typing-indicator');
        if (typing) typing.remove();
        var div = document.createElement('div');
        div.innerHTML = buildMessageItem(msg);
        var el = div.firstElementChild;
        el.style.opacity = '0'; el.style.transform = 'translateY(8px)'; el.style.transition = 'all 0.25s ease';
        container.appendChild(el);
        requestAnimationFrame(function () { el.style.opacity = '1'; el.style.transform = 'translateY(0)'; });
        if (!_userScrolledUp) scrollToBottom();
    }

    function appendToolCard(key, data) {
        _toolCards[key] = data;
        var container = document.getElementById('chatMessages');
        if (!container) return;
        var div = document.createElement('div');
        div.innerHTML = buildToolCard(key, data);
        container.appendChild(div.firstElementChild);
        if (!_userScrolledUp) scrollToBottom();
    }

    function showTypingIndicator() {
        if (_isTyping) return;
        _isTyping = true;
        var container = document.getElementById('chatMessages');
        if (!container) return;
        var div = document.createElement('div');
        div.innerHTML = buildTypingIndicator();
        container.appendChild(div.firstElementChild);
        if (!_userScrolledUp) scrollToBottom();
    }

    function hideTypingIndicator() { _isTyping = false; var el = document.querySelector('.typing-indicator'); if (el) el.remove(); }

    function toggleSummary() {
        var content = document.querySelector('.summary-content'), chevron = document.querySelector('.summary-chevron');
        if (!content) return;
        var isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    function bindEvents(containerSelector) {
        var container = document.querySelector(containerSelector);
        if (!container) return;
        var chatEl = document.getElementById('chatMessages');
        if (chatEl) chatEl.addEventListener('scroll', function () { _userScrolledUp = (chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight) > 60; });
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            if (btn.dataset.action === 'toggleToolCard') { var r = btn.querySelector('.tool-card-result'); if (r) r.style.display = r.style.display === 'none' ? 'block' : 'none'; }
            if (btn.dataset.action === 'toggleSummary') toggleSummary();
        });
        container.addEventListener('dblclick', function (e) { var t = e.target.closest('.session-title'); if (t) document.dispatchEvent(new CustomEvent('sessions:editTitle', { detail: { id: t.dataset.id } })); });
    }

    function destroy() { _sessions = []; _currentId = null; _messages = []; _toolCards = {}; _isTyping = false; _userScrolledUp = false; _sseConnected = false; }

    return {
        render, refreshMain, refreshStatusBar, destroy,
        appendMessage, appendToolCard, showTypingIndicator, hideTypingIndicator,
        scrollToBottom, toggleSummary, currentSession, buildMessageItem, buildToolCard,
        getSessions: function () { return _sessions; }, setSessions: function (v) { _sessions = v; },
        getCurrentId: function () { return _currentId; }, setCurrentId: function (v) { _currentId = v; },
        getMessages: function () { return _messages; }, setMessages: function (v) { _messages = v; },
        getToolCards: function () { return _toolCards; }, setToolCards: function (v) { _toolCards = v; },
        setSSEConnected: function (v) { _sseConnected = v; }
    };
})();

export default ChatView;
