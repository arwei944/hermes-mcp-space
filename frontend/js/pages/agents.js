/**
 * 子 Agent 页面 (Mac 极简风格)
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
        } catch (_err) {
            _agents = [];
        }
    }

    function buildPage() {
        const runningAgents = _agents.filter((a) => a.status === 'running');
        const completedAgents = _agents.filter((a) => a.status !== 'running');

        const runningHtml =
            runningAgents.length > 0
                ? `<div class="tool-grid">${runningAgents.map((a) => renderAgentCard(a)).join('')}</div>`
                : Components.createEmptyState(
                      Components.icon('bot', 48),
                      '没有运行中的 Agent',
                      '当前没有活跃的子 Agent',
                      '',
                  );

        const completedHtml =
            completedAgents.length > 0
                ? `<div class="tool-grid">${completedAgents.map((a) => renderAgentCard(a)).join('')}</div>`
                : '';

        return `${Components.sectionTitle('运行中')}<span style="font-size:12px;color:var(--text-tertiary);margin-left:12px">${runningAgents.length} 个活跃 Agent</span>
            ${runningHtml}
            ${completedAgents.length > 0 ? `<div style="margin-top:24px">${Components.sectionTitle('已完成')}${completedHtml}</div>` : ''}`;
    }

    function renderAgentCard(agent) {
        const statusBadge =
            agent.status === 'running'
                ? Components.renderBadge('运行中', 'green')
                : agent.status === 'completed'
                  ? Components.renderBadge('已完成', 'blue')
                  : agent.status === 'failed'
                    ? Components.renderBadge('失败', 'red')
                    : Components.renderBadge(
                          { idle: '空闲', pending: '等待中', stopped: '已停止' }[agent.status] || agent.status,
                          'orange',
                      );

        const progressHtml =
            agent.status === 'running'
                ? `
            <div style="margin-top:10px">
                <div style="display:flex;justify-content:space-between;margin-bottom:4px">
                    <span style="font-size:11px;color:var(--text-tertiary)">进度</span>
                    <span style="font-size:11px;color:var(--accent)">${agent.progress || 0}%</span>
                </div>
                <div class="progress-bar"><div class="progress-bar-fill" style="width:${agent.progress || 0}%"></div></div>
            </div>`
                : '';

        return `<div class="tool-card" style="position:relative">
            <div class="tool-card-header">
                <span class="tool-name" style="font-family:var(--font)">${Components.escapeHtml(agent.name || agent.id)}</span>
                ${statusBadge}
            </div>
            <div class="tool-desc">
                <div style="margin-bottom:4px"><span style="color:var(--text-tertiary)">类型: </span>${Components.renderBadge(agent.type || 'default', 'purple')}</div>
                <div style="margin-bottom:4px"><span style="color:var(--text-tertiary)">当前任务: </span>${Components.escapeHtml(agent.currentTask || '无')}</div>
                <div style="margin-bottom:4px"><span style="color:var(--text-tertiary)">会话: </span><span class="mono">${Components.truncate(agent.sessionId || '-', 20)}</span></div>
                <div><span style="color:var(--text-tertiary)">启动时间: </span>${Components.formatDateTime(agent.startTime)}</div>
            </div>
            ${progressHtml}
            ${agent.status === 'running' ? `<div style="margin-top:10px"><button class="btn btn-sm btn-danger" onclick="AgentsPage.terminate('${agent.id}')">终止</button></div>` : ''}
        </div>`;
    }

    async function terminate(id) {
        try {
            await API.agents.terminate(id);
            Components.Toast.success('Agent 已终止');
            await loadAgents();
            document.getElementById('contentBody').innerHTML = buildPage();
        } catch (err) {
            Components.Toast.error(`.*${err.message}`);
        }
    }

    function startAutoRefresh() {
        if (_refreshTimer) clearInterval(_refreshTimer);
        _refreshTimer = setInterval(async () => {
            const hasRunning = _agents.some((a) => a.status === 'running');
            if (hasRunning) {
                await loadAgents();
                const container = document.getElementById('contentBody');
                if (container) container.innerHTML = buildPage();
            }
        }, 5000);
    }

    function destroy() {
        if (_refreshTimer) {
            clearInterval(_refreshTimer);
            _refreshTimer = null;
        }
    }

    return { render, terminate, destroy };
})();
