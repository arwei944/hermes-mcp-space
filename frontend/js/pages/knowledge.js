/**
 * 知识库页面 — 会话/经验/记忆/技能/自动分析/Obsidian 卡片式管理
 * v5.8.0: 移除所有 inline onclick，改为 data-action 事件委托
 */

const KnowledgePage = (() => {
    let _overview = null;
    let _sessions = [];
    let _experiences = [];
    let _memory = null;
    let _skills = [];
    let _analysis = null;
    let _activeTab = 'sessions';
    let _pollTimer = null; // 保留引用，但不再使用轮询
    let _searchTerm = '';
    let _searchResults = null;
    let _obsidianConfig = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        await _loadData();

        // 加载 Obsidian 配置
        try {
            _obsidianConfig = await API.get('/api/knowledge/obsidian/config');
        } catch (_err) {
            _obsidianConfig = null;
        }

        container.innerHTML = buildPage();
        bindEvents();
        // 不再启动轮询，改由 SSE 事件驱动刷新
    }

    function stopPolling() {
        if (_pollTimer) {
            clearInterval(_pollTimer);
            _pollTimer = null;
        }
    }

    function startPolling() {
        // 已废弃：改用 SSE 事件驱动，不再定时轮询
        stopPolling();
    }

    async function _loadData() {
        try {
            const [overview, sessions, experiences, memory, skills, analysis] = await Promise.all([
                API.get('/api/knowledge/overview'),
                API.get('/api/knowledge/sessions'),
                API.get('/api/knowledge/experiences'),
                API.get('/api/knowledge/memory'),
                API.get('/api/knowledge/skills'),
                API.get('/api/knowledge/analysis'),
            ]);
            _overview = overview || {};
            _sessions = sessions || [];
            _experiences = experiences || [];
            _memory = memory || {};
            _skills = skills || [];
            _analysis = analysis || {};
        } catch (_err) {
            _overview = {};
            _sessions = [];
            _experiences = [];
            _memory = {};
            _skills = [];
            _analysis = {};
        }
    }

    function updateOverview() {
        const el = document.getElementById('kbOverview');
        if (!el || !_overview) return;
        const o = _overview;
        el.innerHTML = `
            ${buildOverviewCard(Components.icon('messageCircle', 20), '会话', o.sessions || 0, `${o.total_messages || 0} 条消息`, 'var(--blue)')}
            ${buildOverviewCard(Components.icon('lightbulb', 20), '经验', o.learning_count || 0, '从对话中提炼', 'var(--orange)')}
            ${buildOverviewCard(Components.icon('brain', 20), '记忆', `${o.memory_chars || 0} 字`, 'Agent 长期记忆', 'var(--green)')}
            ${buildOverviewCard(Components.icon('zap', 20), '技能', o.skills || 0, 'MCP 工具技能', 'var(--accent)')}
            ${buildOverviewCard(Components.icon('ghost', 20), '人格', `${o.soul_chars || 0} 字`, 'Agent 人格定义', 'var(--purple)')}
        `;
    }

    function onSSEEvent(type, _data) {
        // SSE 事件驱动刷新：替代 30 秒轮询
        const shouldRefreshOverview = [
            'mcp.tool_complete',    // 工具调用完成
            'session.message',      // 新消息
            'session.updated',      // 会话更新
            'memory.updated',       // 记忆更新
            'skill.updated',        // 技能更新
            'knowledge.updated',    // 知识库更新
        ].includes(type);

        if (shouldRefreshOverview) {
            // 防抖：500ms 内只刷新一次
            if (knowledgePage._refreshTimer) return;
            knowledgePage._refreshTimer = setTimeout(() => {
                knowledgePage._refreshTimer = null;
                _loadData().then(() => updateOverview()).catch(() => {});
            }, 500);
        }
    }

    // 防抖定时器（模块级）
    const knowledgePage = { _refreshTimer: null };

    function switchTab(tab) {
        _activeTab = tab;
        _searchTerm = '';
        _searchResults = null;
        document.getElementById('kbContent').innerHTML = buildTabContent();
        bindTabEvents();
    }

    function buildPage() {
        const o = _overview;

        const overviewHtml = `<div id="kbOverview" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
            ${buildOverviewCard(Components.icon('messageCircle', 20), '会话', o.sessions || 0, `${o.total_messages || 0} 条消息`, 'var(--blue)')}
            ${buildOverviewCard(Components.icon('lightbulb', 20), '经验', o.learning_count || 0, '从对话中提炼', 'var(--orange)')}
            ${buildOverviewCard(Components.icon('brain', 20), '记忆', `${o.memory_chars || 0} 字`, 'Agent 长期记忆', 'var(--green)')}
            ${buildOverviewCard(Components.icon('zap', 20), '技能', o.skills || 0, 'MCP 工具技能', 'var(--accent)')}
            ${buildOverviewCard(Components.icon('ghost', 20), '人格', `${o.soul_chars || 0} 字`, 'Agent 人格定义', 'var(--purple)')}
        </div>`;

        // 搜索栏
        const searchHtml = `<div style="margin-bottom:16px;display:flex;gap:8px;align-items:center">
            <div style="position:relative;flex:1">
                ${Components.icon('search', 14, 'var(--text-tertiary)', 'position:absolute;left:10px;top:50%;transform:translateY(-50%);pointer-events:none')}
                <input type="text" id="kbSearchInput" placeholder="全文搜索知识库..." value="${Components.escapeHtml(_searchTerm)}" style="width:100%;padding:8px 10px 8px 30px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
            </div>
            ${_searchTerm ? `<button type="button" class="btn btn-sm btn-ghost" data-action="clearSearch">清除</button>` : ''}
        </div>`;

        // Tab 栏
        const tabs = [
            { key: 'sessions', label: '会话记录', icon: Components.icon('messageCircle', 14), count: _sessions.length },
            { key: 'experiences', label: '经验提炼', icon: Components.icon('lightbulb', 14), count: _experiences.length },
            { key: 'memory', label: '记忆内容', icon: Components.icon('brain', 14), count: _memory.chars || 0 },
            { key: 'skills', label: '技能库', icon: Components.icon('zap', 14), count: _skills.length },
            { key: 'analysis', label: '自动分析', icon: Components.icon('microscope', 14), count: (_analysis.errors || []).length + (_analysis.patterns || []).length },
            { key: 'obsidian', label: 'Obsidian', icon: Components.icon('globe', 14), count: _obsidianConfig?.vault_path ? '✓' : '' },
        ];

        let tabsHtml = '<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:8px;flex-wrap:wrap">';
        tabs.forEach((t) => {
            const active = _activeTab === t.key;
            const bg = active ? 'var(--accent)' : 'transparent';
            const color = active ? '#fff' : 'var(--text-secondary)';
            tabsHtml += `<button type="button" class="kb-tab" data-action="switchTab" data-tab="${t.key}" style="padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:${bg};color:${color};transition:all 0.2s;display:flex;align-items:center;gap:6px">
                <span>${t.icon}</span>
                <span>${t.label}</span>
                <span style="font-size:10px;opacity:0.7">${t.count}</span>
            </button>`;
        });
        tabsHtml += '</div>';

        return `${overviewHtml}${searchHtml}${tabsHtml}<div id="kbContent">${buildTabContent()}</div>`;
    }

    function buildOverviewCard(icon, label, value, desc, color) {
        return `<div class="kb-overview-card" style="background:var(--bg-secondary);border-radius:12px;padding:16px;border-left:3px solid ${color};cursor:default;transition:transform 0.15s">
            <div style="font-size:20px;margin-bottom:4px">${icon}</div>
            <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${value}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${label}</div>
            <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">${desc}</div>
        </div>`;
    }

    function buildTabContent() {
        // 如果有搜索结果，优先显示
        if (_searchResults) {
            return buildSearchResults();
        }
        switch (_activeTab) {
            case 'sessions': return buildSessionsTab();
            case 'experiences': return buildExperiencesTab();
            case 'memory': return buildMemoryTab();
            case 'skills': return buildSkillsTab();
            case 'analysis': return buildAnalysisTab();
            case 'obsidian': return buildObsidianTab();
            default: return buildSessionsTab();
        }
    }

    // ==========================================
    // 搜索结果
    // ==========================================

    function buildSearchResults() {
        if (!_searchResults || _searchResults.total === 0) {
            return `<div style="text-align:center;color:var(--text-tertiary);padding:40px">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('search', 32)}</div>
                <div>未找到匹配结果</div>
                <div style="font-size:12px;margin-top:4px">尝试其他关键词</div>
            </div>`;
        }

        const typeLabels = { memory: '记忆', user: '用户', experience: '经验' };
        const typeColors = { memory: 'var(--green)', user: 'var(--blue)', experience: 'var(--orange)' };

        return `<div style="margin-bottom:12px;font-size:12px;color:var(--text-tertiary)">
            找到 ${_searchResults.total} 条匹配结果（显示前 ${_searchResults.results.length} 条）
        </div>
        <div style="display:flex;flex-direction:column;gap:8px">
            ${_searchResults.results
                .map(
                    (r) => `<div style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);border-left:3px solid ${typeColors[r.type] || 'var(--border)'}">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                        <span style="font-size:10px;background:${typeColors[r.type] || 'var(--border)'}20;padding:1px 6px;border-radius:var(--radius-tag);color:${typeColors[r.type] || 'var(--text-tertiary)'}">${typeLabels[r.type] || r.type}</span>
                        <span style="font-size:11px;color:var(--text-tertiary)">${Components.escapeHtml(r.file)}:${r.line}</span>
                    </div>
                    <div style="font-size:13px;color:var(--text-primary)">${Components.escapeHtml(r.content)}</div>
                </div>`,
                )
                .join('')}
        </div>`;
    }

    // ==========================================
    // Obsidian Tab
    // ==========================================

    function buildObsidianTab() {
        const config = _obsidianConfig || {};
        const vaultPath = config.vault_path || '';
        const lastSync = config.last_sync ? Components.formatDateTime(config.last_sync) : '从未同步';

        return `<div style="max-width:600px">
            <div class="mp-card" style="margin-bottom:16px">
                <h3 style="margin-bottom:12px">${Components.icon('globe', 16)} Obsidian Vault 配置</h3>
                <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">配置本地 Obsidian Vault 路径，知识库内容将同步到 Vault 中的 Hermes/ 目录。</p>
                ${Components.formGroup('Vault 路径', `<input class="form-input" id="obsidianVaultPath" placeholder="/path/to/your/vault" value="${Components.escapeHtml(vaultPath)}">`, 'Obsidian Vault 的绝对路径')}
                <div style="display:flex;gap:8px;margin-top:12px">
                    <button type="button" class="btn btn-primary" data-action="saveObsidianConfig">保存配置</button>
                    <button type="button" class="btn btn-secondary" data-action="syncObsidian" data-direction="both" ${!vaultPath ? 'disabled' : ''}>双向同步</button>
                    <button type="button" class="btn btn-ghost" data-action="syncObsidian" data-direction="export" ${!vaultPath ? 'disabled' : ''}>仅导出</button>
                    <button type="button" class="btn btn-ghost" data-action="syncObsidian" data-direction="import" ${!vaultPath ? 'disabled' : ''}>仅导入</button>
                </div>
            </div>
            <div class="mp-card">
                <h3 style="margin-bottom:12px">同步状态</h3>
                <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
                    <div style="display:flex;justify-content:space-between">
                        <span style="color:var(--text-secondary)">配置状态</span>
                        <span>${vaultPath ? '<span style="color:var(--green)">已配置</span>' : '<span style="color:var(--text-tertiary)">未配置</span>'}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between">
                        <span style="color:var(--text-secondary)">Vault 路径</span>
                        <span style="font-family:monospace;font-size:12px">${Components.escapeHtml(vaultPath || '-')}</span>
                    </div>
                    <div style="display:flex;justify-content:space-between">
                        <span style="color:var(--text-secondary)">上次同步</span>
                        <span>${lastSync}</span>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ==========================================
    // 各 Tab 内容（移除 inline 事件）
    // ==========================================

    function buildSessionsTab() {
        if (_sessions.length === 0)
            return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无会话记录</div>';

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">';
        _sessions.forEach((s) => {
            const time = Components.formatTime(s.created_at);
            const statusDot = s.status === 'active' ? Components.icon('checkCircle', 10) : Components.icon('circle', 10);
            const sourceTag = s.source ? `<span style="font-size:10px;background:var(--bg-secondary);padding:1px 6px;border-radius:var(--radius-tag);color:var(--text-tertiary)">${Components.escapeHtml(s.source)}</span>` : '';
            const modelTag = s.model && s.model !== 'unknown' ? `<span style="font-size:10px;background:var(--purple-bg);padding:1px 6px;border-radius:var(--radius-tag);color:var(--accent)">${Components.escapeHtml(s.model)}</span>` : '';
            const lastMsg = s.last_message ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(s.last_message)}">${Components.escapeHtml(s.last_message)}</div>` : '';

            html += `<div class="kb-card" style="background:var(--bg-secondary);border-radius:12px;padding:14px;border:1px solid var(--border)">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1" title="${Components.escapeHtml(s.title)}">${Components.escapeHtml(s.title || '未命名会话')}</div>
                    <span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;margin-left:8px">${time}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                    ${statusDot}${sourceTag}${modelTag}
                    <span style="font-size:10px;color:var(--text-tertiary);margin-left:auto">${s.message_count} 条消息</span>
                </div>
                ${lastMsg}
            </div>`;
        });
        html += '</div>';
        return html;
    }

    function buildExperiencesTab() {
        if (_experiences.length === 0)
            return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无经验记录<br><span style="font-size:11px">经验会在同类问题出现多次后自动提炼</span></div>';

        let html = '<div style="display:flex;flex-direction:column;gap:10px">';
        _experiences.forEach((exp, i) => {
            const content = exp.content || '';
            const lines = content.split('\n').filter((l) => l.trim());
            const title = exp.title || `经验 #${i + 1}`;
            const preview = lines.slice(0, 4).join(' ').slice(0, 150);
            const fullContent = content.slice(0, 500);

            html += `<div class="kb-card" style="background:var(--bg-secondary);border-radius:12px;padding:14px;border-left:3px solid var(--orange)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    ${Components.icon('lightbulb', 14)}
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(title)}</span>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap" title="${Components.escapeHtml(fullContent)}">${Components.escapeHtml(preview)}${fullContent.length > 150 ? '...' : ''}</div>
            </div>`;
        });
        html += '</div>';
        return html;
    }

    function buildMemoryTab() {
        const content = _memory.content || '';
        if (!content.trim())
            return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无记忆内容</div>';

        const sections = content.split('\n## ').filter((s) => s.trim());
        let html = '<div style="display:flex;flex-direction:column;gap:12px">';

        if (sections[0] && !sections[0].startsWith('## ')) {
            const first = sections.shift();
            const lines = first.split('\n').filter((l) => l.trim());
            html += `<div class="kb-card" style="background:var(--bg-secondary);border-radius:12px;padding:14px;border-left:3px solid var(--green)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    ${Components.icon('brain', 14)}
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary)">Agent 长期记忆</span>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap">${Components.escapeHtml(lines.slice(0, 8).join('\n'))}</div>
            </div>`;
        }

        sections.forEach((sec) => {
            const lines = sec.split('\n');
            const title = '## ' + (lines[0] || '').trim();
            const body = lines.slice(1).filter((l) => l.trim()).join('\n').slice(0, 300);
            html += `<div class="kb-card" style="background:var(--bg-secondary);border-radius:12px;padding:14px;border-left:3px solid var(--green)">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:6px">${Components.escapeHtml(title)}</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap">${Components.escapeHtml(body)}${body.length >= 300 ? '\n...' : ''}</div>
            </div>`;
        });

        html += '</div>';
        return html;
    }

    function buildSkillsTab() {
        if (_skills.length === 0)
            return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无技能</div>';

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
        _skills.forEach((s) => {
            const tags = (s.tags || []).map((t) => `<span style="font-size:10px;background:var(--purple-bg);padding:1px 6px;border-radius:var(--radius-tag);color:var(--accent)">${Components.escapeHtml(t)}</span>`).join('');
            const preview = (s.preview || s.description || '无描述').slice(0, 120);

            html += `<div class="kb-card" style="background:var(--bg-secondary);border-radius:12px;padding:14px;border:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    ${Components.icon('zap', 14)}
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(s.name)}</span>
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${tags}</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.5;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${Components.escapeHtml(preview)}</div>
            </div>`;
        });
        html += '</div>';
        return html;
    }

    function buildAnalysisTab() {
        const a = _analysis || {};
        const errors = a.errors || [];
        const patterns = a.patterns || [];
        const prefs = a.preferences || [];
        const suggestions = a.skill_suggestions || [];

        let html = '';

        html += `<div style="margin-bottom:16px;display:flex;gap:8px">
            <button type="button" class="btn btn-primary" data-action="runAutoLearn">${Components.icon('brain', 14)} 执行全量学习（写入文件）</button>
            <span style="font-size:11px;color:var(--text-tertiary);display:flex;align-items:center">自动分析当前数据，将结果写入 learnings.md 和 MEMORY.md</span>
        </div>`;

        // 错误模式
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('alertCircle', 14)} 错误模式 (${errors.length})</div>`;
        if (errors.length === 0) {
            html += `<div style="font-size:12px;color:var(--green);padding:8px">${Components.icon('check', 12)} 没有检测到错误模式</div>`;
        } else {
            errors.slice(0, 8).forEach((e) => {
                const statusColor = e.is_fixed ? 'var(--green)' : 'var(--red)';
                const statusText = e.is_fixed ? Components.icon('check', 10) + ' 已修复' : Components.icon('alertTriangle', 10) + ' 未修复';
                const severityColor = e.severity === 'high' ? 'var(--red)' : e.severity === 'medium' ? 'var(--orange)' : 'var(--text-tertiary)';
                html += `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;border-left:3px solid ${statusColor}">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(e.tool)}</span>
                        <div style="display:flex;gap:8px;align-items:center">
                            <span style="font-size:10px;color:${severityColor};background:${severityColor}15;padding:2px 6px;border-radius:var(--radius-tag)">${e.severity}</span>
                            <span style="font-size:10px;color:${statusColor}">${statusText}</span>
                            <span style="font-size:10px;color:var(--text-tertiary)">${e.count}次</span>
                        </div>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">${Components.escapeHtml(e.error_type)}</div>
                    <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(e.latest_err)}">${Components.escapeHtml(e.latest_err)}</div>
                </div>`;
            });
        }
        html += '</div>';

        // 最佳实践
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('checkCircle', 14)} 最佳实践 (${patterns.length})</div>`;
        if (patterns.length === 0) {
            html += '<div style="font-size:12px;color:var(--text-tertiary);padding:8px">暂无足够数据</div>';
        } else {
            patterns.slice(0, 5).forEach((p) => {
                html += `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;border-left:3px solid var(--green)">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px">
                        <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(p.tool)}</span>
                        <span style="font-size:10px;color:var(--green)">${p.success_rate}% 成功 · ${p.avg_latency_ms}ms</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">${Components.escapeHtml(p.recommendation)}</div>
                </div>`;
            });
        }
        html += '</div>';

        // 用户偏好
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('chart', 14)} 用户偏好 (${prefs.length})</div>`;
        if (prefs.length === 0) {
            html += '<div style="font-size:12px;color:var(--text-tertiary);padding:8px">暂无足够数据</div>';
        } else {
            prefs.forEach((p) => {
                const confColor = p.confidence === 'high' ? 'var(--green)' : p.confidence === 'medium' ? 'var(--orange)' : 'var(--text-tertiary)';
                html += `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;border-left:3px solid var(--blue)">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                        <span style="font-size:12px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(p.category)}</span>
                        <span style="font-size:10px;color:${confColor};background:${confColor}15;padding:1px 5px;border-radius:var(--radius-tag)">${p.confidence}</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">${Components.escapeHtml(p.content)}</div>
                </div>`;
            });
        }
        html += '</div>';

        // 技能建议
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('lightbulb', 14)} 技能建议 (${suggestions.length})</div>`;
        if (suggestions.length === 0) {
            html += '<div style="font-size:12px;color:var(--text-tertiary);padding:8px">暂无建议</div>';
        } else {
            suggestions.slice(0, 5).forEach((s) => {
                const typeLabel = s.type === 'composite' ? '复合技能' : '快捷封装';
                html += `<div style="background:var(--bg-secondary);border-radius:var(--radius-sm);padding:12px;margin-bottom:8px;border-left:3px solid var(--purple)">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                        <span style="font-size:12px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(s.name)}</span>
                        <span style="font-size:10px;background:var(--purple-bg);padding:1px 5px;border-radius:var(--radius-tag);color:var(--purple)">${typeLabel}</span>
                        <span style="font-size:10px;color:var(--text-tertiary);margin-left:auto">${s.frequency}次</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-secondary)">${Components.escapeHtml(s.description)}</div>
                </div>`;
            });
        }
        html += '</div>';

        return html;
    }

    // ==========================================
    // 操作函数
    // ==========================================

    async function runAutoLearn() {
        try {
            const result = await API.get('/api/knowledge/auto-learn');
            const msg = `学习完成！错误:${result.errors_found} 模式:${result.patterns_found} 偏好:${result.preferences_found} 建议:${result.skills_suggested}`;
            Components.Toast.success(msg);
            await render();
        } catch (err) {
            Components.Toast.error('学习失败: ' + (err.message || '未知错误'));
        }
    }

    async function saveObsidianConfig() {
        const vaultPath = document.getElementById('obsidianVaultPath')?.value.trim() || '';
        try {
            await API.request('/api/knowledge/obsidian/config', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ vault_path: vaultPath, auto_sync: false }),
            });
            _obsidianConfig = { vault_path: vaultPath, auto_sync: false, last_sync: null };
            Components.Toast.success('Obsidian 配置已保存');
            document.getElementById('kbContent').innerHTML = buildTabContent();
            bindTabEvents();
        } catch (err) {
            Components.Toast.error('保存失败: ' + err.message);
        }
    }

    async function syncObsidian(direction) {
        const dir = direction || 'both';
        const dirLabel = { export: '导出到 Obsidian', import: '从 Obsidian 导入', both: '双向同步' }[dir] || '同步';
        Components.Toast.info(`正在${dirLabel}...`);
        try {
            const result = await API.post(`/api/knowledge/obsidian/sync?direction=${dir}`);
            if (result.success) {
                Components.Toast.success(`${dirLabel}完成：${result.message}`);
                _obsidianConfig = await API.get('/api/knowledge/obsidian/config');
                document.getElementById('kbContent').innerHTML = buildTabContent();
                bindTabEvents();
            } else {
                Components.Toast.error(result.message);
            }
        } catch (err) {
            Components.Toast.error(`${dirLabel}失败: ` + err.message);
        }
    }

    async function performSearch(term) {
        if (!term.trim()) {
            _searchResults = null;
            document.getElementById('kbContent').innerHTML = buildTabContent();
            bindTabEvents();
            return;
        }
        try {
            _searchResults = await API.get('/api/knowledge/search', { q: term, type: 'all' });
            document.getElementById('kbContent').innerHTML = buildTabContent();
            bindTabEvents();
        } catch (err) {
            Components.Toast.error('搜索失败: ' + err.message);
        }
    }

    // ==========================================
    // 事件绑定
    // ==========================================

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        // 全局事件委托
        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            switch (action) {
                case 'switchTab':
                    switchTab(btn.dataset.tab);
                    break;
                case 'runAutoLearn':
                    runAutoLearn();
                    break;
                case 'saveObsidianConfig':
                    saveObsidianConfig();
                    break;
                case 'syncObsidian':
                    syncObsidian(btn.dataset.direction || 'both');
                    break;
                case 'clearSearch':
                    _searchTerm = '';
                    _searchResults = null;
                    const searchInput = document.getElementById('kbSearchInput');
                    if (searchInput) searchInput.value = '';
                    document.getElementById('kbContent').innerHTML = buildTabContent();
                    bindTabEvents();
                    break;
            }
        });

        // 搜索输入
        const searchInput = document.getElementById('kbSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    _searchTerm = searchInput.value;
                    performSearch(_searchTerm);
                }
            });
        }

        // 卡片 hover 效果（CSS 替代方案）
        container.querySelectorAll('.kb-card, .kb-overview-card').forEach((card) => {
            card.addEventListener('mouseenter', () => { card.style.transform = 'translateY(-2px)'; });
            card.addEventListener('mouseleave', () => { card.style.transform = ''; });
        });

        bindTabEvents();
    }

    function bindTabEvents() {
        // Tab 内容区域的事件委托
        const kbContent = document.getElementById('kbContent');
        if (!kbContent) return;

        kbContent.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            switch (action) {
                case 'runAutoLearn':
                    runAutoLearn();
                    break;
                case 'saveObsidianConfig':
                    saveObsidianConfig();
                    break;
                case 'syncObsidian':
                    syncObsidian();
                    break;
            }
        });
    }

    return { render, switchTab, runAutoLearn, onSSEEvent };
})();
