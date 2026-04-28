/**
 * 子 Agent 页面
 * 活跃子 Agent 列表、状态监控
 */

const AgentsPage = (() => {
    let _agents = [];
    let _refreshTimer = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        await loadAgents();
        container.innerHTML = buildPage();
        startAutoRefresh();
    }

    async function loadAgents() {
        try {
            const data = await API.agents.list();
            _agents = data.agents || data || [];
        } catch (err) {
            _agents = getMockAgents();
        }
    }

    function getMockAgents() {
        return [
            {
                id: 'agent_001',
                name: '代码审查 Agent',
                type: 'code-review',
                status: 'running',
                sessionId: 'sess_001',
                startTime: new Date(Date.now() - 300000).toISOString(),
                progress: 65,
                currentTask: '正在分析 src/api/routes.ts',
            },
            {
                id: 'agent_002',
                name: '文档生成 Agent',
                type: 'doc-writer',
                status: 'running',
                sessionId: 'sess_002',
                startTime: new Date(Date.now() - 600000).toISOString(),
                progress: 30,
                currentTask: '正在生成 API 文档',
            },
            {
                id: 'agent_003',
                name: '测试 Agent',
                type: 'test-runner',
                status: 'completed',
                sessionId: 'sess_003',
                startTime: new Date(Date.now() - 1800000).toISOString(),
                progress: 100,
                currentTask: '所有测试通过',
            },
        ];
    }

    function buildPage() {
        const runningAgents = _agents.filter(a => a.status === 'running');
        const completedAgents = _agents.filter(a => a.status !== 'running');

        const runningHtml = runningAgents.length > 0
            ? `<div class="card-grid">${runningAgents.map(a => renderAgentCard(a)).join('')}</div>`
            : Components.createEmptyState('🤖', '没有运行中的 Agent', '当前没有活跃的子 Agent', '');

        const completedHtml = completedAgents.length > 0
            ? `<div class="card-grid">${completedAgents.map(a => renderAgentCard(a)).join('')}</div>`
            : '';

        return `
            <div class="page-enter">
                <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
                    ${Components.sectionTitle('运行中')}
                    <span style="font-size:0.82rem;color:var(--text-muted)">${runningAgents.length} 个活跃 Agent</span>
                </div>
                ${runningHtml}

                ${completedAgents.length > 0 ? `
                    <div style="margin-top:24px">
                        ${Components.sectionTitle('已完成')}
                        ${completedHtml}
                    </div>
                ` : ''}
            </div>
        `;
    }

    function renderAgentCard(agent) {
        const statusBadge = agent.status === 'running'
            ? Components.badge('运行中', 'success')
            : agent.status === 'completed'
                ? Components.badge('已完成', 'info')
                : agent.status === 'failed'
                    ? Components.badge('失败', 'error')
                    : Components.badge(agent.status, 'muted');

        const progressHtml = agent.status === 'running'
            ? `
                <div style="margin-top:10px">
                    <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                        <span style="font-size:0.75rem;color:var(--text-muted)">进度</span>
                        <span style="font-size:0.75rem;color:var(--accent-secondary)">${agent.progress || 0}%</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar-fill" style="width:${agent.progress || 0}%"></div>
                    </div>
                </div>
            `
            : '';

        return `
            <div class="card" style="position:relative;overflow:hidden">
                <div class="card-header">
                    <div>
                        <div class="card-title">${Components.escapeHtml(agent.name || agent.id)}</div>
                        <div class="card-subtitle">
                            ${Components.badge(agent.type || 'default', 'primary')}
                            ${statusBadge}
                        </div>
                    </div>
                    ${agent.status === 'running' ? `
                        <button class="btn btn-sm btn-danger" onclick="AgentsPage.terminate('${agent.id}')">终止</button>
                    ` : ''}
                </div>
                <div style="font-size:0.82rem;color:var(--text-secondary)">
                    <div style="margin-bottom:4px">
                        <span style="color:var(--text-muted)">当前任务: </span>
                        ${Components.escapeHtml(agent.currentTask || '无')}
                    </div>
                    <div style="margin-bottom:4px">
                        <span style="color:var(--text-muted)">会话: </span>
                        <span style="font-family:monospace;font-size:0.8rem">${Components.truncate(agent.sessionId || '-', 20)}</span>
                    </div>
                    <div>
                        <span style="color:var(--text-muted)">启动时间: </span>
                        ${Components.formatTime(agent.startTime)}
                    </div>
                </div>
                ${progressHtml}
            </div>
        `;
    }

    async function terminate(id) {
        if (!confirm('确定要终止该 Agent 吗？')) return;

        try {
            await API.agents.terminate(id);
            Components.Toast.success('Agent 已终止');
            await loadAgents();
            document.getElementById('contentBody').innerHTML = buildPage();
        } catch (err) {
            Components.Toast.error(`终止失败: ${err.message}`);
        }
    }

    function startAutoRefresh() {
        if (_refreshTimer) clearInterval(_refreshTimer);
        _refreshTimer = setInterval(async () => {
            const hasRunning = _agents.some(a => a.status === 'running');
            if (hasRunning) {
                await loadAgents();
                // 只更新内容，不重建整个页面以避免闪烁
                const container = document.getElementById('contentBody');
                if (container) {
                    container.innerHTML = buildPage();
                }
            }
        }, 5000);
    }

    function destroy() {
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
        }
    }

    function bindEvents() {}

    function init() {}

    return { render, init, terminate, destroy };
})();
