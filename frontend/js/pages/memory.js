/**
 * 记忆管理页面 (Mac 极简风格)
 * 4 Tab: 长期记忆 / 用户画像 / 学习记录 / 会话摘要
 */

const MemoryPage = (() => {
    let _memoryContent = '';
    let _userContent = '';
    let _learnings = [];
    let _summaries = [];
    let _activeTab = 'memory';
    let _stats = null;
    let _globalKeyHandler = null;
    let _savedContent = ''; // 跟踪已保存内容，用于未保存提示
    let _searchTerm = '';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [memoryData, userData, statsData] = await Promise.all([
                API.memory.getMemory(),
                API.memory.getUser(),
                API.memory.stats(),
            ]);
            // API 返回 {memory: "...", user: "..."} 或字符串
            _memoryContent = typeof memoryData === 'string' ? memoryData : memoryData.memory || '';
            _userContent = typeof userData === 'string' ? userData : userData.user || '';
            _stats = statsData;
        } catch (_err) {
            _memoryContent = '';
            _userContent = '';
            _stats = null;
        }

        // 加载学习记录
        try {
            const learningsResp = await API.get('/api/knowledge/experiences');
            _learnings = learningsResp.experiences || [];
        } catch (_err) {
            _learnings = [];
        }

        // 加载会话摘要
        try {
            const sessionsResp = await API.get('/api/sessions');
            _summaries = (sessionsResp.sessions || []).slice(0, 20).map((s) => ({
                id: s.id || s.session_id,
                title: s.title,
                messages: s.message_count || 0,
                created: s.created_at,
            }));
        } catch (_err) {
            _summaries = [];
        }

        _savedContent = _activeTab === 'memory' ? _memoryContent : _userContent;
        container.innerHTML = buildPage();
        bindEvents();
    }

    // ==========================================
    // Tab 内容构建
    // ==========================================

    /** 编辑器 Tab（长期记忆 / 用户画像） */
    function buildEditorTab(content) {
        const safeContent = typeof content === 'string' ? content : '';
        const wordCount = safeContent.length;
        const lineCount = safeContent.split('\n').length;

        const statsHtml = _stats
            ? `<div class="editor-stats"><span>字数: ${_stats.wordCount || wordCount}</span><span>行数: ${_stats.lineCount || lineCount}</span><span>条目: ${_stats.entries || '-'}</span></div>`
            : `<div class="editor-stats"><span>字数: ${wordCount}</span><span>行数: ${lineCount}</span></div>`;

        return `<div class="editor-container">
            <div class="editor-pane">
                <div class="editor-pane-header">
                    <h3>编辑器</h3>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-sm btn-ghost" data-action="formatContent">格式化</button>
                        <button class="btn btn-sm btn-ghost" data-action="fillTemplate">填充模板</button>
                        <button class="btn btn-sm btn-ghost" data-action="exportContent">导出</button>
                        <button class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="resetContent">重置</button>
                        <button class="btn btn-sm btn-primary" data-action="saveContent">保存</button>
                    </div>
                </div>
                <textarea class="editor-textarea" id="memoryEditor">${Components.escapeHtml(safeContent)}</textarea>
                ${statsHtml}
            </div>
            <div class="editor-pane">
                <div class="editor-pane-header">
                    <h3>预览</h3>
                    <span style="font-size:11px;color:var(--text-tertiary)">Markdown 渲染</span>
                </div>
                <div class="editor-preview markdown-body" id="memoryPreview">${Components.renderMarkdown(safeContent)}</div>
            </div>
        </div>`;
    }

    /** 学习记录 Tab（只读） */
    function buildLearningsTab() {
        if (_learnings.length === 0) {
            return `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('lightbulb', 32)}</div>
                <div style="font-size:14px;margin-bottom:4px">暂无学习记录</div>
                <div style="font-size:12px">Agent 在对话中积累的经验将自动记录在这里</div>
            </div>`;
        }

        const filtered = _searchTerm
            ? _learnings.filter(
                  (l) =>
                      (l.content || '').toLowerCase().includes(_searchTerm.toLowerCase()) ||
                      (l.title || '').toLowerCase().includes(_searchTerm.toLowerCase()),
              )
            : _learnings;

        if (filtered.length === 0) {
            return `<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary)">
                <div>未找到匹配的学习记录</div>
            </div>`;
        }

        return `<div style="display:flex;flex-direction:column;gap:12px;padding:16px">
            ${filtered
                .map(
                    (l, i) => `<div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-weight:500;font-size:13px">${Components.escapeHtml(l.title || `学习记录 #${i + 1}`)}</span>
                        <span style="font-size:11px;color:var(--text-tertiary)">${l.created_at ? Components.formatDateTime(l.created_at) : ''}</span>
                    </div>
                    <div class="markdown-body" style="font-size:13px">${Components.renderMarkdown(l.content || '（无内容）')}</div>
                </div>`,
                )
                .join('')}
        </div>`;
    }

    /** 会话摘要 Tab */
    function buildSummariesTab() {
        if (_summaries.length === 0) {
            return `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('messageCircle', 32)}</div>
                <div style="font-size:14px;margin-bottom:4px">暂无会话摘要</div>
                <div style="font-size:12px">会话记录将自动生成摘要展示在这里</div>
            </div>`;
        }

        const filtered = _searchTerm
            ? _summaries.filter(
                  (s) =>
                      (s.title || '').toLowerCase().includes(_searchTerm.toLowerCase()) ||
                      (s.id || '').toLowerCase().includes(_searchTerm.toLowerCase()),
              )
            : _summaries;

        return `<div style="display:flex;flex-direction:column;gap:8px;padding:16px">
            ${filtered
                .map(
                    (s) => `<div class="session-item" data-action="viewSession" data-id="${s.id}" style="padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.title || s.id)}</span>
                        <span style="font-size:11px;color:var(--text-tertiary);margin-left:8px">${s.messages} 条消息</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">${s.created ? Components.formatDateTime(s.created) : ''}</div>
                </div>`,
                )
                .join('')}
        </div>`;
    }

    // ==========================================
    // 页面构建
    // ==========================================

    function buildPage() {
        const tabs = Components.createTabs(
            [
                { key: 'memory', label: '长期记忆' },
                { key: 'user', label: '用户画像' },
                { key: 'learnings', label: '学习记录' },
                { key: 'summaries', label: '会话摘要' },
            ],
            _activeTab,
            'MemoryPage.switchTab',
        );

        let contentHtml = '';
        switch (_activeTab) {
            case 'memory':
                contentHtml = buildEditorTab(_memoryContent);
                break;
            case 'user':
                contentHtml = buildEditorTab(_userContent);
                break;
            case 'learnings':
                contentHtml = buildLearningsTab();
                break;
            case 'summaries':
                contentHtml = buildSummariesTab();
                break;
        }

        // 搜索栏（仅学习记录和会话摘要 Tab 显示）
        const showSearch = _activeTab === 'learnings' || _activeTab === 'summaries';
        const searchHtml = showSearch
            ? `<div style="padding:8px 16px">
                <input type="text" id="memorySearch" placeholder="搜索..." value="${Components.escapeHtml(_searchTerm)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text-primary)">
            </div>`
            : '';

        return `${tabs}${searchHtml}${contentHtml}`;
    }

    // ==========================================
    // Tab 切换（含未保存提示）
    // ==========================================

    async function switchTab(tab) {
        // 检查未保存内容
        if (_activeTab === 'memory' || _activeTab === 'user') {
            const editor = document.getElementById('memoryEditor');
            if (editor) {
                const currentContent = editor.value;
                const savedContent = _activeTab === 'memory' ? _memoryContent : _userContent;
                if (currentContent !== savedContent) {
                    const ok = await Components.Modal.confirm({
                        title: '未保存的更改',
                        message: '当前编辑器有未保存的更改，切换 Tab 将丢失这些更改。是否继续？',
                        confirmText: '放弃更改',
                        type: 'warning',
                    });
                    if (!ok) return;
                }
            }
        }

        _activeTab = tab;
        _searchTerm = '';
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function updatePreview() {
        const editor = document.getElementById('memoryEditor');
        const preview = document.getElementById('memoryPreview');
        if (editor && preview) preview.innerHTML = Components.renderMarkdown(editor.value);
    }

    function formatContent() {
        const editor = document.getElementById('memoryEditor');
        if (!editor) return;
        let content = editor.value;
        content = content.replace(/\n{3,}/g, '\n\n').trim();
        editor.value = content;
        updatePreview();
        Components.Toast.info('内容已格式化');
    }

    async function saveContent() {
        const editor = document.getElementById('memoryEditor');
        if (!editor) return;
        const content = editor.value;
        try {
            if (_activeTab === 'memory') {
                await API.memory.saveMemory(content);
                _memoryContent = content;
            } else {
                await API.memory.saveUser(content);
                _userContent = content;
            }
            Components.Toast.success('保存成功');
        } catch (err) {
            Components.Toast.error(err.message || '保存失败');
        }
    }

    function exportContent() {
        const editor = document.getElementById('memoryEditor');
        if (!editor) return;
        const blob = new Blob([editor.value], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${_activeTab === 'memory' ? 'MEMORY' : 'USER'}.md`;
        a.click();
        URL.revokeObjectURL(url);
        Components.Toast.success('已导出');
    }

    async function resetContent() {
        const tabLabel = _activeTab === 'memory' ? '长期记忆' : '用户画像';
        const ok = await Components.Modal.confirm({
            title: '重置内容',
            message: `确定要将「${tabLabel}」重置为默认内容吗？当前未保存的编辑内容将丢失。`,
            confirmText: '重置',
            type: 'warning',
        });
        if (!ok) return;

        const defaults = {
            memory: '# Agent 长期记忆\n\n## 用户偏好\n\n## 项目上下文\n\n## 重要记录\n',
            user: '# 用户画像\n\n## 基本信息\n\n## 技术栈\n\n## 偏好\n',
        };
        const editor = document.getElementById('memoryEditor');
        if (editor) {
            editor.value = defaults[_activeTab] || '';
            updatePreview();
            Components.Toast.info('已重置为默认内容（未保存）');
        }
    }

    /** 填充模板 */
    function fillTemplate() {
        const templates = {
            memory: `# Agent 长期记忆

## 用户偏好
- 沟通风格：
- 工作习惯：
- 常用工具：

## 项目上下文
- 当前项目：
- 技术栈：
- 关键约束：

## 重要记录
- 
`,
            user: `# 用户画像

## 基本信息
- 称呼：
- 角色：
- 时区：Asia/Shanghai

## 技术栈
- 前端：
- 后端：
- 其他：

## 偏好
- 代码风格：
- 文档语言：
- 交付格式：
`,
        };

        const editor = document.getElementById('memoryEditor');
        if (!editor) return;
        const template = templates[_activeTab];
        if (!template) return;

        if (editor.value.trim()) {
            Components.Modal.confirm({
                title: '填充模板',
                message: '编辑器已有内容，填充模板将覆盖当前内容。是否继续？',
                confirmText: '覆盖',
                type: 'warning',
            }).then((ok) => {
                if (ok) {
                    editor.value = template;
                    updatePreview();
                    Components.Toast.info('模板已填充');
                }
            });
        } else {
            editor.value = template;
            updatePreview();
            Components.Toast.info('模板已填充');
        }
    }

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        // 编辑器实时预览
        const editor = document.getElementById('memoryEditor');
        if (editor) editor.addEventListener('input', Components.debounce(updatePreview, 300));

        // 搜索框
        const searchInput = document.getElementById('memorySearch');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _searchTerm = e.target.value;
                    // 局部刷新内容区
                    const tabsEl = container.querySelector('.tabs-container');
                    const tabsHtml = tabsEl ? tabsEl.outerHTML : '';
                    let contentHtml = '';
                    switch (_activeTab) {
                        case 'learnings':
                            contentHtml = buildLearningsTab();
                            break;
                        case 'summaries':
                            contentHtml = buildSummariesTab();
                            break;
                    }
                    const searchHtml = `<div style="padding:8px 16px">
                        <input type="text" id="memorySearch" placeholder="搜索..." value="${Components.escapeHtml(_searchTerm)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text-primary)">
                    </div>`;
                    // 保留 tabs，替换搜索+内容
                    const contentArea = container.querySelector('.editor-container, [style*="padding:60px"], [style*="padding:40px"], [style*="display:flex;flex-direction"]');
                    if (contentArea) {
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = searchHtml + contentHtml;
                        contentArea.replaceWith(tempDiv.firstElementChild || tempDiv);
                        bindSearchEvents();
                    }
                }, 300),
            );
        }

        // 事件委托：按钮操作
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            switch (action) {
                case 'formatContent':
                    formatContent();
                    break;
                case 'saveContent':
                    saveContent();
                    break;
                case 'exportContent':
                    exportContent();
                    break;
                case 'resetContent':
                    resetContent();
                    break;
                case 'fillTemplate':
                    fillTemplate();
                    break;
                case 'viewSession':
                    // 跳转到会话页面
                    if (btn.dataset.id && window.App) {
                        window.App.navigate('sessions', btn.dataset.id);
                    }
                    break;
            }
        });

        // Ctrl+S 快捷键
        if (_globalKeyHandler) document.removeEventListener('keydown', _globalKeyHandler);
        _globalKeyHandler = function handler(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveContent();
            }
        };
        document.addEventListener('keydown', _globalKeyHandler);
    }

    function bindSearchEvents() {
        const searchInput = document.getElementById('memorySearch');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _searchTerm = e.target.value;
                    // 简单刷新
                    const container = document.getElementById('contentBody');
                    if (container) {
                        container.innerHTML = buildPage();
                        bindEvents();
                    }
                }, 300),
            );
        }
    }

    return { render, switchTab, updatePreview, formatContent, saveContent, exportContent, resetContent };
})();
