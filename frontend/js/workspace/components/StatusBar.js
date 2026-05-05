/**
 * StatusBar.js - 顶部状态栏
 * 显示时间、搜索、通知、设置、SSE 连接状态
 * 使用 IIFE 包裹，暴露全局变量
 */
var StatusBar = (() => {
    'use strict';

    // ========== 状态 ==========
    var _container = null;
    var _clockTimer = null;
    var _stylesInjected = false;

    // DOM 引用
    var _searchBtn = null;
    var _notifBtn = null;
    var _notifBadge = null;
    var _sseDot = null;
    var _themeBtn = null;
    var _editBtn = null;
    var _clockEl = null;
    var _versionEl = null;

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;

        var css = `
            /* 状态栏容器 */
            .status-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 36px;
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 0 16px;
                background: rgba(255, 255, 255, 0.75);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                z-index: 8000;
                user-select: none;
                -webkit-user-select: none;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            /* 左侧区域 */
            .status-bar-left {
                display: flex;
                align-items: center;
                gap: 8px;
            }

            .status-bar-logo {
                font-size: 16px;
                line-height: 1;
            }

            .status-bar-title {
                font-size: 13px;
                font-weight: 600;
                color: #1a1a1a;
                letter-spacing: -0.2px;
            }

            .status-bar-version {
                font-size: 10px;
                color: #999;
                background: rgba(0, 0, 0, 0.05);
                padding: 1px 6px;
                border-radius: 4px;
                font-weight: 500;
            }

            /* 右侧区域 */
            .status-bar-right {
                display: flex;
                align-items: center;
                gap: 4px;
            }

            .status-bar-item {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 28px;
                height: 28px;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s;
                position: relative;
                font-size: 14px;
                line-height: 1;
            }

            .status-bar-item:hover {
                background: rgba(0, 0, 0, 0.06);
            }

            .status-bar-item:active {
                background: rgba(0, 0, 0, 0.1);
            }

            /* 通知角标 */
            .status-bar-badge {
                position: absolute;
                top: 2px;
                right: 2px;
                min-width: 14px;
                height: 14px;
                padding: 0 3px;
                border-radius: 7px;
                background: #ff3b30;
                color: #fff;
                font-size: 9px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                line-height: 1;
                box-shadow: 0 1px 3px rgba(255, 59, 48, 0.4);
            }

            /* SSE 连接状态点 */
            .status-bar-dot {
                display: inline-block;
                width: 8px;
                height: 8px;
                border-radius: 50%;
                transition: background 0.3s, box-shadow 0.3s;
            }

            .status-bar-dot.connected {
                background: #34c759;
                box-shadow: 0 0 6px rgba(52, 199, 89, 0.5);
            }

            .status-bar-dot.reconnecting {
                background: #ffcc00;
                box-shadow: 0 0 6px rgba(255, 204, 0, 0.5);
                animation: sse-pulse 1.5s ease-in-out infinite;
            }

            .status-bar-dot.disconnected {
                background: #8e8e93;
            }

            @keyframes sse-pulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.4; }
            }

            /* 时钟 */
            .status-bar-clock {
                font-size: 12px;
                color: #666;
                font-weight: 500;
                font-variant-numeric: tabular-nums;
                margin-left: 4px;
                padding-left: 8px;
                border-left: 1px solid rgba(0, 0, 0, 0.08);
                line-height: 1;
            }

            /* 深色模式 */
            @media (prefers-color-scheme: dark) {
                .status-bar {
                    background: rgba(30, 30, 30, 0.8);
                    border-bottom-color: rgba(255, 255, 255, 0.06);
                }

                .status-bar-title {
                    color: #f0f0f0;
                }

                .status-bar-version {
                    color: #888;
                    background: rgba(255, 255, 255, 0.08);
                }

                .status-bar-item:hover {
                    background: rgba(255, 255, 255, 0.08);
                }

                .status-bar-item:active {
                    background: rgba(255, 255, 255, 0.12);
                }

                .status-bar-clock {
                    color: #aaa;
                    border-left-color: rgba(255, 255, 255, 0.08);
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'statusBarStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ========== 渲染状态栏 ==========
    function render(container) {
        if (!container) {
            console.warn('[StatusBar] render() 缺少 container 参数');
            return;
        }

        _injectStyles();
        _container = container;

        _container.innerHTML = `
            <div class="status-bar">
                <div class="status-bar-left">
                    <span class="status-bar-logo" data-icon="home"></span>
                    <span class="status-bar-title">Hermes</span>
                    <span class="status-bar-version" id="sbVersion"></span>
                </div>
                <div class="status-bar-right">
                    <span class="status-bar-item" id="sbSearch" title="搜索 (⌘K)" data-icon="search"></span>
                    <span class="status-bar-item" id="sbNotif" title="通知">
                        🔔
                        <span class="status-bar-badge" id="sbNotifBadge" style="display:none">0</span>
                    </span>
                    <span class="status-bar-item" id="sbSSE" title="连接状态">
                        <span class="status-bar-dot disconnected" id="sbSSEDot"></span>
                    </span>
                    <span class="status-bar-item" id="sbTheme" title="切换主题" data-icon="moon"></span>
                    <span class="status-bar-item" id="sbEdit" title="编辑模式" data-icon="edit"></span>
                    <span class="status-bar-clock" id="sbClock"></span>
                </div>
            </div>
        `;

        // 缓存 DOM 引用
        _searchBtn = document.getElementById('sbSearch');
        _notifBtn = document.getElementById('sbNotif');
        _notifBadge = document.getElementById('sbNotifBadge');
        _sseDot = document.getElementById('sbSSEDot');
        _themeBtn = document.getElementById('sbTheme');
        _editBtn = document.getElementById('sbEdit');
        _clockEl = document.getElementById('sbClock');
        _versionEl = document.getElementById('sbVersion');

        // 启动时钟
        _startClock();

        // 绑定事件
        _bindEvents();

        // 更新 SVG 图标
        _updateIcons();

        // 更新版本号
        _updateVersion();
    }


    // ========== SVG Icon Update ==========
    function _setSvgIcon(el, iconName, size) {
        if (!el) return;
        if (typeof Components !== 'undefined' && Components.icon) {
            el.innerHTML = Components.icon(iconName, size || 16);
        }
    }

    function _updateIcons() {
        var items = [
            { id: 'sbLogo', icon: 'home', size: 16 },
            { id: 'sbSearch', icon: 'search', size: 16 },
            { id: 'sbNotif', icon: 'bell', size: 16 },
            { id: 'sbTheme', icon: 'moon', size: 16 },
            { id: 'sbEdit', icon: 'edit', size: 16 }
        ];
        for (var i = 0; i < items.length; i++) {
            var el = document.getElementById(items[i].id);
            if (el && el.getAttribute('data-icon')) {
                _setSvgIcon(el, items[i].icon, items[i].size);
            }
        }
    }

    // ========== 启动时钟 ==========
    function _startClock() {
        // 立即更新一次
        _updateClock();

        // 每分钟更新
        _clockTimer = setInterval(_updateClock, 30000);
    }

    // ========== 更新时钟显示 ==========
    function _updateClock() {
        if (!_clockEl) return;

        var now = new Date();
        var hours = String(now.getHours()).padStart(2, '0');
        var minutes = String(now.getMinutes()).padStart(2, '0');
        _clockEl.textContent = `${hours}:${minutes}`;
    }

    // ========== 绑定事件 ==========
    function _bindEvents() {
        // 搜索按钮 → 打开 SpotlightSearch
        if (_searchBtn) {
            _searchBtn.addEventListener('click', () => {
                if (typeof SpotlightSearch !== 'undefined') {
                    SpotlightSearch.toggle();
                }
            });
        }

        // 通知按钮 → 打开通知中心
        if (_notifBtn) {
            _notifBtn.addEventListener('click', () => {
                if (typeof CardOverlay !== 'undefined') {
                    CardOverlay.open('notifications');
                }
            });
        }

        // SSE 状态点击 → 显示连接信息
        if (_sseDot) {
            _sseDot.parentElement.addEventListener('click', () => {
                var status = _sseDot.classList.contains('connected') ? '已连接' :
                             _sseDot.classList.contains('reconnecting') ? '重连中' : '离线';
                // 可以用 toast 或其他方式显示
                console.log('[StatusBar] SSE 连接状态:', status);
            });
        }

        // 主题切换按钮
        if (_themeBtn) {
            _themeBtn.addEventListener('click', () => {
                _toggleTheme();
            });
        }

        // 编辑模式按钮
        if (_editBtn) {
            _editBtn.addEventListener('click', () => {
                _toggleEditMode();
            });
        }
    }

    // ========== 切换主题 ==========
    function _toggleTheme() {
        // 检测当前主题
        var isDark = document.documentElement.getAttribute('data-theme') === 'dark';

        // 切换
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'light');
            if (_themeBtn) _themeBtn.innerHTML = (typeof Components !== 'undefined' && Components.icon) ? Components.icon('moon', 16) : '🌙';
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (_themeBtn) _themeBtn.innerHTML = (typeof Components !== 'undefined' && Components.icon) ? Components.icon('sun', 16) : '☀️';
        }

        // 保存到 localStorage
        try {
            localStorage.setItem('hermes-theme', isDark ? 'light' : 'dark');
        } catch (e) {
            // 忽略存储错误
        }
    }

    // ========== 切换编辑模式 ==========
    function _toggleEditMode() {
        var isEditing = document.body.classList.toggle('edit-mode');
        if (_editBtn) {
            _editBtn.style.opacity = isEditing ? '1' : '';
            _editBtn.style.background = isEditing ? 'rgba(0, 122, 255, 0.15)' : '';
        }
        console.log('[StatusBar] 编辑模式:', isEditing ? '开启' : '关闭');
    }

    // ========== 更新版本号 ==========
    function _updateVersion() {
        if (!_versionEl) return;

        // 尝试从 HermesClient 获取版本
        if (typeof HermesClient !== 'undefined' && HermesClient.getAppVersion) {
            try {
                var version = HermesClient.getAppVersion();
                if (version) {
                    _versionEl.textContent = 'v' + version;
                    return;
                }
            } catch (e) {
                // 忽略错误
            }
        }

        // 尝试从全局变量获取
        if (typeof HERMES_VERSION !== 'undefined') {
            _versionEl.textContent = 'v' + HERMES_VERSION;
            return;
        }

        // 默认不显示版本号
        _versionEl.style.display = 'none';
    }

    // ========== 更新 SSE 连接状态 ==========
    function updateSSEStatus(connected) {
        if (!_sseDot) return;

        // 移除所有状态类
        _sseDot.classList.remove('connected', 'reconnecting', 'disconnected');

        if (connected === true) {
            _sseDot.classList.add('connected');
        } else if (connected === 'reconnecting') {
            _sseDot.classList.add('reconnecting');
        } else {
            _sseDot.classList.add('disconnected');
        }
    }

    // ========== 更新通知角标 ==========
    function updateNotifBadge(count) {
        if (!_notifBadge) return;

        count = parseInt(count, 10) || 0;

        if (count > 0) {
            _notifBadge.style.display = 'flex';
            _notifBadge.textContent = count > 99 ? '99+' : String(count);
        } else {
            _notifBadge.style.display = 'none';
        }
    }

    // ========== 销毁 ==========
    function destroy() {
        // 停止时钟
        if (_clockTimer) {
            clearInterval(_clockTimer);
            _clockTimer = null;
        }

        // 清空容器
        if (_container) {
            _container.innerHTML = '';
        }

        // 重置引用
        _container = null;
        _searchBtn = null;
        _notifBtn = null;
        _notifBadge = null;
        _sseDot = null;
        _themeBtn = null;
        _editBtn = null;
        _clockEl = null;
        _versionEl = null;
    }

    // ========== 公开 API ==========
    return {
        render: render,
        updateSSEStatus: updateSSEStatus,
        updateNotifBadge: updateNotifBadge,
        destroy: destroy
    };
})();

window.StatusBar = StatusBar;
