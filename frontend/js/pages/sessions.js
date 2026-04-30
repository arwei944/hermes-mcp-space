/**
 * 会话页面 - 智能体与用户对话实时记录器
 * 支持实时流式对话、标签管理、全文搜索、导出等功能
 */

const SessionsPage = (() => {
    // ---- 状态 ----
    var _sessions = [];
    var _currentId = null;
    var _messages = [];
    var _searchTerm = '';
    var _statusFilter = '';
    var _activeTag = null;
    var _allTags = [];
    var _sseConnected = false;
    var _isTyping = false;
    var _userScrolledUp = false;
    var _searchResults = null;
    var _isSearching = false;
    var _toolCards = {};
    var _batchMode = false;
    var _selectedIds = {};

    // ==========================================
    // 工具函数
    // ==========================================

    /** 根据标签名生成一致的颜色 */
    function tagColor(name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        var colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488'];
        return colors[Math.abs(hash) % colors.length];
    }

    /** 获取当前会话对象 */
    function currentSession() {
        return _sessions.find(function (s) { return (s.id || s.session_id) === _currentId; });
    }

    /** 获取过滤后的会话列表 */
    function getFilteredSessions() {
        var result = _searchResults || _sessions;
        if (_statusFilter) {
            result = result.filter(function (s) { return (s.status || '') === _statusFilter; });
        }
        if (_activeTag) {
            result = result.filter(function (s) {
                return (s.tags || []).indexOf(_activeTag) !== -1;
            });
        }
        return result;
    }

    // ==========================================
    // 数据加载
    // ==========================================

    async function render(sessionId) {
        var container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try { _sessions = await API.sessions.list(); } catch (_e) { _sessions = []; }
        try { _allTags = await API.sessions.tags(); } catch (_e) { _allTags = []; }

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
        _toolCards = {};
        try {
            var data = await API.sessions.messages(id);
            _messages = data.messages || data || [];
        } catch (_e) { _messages = []; }
    }

    // ==========================================
    // 渲染：状态栏
    // ==========================================

    function buildStatusBar() {
        var cs = currentSession();
        var dotColor = _sseConnected ? 'var(--green)' : 'var(--red)';
        var statusText = _sseConnected ? '已连接' : '未连接';
        var sessionName = cs ? Components.escapeHtml(cs.title || cs.source || cs.id) : '未选择会话';
        return '<div class="session-status-bar" style="display:flex;align-items:center;gap:12px;padding:8px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border);font-size:12px;color:var(--text-secondary)">' +
            '<span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:50%;background:' + dotColor + ';display:inline-block"></span>' + statusText + '</span>' +
            '<span style="color:var(--text-tertiary)">|</span>' +
            '<span style="display:flex;align-items:center;gap:4px">' + Components.icon('messageCircle', 13) + sessionName + '</span>' +
            '<span style="color:var(--text-tertiary)">|</span>' +
            '<span>' + _messages.length + ' 条消息</span>' +
            '</div>';
    }

    // ==========================================
    // 渲染：会话列表项
    // ==========================================

    function buildSessionItem(s) {
        var id = s.id || s.session_id;
        var isActive = id === _currentId;
        var msgCount = s.message_count || s.messages || 0;
        var tags = s.tags || [];
        var pinned = s.pinned;
        var hasNew = s._newMessages;
        var isSelected = !!_selectedIds[id];

        var checkboxHtml = '';
        if (_batchMode) {
            var checkIcon = isSelected ? 'check' : 'minus';
            var checkBg = isSelected ? 'var(--accent)' : 'transparent';
            var checkBorder = isSelected ? 'none' : '2px solid var(--text-tertiary)';
            var checkColor = isSelected ? '#fff' : 'transparent';
            checkboxHtml = '<div data-action="toggleSelect" data-id="' + id + '" style="flex-shrink:0;width:18px;height:18px;border-radius:4px;background:' + checkBg + ';border:' + checkBorder + ';display:flex;align-items:center;justify-content:center;cursor:pointer;margin-right:8px;transition:all .15s">' +
                '<span style="font-size:12px;color:' + checkColor + '">' + Components.icon(checkIcon, 12) + '</span></div>';
        }

        var tagsHtml = '';
        if (tags.length > 0) {
            tagsHtml = '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">' +
                tags.map(function (t) {
                    return '<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:' + tagColor(t) + '22;color:' + tagColor(t) + ';white-space:nowrap">' + Components.escapeHtml(t) + '</span>';
                }).join('') + '</div>';
        }

        return '<div class="session-item ' + (isActive ? 'active' : '') + (hasNew ? ' pulse' : '') + '" data-action="select" data-id="' + id + '" style="display:flex;align-items:flex-start">' +
            checkboxHtml +
            '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
                '<span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Components.escapeHtml(s.title || s.source || id) + '</span>' +
                '<div style="display:flex;gap:2px;align-items:center;flex-shrink:0">' +
                    (pinned ? '<span style="color:var(--orange)">' + Components.icon('star', 12) + '</span>' : '') +
                    (s.model ? Components.renderBadge(s.model, 'blue') : '') +
                    (!_batchMode ? '<button type="button" class="btn btn-sm btn-ghost" style="padding:2px 4px;font-size:11px;color:var(--text-tertiary)" data-action="sessionMenu" data-id="' + id + '" title="更多操作">' + Components.icon('chevronDown', 12) + '</button>' : '') +
                '</div>' +
            '</div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;display:flex;gap:8px">' +
                '<span>' + msgCount + ' 条消息</span>' +
            '</div>' +
            tagsHtml +
            '</div>' +
        '</div>';
    }

    // ==========================================
    // 渲染：会话列表（含空状态）
    // ==========================================

    function buildSessionList(filtered) {
        if (_isSearching && filtered.length === 0) {
            return '<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary)">' +
                '<div style="font-size:32px;margin-bottom:12px">' + Components.icon('search', 32) + '</div>' +
                '<div style="font-size:14px;margin-bottom:4px">未找到匹配的会话</div>' +
                '<div style="font-size:12px">尝试更换关键词搜索</div></div>';
        }
        if (_sessions.length === 0) {
            return '<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary)">' +
                '<div style="font-size:32px;margin-bottom:12px">' + Components.icon('radio', 32) + '</div>' +
                '<div style="font-size:14px;margin-bottom:4px">等待智能体创建会话</div>' +
                '<div style="font-size:12px">会话将通过 MCP 自动创建并实时同步</div></div>';
        }
        return filtered.map(buildSessionItem).join('');
    }

    // ==========================================
    // 渲染：标签过滤栏
    // ==========================================

    function buildTagFilter() {
        var chips = '';
        if (_allTags.length > 0) {
            chips = _allTags.map(function (t) {
                var isActive = _activeTag === t;
                var bg = isActive ? tagColor(t) : 'transparent';
                var color = isActive ? '#fff' : tagColor(t);
                var border = isActive ? 'none' : '1px solid ' + tagColor(t) + '44';
                return '<span class="tag-chip" data-action="filterTag" data-tag="' + Components.escapeHtml(t) + '" style="font-size:11px;padding:2px 8px;border-radius:10px;cursor:pointer;background:' + bg + ';color:' + color + ';border:' + border + ';display:inline-flex;align-items:center;gap:3px;transition:all .15s">' +
                    Components.escapeHtml(t) +
                    (isActive ? ' <span data-action="clearTagFilter" style="margin-left:2px">' + Components.icon('x', 10) + '</span>' : '') +
                '</span>';
            }).join('');
        }
        return '<div style="padding:4px 12px;display:flex;gap:4px;flex-wrap:wrap;align-items:center">' +
            '<span style="font-size:11px;color:var(--text-tertiary);margin-right:2px">' + Components.icon('tag', 11) + '</span>' +
            chips +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="addTag" style="font-size:10px;padding:1px 6px;color:var(--text-tertiary)">+ 标签</button>' +
        '</div>';
    }

    // ==========================================
    // 渲染：消息
    // ==========================================

    function buildMessageItem(m) {
        var isUser = m.role === 'user';
        var roleText = { user: '用户', assistant: '助手', system: '系统' }[m.role] || m.role;
        var content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
        return '<div class="chat-message ' + (isUser ? 'user' : 'assistant') + '">' +
            '<div class="chat-message-header">' +
                '<span class="chat-message-role">' + roleText + '</span>' +
                '<span class="chat-message-time">' + (m.timestamp ? Components.formatDateTime(m.timestamp) : '') + '</span>' +
            '</div>' +
            '<div class="chat-message-content">' + Components.renderMarkdown(content) + '</div>' +
        '</div>';
    }

    function buildToolCard(key, data) {
        var success = data.success !== false;
        var statusColor = success ? 'var(--green)' : 'var(--red)';
        var statusText = success ? '成功' : '失败';
        var duration = data.duration ? (data.duration + 'ms') : '';
        var resultStr = typeof data.result === 'string' ? data.result : JSON.stringify(data.result || {}, null, 2);
        return '<div class="tool-call-card" data-action="toggleToolCard" data-key="' + Components.escapeHtml(key) + '" style="margin:8px 0;padding:10px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-secondary);cursor:pointer">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
                '<span style="color:var(--accent)">' + Components.icon('zap', 14) + '</span>' +
                '<span style="font-size:12px;font-weight:500">' + Components.escapeHtml(data.tool_name || data.name || '工具调用') + '</span>' +
                '<span style="font-size:11px;color:' + statusColor + '">' + Components.icon('check', 11) + ' ' + statusText + '</span>' +
                (duration ? '<span style="font-size:10px;color:var(--text-tertiary)">' + Components.icon('clock', 10) + ' ' + duration + '</span>' : '') +
                '<span style="margin-left:auto;color:var(--text-tertiary)">' + Components.icon('chevronDown', 12) + '</span>' +
            '</div>' +
            '<div class="tool-card-result" style="display:none;margin-top:8px;padding:8px;background:var(--bg);border-radius:var(--radius-xs);font-size:11px;max-height:200px;overflow:auto;white-space:pre-wrap;color:var(--text-secondary)">' + Components.escapeHtml(resultStr) + '</div>' +
        '</div>';
    }

    function buildTypingIndicator() {
        if (!_isTyping) return '';
        return '<div class="chat-message assistant typing-indicator">' +
            '<div class="chat-message-header"><span class="chat-message-role">助手</span></div>' +
            '<div style="display:flex;gap:4px;padding:8px 0">' +
                '<span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--text-tertiary);animation:typingBounce .6s infinite alternate"></span>' +
                '<span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--text-tertiary);animation:typingBounce .6s .2s infinite alternate"></span>' +
                '<span class="typing-dot" style="width:6px;height:6px;border-radius:50%;background:var(--text-tertiary);animation:typingBounce .6s .4s infinite alternate"></span>' +
            '</div>' +
        '</div>';
    }

    function buildMessageList(messages) {
        if (!_currentId) {
            return '<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">' +
                '<div style="font-size:32px;margin-bottom:12px">' + Components.icon('radio', 32) + '</div>' +
                '<div style="font-size:14px;margin-bottom:4px">选择左侧会话查看对话记录</div>' +
                '<div style="font-size:12px">会话由智能体自动创建，消息实时同步</div></div>';
        }
        if (messages.length === 0 && Object.keys(_toolCards).length === 0) {
            return '<div style="padding:40px;text-align:center;color:var(--text-tertiary)">' +
                '<div style="font-size:24px;margin-bottom:8px">' + Components.icon('edit', 24) + '</div>' +
                '<div>等待消息...</div></div>';
        }

        var summaryHtml = '';
        var cs = currentSession();
        if (cs && cs.summary) {
            summaryHtml = '<div class="session-summary-card" style="margin:12px 16px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-secondary);overflow:hidden">' +
                '<div class="summary-header" data-action="toggleSummary" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;user-select:none">' +
                    '<span style="font-size:12px;font-weight:500;display:flex;align-items:center;gap:6px">' + Components.icon('clipboard', 13) + ' 会话摘要</span>' +
                    '<span class="summary-chevron" style="font-size:10px;color:var(--text-tertiary);transition:transform .2s">' + Components.icon('chevronDown', 12) + '</span>' +
                '</div>' +
                '<div class="summary-content" style="padding:0 12px 10px;font-size:12px;color:var(--text-secondary);line-height:1.6;display:none">' +
                    Components.renderMarkdown(cs.summary) +
                '</div>' +
            '</div>';
        }

        var toolCardsHtml = '';
        var keys = Object.keys(_toolCards);
        if (keys.length > 0) {
            toolCardsHtml = keys.map(function (k) { return buildToolCard(k, _toolCards[k]); }).join('');
        }

        return '<div class="chat-messages" id="chatMessages">' +
            summaryHtml +
            toolCardsHtml +
            messages.map(buildMessageItem).join('') +
            buildTypingIndicator() +
        '</div>';
    }

    // ==========================================
    // 渲染：会话头部
    // ==========================================

    function buildSessionHeader(cs) {
        if (!cs) return '';
        var pinned = cs.pinned;
        return '<div class="chat-main-header">' +
            '<div style="display:flex;align-items:center;gap:8px">' +
                '<span class="session-title" data-action="editTitle" data-id="' + _currentId + '" style="font-weight:500;cursor:pointer" title="双击编辑">' + Components.escapeHtml(cs.title || cs.id) + '</span>' +
                (cs.model ? Components.renderBadge(cs.model, 'blue') : '') +
            '</div>' +
            '<div style="display:flex;gap:6px;align-items:center">' +
                '<span style="font-size:12px;color:var(--text-tertiary)">' + _messages.length + ' 条消息</span>' +
                '<div style="position:relative" class="knowledge-dropdown-wrap">' +
                    '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleKnowledge" style="color:var(--text-secondary)" title="知识提取">' + Components.icon('lightbulb', 14) + '</button>' +
                    '<div class="knowledge-dropdown" style="display:none;position:absolute;right:0;top:100%;z-index:50;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:4px;min-width:150px">' +
                        '<div data-action="knowledgeAction" data-kaction="summarize" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('clipboard', 13) + ' 生成摘要</div>' +
                        '<div data-action="knowledgeAction" data-kaction="extract" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('brain', 13) + ' 提取信息</div>' +
                        '<div style="height:1px;background:var(--border);margin:3px 0"></div>' +
                        '<div data-action="knowledgeAction" data-kaction="toSkill" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('book', 13) + ' 转为技能</div>' +
                        '<div data-action="knowledgeAction" data-kaction="toMemory" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('brain', 13) + ' 转为记忆</div>' +
                        '<div data-action="knowledgeAction" data-kaction="toLearning" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('book', 13) + ' 转为学习记录</div>' +
                    '</div>' +
                '</div>' +
                '<div style="position:relative" class="export-dropdown-wrap">' +
                    '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleExport" style="color:var(--text-secondary)">' + Components.icon('download', 14) + '</button>' +
                    '<div class="export-dropdown" style="display:none;position:absolute;right:0;top:100%;z-index:50;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:4px;min-width:120px">' +
                        '<div data-action="export" data-format="markdown" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('file', 13) + ' Markdown</div>' +
                        '<div data-action="export" data-format="json" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('code', 13) + ' JSON</div>' +
                        '<div data-action="export" data-format="csv" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('table', 13) + ' CSV</div>' +
                    '</div>' +
                '</div>' +
                '<button type="button" class="btn btn-sm btn-ghost" data-action="archiveSession" data-id="' + _currentId + '" style="color:var(--text-secondary)" title="归档">' + Components.icon('archive', 14) + '</button>' +
                '<button type="button" class="btn btn-sm btn-ghost" data-action="pinSession" data-id="' + _currentId + '" data-pinned="' + (pinned ? 'false' : 'true') + '" style="color:' + (pinned ? 'var(--orange)' : 'var(--text-secondary)') + '" title="置顶">' + Components.icon('star', 14) + '</button>' +
                '<button type="button" class="btn btn-sm btn-ghost" data-action="deleteSession" data-id="' + _currentId + '" style="color:var(--red)" title="删除">' + Components.icon('trash', 14) + '</button>' +
            '</div>' +
        '</div>';
    }

    // ==========================================
    // 渲染：筛选器
    // ==========================================

    function buildFilterOptions() {
        var activeCount = _sessions.filter(function (s) { return s.status === 'active'; }).length;
        return '<option value="">全部 (' + _sessions.length + ')</option>' +
            '<option value="active" ' + (_statusFilter === 'active' ? 'selected' : '') + '>活跃 (' + activeCount + ')</option>' +
            '<option value="completed" ' + (_statusFilter === 'completed' ? 'selected' : '') + '>完成 (' + (_sessions.length - activeCount) + ')</option>';
    }

    // ==========================================
    // 页面构建
    // ==========================================

    function buildPage() {
        var filtered = getFilteredSessions();
        var cs = currentSession();

        return '<style>' +
            '@keyframes typingBounce { 0% { opacity: 0.3; transform: translateY(0); } 100% { opacity: 1; transform: translateY(-4px); } }' +
            '@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(79,70,229,0.3); } 50% { box-shadow: 0 0 0 6px rgba(79,70,229,0); } }' +
            '.session-item.pulse { animation: pulse 1.5s infinite; }' +
            '.session-item.pulse.active { animation: none; }' +
            '.tool-call-card:hover { border-color: var(--accent); }' +
            '.export-dropdown div:hover { background: var(--bg-secondary); }' +
            '.knowledge-dropdown div:hover { background: var(--bg-secondary); }' +
            '.tag-chip:hover { opacity: 0.85; }' +
            '.batch-action-bar { position:sticky;bottom:0;left:0;right:0;background:var(--bg);border-top:1px solid var(--border);padding:10px 12px;display:flex;align-items:center;gap:8px;z-index:40;box-shadow:0 -2px 8px rgba(0,0,0,0.1); }' +
            '.batch-action-bar .btn { font-size: 12px; padding: 4px 10px; }' +
        '</style>' +
        '<div class="chat-layout">' +
            '<div class="chat-sidebar">' +
                '<div class="chat-sidebar-header">' +
                    '<h3>对话记录</h3>' +
                    '<div style="display:flex;gap:4px;align-items:center">' +
                        (_batchMode
                            ? '<button type="button" class="btn btn-sm btn-ghost" data-action="selectAll" style="font-size:11px;padding:2px 6px;color:var(--text-secondary)">全选</button>' +
                              '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchMode" style="font-size:11px;padding:2px 6px;color:var(--red)">退出批量</button>'
                            : '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchMode" style="font-size:11px;padding:2px 6px;color:var(--text-tertiary)" title="批量操作">' + Components.icon('checkSquare', 14) + '</button>'
                        ) +
                        '<span style="font-size:11px;color:var(--text-tertiary)">实时同步</span>' +
                    '</div>' +
                '</div>' +
                '<div class="chat-sidebar-search" style="position:relative">' +
                    '<span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)">' + Components.icon('search', 14) + '</span>' +
                    '<input type="text" id="sessionSearch" placeholder="搜索会话标题和内容..." value="' + Components.escapeHtml(_searchTerm) + '" style="padding-left:30px">' +
                '</div>' +
                '<div style="padding:4px 12px;display:flex;gap:4px">' +
                    '<select id="statusFilter" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:11px;outline:none;color:var(--text-secondary)">' +
                        buildFilterOptions() +
                    '</select>' +
                '</div>' +
                buildTagFilter() +
                '<div class="chat-sidebar-list">' + buildSessionList(filtered) + '</div>' +
                (_batchMode ? buildBatchActionBar() : '') +
            '</div>' +
            '<div class="chat-main">' +
                buildStatusBar() +
                buildSessionHeader(cs) +
                buildMessageList(_messages) +
            '</div>' +
        '</div>';
    }

    // ==========================================
    // 局部更新
    // ==========================================

    function refreshSidebar() {
        var listEl = document.querySelector('.chat-sidebar-list');
        if (!listEl) return;
        listEl.innerHTML = buildSessionList(getFilteredSessions());
        var filterEl = document.getElementById('statusFilter');
        if (filterEl) filterEl.innerHTML = buildFilterOptions();
    }

    function refreshMain() {
        var mainEl = document.querySelector('.chat-main');
        if (!mainEl) return;
        var cs = currentSession();
        mainEl.innerHTML = buildStatusBar() + buildSessionHeader(cs) + buildMessageList(_messages);
        bindMainEvents();
        scrollToBottom();
    }

    function refreshStatusBar() {
        var bar = document.querySelector('.session-status-bar');
        if (bar) bar.outerHTML = buildStatusBar();
    }

    // ==========================================
    // 操作函数
    // ==========================================

    async function select(id) {
        _searchResults = null;
        _isSearching = false;
        await loadMessages(id);
        document.querySelectorAll('.session-item').forEach(function (el) {
            el.classList.toggle('active', el.dataset.id === id);
        });
        refreshMain();
    }

    function appendMessage(msg) {
        var container = document.getElementById('chatMessages');
        if (!container) return;
        // 移除 typing indicator
        var typing = container.querySelector('.typing-indicator');
        if (typing) typing.remove();
        var div = document.createElement('div');
        div.innerHTML = buildMessageItem(msg);
        var el = div.firstElementChild;
        el.style.opacity = '0';
        el.style.transform = 'translateY(8px)';
        el.style.transition = 'all 0.25s ease';
        container.appendChild(el);
        requestAnimationFrame(function () {
            el.style.opacity = '1';
            el.style.transform = 'translateY(0)';
        });
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

    function hideTypingIndicator() {
        _isTyping = false;
        var el = document.querySelector('.typing-indicator');
        if (el) el.remove();
    }

    function scrollToBottom() {
        requestAnimationFrame(function () {
            var el = document.getElementById('chatMessages');
            if (el) el.scrollTop = el.scrollHeight;
        });
    }

    // ---- 删除 ----
    async function deleteSession(id) {
        var ok = await Components.Modal.confirm({
            title: '删除会话',
            message: '确定要删除此会话吗？会话中的所有消息将被删除，此操作不可撤销。',
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;
        try {
            await API.sessions.delete(id);
            _sessions = _sessions.filter(function (s) { return (s.id || s.session_id) !== id; });
            if (_currentId === id) {
                _currentId = null;
                _messages = [];
                _toolCards = {};
                if (_sessions.length > 0) {
                    var nextId = _sessions[0].id || _sessions[0].session_id;
                    await loadMessages(nextId);
                }
            }
            refreshSidebar();
            refreshMain();
            Components.Toast.success('会话已删除');
        } catch (err) {
            Components.Toast.error('删除失败: ' + err.message);
        }
    }

    // ---- 置顶 ----
    async function pinSession(id, pinned) {
        try {
            await API.sessions.pin(id, pinned);
            var s = _sessions.find(function (s) { return (s.id || s.session_id) === id; });
            if (s) s.pinned = pinned;
            refreshSidebar();
            refreshMain();
            Components.Toast.success(pinned ? '已置顶' : '已取消置顶');
        } catch (err) {
            Components.Toast.error('操作失败: ' + err.message);
        }
    }

    // ---- 归档 ----
    async function archiveSession(id) {
        try {
            await API.sessions.archive(id, true);
            _sessions = _sessions.filter(function (s) { return (s.id || s.session_id) !== id; });
            if (_currentId === id) {
                _currentId = null;
                _messages = [];
                _toolCards = {};
                if (_sessions.length > 0) {
                    var nextId = _sessions[0].id || _sessions[0].session_id;
                    await loadMessages(nextId);
                }
            }
            refreshSidebar();
            refreshMain();
            Components.Toast.success('会话已归档');
        } catch (err) {
            Components.Toast.error('归档失败: ' + err.message);
        }
    }

    // ---- 重命名 ----
    async function renameSession(id, title) {
        if (!title || !title.trim()) return;
        try {
            await API.sessions.rename(id, title.trim());
            var s = _sessions.find(function (s) { return (s.id || s.session_id) === id; });
            if (s) s.title = title.trim();
            refreshSidebar();
            refreshMain();
            Components.Toast.success('已重命名');
        } catch (err) {
            Components.Toast.error('重命名失败: ' + err.message);
        }
    }

    // ---- 导出 ----
    async function exportSession(id, format) {
        try {
            var blob = await API.sessions.exportSession(id, format);
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            var ext = { markdown: 'md', json: 'json', csv: 'csv' }[format] || 'txt';
            a.href = url;
            a.download = 'session_' + id + '.' + ext;
            a.click();
            URL.revokeObjectURL(url);
            Components.Toast.success('导出成功');
        } catch (err) {
            Components.Toast.error('导出失败: ' + err.message);
        }
    }

    // ---- 添加标签 ----
    async function addTagToSession(id, tag) {
        if (!tag || !tag.trim()) return;
        tag = tag.trim();
        var s = _sessions.find(function (s) { return (s.id || s.session_id) === id; });
        if (!s) return;
        var tags = s.tags || [];
        if (tags.indexOf(tag) === -1) {
            tags.push(tag);
            try {
                await API.sessions.setTags(id, tags);
                s.tags = tags;
                if (_allTags.indexOf(tag) === -1) _allTags.push(tag);
                refreshSidebar();
                refreshMain();
                Components.Toast.success('标签已添加');
            } catch (err) {
                Components.Toast.error('添加标签失败: ' + err.message);
            }
        }
    }

    // ---- 内联编辑标题 ----
    function startEditTitle(id) {
        var el = document.querySelector('.session-title');
        if (!el) return;
        var s = _sessions.find(function (s) { return (s.id || s.session_id) === id; });
        var oldTitle = s ? (s.title || '') : '';
        var input = document.createElement('input');
        input.type = 'text';
        input.value = oldTitle;
        input.className = 'form-input';
        input.style.cssText = 'font-size:14px;font-weight:500;padding:2px 6px;width:300px';
        el.replaceWith(input);
        input.focus();
        input.select();

        function finish() {
            var newTitle = input.value;
            input.replaceWith(el);
            if (newTitle !== oldTitle) renameSession(id, newTitle);
        }
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') input.blur();
            if (e.key === 'Escape') { input.value = oldTitle; input.blur(); }
        });
    }

    // ---- 内联添加标签 ----
    function showAddTagInput() {
        var filterBar = document.querySelector('.chat-sidebar-list');
        if (!filterBar) return;
        var existing = document.querySelector('.add-tag-inline');
        if (existing) { existing.remove(); return; }

        var wrap = document.createElement('div');
        wrap.className = 'add-tag-inline';
        wrap.style.cssText = 'padding:4px 12px;display:flex;gap:4px;align-items:center';
        wrap.innerHTML = '<input type="text" class="form-input" placeholder="输入标签名..." style="flex:1;font-size:11px;padding:4px 8px">' +
            '<button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 8px">添加</button>';
        filterBar.parentElement.insertBefore(wrap, filterBar);

        var input = wrap.querySelector('input');
        var btn = wrap.querySelector('button');
        input.focus();

        function doAdd() {
            var tag = input.value.trim();
            if (tag && _currentId) {
                addTagToSession(_currentId, tag);
            }
            wrap.remove();
        }
        btn.addEventListener('click', doAdd);
        input.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') doAdd();
            if (e.key === 'Escape') wrap.remove();
        });
    }

    // ==========================================
    // 搜索
    // ==========================================

    var debouncedSearch = Components.debounce(async function (term) {
        _searchTerm = term;
        if (!term || !term.trim()) {
            _searchResults = null;
            _isSearching = false;
            refreshSidebar();
            return;
        }
        _isSearching = true;
        try {
            var data = await API.sessions.search({ q: term });
            _searchResults = data.sessions || data || [];
        } catch (_e) {
            _searchResults = [];
        }
        refreshSidebar();
    }, 300);

    // ==========================================
    // 事件绑定
    // ==========================================

    function bindMainEvents() {
        var mainEl = document.querySelector('.chat-main');
        if (!mainEl) return;

        // 滚动检测
        var chatEl = document.getElementById('chatMessages');
        if (chatEl) {
            chatEl.addEventListener('scroll', function () {
                var threshold = 60;
                _userScrolledUp = (chatEl.scrollHeight - chatEl.scrollTop - chatEl.clientHeight) > threshold;
            });
        }
    }

    function bindEvents() {
        var container = document.getElementById('contentBody');
        if (!container) return;

        // 事件委托
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.dataset.action;
            var id = btn.dataset.id;

            switch (action) {
                case 'select':
                    select(id);
                    break;
                case 'deleteSession':
                    e.stopPropagation();
                    deleteSession(id);
                    break;
                case 'pinSession':
                    e.stopPropagation();
                    pinSession(id, btn.dataset.pinned === 'true');
                    break;
                case 'archiveSession':
                    e.stopPropagation();
                    archiveSession(id);
                    break;
                case 'editTitle':
                    startEditTitle(id);
                    break;
                case 'toggleExport':
                    e.stopPropagation();
                    var dd = btn.parentElement.querySelector('.export-dropdown');
                    if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none';
                    break;
                case 'export':
                    var format = btn.dataset.format;
                    exportSession(_currentId, format);
                    var dropdown = btn.closest('.export-dropdown');
                    if (dropdown) dropdown.style.display = 'none';
                    break;
                case 'toggleToolCard':
                    var result = btn.querySelector('.tool-card-result');
                    if (result) result.style.display = result.style.display === 'none' ? 'block' : 'none';
                    break;
                case 'filterTag':
                    _activeTag = _activeTag === btn.dataset.tag ? null : btn.dataset.tag;
                    refreshSidebar();
                    break;
                case 'clearTagFilter':
                    _activeTag = null;
                    refreshSidebar();
                    break;
                case 'addTag':
                    showAddTagInput();
                    break;
                case 'sessionMenu':
                    e.stopPropagation();
                    showContextMenu(btn, id);
                    break;
                case 'toggleBatchMode':
                    toggleBatchMode();
                    break;
                case 'toggleSelect':
                    e.stopPropagation();
                    toggleSelect(id);
                    break;
                case 'selectAll':
                    selectAll();
                    break;
                case 'batchDelete':
                    batchDeleteSessions();
                    break;
                case 'batchArchive':
                    batchArchiveSessions();
                    break;
                case 'batchAddTags':
                    batchAddTags();
                    break;
                case 'toggleBatchExport':
                    e.stopPropagation();
                    var bdd = btn.parentElement.querySelector('.batch-export-dropdown');
                    if (bdd) bdd.style.display = bdd.style.display === 'none' ? 'block' : 'none';
                    break;
                case 'batchExport':
                    var bformat = btn.dataset.format;
                    batchExportSessions(bformat);
                    var bdropdown = btn.closest('.batch-export-dropdown');
                    if (bdropdown) bdropdown.style.display = 'none';
                    break;
                case 'toggleKnowledge':
                    e.stopPropagation();
                    var kd = btn.parentElement.querySelector('.knowledge-dropdown');
                    if (kd) kd.style.display = kd.style.display === 'none' ? 'block' : 'none';
                    break;
                case 'knowledgeAction':
                    var kaction = btn.dataset.kaction;
                    handleKnowledgeAction(kaction, _currentId);
                    var kdropdown = btn.closest('.knowledge-dropdown');
                    if (kdropdown) kdropdown.style.display = 'none';
                    break;
                case 'toggleSummary':
                    toggleSummary();
                    break;
            }
        });

        // 双击编辑标题
        container.addEventListener('dblclick', function (e) {
            var titleEl = e.target.closest('.session-title');
            if (titleEl) startEditTitle(titleEl.dataset.id);
        });

        // 点击其他地方关闭导出下拉
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.export-dropdown-wrap')) {
                var dd = document.querySelector('.export-dropdown');
                if (dd) dd.style.display = 'none';
            }
            if (!e.target.closest('.knowledge-dropdown-wrap')) {
                var kd = document.querySelector('.knowledge-dropdown');
                if (kd) kd.style.display = 'none';
            }
            if (!e.target.closest('.batch-export-wrap')) {
                var bdd = document.querySelector('.batch-export-dropdown');
                if (bdd) bdd.style.display = 'none';
            }
            if (!e.target.closest('.context-menu')) {
                var cm = document.querySelector('.context-menu');
                if (cm) cm.remove();
            }
        });

        // 搜索
        var searchInput = document.getElementById('sessionSearch');
        if (searchInput) {
            searchInput.addEventListener('input', function (e) {
                debouncedSearch(e.target.value);
            });
        }

        // 状态筛选
        var statusSelect = document.getElementById('statusFilter');
        if (statusSelect) {
            statusSelect.addEventListener('change', function (e) {
                _statusFilter = e.target.value;
                refreshSidebar();
            });
        }

        bindMainEvents();
    }

    // ---- 右键菜单 ----
    function showContextMenu(anchor, id) {
        var existing = document.querySelector('.context-menu');
        if (existing) existing.remove();

        var s = _sessions.find(function (s) { return (s.id || s.session_id) === id; });
        var pinned = s && s.pinned;

        var menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = 'position:fixed;z-index:100;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:4px;min-width:140px;font-size:12px';

        var items = [
            { icon: 'edit', label: '重命名', action: 'renameCtx' },
            { icon: 'star', label: pinned ? '取消置顶' : '置顶', action: 'pinCtx' },
            { icon: 'archive', label: '归档', action: 'archiveCtx' },
            { icon: 'tag', label: '添加标签', action: 'addTagCtx' },
            { icon: 'download', label: '导出', action: 'exportCtx' },
            { icon: 'trash', label: '删除', action: 'deleteCtx', danger: true },
        ];

        menu.innerHTML = items.map(function (item) {
            var color = item.danger ? 'color:var(--red)' : '';
            return '<div data-action="' + item.action + '" data-id="' + id + '" style="padding:6px 10px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px;' + color + '">' +
                Components.icon(item.icon, 13) + ' ' + item.label + '</div>';
        }).join('');

        document.body.appendChild(menu);

        var rect = anchor.getBoundingClientRect();
        menu.style.top = rect.bottom + 4 + 'px';
        menu.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';

        menu.addEventListener('click', function (e) {
            var item = e.target.closest('[data-action]');
            if (!item) return;
            var action = item.dataset.action;
            menu.remove();
            switch (action) {
                case 'renameCtx': startEditTitle(id); break;
                case 'pinCtx': pinSession(id, !pinned); break;
                case 'archiveCtx': archiveSession(id); break;
                case 'addTagCtx':
                    _currentId = id;
                    showAddTagInput();
                    break;
                case 'exportCtx': exportSession(id, 'markdown'); break;
                case 'deleteCtx': deleteSession(id); break;
            }
        });
    }

    // ==========================================
    // 批量操作
    // ==========================================

    function getSelectedCount() {
        return Object.keys(_selectedIds).length;
    }

    function toggleBatchMode() {
        _batchMode = !_batchMode;
        _selectedIds = {};
        refreshSidebar();
        refreshMain();
    }

    function toggleSelect(id) {
        if (_selectedIds[id]) {
            delete _selectedIds[id];
        } else {
            _selectedIds[id] = true;
        }
        refreshSidebar();
    }

    function selectAll() {
        var filtered = getFilteredSessions();
        var allSelected = filtered.every(function (s) {
            return _selectedIds[s.id || s.session_id];
        });
        if (allSelected) {
            // 取消全选
            _selectedIds = {};
        } else {
            filtered.forEach(function (s) {
                _selectedIds[s.id || s.session_id] = true;
            });
        }
        refreshSidebar();
    }

    function buildBatchActionBar() {
        var count = getSelectedCount();
        return '<div class="batch-action-bar">' +
            '<span style="font-size:12px;color:var(--text-secondary);flex-shrink:0">已选择 ' + count + ' 个会话</span>' +
            '<div style="flex:1"></div>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="batchArchive" style="color:var(--text-secondary)" ' + (count === 0 ? 'disabled' : '') + '>' + Components.icon('archive', 13) + ' 归档</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="batchAddTags" style="color:var(--text-secondary)" ' + (count === 0 ? 'disabled' : '') + '>' + Components.icon('tag', 13) + ' 添加标签</button>' +
            '<div style="position:relative" class="batch-export-wrap">' +
                '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchExport" style="color:var(--text-secondary)" ' + (count === 0 ? 'disabled' : '') + '>' + Components.icon('download', 13) + ' 导出</button>' +
                '<div class="batch-export-dropdown" style="display:none;position:absolute;bottom:100%;right:0;margin-bottom:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:4px;min-width:120px">' +
                    '<div data-action="batchExport" data-format="markdown" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('file', 13) + ' Markdown</div>' +
                    '<div data-action="batchExport" data-format="json" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('code', 13) + ' JSON</div>' +
                '</div>' +
            '</div>' +
            '<button type="button" class="btn btn-sm" data-action="batchDelete" style="color:var(--red);background:var(--red);color:#fff" ' + (count === 0 ? 'disabled' : '') + '>' + Components.icon('trash', 13) + ' 删除</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchMode" style="color:var(--text-tertiary)">取消</button>' +
        '</div>';
    }

    async function batchDeleteSessions() {
        var ids = Object.keys(_selectedIds);
        if (ids.length === 0) return;
        var ok = await Components.Modal.confirm({
            title: '批量删除会话',
            message: '确定要删除选中的 ' + ids.length + ' 个会话吗？此操作不可撤销。',
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;
        try {
            await API.sessions.batchDelete(ids);
            _sessions = _sessions.filter(function (s) { return !_selectedIds[s.id || s.session_id]; });
            if (_selectedIds[_currentId]) {
                _currentId = null;
                _messages = [];
                _toolCards = {};
                if (_sessions.length > 0) {
                    var nextId = _sessions[0].id || _sessions[0].session_id;
                    await loadMessages(nextId);
                }
            }
            _selectedIds = {};
            _batchMode = false;
            refreshSidebar();
            refreshMain();
            Components.Toast.success('已删除 ' + ids.length + ' 个会话');
        } catch (err) {
            Components.Toast.error('批量删除失败: ' + err.message);
        }
    }

    async function batchArchiveSessions() {
        var ids = Object.keys(_selectedIds);
        if (ids.length === 0) return;
        try {
            await API.sessions.batchArchive(ids, true);
            _sessions = _sessions.filter(function (s) { return !_selectedIds[s.id || s.session_id]; });
            if (_selectedIds[_currentId]) {
                _currentId = null;
                _messages = [];
                _toolCards = {};
                if (_sessions.length > 0) {
                    var nextId = _sessions[0].id || _sessions[0].session_id;
                    await loadMessages(nextId);
                }
            }
            _selectedIds = {};
            _batchMode = false;
            refreshSidebar();
            refreshMain();
            Components.Toast.success('已归档 ' + ids.length + ' 个会话');
        } catch (err) {
            Components.Toast.error('批量归档失败: ' + err.message);
        }
    }

    async function batchAddTags() {
        var ids = Object.keys(_selectedIds);
        if (ids.length === 0) return;

        var tag = prompt('请输入要添加的标签:');
        if (!tag || !tag.trim()) return;
        tag = tag.trim();

        try {
            await API.sessions.batchTags(ids, [tag]);
            ids.forEach(function (id) {
                var s = _sessions.find(function (s) { return (s.id || s.session_id) === id; });
                if (s) {
                    if (!s.tags) s.tags = [];
                    if (s.tags.indexOf(tag) === -1) s.tags.push(tag);
                }
            });
            if (_allTags.indexOf(tag) === -1) _allTags.push(tag);
            _selectedIds = {};
            _batchMode = false;
            refreshSidebar();
            refreshMain();
            Components.Toast.success('已为 ' + ids.length + ' 个会话添加标签「' + tag + '」');
        } catch (err) {
            Components.Toast.error('批量添加标签失败: ' + err.message);
        }
    }

    async function batchExportSessions(format) {
        var ids = Object.keys(_selectedIds);
        if (ids.length === 0) return;
        try {
            var data = await API.sessions.batchExport(ids, format);
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'sessions_export_' + format + '.' + (format === 'markdown' ? 'md' : 'json');
            a.click();
            URL.revokeObjectURL(url);
            Components.Toast.success('导出成功');
        } catch (err) {
            Components.Toast.error('批量导出失败: ' + err.message);
        }
    }

    // ==========================================
    // 知识提取
    // ==========================================

    async function handleKnowledgeAction(action, id) {
        switch (action) {
            case 'summarize':
                Components.Toast.info('正在生成摘要...');
                try {
                    var data = await API.sessions.summarize(id);
                    var summary = data.summary || data.result || data;
                    // 更新本地会话的 summary 字段
                    var s = _sessions.find(function (s) { return (s.id || s.session_id) === id; });
                    if (s) s.summary = summary;
                    showSummaryModal(summary);
                    refreshMain();
                } catch (err) {
                    Components.Toast.error('生成摘要失败: ' + err.message);
                }
                break;
            case 'extract':
                Components.Toast.info('正在提取信息...');
                try {
                    var data = await API.sessions.extract(id);
                    showExtractedInfoModal(data);
                } catch (err) {
                    Components.Toast.error('提取信息失败: ' + err.message);
                }
                break;
            case 'toSkill':
                try {
                    var cs = currentSession();
                    var name = cs ? (cs.title || '未命名技能') : '未命名技能';
                    await API.sessions.toSkill(id, name, '从会话自动生成的技能');
                    Components.Toast.success('已转为技能');
                } catch (err) {
                    Components.Toast.error('转为技能失败: ' + err.message);
                }
                break;
            case 'toMemory':
                try {
                    await API.sessions.toMemory(id);
                    Components.Toast.success('已转为记忆');
                } catch (err) {
                    Components.Toast.error('转为记忆失败: ' + err.message);
                }
                break;
            case 'toLearning':
                try {
                    await API.sessions.toLearning(id);
                    Components.Toast.success('已转为学习记录');
                } catch (err) {
                    Components.Toast.error('转为学习记录失败: ' + err.message);
                }
                break;
        }
    }

    function showSummaryModal(summary) {
        var text = typeof summary === 'string' ? summary : JSON.stringify(summary, null, 2);
        var html = '<div style="max-height:60vh;overflow:auto;padding:16px;font-size:13px;line-height:1.7">' +
            Components.renderMarkdown(text) +
        '</div>';
        Components.Modal.confirm({
            title: '会话摘要',
            message: html,
            confirmText: '关闭',
            showCancel: false,
        });
    }

    function showExtractedInfoModal(data) {
        var sections = [];

        if (data.urls && data.urls.length > 0) {
            sections.push('<div style="margin-bottom:12px"><div style="font-weight:500;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:4px">' + Components.icon('link', 13) + ' 链接</div>' +
                '<div style="font-size:12px;color:var(--text-secondary)">' +
                data.urls.map(function (u) { return '<div style="padding:2px 0;word-break:break-all">' + Components.escapeHtml(u) + '</div>'; }).join('') +
                '</div></div>');
        }

        if (data.files && data.files.length > 0) {
            sections.push('<div style="margin-bottom:12px"><div style="font-weight:500;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:4px">' + Components.icon('file', 13) + ' 文件</div>' +
                '<div style="font-size:12px;color:var(--text-secondary)">' +
                data.files.map(function (f) { return '<div style="padding:2px 0">' + Components.escapeHtml(f) + '</div>'; }).join('') +
                '</div></div>');
        }

        if (data.code_blocks && data.code_blocks.length > 0) {
            sections.push('<div style="margin-bottom:12px"><div style="font-weight:500;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:4px">' + Components.icon('code', 13) + ' 代码块</div>' +
                '<div style="font-size:12px;color:var(--text-secondary)">' +
                data.code_blocks.map(function (c) { return '<pre style="padding:8px;background:var(--bg-secondary);border-radius:var(--radius-xs);margin:4px 0;overflow:auto;white-space:pre-wrap">' + Components.escapeHtml(c) + '</pre>'; }).join('') +
                '</div></div>');
        }

        if (data.todos && data.todos.length > 0) {
            sections.push('<div style="margin-bottom:12px"><div style="font-weight:500;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:4px">' + Components.icon('clipboard', 13) + ' 待办事项</div>' +
                '<div style="font-size:12px;color:var(--text-secondary)">' +
                data.todos.map(function (t) { return '<div style="padding:2px 0">' + Components.escapeHtml(t) + '</div>'; }).join('') +
                '</div></div>');
        }

        if (data.keywords && data.keywords.length > 0) {
            sections.push('<div style="margin-bottom:12px"><div style="font-weight:500;font-size:13px;margin-bottom:6px;display:flex;align-items:center;gap:4px">' + Components.icon('tag', 13) + ' 关键词</div>' +
                '<div style="display:flex;gap:4px;flex-wrap:wrap">' +
                data.keywords.map(function (k) { return '<span style="font-size:11px;padding:2px 8px;border-radius:8px;background:var(--accent);color:#fff">' + Components.escapeHtml(k) + '</span>'; }).join('') +
                '</div></div>');
        }

        if (sections.length === 0) {
            sections.push('<div style="font-size:12px;color:var(--text-tertiary);text-align:center;padding:20px">未提取到结构化信息</div>');
        }

        var html = '<div style="max-height:60vh;overflow:auto;padding:16px">' + sections.join('') + '</div>';
        Components.Modal.confirm({
            title: '提取的信息',
            message: html,
            confirmText: '关闭',
            showCancel: false,
        });
    }

    function toggleSummary() {
        var content = document.querySelector('.summary-content');
        var chevron = document.querySelector('.summary-chevron');
        if (!content) return;
        var isHidden = content.style.display === 'none';
        content.style.display = isHidden ? 'block' : 'none';
        if (chevron) {
            chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        }
    }

    // ==========================================
    // SSE 实时事件处理
    // ==========================================

    function onSSEEvent(type, data) {
        if (type === 'session.message' && data) {
            var sid = data.session_id;
            var msg = {
                role: data.role,
                content: data.content,
                timestamp: data.timestamp,
            };

            if (sid === _currentId) {
                _messages.push(msg);
                if (data.role === 'assistant') {
                    hideTypingIndicator();
                    appendMessage(msg);
                } else {
                    appendMessage(msg);
                    showTypingIndicator();
                }
                refreshStatusBar();
            } else {
                // 其他会话有新消息
                var exists = _sessions.some(function (s) { return (s.id || s.session_id) === sid; });
                if (exists) {
                    var s = _sessions.find(function (s) { return (s.id || s.session_id) === sid; });
                    if (s) {
                        s._newMessages = true;
                        s.message_count = (s.message_count || 0) + 1;
                    }
                    refreshSidebar();
                    // 3秒后清除脉冲动画
                    setTimeout(function () {
                        if (s) { s._newMessages = false; refreshSidebar(); }
                    }, 3000);
                } else {
                    API.sessions.list().then(function (list) {
                        _sessions = list;
                        refreshSidebar();
                    }).catch(function () {});
                }
            }
        }

        if (type === 'session.updated') {
            API.sessions.list().then(function (list) {
                _sessions = list;
                refreshSidebar();
                refreshMain();
            }).catch(function () {});
        }

        if (type === 'session.deleted') {
            var deletedId = data && (data.session_id || data.id);
            if (deletedId) {
                _sessions = _sessions.filter(function (s) { return (s.id || s.session_id) !== deletedId; });
                if (_currentId === deletedId) {
                    _currentId = null;
                    _messages = [];
                    _toolCards = {};
                    if (_sessions.length > 0) {
                        var nextId = _sessions[0].id || _sessions[0].session_id;
                        loadMessages(nextId).then(function () { refreshMain(); });
                    } else {
                        refreshMain();
                    }
                } else {
                    refreshSidebar();
                }
            }
        }

        if (type === 'mcp.tool_complete' && data) {
            var toolSid = data.session_id;
            if (toolSid === _currentId) {
                var key = data.tool_name + '_' + (data.timestamp || Date.now());
                appendToolCard(key, data);
            }
        }
    }

    return { render: render, select: select, onSSEEvent: onSSEEvent };
})();
