/**
 * WorkspacePage — 工作台主页面 (P2 增强)
 *
 * P2 增强:
 * - DesktopManager 协调多桌面
 * - DesktopContainer 管理桌面容器 + 滑动切换
 * - DesktopTabs 标签栏 + 右键菜单
 * - GestureManager 长按编辑 + 滑动切换
 *
 * 依赖: StateManager, DataService, DesktopManager, DesktopContainer, DesktopTabs,
 *       LayoutSwitcher, CardManager, CardWidget, ZIndexManager, GestureManager,
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
            case 'rename-desktop':
                _renameDesktop(desktopId);
                break;
            case 'delete-desktop':
                _deleteDesktop(desktopId);
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
        DesktopContainer.refresh();
        Logger.info('[WorkspacePage] Layout reset');
    }

    function _switchDesktop(desktopId) {
        if (!desktopId || desktopId === _currentDesktopId) return;
        DesktopManager.switchTo(desktopId);
    }

    function _addDesktop() {
        const id = DesktopManager.createDesktop();
        _currentDesktopId = id;
        _currentLayout = StateManager.getDesktopLayout(id) || 'grid';
        LayoutSwitcher.setActive(_currentLayout);
        DesktopContainer.switchTo(id);
        DesktopTabs.update();
        Logger.info('[WorkspacePage] Created desktop:', id);
    }

    function _renameDesktop(desktopId) {
        if (!desktopId) return;
        const desktop = DesktopManager.getDesktop(desktopId);
        if (!desktop) return;

        // 使用内联编辑
        const tabEl = _container.querySelector(`.ws-tabs__item[data-desktop-id="${desktopId}"]`);
        if (!tabEl) return;

        const currentName = desktop.name;
        tabEl.contentEditable = true;
        tabEl.focus();

        // 选中文字
        const range = document.createRange();
        range.selectNodeContents(tabEl);
        const sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);

        const finishEdit = () => {
            tabEl.contentEditable = false;
            const newName = tabEl.textContent.trim();
            if (newName && newName !== currentName) {
                DesktopManager.renameDesktop(desktopId, newName);
            } else {
                tabEl.textContent = currentName;
            }
            tabEl.removeEventListener('blur', finishEdit);
            tabEl.removeEventListener('keydown', handleKey);
        };

        const handleKey = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                tabEl.blur();
            } else if (e.key === 'Escape') {
                tabEl.textContent = currentName;
                tabEl.blur();
            }
        };

        tabEl.addEventListener('blur', finishEdit);
        tabEl.addEventListener('keydown', handleKey);
    }

    function _deleteDesktop(desktopId) {
        if (!desktopId) return;
        if (DesktopManager.getCount() <= 1) {
            Logger.warn('[WorkspacePage] Cannot delete the last desktop');
            return;
        }
        DesktopManager.deleteDesktop(desktopId);
        _currentDesktopId = DesktopManager.getActiveDesktop().id;
        _currentLayout = StateManager.getDesktopLayout(_currentDesktopId) || 'grid';
        LayoutSwitcher.setActive(_currentLayout);
        DesktopContainer.switchTo(_currentDesktopId);
        DesktopTabs.update();
    }

    function _refreshCard(desktopId, cardId) {
        if (!desktopId || !cardId) return;
        CardWidget.mountWidget(cardId, desktopId);
    }

    function _onCardDelete(desktopId, cardId) {
        if (!desktopId || !cardId) return;
        CardManager.deleteCard(desktopId, cardId);
        // 检查是否空了
        const remaining = StateManager.getCardIds(desktopId);
        if (remaining.length === 0) {
            DesktopContainer.refresh();
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
            DesktopContainer.switchTo(desktopId);
            DesktopTabs.setActive(desktopId);
        });

        const id2 = Bus.on('ws:desktop:created', () => {
            DesktopTabs.update();
        });

        const id3 = Bus.on('ws:desktop:deleted', () => {
            _currentDesktopId = DesktopManager.getActiveDesktop().id;
            DesktopTabs.update();
        });

        const id4 = Bus.on('ws:desktop:renamed', () => {
            DesktopTabs.update();
        });

        const id5 = Bus.on('ws:desktop:default-created', () => {
            DesktopContainer.refresh();
            DesktopTabs.update();
        });

        // 监听卡片变化
        const id6 = Bus.on('ws:card:created', () => DesktopContainer.refresh());
        const id7 = Bus.on('ws:card:deleted', () => DesktopContainer.refresh());

        // 监听编辑模式
        const id8 = Bus.on('ws:edit:enter', () => _toggleEditMode(true));
        const id9 = Bus.on('ws:edit:exit', () => _toggleEditMode(false));

        // 监听 z-index 变化
        const id10 = Bus.on('ws:zindex:changed', ({ cardId, z }) => {
            CardWidget.updateZIndex(cardId, z);
        });

        // 监听桌面滑动切换
        const id11 = Bus.on('ws:desktop:switch-next', () => {
            DesktopManager.switchNext();
        });
        const id12 = Bus.on('ws:desktop:switch-prev', () => {
            DesktopManager.switchPrev();
        });

        _busCleanupFns = [
            () => Bus.off('ws:desktop:switched', id1),
            () => Bus.off('ws:desktop:created', id2),
            () => Bus.off('ws:desktop:deleted', id3),
            () => Bus.off('ws:desktop:renamed', id4),
            () => Bus.off('ws:desktop:default-created', id5),
            () => Bus.off('ws:card:created', id6),
            () => Bus.off('ws:card:deleted', id7),
            () => Bus.off('ws:edit:enter', id8),
            () => Bus.off('ws:edit:exit', id9),
            () => Bus.off('ws:zindex:changed', id10),
            () => Bus.off('ws:desktop:switch-next', id11),
            () => Bus.off('ws:desktop:switch-prev', id12)
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

        // 初始化 P2 模块
        DesktopManager.init();
        ZIndexManager.init();

        _currentDesktopId = DesktopManager.getActiveDesktop().id;
        _currentLayout = StateManager.getDesktopLayout(_currentDesktopId) || 'grid';

        _container.innerHTML = `
        <div class="ws-workspace" data-action="workspace">
            ${LayoutSwitcher.render(_currentLayout)}
            <div class="ws-desktops" id="wsDesktopsContainer">
                <!-- DesktopContainer will render here -->
            </div>
            ${DesktopTabs.render()}
        </div>`;

        // 渲染桌面容器
        const desktopsContainer = document.getElementById('wsDesktopsContainer');
        if (desktopsContainer) {
            DesktopContainer.render(desktopsContainer);
            // 初始化 CardManager
            CardManager.init(desktopsContainer);
        }

        // 初始化 DesktopTabs
        DesktopTabs.init();

        // 初始化手势管理
        GestureManager.init(_container);
        GestureManager.onSwipe({
            onLeft: () => DesktopManager.switchNext(),
            onRight: () => DesktopManager.switchPrev()
        });

        _setupListeners();
        Logger.info('[WorkspacePage] Rendered (P2)');
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

        for (const cleanup of _busCleanupFns) {
            cleanup();
        }
        _busCleanupFns = [];

        GestureManager.destroy();
        DesktopTabs.destroy();
        CardManager.destroy();
        ZIndexManager.destroy();

        if (_container) {
            _container.removeEventListener('click', _handleAction);
        }

        if (_container) {
            _container.innerHTML = '';
        }

        _container = null;
        Logger.info('[WorkspacePage] Destroyed');
    }

    return {
        render,
        onSSEEvent,
        destroy
    };
})();
