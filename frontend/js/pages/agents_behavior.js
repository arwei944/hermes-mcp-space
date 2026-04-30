/**
 * Agent 行为管理页面 -- 人格定义 / 行为日志 / 行为统计
 * v1.0.0: IIFE 模块，data-action 事件委托，无 inline onclick
 */

const AgentsBehaviorPage = (() => {
    // ==========================================
    // 私有状态
    // ==========================================
    let _soulContent = '';
    let _originalSoulContent = '';
    let _activeTab = 'personality';
    let _behaviorLog = [];
    let _ranking = [];
    let _analysis = null;
    let _isSaving = false;
    let _isDirty = false;

    // AGENTS.md 默认模板
    const DEFAULT_TEMPLATE = `# Agent 人格定义 (AGENTS.md)

## 身份与角色
你是一个智能助手，负责帮助用户完成各种任务。

## 性格特征
- 语气：友好、专业、耐心
- 风格：简洁明了，避免冗余
- 态度：积极主动，乐于助人

## 行为规则
1. 回答问题时优先使用准确、可靠的信息
2. 遇到不确定的问题时主动说明
3. 保持对话连贯性，理解上下文
4. 合理使用工具完成任务
5. 对复杂任务进行分解，逐步完成

## 禁止行为
- 不要编造不存在的信息
- 不要执行可能造成损害的操作
- 不要泄露敏感信息

## 偏好设置
- 语言：中文（默认）
- 代码风格：遵循项目现有规范
- 输出格式：Markdown 优先
`;

    // ==========================================
    // 生命周期
    // ==========================================

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            await _loadData();
        } catch (_err) {
            // 静默处理，使用默认值
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function onSSEEvent(type, data) {
        if (type === 'mcp.tool_call' || type === 'mcp.tool_complete') {
            const entry = {
                type: type,
                timestamp: new Date().toISOString(),
                tool: data?.tool || data?.name || 'unknown',
                args: data?.args || data?.arguments || {},
                success: type === 'mcp.tool_complete',
                duration: data?.duration_ms || data?.ms || 0,
                detail: data?.detail || data?.result || '',
            };
            _behaviorLog.unshift(entry);
            // 最多保留 200 条
            if (_behaviorLog.length > 200) {
                _behaviorLog = _behaviorLog.slice(0, 200);
            }
            // 如果当前在行为日志 tab，增量更新
            if (_activeTab === 'log') {
                updateBehaviorLog();
            }
        }
        if (type === 'mcp.tool_complete') {
            // 刷新统计
            _loadRanking();
            _loadAnalysis();
        }
    }

    // ==========================================
    // 数据加载
    // ==========================================

    async function _loadData() {
        const [soulResult, ranking, analysis] = await Promise.all([
            API.get('/api/knowledge/soul').catch(() => null),
            API.get('/api/dashboard/ranking').catch(() => []),
            API.get('/api/knowledge/analysis').catch(() => null),
        ]);

        _soulContent = (soulResult && typeof soulResult === 'object' ? soulResult.content : soulResult) || '';
        _originalSoulContent = _soulContent;
        _ranking = ranking || [];
        _analysis = analysis || null;
    }

    function _loadRanking() {
        API.get('/api/dashboard/ranking')
            .then((data) => {
                _ranking = data || [];
                if (_activeTab === 'stats') {
                    updateStatsTab();
                }
            })
            .catch(() => {});
    }

    function _loadAnalysis() {
        API.get('/api/knowledge/analysis')
            .then((data) => {
                _analysis = data || null;
                if (_activeTab === 'stats') {
                    updateStatsTab();
                }
            })
            .catch(() => {});
    }

    // ==========================================
    // 页面构建
    // ==========================================

    function buildPage() {
        const tabs = [
            { key: 'personality', label: '人格定义', icon: Components.icon('ghost', 14) },
            { key: 'log', label: '行为日志', icon: Components.icon('activity', 14), count: _behaviorLog.length },
            { key: 'stats', label: '行为统计', icon: Components.icon('barChart', 14) },
        ];

        let tabsHtml = '<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:8px;flex-wrap:wrap">';
        tabs.forEach((t) => {
            const active = _activeTab === t.key;
            const bg = active ? 'var(--accent)' : 'transparent';
            const color = active ? '#fff' : 'var(--text-secondary)';
            const countBadge = t.count !== undefined ? `<span style="font-size:10px;opacity:0.7">${t.count}</span>` : '';
            tabsHtml += `<button type="button" class="ab-tab" data-action="switchTab" data-tab="${t.key}" style="padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:${bg};color:${color};transition:all 0.2s;display:flex;align-items:center;gap:6px">
                <span>${t.icon}</span>
                <span>${t.label}</span>
                ${countBadge}
            </button>`;
        });
        tabsHtml += '</div>';

        return `${tabsHtml}<div id="abContent">${buildTabContent()}</div>`;
    }

    function buildTabContent() {
        switch (_activeTab) {
            case 'personality':
                return buildPersonalityTab();
            case 'log':
                return buildLogTab();
            case 'stats':
                return buildStatsTab();
            default:
                return buildPersonalityTab();
        }
    }

    // ==========================================
    // Tab 1: 人格定义
    // ==========================================

    function buildPersonalityTab() {
        const charCount = _soulContent.length;
        const lineCount = _soulContent ? _soulContent.split('\n').length : 0;
        const dirtyIndicator = _isDirty ? '<span style="color:var(--orange);font-size:11px;margin-left:8px">* 未保存</span>' : '';

        return `<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${Components.icon('ghost', 16)} AGENTS.md 人格定义</span>
                ${dirtyIndicator}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:11px;color:var(--text-tertiary)">${charCount} 字符 / ${lineCount} 行</span>
                <button type="button" class="btn btn-sm btn-ghost" data-action="fillTemplate">${Components.icon('clipboard', 12)} 填充模板</button>
                <button type="button" class="btn btn-sm btn-primary" data-action="saveSoul" ${_isSaving ? 'disabled' : ''}>${Components.icon('save', 12)} 保存</button>
            </div>
        </div>
        <div id="abEditorPane" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;height:calc(100vh - 260px);min-height:400px">
            <div style="display:flex;flex-direction:column;overflow:hidden">
                <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;display:flex;align-items:center;gap:4px">
                    ${Components.icon('edit', 12)} 编辑器 <span style="margin-left:auto;font-size:10px;color:var(--text-tertiary)">Ctrl+S 保存</span>
                </div>
                <textarea id="abSoulEditor" style="flex:1;width:100%;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:'SF Mono',Menlo,monospace;font-size:13px;line-height:1.6;resize:none;outline:none;tab-size:4">${Components.escapeHtml(_soulContent)}</textarea>
            </div>
            <div style="display:flex;flex-direction:column;overflow:hidden">
                <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;display:flex;align-items:center;gap:4px">
                    ${Components.icon('eye', 12)} Markdown 预览
                </div>
                <div id="abSoulPreview" style="flex:1;overflow-y:auto;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-secondary);font-size:13px;line-height:1.7;color:var(--text-primary)">
                    ${Components.renderMarkdown(_soulContent)}
                </div>
            </div>
        </div>`;
    }

    // ==========================================
    // Tab 2: 行为日志
    // ==========================================

    function buildLogTab() {
        const logHtml = buildBehaviorLogList();
        return `<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${Components.icon('activity', 16)} 行为日志</span>
            <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:11px;color:var(--text-tertiary)">${_behaviorLog.length} 条记录（实时 SSE）</span>
                <button type="button" class="btn btn-sm btn-ghost" data-action="clearLog">${Components.icon('trash', 12)} 清空</button>
            </div>
        </div>
        <div id="abBehaviorLog" style="max-height:calc(100vh - 260px);overflow-y:auto;display:flex;flex-direction:column;gap:4px">
            ${logHtml}
        </div>`;
    }

    function buildBehaviorLogList() {
        if (_behaviorLog.length === 0) {
            return `<div style="text-align:center;color:var(--text-tertiary);padding:40px">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('activity', 32)}</div>
                <div>暂无行为日志</div>
                <div style="font-size:12px;margin-top:4px">Agent 的工具调用和行为事件将通过 SSE 实时推送</div>
            </div>`;
        }

        return _behaviorLog
            .slice(0, 100)
            .map((entry, i) => {
                const isSuccess = entry.success;
                const icon = isSuccess ? Components.icon('check', 14) : Components.icon('x', 14);
                const iconColor = isSuccess ? 'var(--green)' : 'var(--red)';
                const borderColor = isSuccess ? 'var(--green)' : 'var(--orange)';
                const time = Components.formatDateTime(entry.timestamp);
                const toolName = entry.tool || 'unknown';
                const argsSummary = _summarizeArgs(entry.args);
                const durationStr = entry.duration ? `${entry.duration}ms` : '';

                return `<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;font-size:12px;border-left:3px solid ${borderColor};background:var(--bg-secondary);transition:background 0.15s" onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='var(--bg-secondary)'">
                    <span style="color:${iconColor};font-weight:700;font-size:14px;flex-shrink:0;width:16px;text-align:center">${icon}</span>
                    <span style="color:var(--text-primary);font-weight:500;flex-shrink:0;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(toolName)}">${Components.escapeHtml(toolName)}</span>
                    <span style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(argsSummary)}">${Components.escapeHtml(argsSummary)}</span>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0">${durationStr}</span>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0;min-width:60px;text-align:right">${time}</span>
                </div>`;
            })
            .join('');
    }

    function _summarizeArgs(args) {
        if (!args || typeof args !== 'object') return '';
        try {
            const str = JSON.stringify(args);
            if (str.length > 120) return str.slice(0, 120) + '...';
            return str;
        } catch (_e) {
            return String(args);
        }
    }

    // ==========================================
    // Tab 3: 行为统计
    // ==========================================

    function buildStatsTab() {
        const rankingHtml = buildRankingSection();
        const analysisHtml = buildAnalysisSection();
        const logStatsHtml = buildLogStatsSection();

        return `<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px">
            <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${Components.icon('barChart', 16)} 行为统计</span>
            <button type="button" class="btn btn-sm btn-ghost" data-action="refreshStats" style="margin-left:auto">${Components.icon('refresh', 12)} 刷新</button>
        </div>
        ${logStatsHtml}
        <div style="margin-top:16px">
            ${rankingHtml}
        </div>
        <div style="margin-top:16px">
            ${analysisHtml}
        </div>`;
    }

    function buildLogStatsSection() {
        const total = _behaviorLog.length;
        const successCount = _behaviorLog.filter((e) => e.success).length;
        const failCount = total - successCount;
        const successRate = total > 0 ? ((successCount / total) * 100).toFixed(1) : '0.0';
        const avgDuration = total > 0 ? Math.round(_behaviorLog.reduce((sum, e) => sum + (e.duration || 0), 0) / total) : 0;

        // 工具调用频率统计
        const toolFreq = {};
        _behaviorLog.forEach((e) => {
            const t = e.tool || 'unknown';
            toolFreq[t] = (toolFreq[t] || 0) + 1;
        });
        const topTools = Object.entries(toolFreq)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        let topToolsHtml = '';
        if (topTools.length > 0) {
            topToolsHtml = '<div style="margin-top:12px"><div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">最近行为 Top 工具</div>';
            topTools.forEach(([tool, count]) => {
                const pct = ((count / total) * 100).toFixed(1);
                topToolsHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span style="width:140px;font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0" title="${Components.escapeHtml(tool)}">${Components.escapeHtml(tool)}</span>
                    <div style="flex:1;height:14px;background:var(--bg-secondary);border-radius:var(--radius-sm);overflow:hidden">
                        <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:var(--radius-sm);transition:width 0.6s ease"></div>
                    </div>
                    <span style="width:40px;text-align:right;font-size:11px;color:var(--text-primary);font-weight:600;flex-shrink:0">${count}</span>
                </div>`;
            });
            topToolsHtml += '</div>';
        }

        return `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px">
            ${_buildStatCard(Components.icon('activity', 20), '行为事件', total, 'SSE 实时推送', 'var(--blue)')}
            ${_buildStatCard(Components.icon('check', 20), '成功', successCount, `成功率 ${successRate}%`, 'var(--green)')}
            ${_buildStatCard(Components.icon('x', 20), '失败', failCount, total > 0 ? `${((failCount / total) * 100).toFixed(1)}%` : '-', 'var(--red)')}
            ${_buildStatCard(Components.icon('zap', 20), '平均耗时', `${avgDuration}ms`, '工具调用延迟', 'var(--orange)')}
        </div>
        ${topToolsHtml}`;
    }

    function _buildStatCard(icon, label, value, desc, color) {
        return `<div style="background:var(--bg-secondary);border-radius:12px;padding:16px;border-left:3px solid ${color};cursor:default;transition:transform 0.15s">
            <div style="font-size:20px;margin-bottom:4px">${icon}</div>
            <div style="font-size:20px;font-weight:700;color:var(--text-primary)">${value}</div>
            <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${label}</div>
            <div style="font-size:10px;color:var(--text-tertiary);margin-top:2px">${desc}</div>
        </div>`;
    }

    function buildRankingSection() {
        if (!_ranking || _ranking.length === 0) {
            return Components.renderSection('工具调用排行', '<div style="text-align:center;color:var(--text-tertiary);padding:20px">暂无排行数据</div>');
        }

        const maxVal = Math.max(..._ranking.map((d) => d.total_calls || 0), 1);
        const items = _ranking.slice(0, 10);

        let barsHtml = '';
        items.forEach((d) => {
            const calls = d.total_calls || 0;
            const pct = ((calls / maxVal) * 100).toFixed(1);
            const rate = d.success_rate || 0;
            const rateColor = rate >= 90 ? 'var(--green)' : rate >= 70 ? 'var(--orange)' : 'var(--red)';
            barsHtml += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                <div style="width:140px;font-size:11px;color:var(--text-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0" title="${Components.escapeHtml(d.tool)}">${Components.escapeHtml(d.tool)}</div>
                <div style="flex:1;height:18px;background:var(--bg-secondary);border-radius:var(--radius-sm);overflow:hidden;position:relative">
                    <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--purple));border-radius:var(--radius-sm);transition:width 0.6s ease"></div>
                </div>
                <div style="width:50px;text-align:right;font-size:11px;color:var(--text-primary);font-weight:600;flex-shrink:0">${calls}</div>
                <div style="width:40px;text-align:right;font-size:10px;color:${rateColor};flex-shrink:0">${rate}%</div>
            </div>`;
        });

        return Components.renderSection(
            '工具调用排行',
            `<div style="display:flex;gap:12px;margin-bottom:8px;font-size:10px;color:var(--text-tertiary)">
                <span style="width:140px">工具名</span>
                <span style="flex:1">调用频次</span>
                <span style="width:50px;text-align:right">次数</span>
                <span style="width:40px;text-align:right">成功率</span>
            </div>
            ${barsHtml}`,
        );
    }

    function buildAnalysisSection() {
        const a = _analysis || {};
        const errors = a.errors || [];
        const patterns = a.patterns || [];
        const prefs = a.preferences || [];

        let html = '';

        // 错误模式
        html += `<div style="margin-bottom:20px">
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('alertTriangle', 14)} 错误模式 (${errors.length})</div>`;
        if (errors.length === 0) {
            html += `<div style="font-size:12px;color:var(--green);padding:8px">${Components.icon('check', 12)} 没有检测到错误模式</div>`;
        } else {
            errors.slice(0, 6).forEach((e) => {
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
                    <div style="font-size:10px;color:var(--text-tertiary);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(e.latest_err || '')}">${Components.escapeHtml(e.latest_err || '')}</div>
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
            <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:10px">${Components.icon('brain', 14)} 用户偏好 (${prefs.length})</div>`;
        if (prefs.length === 0) {
            html += '<div style="font-size:12px;color:var(--text-tertiary);padding:8px">暂无足够数据</div>';
        } else {
            prefs.slice(0, 5).forEach((p) => {
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

        return Components.renderSection('行为分析', html);
    }

    // ==========================================
    // 增量更新
    // ==========================================

    function updateBehaviorLog() {
        const el = document.getElementById('abBehaviorLog');
        if (!el) return;
        el.innerHTML = buildBehaviorLogList();
    }

    function updateStatsTab() {
        const el = document.getElementById('abContent');
        if (!el || _activeTab !== 'stats') return;
        el.innerHTML = buildStatsTab();
        bindTabEvents();
    }

    // ==========================================
    // 操作函数
    // ==========================================

    function switchTab(tab) {
        _activeTab = tab;
        const el = document.getElementById('abContent');
        if (!el) return;
        el.innerHTML = buildTabContent();
        bindTabEvents();
        // 更新 tab 按钮样式
        document.querySelectorAll('.ab-tab').forEach((btn) => {
            const isActive = btn.dataset.tab === tab;
            btn.style.background = isActive ? 'var(--accent)' : 'transparent';
            btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
        });
    }

    async function saveSoul() {
        if (_isSaving) return;
        const editor = document.getElementById('abSoulEditor');
        if (!editor) return;

        const content = editor.value;
        if (!content.trim()) {
            Components.Toast.warning('内容不能为空');
            return;
        }

        _isSaving = true;
        try {
            await API.post('/api/knowledge/soul', { content: content });
            _soulContent = content;
            _originalSoulContent = content;
            _isDirty = false;
            Components.Toast.success('人格定义已保存');
            // 更新预览
            const preview = document.getElementById('abSoulPreview');
            if (preview) {
                preview.innerHTML = Components.renderMarkdown(content);
            }
            // 更新 dirty indicator
            const dirtyEl = document.querySelector('#abContent [data-dirty]');
            // 简单重渲染 header 区域
            switchTab('personality');
        } catch (err) {
            Components.Toast.error('保存失败: ' + (err.message || '未知错误'));
        } finally {
            _isSaving = false;
        }
    }

    async function fillTemplate() {
        if (_soulContent.trim() && _isDirty) {
            const confirmed = await Components.Modal.confirm({
                title: '填充模板',
                message: '当前编辑器有未保存的内容，填充模板将覆盖现有内容。是否继续？',
                confirmText: '覆盖',
                cancelText: '取消',
                type: 'warning',
            });
            if (!confirmed) return;
        }
        const editor = document.getElementById('abSoulEditor');
        if (!editor) return;
        editor.value = DEFAULT_TEMPLATE;
        _soulContent = DEFAULT_TEMPLATE;
        _isDirty = true;
        // 更新预览
        const preview = document.getElementById('abSoulPreview');
        if (preview) {
            preview.innerHTML = Components.renderMarkdown(DEFAULT_TEMPLATE);
        }
        // 更新字符统计和 dirty indicator
        switchTab('personality');
        Components.Toast.info('已填充默认模板，请根据需要修改');
    }

    function clearLog() {
        Components.Modal.confirm({
            title: '清空日志',
            message: '确定要清空所有行为日志记录吗？此操作不可撤销。',
            confirmText: '清空',
            cancelText: '取消',
            type: 'danger',
        }).then((confirmed) => {
            if (confirmed) {
                _behaviorLog = [];
                updateBehaviorLog();
                Components.Toast.success('日志已清空');
            }
        });
    }

    function refreshStats() {
        Components.Toast.info('正在刷新统计数据...');
        _loadRanking();
        _loadAnalysis();
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
                case 'saveSoul':
                    saveSoul();
                    break;
                case 'fillTemplate':
                    fillTemplate();
                    break;
                case 'clearLog':
                    clearLog();
                    break;
                case 'refreshStats':
                    refreshStats();
                    break;
            }
        });

        // Ctrl+S 快捷键
        container.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (_activeTab === 'personality') {
                    saveSoul();
                }
            }
        });

        // 编辑器输入事件（实时预览 + dirty 标记）
        const editor = document.getElementById('abSoulEditor');
        if (editor) {
            const debouncedPreview = Components.debounce(() => {
                const preview = document.getElementById('abSoulPreview');
                if (preview) {
                    preview.innerHTML = Components.renderMarkdown(editor.value);
                }
            }, 300);

            editor.addEventListener('input', () => {
                _soulContent = editor.value;
                _isDirty = _soulContent !== _originalSoulContent;
                debouncedPreview();
            });
        }

        bindTabEvents();
    }

    function bindTabEvents() {
        const tabContent = document.getElementById('abContent');
        if (!tabContent) return;

        tabContent.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            switch (action) {
                case 'saveSoul':
                    saveSoul();
                    break;
                case 'fillTemplate':
                    fillTemplate();
                    break;
                case 'clearLog':
                    clearLog();
                    break;
                case 'refreshStats':
                    refreshStats();
                    break;
            }
        });
    }

    return { render, onSSEEvent };
})();
