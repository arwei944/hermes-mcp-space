/**
 * 记忆管理页面 (Mac 极简风格)
 */

const MemoryPage = (() => {
    let _memoryContent = '';
    let _userContent = '';
    let _activeTab = 'memory';
    let _stats = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [memoryData, userData, statsData] = await Promise.all([
                API.memory.getMemory(), API.memory.getUser(), API.memory.stats(),
            ]);
            _memoryContent = memoryData.content || memoryData || '';
            _userContent = userData.content || userData || '';
            _stats = statsData;
        } catch (err) {
            _memoryContent = getMockMemory();
            _userContent = getMockUser();
            _stats = null;
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockMemory() {
        return `# Agent 记忆\n\n## 项目信息\n- 项目名称: Hermes Agent\n- 版本: 1.0.0\n- 技术栈: Node.js, TypeScript, Express\n\n## 用户偏好\n- 用户喜欢简洁的代码风格\n- 优先使用 TypeScript\n- 测试覆盖率要求 > 80%\n\n## 重要决策\n1. 使用 Express 作为 Web 框架\n2. 采用 MCP 协议进行工具通信\n3. 记忆系统使用 Markdown 文件存储`;
    }

    function getMockUser() {
        return `# 用户信息\n\n## 基本信息\n- 称呼: 开发者\n- 时区: Asia/Shanghai\n- 语言: 中文\n\n## 偏好设置\n- 代码风格: 简洁、有注释\n- 文档语言: 中文\n- 回复风格: 直接、专业`;
    }

    function buildPage() {
        const tabs = Components.createTabs(
            [{ key: 'memory', label: 'MEMORY.md' }, { key: 'user', label: 'USER.md' }],
            _activeTab, 'MemoryPage.switchTab'
        );

        const content = _activeTab === 'memory' ? _memoryContent : _userContent;
        const wordCount = content.length;
        const lineCount = content.split('\n').length;

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
                            <button class="btn btn-sm btn-primary" onclick="MemoryPage.saveContent()">保存</button>
                        </div>
                    </div>
                    <textarea class="editor-textarea" id="memoryEditor">${Components.escapeHtml(content)}</textarea>
                    ${statsHtml}
                </div>
                <div class="editor-pane">
                    <div class="editor-pane-header">
                        <h3>预览</h3>
                        <span style="font-size:11px;color:var(--text-tertiary)">Markdown 渲染</span>
                    </div>
                    <div class="editor-preview markdown-body" id="memoryPreview">${Components.renderMarkdown(content)}</div>
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
        document.addEventListener('keydown', function handler(e) {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveContent(); }
        });
    }

    return { render, switchTab, updatePreview, formatContent, saveContent };
})();
