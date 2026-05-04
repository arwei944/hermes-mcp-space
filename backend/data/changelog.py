# Auto-generated changelog data
# Regenerate with: python3 scripts/gen_changelog.py
CHANGELOG_FALLBACK=[
  {
    "version": "v15.4.0",
    "date": "2026-05-05 06:30",
    "title": "feat: v15.4.0 — Agent 自由学习模式 (权限全开 + 审核自动通过)",
    "changes": [
      "feat: general 角色升级为完全权限 — 所有工具标签、所有高风险工具、所有规则分类读写、数据删除权限全部开放",
      "feat: 写入审核改为自动批准 — Agent 创建/更新规则、知识、经验、记忆后立即生效，不再等待人工审核",
      "feat: Agent 可以自由使用 shell_execute、github_operations、db_query 等全部工具来积累知识",
      "Version bump: 15.3.1 -> 15.4.0 (minor - 自由学习模式)"
    ]
  },
  {
    "version": "v15.3.1",
    "date": "2026-05-05 06:00",
    "title": "fix: v15.3.1 - 紧急修复 3 个 bug (agent_id 崩溃 + DB 表缺失 + 参数名不匹配)",
    "changes": [
      "fix: _call_tool 函数签名缺少 agent_id 参数，导致 mcp_hermes 全部 105 个工具崩溃 (P0)",
      "fix: 知识库 DB 表缺失 — get_knowledge_db() 现在自动检查并初始化 schema，不再依赖启动时单次调用 (P0)",
      "fix: search_sessions 参数名 keyword 改为 query，兼容旧参数名 (P1)",
      "fix: general 角色缺少 system 标签权限，导致基础工具 (get_system_status 等) 被拒绝访问 (P1)",
      "Version bump: 15.3 -> 15.3.1 (patch - hotfix)"
    ]
  },
  {
    "version": "v15.3",
    "date": "2026-05-05 05:30",
    "title": "feat: v15.3 - DEVPLAN 全量完成 (micro-squad + 双盲评审)",
    "changes": [
      "feat: 新增 micro_squad MCP 工具 — 标准化 Sprint 工作流 (THINK→PLAN→BUILD→VERIFY→SHIP)",
      "feat: micro-squad 支持 6 种命令 (squad/think/plan/build/verify/ship)，可完整 Sprint 或单阶段执行",
      "feat: 新增 dual_review MCP 工具 — 双盲评审 (两个 Judge Agent 并行审查 + 共识表裁决)",
      "feat: 双盲评审支持 FIX/TRIAGE/DISMISS 三种裁决，最多 2 轮迭代修复",
      "feat: DEVPLAN.md v3.1-v4.0 全部 17 项功能实现完成 (完成率 100%)",
      "release: v15.3 标志 DEVPLAN 路线图全部交付",
      "Version bump: 15.2 -> 15.3 (minor - DEVPLAN completion)"
    ]
  },
  {
    "version": "v15.2",
    "date": "2026-05-04 22:00",
    "title": "feat: v15.2 - 规则分类体系 + 规则守卫 + Agent 权限系统 (Phase 2)",
    "changes": [
      "feat: 扩展规则分类体系 — 8 种精细化分类 (safety/output_control/behavior/workflow/domain/coding/general/priority)，支持向后兼容旧分类名",
      "feat: context_budget_service 按分类权重精细分配预算 (safety 1.5x, priority 1.3x, behavior 1.2x 等)",
      "feat: 新增 RuleGuardService — 工具调用前自动检查规则合规性 (safety 硬拦截 + behavior 软警告 + 工具级 scope 精确匹配)",
      "feat: 新增 RuleGuardMiddleware — 集成到 MCP 中间件管道 (Logging → RuleGuard → ErrorHandling → AutoLearn)",
      "feat: 新增 PermissionService — 基于角色的 Agent 权限系统 (coder/researcher/general/admin 四种角色)",
      "feat: 权限控制覆盖工具访问 (标签白名单 + 高风险工具白名单 + 禁止列表)、规则读写权限、数据删除权限",
      "feat: 新增 check_permission MCP 工具 — Agent 可主动查询自身权限",
      "feat: Context 新增 agent_id 字段，pipeline.execute 传递 agent_id 到中间件链",
      "Version bump: 15.1 -> 15.2 (minor - Phase 2 rule guard + permissions)"
    ]
  },
  {
    "version": "v15.1",
    "date": "2026-05-04 20:39",
    "title": "release: v15.1 - 自进化系统 + session 修复",
    "changes": [
      "feat: 完整自进化系统实现 (Phase 0-5) - 修复12个自动化断点",
      "feat: integrate agent identity, session lifecycle, context injection into MCP server (Phase 1-3)",
      "feat: integrate all self-evolution systems into app entry point (Phase 0-5)",
      "feat: add smartness index and update deployment docs (Phase 4-5)",
      "feat: fix automation chain breakpoints (Phase 1-3)",
      "feat: enhance persistence layer with SQLite DB support (Phase 0)",
      "feat: add new services for self-evolution (Phase 0-5)",
      "fix: session lookup uses Mcp-Session-Id header instead of req_id",
      "fix: session_lifecycle.on_tool_call uses correct session ID",
      "fix: restore original app.py with self-evolution init blocks only",
      "feat: strong instructions that make Agent want to save memories",
      "feat: _capture_tool_content auto-extracts content from tool args",
      "Version bump: 14.5.3 -> 15.1 (major - self-evolution architecture)"
    ]
  },
  {
    "version": "v14.5.3",
    "date": "2026-05-04 17:08",
    "title": "fix(v14.5.3): 修复会话列表点击无反应（缺少onSelect回调）",
    "changes": [
      "fix: 会话列表点击无反应，根因为缺少 onSelect 回调绑定",
      "chore: Bump version to 14.5.3"
    ]
  },
  {
    "version": "v14.5.2",
    "date": "2026-05-04 17:05",
    "title": "fix(v14.5.2): 恢复about页面代码（仅移除侧边栏入口，保留功能）",
    "changes": [
      "fix: 恢复 about 页面代码，仅移除侧边栏入口，保留页面功能",
      "chore: Bump version to 14.5.2"
    ]
  },
  {
    "version": "v14.5.1",
    "date": "2026-05-04 17:02",
    "title": "refactor(v14.5.1): 移除\"关于\"和\"截图工具\"页面",
    "changes": [
      "refactor: 移除\"关于\"和\"截图工具\"页面",
      "chore: Bump version to 14.5.1"
    ]
  },
  {
    "version": "v14.5.0",
    "date": "2026-05-04 16:58",
    "title": "refactor(v14.5.0): 合并会话管理与对话为统一页面",
    "changes": [
      "refactor: 合并会话管理与对话为统一页面",
      "chore: Bump version to 14.5.0"
    ]
  },
  {
    "version": "v14.4.0",
    "date": "2026-05-04 16:45",
    "title": "fix(v14.4.0): 三合一修复 + 彻底消除部署遗漏风险",
    "changes": [
      "fix: 三合一修复，彻底消除部署遗漏风险",
      "chore: Bump version to 14.4.0"
    ]
  },
  {
    "version": "v14.3.2",
    "date": "2026-05-04 16:34",
    "title": "fix: v14.3.2 - 修复build_full_html缺少3个JS文件导致Components未定义",
    "changes": [
      "根因: app.py的build_full_html()内联JS时，硬编码的文件列表缺少:",
      "1. js/constants/config.js - AppConfig定义",
      "2. js/constants/colors.js - AppColors定义",
      "3. js/components/onboarding.js - _Onboarding定义",
      "components/index.js引用了_Onboarding但该文件未被内联，",
      "导致try-catch捕获ReferenceError后Components对象未被赋值，",
      "后续app.js使用Components.Toast时崩溃。",
      "修复: 在app.py的core_js和component_files列表中补全这3个文件。"
    ]
  },
  {
    "version": "v14.3.1",
    "date": "2026-05-04 16:14",
    "title": "fix: v14.3.1 - 修复Service Worker缓存未更新导致页面崩溃+图标缺失",
    "changes": [
      "修复内容:",
      "1. SW缓存版本 hermes-v8 → hermes-v9 (根因: v14.1-v14.3均未更新缓存版本)",
      "2. 添加缺失的 fileText 图标定义 (操作日志菜单)",
      "3. SW STATIC_ASSETS 添加 config.js 和 colors.js",
      "4. 修复脚本加载顺序: config.js/colors.js 移到 feedback.js 之前"
    ]
  },
  {
    "version": "v14.3.0",
    "date": "2026-05-04 15:57",
    "title": "refactor(v14.3.0): P2/P3 hardcoded improvements",
    "changes": [
      "feat: About page links dynamic from /api/meta (with fallback)",
      "feat: Z-Index CSS variable system (--z-sticky/dropdown/modal/overlay/toast)",
      "refactor: 3 files use var(--z-overlay) instead of hardcoded 9999",
      "fix: Unify localStorage key naming (hermes_onboarding_done -> hermes-onboarding-done)",
      "feat: Service Worker self-healing cache (auto-cache uncached GET requests)",
      "chore: Bump version to 14.3.0"
    ]
  },
  {
    "version": "v14.2.0",
    "date": "2026-05-04 15:51",
    "title": "refactor(v14.2.0): centralized config, colors from CSS vars",
    "changes": [
      "feat: Create AppConfig constants (API/SSE/OpsSync/UI/Data limits)",
      "feat: Create AppColors utility (reads CSS variables, theme-aware)",
      "refactor: charts.js palette uses AppColors (theme联动)",
      "refactor: OpsSyncService intervals use AppConfig (8 replacements)",
      "refactor: AlertChecker intervals use AppConfig (3 replacements)",
      "refactor: feedback.js durations use AppConfig (3 replacements)",
      "chore: Bump version to 14.2.0"
    ]
  },
  {
    "version": "v14.1.0",
    "date": "2026-05-04 15:44",
    "title": "refactor(v14.1.0): eliminate hardcoded API paths and dynamic alert thresholds",
    "changes": [
      "refactor: Add API.ops/dashboard/reviews/mcpServers namespaces (31 methods)",
      "refactor: Unify OpsSyncService to use API.ops.* (15 path replacements)",
      "refactor: Unify ErrorHandler/Logger error reporting to API.ops.reportFrontendError",
      "refactor: Unify MCPOperations/ReviewTab/Dashboard/ErrorTraceTab to API.* methods",
      "fix: Remove duplicate Base URL detection in APIClient.js",
      "feat: AlertChecker.loadRules() - dynamic thresholds from /api/ops/alerts/rules",
      "feat: AlertChecker.updateRules() - runtime threshold updates",
      "chore: Bump version to 14.1.0"
    ]
  },
  {
    "version": "v14.0.1",
    "date": "2026-05-04 15:32",
    "title": "hotfix(v14.0.1): fix app crash and missing icons",
    "changes": [
      "fix: Add missing ops-center/register.js script tag (app crash root cause)",
      "fix: Add 4 missing icon definitions (bookOpen, messageSquare, smile, sparkles)",
      "chore: Bump version to 14.0.1"
    ]
  },
  {
    "version": "v14.0.0",
    "date": "2026-05-04 15:10",
    "title": "feat(v14.0.0): engineering infrastructure upgrade",
    "changes": [
      "feat: Add GitHub Actions CI/CD (lint + version-check + HF deploy)",
      "feat: Strengthen ESLint rules (no-unused-vars, no-undef, no-eval as error)",
      "feat: Add lint/lint:fix scripts to package.json",
      "chore: Bump version to 14.0.0"
    ]
  },
  {
    "version": "v13.4.0",
    "date": "2026-05-04 15:06",
    "title": "refactor(v13.4.0): code quality governance",
    "changes": [
      "fix: Service Worker cache list updated to match actual modular file structure (v7->v8)",
      "refactor: Unify Tab component usage in knowledge page (Components.createTabs)",
      "feat: Enhance createTabs API with data-action delegation, icons, badges support",
      "refactor: Replace createLoading with createSkeleton in 4 pages (memory/cron/logs/knowledge)",
      "style: Extract all remaining inline styles from index.html to CSS classes",
      "verify: Event listener leak audit passed (all setInterval properly cleaned in destroy)",
      "chore: Bump version to 13.4.0"
    ]
  },
  {
    "version": "v13.3.0",
    "date": "2026-05-04 14:46",
    "title": "feat(v13.3.0): user experience optimization",
    "changes": [
      "feat: Add onboarding component (4-step first-visit guide)",
      "feat: Add stat card descriptions on dashboard (user-friendly explanations)",
      "fix: Replace raw JS errors with friendly Chinese error messages",
      "style: Increase base font size 13px -> 14px for better readability",
      "style: Increase nav section title 11px -> 12px",
      "style: Add fadeIn/fadeOut/scaleIn animations for onboarding",
      "chore: Bump version to 13.3.0"
    ]
  },
  {
    "version": "v13.2.0",
    "date": "2026-05-04 14:31",
    "title": "feat(v13.2.0): navigation restructuring and UX improvements",
    "changes": [
      "refactor: Reorganize sidebar from 4 groups to 7 (概览/对话/能力/数据/运维/系统/工具)",
      "feat: Rename menus to user-friendly names (扩展管理->功能商店, 子Agent->AI助手, etc.)",
      "feat: Add tooltip hints for 9 navigation items",
      "feat: Move API文档 and 关于 to sidebar bottom",
      "feat: Expand search map with new menu names (backward compatible)",
      "style: Extract opsCenterBadge inline styles to CSS class",
      "style: Add nav-badge and tooltip CSS with mobile responsive",
      "chore: Bump version to 13.2.0"
    ]
  },
  {
    "version": "v13.1.0",
    "date": "2026-05-04 14:23",
    "title": "fix(v13.1.0): P0 critical fixes and security hardening",
    "changes": [
      "fix: OpsSyncService route guard condition (ops_dashboard->ops_center)",
      "fix: Register about/chat/logs pages in App.routes (5 dead pages resolved)",
      "fix: Global search dead route mappings (ops_dashboard/ops_alerts->ops_center)",
      "fix: Remove duplicate ErrorHandler registration (initErrorBoundary removed)",
      "security: Add DOMPurify sanitization to renderMarkdown (XSS prevention)",
      "refactor: Unify _escapeHtml to Components.escapeHtml (DRY principle)",
      "fix: Store middleware interface mismatch in init.js",
      "feat: Add sidebar entries for logs and about pages",
      "chore: Bump version to 13.1.0"
    ]
  },
  {
    "version": "v13.0.0",
    "date": "2026-05-04 13:17",
    "title": "feat(v13.0.0): architecture unification and final release",
    "changes": [
      "Frontend improvements:",
      "Memory API deduplication: 3 parallel calls merged into 1",
      "Knowledge SSE: all tabs now refresh on SSE events (not just overview)",
      "Architecture:",
      "118 MCP tools total (12 new in Phase 3-5)",
      "13 cron jobs for full automation",
      "Event bus for inter-module communication",
      "Audit middleware for operation tracking",
      "Complete evolution closed-loop: extract→review→resolve→rule→skill→optimize",
      "Version bump: 12.7.0 -> 13.0.0 (major - architecture milestone)"
    ]
  },
  {
    "version": "v12.7.0",
    "date": "2026-05-04 13:13",
    "title": "feat(v12.7.0): Phase 3 - external service integration (DB, GitHub, Email)",
    "changes": [
      "New MCP tools (4):",
      "db_query: execute SQL queries with read-only safety mode",
      "db_manage_connections: manage DB connection configs (list/add/remove/test)",
      "github_operations: GitHub operations via gh CLI (search repos/code, list/create issues)",
      "email_operations: email send via SMTP, config management",
      "New services (3):",
      "DbPoolService: connection config management",
      "GithubClient: gh CLI wrapper",
      "EmailClient: SMTP client",
      "Zero external dependencies - all stdlib (sqlite3, subprocess, smtplib)",
      "Version bump: 12.6.0 -> 12.7.0"
    ]
  },
  {
    "version": "v12.6.0",
    "date": "2026-05-04 12:56",
    "title": "feat(v12.6.0): comprehensive ops automation",
    "changes": [
      "Ops automation:",
      "Session auto-compress: auto-compress sessions with 50+ messages",
      "ErrorTracker → experience: API errors auto-submitted as experiences",
      "Ops alert → notification: alerts auto-send webhook notifications",
      "New cron jobs:",
      "refresh_mcp: */10 * * * * (every 10 min)",
      "trash_cleanup: 0 4 * * 0 (weekly Sunday 4am)",
      "compat_sync: 0 4 * * * (daily 4am)",
      "weekly_skill_eval: 0 5 * * 0 (weekly Sunday 5am)",
      "Plugin auto-install: auto-install plugins marked auto_install on startup",
      "Version bump: 12.5.0 -> 12.6.0"
    ]
  },
  {
    "version": "v12.5.0",
    "date": "2026-05-04 12:51",
    "title": "feat(v12.5.0): chain-trigger evolution loop (extract→review→resolve→rule→skill)",
    "changes": [
      "New services:",
      "EvolutionChain: post-review chain (auto_resolve → experience_to_rule)",
      "DailyEvolution: daily tasks (cleanup + update + skill creation)",
      "ExtractScheduler: hourly knowledge extraction from recent sessions",
      "New endpoints:",
      "POST /api/knowledge/auto-chain: trigger evolution chain",
      "POST /api/knowledge/auto-extract: trigger knowledge extraction",
      "Cron jobs registered on startup:",
      "auto_chain: */30 * * * * (every 30 min)",
      "knowledge_extract: 0 * * * * (hourly)",
      "daily_evolution: 0 3 * * * (daily 3am)",
      "full_learning: 0 2 * * * (daily 2am)",
      "Event-driven: review.approved triggers evolution_chain automatically",
      "Policy sync: configure_review_policy updates cron schedule in real-time",
      "Version bump: 12.4.0 -> 12.5.0"
    ]
  },
  {
    "version": "v12.4.0",
    "date": "2026-05-04 12:42",
    "title": "feat(v12.4.0): bridge review-policy to cron, register AutoLearnMiddleware, implement EventBus",
    "changes": [
      "New services:",
      "ReviewScheduler: auto-create/update cron job from review_policy.json on startup",
      "EventBus: thread-safe in-process pub/sub for inter-module communication",
      "New endpoints:",
      "POST /api/reviews/auto-review: called by cron scheduler for auto-review",
      "Middleware:",
      "Registered AutoLearnMiddleware in MCP pipeline for automatic incremental learning",
      "Events:",
      "review.approved / review.rejected events emitted after review actions",
      "Version bump: 12.3.0 -> 12.4.0"
    ]
  },
  {
    "version": "v12.3.0",
    "date": "2026-05-04 12:30",
    "title": "fix(v12.3.0): fix frontend data rendering issues (Knowledge/Memory/SearchBar/Marketplace)",
    "changes": [
      "Fix Knowledge tabs data unwrapping: backend returns {success,data}, frontend extracts .data",
      "Fix OverviewTab stats unwrapping for all 5 stat endpoints",
      "Fix SearchBar: use .data instead of .results",
      "Fix Memory sessions: handle array response",
      "Fix Marketplace: API.request -> API.get",
      "Fix main.py: add 8 missing router registrations",
      "Version bump: 12.2.0 -> 12.3.0"
    ]
  },
  {
    "version": "v12.2.0",
    "date": "2026-05-04 02:58",
    "title": "feat(v12.2.0): Phase 2 - intelligent evolution closed-loop tools",
    "changes": [
      "New tools (7):",
      "Knowledge evolution:",
      "auto_resolve_experience: auto-check unresolved experiences against knowledge/rules, resolve covered ones",
      "experience_to_rule: convert high-frequency experiences into rules via review pipeline",
      "auto_cleanup_knowledge: detect duplicates, outdated, low-confidence entries; merge or remove",
      "knowledge_auto_update: analyze knowledge freshness and usage patterns, generate update suggestions",
      "Skill evolution:",
      "evaluate_skill: heuristic skill quality evaluation (quality_score, completeness, usage_hint)",
      "auto_create_skill_from_pattern: analyze session tool-call patterns, auto-create skills from repeated sequences",
      "auto_optimize_skill: auto-improve skill content structure and quality based on evaluation",
      "Version bump: 12.1.0 -> 12.2.0 (minor - 7 new tools, +1993 lines)"
    ]
  },
  {
    "version": "v12.1.0",
    "date": "2026-05-04 02:33",
    "title": "feat(v12.1.0): auto-init knowledge DB + Phase 1 auto-review tools",
    "changes": [
      "New features:",
      "Add init_knowledge_db() call on app startup to auto-create tables",
      "Add auto_review tool: smart auto-review with confidence scoring, risk detection, and configurable strategies (conservative/balanced/aggressive)",
      "Add batch_review tool: bulk approve/reject/smart-review pending items",
      "Add configure_review_policy tool: persistent review policy configuration with get/set/reset actions",
      "Version bump: 12.0.0 -> 12.1.0 (minor - new features)"
    ]
  },
  {
    "version": "v12.0.0",
    "date": "2026-05-03 00:18",
    "title": "release: v12.0.0 - Unified Ops Center + full observability",
    "changes": [
      "v12.0.0 Changes:",
      "Unified Ops Center (8 tabs): Overview, Pipeline, Resource, Quality, Errors, Alerts, Logs, About",
      "Frontend error reporting via sendBeacon (ErrorHandler + Logger)",
      "API error tracking via ErrorTrackerMiddleware (X-Trace-Id)",
      "Build validation (_validate_build) + build cache + auto-rollback",
      "CI deploy verification (status + page size check)",
      "AI Code Quality panel (evals API integration)",
      "7 new OpsSyncService channels (frontend errors, API errors, events, evals)",
      "Replaced 4 separate pages with 1 unified ops_center",
      "Version bump: 11.0.0 -> 12.0.0"
    ]
  },
  {
    "version": "v11.0.0",
    "date": "2026-05-02 23:20",
    "title": "release: v11.0.0 - Build system overhaul + ops resilience",
    "changes": [
      "v11.0.0 Changes:",
      "build_full_html: Complete rewrite with per-file transform + try-catch isolation",
      "build_full_html: All CSS files inlined (style + dark-theme + knowledge)",
      "build_full_html: js/utils/ directory included (SSEManager, confirm-dialog, etc.)",
      "App resilience: load_file() never throws, build_full_html has fallback",
      "CI: Deploy only needs lint (broke 503 death loop)",
      "/api/status: Exposes build_error for remote diagnosis",
      "Error toast: Shows actual error message instead of generic text",
      "Version bump: 10.0.0 -> 11.0.0"
    ]
  },
  {
    "version": "v10.0.0",
    "date": "2026-05-02 21:12",
    "title": "release: v10.0.0 - V2 Frontend Architecture",
    "changes": [
      "Major release: Complete V2 frontend architecture overhaul",
      "Architecture Changes:",
      "8 core modules (Store/Bus/Router/ErrorHandler/APIClient/Logger/Constants/Init)",
      "3 service modules (OpsSyncService/AlertChecker/AlertNotifier)",
      "8 component modules (icons/utils/feedback/layout/form/data-display/index/register)",
      "93 page module files across 16 page directories",
      "35 CSS Design Tokens (5 categories)",
      "Store-driven reactive data flow for ops pages",
      "Router with guards, history, and Bus integration",
      "Quality:",
      "94 unit tests (68 core + 26 service) all passing",
      "ESLint 10.x with flat config (0 errors)",
      "CI/CD pipeline with lint + frontend tests + backend tests + HF deploy",
      "Migration:",
      "All 16 pages migrated from single-file to modular directory structure",
      "Zero-build architecture preserved (pure Vanilla JS + IIFE)",
      "ErrorHandler.wrap() on all page entries",
      "data-action event delegation replacing inline onclick",
      "Dynamic import() lazy loading for sub-modules"
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
    "date": "2026-05-02 11:50",
    "title": "fix: 修复知识库搜索结果高亮和标签页切换问题",
    "changes": [
      "fix: 修复知识库搜索结果高亮和标签页切换问题"
    ]
  },
  {
    "version": "v8.0.1",
    "date": "2026-05-02 11:30",
    "title": "fix: 修复知识库详情页标签页切换和搜索过滤",
    "changes": [
      "fix: 修复知识库详情页标签页切换和搜索过滤"
    ]
  },
  {
    "version": "v8.0.0",
    "date": "2026-05-02 10:00",
    "title": "release: v8.0.0 - 知识库系统全面升级",
    "changes": [
      "release: v8.0.0 - 知识库系统全面升级"
    ]
  },
  {
    "version": "v7.0.0",
    "date": "2026-04-30 12:00",
    "title": "feat(v7.0.0): enterprise-grade upgrade - 37 tasks complete (#7)",
    "changes": [
      "feat(v7.0.0): enterprise-grade upgrade - 37 tasks complete (#7)"
    ]
  },
  {
    "version": "v6.0.0",
    "date": "2026-04-29 20:00",
    "title": "release: v6.0.0 - Dark Mode + ESLint",
    "changes": [
      "release: v6.0.0 - Dark Mode + ESLint"
    ]
  },
  {
    "version": "v5.0.0",
    "date": "2026-04-29 16:00",
    "title": "release: v5.0.0 - 管理面板重构",
    "changes": [
      "release: v5.0.0 - 管理面板重构"
    ]
  },
  {
    "version": "v4.8.0",
    "date": "2026-04-29 14:00",
    "title": "release: v4.8.0 - dark mode + ESLint",
    "changes": [
      "release: v4.8.0 - dark mode + ESLint"
    ]
  },
  {
    "version": "v4.0.0",
    "date": "2026-04-29 10:00",
    "title": "release: v4.0.0 - 生态扩展",
    "changes": [
      "release: v4.0.0 - 生态扩展"
    ]
  },
  {
    "version": "v3.1.0",
    "date": "2026-04-29 08:00",
    "title": "release: v3.1.0 - 工程层加固（AI 工程指南整合）",
    "changes": [
      "release: v3.1.0 - 工程层加固（AI 工程指南整合）"
    ]
  },
  {
    "version": "v2.1.0",
    "date": "2026-04-28 20:00",
    "title": "release: v2.1.0 - 第三方测试修复",
    "changes": [
      "release: v2.1.0 - 第三方测试修复"
    ]
  },
  {
    "version": "v2.0.0",
    "date": "2026-04-28 18:00",
    "title": "release: v2.0.0 - MCP Streamable HTTP",
    "changes": [
      "release: v2.0.0 - MCP Streamable HTTP"
    ]
  },
  {
    "version": "v1.0.0",
    "date": "2026-04-28 12:00",
    "title": "release: v1.0.0 - Hermes Agent MCP Space 初始版本",
    "changes": [
      "release: v1.0.0 - Hermes Agent MCP Space 初始版本"
    ]
  }
]

def _get_changelog_json():
    """Return changelog as a list of dicts."""
    return CHANGELOG_FALLBACK

def get_changelog(version=None):
    """Get changelog entries, optionally filtered by version."""
    entries = _get_changelog_json()
    if version:
        entries = [e for e in entries if e["version"] == version]
    return entries

def get_latest_version():
    """Get the latest version from changelog."""
    entries = _get_changelog_json()
    return entries[0]["version"] if entries else "unknown"
