/**
 * 关于页面 - 版本变更记录
 */

const AboutPage = (() => {
    const CHANGELOG = [
        {
            version: '1.8.0',
            date: '2026-04-28 19:25',
            title: '插件系统 + SVG图标 + 实时对话记录',
            changes: [
                '插件系统：支持从 Git 仓库安装/卸载插件',
                '插件可扩展工具（MCP）、技能、记忆',
                '新增插件市场页面',
                'MCP 工具 24 → 28（+list/install/uninstall_plugin + log_conversation）',
                'SVG 矢量图标替换所有 emoji（39 个图标）',
                'log_conversation MCP 工具：Trae 可主动记录对话',
                '首次部署运行时间持久化（重启不归零）',
                '版本发布时间精确到分钟',
            ],
        },        {
            version: '1.7.0',
            date: '2026-04-28 18:41',
            title: '会话模块合并 + 实时数据记录',
            changes: [
                '会话管理 + 会话对话合并为一个「会话」模块',
                '左侧会话列表 + 右侧对话区（类似聊天应用）',
                'MCP 调用自动写入系统消息到最近活跃会话',
                '系统操作自动写入系统消息',
                'QA 测试报告 70/72 → 72/72 全部通过',
                '删除定时任务支持 job_id 和任务名称',
                '删除不存在会话返回 404',
            ],
        },
        {
            version: '1.6.0',
            date: '2026-04-28',
            title: '配置版本管理 + 关于页面',
            changes: [
                '系统配置增加版本管理（每次保存自动记录）',
                '新增关于页面（版本变更记录）',
                '工具/记忆/MCP 设置归入各自模块页面',
                '系统配置增加数据管理、通知、安全设置',
            ],
        },
        {
            version: '1.5.0',
            date: '2026-04-28',
            title: '前端全面管理权限',
            changes: [
                '会话对话页：创建会话 + 发送消息 + 删除',
                '会话管理页：新建按钮 + 状态筛选',
                '工具管理页：启用/禁用开关',
                '记忆管理页：导出 + 重置',
                '操作日志页：搜索 + 自动刷新',
            ],
        },
        {
            version: '1.4.0',
            date: '2026-04-28',
            title: 'MCP 工具扩展到 24 个',
            changes: [
                '新增 8 个 MCP 工具（技能增删改/会话创建/日志查看/配置管理）',
                'MCP 调用实时记录到操作日志',
                'SSE 事件实时推送',
            ],
        },
        {
            version: '1.3.0',
            date: '2026-04-28',
            title: '数据真实化',
            changes: [
                '会话数据 JSON 持久化（重启不丢失）',
                '操作日志自动记录（中间件拦截写操作）',
                '种子数据（首次启动自动生成演示数据）',
                '技能系统支持文件和目录两种格式',
            ],
        },
        {
            version: '1.2.0',
            date: '2026-04-28',
            title: '数据可视化 + API 文档',
            changes: [
                '仪表盘 5 种 SVG 图表（环形图/柱状图/折线图/仪表盘）',
                'Swagger UI + ReDoc 自动生成',
                '99 个 API 端点自动发现',
            ],
        },
        {
            version: '1.1.0',
            date: '2026-04-28',
            title: 'MCP 服务 + 深色模式',
            changes: [
                'MCP Streamable HTTP + SSE 协议',
                '16 个 MCP 工具（会话/技能/记忆/定时任务/系统）',
                '深色模式（自动跟随系统）',
                'GitHub → HF Spaces 自动 CI/CD',
            ],
        },
        {
            version: '1.0.0',
            date: '2026-04-28',
            title: '项目初始化',
            changes: [
                'Gradio + FastAPI 混合架构',
                '12 个前端页面（仪表盘/会话/工具/技能/记忆/定时任务/Agent/MCP/日志/配置）',
                'Web 管理面板（Mac 极简风格）',
                '操作日志页面',
                '技能编辑器（Markdown 实时预览）',
            ],
        },
    ];

    async function render() {
        const container = document.getElementById('contentBody');
        try {
            const status = await API.system.health();
            var version = status.version || '1.7.0';
            var totalUptime = status.total_uptime || status.uptime || 0;
            var firstDeploy = status.first_deploy || '';
        } catch (err) {
            var version = '1.7.0';
            var totalUptime = 0;
            var firstDeploy = '';
        }

        container.innerHTML = buildPage(version, totalUptime, firstDeploy);
    }

    function formatUptime(seconds) {
        if (seconds > 86400) return `${Math.floor(seconds / 86400)}天 ${Math.floor((seconds % 86400) / 3600)}小时`;
        if (seconds > 3600) return `${Math.floor(seconds / 3600)}小时 ${Math.floor((seconds % 3600) / 60)}分钟`;
        return `${Math.floor(seconds / 60)}分钟`;
    }

    function formatDeployTime(isoStr) {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }

    function buildPage(version, totalUptime, firstDeploy) {
        const uptimeStr = formatUptime(totalUptime);

        return `<div style="max-width:720px">
            ${Components.sectionTitle('关于 Hermes Agent')}
            ${Components.renderSection('', `
                <div style="text-align:center;padding:24px 0">
                    <div style="font-size:48px;margin-bottom:12px">🤖</div>
                    <h2 style="font-size:20px;font-weight:600;margin-bottom:4px">Hermes Agent MCP Space</h2>
                    <p style="color:var(--text-tertiary);font-size:13px;margin-bottom:16px">AI Agent 管理面板 + MCP 服务</p>
                    <div style="display:inline-flex;gap:24px;font-size:13px;color:var(--text-secondary)">
                        <span>版本 <strong class="mono">${version}</strong></span>
                        <span>总运行 <strong>${uptimeStr}</strong></span>
                        <span>首次部署 <strong>${formatDeployTime(firstDeploy) || '-'}</strong></span>
                        <span>MCP 工具 <strong>24</strong> 个</span>
                        <span>API 端点 <strong>100+</strong></span>
                    </div>
                </div>
            `)}

            ${Components.sectionTitle('技术栈')}
            ${Components.renderSection('', `
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
                    <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                        <div style="font-weight:600;margin-bottom:6px">后端</div>
                        <div style="color:var(--text-tertiary)">Python · FastAPI · Gradio 5.49</div>
                    </div>
                    <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                        <div style="font-weight:600;margin-bottom:6px">前端</div>
                        <div style="color:var(--text-tertiary)">原生 JS · CSS · SVG 图表</div>
                    </div>
                    <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                        <div style="font-weight:600;margin-bottom:6px">协议</div>
                        <div style="color:var(--text-tertiary)">MCP Streamable HTTP + SSE</div>
                    </div>
                    <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                        <div style="font-weight:600;margin-bottom:6px">部署</div>
                        <div style="color:var(--text-tertiary)">GitHub Actions → HF Spaces</div>
                    </div>
                </div>
            `)}

            ${Components.sectionTitle('版本变更记录')}
            ${CHANGELOG.map(rel => `
                <div style="margin-bottom:16px">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                        <span class="mono" style="font-size:13px;font-weight:600;color:var(--accent)">v${rel.version}</span>
                        <span style="font-size:12px;color:var(--text-tertiary)">${rel.date}</span>
                        <span style="font-size:13px;font-weight:500">${rel.title}</span>
                    </div>
                    <ul style="margin:0;padding-left:20px;font-size:12px;color:var(--text-secondary);line-height:1.8">
                        ${rel.changes.map(c => `<li>${c}</li>`).join('')}
                    </ul>
                </div>
            `).join('')}

            <div style="text-align:center;padding:24px 0;color:var(--text-tertiary);font-size:12px">
                <p>© 2026 Hermes Agent · MIT License</p>
                <p style="margin-top:4px">
                    <a href="https://github.com/arwei944/hermes-mcp-space" target="_blank" style="color:var(--accent);text-decoration:none">GitHub</a>
                    ·
                    <a href="https://huggingface.co/spaces/arwei944/hermes-mcp-space" target="_blank" style="color:var(--accent);text-decoration:none">HuggingFace</a>
                </p>
            </div>
        </div>`;
    }

    return { render };
})();
