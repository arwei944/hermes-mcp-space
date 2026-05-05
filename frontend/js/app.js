/**
 * Hermes Workspace v17 - App Entry Point (Rewrite)
 *
 * 重写说明：
 * - 删除路由切换逻辑（navigateTo、handleRoute、pages 映射、Router 集成）
 * - 删除侧边栏逻辑（toggleSidebar、updateNavActive、openMobileSidebar、closeMobileSidebar）
 * - 删除全局搜索的页面跳转逻辑（handleGlobalSearch 中的 searchMap）
 * - 保留主题切换（initTheme、applyTheme）
 * - 保留 Toast/Modal 初始化
 * - 保留新手引导
 * - 新增 HermesClient.connect() 替代 SSEManager.connect()
 * - 新增 StatusBar.render() 初始化
 * - 新增 Dock.render() 初始化
 * - 新增 WorkspacePage.render() 作为主界面
 * - 保留 SSE 事件处理（改为 HermesClient.on）
 * - 保留热更新检查
 * - 保留全局快捷键（Cmd+K -> SpotlightSearch）
 */
(function () {
    'use strict';

    // ==================== 主题管理 ====================

    /**
     * 初始化主题
     */
    function initTheme() {
        var saved = null;
        try {
            saved = localStorage.getItem('hermes-theme');
        } catch (e) {
            // localStorage 不可用
        }
        if (saved) {
            applyTheme(saved);
        } else {
            // 跟随系统偏好
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
                applyTheme('dark');
            } else {
                applyTheme('light');
            }
        }
    }

    /**
     * 应用主题
     * @param {string} theme - 'light' | 'dark'
     */
    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        try {
            localStorage.setItem('hermes-theme', theme);
        } catch (e) {
            // ignore
        }
    }

    /**
     * 切换主题
     */
    function toggleTheme() {
        var current = document.documentElement.getAttribute('data-theme') || 'light';
        var next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next);
    }

    // ==================== 全局快捷键 ====================

    /**
     * 绑定全局事件
     */
    function bindGlobalEvents() {
        document.addEventListener('keydown', function (e) {
            var isCmd = e.metaKey || e.ctrlKey;

            // Cmd+K / Ctrl+K -> SpotlightSearch
            if (isCmd && e.key === 'k') {
                e.preventDefault();
                if (typeof SpotlightSearch !== 'undefined' && SpotlightSearch.toggle) {
                    SpotlightSearch.toggle();
                }
                return;
            }

            // Esc -> 关闭 CardOverlay + SpotlightSearch
            if (e.key === 'Escape') {
                if (typeof CardOverlay !== 'undefined' && CardOverlay.close) {
                    CardOverlay.close();
                }
                if (typeof SpotlightSearch !== 'undefined' && SpotlightSearch.close) {
                    SpotlightSearch.close();
                }
                return;
            }

            // E -> 切换编辑模式（不在输入框中时）
            if (e.key === 'e' && !e.target.matches('input, textarea, [contenteditable]')) {
                if (typeof WorkspacePage !== 'undefined' && WorkspacePage.toggleEditMode) {
                    WorkspacePage.toggleEditMode();
                }
                return;
            }
        });

        // 系统主题变化监听
        if (window.matchMedia) {
            try {
                window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
                    // 仅在用户未手动设置主题时跟随系统
                    var saved = null;
                    try { saved = localStorage.getItem('hermes-theme'); } catch (ex) {}
                    if (!saved) {
                        applyTheme(e.matches ? 'dark' : 'light');
                    }
                });
            } catch (e) {
                // matchMedia addEventListener 不支持时忽略
            }
        }
    }

    // ==================== SSE 事件处理 ====================

    /**
     * 注册 SSE 事件监听
     */
    function setupSSEEventHandlers() {
        if (typeof HermesClient === 'undefined') return;

        // 通用 SSE 事件广播
        HermesClient.on('sse:*', function (event, data) {
            // 通知当前卡片数据更新
            if (typeof WorkspacePage !== 'undefined' && WorkspacePage.onSSEEvent) {
                WorkspacePage.onSSEEvent(event, data);
            }

            // 通知 StatusBar 更新
            if (typeof StatusBar !== 'undefined' && StatusBar.onSSEEvent) {
                StatusBar.onSSEEvent(event, data);
            }
        });

        // 连接状态变化
        HermesClient.on('connection:change', function (status) {
            if (typeof StatusBar !== 'undefined' && StatusBar.updateConnectionStatus) {
                StatusBar.updateConnectionStatus(status);
            }
        });
    }

    // ==================== 热更新检查 ====================

    /**
     * 设置热更新检查
     */
    function setupHotUpdate() {
        if (typeof HermesClient === 'undefined') return;

        // 首次检查
        HermesClient.checkForUpdate();

        // 定期检查（30秒）
        HermesClient.startUpdateCheck(30000);
    }

    // ==================== 全局错误边界 ====================

    /**
     * 全局错误捕获
     */
    function setupGlobalErrorHandler() {
        window.addEventListener('error', function (event) {
            console.error('[App] Global error:', event.error);

            // 尝试通过 ErrorHandler 上报
            if (typeof ErrorHandler !== 'undefined' && ErrorHandler.handleError) {
                ErrorHandler.handleError(event.error || new Error(event.message), {
                    source: 'global-error-boundary',
                    filename: event.filename,
                    lineno: event.lineno,
                    colno: event.colno
                });
            }
        });

        window.addEventListener('unhandledrejection', function (event) {
            console.error('[App] Unhandled rejection:', event.reason);

            if (typeof ErrorHandler !== 'undefined' && ErrorHandler.handleError) {
                ErrorHandler.handleError(
                    event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
                    { source: 'unhandled-rejection' }
                );
            }
        });
    }

    // ==================== 主初始化 ====================

    /**
     * 应用初始化入口
     */
    function init() {
        console.log('[App] Initializing Hermes Workspace v17...');

        // 1. 全局初始化
        if (typeof Components !== 'undefined' && Components.Toast && Components.Toast.init) {
            Components.Toast.init();
        }
        if (typeof Components !== 'undefined' && Components.Modal && Components.Modal.init) {
            Components.Modal.init();
        }
        initTheme();

        // 2. 初始化 Workspace 基础设施
        if (typeof StateManager !== 'undefined' && StateManager.init) {
            StateManager.init();
        }

        // 3. 新手引导
        if (typeof Components !== 'undefined' && Components.Onboarding && !Components.Onboarding.isDone()) {
            setTimeout(function () {
                Components.Onboarding.start();
            }, 800);
        }

        // 4. 连接 SSE（通过 HermesClient）
        if (typeof HermesClient !== 'undefined') {
            HermesClient.connect('/api/events');
        }

        // 5. 初始化告警通知
        if (typeof AlertNotifier !== 'undefined' && AlertNotifier.init) {
            AlertNotifier.init();
        }

        // 6. 渲染工作台主界面
        var container = document.getElementById('workspaceContainer');
        if (container && typeof WorkspacePage !== 'undefined') {
            WorkspacePage.render(container);
        }

        // 7. 渲染 StatusBar
        if (typeof StatusBar !== 'undefined') {
            var statusBarEl = document.createElement('div');
            statusBarEl.id = 'statusBar';
            container.parentNode.insertBefore(statusBarEl, container);
            StatusBar.render(statusBarEl);
        }

        // 8. 渲染 Dock
        if (typeof Dock !== 'undefined') {
            var dockEl = document.createElement('div');
            dockEl.id = 'dock';
            document.body.appendChild(dockEl);
            Dock.render(dockEl);
        }

        // 9. 全局快捷键
        bindGlobalEvents();

        // 10. 热更新检查
        setupHotUpdate();

        // 11. SSE 事件处理
        setupSSEEventHandlers();

        // 12. 全局错误边界
        setupGlobalErrorHandler();

        console.log('[App] Hermes Workspace v17 initialized successfully.');
    }

    // ==================== DOM Ready ====================

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // ==================== 暴露全局 API ====================

    window.App = {
        init: init,
        initTheme: initTheme,
        applyTheme: applyTheme,
        toggleTheme: toggleTheme
    };

})();
