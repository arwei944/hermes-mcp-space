/**
 * Hermes Agent 管理面板 - 主应用 (Mac 极简风格)
 * 路由管理、页面切换、全局事件绑定
 */

const App = (() => {
    const pages = {
        dashboard: DashboardPage,
        sessions: SessionsPage,
        tools: ToolsPage,
        skills: SkillsPage,
        memory: MemoryPage,
        cron: CronPage,
        agents: AgentsPage,
        config: ConfigPage,
        mcp: McpPage,
    };

    const pageTitles = {
        dashboard: '仪表盘',
        sessions: '会话管理',
        tools: '工具管理',
        skills: '技能系统',
        memory: '记忆管理',
        cron: '定时任务',
        agents: '子 Agent',
        config: '系统配置',
        mcp: 'MCP 服务',
    };

    let _currentPage = null;

    function init() {
        Components.Toast.init();
        Components.Modal.init();
        bindGlobalEvents();

        // 启动热更新检查
        API.checkForUpdate();
        API.startUpdateCheck(30000);

        // 初始路由
        handleRoute();
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
                '⚠️', '页面加载失败',
                err.message || '未知错误',
                `<button class="btn btn-primary" onclick="App.refresh()">重试</button>`
            );
        }

        closeMobileSidebar();
    }

    function updateNavActive(pageName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });
    }

    function refresh() {
        if (_currentPage && pages[_currentPage]) {
            pages[_currentPage].render();
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
        document.querySelectorAll('.nav-item').forEach(item => {
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
        window.addEventListener('resize', Components.debounce(() => {
            if (window.innerWidth > 768) closeMobileSidebar();
        }, 200));
    }

    function handleGlobalSearch(query) {
        if (!query.trim()) return;
        const term = query.toLowerCase().trim();
        const searchMap = {
            '仪表盘': 'dashboard', '统计': 'dashboard', '概览': 'dashboard',
            '会话': 'sessions', '对话': 'sessions', '聊天': 'sessions',
            '工具': 'tools', '函数': 'tools',
            '技能': 'skills', 'skill': 'skills',
            '记忆': 'memory', 'memory': 'memory',
            '定时': 'cron', '任务': 'cron', 'cron': 'cron', '调度': 'cron',
            'agent': 'agents', '子agent': 'agents', '子代理': 'agents',
            'mcp': 'mcp', '服务': 'mcp',
            '配置': 'config', '设置': 'config', 'config': 'config',
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

    document.addEventListener('DOMContentLoaded', init);

    return { init, refresh, navigateTo };
})();
