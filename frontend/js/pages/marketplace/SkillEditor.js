/**
 * 技能管理 Tab - 编辑器
 * 包含技能编辑/创建 Modal、预览、模板插入
 */

const SkillEditor = (() => {
    let _currentSkill = null;
    let _editorContent = '';
    let _isCreating = false;
    let _showEditor = false;
    let _container = null;

    function getState() {
        return { currentSkill: _currentSkill, editorContent: _editorContent, isCreating: _isCreating, showEditor: _showEditor };
    }

    function showCreate() {
        _isCreating = true;
        _currentSkill = null;
        _editorContent = '';
        _showEditor = true;
    }

    function showEdit(name, content) {
        _currentSkill = name;
        _editorContent = content;
        _isCreating = false;
        _showEditor = true;
    }

    function hideEditor() {
        _showEditor = false;
        _currentSkill = null;
        _editorContent = '';
    }

    function buildEditor() {
        const title = _isCreating ? '创建技能' : _currentSkill ? `编辑: ${_currentSkill}` : '编辑技能';
        return `<div class="modal-overlay" data-action="hideEditor">
            <div class="modal" style="max-width:800px;width:90%" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button type="button" class="modal-close" data-action="hideEditor">${Components.icon('x', 14)}</button>
                </div>
                <div class="modal-body">
                    ${_isCreating ? Components.formGroup('技能名称', `<input class="form-input" id="skillName" placeholder="例如: my-skill">`, '英文、数字、下划线') : ''}
                    ${Components.formGroup('描述', `<input class="form-input" id="skillDesc" placeholder="技能描述" value="${Components.escapeHtml(_currentSkill?.description || '')}">`)}
                    ${Components.formGroup('标签', `<input class="form-input" id="skillTags" placeholder="例如: 开发, 工具" value="${Components.escapeHtml((_currentSkill?.tags || []).join(', '))}">`, '逗号分隔')}
                    ${Components.formGroup(
                        '内容',
                        `<div style="display:flex;gap:8px;margin-bottom:8px">
                            <button type="button" class="btn btn-sm btn-ghost" data-action="previewContent">预览</button>
                            <button type="button" class="btn btn-sm btn-ghost" data-action="insertTemplate">插入模板</button>
                        </div>
                        <textarea class="form-input" id="skillContent" rows="12" placeholder="# 技能说明\n\n描述该技能的功能和使用方法..." style="font-family:var(--mono-font, monospace);font-size:13px">${Components.escapeHtml(_editorContent)}</textarea>`,
                    )}
                    <div id="skillPreview" style="display:none;margin-top:12px;padding:16px;border-radius:var(--radius-sm);background:var(--surface-secondary);border:1px solid var(--border)">
                        <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">预览</div>
                        <div class="markdown-body" id="skillPreviewContent"></div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" data-action="hideEditor">取消</button>
                    <button type="button" class="btn btn-primary" data-action="saveSkill">保存</button>
                </div>
            </div>
        </div>`;
    }

    function shouldShowEditor() {
        return _showEditor;
    }

    function getEditorHtml() {
        return _showEditor ? buildEditor() : '';
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
                    return null;
                }
                const tags = (document.getElementById('skillTags')?.value || '')
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean);
                await API.skills.create({ name, content, description: desc, tags });
                Components.Toast.success('技能已创建');
            } else {
                await API.skills.update(_currentSkill, { content, description: desc });
                Components.Toast.success('技能已更新');
            }
            _showEditor = false;
            return true;
        } catch (err) {
            Components.Toast.error(`保存失败: ${err.message}`);
            return null;
        }
    }

    function useTemplate(template) {
        const tpl = SkillTemplates.findTemplate(template);
        if (!tpl) return;
        _isCreating = true;
        _currentSkill = null;
        _editorContent = tpl.content;
        _showEditor = true;
        // 返回预填信息，由调用方设置 input 值
        return { name: tpl.name, description: tpl.description, category: tpl.category };
    }

    return {
        getState, showCreate, showEdit, hideEditor,
        shouldShowEditor, getEditorHtml,
        previewContent, insertTemplate, saveSkill, useTemplate,
    };
})();

export default SkillEditor;
