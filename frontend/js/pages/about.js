/**
 * 关于页面 - 版本变更记录
 */

const AboutPage = (() => {
    const CHANGELOG = [
        {
            version: '2.4.0',
            date: '2026-04-29 01:00',
            title: '数据能力增强',
            changes: [
                '会话全文搜索: SQLite FTS5 索引 + search_messages MCP 工具',
                '记忆容量管理: MEMORY.md 2200字符 / USER.md 1375字符限制',
                '记忆自动去重: 移除连续重复行',
                '记忆使用率: read_memory 返回 usage/limit 字段',
                'Context Files: read_soul / write_soul (SOUL.md 人格定义)',
                '技能 frontmatter 解析: 支持 YAML frontmatter 元数据',
                '技能元数据增强: list_skills 返回 category/version',
                '技能系统修复: description + tags 完整支持',
                'MCP 工具 37 → 40 个',
            ],
        },        {
            version: '2.3.0',
            date: '2026-04-29 00:30',
            title: '核心工具补齐 + 定时任务引擎',
            changes: [
                '文件操作: read_file / write_file / list_directory / search_files',
                '终端执行: shell_execute（subprocess，超时+截断）',
                'Web 工具: web_search（DuckDuckGo）+ web_fetch（网页抓取）',
                '定时任务执行引擎: APScheduler 真正调度执行',
                'MCP 工具 29 → 37 个',
                '移除 14 处 Mock/假数据',
                '修复 about.js API 调用参数顺序错误',
                '版本号三处不一致修复',
            ],
        },        {
            version: '2.2.0',
            date: '2026-04-28 23:30',
            title: '多平台连接配置 + System Prompt',
            changes: [
                'MCP 页面重构：4 平台配置（Trae/Claude/VS Code/Cursor）',
                'System Prompt 模板一键复制',
                '每个平台配置步骤说明',
                '事件委托重构（移除所有 inline onclick）',
                '会话页面添加删除按钮',
                '端到端验证 6/6 通过',
            ],
        },        {
            version: '2.1.0',
            date: '2026-04-28 22:30',
            title: '第三方测试修复',
            changes: [
                'update_config 写入后清除配置缓存（修复配置不持久化）',
                'install_plugin 支持 name 参数安装内置插件',
                'install_plugin 移除 source 必填限制',
                'MCP 工具描述更新（参数说明更准确）',
            ],
        },        {
            version: '2.2.0',
            date: '2026-04-28 22:00',
            title: 'v2.0 正式版 - 实时对话同步 + 全面优化',
            changes: [
                '后端：add_session_message 写入后触发 session.message SSE 事件',
                '前端：sessions.js 实时监听 SSE，新消息自动追加到 DOM',
                '前端：app.js SSE 事件通用分发机制（onSSEEvent）',
                '新增 auto-log-conversation 技能（Trae 自动同步对话）',
                '会话页面无感操作（新建/删除/切换不刷新）',
                '所有页面时间显示改为精确时间（YYYY/MM/DD HH:mm:ss）',
                'memory.js: 修复变量名错误 + 全局监听器内存泄漏',
                'logs.js: 修复自动刷新定时器内存泄漏',
                '移除 SSE 重复 Toast 通知',
                '回收站页面（恢复/永久删除/清空）',
                '插件市场 17 个内置插件',
                'MCP 工具 28 个',
                'API 端点 120+',
                '前端页面 13 个',
                '全面测试 54/54 通过',
            ],
        },
        {
            version: '1.11.0',
            date: '2026-04-28 21:15',
            title: '全面体验优化',
            changes: [
                'memory.js: 修复 _currentTab 变量名错误',
                'memory.js: 修复全局键盘监听器内存泄漏',
                'logs.js: 修复自动刷新定时器内存泄漏',
                '会话页面无感操作（新建/删除不刷新）',
                '所有页面时间显示改为精确时间',
                'log_conversation 对话记录双写修复（SQLite + JSON）',
            ],
        },
        {
            version: '1.10.0',
            date: '2026-04-28 21:00',
            title: '回收站 + 按钮事件修复',
            changes: [
                '新增回收站页面（恢复/永久删除/清空）',
                '删除技能自动移到回收站（可恢复）',
                '技能页面改用事件委托替代 inline onclick',
                '所有按钮添加 type="button" 防止表单提交',
                '首页添加 HTTP 缓存控制头',
            ],
        },
        {
            version: '1.9.0',
            date: '2026-04-28 20:15',
            title: '插件市场 + 数据动态化',
            changes: [
                '插件市场：17 个内置插件（工具/技能/记忆）',
                '插件分类浏览 + 搜索 + 一键安装',
                '内置插件直接创建本地目录（无需 Git）',
                '插件工具/技能自动合并到 MCP 和技能列表',
                '关于页面数据动态化（MCP工具数/API端点数实时获取）',
            ],
        },
        {
            version: '1.8.0',
            date: '2026-04-28 19:25',
            title: '插件系统 + SVG 图标 + 实时对话记录',
            changes: [
                '插件系统：支持从 Git 仓库安装/卸载插件',
                '插件可扩展工具（MCP）、技能、记忆',
                'MCP 工具 24 → 28（+log_conversation 等）',
                'SVG 矢量图标替换所有 emoji（39 个图标）',
                'log_conversation MCP 工具：Trae 可主动记录对话',
                '首次部署运行时间持久化（重启不归零）',
            ],
        },
        {
            version: '1.7.0',
            date: '2026-04-28 18:41',
            title: '会话模块合并 + 实时数据记录',
            changes: [
                '会话管理 + 会话对话合并为一个「会话」模块',
                '左侧会话列表 + 右侧对话区（类似聊天应用）',
                'MCP 调用自动写入系统消息到最近活跃会话',
                'QA 测试 72/72 全部通过',
            ],
        },
        {
            version: '1.6.0',
            date: '2026-04-28',
            title: '配置版本管理 + 关于页面',
            changes: [
                '系统配置增加版本管理（每次保存自动记录）',
                '新增关于页面（版本变更记录）',
            ],
        },
        {
            version: '1.5.0',
            date: '2026-04-28',
            title: '前端全面管理权限',
            changes: [
                '会话对话页：创建会话 + 发送消息 + 删除',
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
            ],
        },
        {
            version: '1.2.0',
            date: '2026-04-28',
            title: '数据可视化 + API 文档',
            changes: [
                '仪表盘 5 种 SVG 图表',
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
                '16 个 MCP 工具',
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
                '12 个前端页面',
                'Web 管理面板（Mac 极简风格）',
                '技能编辑器（Markdown 实时预览）',
            ],
        },
    ];

    async function render() {
        const container = document.getElementById('contentBody');
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
        } catch (err) {
            var version = APP_VERSION;
            var totalUptime = 0;
            var firstDeploy = '';
            var mcpToolCount = 0;
        }

        // 动态计算 API 端点数
        try {
            var routesRes = await API.request('GET', '/openapi.json').catch(() => null);
            var apiCount = routesRes ? Object.keys(routesRes.paths || {}).length : 0;
        } catch (err) {
            var apiCount = 0;
        }

        container.innerHTML = buildPage(version, totalUptime, firstDeploy, mcpToolCount, apiCount);
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

    function buildPage(version, totalUptime, firstDeploy, mcpToolCount, apiCount) {
        const uptimeStr = formatUptime(totalUptime);

        return `<div style="max-width:960px">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
                <!-- 左侧：关于 -->
                <div>
                    ${Components.sectionTitle('关于 Hermes Agent')}
                    ${Components.renderSection('', `
                        <div style="text-align:center;padding:20px 0">
                            <div style="font-size:48px;margin-bottom:12px">🤖</div>
                            <h2 style="font-size:20px;font-weight:600;margin-bottom:4px">Hermes Agent MCP Space</h2>
                            <p style="color:var(--text-tertiary);font-size:13px;margin-bottom:16px">AI Agent 管理面板 + MCP 服务</p>
                            <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px 20px;font-size:13px;color:var(--text-secondary)">
                                <span>版本 <strong class="mono">${version}</strong></span>
                                <span>总运行 <strong>${uptimeStr}</strong></span>
                                <span>首次部署 <strong>${formatDeployTime(firstDeploy) || '-'}</strong></span>
                                <span>MCP 工具 <strong>${mcpToolCount || '?'}</strong> 个</span>
                                <span>API 端点 <strong>${apiCount || '?'}</strong> 个</span>
                            </div>
                        </div>
                    `)}
                </div>
                <!-- 右侧：技术栈 -->
                <div>
                    ${Components.sectionTitle('技术栈')}
                    ${Components.renderSection('', `
                        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px">
                            <div style="padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm)">
                                <div style="font-weight:600;margin-bottom:6px">后端</div>
                                <div style="color:var(--text-tertiary)">Python · FastAPI · Gradio</div>
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
                </div>
            </div>

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