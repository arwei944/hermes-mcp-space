/**
 * WorkspacePage — 工作台主页面
 *
 * 页面模块约定（与现有架构一致）:
 * - render() → 渲染页面 HTML
 * - onSSEEvent(event, data) → 处理 SSE 推送
 * - destroy() → 清理资源
 *
 * 依赖: StateManager, DataService, Bus, Store, Logger (全局)
 */
const WorkspacePage = (() => {
    'use strict';

    // ── Internal State ────────────────────────────────────
    let _container = null;
    let _destroyed = false;
    let _watcherIds = [];
    let _busCleanupFns = [];
    let _currentLayout = 'grid';

    // ── Layout Icons (SVG) ───────────────────────────────
    const LAYOUT_ICONS = {
        grid: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
        </svg>`,
        list: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="14" height="3" rx="1"/><rect x="1" y="6.5" width="14" height="3" rx="1"/>
            <rect x="1" y="12" width="14" height="3" rx="1"/>
        </svg>`,
        masonry: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="6" height="8" rx="1"/><rect x="9" y="1" width="6" height="5" rx="1"/>
            <rect x="9" y="8" width="6" height="7" rx="1"/><rect x="1" y="11" width="6" height="4" rx="1"/>
        </svg>`,
        canvas: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="5" height="5" rx="0.5"/><rect x="7" y="3" width="4" height="4" rx="0.5"/>
            <rect x="3" y="8" width="6" height="4" rx="0.5"/><rect x="11" y="9" width="4" height="5" rx="0.5"/>
        </svg>`
    };

    const EMPTY_ICON = `<svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
        <rect x="8" y="8" width="48" height="48" rx="8"/>
        <line x1="24" y1="24" x2="40" y2="24"/><line x1="24" y1="32" x2="40" y2="32"/>
        <line x1="24" y1="40" x2="34" y2="40"/>
        <circle cx="48" cy="16" r="8" fill="currentColor" stroke="none" opacity="0.2"/>
        <line x1="48" y1="12" x2="48" y2="20" stroke="white" stroke-width="2"/>
        <line x1="44" y1="16" x2="52" y2="16" stroke="white" stroke-width="2"/>
    </svg>`;

    // ── Render Methods ────────────────────────────────────

    function _renderLayoutSwitcher() {
        const layouts = ['grid', 'list', 'masonry', 'canvas'];
        const labels = { grid: '网格', list: '列表', masonry: '瀑布流', canvas: '画布' };

        return `
        <div class="ws-layout-switcher" data-action="layout-switcher">
            ${layouts.map(layout => `
                <button class="ws-layout-switcher__btn ${layout === _currentLayout ? 'ws-layout-switcher__btn--active' : ''}"
                        data-action="switch-layout" data-layout="${layout}"
                        title="${labels[layout]}">
                    ${LAYOUT_ICONS[layout]}
                </button>
            `).join('')}
        </div>`;
    }

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

    function _renderDesktopContent(desktopId) {
        const cardIds = StateManager.getCardIds(desktopId);

        if (cardIds.length === 0) {
            return _renderEmptyState();
        }

        // P0 阶段只渲染卡片占位，P1 会实现真正的 CardWidget
        const cardsHtml = cardIds.map(cardId => {
            const card = StateManager.getCard(desktopId, cardId);
            if (!card) return '';

            const title = card.title || '未命名卡片';
            const icon = card.icon || '';
            const sizeClass = card.layout.w >= 2 && card.layout.h >= 2 ? 'ws-card--lg' :
                             card.layout.w >= 2 ? 'ws-card--md' : 'ws-card--sm';

            return `
            <div class="ws-card ${sizeClass}" data-card-id="${cardId}" data-action="card" data-desktop-id="${desktopId}">
                <div class="ws-card__header">
                    <div class="ws-card__title">
                        ${icon ? `<span class="ws-card__icon">${icon}</span>` : ''}
                        <span>${title}</span>
                    </div>
                    <div class="ws-card__actions">
                        <button class="ws-card__action-btn" data-action="card-expand" data-card-id="${cardId}" title="展开">↕</button>
                        <button class="ws-card__action-btn" data-action="card-more" data-card-id="${cardId}" title="更多">⋯</button>
                    </div>
                </div>
                <div class="ws-card__body">
                    <div class="ws-card__summary">
                        卡片内容将在 P1 阶段实现。类型: ${card.type} | 组件: ${card.widget || '待分配'}
                    </div>
                </div>
                <div class="ws-card__delete-badge" data-action="card-delete" data-card-id="${cardId}" data-desktop-id="${desktopId}">×</div>
            </div>`;
        }).join('');

        const layoutClass = `ws-${_currentLayout}`;
        return `<div class="${layoutClass}">${cardsHtml}</div>`;
    }

    function _renderDesktops() {
        const desktopIds = StateManager.getDesktopIds();
        const activeId = StateManager.getActiveDesktopId();

        return desktopIds.map(id => {
            const isActive = id === activeId;
            let positionClass = 'ws-desktop--right';
            if (isActive) positionClass = 'ws-desktop--active';
            else {
                const activeIdx = desktopIds.indexOf(activeId);
                const thisIdx = desktopIds.indexOf(id);
                if (thisIdx < activeIdx) positionClass = 'ws-desktop--left';
            }

            return `
            <div class="ws-desktop ${positionClass}" data-desktop-id="${id}">
                ${isActive ? _renderDesktopContent(id) : ''}
            </div>`;
        }).join('');
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
            case 'switch-desktop':
                _switchDesktop(desktopId);
                break;
            case 'add-desktop':
                _addDesktop();
                break;
            case 'open-store':
                Bus.emit('ws:store:open');
                break;
            case 'card':
                _onCardClick(desktopId, cardId);
                break;
            case 'card-expand':
                e.stopPropagation();
                _onCardExpand(cardId);
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
        StateManager.setDesktopLayout(StateManager.getActiveDesktopId(), layout);
        _render();
        Logger.info('[WorkspacePage] Layout switched to:', layout);
    }

    function _switchDesktop(desktopId) {
        if (!desktopId) return;
        StateManager.setActiveDesktop(desktopId);
        _currentLayout = StateManager.getDesktopLayout(desktopId) || 'grid';
        _render();
        Logger.info('[WorkspacePage] Switched to desktop:', desktopId);
    }

    function _addDesktop() {
        const id = StateManager.createDesktop();
        StateManager.setActiveDesktop(id);
        _currentLayout = StateManager.getDesktopLayout(id) || 'grid';
        _render();
        Logger.info('[WorkspacePage] Created desktop:', id);
    }

    function _onCardClick(desktopId, cardId) {
        if (!desktopId || !cardId) return;
        StateManager.bringCardToFront(desktopId, cardId);
        Logger.debug('[WorkspacePage] Card clicked:', cardId);
    }

    function _onCardExpand(cardId) {
        if (!cardId) return;
        const cardEl = _container.querySelector(`.ws-card[data-card-id="${cardId}"]`);
        if (!cardEl) return;
        const expandEl = cardEl.querySelector('.ws-card__expand');
        if (expandEl) {
            expandEl.classList.toggle('ws-card__expand--open');
        }
    }

    function _onCardDelete(desktopId, cardId) {
        if (!desktopId || !cardId) return;
        StateManager.deleteCard(desktopId, cardId);
        _render();
        Logger.info('[WorkspacePage] Card deleted:', cardId);
    }

    // ── Setup / Teardown ──────────────────────────────────

    function _setupListeners() {
        // 事件委托
        _container.addEventListener('click', _handleAction);

        // 监听桌面切换
        const id1 = Bus.on('ws:desktop:switched', () => _render());
        const id2 = Bus.on('ws:desktop:created', () => _render());
        const id3 = Bus.on('ws:desktop:deleted', () => _render());
        const id4 = Bus.on('ws:desktop:renamed', () => _renderTabs());
        const id5 = Bus.on('ws:desktop:layout-changed', ({ layout }) => {
            _currentLayout = layout;
            _render();
        });

        // 监听卡片变化
        const id6 = Bus.on('ws:card:created', () => _render());
        const id7 = Bus.on('ws:card:deleted', () => _render());
        const id8 = Bus.on('ws:card:updated', () => _render());

        // 监听编辑模式
        const id9 = Bus.on('ws:edit:enter', () => _toggleEditMode(true));
        const id10 = Bus.on('ws:edit:exit', () => _toggleEditMode(false));

        _busCleanupFns = [
            () => Bus.off('ws:desktop:switched', id1),
            () => Bus.off('ws:desktop:created', id2),
            () => Bus.off('ws:desktop:deleted', id3),
            () => Bus.off('ws:desktop:renamed', id4),
            () => Bus.off('ws:desktop:layout-changed', id5),
            () => Bus.off('ws:card:created', id6),
            () => Bus.off('ws:card:deleted', id7),
            () => Bus.off('ws:card:updated', id8),
            () => Bus.off('ws:edit:enter', id9),
            () => Bus.off('ws:edit:exit', id10)
        ];
    }

    function _toggleEditMode(isEditing) {
        if (!_container) return;
        const cards = _container.querySelectorAll('.ws-card');
        cards.forEach(card => {
            card.classList.toggle('ws-card--editing', isEditing);
        });
    }

    function _renderTabs() {
        const tabsContainer = _container.querySelector('.ws-tabs');
        if (tabsContainer) {
            tabsContainer.outerHTML = _renderDesktopTabs();
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
        _currentLayout = StateManager.getDesktopLayout(StateManager.getActiveDesktopId()) || 'grid';

        _container.innerHTML = `
        <div class="ws-workspace" data-action="workspace">
            ${_renderLayoutSwitcher()}
            <div class="ws-desktops" data-action="desktops">
                ${_renderDesktops()}
            </div>
            ${_renderDesktopTabs()}
        </div>`;

        _setupListeners();
        Logger.info('[WorkspacePage] Rendered');
    }

    /**
     * 重新渲染（内部使用）
     */
    function _render() {
        if (_destroyed || !_container) return;

        const workspaceEl = _container.querySelector('.ws-workspace');
        if (!workspaceEl) return;

        // 更新布局切换器
        const switcher = workspaceEl.querySelector('.ws-layout-switcher');
        if (switcher) {
            switcher.outerHTML = _renderLayoutSwitcher();
        }

        // 更新桌面内容
        const desktopsEl = workspaceEl.querySelector('.ws-desktops');
        if (desktopsEl) {
            desktopsEl.innerHTML = _renderDesktops();
        }

        // 更新标签
        _renderTabs();

        // 更新编辑模式状态
        const isEditing = Store.get('workspace.config.editMode');
        if (isEditing) _toggleEditMode(true);
    }

    /**
     * 处理 SSE 事件
     */
    function onSSEEvent(event, data) {
        // DataService 会自动处理缓存失效和数据刷新
        // 这里只处理需要页面级别响应的事件
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
