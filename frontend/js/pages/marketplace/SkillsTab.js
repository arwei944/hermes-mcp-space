/**
 * 统一管理页面 - 技能管理 Tab
 */

const SkillsTab = (() => {
    // 状态
    let _skills = [];
    let _skillSearchKeyword = '';
    let _skillCategoryFilter = '';
    let _container = null;

    // ==========================================
    // 渲染入口
    // ==========================================
    function render(containerSelector, data) {
        _skills = data.skills || [];
        _container = document.querySelector(containerSelector);
        if (!_container) return;
        _container.dataset.rendered = 'true';
        _container.innerHTML = buildTab();
        bindEvents();
    }

    // ==========================================
    // 辅助函数
    // ==========================================
    function getFilteredSkills() {
        let result = _skills;
        if (_skillCategoryFilter) {
            result = result.filter((s) => (s.category || '未分类') === _skillCategoryFilter);
        }
        if (!_skillSearchKeyword) return result;
        const kw = _skillSearchKeyword.toLowerCase();
        return result.filter(
            (s) => (s.name || '').toLowerCase().includes(kw) || (s.description || '').toLowerCase().includes(kw),
        );
    }

    // ==========================================
    // Tab 构建
    // ==========================================
    function buildTab() {
        const categories = SkillTemplates.getCategories(_skills);
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('技能总数', _skills.length, '', Components.icon('zap', 16), 'purple')}
            ${Components.renderStatCard('已激活', _skills.filter((s) => s.status !== 'disabled').length, '', Components.icon('check', 14), 'green')}
            ${Components.renderStatCard('分类数', categories.length, '', Components.icon('package', 14), 'blue')}
        </div>`;

        const actionsHtml = `<div style="display:flex;justify-content:flex-end;gap:8px;margin-bottom:16px">
            <button type="button" class="btn btn-ghost" data-action="showTemplateLibrary">从模板创建</button>
            <button type="button" class="btn btn-primary" data-action="showCreate">创建技能</button>
        </div>`;

        const filterHtml = `<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
            <div style="position:relative;flex:1">
                ${Components.icon('search', 14, 'var(--text-tertiary)', 'position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none')}
                <input type="text" id="skillSearchInput" placeholder="搜索技能名称或描述..." value="${Components.escapeHtml(_skillSearchKeyword)}" style="width:100%;padding:7px 10px 7px 30px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
            </div>
            <select id="skillCategoryFilter" style="padding:7px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text);min-width:100px">
                <option value="">全部分类</option>
                ${categories.map((c) => `<option value="${c}" ${_skillCategoryFilter === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
        </div>`;

        const editorHtml = SkillEditor.getEditorHtml();
        const skillsHtml = buildSkillsTable();

        return `${statsHtml}${actionsHtml}${filterHtml}${editorHtml}<div id="skillListContainer">${skillsHtml}</div>`;
    }

    function buildSkillsTable() {
        const filtered = getFilteredSkills();
        if (filtered.length === 0) {
            return Components.createEmptyState(
                Components.icon('zap', 16),
                '暂无技能',
                _skillSearchKeyword ? '没有匹配的技能' : '点击「创建技能」添加第一个技能',
                '',
            );
        }
        return `<div class="table-wrapper"><table class="table">
                <thead><tr><th>名称</th><th>描述</th><th>标签</th><th>操作</th></tr></thead>
                <tbody>
                    ${filtered
                        .map(
                            (s) => `<tr>
                        <td class="mono" style="color:var(--accent);font-weight:500">${Components.escapeHtml(s.name || '-')}</td>
                        <td style="font-size:12px;max-width:250px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.description || '-')}</td>
                        <td>${(s.tags || []).map((t) => Components.renderBadge(t, 'blue')).join(' ') || '-'}</td>
                        <td>
                            <div style="display:flex;gap:4px">
                                <button type="button" class="btn btn-sm btn-ghost" data-action="viewSkill" data-name="${Components.escapeHtml(s.name)}" title="查看">${Components.icon('eye', 14)}</button>
                                <button type="button" class="btn btn-sm btn-ghost" data-action="editSkill" data-name="${Components.escapeHtml(s.name)}" title="编辑">${Components.icon('edit', 14)}</button>
                                <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteSkill" data-name="${Components.escapeHtml(s.name)}" title="删除">${Components.icon('trash', 16)}</button>
                            </div>
                        </td>
                    </tr>`,
                        )
                        .join('')}
                </tbody>
            </table></div>`;
    }

    function updateSkillList() {
        const container = document.getElementById('skillListContainer');
        if (!container) return;
        container.innerHTML = buildSkillsTable();
    }

    // ==========================================
    // 技能操作
    // ==========================================
    function _refresh() {
        _container.innerHTML = buildTab();
        bindEvents();
    }

    async function editSkill(name) {
        try {
            const data = await API.skills.content(name);
            const content = typeof data === 'string' ? data : data.content || '';
            SkillEditor.showEdit(name, content);
            _refresh();
        } catch (err) {
            Components.Toast.error(`加载失败: ${err.message}`);
        }
    }

    async function viewSkill(name) {
        try {
            const data = await API.skills.content(name);
            const content = typeof data === 'string' ? data : data.content || '';
            SkillEditor.showEdit(name, content);
            _refresh();
        } catch (err) {
            Components.Toast.error(`加载失败: ${err.message}`);
        }
    }

    async function deleteSkill(name) {
        const ok = await Components.Modal.confirm({
            title: '删除技能',
            message: `确定要删除技能「${name}」吗？删除后可在回收站恢复。`,
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;
        try {
            let skillData = '';
            try {
                const data = await API.skills.content(name);
                skillData = typeof data === 'string' ? data : data.content || '';
            } catch (_e) { /* ignore */ }
            await API.skills.delete(name);
            try {
                await API.request('POST', '/api/trash', {
                    type: 'skill',
                    item_id: name,
                    item_name: name,
                    data: skillData,
                    metadata: { description: '' },
                });
            } catch (_e) { /* ignore */ }
            Components.Toast.success('技能已删除（可在回收站恢复）');
            MarketplacePage.render('skills');
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    // ==========================================
    // 事件绑定
    // ==========================================
    function bindEvents() {
        if (!_container) return;

        _container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            switch (action) {
                case 'showCreate':
                    SkillEditor.showCreate();
                    _refresh();
                    break;
                case 'editSkill':
                    editSkill(btn.dataset.name);
                    break;
                case 'viewSkill':
                    viewSkill(btn.dataset.name);
                    break;
                case 'deleteSkill':
                    deleteSkill(btn.dataset.name);
                    break;
                case 'hideEditor':
                    SkillEditor.hideEditor();
                    _refresh();
                    break;
                case 'saveSkill': {
                    const saved = await SkillEditor.saveSkill();
                    if (saved) MarketplacePage.render('skills');
                    break;
                }
                case 'previewContent':
                    SkillEditor.previewContent();
                    break;
                case 'insertTemplate':
                    SkillEditor.insertTemplate();
                    break;
                case 'showTemplateLibrary':
                    SkillTemplates.showTemplateLibrary((templateName) => {
                        const prefill = SkillEditor.useTemplate(templateName);
                        if (prefill) {
                            _refresh();
                            // 预填表单
                            setTimeout(() => {
                                const nameInput = document.getElementById('skillName');
                                if (nameInput) nameInput.value = prefill.name;
                                const descInput = document.getElementById('skillDesc');
                                if (descInput) descInput.value = prefill.description;
                                const tagsInput = document.getElementById('skillTags');
                                if (tagsInput) tagsInput.value = prefill.category;
                            }, 0);
                        }
                    });
                    break;
            }
        });

        // 技能搜索
        const skillSearchInput = document.getElementById('skillSearchInput');
        if (skillSearchInput) {
            skillSearchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _skillSearchKeyword = e.target.value;
                    updateSkillList();
                }, 300),
            );
        }

        // 技能分类过滤
        const skillCategoryFilter = document.getElementById('skillCategoryFilter');
        if (skillCategoryFilter) {
            skillCategoryFilter.addEventListener('change', (e) => {
                _skillCategoryFilter = e.target.value;
                updateSkillList();
            });
        }
    }

    function destroy() {
        _container = null;
    }

    return { render, destroy };
})();

export default SkillsTab;
