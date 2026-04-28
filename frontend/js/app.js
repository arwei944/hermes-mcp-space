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
        plugins: PluginsPage,
        cron: CronPage,
        agents: AgentsPage,
        config: ConfigPage,
        mcp: McpPage,
        logs: LogsPage,
        about: AboutPage,
    };

    const pageTitles = {
        dashboard: '仪表盘',
        sessions: '会话',
        tools: '工具管理',
        skills: '技能系统',
        memory: '记忆管理',
        plugins: '插件市场',
        cron: '定时任务',
        agents: '子 Agent',
        config: '系统配置',
        mcp: 'MCP 服务',
        logs: '操作日志',
        about: '关于',
    };

    let _currentPage = null;
    let _sseConnection = null;

    function init() {
        Components.Toast.init();
        Components.Modal.init();
        bindGlobalEvents();
        initTheme();

        // 启动热更新检查
        API.checkForUpdate();
        API.startUpdateCheck(30000);

        // 检测后端连接状态
        checkBackendStatus();

        // 启动 SSE 实时事件监听
        connectSSE();

        // 初始路由
        handleRoute();
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
            if (dot) dot.style.background = '#22c55e';
            if (text) text.textContent = '已连接';
        } catch (err) {
            if (dot) dot.style.background = '#f59e0b';
            if (text) text.textContent = '降级模式';
        }
    }

    // --- SSE 实时事件 ---

    function connectSSE() {
        if (_sseConnection) {
            _sseConnection.close();
        }

        try {
            _sseConnection = new EventSource('/api/events');

            _sseConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    handleSSEEvent(data);
                } catch (err) {
                    // 忽略解析错误
                }
            };

            _sseConnection.onerror = () => {
                // 5 秒后自动重连
                setTimeout(connectSSE, 5000);
            };
        } catch (err) {
            // SSE 不可用时静默降级
            setTimeout(connectSSE, 10000);
        }
    }

    function handleSSEEvent(event) {
        const type = event.type || '';
        const data = event.data || {};

        // 事件类型 → 通知消息映射
        const messages = {
            'memory.updated': '📝 记忆已更新',
            'skill.created': '⚡ 新技能已创建',
            'skill.updated': '⚡ 技能已更新',
            'skill.deleted': '⚡ 技能已删除',
            'tool.toggled': '🔧 工具状态已变更',
            'cron.created': '⏰ 定时任务已创建',
            'cron.updated': '⏰ 定时任务已更新',
            'cron.deleted': '⏰ 定时任务已删除',
            'cron.triggered': '▶️ 定时任务已触发',
            'session.deleted': '💬 会话已删除',
            'session.compressed': '💬 会话已压缩',
            'config.updated': '⚙️ 配置已更新',
            'mcp.restarted': '🔌 MCP 服务已重启',
        };

        const msg = messages[type];
        if (msg) {
            Components.Toast.info(msg);
        }

        // 如果当前在仪表盘或日志页面，自动刷新
        if (_currentPage === 'dashboard' || _currentPage === 'logs') {
            clearTimeout(App._refreshTimer);
            App._refreshTimer = setTimeout(() => refresh(), 1000);
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
            '会话': 'sessions', '对话': 'chat', '聊天': 'chat',
            '工具': 'tools', '函数': 'tools',
            '技能': 'skills', 'skill': 'skills',
            '记忆': 'memory', 'memory': 'memory',
            '定时': 'cron', '任务': 'cron', 'cron': 'cron', '调度': 'cron',
            'agent': 'agents', '子agent': 'agents', '子代理': 'agents',
            'mcp': 'mcp', '服务': 'mcp',
            '日志': 'logs', 'log': 'logs', '操作': 'logs',
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
