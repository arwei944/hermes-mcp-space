/**
 * CardManager — 卡片生命周期管理器
 *
 * 职责:
 * 1. 创建/删除卡片（DOM + 状态）
 * 2. 挂载 Widget 到卡片
 * 3. 协调 LayoutEngine / DragManager / ResizeManager / ZIndexManager
 * 4. 响应式重排
 *
 * 依赖: StateManager, LayoutEngine, DragManager, ResizeManager, ZIndexManager,
 *       CardWidget, Bus, Store, Logger (全局)
 */
const CardManager = (() => {
    'use strict';

    // ── Internal State ────────────────────────────────────
    let _container = null;         // 桌面容器 DOM
    let _currentDesktopId = null;
    let _currentLayout = 'grid';
    let _initialized = false;
    let _resizeObserver = null;

    // ── Card CRUD ─────────────────────────────────────────

    /**
     * 创建并渲染一张卡片
     */
    function createCard(desktopId, cardConfig) {
        const cardId = StateManager.createCard(desktopId, cardConfig);
        _renderCard(desktopId, cardId);
        Logger.info('[CardManager] Card created and rendered:', cardId);
        return cardId;
    }

    /**
     * 删除卡片
     */
    function deleteCard(desktopId, cardId) {
        CardWidget.unregister(cardId);
        ZIndexManager.remove(cardId);

        const el = CardWidget.getElement(cardId);
        if (el && el.parentNode) {
            el.parentNode.removeChild(el);
        }

        StateManager.deleteCard(desktopId, cardId);
        Logger.info('[CardManager] Card deleted:', cardId);
    }

    /**
     * 渲染单张卡片
     */
    function _renderCard(desktopId, cardId) {
        const card = StateManager.getCard(desktopId, cardId);
        if (!card) return;

        const el = CardWidget.createDOM(card, desktopId);
        CardWidget.register(cardId, desktopId, el);

        // 设置 z-index
        el.style.zIndex = ZIndexManager.getZ(cardId);

        // 添加到容器
        if (_container) {
            _container.appendChild(el);
        }

        // 异步挂载 Widget
        CardWidget.mountWidget(cardId, desktopId);
    }

    // ── Layout Management ─────────────────────────────────

    /**
     * 渲染当前桌面所有卡片
     */
    function renderDesktop(desktopId, container, layout) {
        _container = container;
        _currentDesktopId = desktopId;
        _currentLayout = layout || StateManager.getDesktopLayout(desktopId) || 'grid';

        // 清理旧实例
        CardWidget.destroyAll();
        ZIndexManager.resetAll();
        if (_container) _container.innerHTML = '';

        // 获取卡片列表
        const cardIds = StateManager.getCardIds(desktopId);
        if (cardIds.length === 0) return;

        // 获取卡片数据
        const cards = cardIds.map(id => StateManager.getCard(desktopId, id)).filter(Boolean);

        // 计算布局
        const containerWidth = _container ? _container.clientWidth : window.innerWidth;
        const layoutResult = LayoutEngine.calculate(_currentLayout, cards, containerWidth);

        // 渲染卡片
        for (const card of cards) {
            _renderCard(desktopId, card.id);
        }

        // 应用布局位置
        _applyLayout(layoutResult, containerWidth);

        Logger.info('[CardManager] Desktop rendered:', desktopId, 'cards:', cards.length, 'layout:', _currentLayout);
    }

    /**
     * 应用布局位置到 DOM
     */
    function _applyLayout(layoutResult, containerWidth) {
        if (!layoutResult || !layoutResult.positions) return;

        const { positions, mode } = layoutResult;
        const gap = layoutResult.gap || 16;

        for (const pos of positions) {
            const el = CardWidget.getElement(pos.cardId);
            if (!el) continue;

            switch (mode) {
                case 'grid':
                    if (pos.mode === 'grid') {
                        el.style.gridColumn = `${pos.col} / span ${pos.colSpan}`;
                        el.style.gridRow = `${pos.row} / span ${pos.rowSpan}`;
                        el.style.position = '';
                        el.style.left = '';
                        el.style.top = '';
                        el.style.width = '';
                        el.style.height = '';
                    } else {
                        // pinned 卡片在 grid 中用 absolute
                        el.style.position = 'absolute';
                        el.style.gridColumn = '';
                        el.style.gridRow = '';
                        const x = pos.x * (GRID_CELL_W + gap);
                        const y = pos.y * (GRID_CELL_H + gap);
                        el.style.left = `${x}px`;
                        el.style.top = `${y}px`;
                    }
                    break;

                case 'list':
                    el.style.position = '';
                    el.style.gridColumn = '';
                    el.style.gridRow = '';
                    el.style.left = '';
                    el.style.top = '';
                    el.style.width = `${pos.width}px`;
                    el.style.height = `${pos.height}px`;
                    break;

                case 'masonry':
                    el.style.position = 'absolute';
                    el.style.left = `${pos.x}px`;
                    el.style.top = `${pos.y}px`;
                    el.style.width = `${pos.width}px`;
                    el.style.height = `${pos.height}px`;
                    el.style.gridColumn = '';
                    el.style.gridRow = '';
                    break;

                case 'canvas':
                    el.style.position = 'absolute';
                    el.style.left = `${pos.x}px`;
                    el.style.top = `${pos.y}px`;
                    el.style.gridColumn = '';
                    el.style.gridRow = '';
                    break;
            }
        }

        // 设置画布高度
        if (mode === 'canvas' && layoutResult.canvasHeight && _container) {
            _container.style.minHeight = `${layoutResult.canvasHeight}px`;
        } else if (_container) {
            _container.style.minHeight = '';
        }
    }

    // 辅助常量
    const GRID_CELL_W = 280;
    const GRID_CELL_H = 240;

    /**
     * 切换布局模式
     */
    function switchLayout(desktopId, layout) {
        _currentLayout = layout;
        StateManager.setDesktopLayout(desktopId, layout);

        // 重新渲染
        if (_container && _currentDesktopId === desktopId) {
            renderDesktop(desktopId, _container, layout);
        }

        Logger.info('[CardManager] Layout switched to:', layout);
    }

    /**
     * 响应式重排（窗口大小变化时调用）
     */
    function relayout() {
        if (!_container || !_currentDesktopId) return;

        const cardIds = StateManager.getCardIds(_currentDesktopId);
        if (cardIds.length === 0) return;

        const cards = cardIds.map(id => StateManager.getCard(_currentDesktopId, id)).filter(Boolean);
        const containerWidth = _container.clientWidth;
        const layoutResult = LayoutEngine.calculate(_currentLayout, cards, containerWidth);
        _applyLayout(layoutResult, containerWidth);
    }

    // ── Drag Integration ──────────────────────────────────

    /**
     * 处理拖拽结束
     */
    function _handleDragEnd(result) {
        if (!result || !result.desktopId) return;

        const { cardId, desktopId, x, y } = result;

        // 标记为 pinned
        StateManager.updateCardLayout(desktopId, cardId, {
            pinned: true,
            x: Math.round(x),
            y: Math.round(y)
        });

        // 恢复 z-index
        ZIndexManager.restoreZ(cardId);

        // 重新布局
        relayout();

        Logger.debug('[CardManager] Card dragged to:', { x: Math.round(x), y: Math.round(y) });
    }

    // ── Resize Integration ────────────────────────────────

    /**
     * 处理调整大小结束
     */
    function _handleResizeEnd(result) {
        if (!result || !result.desktopId) return;

        const { cardId, desktopId, width, height } = result;

        // 更新卡片尺寸（转换为 grid units）
        const gap = 16;
        const gridW = Math.round(width / (GRID_CELL_W + gap));
        const gridH = Math.round(height / (GRID_CELL_H + gap));

        StateManager.updateCardLayout(desktopId, cardId, {
            w: Math.max(1, gridW),
            h: Math.max(1, gridH),
            pinned: true
        });

        // 重新布局
        relayout();

        Logger.debug('[CardManager] Card resized to:', { width, height, gridW, gridH });
    }

    // ── Click Integration ─────────────────────────────────

    /**
     * 处理卡片点击（置顶）
     */
    function _handleCardClick(e) {
        const cardEl = e.target.closest('.ws-card');
        if (!cardEl) return;

        const cardId = cardEl.dataset.cardId;
        if (!cardId) return;

        // 排除按钮点击
        if (e.target.closest('[data-action="card-expand"]') ||
            e.target.closest('[data-action="card-more"]') ||
            e.target.closest('[data-action="card-refresh"]') ||
            e.target.closest('[data-action="card-retry"]') ||
            e.target.closest('[data-action="card-delete"]') ||
            e.target.closest('.ws-card__resize')) {
            return;
        }

        const z = ZIndexManager.bringToFront(cardId);
        cardEl.style.zIndex = z;
    }

    // ── Init / Destroy ────────────────────────────────────

    function init(container) {
        if (_initialized) return;

        _container = container;

        // 绑定拖拽
        DragManager.init(container);
        DragManager.onCallbacks({
            onEnd: _handleDragEnd
        });

        // 绑定调整大小
        ResizeManager.init(container);
        ResizeManager.onCallbacks({
            onEnd: _handleResizeEnd
        });

        // 绑定点击置顶
        container.addEventListener('mousedown', _handleCardClick);

        // 响应式
        if (window.ResizeObserver) {
            _resizeObserver = new ResizeObserver(() => {
                if (DragManager.isActive()) return; // 拖拽中不重排
                relayout();
            });
            _resizeObserver.observe(container);
        }

        _initialized = true;
        Logger.info('[CardManager] Initialized');
    }

    function destroy() {
        if (_resizeObserver) {
            _resizeObserver.disconnect();
            _resizeObserver = null;
        }

        if (_container) {
            DragManager.destroy(_container);
            ResizeManager.destroy(_container);
            _container.removeEventListener('mousedown', _handleCardClick);
        }

        CardWidget.destroyAll();
        ZIndexManager.resetAll();
        _container = null;
        _currentDesktopId = null;
        _initialized = false;
        Logger.info('[CardManager] Destroyed');
    }

    return {
        init,
        destroy,
        createCard,
        deleteCard,
        renderDesktop,
        switchLayout,
        relayout
    };
})();