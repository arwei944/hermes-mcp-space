/**
 * 会话页面 - 会话列表模块
 * 会话列表渲染、搜索、状态筛选、标签过滤、批量选择
 */

const SessionList = (() => {
    var _sessions = [], _currentId = null, _searchTerm = '', _statusFilter = '';
    var _activeTag = null, _allTags = [], _searchResults = null, _isSearching = false;
    var _batchMode = false, _selectedIds = {}, _onSelect = null;

    function tagColor(name) {
        var hash = 0;
        for (var i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        var colors = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488'];
        return colors[Math.abs(hash) % colors.length];
    }

    function getFilteredSessions() {
        var result = _searchResults || _sessions;
        if (_statusFilter) result = result.filter(function (s) { return (s.status || '') === _statusFilter; });
        if (_activeTag) result = result.filter(function (s) { return (s.tags || []).indexOf(_activeTag) !== -1; });
        return result;
    }

    function buildSessionItem(s) {
        var id = s.id || s.session_id, isActive = id === _currentId;
        var msgCount = s.message_count || s.messages || 0, tags = s.tags || [];
        var pinned = s.pinned, hasNew = s._newMessages, isSelected = !!_selectedIds[id];
        var checkboxHtml = '';
        if (_batchMode) {
            var ci = isSelected ? 'check' : 'minus', cb = isSelected ? 'var(--accent)' : 'transparent';
            var cbr = isSelected ? 'none' : '2px solid var(--text-tertiary)', cc = isSelected ? '#fff' : 'transparent';
            checkboxHtml = '<div data-action="toggleSelect" data-id="' + id + '" style="flex-shrink:0;width:18px;height:18px;border-radius:4px;background:' + cb + ';border:' + cbr + ';display:flex;align-items:center;justify-content:center;cursor:pointer;margin-right:8px;transition:all .15s"><span style="font-size:12px;color:' + cc + '">' + Components.icon(ci, 12) + '</span></div>';
        }
        var tagsHtml = '';
        if (tags.length > 0) {
            tagsHtml = '<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px">' +
                tags.map(function (t) { return '<span style="font-size:10px;padding:1px 6px;border-radius:8px;background:' + tagColor(t) + '22;color:' + tagColor(t) + ';white-space:nowrap">' + Components.escapeHtml(t) + '</span>'; }).join('') + '</div>';
        }
        return '<div class="session-item ' + (isActive ? 'active' : '') + (hasNew ? ' pulse' : '') + '" data-action="select" data-id="' + id + '" style="display:flex;align-items:flex-start">' +
            checkboxHtml + '<div style="flex:1;min-width:0">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
                '<span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + Components.escapeHtml(s.title || s.source || id) + '</span>' +
                '<div style="display:flex;gap:2px;align-items:center;flex-shrink:0">' +
                    (pinned ? '<span style="color:var(--orange)">' + Components.icon('star', 12) + '</span>' : '') +
                    (s.model ? Components.renderBadge(s.model, 'blue') : '') +
                    (!_batchMode ? '<button type="button" class="btn btn-sm btn-ghost" style="padding:2px 4px;font-size:11px;color:var(--text-tertiary)" data-action="sessionMenu" data-id="' + id + '" title="更多操作">' + Components.icon('chevronDown', 12) + '</button>' : '') +
                '</div></div>' +
            '<div style="font-size:11px;color:var(--text-tertiary);margin-top:3px;display:flex;gap:8px"><span>' + msgCount + ' 条消息</span></div>' +
            tagsHtml + '</div></div>';
    }

    function buildSessionList(filtered) {
        if (_isSearching && filtered.length === 0) {
            return '<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary)"><div style="font-size:32px;margin-bottom:12px">' + Components.icon('search', 32) + '</div><div style="font-size:14px;margin-bottom:4px">未找到匹配的会话</div><div style="font-size:12px">尝试更换关键词搜索</div></div>';
        }
        if (_sessions.length === 0) {
            return '<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary)"><div style="font-size:32px;margin-bottom:12px">' + Components.icon('radio', 32) + '</div><div style="font-size:14px;margin-bottom:4px">等待智能体创建会话</div><div style="font-size:12px">会话将通过 MCP 自动创建并实时同步</div></div>';
        }
        return filtered.map(buildSessionItem).join('');
    }

    function buildTagFilter() {
        var chips = '';
        if (_allTags.length > 0) {
            chips = _allTags.map(function (t) {
                var isA = _activeTag === t, bg = isA ? tagColor(t) : 'transparent', color = isA ? '#fff' : tagColor(t);
                var border = isA ? 'none' : '1px solid ' + tagColor(t) + '44';
                return '<span class="tag-chip" data-action="filterTag" data-tag="' + Components.escapeHtml(t) + '" style="font-size:11px;padding:2px 8px;border-radius:10px;cursor:pointer;background:' + bg + ';color:' + color + ';border:' + border + ';display:inline-flex;align-items:center;gap:3px;transition:all .15s">' +
                    Components.escapeHtml(t) + (isA ? ' <span data-action="clearTagFilter" style="margin-left:2px">' + Components.icon('x', 10) + '</span>' : '') + '</span>';
            }).join('');
        }
        return '<div style="padding:4px 12px;display:flex;gap:4px;flex-wrap:wrap;align-items:center"><span style="font-size:11px;color:var(--text-tertiary);margin-right:2px">' + Components.icon('tag', 11) + '</span>' + chips +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="addTag" style="font-size:10px;padding:1px 6px;color:var(--text-tertiary)">+ 标签</button></div>';
    }

    function buildFilterOptions() {
        var ac = _sessions.filter(function (s) { return s.status === 'active'; }).length;
        return '<option value="">全部 (' + _sessions.length + ')</option><option value="active" ' + (_statusFilter === 'active' ? 'selected' : '') + '>活跃 (' + ac + ')</option><option value="completed" ' + (_statusFilter === 'completed' ? 'selected' : '') + '>完成 (' + (_sessions.length - ac) + ')</option>';
    }

    // ---- 批量选择 ----
    function getSelectedCount() { return Object.keys(_selectedIds).length; }
    function toggleBatchMode() { _batchMode = !_batchMode; _selectedIds = {}; refresh(); }
    function toggleSelect(id) { if (_selectedIds[id]) delete _selectedIds[id]; else _selectedIds[id] = true; refresh(); }
    function selectAll() {
        var f = getFilteredSessions(), all = f.every(function (s) { return _selectedIds[s.id || s.session_id]; });
        if (all) _selectedIds = {}; else f.forEach(function (s) { _selectedIds[s.id || s.session_id] = true; });
        refresh();
    }

    function buildBatchActionBar() {
        var c = getSelectedCount(), d = c === 0 ? 'disabled' : '';
        return '<div class="batch-action-bar"><span style="font-size:12px;color:var(--text-secondary);flex-shrink:0">已选择 ' + c + ' 个会话</span><div style="flex:1"></div>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="batchArchive" style="color:var(--text-secondary)" ' + d + '>' + Components.icon('archive', 13) + ' 归档</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="batchAddTags" style="color:var(--text-secondary)" ' + d + '>' + Components.icon('tag', 13) + ' 添加标签</button>' +
            '<div style="position:relative" class="batch-export-wrap"><button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchExport" style="color:var(--text-secondary)" ' + d + '>' + Components.icon('download', 13) + ' 导出</button>' +
            '<div class="batch-export-dropdown" style="display:none;position:absolute;bottom:100%;right:0;margin-bottom:4px;background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow);padding:4px;min-width:120px">' +
            '<div data-action="batchExport" data-format="markdown" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('file', 13) + ' Markdown</div>' +
            '<div data-action="batchExport" data-format="json" style="padding:6px 10px;font-size:12px;cursor:pointer;border-radius:var(--radius-xs);display:flex;align-items:center;gap:6px">' + Components.icon('code', 13) + ' JSON</div></div></div>' +
            '<button type="button" class="btn btn-sm" data-action="batchDelete" style="color:var(--red);background:var(--red);color:#fff" ' + d + '>' + Components.icon('trash', 13) + ' 删除</button>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchMode" style="color:var(--text-tertiary)">取消</button></div>';
    }

    // ---- 搜索 ----
    var debouncedSearch = Components.debounce(async function (term) {
        _searchTerm = term;
        if (!term || !term.trim()) { _searchResults = null; _isSearching = false; refresh(); return; }
        _isSearching = true;
        try { var data = await API.sessions.search({ q: term }); _searchResults = data.sessions || data || []; } catch (_e) { _searchResults = []; }
        refresh();
    }, 300);

    // ---- 渲染 ----
    function render(containerSelector, sessions, allTags, currentId, onSelect) {
        var container = document.querySelector(containerSelector);
        if (!container) return;
        _sessions = sessions; _allTags = allTags; _currentId = currentId; _onSelect = onSelect || null;
        container.innerHTML = buildSidebar();
        bindEvents(containerSelector);
    }

    function buildSidebar() {
        var filtered = getFilteredSessions();
        return '<div class="chat-sidebar-header"><h3>对话记录</h3><div style="display:flex;gap:4px;align-items:center">' +
            (_batchMode
                ? '<button type="button" class="btn btn-sm btn-ghost" data-action="selectAll" style="font-size:11px;padding:2px 6px;color:var(--text-secondary)">全选</button><button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchMode" style="font-size:11px;padding:2px 6px;color:var(--red)">退出批量</button>'
                : '<button type="button" class="btn btn-sm btn-ghost" data-action="toggleBatchMode" style="font-size:11px;padding:2px 6px;color:var(--text-tertiary)" title="批量操作">' + Components.icon('checkSquare', 14) + '</button>') +
            '<span style="font-size:11px;color:var(--text-tertiary)">实时同步</span></div></div>' +
            '<div class="chat-sidebar-search" style="position:relative"><span style="position:absolute;left:8px;top:50%;transform:translateY(-50%);color:var(--text-tertiary)">' + Components.icon('search', 14) + '</span>' +
            '<input type="text" id="sessionSearch" placeholder="搜索会话标题和内容..." value="' + Components.escapeHtml(_searchTerm) + '" style="padding-left:30px"></div>' +
            '<div style="padding:4px 12px;display:flex;gap:4px"><select id="statusFilter" style="flex:1;padding:5px 8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:11px;outline:none;color:var(--text-secondary)">' + buildFilterOptions() + '</select></div>' +
            buildTagFilter() +
            '<div class="chat-sidebar-list">' + buildSessionList(filtered) + '</div>' +
            (_batchMode ? buildBatchActionBar() : '');
    }

    function refresh() {
        var c = document.querySelector('#sessions-sidebar');
        if (!c) return;
        c.innerHTML = buildSidebar();
        bindEvents('#sessions-sidebar');
    }

    // ---- 事件绑定 ----
    function bindEvents(containerSelector) {
        var container = document.querySelector(containerSelector);
        if (!container) return;
        container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.dataset.action, id = btn.dataset.id;
            switch (action) {
                case 'select': if (_onSelect) _onSelect(id); break;
                case 'filterTag': _activeTag = _activeTag === btn.dataset.tag ? null : btn.dataset.tag; refresh(); break;
                case 'clearTagFilter': _activeTag = null; refresh(); break;
                case 'addTag': if (_onSelect) _onSelect('__addTag__'); break;
                case 'sessionMenu': e.stopPropagation(); if (_onSelect) _onSelect('__sessionMenu__' + id); break;
                case 'toggleBatchMode': toggleBatchMode(); break;
                case 'toggleSelect': e.stopPropagation(); toggleSelect(id); break;
                case 'selectAll': selectAll(); break;
                case 'batchDelete': if (_onSelect) _onSelect('__batchDelete__'); break;
                case 'batchArchive': if (_onSelect) _onSelect('__batchArchive__'); break;
                case 'batchAddTags': if (_onSelect) _onSelect('__batchAddTags__'); break;
                case 'toggleBatchExport':
                    e.stopPropagation();
                    var bdd = btn.parentElement.querySelector('.batch-export-dropdown');
                    if (bdd) bdd.style.display = bdd.style.display === 'none' ? 'block' : 'none';
                    break;
                case 'batchExport':
                    if (_onSelect) _onSelect('__batchExport__' + btn.dataset.format);
                    var bd = btn.closest('.batch-export-dropdown');
                    if (bd) bd.style.display = 'none';
                    break;
            }
        });
        var si = container.querySelector('#sessionSearch');
        if (si) si.addEventListener('input', function (e) { debouncedSearch(e.target.value); });
        var ss = container.querySelector('#statusFilter');
        if (ss) ss.addEventListener('change', function (e) { _statusFilter = e.target.value; refresh(); });
    }

    function destroy() {
        _sessions = []; _currentId = null; _searchTerm = ''; _statusFilter = '';
        _activeTag = null; _allTags = []; _searchResults = null; _isSearching = false;
        _batchMode = false; _selectedIds = {}; _onSelect = null;
    }

    return {
        render, refresh, destroy, tagColor, getFilteredSessions,
        getSessions: function () { return _sessions; }, setSessions: function (v) { _sessions = v; },
        getCurrentId: function () { return _currentId; },
        getSelectedIds: function () { return _selectedIds; }, setSelectedIds: function (v) { _selectedIds = v; },
        getBatchMode: function () { return _batchMode; }, setBatchMode: function (v) { _batchMode = v; },
        getAllTags: function () { return _allTags; }, setAllTags: function (v) { _allTags = v; }
    };
})();

export default SessionList;
