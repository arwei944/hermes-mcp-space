/**
 * 知识库页面 — 会话/经验/记忆/技能 卡片式管理
 */

const KnowledgePage = (() => {
    let _overview = null;
    let _sessions = [];
    let _experiences = [];
    let _memory = null;
    let _skills = [];
    let _activeTab = 'sessions';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const [overview, sessions, experiences, memory, skills] = await Promise.all([
                API.get('/api/knowledge/overview'),
                API.get('/api/knowledge/sessions'),
                API.get('/api/knowledge/experiences'),
                API.get('/api/knowledge/memory'),
                API.get('/api/knowledge/skills'),
            ]);
            _overview = overview || {};
            _sessions = sessions || [];
            _experiences = experiences || [];
            _memory = memory || {};
            _skills = skills || [];
        } catch (err) {
            _overview = {}; _sessions = []; _experiences = []; _memory = {}; _skills = [];
        }

        container.innerHTML = buildPage();
    }

    function switchTab(tab) {
        _activeTab = tab;
        document.getElementById('kbContent').innerHTML = buildTabContent();
    }

    function buildPage() {
        const o = _overview;

        // 概览统计卡片
        const overviewHtml = `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;margin-bottom:20px">
            ${buildOverviewCard('💬', '会话', o.sessions || 0, `${o.total_messages || 0} 条消息`, 'var(--blue)')}
            ${buildOverviewCard('💡', '经验', o.learning_count || 0, '从对话中提炼', 'var(--orange)')}
            ${buildOverviewCard('🧠', '记忆', `${o.memory_chars || 0} 字`, 'Agent 长期记忆', 'var(--green)')}
            ${buildOverviewCard('⚡', '技能', o.skills || 0, 'MCP 工具技能', 'var(--accent)')}
            ${buildOverviewCard('👻', '人格', `${o.soul_chars || 0} 字`, 'Agent 人格定义', 'var(--purple)')}
        </div>`;

        // Tab 栏
        const tabs = [
            { key: 'sessions', label: '会话记录', icon: '💬', count: _sessions.length },
            { key: 'experiences', label: '经验提炼', icon: '💡', count: _experiences.length },
            { key: 'memory', label: '记忆内容', icon: '🧠', count: _memory.chars || 0 },
            { key: 'skills', label: '技能库', icon: '⚡', count: _skills.length },
        ];

        let tabsHtml = '<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:8px">';
        tabs.forEach(t => {
            const active = _activeTab === t.key;
            const bg = active ? 'var(--accent)' : 'transparent';
            const color = active ? '#fff' : 'var(--text-secondary)';
            tabsHtml += `<button onclick="KnowledgePage.switchTab('${t.key}')" style="padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:${bg};color:${color};transition:all 0.2s;display:flex;align-items:center;gap:6px">
                <span>${t.icon}</span>
                <span>${t.label}</span>
                <span style="font-size:10px;opacity:0.7">${t.count}</span>
            </button>`;
        });
        tabsHtml += '</div>';

        return `${overviewHtml}${tabsHtml}<div id="kbContent">${buildTabContent()}</div>`;
    }

    function buildOverviewCard(icon, label, value, desc, color) {
        return `<div style="background:var(--bg-secondary);border-radius:12px;padding:16px;border-left:3px solid ${color};cursor:default;transition:transform 0.15s" onmouseover="this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='translateY(0)'">
            <div style="font-size:20px;margin-bottom:4px">${icon}</div>
            <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${value}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${label}</div>
            <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">${desc}</div>
        </div>`;
    }

    function buildTabContent() {
        switch (_activeTab) {
            case 'sessions': return buildSessionsTab();
            case 'experiences': return buildExperiencesTab();
            case 'memory': return buildMemoryTab();
            case 'skills': return buildSkillsTab();
            default: return buildSessionsTab();
        }
    }

    function buildSessionsTab() {
        if (_sessions.length === 0) return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无会话记录</div>';

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">';
        _sessions.forEach(s => {
            const time = Components.formatTime(s.created_at);
            const statusColor = s.status === 'active' ? 'var(--green)' : 'var(--text-tertiary)';
            const statusDot = s.status === 'active' ? '🟢' : '⚪';
            const sourceTag = s.source ? `<span style="font-size:9px;background:var(--bg-secondary);padding:1px 6px;border-radius:4px;color:var(--text-tertiary)">${Components.escapeHtml(s.source)}</span>` : '';
            const modelTag = s.model && s.model !== 'unknown' ? `<span style="font-size:9px;background:rgba(99,102,241,0.1);padding:1px 6px;border-radius:4px;color:var(--accent)">${Components.escapeHtml(s.model)}</span>` : '';
            const lastMsg = s.last_message ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(s.last_message)}">${Components.escapeHtml(s.last_message)}</div>` : '';

            html += `<div style="background:var(--bg-secondary);border-radius:12px;padding:14px;cursor:default;transition:transform 0.15s,box-shadow 0.15s;border:1px solid var(--border)" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
                    <div style="font-size:13px;font-weight:600;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1" title="${Components.escapeHtml(s.title)}">${Components.escapeHtml(s.title || '未命名会话')}</div>
                    <span style="font-size:10px;color:var(--text-tertiary);flex-shrink:0;margin-left:8px">${time}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                    ${statusDot}
                    ${sourceTag}
                    ${modelTag}
                    <span style="font-size:10px;color:var(--text-tertiary);margin-left:auto">${s.message_count} 条消息</span>
                </div>
                ${lastMsg}
            </div>`;
        });
        html += '</div>';
        return html;
    }

    function buildExperiencesTab() {
        if (_experiences.length === 0) return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无经验记录<br><span style="font-size:11px">经验会在同类问题出现多次后自动提炼</span></div>';

        let html = '<div style="display:flex;flex-direction:column;gap:10px">';
        _experiences.forEach((exp, i) => {
            const content = exp.content || '';
            const lines = content.split("\n").filter(l => l.trim());
            // 提取关键信息
            const title = exp.title || `经验 #${i + 1}`;
            const preview = lines.slice(0, 4).join(" ").slice(0, 150);
            const fullContent = content.slice(0, 500);

            html += `<div style="background:var(--bg-secondary);border-radius:12px;padding:14px;border-left:3px solid var(--orange);cursor:default;transition:transform 0.15s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span style="font-size:14px">💡</span>
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
        if (!content.trim()) return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无记忆内容</div>';

        // 将 Markdown 内容分段展示为卡片
        const sections = content.split("\n## ").filter(s => s.trim());
        let html = '<div style="display:flex;flex-direction:column;gap:12px">';

        // 第一段（标题前）
        if (sections[0] && !sections[0].startsWith("## ")) {
            const first = sections.shift();
            const lines = first.split("\n").filter(l => l.trim());
            html += `<div style="background:var(--bg-secondary);border-radius:12px;padding:14px;border-left:3px solid var(--green)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span style="font-size:14px">🧠</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary)">Agent 长期记忆</span>
                </div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap">${Components.escapeHtml(lines.slice(0, 8).join("\n"))}</div>
            </div>`;
        }

        sections.forEach(sec => {
            const lines = sec.split("\n");
            const title = "## " + (lines[0] || "").trim();
            const body = lines.slice(1).filter(l => l.trim()).join("\n").slice(0, 300);
            html += `<div style="background:var(--bg-secondary);border-radius:12px;padding:14px;border-left:3px solid var(--green);cursor:default;transition:transform 0.15s" onmouseover="this.style.transform='translateY(-1px)'" onmouseout="this.style.transform=''">
                <div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:6px">${Components.escapeHtml(title)}</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.6;white-space:pre-wrap">${Components.escapeHtml(body)}${body.length >= 300 ? '\n...' : ''}</div>
            </div>`;
        });

        html += '</div>';
        return html;
    }

    function buildSkillsTab() {
        if (_skills.length === 0) return '<div style="text-align:center;color:var(--text-tertiary);padding:40px">暂无技能</div>';

        let html = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">';
        _skills.forEach(s => {
            const tags = (s.tags || []).map(t => `<span style="font-size:9px;background:rgba(99,102,241,0.1);padding:1px 6px;border-radius:4px;color:var(--accent)">${Components.escapeHtml(t)}</span>`).join('');
            const preview = (s.preview || s.description || '无描述').slice(0, 120);

            html += `<div style="background:var(--bg-secondary);border-radius:12px;padding:14px;border:1px solid var(--border);cursor:default;transition:transform 0.15s,box-shadow 0.15s" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.06)'" onmouseout="this.style.transform='';this.style.boxShadow=''">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span style="font-size:14px">⚡</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${Components.escapeHtml(s.name)}</span>
                </div>
                <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">${tags}</div>
                <div style="font-size:11px;color:var(--text-secondary);line-height:1.5;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical">${Components.escapeHtml(preview)}</div>
            </div>`;
        });
        html += '</div>';
        return html;
    }

    return { render, switchTab };
})();
