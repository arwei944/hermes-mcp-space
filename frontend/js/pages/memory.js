/**
 * 记忆管理页面 (Mac 极简风格)
 */

const MemoryPage = (() => {
    let _memoryContent = '';
    let _userContent = '';
    let _activeTab = 'memory';
    let _stats = null;
    let _globalKeyHandler = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [memoryData, userData, statsData] = await Promise.all([
                API.memory.getMemory(), API.memory.getUser(), API.memory.stats(),
            ]);
            // API 返回 {memory: "...", user: "..."} 或字符串
            _memoryContent = typeof memoryData === 'string' ? memoryData : (memoryData.memory || '');
            _userContent = typeof userData === 'string' ? userData : (userData.user || '');
            _stats = statsData;
        } catch (err) {
            _memoryContent = '';
            _userContent = '';
            _stats = null;
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function buildPage() {
        const tabs = Components.createTabs(
            [{ key: 'memory', label: 'MEMORY.md' }, { key: 'user', label: 'USER.md' }],
            _activeTab, 'MemoryPage.switchTab'
        );

        const content = _activeTab === 'memory' ? _memoryContent : _userContent;
        const safeContent = typeof content === 'string' ? content : '';
        const wordCount = safeContent.length;
        const lineCount = safeContent.split('\n').length;

        const statsHtml = _stats
            ? `<div class="editor-stats"><span>字数: ${_stats.wordCount || wordCount}</span><span>行数: ${_stats.lineCount || lineCount}</span><span>条目: ${_stats.entries || '-'}</span></div>`
            : `<div class="editor-stats"><span>字数: ${wordCount}</span><span>行数: ${lineCount}</span></div>`;

        return `${tabs}
            <div class="editor-container">
                <div class="editor-pane">
                    <div class="editor-pane-header">
                        <h3>编辑器</h3>
                        <div style="display:flex;gap:6px">
                            <button class="btn btn-sm btn-ghost" onclick="MemoryPage.formatContent()">格式化</button>
                            <button class="btn btn-sm btn-ghost" onclick="MemoryPage.exportContent()">导出</button>
                            <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="MemoryPage.resetContent()">重置</button>
                            <button class="btn btn-sm btn-primary" onclick="MemoryPage.saveContent()">保存</button>
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

    function switchTab(tab) {
        _activeTab = tab;
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
            if (_activeTab === 'memory') { await API.memory.saveMemory(content); _memoryContent = content; }
            else { await API.memory.saveUser(content); _userContent = content; }
            Components.Toast.success('保存成功');
        } catch (err) { Components.Toast.error(`保存失败: ${err.message}`); }
    }

    function bindEvents() {
        const editor = document.getElementById('memoryEditor');
        if (editor) editor.addEventListener('input', Components.debounce(updatePreview, 300));
        if (_globalKeyHandler) document.removeEventListener('keydown', _globalKeyHandler);
        _globalKeyHandler = function handler(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveContent(); }
        };
        document.addEventListener('keydown', _globalKeyHandler);
    }

    return { render, switchTab, updatePreview, formatContent, saveContent, exportContent, resetContent };

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
})();
