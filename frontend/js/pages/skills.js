/**
 * 技能系统页面
 * 技能列表（文件树风格）、技能详情（Markdown 渲染）、创建/编辑/删除
 */

const SkillsPage = (() => {
    let _skills = [];
    let _activeSkill = null;
    let _skillContent = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.skills.list();
            _skills = data.skills || data || [];
        } catch (err) {
            _skills = getMockSkills();
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockSkills() {
        return [
            { name: 'code-review', description: '代码审查技能', tags: ['开发', '代码质量'], hasSkillMd: true },
            { name: 'doc-writer', description: '文档编写技能', tags: ['文档', '写作'], hasSkillMd: true },
            { name: 'data-analyzer', description: '数据分析技能', tags: ['数据', '分析'], hasSkillMd: true },
            { name: 'bug-hunter', description: 'Bug 搜索技能', tags: ['测试', '调试'], hasSkillMd: true },
            { name: 'refactor', description: '代码重构技能', tags: ['开发', '重构'], hasSkillMd: true },
            { name: 'security-scan', description: '安全扫描技能', tags: ['安全', '审计'], hasSkillMd: false },
            { name: 'perf-tuner', description: '性能优化技能', tags: ['性能', '优化'], hasSkillMd: true },
        ];
    }

    function buildPage() {
        const leftPanel = buildFileTree();
        const rightPanel = _activeSkill ? buildSkillDetail() : buildEmptyDetail();

        return `
            <div class="page-enter">
                <div class="split-panel">
                    <div class="split-panel-left">
                        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                            ${Components.sectionTitle('技能列表')}
                            <button class="btn btn-sm btn-primary" onclick="SkillsPage.createSkill()">+ 新建</button>
                        </div>
                        ${leftPanel}
                    </div>
                    <div class="split-panel-right" id="skillDetailPanel">
                        ${rightPanel}
                    </div>
                </div>
            </div>
        `;
    }

    function buildFileTree() {
        const items = _skills.map(skill => ({
            id: skill.name,
            icon: skill.hasSkillMd ? '⚡' : '📄',
            name: skill.name,
            onClick: `SkillsPage.selectSkill('${skill.name}')`,
        }));

        return Components.createFileTree({
            title: `${_skills.length} 个技能`,
            items,
            activeId: _activeSkill,
            actions: (item) => `
                <button class="btn btn-sm btn-ghost" onclick="event.stopPropagation();SkillsPage.editSkill('${item.id}')" title="编辑">✏️</button>
                <button class="btn btn-sm btn-danger" onclick="event.stopPropagation();SkillsPage.deleteSkill('${item.id}')" title="删除">🗑</button>
            `,
        });
    }

    function buildEmptyDetail() {
        return Components.createEmptyState(
            '⚡', '选择一个技能',
            '从左侧列表中选择一个技能查看详情',
            ''
        );
    }

    function buildSkillDetail() {
        const skill = _skills.find(s => s.name === _activeSkill);
        if (!skill) return buildEmptyDetail();

        const tagsHtml = (skill.tags || []).map(t => Components.badge(t, 'primary')).join(' ');

        const contentHtml = _skillContent
            ? `<div class="markdown-body">${Components.renderMarkdown(_skillContent)}</div>`
            : Components.createEmptyState('📄', '暂无内容', '该技能没有 SKILL.md 文件', '');

        return `
            <div style="padding:20px">
                <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:16px">
                    <div>
                        <h2 style="font-size:1.2rem;color:var(--text-heading);margin-bottom:6px">${Components.escapeHtml(skill.name)}</h2>
                        <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:8px">${Components.escapeHtml(skill.description || '')}</p>
                        <div class="tag-list">${tagsHtml}</div>
                    </div>
                    <div style="display:flex;gap:6px">
                        <button class="btn btn-sm btn-secondary" onclick="SkillsPage.editSkill('${skill.name}')">编辑</button>
                        <button class="btn btn-sm btn-danger" onclick="SkillsPage.deleteSkill('${skill.name}')">删除</button>
                    </div>
                </div>
                <hr style="border:none;border-top:1px solid var(--border-primary);margin-bottom:16px">
                ${Components.sectionTitle('SKILL.md')}
                ${contentHtml}
            </div>
        `;
    }

    async function selectSkill(name) {
        _activeSkill = name;
        _skillContent = null;

        const panel = document.getElementById('skillDetailPanel');
        if (panel) panel.innerHTML = Components.createLoading();

        // 更新文件树选中状态
        document.querySelectorAll('.file-tree-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === name);
        });

        try {
            const data = await API.skills.content(name);
            _skillContent = data.content || data || '';
        } catch (err) {
            _skillContent = null;
        }

        if (panel) panel.innerHTML = buildSkillDetail();
    }

    function createSkill() {
        Components.Modal.open({
            title: '创建新技能',
            size: 'lg',
            content: `
                <form id="createSkillForm">
                    ${Components.formGroup('技能名称', Components.formInput('name', '例如: my-skill', ''), '使用小写字母和连字符')}
                    ${Components.formGroup('描述', Components.formInput('description', '技能描述', ''))}
                    ${Components.formGroup('标签（逗号分隔）', Components.formInput('tags', '例如: 开发, 工具', ''))}
                    ${Components.formGroup('SKILL.md 内容', Components.formTextarea('content', '# 技能说明\n\n描述该技能的功能和使用方法...', '', 10))}
                </form>
            `,
            footer: `
                <button class="btn btn-ghost" onclick="Components.Modal.close()">取消</button>
                <button class="btn btn-primary" onclick="SkillsPage.saveNewSkill()">创建</button>
            `,
        });
    }

    async function saveNewSkill() {
        const form = document.getElementById('createSkillForm');
        if (!form) return;

        const name = form.querySelector('[name="name"]').value.trim();
        const description = form.querySelector('[name="description"]').value.trim();
        const tags = form.querySelector('[name="tags"]').value.split(',').map(t => t.trim()).filter(Boolean);
        const content = form.querySelector('[name="content"]').value;

        if (!name) {
            Components.Toast.warning('请输入技能名称');
            return;
        }

        try {
            await API.skills.create({ name, description, tags, content });
            Components.Toast.success('技能创建成功');
            Components.Modal.close();
            render();
        } catch (err) {
            Components.Toast.error(`创建失败: ${err.message}`);
        }
    }

    function editSkill(name) {
        const skill = _skills.find(s => s.name === name);
        if (!skill) return;

        Components.Modal.open({
            title: `编辑技能: ${name}`,
            size: 'lg',
            content: `
                <form id="editSkillForm">
                    ${Components.formGroup('技能名称', `<input class="form-input" type="text" name="name" value="${Components.escapeHtml(name)}" disabled>`, '')}
                    ${Components.formGroup('描述', Components.formInput('description', '', skill.description || ''))}
                    ${Components.formGroup('标签（逗号分隔）', Components.formInput('tags', '', (skill.tags || []).join(', ')))}
                    ${Components.formGroup('SKILL.md 内容', Components.formTextarea('content', '', _skillContent || '', 12))}
                </form>
            `,
            footer: `
                <button class="btn btn-ghost" onclick="Components.Modal.close()">取消</button>
                <button class="btn btn-primary" onclick="SkillsPage.saveEditSkill('${Components.escapeHtml(name)}')">保存</button>
            `,
        });
    }

    async function saveEditSkill(originalName) {
        const form = document.getElementById('editSkillForm');
        if (!form) return;

        const description = form.querySelector('[name="description"]').value.trim();
        const tags = form.querySelector('[name="tags"]').value.split(',').map(t => t.trim()).filter(Boolean);
        const content = form.querySelector('[name="content"]').value;

        try {
            await API.skills.update(originalName, { description, tags, content });
            Components.Toast.success('技能已更新');
            Components.Modal.close();
            render();
        } catch (err) {
            Components.Toast.error(`更新失败: ${err.message}`);
        }
    }

    async function deleteSkill(name) {
        if (!confirm(`确定要删除技能 "${name}" 吗？`)) return;

        try {
            await API.skills.delete(name);
            Components.Toast.success('技能已删除');
            _skills = _skills.filter(s => s.name !== name);
            if (_activeSkill === name) {
                _activeSkill = null;
                _skillContent = null;
            }
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    function bindEvents() {}

    function init() {}

    return { render, init, selectSkill, createSkill, saveNewSkill, editSkill, saveEditSkill, deleteSkill };
})();
