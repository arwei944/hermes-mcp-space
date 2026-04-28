/**
 * 技能管理页面 (Mac 极简风格)
 * 在线创建/编辑/预览技能
 */

const SkillsPage = (() => {
    let _skills = [];
    let _currentSkill = null;
    let _editorContent = '';
    let _showEditor = false;
    let _isCreating = false;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.skills.list();
            _skills = data.skills || data || [];
        } catch (err) {
            _skills = [];
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function buildPage() {
        // 统计
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('技能总数', _skills.length, '', '⚡', 'purple')}
            ${Components.renderStatCard('已激活', _skills.filter(s => s.status !== 'disabled').length, '', '✅', 'green')}
        </div>`;

        // 操作按钮
        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-primary" onclick="SkillsPage.showCreate()">创建技能</button>
        </div>`;

        // 编辑器
        const editorHtml = _showEditor ? buildEditor() : '';

        // 技能列表
        const skillsHtml = _skills.length === 0
            ? Components.createEmptyState('⚡', '暂无技能', '点击「创建技能」添加第一个技能', '')
            : `<div class="table-wrapper"><table class="table">
                <thead><tr><th>名称</th><th>描述</th><th>标签</th><th>操作</th></tr></thead>
                <tbody>
                    ${_skills.map(s => `<tr>
                        <td class="mono" style="color:var(--accent);font-weight:500">${Components.escapeHtml(s.name || '-')}</td>
                        <td style="font-size:12px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.description || '-')}</td>
                        <td>${(s.tags || []).map(t => Components.renderBadge(t, 'blue')).join(' ') || '-'}</td>
                        <td>
                            <div style="display:flex;gap:4px">
                                <button class="btn btn-sm btn-ghost" onclick="SkillsPage.viewSkill('${Components.escapeHtml(s.name)}')" title="查看">👁️</button>
                                <button class="btn btn-sm btn-ghost" onclick="SkillsPage.editSkill('${Components.escapeHtml(s.name)}')" title="编辑">✏️</button>
                                <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="SkillsPage.deleteSkill('${Components.escapeHtml(s.name)}')" title="删除">🗑️</button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table></div>`;

        return `${statsHtml}${actionsHtml}${editorHtml}${skillsHtml}`;
    }

    function buildEditor() {
        const title = _isCreating ? '创建技能' : (_currentSkill ? `编辑: ${_currentSkill}` : '编辑技能');
        return `<div class="modal-overlay" onclick="SkillsPage.hideEditor()">
            <div class="modal" style="max-width:800px;width:90%" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" onclick="SkillsPage.hideEditor()">✕</button>
                </div>
                <div class="modal-body">
                    ${_isCreating ? Components.formGroup('技能名称', `<input class="form-input" id="skillName" placeholder="例如: my-skill">`, '英文、数字、下划线') : ''}
                    ${Components.formGroup('描述', `<input class="form-input" id="skillDesc" placeholder="技能描述" value="${Components.escapeHtml(_currentSkill?.description || '')}">`)}
                    ${Components.formGroup('标签', `<input class="form-input" id="skillTags" placeholder="例如: 开发, 工具" value="${Components.escapeHtml((_currentSkill?.tags || []).join(', '))}">`, '逗号分隔')}
                    ${Components.formGroup('内容', `
                        <div style="display:flex;gap:8px;margin-bottom:8px">
                            <button class="btn btn-sm btn-ghost" onclick="SkillsPage.previewContent()">预览</button>
                            <button class="btn btn-sm btn-ghost" onclick="SkillsPage.insertTemplate()">插入模板</button>
                        </div>
                        <textarea class="form-input" id="skillContent" rows="12" placeholder="# 技能说明\n\n描述该技能的功能和使用方法..." style="font-family:var(--mono-font, monospace);font-size:13px">${Components.escapeHtml(_editorContent)}</textarea>
                    `)}
                    <div id="skillPreview" style="display:none;margin-top:12px;padding:16px;border-radius:var(--radius-sm);background:var(--surface-secondary);border:1px solid var(--border)">
                        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">预览</div>
                        <div class="markdown-body" id="skillPreviewContent"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="SkillsPage.hideEditor()">取消</button>
                    <button class="btn btn-primary" onclick="SkillsPage.saveSkill()">保存</button>
                </div>
            </div>
        </div>`;
    }

    function showCreate() {
        _isCreating = true;
        _currentSkill = null;
        _editorContent = '';
        _showEditor = true;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    async function editSkill(name) {
        try {
            const data = await API.skills.content(name);
            _currentSkill = name;
            _editorContent = typeof data === 'string' ? data : (data.content || '');
            _isCreating = false;
            _showEditor = true;
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`加载失败: ${err.message}`);
        }
    }

    async function viewSkill(name) {
        try {
            const data = await API.skills.content(name);
            const content = typeof data === 'string' ? data : (data.content || '');
            _currentSkill = name;
            _editorContent = content;
            _isCreating = false;
            _showEditor = true;
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`加载失败: ${err.message}`);
        }
    }

    function hideEditor() {
        _showEditor = false;
        _currentSkill = null;
        _editorContent = '';
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function previewContent() {
        const textarea = document.getElementById('skillContent');
        const preview = document.getElementById('skillPreview');
        const previewContent = document.getElementById('skillPreviewContent');
        if (textarea && preview && previewContent) {
            previewContent.innerHTML = Components.renderMarkdown(textarea.value);
            preview.style.display = preview.style.display === 'none' ? 'block' : 'none';
        }
    }

    function insertTemplate() {
        const textarea = document.getElementById('skillContent');
        if (textarea) {
            textarea.value = `# 技能名称

## 描述
描述该技能的功能和用途。

## 使用方法
1. 步骤一
2. 步骤二
3. 步骤三

## 注意事项
- 注意事项一
- 注意事项二

## 示例
\`\`\`
示例代码或命令
\`\`\`
`;
        }
    }

    async function saveSkill() {
        const content = document.getElementById('skillContent')?.value || '';
        const desc = document.getElementById('skillDesc')?.value || '';

        try {
            if (_isCreating) {
                const name = document.getElementById('skillName')?.value.trim();
                if (!name) {
                    Components.Toast.error('请填写技能名称');
                    return;
                }
                const tags = (document.getElementById('skillTags')?.value || '').split(',').map(t => t.trim()).filter(Boolean);
                await API.skills.create({ name, content, description: desc, tags });
                Components.Toast.success('技能已创建');
            } else {
                await API.skills.update(_currentSkill, { content, description: desc });
                Components.Toast.success('技能已更新');
            }
            await render();
        } catch (err) {
            Components.Toast.error(`保存失败: ${err.message}`);
        }
    }

    async function deleteSkill(name) {
        try {
            await API.skills.delete(name);
            Components.Toast.success('技能已删除');
            await render();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    function bindEvents() {}

    return { render, showCreate, editSkill, viewSkill, hideEditor, saveSkill, deleteSkill, previewContent, insertTemplate };
})();
