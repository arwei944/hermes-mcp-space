/**
 * 关于页面 - 版本变更记录
 */

const AboutPage = (() => {
    const CHANGELOG = [
        {
            version: '5.5.0',
            date: '2026-04-30',
            title: '记忆完善 — 4 Tab + Bug 修复',
            changes: [
                '扩展为 4 Tab：长期记忆/用户画像/学习记录/会话摘要',
                '修复错误消息多余 .* 前缀（改为 err.message）',
                '修复 exportContent/resetContent 函数定义在 return 之后',
                '新增未保存提示：切换 Tab 时检测编辑器内容变化',
                '新增填充模板按钮：一键填入预设模板内容',
                '新增搜索功能：学习记录和会话摘要支持关键词过滤',
                '移除所有 inline onclick，改为 data-action 事件委托',
            ],
        },
        {
            version: '5.4.0',
            date: '2026-04-30',
            title: '会话重构 — 消除重复代码 + 统计数据',
            changes: [
                '抽取公共渲染函数：buildSessionItem/buildSessionList/buildMessageList/buildMessageItem/buildSessionHeader',
                '新增会话统计栏：总会话/活跃/总消息/今日新增 4 个统计卡片',
                '新增后端 /api/sessions/stats 统计端点',
                '筛选器选项渲染抽取为 buildFilterOptions()',
                '代码行数从 406 行优化为 378 行，消除约 80 行重复代码',
            ],
        },
        {
            version: '5.3.1',
            date: '2026-04-30',
            title: '紧急修复与基础完善',
            changes: [
                '修复 version.py 正则表达式双反斜杠导致 changelog API 无法解析',
                '修复 sync.js API.post 第三参数无效（timeout 被静默忽略）',
                '补注册 5 个缺失图标（messageCircle/refreshCw/alertTriangle/checkCircle/xCircle）',
                '后端统一设置 TZ=Asia/Shanghai 时区',
            ],
        },
        {
            version: '5.3.0',
            date: '2026-04-30',
            title: '前端去重合并 + 数据同步与热更新',
            changes: [
                '扩展管理页面升级为 4 Tab（MCP服务/技能/工具/插件市场），合并 5 个页面功能',
                'MCP服务 Tab：状态监控、连接测试、重启服务、多平台配置生成、System Prompt 模板',
                '技能 Tab：统计卡片、搜索过滤、内联编辑器、Markdown 预览、模板插入、删除到回收站',
                '工具 Tab：Toolset 过滤组、启用/禁用切换、工具详情 Modal（JSON Schema）',
                '插件市场 Tab：市场/已安装切换、三维过滤、评分/下载量展示、一键安装/卸载',
                '新增数据同步页面：同步状态面板、手动备份/恢复、后端切换、热更新检测与执行',
                '新增后端 API：/api/version/check-update、/api/version/hot-update',
                '移除冗余页面：tools.js、skills.js、mcp.js、plugins.js',
                '全局搜索关键词重定向到扩展管理页面',
            ],
        },
        {
            version: '5.0.0',
            date: '2026-04-29 22:00',
            title: '功能增强 — 确认弹窗 + 搜索 + 聊天优化',
            changes: [
                '新增 Components.Modal.confirm() / alert() 确认弹窗组件',
                '12 个页面 16 处破坏性操作全部接入确认弹窗',
                'tools.js 新增搜索功能（按名称/描述实时过滤）',
                'skills.js 新增搜索功能（按名称/描述实时过滤）',
                'chat.js 修复 DOM 重建问题（搜索/切换会话不再丢失状态）',
                'chat.js 消息搜索框状态保留，不再被整页重建打断',
            ],
        },
        {
            version: '4.9.0',
            date: '2026-04-29 21:30',
            title: '代码质量 + 自动化',
            changes: [
                'ESLint 零 error 零 warning 基线（从 57 warning 降到 0）',
                '引入 Prettier 统一代码格式（4 空格缩进、单引号、120 字符行宽）',
                'build_full_html 改为自动扫描 pages/*.js（不再手动维护列表）',
                'app.js 页面注册改为自动从全局变量收集',
                '新增全局错误边界（JS 报错显示友好提示，不再白屏）',
                '修复 onSSEEvent 未暴露到 return（dashboard/knowledge）',
                '删除死代码（destroy 函数、未使用变量）',
            ],
        },
        {
            version: '4.8.0',
            date: '2026-04-29 20:00',
            title: '深色模式补全 + ESLint 引入',
            changes: [
                '深色模式：毛玻璃背景/hover/滚动条/badge 全部适配 CSS 变量',
                '新增 --glass-bg/--hover-bg/--badge-bg/--scrollbar-thumb 变量',
                '引入 ESLint 9：零 error 基线建立',
                '修复 components.js 4 个重复 key（info/eye/moon/star）',
                '修复 api.js getMeta 未暴露为全局函数',
                '修复 marketplace.js container 作用域问题',
                '修复 components.js/dashboard.js 无用赋值',
                'CI 新增 ESLint 检查步骤',
                'pre-commit hook 新增 ESLint 检查',
            ],
        },
        {
            version: '4.7.0',
            date: '2026-04-29 19:00',
            title: '质量保障体系 + 图标修复',
            changes: [
                '新增 CI 质量门禁：JS/Python 语法检查 + 前端文件一致性验证',
                '新增 pre-commit hook：提交前自动检查语法',
                '修复 build_full_html 静默失败（改为抛出异常）',
                '修复 knowledge.js 8 处图标未用 ${} 包裹',
                '修复 dashboard.js 2 处图标未用 ${} 包裹',
                'CI 通过后才部署到 HuggingFace Spaces',
            ],
        },
        {
            version: '4.6.1',
            date: '2026-04-29 18:30',
            title: '修复 JS 语法错误',
            changes: [
                '修复 Python 批量替换 emoji 时产生的引号嵌套语法错误（dashboard.js/knowledge.js/sessions.js）',
                '修复普通字符串中误用 ${} 模板语法的问题',
                '新增 node --check 语法验证流程',
            ],
        },
        {
            version: '4.6.0',
            date: '2026-04-29 18:00',
            title: '矢量图标 + UI 风格统一',
            changes: [
                '全量替换 emoji 为 SVG 矢量图标（50+ 处，17 个文件）',
                '新增 18 个 Lucide 风格 SVG 图标（knowledge/brain/zap/ghost 等）',
                '导航栏改用 data-icon 属性 + JS 动态渲染 SVG',
                'CSS 变量体系补全（--bg-secondary/--text/--radius-tag 别名）',
                '所有硬编码颜色替换为 CSS 变量（深色模式自动适配）',
                '统一圆角/字号/间距规范',
                'badge/skeleton/form-switch 改用 CSS 变量',
                'Toast 通知图标改为 SVG',
                'renderStatCard 支持图标名称自动转换',
            ],
        },
        {
            version: '4.5.0',
            date: '2026-04-29 17:10',
            title: '实时数据驱动',
            changes: [
                '仪表盘 SSE 增量更新：工具调用时实时刷新活动流和统计卡片（不重渲染页面）',
                '仪表盘 15 秒自动轮询：统计数据和活动流自动更新',
                '知识库 30 秒自动轮询：概览卡片实时变化',
                'MCP 中间件 emit 双事件：tool_call（开始）+ tool_complete（完成/失败）',
                '页面 destroy 生命周期：离开页面自动停止轮询',
                'app.js SSE 不再全量刷新，改为调用页面 onSSEEvent 增量更新',
            ],
        },
        {
            version: '4.4.0',
            date: '2026-04-29 17:00',
            title: '自动提炼引擎',
            changes: [
                '新增 auto_learner.py：自动分析错误模式/最佳实践/用户偏好/技能建议',
                'MCP 中间件接入增量学习：每次工具调用后自动触发（5分钟冷却）',
                '全量学习：一键分析所有数据，写入 learnings.md + MEMORY.md',
                '知识库新增「自动分析」Tab：错误模式/最佳实践/用户偏好/技能建议',
                '错误模式自动分类：SSL/超时/404/认证/语法等 13 种类型',
                '智能去重：新旧学习记录自动合并，避免重复',
            ],
        },
        {
            version: '4.3.0',
            date: '2026-04-29 16:45',
            title: '知识库模块 + 北京时间',
            changes: [
                '新增知识库页面：会话记录/经验提炼/记忆内容/技能库 四个 Tab',
                '知识库概览：5 张统计卡片（会话/经验/记忆/技能/人格）',
                '新增 5 个 Knowledge API: overview/sessions/experiences/memory/skills',
                '时间显示改为北京时间 UTC+8',
                '卡片式布局：会话卡片显示标题/来源/模型/消息数/最后消息',
            ],
        },
        {
            version: '4.2.0',
            date: '2026-04-29 16:20',
            title: 'SOLO 对话回传 + 思考层评估',
            changes: [
                'AGENTS.md 指令驱动：SOLO 每次回复后自动回传对话摘要',
                '思考层评估：架构/Bug/优化/新功能请求自动包含可行性+复杂度+风险评估',
                '经验提炼：同类问题出现3次以上自动 add_learning 记录',
                '三层架构：自动层(MCP拦截) + 指令层(AGENTS.md) + 提炼层(add_learning)',
            ],
        },
        {
            version: '4.1.1',
            date: '2026-04-29 16:05',
            title: '时间修复 + SOLO 对话实时记录',
            changes: [
                '时间显示改为精确到秒的绝对时间 (HH:MM:SS)',
                'SOLO 对话实时记录: 每次 MCP 工具调用自动写入 solo_realtime 会话',
                '活动流新增 solo_message 类型展示 (🤖 SOLO / 👤 用户)',
                '新增 _summarize_tool_args 智能参数摘要',
                'add_session_message 支持 metadata 参数',
            ],
        },
        {
            version: '4.1.0',
            date: '2026-04-29 16:00',
            title: '仪表盘大改版 + Bug修复',
            changes: [
                '仪表盘 v2 实时监控台: 活动流/热力图/工具排行/错误追踪/系统心跳',
                '新增 5 个 Dashboard API: activity/heatmap/ranking/errors/trend',
                '修复 search_skills_hub unhashable type: slice (API返回字典兼容)',
                '修复 create_skill 重复创建未抛出错误',
                '修复 web_search/install_skill_hub SSL 降级处理',
                '测试报告: 67 用例 97.0% 通过率',
            ],
        },
        {
            version: '4.0.0',
            date: '2026-04-29 14:30',
            title: '生态扩展',
            changes: [
                '浏览器自动化: browser_navigate/snapshot/screenshot/click/type/evaluate',
                '消息平台: register_webhook + send_notification (Telegram/飞书/Slack/Discord)',
                '外部记忆: store_memory + query_memory (语义搜索)',
                'browser_navigate: 沙箱降级为 urllib 抓取+文本摘要',
                'Webhook 管理: webhooks.json 持久化存储',
                'MCP 工具 53 → 63 个',
            ],
        },
        {
            version: '3.3.0',
            date: '2026-04-29 14:00',
            title: '多 Agent 工作流',
            changes: [
                'micro-squad 技能: THINK→PLAN→BUILD→VERIFY→SHIP 工作流',
                'review-skill 技能: 双盲评审（用户视角+工程视角）',
                'delegate_task: 子 Agent 委派工具',
                '种子数据: micro-squad + review-skill 内置技能',
                'MCP 工具 52 → 53 个',
                '内置技能 4 → 6 个',
            ],
        },
        {
            version: '3.2.0',
            date: '2026-04-29 13:00',
            title: '自动化与智能',
            changes: [
                '上下文压缩: compress_session（保留首尾+中间摘要）',
                'Agent 自创技能: suggest_skill（分析工具调用模式）',
                'Skills Hub: search_skills_hub / install_skill_hub（在线市场）',
                '技能条件激活: requires_toolsets / fallback_for_toolsets',
                '对话统计 API: /api/stats/messages|sessions|tools',
                'list_skills 增强: 传递可用工具列表进行条件过滤',
                'MCP 工具 48 → 52 个',
            ],
        },
        {
            version: '3.1.0',
            date: '2026-04-29 12:30',
            title: '工程层加固（AI 工程指南整合）',
            changes: [
                '错误信息指令化: 25 处 raise ValueError 改为诊断+建议格式',
                '工具调用追踪: tool_traces.jsonl 记录每次调用',
                'Evals API: /api/evals/summary|tools|errors|trend',
                'AGENTS.md: read_agents_md / write_agents_md',
                '学习循环: read_learnings / add_learning（上限 50 条）',
                'shell_execute 增强: 命令不存在/权限不足/超时智能建议',
                'MCP 工具 44 → 48 个',
            ],
        },
        {
            version: '3.0.0',
            date: '2026-04-29 01:30',
            title: 'MCP 网关 - 工具聚合器',
            changes: [
                'MCP 客户端服务: 连接外部 MCP 服务器',
                '自动发现: 添加服务器时自动获取工具列表',
                '工具路由: 本地工具 + 外部工具统一暴露',
                '工具前缀: 外部工具自动加 mcp_{name}_ 前缀',
                '网关管理: add_mcp_server / remove_mcp_server / list_mcp_servers / refresh_mcp_servers',
                '配置持久化: mcp_servers.json 保存服务器配置',
                'MCP 工具 40 → 44 个（+4 网关管理工具）',
                '一个 MCP 入口访问所有 MCP 服务',
            ],
        },
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
        },
        {
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
        },
        {
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
        },
        {
            version: '2.1.0',
            date: '2026-04-28 22:30',
            title: '第三方测试修复',
            changes: [
                'update_config 写入后清除配置缓存（修复配置不持久化）',
                'install_plugin 支持 name 参数安装内置插件',
                'install_plugin 移除 source 必填限制',
                'MCP 工具描述更新（参数说明更准确）',
            ],
        },
        {
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
            changes: ['系统配置增加版本管理（每次保存自动记录）', '新增关于页面（版本变更记录）'],
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
            changes: ['仪表盘 5 种 SVG 图表', 'Swagger UI + ReDoc 自动生成', '99 个 API 端点自动发现'],
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
        } catch (_err) {
            var version = APP_VERSION;
            var totalUptime = 0;
            var firstDeploy = '';
            var mcpToolCount = 0;
        }

        // 动态计算 API 端点数
        try {
            var routesRes = await API.request('GET', '/openapi.json').catch(() => null);
            var apiCount = routesRes ? Object.keys(routesRes.paths || {}).length : 0;
        } catch (_err) {
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
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    }

    function buildPage(version, totalUptime, firstDeploy, mcpToolCount, apiCount) {
        const uptimeStr = formatUptime(totalUptime);

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
                                <span>版本 <strong class="mono">${version}</strong></span>
                                <span>总运行 <strong>${uptimeStr}</strong></span>
                                <span>首次部署 <strong>${formatDeployTime(firstDeploy) || '-'}</strong></span>
                                <span>MCP 工具 <strong>${mcpToolCount || '?'}</strong> 个</span>
                                <span>API 端点 <strong>${apiCount || '?'}</strong> 个</span>
                            </div>
                        </div>
                    `,
                    )}
                </div>
                <!-- 右侧：技术栈 -->
                <div>
                    ${Components.sectionTitle('技术栈')}
                    ${Components.renderSection(
                        '',
                        `
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
                    `,
                    )}
                </div>
            </div>

            ${Components.sectionTitle('版本变更记录')}
            ${CHANGELOG.map((rel) => {
                const isCurrent = rel.version === version;
                return `
                <div style="margin-bottom:16px;${isCurrent ? 'background:var(--bg-secondary);padding:12px;border-radius:8px;border:1px solid var(--accent)' : ''}">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                        <span class="mono" style="font-size:13px;font-weight:600;color:var(--accent)">v${rel.version}</span>
                        <span style="font-size:12px;color:var(--text-tertiary)">${rel.date}</span>
                        ${isCurrent ? '<span style="font-size:10px;background:var(--accent);color:#fff;padding:1px 6px;border-radius:var(--radius-tag)">当前版本</span>' : ''}
                        <span style="font-size:13px;font-weight:500">${rel.title}</span>
                    </div>
                    <ul style="margin:0;padding-left:20px;font-size:12px;color:var(--text-secondary);line-height:1.8">
                        ${rel.changes.map((c) => `<li>${c}</li>`).join('')}
                    </ul>
                </div>`;
            }).join('')}

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
