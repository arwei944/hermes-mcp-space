/**
 * 记忆管理页面 - 编辑器 Tab（长期记忆 / 用户画像）
 */

const EditorTab = (() => {
    let _memoryContent = '';
    let _userContent = '';
    let _stats = null;
    let _activeSubTab = 'memory';
    let _globalKeyHandler = null;
    let _destroyed = false;

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
            if (_activeSubTab === 'memory') {
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
        a.download = `${_activeSubTab === 'memory' ? 'MEMORY' : 'USER'}.md`;
        a.click();
        URL.revokeObjectURL(url);
        Components.Toast.success('已导出');
    }

    async function resetContent() {
        const tabLabel = _activeSubTab === 'memory' ? '长期记忆' : '用户画像';
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
            editor.value = defaults[_activeSubTab] || '';
            updatePreview();
            Components.Toast.info('已重置为默认内容（未保存）');
        }
    }

    function fillTemplate() {
        const templates = {
            memory: `# Agent 长期记忆\n\n## 用户偏好\n- 沟通风格：\n- 工作习惯：\n- 常用工具：\n\n## 项目上下文\n- 当前项目：\n- 技术栈：\n- 关键约束：\n\n## 重要记录\n- \n`,
            user: `# 用户画像\n\n## 基本信息\n- 称呼：\n- 角色：\n- 时区：Asia/Shanghai\n\n## 技术栈\n- 前端：\n- 后端：\n- 其他：\n\n## 偏好\n- 代码风格：\n- 文档语言：\n- 交付格式：\n`,
        };

        const editor = document.getElementById('memoryEditor');
        if (!editor) return;
        const template = templates[_activeSubTab];
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

    function hasUnsavedChanges(tab) {
        const editor = document.getElementById('memoryEditor');
        if (!editor) return false;
        const currentContent = editor.value;
        const savedContent = tab === 'memory' ? _memoryContent : _userContent;
        return currentContent !== savedContent;
    }

    function onTabSwitch(tab) {
        _activeSubTab = tab;
        const content = tab === 'memory' ? _memoryContent : _userContent;
        const container = document.querySelector('#memory-editor');
        if (container) {
            container.innerHTML = buildEditorTab(content);
            bindEvents();
        }
    }

    function bindEvents() {
        const container = document.querySelector('#memory-editor');
        if (!container) return;

        const editor = document.getElementById('memoryEditor');
        if (editor) editor.addEventListener('input', Components.debounce(updatePreview, 300));

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            switch (btn.dataset.action) {
                case 'formatContent': formatContent(); break;
                case 'saveContent': saveContent(); break;
                case 'exportContent': exportContent(); break;
                case 'resetContent': resetContent(); break;
                case 'fillTemplate': fillTemplate(); break;
            }
        });

        if (_globalKeyHandler) document.removeEventListener('keydown', _globalKeyHandler);
        _globalKeyHandler = function handler(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                saveContent();
            }
        };
        document.addEventListener('keydown', _globalKeyHandler);
    }

    function render(containerSelector, memoryContent, userContent, statsData) {
        _destroyed = false;
        _memoryContent = memoryContent || '';
        _userContent = userContent || '';
        _stats = statsData || null;
        _activeSubTab = 'memory';

        const container = document.querySelector(containerSelector);
        if (!container) return;
        container.innerHTML = buildEditorTab(_memoryContent);
        bindEvents();
    }

    function destroy() {
        _destroyed = true;
        if (_globalKeyHandler) {
            document.removeEventListener('keydown', _globalKeyHandler);
            _globalKeyHandler = null;
        }
    }

    return { render, destroy, hasUnsavedChanges, onTabSwitch };
})();

export default EditorTab;
