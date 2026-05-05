/**
 * DragManager — 拖拽管理器
 *
 * 职责:
 * 1. 鼠标拖拽卡片移动
 * 2. 拖拽过程中实时更新位置（transform，不触发 reflow）
 * 3. 拖拽结束提交最终位置
 * 4. 性能优化：requestAnimationFrame + will-change
 *
 * 依赖: Bus (全局), Logger (全局)
 */
const DragManager = (() => {
    'use strict';

    // ── Constants ─────────────────────────────────────────
    const DRAG_THRESHOLD = 5;   // px，超过此距离才开始拖拽
    const HANDLE_SELECTOR = '.ws-card__header';

    // ── Internal State ────────────────────────────────────
    let _active = null;          // { el, cardId, desktopId, startX, startY, offsetX, offsetY, startRect }
    let _isDragging = false;
    let _rafId = null;
    let _onDragStart = null;     // callback
    let _onDragMove = null;      // callback
    let _onDragEnd = null;       // callback

    // ── Event Handlers ────────────────────────────────────

    function _onMouseDown(e) {
        // 只响应左键
        if (e.button !== 0) return;

        // 检查是否点在拖拽手柄上
        const handle = e.target.closest(HANDLE_SELECTOR);
        if (!handle) return;

        const cardEl = handle.closest('.ws-card');
        if (!cardEl) return;

        // 编辑模式下不允许拖拽（点击 × 删除）
        if (cardEl.classList.contains('ws-card--editing')) return;

        e.preventDefault();

        const rect = cardEl.getBoundingClientRect();
        _active = {
            el: cardEl,
            cardId: cardEl.dataset.cardId,
            desktopId: cardEl.dataset.desktopId,
            startX: e.clientX,
            startY: e.clientY,
            offsetX: e.clientX - rect.left,
            offsetY: e.clientY - rect.top,
            startRect: rect,
            hasMoved: false
        };

        document.addEventListener('mousemove', _onMouseMove, { passive: false });
        document.addEventListener('mouseup', _onMouseUp, { once: true });
    }

    function _onMouseMove(e) {
        if (!_active) return;

        const dx = e.clientX - _active.startX;
        const dy = e.clientY - _active.startY;

        // 检查是否超过阈值
        if (!_active.hasMoved) {
            if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD) return;
            _active.hasMoved = true;
            _isDragging = true;

            // 进入拖拽状态
            _active.el.classList.add('ws-card--dragging');
            _active.el.style.willChange = 'transform';
            document.body.style.userSelect = 'none';
            document.body.style.cursor = 'grabbing';

            Bus.emit('ws:drag:start', {
                cardId: _active.cardId,
                desktopId: _active.desktopId,
                startX: _active.startX,
                startY: _active.startY
            });

            if (_onDragStart) _onDragStart(_active);
        }

        e.preventDefault();

        // 使用 rAF 节流
        if (_rafId) cancelAnimationFrame(_rafId);
        _rafId = requestAnimationFrame(() => {
            if (!_active) return;
            const x = e.clientX - _active.offsetX;
            const y = e.clientY - _active.offsetY;
            _active.el.style.transform = `translate(${x - _active.startRect.left}px, ${y - _active.startRect.top}px)`;

            Bus.emit('ws:drag:move', {
                cardId: _active.cardId,
                desktopId: _active.desktopId,
                x, y,
                dx, dy
            });

            if (_onDragMove) _onDragMove({ ..._active, x, y, dx, dy });
        });
    }

    function _onMouseUp(e) {
        document.removeEventListener('mousemove', _onMouseMove);

        if (_rafId) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }

        if (!_active) return;

        if (_active.hasMoved) {
            // 计算最终位置
            const finalX = e.clientX - _active.offsetX;
            const finalY = e.clientY - _active.offsetY;

            // 清理拖拽样式
            _active.el.classList.remove('ws-card--dragging');
            _active.el.style.willChange = '';
            _active.el.style.transform = '';
            document.body.style.userSelect = '';
            document.body.style.cursor = '';

            const result = {
                cardId: _active.cardId,
                desktopId: _active.desktopId,
                x: finalX,
                y: finalY,
                dx: finalX - _active.startRect.left,
                dy: finalY - _active.startRect.top
            };

            Bus.emit('ws:drag:end', result);
            if (_onDragEnd) _onDragEnd(result);
        }

        _isDragging = false;
        _active = null;
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 初始化 DragManager，绑定到指定容器
     */
    function init(container) {
        if (!container) {
            Logger.warn('[DragManager] No container provided');
            return;
        }
        container.addEventListener('mousedown', _onMouseDown);
        Logger.info('[DragManager] Initialized');
    }

    /**
     * 销毁 DragManager
     */
    function destroy(container) {
        if (container) {
            container.removeEventListener('mousedown', _onMouseDown);
        }
        document.removeEventListener('mousemove', _onMouseMove);
        _active = null;
        _isDragging = false;
        Logger.info('[DragManager] Destroyed');
    }

    /**
     * 设置拖拽回调
     */
    function onCallbacks({ onStart, onMove, onEnd }) {
        _onDragStart = onStart || null;
        _onDragMove = onMove || null;
        _onDragEnd = onEnd || null;
    }

    /**
     * 是否正在拖拽
     */
    function isActive() {
        return _isDragging;
    }

    /**
     * 获取当前拖拽信息
     */
    function getActive() {
        return _active ? { cardId: _active.cardId, desktopId: _active.desktopId } : null;
    }

    return {
        init,
        destroy,
        onCallbacks,
        isActive,
        getActive
    };
})();