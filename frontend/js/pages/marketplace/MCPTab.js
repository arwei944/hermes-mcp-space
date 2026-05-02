/**
 * 统一管理页面 - MCP 服务 Tab
 */

const MCPTab = (() => {
    let _mcpServers = [];
    let _mcpStatus = null;
    let _apiStatus = null;
    let _mcpTools = [];
    let _configTab = 'trae';
    let _container = null;

    // ==========================================
    // 渲染入口
    // ==========================================
    function render(containerSelector, data) {
        _mcpServers = data.mcpServers || [];
        _mcpStatus = data.mcpStatus || {};
        _apiStatus = data.apiStatus || {};
        _mcpTools = data.mcpTools || [];
        _container = document.querySelector(containerSelector);
        if (!_container) return;
        _container.dataset.rendered = 'true';

        // 初始化操作模块
        MCPOperations.init(_container, _mcpServers, _mcpTools, _refresh);

        _container.innerHTML = buildTab();
        bindEvents();
    }

    function _refresh() {
        MCPOperations.updateServers(_mcpServers);
        _container.innerHTML = buildTab();
        bindEvents();
    }

    async function _reloadServers() {
        _mcpServers = await API.request('/api/mcp/servers').catch(() => []);
        MCPOperations.updateServers(_mcpServers);
        _container.innerHTML = buildTab();
        bindEvents();
    }

    // ==========================================
    // Tab 构建
    // ==========================================
    function buildTab() {
        const s = _mcpStatus || {};
        const api = _apiStatus || {};
        const isOnline = s.status === 'running';
        const hermesOk = api.hermes_available === true;
        const baseUrl = window.location.origin;
        const configs = MCPConfig.getConfigs();
        const testResult = MCPOperations.getTestResult();
        const discoveredServers = MCPOperations.getDiscoveredServers();
        const isScanning = MCPOperations.isScanning();

        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('MCP 服务状态', isOnline ? '运行中' : '未运行', isOnline ? '服务正常' : '服务未启动', Components.icon('plug', 16), isOnline ? 'green' : 'red')}
            ${Components.renderStatCard('Hermes 主程序', hermesOk ? '已连接' : '未连接', hermesOk ? '数据实时同步' : '使用降级数据', Components.icon('bot', 16), hermesOk ? 'green' : 'orange')}
            ${Components.renderStatCard('暴露工具数', _mcpTools.length + ' 个', 'MCP 协议可用', Components.icon('wrench', 16), 'blue')}
            ${Components.renderStatCard('后端状态', api.status === 'ok' ? '正常' : '降级', api.status || '-', Components.icon('radio', 16), api.status === 'ok' ? 'green' : 'orange')}
        </div>`;

        const scanConfigHtml = `<div style="margin-bottom:16px;padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border)">
            <div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text-secondary)">扫描配置</div>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <input type="text" id="mcpCustomPorts" placeholder="本地端口（如 3000,5000,8080）" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
                <input type="text" id="mcpCustomUrl" placeholder="HF Space 链接或 MCP URL" style="flex:1;min-width:200px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
                <input type="text" id="mcpHFUser" placeholder="HF 用户名（扫描其所有 Space）" style="flex:1;min-width:160px;padding:6px 10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:12px;outline:none;color:var(--text)">
                <button type="button" class="btn btn-secondary" data-action="discoverMCPServers" ${isScanning ? 'disabled' : ''}>${isScanning ? '扫描中...' : '扫描'}</button>
            </div>
            <div style="font-size:11px;color:var(--text-tertiary);margin-top:6px">
                支持: 本地端口 / HF Space 链接 (https://huggingface.co/spaces/owner/name) / MCP URL / 指定用户名扫描
                <br>自动探测 /mcp、/sse、/api/mcp 三种端点路径 | HF Space 冷启动超时 15 秒
            </div>
        </div>`;

        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px;gap:8px">
            <button type="button" class="btn btn-secondary" data-action="testConnection">测试 MCP 连接</button>
            <button type="button" class="btn btn-secondary" data-action="restartService">重启 MCP 服务</button>
        </div>`;

        const testResultHtml = testResult
            ? `<div style="margin-bottom:16px;padding:12px 16px;border-radius:var(--radius-sm);background:${testResult.ok ? 'var(--green-bg)' : 'var(--red-bg)'};border:1px solid ${testResult.ok ? 'var(--green)' : 'var(--red)'}">
                <div style="font-size:13px;font-weight:600;color:${testResult.ok ? 'var(--green)' : 'var(--red)'}">${testResult.ok ? 'MCP 连接正常' : 'MCP 连接失败'}</div>
                ${testResult.detail ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${Components.escapeHtml(testResult.detail)}</div>` : ''}
            </div>`
            : '';

        const toolsHtml = Components.renderSection(
            'MCP 暴露的工具',
            `<table class="table">
                <thead><tr><th>工具名称</th><th>描述</th></tr></thead>
                <tbody>
                    ${_mcpTools.length === 0
                        ? `<tr><td colspan="2" style="text-align:center;padding:40px;color:var(--text-tertiary)">没有暴露的工具</td></tr>`
                        : _mcpTools
                              .map(
                                  (t) => `<tr>
                        <td class="mono" style="color:var(--accent)">${Components.escapeHtml(t.name)}</td>
                        <td>${Components.escapeHtml(t.description || '无描述')}</td>
                    </tr>`,
                              )
                              .join('')
                    }
                </tbody>
            </table>`,
        );

        const configSectionHtml = MCPConfig.buildConfigSection(_configTab, configs);

        const endpointHtml = Components.renderSection(
            '服务端点',
            `<div class="connection-info">
                <div><span class="info-label">Streamable HTTP:</span><span class="info-value mono">${baseUrl}/mcp</span></div>
                <div><span class="info-label">SSE (兼容):</span><span class="info-value mono">${baseUrl}/sse</span></div>
                <div><span class="info-label">协议版本:</span><span class="info-value">MCP 2025-03-26</span></div>
                <div><span class="info-label">Hermes 可用:</span><span class="info-value">${hermesOk ? '是' : '否（使用降级数据）'}</span></div>
            </div>`,
        );

        const addFormHtml = `<div class="mp-card" style="margin-bottom:16px">
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
                            (sv) => `
                        <div class="mp-server-card">
                            <div style="display:flex;justify-content:space-between;align-items:center">
                                <div>
                                    <div style="font-weight:600;font-size:14px">${Components.escapeHtml(sv.name)}</div>
                                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${Components.escapeHtml(sv.url)}</div>
                                </div>
                                <div style="display:flex;gap:6px;align-items:center">
                                    ${Components.renderBadge(sv.status === 'connected' ? '已连接' : sv.status || '未知', sv.status === 'connected' ? 'green' : 'orange')}
                                    <span style="font-size:11px;color:var(--text-tertiary)">${sv.tools_count || 0} 工具</span>
                                    <button type="button" class="btn btn-sm btn-ghost" data-action="refreshMCPServer" data-name="${Components.escapeHtml(sv.name)}">刷新</button>
                                    <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="removeMCPServer" data-name="${Components.escapeHtml(sv.name)}">删除</button>
                                </div>
                            </div>
                            ${sv.prefix ? `<div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">前缀: <code style="background:var(--bg-secondary);padding:1px 4px;border-radius:var(--radius-tag)">${Components.escapeHtml(sv.prefix)}</code></div>` : ''}
                            ${sv.last_check ? `<div style="font-size:11px;color:var(--text-tertiary)">最后检查: ${sv.last_check}</div>` : ''}
                        </div>
                    `,
                        )
                        .join('')}
                </div>`;

        const externalSectionHtml = Components.renderSection('外部 MCP 服务器', addFormHtml + serverListHtml);

        let discoveredHtml = '';
        if (discoveredServers.length > 0) {
            const existingNames = new Set(_mcpServers.map((s) => s.name));
            const newServers = discoveredServers.filter((s) => !existingNames.has(s.name));
            discoveredHtml = Components.renderSection(
                `发现的 MCP 服务 (${discoveredServers.length})`,
                `<div style="margin-bottom:12px;font-size:12px;color:var(--text-tertiary)">
                    扫描完成：发现 ${discoveredServers.length} 个服务，其中 ${newServers.length} 个可添加
                </div>
                <div class="mp-server-list">
                    ${discoveredServers
                        .map(
                            (s) => `<div class="mp-server-card" style="display:flex;justify-content:space-between;align-items:center">
                                <div>
                                    <div style="font-weight:600;font-size:14px">${Components.escapeHtml(s.name)}</div>
                                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px">${Components.escapeHtml(s.url)}</div>
                                    ${s.description ? `<div style="font-size:11px;color:var(--text-tertiary)">${Components.escapeHtml(s.description)}</div>` : ''}
                                </div>
                                <div style="display:flex;gap:6px;align-items:center">
                                    ${Components.renderBadge('可用', 'green')}
                                    ${existingNames.has(s.name)
                                        ? Components.renderBadge('已添加', 'blue')
                                        : `<button type="button" class="btn btn-sm btn-primary" data-action="addDiscoveredServer" data-name="${Components.escapeHtml(s.name)}" data-url="${Components.escapeHtml(s.url)}">添加</button>`}
                                </div>
                            </div>`,
                        )
                        .join('')}
                </div>
                ${newServers.length > 0
                    ? `<div style="display:flex;justify-content:flex-end;margin-top:12px">
                        <button type="button" class="btn btn-primary" data-action="addAllDiscovered">一键添加全部 (${newServers.length})</button>
                    </div>`
                    : ''}`,
            );
        }

        return `${statsHtml}${scanConfigHtml}${actionsHtml}${testResultHtml}${toolsHtml}
            ${configSectionHtml}
            ${endpointHtml}
            ${discoveredHtml}
            ${externalSectionHtml}`;
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
                case 'switchConfigTab':
                    _configTab = btn.dataset.tab;
                    _container.innerHTML = buildTab();
                    bindEvents();
                    break;
                case 'testConnection':
                    MCPOperations.testConnection();
                    break;
                case 'restartService':
                    MCPOperations.restartService();
                    break;
                case 'copyConfig':
                    MCPOperations.copyConfig();
                    break;
                case 'copyPrompt':
                    MCPOperations.copyPrompt();
                    break;
                case 'addMCPServer':
                    await MCPOperations.addMCPServer();
                    await _reloadServers();
                    break;
                case 'removeMCPServer':
                    await MCPOperations.removeMCPServer(btn.dataset.name);
                    await _reloadServers();
                    break;
                case 'refreshMCPServer':
                    await MCPOperations.refreshMCPServer(btn.dataset.name);
                    await _reloadServers();
                    break;
                case 'discoverMCPServers':
                    await MCPOperations.discoverMCPServers();
                    await _reloadServers();
                    break;
                case 'addDiscoveredServer':
                    await MCPOperations.addDiscoveredServer(btn.dataset.name, btn.dataset.url);
                    await _reloadServers();
                    break;
                case 'addAllDiscovered':
                    await MCPOperations.addAllDiscovered();
                    await _reloadServers();
                    break;
            }
        });
    }

    function destroy() {
        _container = null;
    }

    return { render, destroy };
})();

export default MCPTab;
