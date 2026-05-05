/**
 * Hermes Workspace v17 - WorkspacePage (Rewrite)
 *
 * 重写说明：
 * - 不再作为 Router 页面，直接渲染到传入的 container
 * - 保留所有现有功能（DesktopManager、CardManager、LayoutEngine 等）
 * - 集成 CardOverlay：卡片点击时调用 CardOverlay.open() 而不是 CardWidget.toggleExpand()
 * - 保留事件委托和 Bus 监听
 * - 保留手势管理
 * - 修改 render 方法签名：render(container) 接收容器参数
 */
var WorkspacePage = (function () {
    'use strict';

    // ==================== 内部状态 ====================

    var _container = null;       // 主容器 DOM
    var _desktopContainer = null; // 桌面容器 DOM
    var _isEditMode = false;     // 编辑模式
    var _isInitialized = false;  // 是否已初始化

    // ==================== 生命周期 ====================

    /**
     * 渲染工作台到指定容器
     * @param {HTMLElement} container - 目标容器
     */
    function render(container) {
        if (!container) {
            console.error('[WorkspacePage] render() called without container');
            return;
        }

        _container = container;
        _container.innerHTML = '';

        // 创建桌面容器
        _desktopContainer = document.createElement('div');
        _desktopContainer.className = 'ws-desktop';
        _desktopContainer.id = 'wsDesktop';
        _container.appendChild(_desktopContainer);

        // 初始化桌面管理器
        if (typeof DesktopManager !== 'undefined') {
            DesktopManager.init(_desktopContainer);
        }

        // 初始化布局引擎
        if (typeof LayoutEngine !== 'undefined') {
            LayoutEngine.init(_desktopContainer);
        }

        // 初始化卡片管理器
        if (typeof CardManager !== 'undefined') {
            CardManager.init(_desktopContainer);
        }

        // 初始化拖拽管理器
        if (typeof DragManager !== 'undefined') {
            DragManager.init(_desktopContainer);
        }

        // 初始化 Resize 管理器
        if (typeof ResizeManager !== 'undefined') {
            ResizeManager.init(_desktopContainer);
        }

        // 初始化 Z-Index 管理器
        if (typeof ZIndexManager !== 'undefined') {
            ZIndexManager.init();
        }

        // 初始化手势管理器
        if (typeof GestureManager !== 'undefined') {
            GestureManager.init(_desktopContainer);
        }
        // 初始化右键菜单管理器
        if (typeof ContextMenuManager !== 'undefined') {
            ContextMenuManager.init(_desktopContainer);
        }
        // 初始化响应式布局管理器
        if (typeof ResponsiveManager !== 'undefined') {
            ResponsiveManager.init();
        }

        // 渲染桌面标签
        _renderDesktopTabs();

        // 渲染布局切换器
        _renderLayoutSwitcher();

        // 渲染卡片商店入口
        _renderCardStoreTrigger();

        // 加载桌面数据
        _loadDesktop();

        // 绑定事件
        _bindEvents();

        // 注册 Bus 监听
        _subscribeBusEvents();

        _isInitialized = true;
        console.log('[WorkspacePage] Rendered successfully.');
    }

    /**
     * 销毁工作台
     */
    function destroy() {
        if (!_isInitialized) return;

        // 取消 Bus 监听
        _unsubscribeBusEvents();

        // 销毁子管理器
        if (typeof GestureManager !== 'undefined' && GestureManager.destroy) {
            GestureManager.destroy();
        }
        if (typeof ContextMenuManager !== 'undefined' && ContextMenuManager.destroy) {
            ContextMenuManager.destroy();
        }
        if (typeof ResponsiveManager !== 'undefined' && ResponsiveManager.destroy) {
            ResponsiveManager.destroy();
        }
        if (typeof ResizeManager !== 'undefined' && ResizeManager.destroy) {
            ResizeManager.destroy();
        }
        if (typeof DragManager !== 'undefined' && DragManager.destroy) {
            DragManager.destroy();
        }
        if (typeof CardManager !== 'undefined' && CardManager.destroy) {
            CardManager.destroy();
        }
        if (typeof LayoutEngine !== 'undefined' && LayoutEngine.destroy) {
            LayoutEngine.destroy();
        }
        if (typeof DesktopManager !== 'undefined' && DesktopManager.destroy) {
            DesktopManager.destroy();
        }

        // 清空容器
        if (_container) {
            _container.innerHTML = '';
        }

        _container = null;
        _desktopContainer = null;
        _isInitialized = false;

        console.log('[WorkspacePage] Destroyed.');
    }

    // ==================== 桌面渲染 ====================

    /**
     * 加载当前桌面
     */
    function _loadDesktop() {
        if (typeof DesktopManager !== 'undefined' && DesktopManager.loadDesktop) {
            DesktopManager.loadDesktop();
        }
    }

    /**
     * 刷新桌面数据
     */
    function refresh() {
        if (typeof CardManager !== 'undefined' && CardManager.refreshAll) {
            CardManager.refreshAll();
        }
    }

    // ==================== UI 子组件渲染 ====================

    /**
     * 渲染桌面标签栏
     */
    function _renderDesktopTabs() {
        if (typeof DesktopTabs !== 'undefined' && DesktopTabs.render) {
            var tabsContainer = document.createElement('div');
            tabsContainer.className = 'ws-desktop-tabs-container';
            tabsContainer.id = 'wsDesktopTabs';
            _container.appendChild(tabsContainer);
            DesktopTabs.render(tabsContainer);
        }
    }

    /**
     * 渲染布局切换器
     */
    function _renderLayoutSwitcher() {
        if (typeof LayoutSwitcher !== 'undefined' && LayoutSwitcher.render) {
            var switcherContainer = document.createElement('div');
            switcherContainer.className = 'ws-layout-switcher-container';
            switcherContainer.id = 'wsLayoutSwitcher';
            _container.appendChild(switcherContainer);
            LayoutSwitcher.render(switcherContainer);
        }
    }

    /**
     * 渲染卡片商店触发按钮
     */
    function _renderCardStoreTrigger() {
        if (typeof CardStore !== 'undefined' && CardStore.renderTrigger) {
            var triggerContainer = document.createElement('div');
            triggerContainer.className = 'ws-card-store-trigger-container';
            triggerContainer.id = 'wsCardStoreTrigger';
            _container.appendChild(triggerContainer);
            CardStore.renderTrigger(triggerContainer);
        }
    }

    // ==================== 事件处理 ====================

    /**
     * 绑定事件委托
     */
    function _bindEvents() {
        if (!_container) return;

        // 使用事件委托处理所有卡片动作
        _container.addEventListener('click', _handleClick);
        _container.addEventListener('dblclick', _handleDblClick);
    }

    /**
     * 处理点击事件（事件委托）
     * @param {Event} e
     */
    function _handleClick(e) {
        var actionEl = e.target.closest('[data-action]');
        if (!actionEl) return;

        var action = actionEl.getAttribute('data-action');
        var cardId = actionEl.closest('[data-card-id]');
        cardId = cardId ? cardId.getAttribute('data-card-id') : null;

        _handleAction(action, cardId, e);
    }

    /**
     * 处理双击事件
     * @param {Event} e
     */
    function _handleDblClick(e) {
        // 双击卡片标题进入编辑模式
        var titleEl = e.target.closest('.ws-card-title');
        if (titleEl) {
            var cardEl = titleEl.closest('[data-card-id]');
            if (cardEl) {
                var cardId = cardEl.getAttribute('data-card-id');
                _handleAction('card-rename', cardId, e);
            }
        }
    }

    /**
     * 处理卡片动作
     * @param {string} action - 动作类型
     * @param {string} cardId - 卡片 ID
     * @param {Event} e - 原始事件
     */
    function _handleAction(action, cardId, e) {
        if (!action) return;

        switch (action) {
            // ===== 卡片放大（核心修改：使用 CardOverlay） =====
            case 'card-expand':
                e.stopPropagation();
                if (typeof CardOverlay !== 'undefined' && CardOverlay.open) {
                    CardOverlay.open(cardId);
                } else {
                    // 降级：使用 CardWidget.toggleExpand
                    if (typeof CardWidget !== 'undefined' && CardWidget.toggleExpand) {
                        CardWidget.toggleExpand(cardId);
                    }
                }
                break;

            // ===== 卡片关闭（从放大状态缩回） =====
            case 'card-collapse':
                e.stopPropagation();
                if (typeof CardOverlay !== 'undefined' && CardOverlay.close) {
                    CardOverlay.close();
                } else if (typeof CardWidget !== 'undefined' && CardWidget.toggleExpand) {
                    CardWidget.toggleExpand(cardId);
                }
                break;

            // ===== 卡片删除 =====
            case 'card-delete':
                e.stopPropagation();
                if (typeof CardManager !== 'undefined' && CardManager.removeCard) {
                    CardManager.removeCard(cardId);
                }
                break;

            // ===== 卡片刷新 =====
            case 'card-refresh':
                e.stopPropagation();
                if (typeof CardManager !== 'undefined' && CardManager.refreshCard) {
                    CardManager.refreshCard(cardId);
                }
                break;

            // ===== 卡片固定/取消固定 =====
            case 'card-pin':
                e.stopPropagation();
                if (typeof CardManager !== 'undefined' && CardManager.togglePin) {
                    CardManager.togglePin(cardId);
                }
                break;

            // ===== 卡片重命名 =====
            case 'card-rename':
                e.stopPropagation();
                // TODO: 实现重命名逻辑
                break;

            // ===== 卡片配置 =====
            case 'card-config':
                e.stopPropagation();
                // TODO: 打开卡片配置面板
                break;

            // ===== 桌面切换 =====
            case 'desktop-switch':
                var desktopId = e.target.closest('[data-desktop-id]');
                if (desktopId) {
                    var targetId = desktopId.getAttribute('data-desktop-id');
                    if (typeof DesktopManager !== 'undefined' && DesktopManager.switchDesktop) {
                        DesktopManager.switchDesktop(targetId);
                    }
                }
                break;

            // ===== 新增桌面 =====
            case 'desktop-add':
                if (typeof DesktopManager !== 'undefined' && DesktopManager.addDesktop) {
                    DesktopManager.addDesktop();
                }
                break;

            // ===== 布局切换 =====
            case 'layout-switch':
                var layoutType = e.target.closest('[data-layout]');
                if (layoutType) {
                    var layout = layoutType.getAttribute('data-layout');
                    if (typeof LayoutEngine !== 'undefined' && LayoutEngine.setLayout) {
                        LayoutEngine.setLayout(layout);
                    }
                }
                break;

            // ===== 卡片商店 =====
            case 'card-store-open':
                if (typeof CardStore !== 'undefined' && CardStore.open) {
                    CardStore.open();
                }
                break;

            // ===== 编辑模式切换 =====
            case 'edit-mode-toggle':
                toggleEditMode();
                break;

            default:
                // 透传给 Bus，让感兴趣的模块自行处理
                if (typeof Bus !== 'undefined') {
                    Bus.emit('workspace:action', { action: action, cardId: cardId, event: e });
                }
                break;
        }
    }

    // ==================== 编辑模式 ====================

    /**
     * 切换编辑模式
     */
    function toggleEditMode() {
        _isEditMode = !_isEditMode;

        if (_container) {
            _container.classList.toggle('ws-edit-mode', _isEditMode);
        }

        // 通知子管理器
        if (typeof CardManager !== 'undefined' && CardManager.setEditMode) {
            CardManager.setEditMode(_isEditMode);
        }
        if (typeof DragManager !== 'undefined' && DragManager.setEditMode) {
            DragManager.setEditMode(_isEditMode);
        }
        if (typeof ResizeManager !== 'undefined' && ResizeManager.setEditMode) {
            ResizeManager.setEditMode(_isEditMode);
        }

        // 广播编辑模式变化
        if (typeof Bus !== 'undefined') {
            Bus.emit('workspace:edit-mode', { isEditMode: _isEditMode });
        }

        console.log('[WorkspacePage] Edit mode:', _isEditMode ? 'ON' : 'OFF');
    }

    /**
     * 获取编辑模式状态
     * @returns {boolean}
     */
    function isEditMode() {
        return _isEditMode;
    }

    // ==================== Bus 事件 ====================

    /**
     * 注册 Bus 事件监听
     */
    function _subscribeBusEvents() {
        if (typeof Bus === 'undefined') return;

        Bus.on('card:click', _onCardClick);
        Bus.on('card:dblclick', _onCardDblClick);
        Bus.on('desktop:switched', _onDesktopSwitched);
        Bus.on('layout:changed', _onLayoutChanged);
        Bus.on('card:added', _onCardAdded);
        Bus.on('card:removed', _onCardRemoved);
    }

    /**
     * 取消 Bus 事件监听
     */
    function _unsubscribeBusEvents() {
        if (typeof Bus === 'undefined') return;

        Bus.off('card:click', _onCardClick);
        Bus.off('card:dblclick', _onCardDblClick);
        Bus.off('desktop:switched', _onDesktopSwitched);
        Bus.off('layout:changed', _onLayoutChanged);
        Bus.off('card:added', _onCardAdded);
        Bus.off('card:removed', _onCardRemoved);
    }

    /**
     * 卡片点击事件处理
     * @param {Object} data - { cardId, event }
     */
    function _onCardClick(data) {
        // 在非编辑模式下，点击卡片放大
        if (!_isEditMode && data.cardId) {
            if (typeof CardOverlay !== 'undefined' && CardOverlay.open) {
                CardOverlay.open(data.cardId);
            } else if (typeof CardWidget !== 'undefined' && CardWidget.toggleExpand) {
                CardWidget.toggleExpand(data.cardId);
            }
        }
    }

    /**
     * 卡片双击事件处理
     * @param {Object} data - { cardId, event }
     */
    function _onCardDblClick(data) {
        // 双击进入编辑模式
        if (!_isEditMode) {
            toggleEditMode();
        }
    }

    /**
     * 桌面切换回调
     * @param {Object} data - { desktopId }
     */
    function _onDesktopSwitched(data) {
        // 更新桌面标签 UI
        if (typeof DesktopTabs !== 'undefined' && DesktopTabs.updateActive) {
            DesktopTabs.updateActive(data.desktopId);
        }
    }

    /**
     * 布局变化回调
     * @param {Object} data - { layout }
     */
    function _onLayoutChanged(data) {
        // 更新布局切换器 UI
        if (typeof LayoutSwitcher !== 'undefined' && LayoutSwitcher.updateActive) {
            LayoutSwitcher.updateActive(data.layout);
        }
    }

    /**
     * 卡片添加回调
     * @param {Object} data - { cardId, widgetType }
     */
    function _onCardAdded(data) {
        console.log('[WorkspacePage] Card added:', data.cardId, data.widgetType);
    }

    /**
     * 卡片移除回调
     * @param {Object} data - { cardId }
     */
    function _onCardRemoved(data) {
        console.log('[WorkspacePage] Card removed:', data.cardId);
    }

    // ==================== SSE 事件处理 ====================

    /**
     * 处理 SSE 事件
     * @param {string} event - SSE 事件名
     * @param {Object} data - SSE 事件数据
     */
    function onSSEEvent(event, data) {
        if (!_isInitialized) return;

        console.log('[WorkspacePage] SSE event:', event, data);

        // 根据事件类型刷新对应卡片
        var eventType = event.replace('sse:', '');

        switch (eventType) {
            case 'knowledge.updated':
                _refreshCardsByWidget('knowledge');
                break;
            case 'rules.updated':
                _refreshCardsByWidget('rules');
                break;
            case 'experiences.updated':
                _refreshCardsByWidget('experiences');
                break;
            case 'memories.updated':
                _refreshCardsByWidget('memory');
                break;
            case 'reviews.updated':
                _refreshCardsByWidget('reviews');
                break;
            case 'mcp.tool_call':
            case 'mcp.tool_complete':
                _refreshCardsByWidget('mcp-status');
                break;
            case 'session.message':
                _refreshCardsByWidget('sessions');
                break;
            case 'alert.new':
            case 'alert.resolved':
                _refreshCardsByWidget('alerts');
                break;
            default:
                // 未知事件，刷新所有卡片
                refresh();
                break;
        }
    }

    /**
     * 刷新指定 Widget 类型的所有卡片
     * @param {string} widgetType - Widget 类型
     */
    function _refreshCardsByWidget(widgetType) {
        if (typeof CardManager !== 'undefined' && CardManager.refreshByWidget) {
            CardManager.refreshByWidget(widgetType);
        }
    }

    // ==================== 公共 API ====================

    return {
        render: render,
        destroy: destroy,
        refresh: refresh,
        toggleEditMode: toggleEditMode,
        isEditMode: isEditMode,
        onSSEEvent: onSSEEvent
    };

})();
