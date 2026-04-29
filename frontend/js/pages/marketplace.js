/**
 * 统一管理页面 - 外部 MCP / 技能 / 工具 三合一
 * Tab 切换，统一管理所有扩展能力
 */

const MarketplacePage = (() => {
    let _activeTab = 'mcp'; // mcp | skills | tools
    let _mcpServers = [];
    let _skills = [];
    let _allTools = [];
    let _localTools = [];
    let _externalTools = [];

    async function render(tab) {
        if (tab) _activeTab = tab;
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        await Promise.all([loadMCPServers(), loadSkills(), loadTools()]);

        container.innerHTML = buildPage();
        bindEvents();
    }

    // ---- 数据加载 ----
    async function loadMCPServers() {
        try {
            _mcpServers = await API.request('/api/mcp/servers');
        } catch {
            _mcpServers = [];
        }
    }

    async function loadSkills() {
        try {
            _skills = await API.skills.list();
        } catch {
            _skills = [];
        }
    }

    async function loadTools() {
        try {
            _allTools = await API.tools.list();
            _localTools = _allTools.filter((t) => !t.name.startsWith('mcp_'));
            _externalTools = _allTools.filter((t) => t.name.startsWith('mcp_'));
        } catch {
            _allTools = [];
            _localTools = [];
            _externalTools = [];
        }
    }

    // ---- 页面构建 ----
    function buildPage() {
        const tabs = [
            { key: 'mcp', label: '外部 MCP', icon: Components.icon('globe', 14), count: _mcpServers.length },
            { key: 'skills', label: '技能', icon: Components.icon('zap', 16), count: _skills.length },
            { key: 'tools', label: '工具', icon: Components.icon('wrench', 16), count: _allTools.length },
        ];

        const tabHtml = `<div class="marketplace-tabs">
            ${tabs
                .map(
                    (t) => `
                <button type="button" class="marketplace-tab ${_activeTab === t.key ? 'active' : ''}" data-action="switchTab" data-tab="${t.key}">
                    <span>${t.icon}</span>
                    <span>${t.label}</span>
                    <span class="tab-count">${t.count}</span>
                </button>
            `,
                )
                .join('')}
        </div>`;

        let contentHtml = '';
        if (_activeTab === 'mcp') contentHtml = buildMCPTab();
        else if (_activeTab === 'skills') contentHtml = buildSkillsTab();
        else if (_activeTab === 'tools') contentHtml = buildToolsTab();

        return `${tabHtml}<div class="marketplace-content">${contentHtml}</div>`;
    }

    // ---- 外部 MCP Tab ----
    function buildMCPTab() {
        const addFormHtml = `
            <div class="mp-card" style="margin-bottom:16px">
                <div style="font-weight:600;margin-bottom:12px">添加外部 MCP 服务器</div>
                <div style="display:flex;gap:8px;flex-wrap:wrap">
                    <input type="text" id="mcpServerName" placeholder="名称（如 github）" style="flex:1;min-width:120px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                    <input type="text" id="mcpServerUrl" placeholder="MCP URL（如 http://localhost:3001/mcp）" style="flex:2;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                    <input type="text" id="mcpServerPrefix" placeholder="前缀（可选，默认 mcp_{name}_）" style="flex:1;min-width:140px;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                    <button type="button" class="btn btn-primary" data-action="addMCPServer">添加</button>
                </div>
            </div>`;

        const serverListHtml =
            _mcpServers.length === 0
                ? `<div style="text-align:center;padding:40px;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:8px">${Components.icon('globe', 32)}</div>
                <div>暂无外部 MCP 服务器</div>
                <div style="font-size:12px;margin-top:4px">添加外部服务器后，其工具将自动聚合到工具列表</div>
              </div>`
                : `<div class="mp-server-list">
                ${_mcpServers
                    .map(
                        (s) => `
                    <div class="mp-server-card">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <div>
                                <div style="font-weight:600;font-size:14px">${Components.escapeHtml(s.name)}</div>
                                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${Components.escapeHtml(s.url)}</div>
                            </div>
                            <div style="display:flex;gap:6px;align-items:center">
                                ${Components.renderBadge(s.status === 'connected' ? '已连接' : s.status || '未知', s.status === 'connected' ? 'green' : 'orange')}
                                <span style="font-size:11px;color:var(--text-tertiary)">${s.tools_count || 0} 工具</span>
                                <button type="button" class="btn btn-sm btn-ghost" data-action="refreshMCPServer" data-name="${Components.escapeHtml(s.name)}">刷新</button>
                                <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="removeMCPServer" data-name="${Components.escapeHtml(s.name)}">删除</button>
                            </div>
                        </div>
                        ${s.prefix ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">前缀: <code style="background:var(--bg-secondary);padding:1px 4px;border-radius:var(--radius-tag)">${Components.escapeHtml(s.prefix)}</code></div>` : ''}
                        ${s.last_check ? `<div style="font-size:11px;color:var(--text-tertiary)">最后检查: ${s.last_check}</div>` : ''}
                    </div>
                `,
                    )
                    .join('')}
            </div>`;

        return addFormHtml + serverListHtml;
    }

    // ---- 技能 Tab ----
    function buildSkillsTab() {
        const addBtnHtml = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
                <div style="font-size:13px;color:var(--text-tertiary)">${_skills.length} 个技能</div>
                <button type="button" class="btn btn-primary btn-sm" data-action="createSkill">+ 创建技能</button>
            </div>`;

        const skillListHtml =
            _skills.length === 0
                ? `<div style="text-align:center;padding:40px;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:8px">${Components.icon('zap', 32)}</div>
                <div>暂无技能</div>
              </div>`
                : `<div class="mp-skill-list">
                ${_skills
                    .map(
                        (s) => `
                    <div class="mp-skill-card" data-action="viewSkill" data-name="${Components.escapeHtml(s.name)}">
                        <div style="display:flex;justify-content:space-between;align-items:start">
                            <div style="flex:1;min-width:0">
                                <div style="font-weight:600;font-size:14px">${Components.escapeHtml(s.name)}</div>
                                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.description || '无描述')}</div>
                                <div style="display:flex;gap:4px;margin-top:6px;flex-wrap:wrap">
                                    ${(s.tags || []).map((t) => `<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--bg-secondary);color:var(--text-tertiary)">${Components.escapeHtml(t)}</span>`).join('')}
                                    ${s.category ? `<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--accent-bg, var(--blue-bg));color:var(--accent)">${Components.escapeHtml(s.category)}</span>` : ''}
                                    ${s.version ? `<span style="font-size:10px;padding:1px 6px;border-radius:10px;background:var(--bg-secondary);color:var(--text-tertiary)">v${Components.escapeHtml(s.version)}</span>` : ''}
                                </div>
                            </div>
                            <div style="display:flex;gap:4px">
                                <button type="button" class="btn btn-sm btn-ghost" data-action="editSkill" data-name="${Components.escapeHtml(s.name)}">编辑</button>
                                <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteSkill" data-name="${Components.escapeHtml(s.name)}">删除</button>
                            </div>
                        </div>
                    </div>
                `,
                    )
                    .join('')}
            </div>`;

        return addBtnHtml + skillListHtml;
    }

    // ---- 工具 Tab ----
    function buildToolsTab() {
        const filterHtml = `
            <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center">
                <input type="text" id="toolSearch" placeholder="搜索工具..." style="flex:1;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                <select id="toolFilter" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;font-size:13px">
                    <option value="all">全部 (${_allTools.length})</option>
                    <option value="local">本地 (${_localTools.length})</option>
                    <option value="external">外部 (${_externalTools.length})</option>
                </select>
            </div>`;

        const toolsHtml =
            _allTools.length === 0
                ? `<div style="text-align:center;padding:40px;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:8px">${Components.icon('wrench', 32)}</div>
                <div>暂无工具</div>
              </div>`
                : `<div class="mp-tool-list">
                ${_allTools
                    .map((t) => {
                        const isExternal = t.name.startsWith('mcp_');
                        const source = isExternal ? t.description?.match(/^\[(.*?)\]/)?.[1] || '外部' : '本地';
                        const desc = t.description?.replace(/^\[.*?\]\s*/, '') || '无描述';
                        return `<div class="mp-tool-card" data-source="${isExternal ? 'external' : 'local'}" data-name="${Components.escapeHtml(t.name)}">
                        <div style="display:flex;justify-content:space-between;align-items:center">
                            <div style="flex:1;min-width:0">
                                <code style="font-size:13px;color:var(--accent)">${Components.escapeHtml(t.name)}</code>
                                <div style="font-size:12px;color:var(--text-secondary);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(desc)}</div>
                            </div>
                            ${Components.renderBadge(source, isExternal ? 'purple' : 'blue')}
                        </div>
                    </div>`;
                    })
                    .join('')}
            </div>`;

        return filterHtml + toolsHtml;
    }

    // ---- 事件绑定 ----
    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        container.addEventListener('click', async (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;

            switch (action) {
                case 'switchTab':
                    _activeTab = btn.dataset.tab;
                    container.innerHTML = buildPage();
                    bindEvents();
                    break;

                case 'addMCPServer':
                    await addMCPServer();
                    break;

                case 'removeMCPServer':
                    await removeMCPServer(btn.dataset.name);
                    break;

                case 'refreshMCPServer':
                    Components.Toast.info('正在刷新...');
                    await refreshMCPServer(btn.dataset.name);
                    break;

                case 'createSkill':
                    showSkillModal('create');
                    break;

                case 'editSkill':
                    showSkillModal('edit', btn.dataset.name);
                    break;

                case 'deleteSkill':
                    await deleteSkill(btn.dataset.name);
                    break;

                case 'viewSkill':
                    showSkillModal('view', btn.dataset.name);
                    break;
            }
        });

        // 工具搜索
        const searchInput = document.getElementById('toolSearch');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    const term = e.target.value.toLowerCase();
                    document.querySelectorAll('.mp-tool-card').forEach((card) => {
                        const name = (card.dataset.name || '').toLowerCase();
                        card.style.display = name.includes(term) ? '' : 'none';
                    });
                }, 200),
            );
        }

        // 工具过滤
        const filterSelect = document.getElementById('toolFilter');
        if (filterSelect) {
            filterSelect.addEventListener('change', (e) => {
                const val = e.target.value;
                document.querySelectorAll('.mp-tool-card').forEach((card) => {
                    if (val === 'all') {
                        card.style.display = '';
                    } else {
                        card.style.display = card.dataset.source === val ? '' : 'none';
                    }
                });
            });
        }
    }

    // ---- MCP 服务器操作 ----
    async function addMCPServer() {
        const name = document.getElementById('mcpServerName')?.value.trim();
        const url = document.getElementById('mcpServerUrl')?.value.trim();
        const prefix = document.getElementById('mcpServerPrefix')?.value.trim();
        if (!name || !url) {
            Components.Toast.error('名称和 URL 不能为空');
            return;
        }

        Components.Toast.info('正在连接...');
        try {
            const resp = await API.request('/api/mcp/servers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, url, prefix }),
            });
            Components.Toast.success(resp.message || '添加成功');
            await loadMCPServers();
            await loadTools();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`添加失败: ${err.message}`);
        }
    }

    async function removeMCPServer(name) {
        try {
            await API.request(`/api/mcp/servers/${encodeURIComponent(name)}`, { method: 'DELETE' });
            Components.Toast.success(`已移除 ${name}`);
            await loadMCPServers();
            await loadTools();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`移除失败: ${err.message}`);
        }
    }

    async function refreshMCPServer(name) {
        try {
            await API.request(`/api/mcp/servers/${encodeURIComponent(name)}/refresh`, { method: 'POST' });
            Components.Toast.success(`${name} 已刷新`);
            await loadMCPServers();
            await loadTools();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`刷新失败: ${err.message}`);
        }
    }

    // ---- 技能操作 ----
    async function deleteSkill(name) {
        try {
            await API.skills.delete(name);
            Components.Toast.success(`技能 ${name} 已删除`);
            await loadSkills();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function showSkillModal(mode, name) {
        const title = mode === 'create' ? '创建技能' : mode === 'edit' ? `编辑技能: ${name}` : `查看技能: ${name}`;
        const skill = mode !== 'create' ? _skills.find((s) => s.name === name) : null;
        const isView = mode === 'view';

        const html = `
            <div class="modal-header">
                <h3>${title}</h3>
                <button type="button" class="btn btn-ghost btn-sm" data-action="closeModal">${Components.icon('x', 14)}</button>
            </div>
            <div class="modal-body">
                ${
                    isView
                        ? `
                    <div style="margin-bottom:12px">
                        <label style="font-size:12px;color:var(--text-tertiary)">名称</label>
                        <div style="font-weight:600">${Components.escapeHtml(skill?.name || '')}</div>
                    </div>
                    <div style="margin-bottom:12px">
                        <label style="font-size:12px;color:var(--text-tertiary)">描述</label>
                        <div>${Components.escapeHtml(skill?.description || '无描述')}</div>
                    </div>
                    <div style="margin-bottom:12px">
                        <label style="font-size:12px;color:var(--text-tertiary)">标签</label>
                        <div>${(skill?.tags || []).map((t) => `<span style="display:inline-block;padding:2px 8px;margin:2px;border-radius:10px;background:var(--bg-secondary);font-size:12px">${Components.escapeHtml(t)}</span>`).join('') || '无'}</div>
                    </div>
                `
                        : `
                    <div style="margin-bottom:12px">
                        <label style="font-size:12px;color:var(--text-tertiary)">名称</label>
                        <input type="text" id="skillName" value="${Components.escapeHtml(mode === 'edit' ? name : '')}" ${mode === 'edit' ? 'readonly style="opacity:0.6"' : ''} style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;margin-top:4px">
                    </div>
                    <div style="margin-bottom:12px">
                        <label style="font-size:12px;color:var(--text-tertiary)">描述</label>
                        <input type="text" id="skillDesc" value="${Components.escapeHtml(skill?.description || '')}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;margin-top:4px">
                    </div>
                    <div style="margin-bottom:12px">
                        <label style="font-size:12px;color:var(--text-tertiary)">标签（逗号分隔）</label>
                        <input type="text" id="skillTags" value="${Components.escapeHtml((skill?.tags || []).join(', '))}" style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;margin-top:4px">
                    </div>
                `
                }
                <div>
                    <label style="font-size:12px;color:var(--text-tertiary)">内容（Markdown）</label>
                    <textarea id="skillContent" rows="12" ${isView ? 'readonly style="opacity:0.8"' : ''} style="width:100%;padding:8px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);color:var(--text);outline:none;margin-top:4px;font-family:monospace;font-size:12px;resize:vertical">${isView ? '' : Components.escapeHtml(skill?.content || '# ' + (name || '技能名称') + '\n\n技能描述')}</textarea>
                </div>
            </div>
            ${
                !isView
                    ? `
                <div class="modal-footer">
                    <button type="button" class="btn btn-ghost" data-action="closeModal">取消</button>
                    <button type="button" class="btn btn-primary" data-action="saveSkill" data-mode="${mode}" data-name="${Components.escapeHtml(name || '')}">保存</button>
                </div>
            `
                    : ''
            }
        `;

        Components.Modal.show(html);

        // 绑定 modal 事件
        const modal = document.querySelector('.modal-overlay');
        if (modal) {
            modal.addEventListener('click', async (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                if (btn.dataset.action === 'closeModal') {
                    Components.Modal.close();
                } else if (btn.dataset.action === 'saveSkill') {
                    await saveSkill(btn.dataset.mode, btn.dataset.name);
                }
            });
        }

        // 查看模式加载内容
        if (isView && name) {
            try {
                const data = await API.skills.get(name);
                const contentEl = document.getElementById('skillContent');
                if (contentEl && data) contentEl.value = typeof data === 'string' ? data : data.content || '';
            } catch (_err) {
                /* ignore */
            }
        }
    }

    async function saveSkill(mode, name) {
        const skillName = mode === 'create' ? document.getElementById('skillName')?.value.trim() : name;
        const content = document.getElementById('skillContent')?.value || '';
        const description = document.getElementById('skillDesc')?.value.trim() || '';
        const tagsStr = document.getElementById('skillTags')?.value || '';
        const tags = tagsStr
            .split(',')
            .map((t) => t.trim())
            .filter(Boolean);

        if (!skillName) {
            Components.Toast.error('名称不能为空');
            return;
        }

        try {
            if (mode === 'create') {
                await API.skills.create({ name: skillName, content, description, tags });
            } else {
                await API.skills.update(skillName, { content, description, tags });
            }
            Components.Modal.close();
            Components.Toast.success(mode === 'create' ? '技能已创建' : '技能已更新');
            await loadSkills();
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`保存失败: ${err.message}`);
        }
    }

    // ---- SSE ----
    function onSSEEvent(type, _data) {
        if (type === 'skill.created' || type === 'skill.updated' || type === 'skill.deleted') {
            loadSkills()
                .then(() => {
                    if (_activeTab === 'skills') {
                        document.getElementById('contentBody').innerHTML = buildPage();
                        bindEvents();
                    }
                })
                .catch(() => {});
        }
    }

    return { render, onSSEEvent };
})();
