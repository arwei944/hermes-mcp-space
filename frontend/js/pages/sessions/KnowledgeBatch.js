/**
 * 会话页面 - 知识提取与批量操作模块
 * 知识提取（摘要/信息提取/转技能/转记忆/转学习）、批量操作（删除/归档/标签/导出）
 */

const KnowledgeBatch = (() => {
    // ---- 模块引用 ----
    var _modules = {};

    async function _ensureModules() {
        if (_modules.sessionList) return;
        _modules.sessionList = await import('./SessionList.js');
        _modules.chatView = await import('./ChatView.js');
    }

    // ==========================================
    // 知识提取
    // ==========================================

    async function handleKnowledgeAction(action, id) {
        await _ensureModules();
        switch (action) {
            case 'summarize':
                Components.Toast.info('正在生成摘要...');
                try {
                    var data = await API.sessions.summarize(id);
                    var summary = data.summary || data.result || data;
                    var s = _modules.sessionList.getSessions().find(function (s) { return (s.id || s.session_id) === id; });
                    if (s) s.summary = summary;
                    showSummaryModal(summary);
                    _modules.chatView.refreshMain();
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
                    var cs = _modules.chatView.currentSession();
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

    // ==========================================
    // 批量操作
    // ==========================================

    async function batchDeleteSessions() {
        await _ensureModules();
        var ids = Object.keys(_modules.sessionList.getSelectedIds());
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
            var sessions = _modules.sessionList.getSessions().filter(function (s) { return !_modules.sessionList.getSelectedIds()[s.id || s.session_id]; });
            _modules.sessionList.setSessions(sessions);
            if (_modules.sessionList.getSelectedIds()[_modules.chatView.getCurrentId()]) {
                _modules.chatView.setCurrentId(null);
                _modules.chatView.setMessages([]);
                _modules.chatView.setToolCards({});
                if (sessions.length > 0) {
                    var nextId = sessions[0].id || sessions[0].session_id;
                    var SessionDetail = (await import('./SessionDetail.js')).default;
                    await SessionDetail.selectSession(nextId);
                }
            }
            _modules.sessionList.setSelectedIds({});
            _modules.sessionList.setBatchMode(false);
            _modules.sessionList.refresh();
            _modules.chatView.refreshMain();
            Components.Toast.success('已删除 ' + ids.length + ' 个会话');
        } catch (err) {
            Components.Toast.error('批量删除失败: ' + err.message);
        }
    }

    async function batchArchiveSessions() {
        await _ensureModules();
        var ids = Object.keys(_modules.sessionList.getSelectedIds());
        if (ids.length === 0) return;

        showConfirmDialog(
            '批量归档会话',
            '确定要归档选中的 ' + ids.length + ' 个会话吗？',
            async function () {
                try {
                    await API.sessions.batchArchive(ids, true);
                    var sessions = _modules.sessionList.getSessions().filter(function (s) { return !_modules.sessionList.getSelectedIds()[s.id || s.session_id]; });
                    _modules.sessionList.setSessions(sessions);
                    if (_modules.sessionList.getSelectedIds()[_modules.chatView.getCurrentId()]) {
                        _modules.chatView.setCurrentId(null);
                        _modules.chatView.setMessages([]);
                        _modules.chatView.setToolCards({});
                        if (sessions.length > 0) {
                            var nextId = sessions[0].id || sessions[0].session_id;
                            var SessionDetail = (await import('./SessionDetail.js')).default;
                            await SessionDetail.selectSession(nextId);
                        }
                    }
                    _modules.sessionList.setSelectedIds({});
                    _modules.sessionList.setBatchMode(false);
                    _modules.sessionList.refresh();
                    _modules.chatView.refreshMain();
                    Components.Toast.success('已归档 ' + ids.length + ' 个会话');
                } catch (err) {
                    Components.Toast.error('批量归档失败: ' + err.message);
                }
            }
        );
    }

    async function batchAddTags() {
        await _ensureModules();
        var ids = Object.keys(_modules.sessionList.getSelectedIds());
        if (ids.length === 0) return;

        var tag = prompt('请输入要添加的标签:');
        if (!tag || !tag.trim()) return;
        tag = tag.trim();

        try {
            await API.sessions.batchTags(ids, [tag]);
            ids.forEach(function (id) {
                var s = _modules.sessionList.getSessions().find(function (s) { return (s.id || s.session_id) === id; });
                if (s) {
                    if (!s.tags) s.tags = [];
                    if (s.tags.indexOf(tag) === -1) s.tags.push(tag);
                }
            });
            var allTags = _modules.sessionList.getAllTags();
            if (allTags.indexOf(tag) === -1) allTags.push(tag);
            _modules.sessionList.setAllTags(allTags);
            _modules.sessionList.setSelectedIds({});
            _modules.sessionList.setBatchMode(false);
            _modules.sessionList.refresh();
            _modules.chatView.refreshMain();
            Components.Toast.success('已为 ' + ids.length + ' 个会话添加标签「' + tag + '」');
        } catch (err) {
            Components.Toast.error('批量添加标签失败: ' + err.message);
        }
    }

    async function batchExportSessions(format) {
        await _ensureModules();
        var ids = Object.keys(_modules.sessionList.getSelectedIds());
        if (ids.length === 0) return;
        var progress = showExportProgress('正在批量导出 ' + ids.length + ' 个会话...');
        try {
            var data = await API.sessions.batchExport(ids, format);
            var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            var url = URL.createObjectURL(blob);
            var a = document.createElement('a');
            a.href = url;
            a.download = 'sessions_export_' + format + '.' + (format === 'markdown' ? 'md' : 'json');
            a.click();
            URL.revokeObjectURL(url);
            progress.complete();
            Components.Toast.success('导出成功');
        } catch (err) {
            progress.error();
            Components.Toast.error('批量导出失败: ' + err.message);
        }
    }

    // ==========================================
    // 公开 API
    // ==========================================

    function destroy() {
        _modules = {};
    }

    return {
        destroy,
        handleKnowledgeAction, showSummaryModal, showExtractedInfoModal,
        batchDeleteSessions, batchArchiveSessions, batchAddTags, batchExportSessions
    };
})();

export default KnowledgeBatch;
