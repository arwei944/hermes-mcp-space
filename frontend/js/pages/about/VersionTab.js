/**
 * 关于页面 - 版本信息 Tab
 */

const VersionTab = (() => {
    let _destroyed = false;

    function formatUptime(seconds) {
        if (seconds > 86400) return `${Math.floor(seconds / 86400)}天 ${Math.floor((seconds % 86400) / 3600)}小时`;
        if (seconds > 3600) return `${Math.floor(seconds / 3600)}小时 ${Math.floor((seconds % 3600) / 60)}分钟`;
        return `${Math.floor(seconds / 60)}分钟`;
    }

    function formatDeployTime(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function buildVersionTab(data) {
        const { version, totalUptime, firstDeploy, mcpToolCount, apiCount } = data || {};
        const uptimeStr = formatUptime(totalUptime || 0);

        return `<div style="max-width:960px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                <!-- 左侧：关于 -->
                <div>
                    ${Components.sectionTitle('关于 Hermes Agent')}
                    ${Components.renderSection(
                        '',
                        `
                        <div style="text-align:center;padding:20px 0">
                            <div style="font-size:48px;margin-bottom:12px">${Components.icon('bot', 48)}</div>
                            <h2 style="font-size:20px;font-weight:600;margin-bottom:4px">Hermes Agent MCP Space</h2>
                            <p style="color:var(--text-tertiary);font-size:13px;margin-bottom:16px">AI Agent 管理面板 + MCP 服务</p>
                            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px 20px;font-size:13px;color:var(--text-secondary)">
                                <span>版本 <strong class="mono">${version || '-'}</strong></span>
                                <span>总运行 <strong>${uptimeStr}</strong></span>
                                <span>首次部署 <strong>${formatDeployTime(firstDeploy) || '-'}</strong></span>
                                <span>MCP 工具 <strong>${mcpToolCount || '?'}</strong> 个</span>
                                <span>API 端点 <strong>${apiCount || '?'}</strong> 个</span>
                            </div>
                        </div>
                    `,
                    )}
                </div>
                <!-- 右侧：系统信息 -->
                <div>
                    ${Components.sectionTitle('系统信息')}
                    ${Components.renderSection(
                        '',
                        `
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
                            <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                                <div style="font-weight:600;margin-bottom:6px">后端框架</div>
                                <div style="color:var(--text-tertiary)">Python · FastAPI · Gradio</div>
                            </div>
                            <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                                <div style="font-weight:600;margin-bottom:6px">MCP 协议</div>
                                <div style="color:var(--text-tertiary)">Streamable HTTP + SSE</div>
                            </div>
                            <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                                <div style="font-weight:600;margin-bottom:6px">部署平台</div>
                                <div style="color:var(--text-tertiary)">HuggingFace Spaces</div>
                            </div>
                            <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                                <div style="font-weight:600;margin-bottom:6px">CI/CD</div>
                                <div style="color:var(--text-tertiary)">GitHub Actions</div>
                            </div>
                        </div>
                    `,
                    )}
                </div>
            </div>
        </div>`;
    }

    async function render(containerSelector) {
        _destroyed = false;
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        try {
            const [status, toolsData] = await Promise.all([
                API.system.health(),
                API.request('/api/tools').catch(() => []),
            ]);
            var version = status.version || APP_VERSION;
            var totalUptime = status.total_uptime || status.uptime || 0;
            var firstDeploy = status.first_deploy || '';
            var mcpToolCount = Array.isArray(toolsData) ? toolsData.length : (toolsData.tools || []).length;
        } catch (_err) {
            var version = APP_VERSION;
            var totalUptime = 0;
            var firstDeploy = '';
            var mcpToolCount = 0;
        }

        try {
            var routesRes = await API.request('GET', '/openapi.json').catch(() => null);
            var apiCount = routesRes ? Object.keys(routesRes.paths || {}).length : 0;
        } catch (_err) {
            var apiCount = 0;
        }

        if (_destroyed) return;

        const data = { version, totalUptime, firstDeploy, mcpToolCount, apiCount };
        container.innerHTML = buildVersionTab(data);
    }

    function destroy() {
        _destroyed = true;
    }

    return { render, destroy };
})();

export default VersionTab;
