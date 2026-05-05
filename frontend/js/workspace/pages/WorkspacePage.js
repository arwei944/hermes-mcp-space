/**
 * WorkspacePage — 工作台主页面 (P1 增强)
 *
 * 页面模块约定（与现有架构一致）:
 * - render() → 渲染页面 HTML
 * - onSSEEvent(event, data) → 处理 SSE 推送
 * - destroy() → 清理资源
 *
 * P1 增强:
 * - 使用 CardManager 管理卡片生命周期
 * - 使用 LayoutSwitcher 组件
 * - 使用 ZIndexManager 管理层级
 * - 事件委托处理所有交互
 *
 * 依赖: StateManager, DataService, CardManager, LayoutSwitcher, ZIndexManager,
 *       Bus, Store, Logger (全局)
 */
const WorkspacePage = (() => {
    'use strict';

    // ── Internal State ────────────────────────────────────
    let _container = null;
    let _destroyed = false;
    let _busCleanupFns = [];
    let _currentLayout = 'grid';
    let _currentDesktopId = null;

    const EMPTY_ICON = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <rect x="8" y="8" width="48" height="48" rx="8"/>
        <line x1="24" y1="24" x2="40" y2="24"/><line x1="24" y1="32" x2="40" y2="32"/>
        <line x1="24" y1="40" x2="34" y2="40"/>
        <circle cx="48" cy="16" r="8" fill="currentColor" stroke="none" opacity="0.2"/>
        <line x1="48" y1="12" x2="48" y2="20" stroke="white" stroke-width="2"/>
        <line x1="44" y1="16" x2="52" y2="16" stroke="white" stroke-width="2"/>
    </svg>`;

    // ── Render Methods ────────────────────────────────────

    function _renderDesktopTabs() {
        const desktopIds = StateManager.getDesktopIds();
        const activeId = StateManager.getActiveDesktopId();

        if (desktopIds.length === 0) return '';

        const tabsHtml = desktopIds.map(id => {
            const desktop = Store.get(`desktops.${id}`);
            const name = desktop ? desktop.name : id;
            const isActive = id === activeId;
            return `
                <button class="ws-tabs__item ${isActive ? 'ws-tabs__item--active' : ''}"
                        data-action="switch-desktop" data-desktop-id="${id}">
                    ${name}
                </button>`;
        }).join('');

        const dotsHtml = desktopIds.map(id => `
            <span class="ws-tabs__dot ${id === activeId ? 'ws-tabs__dot--active' : ''}"></span>
        `).join('');

        return `
        <div class="ws-tabs" data-action="desktop-tabs">
            ${tabsHtml}
            <button class="ws-tabs__add" data-action="add-desktop" title="添加桌面">+</button>
            <div class="ws-tabs__dots">${dotsHtml}</div>
        </div>`;
    }

    function _renderEmptyState() {
        return `
        <div class="ws-empty">
            <div class="ws-empty__icon">${EMPTY_ICON}</div>
            <div class="ws-empty__text">还没有卡片，点击下方按钮添加</div>
            <button class="ws-empty__action" data-action="open-store">+ 添加卡片</button>
        </div>`;
    }

    // ── Event Handlers ────────────────────────────────────

    function _handleAction(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const desktopId = target.dataset.desktopId;
        const cardId = target.dataset.cardId;
        const layout = target.dataset.layout;

        switch (action) {
            case 'switch-layout':
                _switchLayout(layout);
                break;
            case 'reset-layout':
                _resetLayout();
                break;
            case 'switch-desktop':
                _switchDesktop(desktopId);
                break;
            case 'add-desktop':
                _addDesktop();
                break;
            case 'open-store':
                Bus.emit('ws:store:open');
                break;
            case 'card-expand':
                e.stopPropagation();
                CardWidget.toggleExpand(cardId);
                break;
            case 'card-refresh':
                e.stopPropagation();
                _refreshCard(desktopId, cardId);
                break;
            case 'card-retry':
                e.stopPropagation();
                _refreshCard(desktopId, cardId);
                break;
            case 'card-delete':
                e.stopPropagation();
                _onCardDelete(desktopId, cardId);
                break;
            case 'card-more':
                e.stopPropagation();
                break;
        }
    }

    function _switchLayout(layout) {
        if (!layout || layout === _currentLayout) return;
        _currentLayout = layout;
        LayoutSwitcher.setActive(layout);
        CardManager.switchLayout(_currentDesktopId, layout);
        Logger.info('[WorkspacePage] Layout switched to:', layout);
    }

    function _resetLayout() {
        LayoutEngine.clearPinned(_currentDesktopId);
        CardManager.renderDesktop(_currentDesktopId, _getActiveDesktopContainer(), _currentLayout);
        Logger.info('[WorkspacePage] Layout reset');
    }

    function _switchDesktop(desktopId) {
        if (!desktopId || desktopId === _currentDesktopId) return;
        StateManager.setActiveDesktop(desktopId);
        _currentDesktopId = desktopId;
        _currentLayout = StateManager.getDesktopLayout(desktopId) || 'grid';
        LayoutSwitcher.setActive(_currentLayout);
        _renderActiveDesktop();
        _renderTabs();
        Logger.info('[WorkspacePage] Switched to desktop:', desktopId);
    }

    function _addDesktop() {
        const id = StateManager.createDesktop();
        StateManager.setActiveDesktop(id);
        _currentDesktopId = id;
        _currentLayout = StateManager.getDesktopLayout(id) || 'grid';
        LayoutSwitcher.setActive(_currentLayout);
        _renderActiveDesktop();
        _renderTabs();
        Logger.info('[WorkspacePage] Created desktop:', id);
    }

    function _refreshCard(desktopId, cardId) {
        if (!desktopId || !cardId) return;
        CardWidget.mountWidget(cardId, desktopId);
        Logger.debug('[WorkspacePage] Card refreshed:', cardId);
    }

    function _onCardDelete(desktopId, cardId) {
        if (!desktopId || !cardId) return;
        CardManager.deleteCard(desktopId, cardId);
        // 检查是否空了
        const remaining = StateManager.getCardIds(desktopId);
        if (remaining.length === 0) {
            _renderActiveDesktop();
        }
        Logger.info('[WorkspacePage] Card deleted:', cardId);
    }

    // ── Desktop Rendering ─────────────────────────────────

    function _getActiveDesktopContainer() {
        if (!_container) return null;
        const activeEl = _container.querySelector('.ws-desktop--active');
        return activeEl || _container.querySelector('.ws-desktop');
    }

    function _renderActiveDesktop() {
        if (!_container || !_currentDesktopId) return;

        const desktopsEl = _container.querySelector('.ws-desktops');
        if (!desktopsEl) return;

        const desktopIds = StateManager.getDesktopIds();
        const cardIds = StateManager.getCardIds(_currentDesktopId);

        // 生成桌面 DOM
        desktopsEl.innerHTML = desktopIds.map(id => {
            const isActive = id === _currentDesktopId;
            let positionClass = 'ws-desktop--right';
            if (isActive) positionClass = 'ws-desktop--active';
            else {
                const activeIdx = desktopIds.indexOf(_currentDesktopId);
                const thisIdx = desktopIds.indexOf(id);
                if (thisIdx < activeIdx) positionClass = 'ws-desktop--left';
            }

            const layoutClass = isActive ? `ws-${_currentLayout}` : '';
            return `
            <div class="ws-desktop ${positionClass} ${layoutClass}" data-desktop-id="${id}">
                ${isActive && cardIds.length === 0 ? _renderEmptyState() : ''}
            </div>`;
        }).join('');

        // 使用 CardManager 渲染卡片（如果有卡片）
        if (cardIds.length > 0) {
            const activeContainer = _getActiveDesktopContainer();
            if (activeContainer) {
                CardManager.renderDesktop(_currentDesktopId, activeContainer, _currentLayout);
            }
        }
    }

    function _renderTabs() {
        const tabsContainer = _container.querySelector('.ws-tabs');
        if (tabsContainer) {
            tabsContainer.outerHTML = _renderDesktopTabs();
        }
    }

    // ── Setup / Teardown ──────────────────────────────────

    function _setupListeners() {
        // 事件委托
        _container.addEventListener('click', _handleAction);

        // 监听桌面切换
        const id1 = Bus.on('ws:desktop:switched', ({ desktopId }) => {
            _currentDesktopId = desktopId;
            _currentLayout = StateManager.getDesktopLayout(desktopId) || 'grid';
            LayoutSwitcher.setActive(_currentLayout);
            _renderActiveDesktop();
            _renderTabs();
        });

        const id2 = Bus.on('ws:desktop:created', () => {
            _renderActiveDesktop();
            _renderTabs();
        });

        const id3 = Bus.on('ws:desktop:deleted', () => {
            _currentDesktopId = StateManager.getActiveDesktopId();
            _renderActiveDesktop();
            _renderTabs();
        });

        const id4 = Bus.on('ws:desktop:renamed', () => _renderTabs());

        // 监听卡片变化
        const id5 = Bus.on('ws:card:created', () => _renderActiveDesktop());
        const id6 = Bus.on('ws:card:deleted', () => _renderActiveDesktop());

        // 监听编辑模式
        const id7 = Bus.on('ws:edit:enter', () => _toggleEditMode(true));
        const id8 = Bus.on('ws:edit:exit', () => _toggleEditMode(false));

        // 监听 z-index 变化
        const id9 = Bus.on('ws:zindex:changed', ({ cardId, z }) => {
            CardWidget.updateZIndex(cardId, z);
        });

        _busCleanupFns = [
            () => Bus.off('ws:desktop:switched', id1),
            () => Bus.off('ws:desktop:created', id2),
            () => Bus.off('ws:desktop:deleted', id3),
            () => Bus.off('ws:desktop:renamed', id4),
            () => Bus.off('ws:card:created', id5),
            () => Bus.off('ws:card:deleted', id6),
            () => Bus.off('ws:edit:enter', id7),
            () => Bus.off('ws:edit:exit', id8),
            () => Bus.off('ws:zindex:changed', id9)
        ];
    }

    function _toggleEditMode(isEditing) {
        if (!_container) return;
        const cardIds = StateManager.getCardIds(_currentDesktopId);
        for (const cardId of cardIds) {
            CardWidget.setEditMode(cardId, isEditing);
        }
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 渲染页面
     */
    function render(container) {
        _container = container || document.getElementById('contentBody');
        if (!_container) return;

        _destroyed = false;
        _currentDesktopId = StateManager.getActiveDesktopId();
        _currentLayout = StateManager.getDesktopLayout(_currentDesktopId) || 'grid';

        // 初始化 ZIndexManager
        ZIndexManager.init();

        _container.innerHTML = `
        <div class="ws-workspace" data-action="workspace">
            ${LayoutSwitcher.render(_currentLayout)}
            <div class="ws-desktops" data-action="desktops">
                ${_renderActiveDesktopHTML()}
            </div>
            ${_renderDesktopTabs()}
        </div>`;

        // 初始化 CardManager（绑定拖拽/缩放到容器）
        const activeContainer = _getActiveDesktopContainer();
        if (activeContainer) {
            CardManager.init(activeContainer);
        }

        // 使用 CardManager 渲染卡片
        const cardIds = StateManager.getCardIds(_currentDesktopId);
        if (cardIds.length > 0 && activeContainer) {
            CardManager.renderDesktop(_currentDesktopId, activeContainer, _currentLayout);
        }

        _setupListeners();
        Logger.info('[WorkspacePage] Rendered (P1)');
    }

    function _renderActiveDesktopHTML() {
        const desktopIds = StateManager.getDesktopIds();
        const cardIds = StateManager.getCardIds(_currentDesktopId);

        return desktopIds.map(id => {
            const isActive = id === _currentDesktopId;
            let positionClass = 'ws-desktop--right';
            if (isActive) positionClass = 'ws-desktop--active';
            else {
                const activeIdx = desktopIds.indexOf(_currentDesktopId);
                const thisIdx = desktopIds.indexOf(id);
                if (thisIdx < activeIdx) positionClass = 'ws-desktop--left';
            }

            const layoutClass = isActive ? `ws-${_currentLayout}` : '';
            return `
            <div class="ws-desktop ${positionClass} ${layoutClass}" data-desktop-id="${id}">
                ${isActive && cardIds.length === 0 ? _renderEmptyState() : ''}
            </div>`;
        }).join('');
    }

    /**
     * 处理 SSE 事件
     */
    function onSSEEvent(event, data) {
        Logger.debug('[WorkspacePage] SSE event:', event);
    }

    /**
     * 销毁页面
     */
    function destroy() {
        _destroyed = true;

        // 清理 Bus 监听
        for (const cleanup of _busCleanupFns) {
            cleanup();
        }
        _busCleanupFns = [];

        // 清理 CardManager
        CardManager.destroy();

        // 清理 ZIndexManager
        ZIndexManager.destroy();

        // 清理事件监听
        if (_container) {
            _container.removeEventListener('click', _handleAction);
        }

        // 清理 DOM
        if (_container) {
            _container.innerHTML = '';
        }

        _container = null;
        Logger.info('[WorkspacePage] Destroyed');
    }

    // ── Expose ────────────────────────────────────────────
    return {
        render,
        onSSEEvent,
        destroy
    };
})();