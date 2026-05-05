/**
 * CardOverlay.js - 卡片放大系统
 * 点击卡片时放大为 xlarge overlay，替代原来的 PanelManager
 * 使用 IIFE 包裹，暴露全局变量
 */
var CardOverlay = (() => {
    'use strict';

    // ========== 状态 ==========
    var _isOpen = false;
    var _currentCardId = null;
    var _currentData = null;
    var _navStack = [];       // 卡片内导航栈（列表→详情→...）
    var _cleanupFns = [];     // 清理函数列表
    var _animFrameId = null;  // 动画帧 ID

    // DOM 引用（延迟获取）
    var _overlay = null;
    var _container = null;
    var _body = null;
    var _header = null;
    var _backBtn = null;
    var _closeBtn = null;
    var _backdrop = null;

    // 样式是否已注入
    var _stylesInjected = false;

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;

        var css = `
            /* 卡片放大遮罩层 */
            .card-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                visibility: hidden;
                transition: opacity 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                            visibility 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
            }

            /* 激活状态 */
            .card-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            /* 背景遮罩 */
            .card-overlay-backdrop {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.4);
                backdrop-filter: blur(8px);
                -webkit-backdrop-filter: blur(8px);
            }

            /* 内容容器 */
            .card-overlay-content {
                position: relative;
                width: 90%;
                max-width: 900px;
                max-height: 85vh;
                display: flex;
                flex-direction: column;
                border-radius: 24px;
                background: rgba(255, 255, 255, 0.85);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25),
                            0 8px 32px rgba(0, 0, 0, 0.1);
                transform: scale(0.9);
                opacity: 0;
                transition: transform 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                            opacity 300ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
                overflow: hidden;
            }

            .card-overlay.active .card-overlay-content {
                transform: scale(1);
                opacity: 1;
            }

            /* 头部 */
            .card-overlay-header {
                display: flex;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.08);
                flex-shrink: 0;
                gap: 12px;
            }

            .card-overlay-back {
                display: none;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border: none;
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.05);
                color: #333;
                font-size: 16px;
                cursor: pointer;
                transition: background 0.2s;
                flex-shrink: 0;
            }

            .card-overlay-back:hover {
                background: rgba(0, 0, 0, 0.1);
            }

            .card-overlay-back.visible {
                display: flex;
            }

            .card-overlay-title {
                display: flex;
                align-items: center;
                gap: 10px;
                flex: 1;
                min-width: 0;
                font-size: 16px;
                font-weight: 600;
                color: #1a1a1a;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .card-overlay-icon {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border-radius: 8px;
                font-size: 16px;
                flex-shrink: 0;
            }

            .card-overlay-close {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 32px;
                height: 32px;
                border: none;
                border-radius: 8px;
                background: rgba(0, 0, 0, 0.05);
                color: #666;
                font-size: 20px;
                cursor: pointer;
                transition: background 0.2s, color 0.2s;
                flex-shrink: 0;
                line-height: 1;
            }

            .card-overlay-close:hover {
                background: rgba(255, 59, 48, 0.1);
                color: #ff3b30;
            }

            /* 内容主体 */
            .card-overlay-body {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 20px;
                -webkit-overflow-scrolling: touch;
            }

            /* 滚动条美化 */
            .card-overlay-body::-webkit-scrollbar {
                width: 6px;
            }

            .card-overlay-body::-webkit-scrollbar-track {
                background: transparent;
            }

            .card-overlay-body::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.15);
                border-radius: 3px;
            }

            .card-overlay-body::-webkit-scrollbar-thumb:hover {
                background: rgba(0, 0, 0, 0.25);
            }

            /* 深色模式 */
            @media (prefers-color-scheme: dark) {
                .card-overlay-content {
                    background: rgba(30, 30, 30, 0.9);
                    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5),
                                0 8px 32px rgba(0, 0, 0, 0.3);
                }

                .card-overlay-header {
                    border-bottom-color: rgba(255, 255, 255, 0.08);
                }

                .card-overlay-title {
                    color: #f0f0f0;
                }

                .card-overlay-back,
                .card-overlay-close {
                    background: rgba(255, 255, 255, 0.08);
                    color: #ccc;
                }

                .card-overlay-back:hover {
                    background: rgba(255, 255, 255, 0.15);
                }

                .card-overlay-close:hover {
                    background: rgba(255, 59, 48, 0.2);
                    color: #ff6b6b;
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'cardOverlayStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ========== 创建 DOM 结构 ==========
    function _createDOM() {
        // 如果已存在则复用
        _overlay = document.getElementById('cardOverlay');
        if (_overlay) return;

        _overlay = document.createElement('div');
        _overlay.id = 'cardOverlay';
        _overlay.className = 'card-overlay';
        _overlay.innerHTML = `
            <div class="card-overlay-backdrop"></div>
            <div class="card-overlay-content">
                <div class="card-overlay-header">
                    <button class="card-overlay-back" title="返回">&#8592; 返回</button>
                    <div class="card-overlay-title">
                        <span class="card-overlay-icon"></span>
                        <span class="card-overlay-title-text"></span>
                    </div>
                    <button class="card-overlay-close" title="关闭">&times;</button>
                </div>
                <div class="card-overlay-body"></div>
            </div>
        `;

        document.body.appendChild(_overlay);

        // 缓存 DOM 引用
        _backdrop = _overlay.querySelector('.card-overlay-backdrop');
        _container = _overlay.querySelector('.card-overlay-content');
        _header = _overlay.querySelector('.card-overlay-header');
        _backBtn = _overlay.querySelector('.card-overlay-back');
        _closeBtn = _overlay.querySelector('.card-overlay-close');
        _body = _overlay.querySelector('.card-overlay-body');
    }

    // ========== 渲染头部 ==========
    function _renderHeader(title, icon, iconBg, showBack) {
        var iconEl = _overlay.querySelector('.card-overlay-icon');
        var titleEl = _overlay.querySelector('.card-overlay-title-text');

        // 设置图标
        if (iconEl) {
            iconEl.textContent = icon || '';
            iconEl.style.background = iconBg || 'linear-gradient(135deg, #667eea, #764ba2)';
        }

        // 设置标题
        if (titleEl) {
            titleEl.textContent = title || '';
        }

        // 返回按钮显示/隐藏
        if (_backBtn) {
            if (showBack) {
                _backBtn.classList.add('visible');
            } else {
                _backBtn.classList.remove('visible');
            }
        }
    }

    // ========== 渲染卡片内容 ==========
    function _renderContent(cardId, size, data) {
        // 清空内容区
        _body.innerHTML = '';

        // 尝试从 WidgetRegistry 获取渲染函数
        var renderer = null;
        if (typeof WidgetRegistry !== 'undefined' && WidgetRegistry.getRenderer) {
            renderer = WidgetRegistry.getRenderer(cardId);
        }

        if (renderer && typeof renderer === 'function') {
            // 使用注册的渲染函数
            renderer(_body, { size: size || 'xlarge', data: data || {} });
        } else {
            // 无渲染函数时显示占位内容
            _body.innerHTML = `
                <div style="text-align:center; padding:40px; color:#999;">
                    <div style="font-size:48px; margin-bottom:16px;">📦</div>
                    <div style="font-size:16px;">卡片组件 "${cardId}" 暂无渲染器</div>
                    <div style="font-size:13px; margin-top:8px; color:#bbb;">
                        请在 WidgetRegistry 中注册对应的渲染函数
                    </div>
                </div>
            `;
        }
    }

    // ========== 打开卡片放大视图 ==========
    function open(cardId, data) {
        if (!cardId) {
            console.warn('[CardOverlay] open() 缺少 cardId 参数');
            return;
        }

        // 如果已经打开，先关闭再打开
        if (_isOpen) {
            _cleanup();
        }

        // 注入样式 & 创建 DOM
        _injectStyles();
        _createDOM();

        // 更新状态
        _isOpen = true;
        _currentCardId = cardId;
        _currentData = data || null;
        _navStack = [];
        _cleanupFns = [];

        // 获取卡片元信息
        var meta = _getCardMeta(cardId);

        // 渲染头部
        _renderHeader(meta.title, meta.icon, meta.iconBg, false);

        // 渲染内容
        _renderContent(cardId, 'xlarge', data);

        // 绑定事件
        _bindEvents();

        // 触发打开动画
        requestAnimationFrame(() => {
            _overlay.classList.add('active');
        });

        // 锁定 body 滚动
        document.body.style.overflow = 'hidden';
    }

    // ========== 获取卡片元信息 ==========
    function _getCardMeta(cardId) {
        // 尝试从 WidgetRegistry 获取
        if (typeof WidgetRegistry !== 'undefined' && WidgetRegistry.getMeta) {
            var meta = WidgetRegistry.getMeta(cardId);
            if (meta) return meta;
        }

        // 默认元信息映射
        var metaMap = {
            marketplace: { title: '功能商店', icon: '🛒', iconBg: 'linear-gradient(135deg, #007aff, #5856d6)' },
            agents:      { title: 'AI 助手', icon: '🤖', iconBg: 'linear-gradient(135deg, #34c759, #30d158)' },
            ops_center:  { title: '运维中心', icon: '📊', iconBg: 'linear-gradient(135deg, #ff9500, #ff6b00)' },
            config:      { title: '系统配置', icon: '⚙️', iconBg: 'linear-gradient(135deg, #8e8e93, #636366)' },
            knowledge:   { title: '知识库',   icon: '📚', iconBg: 'linear-gradient(135deg, #af52de, #5856d6)' },
            memory:      { title: '记忆管理', icon: '🧠', iconBg: 'linear-gradient(135deg, #ff2d55, #ff375f)' },
            rules:       { title: '规则引擎', icon: '📋', iconBg: 'linear-gradient(135deg, #007aff, #5ac8fa)' },
            sessions:    { title: '会话记录', icon: '💬', iconBg: 'linear-gradient(135deg, #34c759, #00c7be)' },
            notifications:{ title: '通知中心', icon: '🔔', iconBg: 'linear-gradient(135deg, #ff9500, #ff6b00)' },
            settings:    { title: '系统设置', icon: '⚙️', iconBg: 'linear-gradient(135deg, #8e8e93, #636366)' },
            'knowledge-card':  { title: '知识库', icon: '📚', iconBg: 'linear-gradient(135deg, #af52de, #5856d6)' },
            'session-card':    { title: '会话',   icon: '💬', iconBg: 'linear-gradient(135deg, #34c759, #00c7be)' },
            'knowledge-entry': { title: '知识库', icon: '📚', iconBg: 'linear-gradient(135deg, #af52de, #5856d6)' },
            'session-entry':   { title: '会话',   icon: '💬', iconBg: 'linear-gradient(135deg, #34c759, #00c7be)' },
            'marketplace-card':  { title: '功能商店', icon: '🛒', iconBg: 'linear-gradient(135deg, #007aff, #5856d6)' },
            'marketplace-entry': { title: '功能商店', icon: '🛒', iconBg: 'linear-gradient(135deg, #007aff, #5856d6)' },
            'agent-card':        { title: 'AI助手',  icon: '🤖', iconBg: 'linear-gradient(135deg, #34c759, #30d158)' },
            'agent-entry':       { title: 'AI助手',  icon: '🤖', iconBg: 'linear-gradient(135deg, #34c759, #30d158)' },
            'ops-card':          { title: '运维中心', icon: '📊', iconBg: 'linear-gradient(135deg, #ff9500, #ff6b00)' },
            'ops-entry':         { title: '运维中心', icon: '📊', iconBg: 'linear-gradient(135deg, #ff9500, #ff6b00)' }
        };

        return metaMap[cardId] || { title: cardId, icon: '📦', iconBg: 'linear-gradient(135deg, #667eea, #764ba2)' };
    }

    // ========== 关闭放大视图 ==========
    function close() {
        if (!_isOpen || !_overlay) return;

        // 触发关闭动画
        _overlay.classList.remove('active');

        // 等待动画完成后清理
        setTimeout(() => {
            _cleanup();
        }, 300);
    }

    // ========== 卡片内导航：推入新视图 ==========
    function pushView(renderFn) {
        if (!_isOpen || typeof renderFn !== 'function') return;

        // 保存当前 body 内容到栈中
        _navStack.push(_body.innerHTML);

        // 清空内容区
        _body.innerHTML = '';

        // 调用渲染函数
        renderFn(_body);

        // 显示返回按钮
        if (_backBtn) {
            _backBtn.classList.add('visible');
        }
    }

    // ========== 卡片内导航：返回上一视图 ==========
    function popView() {
        if (!_isOpen || _navStack.length === 0) return;

        // 恢复上一视图
        var prevContent = _navStack.pop();
        _body.innerHTML = prevContent;

        // 如果栈为空，隐藏返回按钮
        if (_navStack.length === 0 && _backBtn) {
            _backBtn.classList.remove('visible');
        }
    }

    // ========== 绑定事件 ==========
    function _bindEvents() {
        // 关闭按钮
        if (_closeBtn) {
            _closeBtn.addEventListener('click', close);
        }

        // 返回按钮
        if (_backBtn) {
            _backBtn.addEventListener('click', popView);
        }

        // 背景点击关闭
        if (_backdrop) {
            _backdrop.addEventListener('click', close);
        }

        // Esc 键关闭
        _onKeyDown = (e) => {
            if (e.key === 'Escape') {
                // 如果有导航栈，先 pop；否则关闭
                if (_navStack.length > 0) {
                    popView();
                } else {
                    close();
                }
            }
        };
        document.addEventListener('keydown', _onKeyDown);
    }

    // 键盘事件引用（用于清理）
    var _onKeyDown = null;

    // ========== 清理资源 ==========
    function _cleanup() {
        // 执行注册的清理函数
        for (var i = 0; i < _cleanupFns.length; i++) {
            try {
                _cleanupFns[i]();
            } catch (e) {
                console.warn('[CardOverlay] 清理函数执行出错:', e);
            }
        }
        _cleanupFns = [];

        // 移除键盘事件
        if (_onKeyDown) {
            document.removeEventListener('keydown', _onKeyDown);
            _onKeyDown = null;
        }

        // 重置状态
        _isOpen = false;
        _currentCardId = null;
        _currentData = null;
        _navStack = [];

        // 移除 DOM
        if (_overlay && _overlay.parentNode) {
            _overlay.parentNode.removeChild(_overlay);
        }
        _overlay = null;
        _container = null;
        _body = null;
        _header = null;
        _backBtn = null;
        _closeBtn = null;
        _backdrop = null;

        // 恢复 body 滚动
        document.body.style.overflow = '';
    }

    // ========== 注册清理函数 ==========
    function registerCleanup(fn) {
        if (typeof fn === 'function') {
            _cleanupFns.push(fn);
        }
    }

    // ========== 公开 API ==========
    return {
        open: open,
        close: close,
        pushView: pushView,
        popView: popView,
        registerCleanup: registerCleanup,
        isOpen: () => _isOpen,
        getCurrentCardId: () => _currentCardId
    };
})();

window.CardOverlay = CardOverlay;
