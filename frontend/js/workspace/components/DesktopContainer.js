/**
 * DesktopContainer — 桌面容器组件
 *
 * 职责:
 * 1. 管理多个桌面 DOM 的显示/隐藏
 * 2. 桌面切换动画（左滑/右滑）
 * 3. 触摸滑动切换桌面
 * 4. 桌面内容渲染协调
 *
 * 依赖: DesktopManager, CardManager, StateManager, Bus, Logger (全局)
 */
const DesktopContainer = (() => {
    'use strict';

    // ── Internal State ────────────────────────────────────
    let _container = null;
    let _currentDesktopId = null;
    let _touchStartX = 0;
    let _touchStartY = 0;
    let _isTouchDragging = false;

    // ── Rendering ─────────────────────────────────────────

    /**
     * 渲染所有桌面容器
     */
    function render(container) {
        _container = container;
        const desktops = DesktopManager.getAllDesktops();
        const activeId = DesktopManager.getActiveDesktop().id;
        _currentDesktopId = activeId;

        _container.innerHTML = desktops.map(desktop => {
            const isActive = desktop.id === activeId;
            const layout = desktop.layout || 'grid';
            const posClass = _getPositionClass(desktop.id, activeId, desktops);
            const layoutClass = isActive ? `ws-${layout}` : '';

            return `
            <div class="ws-desktop ${posClass} ${layoutClass}" data-desktop-id="${desktop.id}">
                ${isActive ? '' : ''}
            </div>`;
        }).join('');

        // 渲染活跃桌面的卡片
        _renderActiveDesktopCards();

        // 绑定触摸滑动
        _bindTouchSwipe();
    }

    /**
     * 获取位置 class
     */
    function _getPositionClass(desktopId, activeId, allDesktops) {
        if (desktopId === activeId) return 'ws-desktop--active';
        const activeIdx = allDesktops.findIndex(d => d.id === activeId);
        const thisIdx = allDesktops.findIndex(d => d.id === desktopId);
        return thisIdx < activeIdx ? 'ws-desktop--left' : 'ws-desktop--right';
    }

    /**
     * 渲染活跃桌面的卡片
     */
    function _renderActiveDesktopCards() {
        const activeEl = _getActiveElement();
        if (!activeEl) return;

        const cardIds = StateManager.getCardIds(_currentDesktopId);
        const layout = StateManager.getDesktopLayout(_currentDesktopId) || 'grid';

        if (cardIds.length === 0) {
            activeEl.innerHTML = `
            <div class="ws-empty">
                <div class="ws-empty__icon">
                    <svg width="64" height="64" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.3">
                        <rect x="8" y="8" width="48" height="48" rx="8"/>
                        <line x1="24" y1="24" x2="40" y2="24"/><line x1="24" y1="32" x2="40" y2="32"/>
                        <line x1="24" y1="40" x2="34" y2="40"/>
                        <circle cx="48" cy="16" r="8" fill="currentColor" stroke="none" opacity="0.2"/>
                        <line x1="48" y1="12" x2="48" y2="20" stroke="white" stroke-width="2"/>
                        <line x1="44" y1="16" x2="52" y2="16" stroke="white" stroke-width="2"/>
                    </svg>
                </div>
                <div class="ws-empty__text">还没有卡片，长按空白处或点击下方按钮添加</div>
                <button class="ws-empty__action" data-action="open-store">+ 添加卡片</button>
            </div>`;
            return;
        }

        // 使用 CardManager 渲染卡片
        CardManager.renderDesktop(_currentDesktopId, activeEl, layout);
    }

    /**
     * 切换活跃桌面（带动画）
     */
    function switchTo(desktopId, direction) {
        if (desktopId === _currentDesktopId) return;

        const desktops = DesktopManager.getAllDesktops();
        const oldId = _currentDesktopId;
        _currentDesktopId = desktopId;

        // 更新所有桌面的位置 class
        const allEls = _container.querySelectorAll('.ws-desktop');
        allEls.forEach(el => {
            const id = el.dataset.desktopId;
            const posClass = _getPositionClass(id, desktopId, desktops);
            const layout = StateManager.getDesktopLayout(id) || 'grid';

            // 清除旧 class
            el.classList.remove('ws-desktop--active', 'ws-desktop--left', 'ws-desktop--right', 'ws-grid', 'ws-list', 'ws-masonry', 'ws-canvas');

            // 设置新 class
            el.classList.add(posClass);
            if (id === desktopId) {
                el.classList.add(`ws-${layout}`);
            }
        });

        // 渲染新桌面的内容
        const newActiveEl = _getActiveElement();
        if (newActiveEl) {
            const cardIds = StateManager.getCardIds(desktopId);
            const layout = StateManager.getDesktopLayout(desktopId) || 'grid';

            if (cardIds.length === 0) {
                newActiveEl.innerHTML = `
                <div class="ws-empty">
                    <div class="ws-empty__text">还没有卡片，长按空白处或点击下方按钮添加</div>
                    <button class="ws-empty__action" data-action="open-store">+ 添加卡片</button>
                </div>`;
            } else {
                CardManager.renderDesktop(desktopId, newActiveEl, layout);
            }
        }

        Logger.debug('[DesktopContainer] Switched to desktop:', desktopId);
    }

    // ── Touch Swipe ───────────────────────────────────────

    function _bindTouchSwipe() {
        if (!_container) return;

        _container.addEventListener('touchstart', (e) => {
            if (StateManager.getConfig().editMode) return;
            _touchStartX = e.touches[0].clientX;
            _touchStartY = e.touches[0].clientY;
            _isTouchDragging = false;
        }, { passive: true });

        _container.addEventListener('touchmove', (e) => {
            if (StateManager.getConfig().editMode) return;
            const dx = e.touches[0].clientX - _touchStartX;
            const dy = Math.abs(e.touches[0].clientY - _touchStartY);

            if (Math.abs(dx) > 30 && dy < 80) {
                _isTouchDragging = true;
            }
        }, { passive: true });

        _container.addEventListener('touchend', (e) => {
            if (!_isTouchDragging) return;
            const dx = e.changedTouches[0].clientX - _touchStartX;

            if (Math.abs(dx) > 50) {
                if (dx < 0) {
                    DesktopManager.switchNext();
                    Bus.emit('ws:desktop:switch-next');
                } else {
                    DesktopManager.switchPrev();
                    Bus.emit('ws:desktop:switch-prev');
                }
            }

            _isTouchDragging = false;
        }, { passive: true });
    }

    // ── Helpers ───────────────────────────────────────────

    function _getActiveElement() {
        if (!_container) return null;
        return _container.querySelector('.ws-desktop--active');
    }

    /**
     * 获取当前活跃桌面 ID
     */
    function getActiveDesktopId() {
        return _currentDesktopId;
    }

    /**
     * 刷新当前桌面
     */
    function refresh() {
        if (!_container) return;
        _renderActiveDesktopCards();
    }

    return {
        render,
        switchTo,
        refresh,
        getActiveDesktopId
    };
})();
