/**
 * 会话页面 - 会话操作与事件协调模块
 * 删除/置顶/归档/重命名/导出/标签管理/SSE事件/全局事件绑定
 */

const SessionDetail = (() => {
    var _viewMode = 'chat';
    var _modules = {};

    async function _ensureModules() {
        if (_modules.sessionList) return;
        _modules.sessionList = await import('./SessionList.js');
        _modules.chatView = await import('./ChatView.js');
        _modules.knowledgeBatch = await import('./KnowledgeBatch.js');
    }

    function getViewMode() { return _viewMode; }

    async function toggleViewMode(mode) {
        if (_viewMode === mode) return;
        _viewMode = mode;
        if (window.SessionsPage && window.SessionsPage.render) window.SessionsPage.render();
    }

    async function selectSession(id) {
        await _ensureModules();
        try {
            var data = await API.sessions.messages(id);
            _modules.chatView.setCurrentId(id);
            _modules.chatView.setMessages(data.messages || data || []);
            _modules.chatView.setToolCards({});
        } catch (_e) {
            _modules.chatView.setCurrentId(id);
            _modules.chatView.setMessages([]);
            _modules.chatView.setToolCards({});
        }
        document.querySelectorAll('.session-item').forEach(function (el) { el.classList.toggle('active', el.dataset.id === id); });
        _modules.chatView.refreshMain();
    }

    async function deleteSession(id) {
        await _ensureModules();
        var ok = await Components.Modal.confirm({ title: '删除会话', message: '确定要删除此会话吗？会话中的所有消息将被删除，此操作不可撤销。', confirmText: '删除', type: 'danger' });
        if (!ok) return;
        try {
            await API.sessions.delete(id);
            var sessions = _modules.sessionList.getSessions().filter(function (s) { return (s.id || s.session_id) !== id; });
            _modules.sessionList.setSessions(sessions);
            if (_modules.chatView.getCurrentId() === id) {
                _modules.chatView.setCurrentId(null); _modules.chatView.setMessages([]); _modules.chatView.setToolCards({});
                if (sessions.length > 0) { await selectSession(sessions[0].id || sessions[0].session_id); return; }
            }
            _modules.sessionList.refresh(); _modules.chatView.refreshMain(); Components.Toast.success('会话已删除');
        } catch (err) { Components.Toast.error('删除失败: ' + err.message); }
    }

    async function pinSession(id, pinned) {
        await _ensureModules();
        try {
            await API.sessions.pin(id, pinned);
            var s = _modules.sessionList.getSessions().find(function (s) { return (s.id || s.session_id) === id; });
            if (s) s.pinned = pinned;
            _modules.sessionList.refresh(); _modules.chatView.refreshMain(); Components.Toast.success(pinned ? '已置顶' : '已取消置顶');
        } catch (err) { Components.Toast.error('操作失败: ' + err.message); }
    }

    async function archiveSession(id) {
        await _ensureModules();
        try {
            await API.sessions.archive(id, true);
            var sessions = _modules.sessionList.getSessions().filter(function (s) { return (s.id || s.session_id) !== id; });
            _modules.sessionList.setSessions(sessions);
            if (_modules.chatView.getCurrentId() === id) {
                _modules.chatView.setCurrentId(null); _modules.chatView.setMessages([]); _modules.chatView.setToolCards({});
                if (sessions.length > 0) { await selectSession(sessions[0].id || sessions[0].session_id); return; }
            }
            _modules.sessionList.refresh(); _modules.chatView.refreshMain(); Components.Toast.success('会话已归档');
        } catch (err) { Components.Toast.error('归档失败: ' + err.message); }
    }

    async function renameSession(id, title) {
        if (!title || !title.trim()) return;
        await _ensureModules();
        try {
            await API.sessions.rename(id, title.trim());
            var s = _modules.sessionList.getSessions().find(function (s) { return (s.id || s.session_id) === id; });
            if (s) s.title = title.trim();
            _modules.sessionList.refresh(); _modules.chatView.refreshMain(); Components.Toast.success('已重命名');
        } catch (err) { Components.Toast.error('重命名失败: ' + err.message); }
    }

    async function exportSession(id, format) {
        var progress = showExportProgress('正在导出会话...');
        try {
            var blob = await API.sessions.exportSession(id, format);
            var url = URL.createObjectURL(blob), a = document.createElement('a');
            var ext = { markdown: 'md', json: 'json', csv: 'csv' }[format] || 'txt';
            a.href = url; a.download = 'session_' + id + '.' + ext; a.click(); URL.revokeObjectURL(url);
            progress.complete(); Components.Toast.success('导出成功');
        } catch (err) { progress.error(); Components.Toast.error('导出失败: ' + err.message); }
    }

    async function addTagToSession(id, tag) {
        if (!tag || !tag.trim()) return;
        await _ensureModules(); tag = tag.trim();
        var s = _modules.sessionList.getSessions().find(function (s) { return (s.id || s.session_id) === id; });
        if (!s) return;
        var tags = s.tags || [];
        if (tags.indexOf(tag) === -1) {
            tags.push(tag);
            try {
                await API.sessions.setTags(id, tags); s.tags = tags;
                var allTags = _modules.sessionList.getAllTags();
                if (allTags.indexOf(tag) === -1) allTags.push(tag);
                _modules.sessionList.setAllTags(allTags);
                _modules.sessionList.refresh(); _modules.chatView.refreshMain(); Components.Toast.success('标签已添加');
            } catch (err) { Components.Toast.error('添加标签失败: ' + err.message); }
        }
    }

    function showAddTagInput() {
        var filterBar = document.querySelector('.chat-sidebar-list');
        if (!filterBar) return;
        var existing = document.querySelector('.add-tag-inline');
        if (existing) { existing.remove(); return; }
        var wrap = document.createElement('div');
        wrap.className = 'add-tag-inline';
        wrap.style.cssText = 'padding:4px 12px;display:flex;gap:4px;align-items:center';
        wrap.innerHTML = '<input type="text" class="form-input" placeholder="输入标签名..." style="flex:1;font-size:11px;padding:4px 8px"><button type="button" class="btn btn-sm" style="font-size:11px;padding:3px 8px">添加</button>';
        filterBar.parentElement.insertBefore(wrap, filterBar);
        var input = wrap.querySelector('input'), btn = wrap.querySelector('button');
        input.focus();
        function doAdd() { var t = input.value.trim(); if (t && _modules.chatView.getCurrentId()) addTagToSession(_modules.chatView.getCurrentId(), t); wrap.remove(); }
        btn.addEventListener('click', doAdd);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') doAdd(); if (e.key === 'Escape') wrap.remove(); });
    }

    function startEditTitle(id) {
        var el = document.querySelector('.session-title');
        if (!el) return;
        _ensureModules();
        var s = _modules.sessionList.getSessions().find(function (s) { return (s.id || s.session_id) === id; });
        var oldTitle = s ? (s.title || '') : '';
        var input = document.createElement('input');
        input.type = 'text'; input.value = oldTitle; input.className = 'form-input';
        input.style.cssText = 'font-size:14px;font-weight:500;padding:2px 6px;width:300px';
        el.replaceWith(input); input.focus(); input.select();
        function finish() { var n = input.value; input.replaceWith(el); if (n !== oldTitle) renameSession(id, n); }
        input.addEventListener('blur', finish);
        input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); if (e.key === 'Escape') { input.value = oldTitle; input.blur(); } });
    }

    function showContextMenu(anchor, id) {
        var existing = document.querySelector('.context-menu');
        if (existing) existing.remove();
        _ensureModules();
        var s = _modules.sessionList.getSessions().find(function (s) { return (s.id || s.session_id) === id; });
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
            return '<div data-action="' + item.action + '" data-id="' + id + '" style="padding:6px 10px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px;' + (item.danger ? 'color:var(--red)' : '') + '">' + Components.icon(item.icon, 13) + ' ' + item.label + '</div>';
        }).join('');
        document.body.appendChild(menu);
        var rect = anchor.getBoundingClientRect();
        menu.style.top = rect.bottom + 4 + 'px'; menu.style.left = Math.min(rect.left, window.innerWidth - 160) + 'px';
        menu.addEventListener('click', function (e) {
            var item = e.target.closest('[data-action]');
            if (!item) return;
            menu.remove();
            switch (item.dataset.action) {
                case 'renameCtx': startEditTitle(id); break;
                case 'pinCtx': pinSession(id, !pinned); break;
                case 'archiveCtx': archiveSession(id); break;
                case 'addTagCtx': _modules.chatView.setCurrentId(id); showAddTagInput(); break;
                case 'exportCtx': exportSession(id, 'markdown'); break;
                case 'deleteCtx': deleteSession(id); break;
            }
        });
    }

    // SSE 事件委托给 SSEHandler 模块
    async function onSSEEvent(type, data) {
        await _ensureModules();
        _modules.sseHandler = await import('./SSEHandler.js');
        _modules.sseHandler.default.onSSEEvent(type, data);
    }

    function bindGlobalEvents() {
        var container = document.getElementById('contentBody');
        if (!container) return;
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.dataset.action, id = btn.dataset.id;
            switch (action) {
                case 'toggleViewMode': toggleViewMode(btn.dataset.mode); break;
                case 'deleteSession': e.stopPropagation(); deleteSession(id); break;
                case 'pinSession': e.stopPropagation(); pinSession(id, btn.dataset.pinned === 'true'); break;
                case 'archiveSession': e.stopPropagation(); archiveSession(id); break;
                case 'editTitle': startEditTitle(id); break;
                case 'toggleExport': e.stopPropagation(); var dd = btn.parentElement.querySelector('.export-dropdown'); if (dd) dd.style.display = dd.style.display === 'none' ? 'block' : 'none'; break;
                case 'export': exportSession(_modules.chatView ? _modules.chatView.getCurrentId() : null, btn.dataset.format); var dr = btn.closest('.export-dropdown'); if (dr) dr.style.display = 'none'; break;
                case 'toggleKnowledge': e.stopPropagation(); var kd = btn.parentElement.querySelector('.knowledge-dropdown'); if (kd) kd.style.display = kd.style.display === 'none' ? 'block' : 'none'; break;
                case 'knowledgeAction': _modules.knowledgeBatch.handleKnowledgeAction(btn.dataset.kaction, _modules.chatView ? _modules.chatView.getCurrentId() : null); var kk = btn.closest('.knowledge-dropdown'); if (kk) kk.style.display = 'none'; break;
                case 'batchDelete': _modules.knowledgeBatch.batchDeleteSessions(); break;
                case 'batchArchive': _modules.knowledgeBatch.batchArchiveSessions(); break;
                case 'batchAddTags': _modules.knowledgeBatch.batchAddTags(); break;
                case 'batchExport': _modules.knowledgeBatch.batchExportSessions(btn.dataset.format); var bd = btn.closest('.batch-export-dropdown'); if (bd) bd.style.display = 'none'; break;
            }
        });
        container.addEventListener('dblclick', function (e) { var t = e.target.closest('.session-title'); if (t) startEditTitle(t.dataset.id); });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.export-dropdown-wrap')) { var d = document.querySelector('.export-dropdown'); if (d) d.style.display = 'none'; }
            if (!e.target.closest('.knowledge-dropdown-wrap')) { var k = document.querySelector('.knowledge-dropdown'); if (k) k.style.display = 'none'; }
            if (!e.target.closest('.batch-export-wrap')) { var b = document.querySelector('.batch-export-dropdown'); if (b) b.style.display = 'none'; }
            if (!e.target.closest('.context-menu')) { var c = document.querySelector('.context-menu'); if (c) c.remove(); }
        });
    }

    function destroy() { _viewMode = 'chat'; _modules = {}; }

    return {
        destroy, getViewMode, toggleViewMode,
        selectSession, deleteSession, pinSession, archiveSession,
        renameSession, exportSession, addTagToSession, showAddTagInput,
        startEditTitle, showContextMenu,
        onSSEEvent, bindGlobalEvents
    };
})();

export default SessionDetail;
