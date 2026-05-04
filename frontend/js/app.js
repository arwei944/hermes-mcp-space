/**
 * Hermes Agent 管理面板 - 主应用 (Mac 极简风格)
 * 路由管理、页面切换、全局事件绑定
 */

const App = (() => {
    // 直接引用全局 Page 变量（const 声明的全局变量不会挂到 window 上）
    const pages = {
        dashboard: DashboardPage,
        knowledge: KnowledgePage,
        sessions: SessionsPage,
        marketplace: MarketplacePage,
        memory: MemoryPage,
        cron: CronPage,
        agents: AgentsPage,
        agents_behavior: AgentsBehaviorPage,
        config: ConfigPage,
        trash: TrashPage,
        screenshot: ScreenshotPage,
        sync: SyncPage,
        ops_center: OpsCenterPage,
        about: AboutPage,
        chat: ChatPage,
        logs: LogsPage,
    };

    const pageTitles = {
        dashboard: '仪表盘',
        knowledge: '知识库',
        sessions: '会话管理',
        marketplace: '功能商店',
        memory: '记忆管理',
        cron: '定时任务',
        agents: 'AI 助手',
        agents_behavior: '性格设置',
        config: '系统配置',
        trash: '回收站',
        screenshot: '截图工具',
        sync: '备份恢复',
        ops_center: '运维中心',
        about: '关于',
        chat: '对话',
        logs: '操作日志',
    };

    let _currentPage = null;

    function init() {
        // 全局错误边界 - 增强版
        Components.Toast.init();
        Components.Modal.init();
        bindGlobalEvents();
        initTheme();
        replaceNavIcons();

        // 初始化 Router 并注册所有路由
        initRouter();

        // 初始化告警通知服务
        if (typeof AlertNotifier !== 'undefined') AlertNotifier.init();

        // 路由守卫：运维页面时启动同步和告警检查
        if (typeof Router !== 'undefined') {
            Router.guard(function(to) {
                if (to === 'ops_center') {
                    if (typeof OpsSyncService !== 'undefined') OpsSyncService.start();
                    if (typeof AlertChecker !== 'undefined') AlertChecker.start();
                } else {
                    if (typeof OpsSyncService !== 'undefined') OpsSyncService.stop();
                    if (typeof AlertChecker !== 'undefined') AlertChecker.stop();
                }
            });
        }

        // 预加载版本元数据
        API.meta();

        // 启动热更新检查
        API.checkForUpdate();
        API.startUpdateCheck(30000);

        // 检测后端连接状态
        checkBackendStatus();

        // 启动 SSE 实时事件监听（带轮询降级 V7-19）
        connectSSE();

        // 监听 SSEManager 派发的事件
        window.addEventListener('hermes:event', function (e) {
            var event = e.detail;
            if (event && event.data) {
                handleSSEEvent(event.data);
            }
        });

        // 初始路由
        handleRoute();
    }

    // --- Router 集成 ---

    function initRouter() {
        if (typeof Router === 'undefined') return;

        // 注册所有路由
        const routesMap = {};
        Object.keys(pages).forEach(function(key) {
            routesMap[key] = {
                title: pageTitles[key] || key,
                component: pages[key]
            };
        });
        Router.registerAll(routesMap);

        // 路由守卫：切换页面时更新导航状态
        Router.guard(function(to, from) {
            updateNavActive(to);
            document.getElementById('pageTitle').textContent = pageTitles[to] || to;
        });

        // 初始化 hash 监听
        Router.init();

        // 监听 Router 事件进行页面切换
        if (typeof Bus !== 'undefined' && typeof Events !== 'undefined') {
            Bus.on(Events.PAGE_CHANGED, function(data) {
                var path = data.path;
                if (pages[path]) {
                    // 销毁旧页面
                    if (_currentPage && pages[_currentPage] && pages[_currentPage].destroy) {
                        pages[_currentPage].destroy();
                    }
                    _currentPage = path;
                    // 渲染新页面
                    pages[path].render().catch(function(err) {
                        if (typeof Logger !== 'undefined') Logger.error('[App]', '页面 ' + path + ' 渲染失败:', err);
                        document.getElementById('contentBody').innerHTML = Components.createEmptyState(
                            Components.icon('alertTriangle', 14),
                            '页面加载失败',
                            err.message || '未知错误',
                            '<button class="btn btn-primary" onclick="App.refresh()">重试</button>'
                        );
                    });
                    closeMobileSidebar();
                }
            });
        }

        if (typeof Logger !== 'undefined') Logger.info('[App]', 'Router initialized with ' + Object.keys(routesMap).length + ' routes');
    }

    function initTheme() {
        const saved = localStorage.getItem('hermes-theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const isDark = saved === 'dark' || (!saved && prefersDark);
        applyTheme(isDark);

        document.getElementById('themeToggle').addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') === 'dark';
            applyTheme(!current);
        });
    }

    function applyTheme(isDark) {
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        const btn = document.getElementById('themeToggle');
        if (btn) btn.innerHTML = Components.icon(isDark ? 'sun' : 'moon', 18);
        localStorage.setItem('hermes-theme', isDark ? 'dark' : 'light');
    }

    async function checkBackendStatus() {
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');
        try {
            await API.system.health();
            if (dot) dot.style.background = 'var(--green)';
            if (text) text.textContent = '已连接';
        } catch (_err) {
            if (dot) dot.style.background = 'var(--orange)';
            if (text) text.textContent = '降级模式';
        }
    }

    // --- SSE 实时事件（V7-19: 使用 SSEManager 带轮询降级） ---

    function connectSSE() {
        SSEManager.connect('/api/events');
    }

    function handleSSEEvent(event) {
        const type = event.type || '';
        const data = event.data || {};

        // 传递给当前页面的 onSSEEvent 方法（实时增量更新）
        const page = pages[_currentPage];
        if (page && typeof page.onSSEEvent === 'function') {
            try {
                page.onSSEEvent(type, data);
            } catch (_e) {
                /* ignore */
            }
        }
    }

    function handleRoute() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const pageName = pages[hash] ? hash : 'dashboard';
        navigateTo(pageName);
    }

    async function navigateTo(pageName) {
        if (!pages[pageName]) return;

        if (_currentPage && pages[_currentPage].destroy) {
            pages[_currentPage].destroy();
        }

        updateNavActive(pageName);
        document.getElementById('pageTitle').textContent = pageTitles[pageName] || pageName;

        const page = pages[pageName];
        _currentPage = pageName;

        try {
            await page.render();
        } catch (err) {
            console.error(`[App] 页面 ${pageName} 渲染失败:`, err);
            document.getElementById('contentBody').innerHTML = Components.createEmptyState(
                Components.icon('alertTriangle', 14),
                '页面加载失败',
                err.message || '未知错误',
                `<button class="btn btn-primary" onclick="App.refresh()">重试</button>`,
            );
        }

        closeMobileSidebar();
    }

    function updateNavActive(pageName) {
        document.querySelectorAll('.nav-item').forEach((item) => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });
    }

    function refresh() {
        if (_currentPage && pages[_currentPage]) {
            pages[_currentPage].render();
        }
    }

    function replaceNavIcons() {
        document.querySelectorAll('.nav-icon[data-icon]').forEach((el) => {
            const name = el.getAttribute('data-icon');
            if (name) {
                el.innerHTML = Components.icon(name, 16);
            }
        });
        // 主题切换按钮
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn) {
            const iconName = themeBtn.getAttribute('data-icon') || 'moon';
            themeBtn.innerHTML = Components.icon(iconName, 16);
        }
    }

    function bindGlobalEvents() {
        // 刷新按钮
        document.getElementById('refreshBtn').addEventListener('click', () => {
            refresh();
            showToast('已刷新');
        });

        // 移动端菜单
        document.getElementById('mobileMenuBtn').addEventListener('click', openMobileSidebar);
        document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

        // 全局搜索
        document.getElementById('globalSearch').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleGlobalSearch(e.target.value);
        });

        // 快捷键
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('globalSearch').focus();
            }
            if (e.key === 'Escape') {
                Components.Modal.close();
                closeMobileSidebar();
            }
        });

        // 导航切换 (Mac 风格: .nav-item click -> .page active)
        document.querySelectorAll('.nav-item').forEach((item) => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    window.location.hash = page;
                }
            });
        });

        // 监听 hash 变化
        window.addEventListener('hashchange', handleRoute);

        // 窗口大小变化
        window.addEventListener(
            'resize',
            Components.debounce(() => {
                if (window.innerWidth > 768) closeMobileSidebar();
            }, 200),
        );
    }

    function handleGlobalSearch(query) {
        if (!query.trim()) return;
        const term = query.toLowerCase().trim();
        const searchMap = {
            仪表盘: 'dashboard', 统计: 'dashboard', 概览: 'dashboard', 总览: 'dashboard',
            知识库: 'knowledge', 知识: 'knowledge', 规则: 'knowledge',
            会话: 'sessions', 会话管理: 'sessions', 历史: 'sessions', 聊天记录: 'sessions',
            对话: 'chat', 聊天: 'chat',
            功能商店: 'marketplace', 扩展管理: 'marketplace', 扩展: 'marketplace',
            工具: 'marketplace', 函数: 'marketplace', 技能: 'marketplace', skill: 'marketplace',
            mcp: 'marketplace', 服务: 'marketplace', 插件: 'marketplace',
            AI助手: 'agents', 助手: 'agents', agent: 'agents', 子agent: 'agents', 子代理: 'agents',
            性格: 'agents_behavior', 人格: 'agents_behavior', 行为: 'agents_behavior', 行为管理: 'agents_behavior',
            记忆: 'memory', memory: 'memory', 画像: 'memory',
            定时: 'cron', 任务: 'cron', cron: 'cron', 调度: 'cron', 计划任务: 'cron',
            运维: 'ops_center', 监控: 'ops_center', ops: 'ops_center', 健康: 'ops_center',
            告警: 'ops_center', 报警: 'ops_center', alert: 'ops_center',
            日志: 'logs', log: 'logs', 操作: 'logs', 操作日志: 'logs',
            备份: 'sync', 同步: 'sync', 恢复: 'sync', 更新: 'sync',
            配置: 'config', 设置: 'config', config: 'config',
            回收站: 'trash', 删除: 'trash',
            截图: 'screenshot',
            关于: 'about', 帮助: 'about',
        };
        for (const [keyword, page] of Object.entries(searchMap)) {
            if (keyword.includes(term) || term.includes(keyword)) {
                window.location.hash = page;
                document.getElementById('globalSearch').value = '';
                return;
            }
        }
        showToast(`未找到与 "${query}" 匹配的页面`, 'info');
    }

    function openMobileSidebar() {
        document.getElementById('sidebar').classList.add('open');
        document.getElementById('sidebarOverlay').classList.add('active');
    }

    function closeMobileSidebar() {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebarOverlay').classList.remove('active');
    }

    // --- 全局错误边界 ---

    document.addEventListener('DOMContentLoaded', init);

    return { init, refresh, navigateTo };
})();
