# -*- coding: utf-8 -*-
# Auto-generated changelog data. Do not edit manually.

CHANGELOG_FALLBACK = [
  {
    "version": "v12.0.0",
    "date": "2026-05-03 00:18",
    "title": "发布: v12.0.0 - 统一运维中心 + 全链路可观测",
    "changes": [
      "统一运维中心（8 个标签页）: 实时总览、构建部署、资源监控、代码质量、错误追踪、告警管理、事件日志、关于系统",
      "前端错误上报: sendBeacon + ErrorHandler + Logger",
      "API 错误追踪: ErrorTrackerMiddleware（X-Trace-Id）",
      "构建验证: _validate_build + 构建缓存 + 自动回滚",
      "CI 部署验证: 状态检查 + 页面大小检查",
      "AI 代码质量面板: 集成 evals API",
      "7 个新 OpsSyncService 通道（前端错误、API 错误、事件、评估等）",
      "4 个独立页面合并为 1 个统一运维中心"
    ]
  },
  {
    "version": "v11.0.0",
    "date": "2026-05-02 23:20",
    "title": "发布: v11.0.0 - 构建系统重构 + 运维韧性增强",
    "changes": [
      "build_full_html 完全重写: 逐文件转换 + try-catch 隔离",
      "build_full_html: 所有 CSS 文件内联（主样式 + 深色主题 + 知识库）",
      "build_full_html: js/utils/ 目录纳入构建（SSEManager、确认弹窗等）",
      "应用韧性: load_file() 永不抛异常，build_full_html 有降级方案",
      "CI 优化: 部署仅需 lint 检查（打破 503 死循环）",
      "/api/status: 暴露 build_error 便于远程诊断",
      "错误提示: 显示实际错误信息而非通用文本"
    ]
  },
  {
    "version": "v10.0.0",
    "date": "2026-05-02 21:12",
    "title": "发布: v10.0.0 - V2 前端架构全面升级",
    "changes": [
      "重大版本: V2 前端架构全面升级",
      "架构变更:",
      "8 个核心模块（Store/Bus/Router/ErrorHandler/APIClient/Logger/Constants/Init）",
      "3 个服务模块（OpsSyncService/AlertChecker/AlertNotifier）",
      "8 个组件模块（icons/utils/feedback/layout/form/data-display/index/register）",
      "93 个页面模块文件，覆盖 16 个页面目录",
      "35 个 CSS 设计令牌（5 大类）",
      "Store 驱动的响应式数据流（运维页面）",
      "Router 集成路由守卫、历史记录和 Bus 事件",
      "质量保障:",
      "94 个单元测试（68 核心 + 26 服务）全部通过",
      "ESLint 10.x flat config（0 错误）",
      "CI/CD 流水线: lint + 前端测试 + 后端测试 + HF 部署",
      "迁移:",
      "全部 16 个页面从单文件迁移到模块化目录结构",
      "保留零构建架构（纯 Vanilla JS + IIFE）",
      "所有页面入口使用 ErrorHandler.wrap() 包裹",
      "data-action 事件委托替代内联 onclick",
      "Dynamic import() 懒加载子模块"
    ]
  },
  {
    "version": "v9.0.0",
    "date": "2026-05-02 18:03",
    "title": "chore: 更新版本号至 v9.0.0 + 更新 README 反映新架构",
    "changes": [
      "chore: 更新版本号至 v9.0.0 + 更新 README 反映新架构"
    ]
  },
  {
    "version": "v8.1.0",
    "date": "2026-05-02 12:33",
    "title": "style: 知识库概览页 Apple 极简风格重设计 (方案A)",
    "changes": [
      "style: 知识库概览页 Apple 极简风格重设计 (方案A)"
    ]
  },
  {
    "version": "v8.0.2",
    "date": "2026-05-02 12:18",
    "title": "fix: mcp_server.py _get_tools() append() syntax error (3 places)",
    "changes": [
      "fix: mcp_server.py _get_tools() append() syntax error (3 places)"
    ]
  },
  {
    "version": "v8.0.1",
    "date": "2026-05-02 03:28",
    "title": "release: v8.0.1 - 热修复 + 中文化",
    "changes": [
      "release: v8.0.1 - 热修复 + 中文化"
    ]
  },
  {
    "version": "v8.0.0",
    "date": "2026-05-02 02:23",
    "title": "release: v8.0.0 - 知识库增强大版本",
    "changes": [
      "release: v8.0.0 - 知识库增强大版本"
    ]
  },
  {
    "version": "v1.10.0",
    "date": "2026-04-28 20:30",
    "title": "release: v1.10.0 - 回收站 + 按钮事件修复",
    "changes": [
      "release: v1.10.0 - 回收站 + 按钮事件修复"
    ]
  },
  {
    "version": "v1.9.0",
    "date": "2026-04-28 19:44",
    "title": "release: v1.9.0 - 插件市场 + 数据动态化",
    "changes": [
      "release: v1.9.0 - 插件市场 + 数据动态化"
    ]
  },
  {
    "version": "v1.8.0",
    "date": "2026-04-28 19:22",
    "title": "release: v1.8.0 - 插件系统 + SVG图标 + 实时对话记录",
    "changes": [
      "release: v1.8.0 - 插件系统 + SVG图标 + 实时对话记录"
    ]
  },
  {
    "version": "v1.7.0",
    "date": "2026-04-28 18:41",
    "title": "feat: 会话模块合并 + 实时数据记录",
    "changes": [
      "会话模块合并:",
      "会话管理 + 会话对话合并为一个「会话」模块",
      "左侧会话列表 + 右侧对话区（类似聊天应用）",
      "搜索/状态筛选/创建/删除/压缩全部保留",
      "移除独立的「会话对话」页面",
      "实时数据记录:",
      "add_log() 自动将操作记录到最近活跃会话",
      "MCP 调用 → 自动写入系统消息到会话",
      "系统操作 → 自动写入系统消息到会话",
      "消息格式: [MCP] MCP 调用: read_memory — ...",
      "仪表盘最近会话自动显示实时数据",
      "侧边栏:",
      "12 个导航项 → 11 个（合并后减少一个）"
    ]
  },
  {
    "version": "v1.6.0",
    "date": "2026-04-28 17:56",
    "title": "feat: 配置版本管理 + 关于页面 + 系统配置重构",
    "changes": [
      "系统配置重构:",
      "移除工具/记忆/MCP 设置（归入各自模块页面）",
      "新增数据管理（会话保留天数/日志条数/导出格式）",
      "新增通知设置（SSE推送/操作通知/Agent通知）",
      "新增安全设置（API密钥/外部访问）",
      "新增高级设置（请求超时/最大并发）",
      "每次保存自动记录版本快照",
      "支持回滚到任意历史版本",
      "关于页面:",
      "项目信息（版本/运行时间/MCP工具数/API端点数）",
      "技术栈展示（后端/前端/协议/部署）",
      "版本变更记录（v1.0.0 ~ v1.6.0 共 7 个版本）",
      "GitHub/HuggingFace 链接",
      "后端 API:",
      "GET /api/config/versions: 获取版本历史",
      "POST /api/config/rollback/{index}: 回滚到指定版本",
      "PUT /api/config: 保存时自动创建版本快照",
      "配置版本持久化到 data/config_versions.json"
    ]
  },
  {
    "version": "v1.5.0",
    "date": "2026-04-28 17:43",
    "title": "feat: 前端全面管理权限 - 所有页面完整 CRUD",
    "changes": [
      "chat.js (会话对话):",
      "新建会话按钮 + 弹窗表单",
      "发送消息输入框（Enter 发送）",
      "删除会话按钮",
      "乐观更新 UI + 自动滚动",
      "sessions.js (会话管理):",
      "新建会话按钮",
      "状态筛选（活跃/完成）",
      "标题列显示",
      "移除 mock 数据",
      "tools.js (工具管理):",
      "每个工具卡片添加启用/禁用开关",
      "详情按钮",
      "点击卡片查看详情",
      "memory.js (记忆管理):",
      "导出按钮（下载 .md 文件）",
      "重置按钮（恢复默认模板）",
      "logs.js (操作日志):",
      "搜索框（按操作/详情/目标搜索）",
      "自动刷新开关（5秒间隔）",
      "关键词过滤",
      "后端:",
      "POST /api/sessions/{id}/messages: 添加消息到会话",
      "API.sessions.create() + API.sessions.addMessage()"
    ]
  },
  {
    "version": "v1.4.0",
    "date": "2026-04-28 17:35",
    "title": "feat: MCP 工具从 16 个扩展到 24 个，全面管理能力",
    "changes": [
      "新增 8 个 MCP 工具:",
      "update_skill: 更新技能内容",
      "delete_skill: 删除技能",
      "create_session: 创建会话",
      "add_message: 向会话添加消息",
      "delete_cron_job: 删除定时任务",
      "get_logs: 查看操作日志（支持来源过滤）",
      "get_config: 获取系统配置（敏感信息脱敏）",
      "update_config: 更新系统配置",
      "所有 MCP 调用自动记录到操作日志:",
      "来源标记为 'mcp'",
      "HF 前端操作日志页面可实时查看",
      "SSE 事件实时推送",
      "Trae 可通过 MCP 完整管理:",
      "会话: 创建/查看/搜索/删除/添加消息",
      "技能: 创建/查看/更新/删除",
      "记忆: 读取/写入",
      "定时任务: 创建/查看/删除",
      "配置: 查看/更新",
      "日志: 查看",
      "系统: 状态/仪表盘"
    ]
  },
  {
    "version": "v1.3.0",
    "date": "2026-04-28 17:01",
    "title": "feat: 数据真实化 - JSON 持久化 + 操作日志自动记录",
    "changes": [
      "会话数据真实化:",
      "新增 JSON 文件持久化（data/sessions.json）",
      "create_session: 创建会话并保存",
      "add_session_message: 向会话添加消息",
      "delete_session: 删除会话及其消息",
      "list_sessions: 优先 SQLite → JSON → 空列表（不再返回 demo）",
      "POST /api/sessions: 新增创建会话路由",
      "操作日志自动记录:",
      "EventEmitMiddleware 同时写入操作日志",
      "所有写操作（PUT/POST/DELETE）自动记录",
      "中文操作描述（更新记忆/创建技能/删除会话等）",
      "日志页面现在有真实数据",
      "记忆/技能/配置:",
      "之前已支持真实文件读写（MEMORY.md/USER.md/技能文件）",
      "Trae 通过 MCP 调用即可真正管理数据"
    ]
  },
  {
    "version": "v1.2.0",
    "date": "2026-04-28 16:41",
    "title": "feat: 仪表盘数据可视化 + API 文档",
    "changes": [
      "仪表盘新增 5 种 SVG 图表（纯前端，零依赖）:",
      "环形图: 会话来源分布（Trae/Web/CLI/API）",
      "柱状图: 模型使用频率",
      "折线图: 7 天会话趋势（渐变填充）",
      "仪表盘: 内存/CPU/活跃会话（圆环进度条）",
      "所有图表自适应深色模式",
      "API 文档:",
      "/docs: Swagger UI（交互式 API 测试）",
      "/redoc: ReDoc（阅读友好文档）",
      "/openapi.json: OpenAPI 3.0 规范",
      "自动发现 99 个端点",
      "侧边栏添加「API 文档」链接（新窗口打开）"
    ]
  },
  {
    "version": "v1.1.0",
    "date": "2026-04-28 16:06",
    "title": "feat: MCP 工具增强（10→16）+ 深色模式",
    "changes": [
      "MCP 新增 6 个工具：",
      "search_sessions: 搜索会话（按标题/模型/ID 模糊匹配）",
      "delete_session: 删除会话",
      "create_skill: 创建新技能",
      "write_user_profile: 写入用户画像",
      "list_cron_jobs: 列出定时任务",
      "create_cron_job: 创建定时任务",
      "深色模式：",
      "CSS 变量覆盖 [data-theme=dark]",
      "自动跟随系统主题偏好",
      "localStorage 持久化用户选择",
      "右下角切换按钮（🌙/☀️）",
      "Apple 深色风格配色"
    ]
  },
  {
    "version": "v1.0.0",
    "date": "2026-04-28 12:04",
    "title": "feat: Hermes Agent MCP Space - 管理面板 + MCP服务 + 魔搭部署",
    "changes": [
      "FastAPI 后端：28个REST API端点（会话/工具/技能/记忆/定时任务/子Agent/配置/MCP）",
      "Obsidian风格前端：暗色主题SPA管理面板（9个页面）",
      "MCP Server：24个工具暴露给Trae等MCP客户端（stdio+SSE双传输）",
      "Gradio SDK入口：一键部署到魔搭社区",
      "优雅降级：Hermes未安装时自动使用模拟数据"
    ]
  }
]
