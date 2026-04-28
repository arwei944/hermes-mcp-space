/**
 * Hermes Agent 管理面板 - 主应用
 * 路由管理、页面切换、全局事件绑定
 */

const App = (() => {
    // 页面注册表
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

    // 页面标题映射
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
    let _healthCheckTimer = null;

    /**
     * 初始化应用
     */
    function init() {
        // 初始化组件
        Components.Toast.init();
        Components.Modal.init();

        // 绑定全局事件
        bindGlobalEvents();

        // 启动健康检查
        startHealthCheck();

        // 监听路由变化
        window.addEventListener('hashchange', handleRoute);

        // 初始路由
        handleRoute();
    }

    /**
     * 路由处理
     */
    function handleRoute() {
        const hash = window.location.hash.slice(1) || 'dashboard';
        const pageName = pages[hash] ? hash : 'dashboard';

        navigateTo(pageName);
    }

    /**
     * 导航到指定页面
     */
    async function navigateTo(pageName) {
        if (!pages[pageName]) return;

        // 清理旧页面
        if (_currentPage && pages[_currentPage].destroy) {
            pages[_currentPage].destroy();
        }

        // 更新导航高亮
        updateNavActive(pageName);

        // 更新页面标题
        document.getElementById('pageTitle').textContent = pageTitles[pageName] || pageName;

        // 渲染新页面
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

        // 关闭移动端侧边栏
        closeMobileSidebar();
    }

    /**
     * 更新导航栏高亮状态
     */
    function updateNavActive(pageName) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === pageName);
        });
    }

    /**
     * 刷新当前页面
     */
    function refresh() {
        if (_currentPage && pages[_currentPage]) {
            pages[_currentPage].render();
        }
    }

    /**
     * 绑定全局事件
     */
    function bindGlobalEvents() {
        // 刷新按钮
        document.getElementById('refreshBtn').addEventListener('click', () => {
            refresh();
        });

        // 侧边栏折叠
        document.getElementById('sidebarToggle').addEventListener('click', toggleSidebar);

        // 移动端菜单按钮
        document.getElementById('mobileMenuBtn').addEventListener('click', openMobileSidebar);

        // 移动端遮罩点击关闭
        document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

        // 全局搜索
        document.getElementById('globalSearch').addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleGlobalSearch(e.target.value);
            }
        });

        // Ctrl+K 快捷键聚焦搜索
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                document.getElementById('globalSearch').focus();
            }
            // Esc 关闭模态框
            if (e.key === 'Escape') {
                Components.Modal.close();
                closeMobileSidebar();
            }
        });

        // 导航项点击
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                if (page) {
                    window.location.hash = page;
                }
            });
        });

        // 窗口大小变化
        window.addEventListener('resize', Components.debounce(() => {
            if (window.innerWidth > 768) {
                closeMobileSidebar();
            }
        }, 200));
    }

    /**
     * 全局搜索
     */
    function handleGlobalSearch(query) {
        if (!query.trim()) return;

        const term = query.toLowerCase().trim();

        // 简单的页面匹配
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

        Components.Toast.info(`未找到与 "${query}" 匹配的页面`);
    }

    /**
     * 侧边栏折叠/展开
     */
    function toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');

        // 保存状态
        localStorage.setItem('hermes-sidebar-collapsed', sidebar.classList.contains('collapsed'));
    }

    /**
     * 打开移动端侧边栏
     */
    function openMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.add('open');
        overlay.classList.add('active');
    }

    /**
     * 关闭移动端侧边栏
     */
    function closeMobileSidebar() {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebarOverlay');
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    /**
     * 健康检查
     */
    function startHealthCheck() {
        checkHealth();
        _healthCheckTimer = setInterval(checkHealth, 30000);
    }

    async function checkHealth() {
        const dot = document.getElementById('statusDot');
        const text = document.getElementById('statusText');

        if (!dot || !text) return;

        dot.className = 'status-dot checking';
        text.textContent = '检查中...';

        try {
            await API.system.health();
            dot.className = 'status-dot connected';
            text.textContent = '已连接';
        } catch (err) {
            dot.className = 'status-dot disconnected';
            text.textContent = '未连接';
        }
    }

    /**
     * 恢复侧边栏状态
     */
    function restoreSidebarState() {
        const collapsed = localStorage.getItem('hermes-sidebar-collapsed') === 'true';
        if (collapsed) {
            document.getElementById('sidebar').classList.add('collapsed');
        }
    }

    // 启动
    document.addEventListener('DOMContentLoaded', () => {
        restoreSidebarState();
        init();
    });

    return {
        init,
        refresh,
        navigateTo,
    };
})();
