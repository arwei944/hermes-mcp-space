/**
 * 会话对话页面 - 侧边栏模块
 * 会话列表：加载、搜索、选择、删除、创建
 */

const ChatSidebar = (() => {
    let _sessions = [];
    let _currentSession = null;
    let _searchKeyword = '';
    let _callbacks = {};
    let _bound = false;

    async function render(containerSelector, callbacks) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        _callbacks = callbacks || {};
        container.innerHTML = Components.createLoading();

        try {
            _sessions = await API.sessions.list();
        } catch (_err) {
            _sessions = [];
        }

        // 自动选中第一个会话
        if (!_currentSession && _sessions.length > 0) {
            _currentSession = _sessions[0].id || _sessions[0].session_id;
        }

        container.innerHTML = buildSidebarHtml();
        bindEvents(containerSelector);
    }

    function buildSidebarHtml() {
        const sessionListHtml = buildSessionList();

        return `
            <div class="chat-sidebar-header">
                <h3>会话列表</h3>
                <button type="button" class="btn btn-sm btn-primary" data-action="createSession">+ 新建</button>
            </div>
            <div class="chat-sidebar-search">
                <input type="text" class="form-input" placeholder="搜索消息..." value="${Components.escapeHtml(_searchKeyword)}" data-action="searchInput">
            </div>
            <div class="chat-sidebar-list" id="chatSessionList">${sessionListHtml}</div>
        `;
    }

    function buildSessionList() {
        if (_sessions.length === 0) {
            return '<div style="padding:20px;text-align:center;color:var(--text-tertiary)">暂无会话</div>';
        }

        const statusMap = { active: '活跃', completed: '完成' };
        const statusColor = { active: 'green', completed: 'blue' };

        return _sessions.map(s => {
            const id = s.id || s.session_id;
            const isActive = id === _currentSession;
            return `<div class="session-item ${isActive ? 'active' : ''}" data-session-id="${id}" data-action="selectSession">
                <div style="display:flex;justify-content:space-between;align-items:center">
                    <span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.title || s.source || id)}</span>
                    <div style="display:flex;gap:4px;align-items:center">
                        ${Components.renderBadge(statusMap[s.status] || s.status || '-', statusColor[s.status] || 'blue')}
                        <button type="button" class="btn btn-sm btn-ghost" style="padding:2px 4px;font-size:11px;color:var(--red);opacity:0.5" data-action="deleteSession" data-id="${id}" title="删除">${Components.icon('x', 14)}</button>
                    </div>
                </div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">
                    ${Components.escapeHtml(s.model || '-')} · ${Components.formatDateTime(s.created_at || s.createdAt)}
                </div>
            </div>`;
        }).join('');
    }

    function selectSession(id) {
        if (id === _currentSession) return;
        _currentSession = id;
        updateSessionListActive();
        if (_callbacks.onSessionSelect) {
            _callbacks.onSessionSelect(id);
        }
    }

    function updateSessionListActive() {
        const items = document.querySelectorAll('.session-item');
        items.forEach(item => {
            const sid = item.dataset.sessionId;
            item.classList.toggle('active', sid === _currentSession);
        });
    }

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
            Components.Toast.success('会话已删除');
            _currentSession = null;
            _sessions = _sessions.filter(s => (s.id || s.session_id) !== id);
            if (_callbacks.onSessionDeleted) {
                _callbacks.onSessionDeleted();
            }
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function createSession() {
        try {
            const result = await API.sessions.create({
                title: `会话 ${new Date().toLocaleString('zh-CN')}`,
                source: 'web',
            });
            Components.Toast.success('会话已创建');
            const newId = result.session?.id;
            if (newId) {
                _currentSession = newId;
                if (_callbacks.onSessionCreated) {
                    _callbacks.onSessionCreated(newId);
                }
            }
        } catch (err) {
            Components.Toast.error(`创建失败: ${err.message}`);
        }
    }

    function search(keyword) {
        _searchKeyword = keyword;
    }

    function bindEvents(containerSelector) {
        const container = document.querySelector(containerSelector);
        if (!container) return;

        if (!_bound) {
            container.addEventListener('click', e => {
                const target = e.target.closest('[data-action]');
                if (!target) return;
                const action = target.dataset.action;
                const id = target.dataset.id;

                switch (action) {
                    case 'selectSession':
                        e.stopPropagation();
                        selectSession(target.dataset.sessionId);
                        break;
                    case 'deleteSession':
                        e.stopPropagation();
                        deleteSession(id);
                        break;
                    case 'createSession':
                        createSession();
                        break;
                }
            });

            container.addEventListener('input', e => {
                const target = e.target.closest('[data-action="searchInput"]');
                if (target) {
                    search(target.value);
                }
            });

            _bound = true;
        }
    }

    function destroy() {
        _sessions = [];
        _currentSession = null;
        _searchKeyword = '';
        _callbacks = {};
        _bound = false;
    }

    return { render, selectSession, deleteSession, search, destroy };
})();

export default ChatSidebar;
