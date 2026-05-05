/**
 * ResizeManager — 调整大小管理器
 *
 * 职责:
 * 1. 8方向调整大小（N/S/E/W/NE/NW/SE/SW）
 * 2. 最小尺寸限制（200×120px）
 * 3. 实时预览 + 结束提交
 * 4. 性能优化：requestAnimationFrame
 *
 * 依赖: Bus (全局), Logger (全局)
 */
const ResizeManager = (() => {
    'use strict';

    // ── Constants ─────────────────────────────────────────
    const MIN_W = 200;
    const MIN_H = 120;
    const HANDLE_SELECTOR = '.ws-card__resize';
    const DIRECTIONS = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];

    // 方向 → 光标样式映射
    const CURSOR_MAP = {
        n: 'ns-resize', s: 'ns-resize',
        e: 'ew-resize', w: 'ew-resize',
        ne: 'nesw-resize', sw: 'nesw-resize',
        nw: 'nwse-resize', se: 'nwse-resize'
    };

    // ── Internal State ────────────────────────────────────
    let _active = null;
    let _rafId = null;
    let _onResizeStart = null;
    let _onResizeMove = null;
    let _onResizeEnd = null;

    // ── Event Handlers ────────────────────────────────────

    function _onMouseDown(e) {
        const handle = e.target.closest(HANDLE_SELECTOR);
        if (!handle) return;

        const direction = DIRECTIONS.find(d => handle.classList.contains(`ws-card__resize--${d}`));
        if (!direction) return;

        const cardEl = handle.closest('.ws-card');
        if (!cardEl) return;

        e.preventDefault();
        e.stopPropagation();

        const rect = cardEl.getBoundingClientRect();

        _active = {
            el: cardEl,
            cardId: cardEl.dataset.cardId,
            desktopId: cardEl.dataset.desktopId,
            direction,
            startX: e.clientX,
            startY: e.clientY,
            startRect: { ...rect },
            startWidth: rect.width,
            startHeight: rect.height,
            startLeft: rect.left,
            startTop: rect.top
        };

        document.body.style.cursor = CURSOR_MAP[direction];
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', _onMouseMove, { passive: false });
        document.addEventListener('mouseup', _onMouseUp, { once: true });

        Bus.emit('ws:resize:start', {
            cardId: _active.cardId,
            desktopId: _active.desktopId,
            direction
        });

        if (_onResizeStart) _onResizeStart(_active);
    }

    function _onMouseMove(e) {
        if (!_active) return;
        e.preventDefault();

        if (_rafId) cancelAnimationFrame(_rafId);
        _rafId = requestAnimationFrame(() => {
            if (!_active) return;

            const dx = e.clientX - _active.startX;
            const dy = e.clientY - _active.startY;
            const dir = _active.direction;

            let newW = _active.startWidth;
            let newH = _active.startHeight;
            let newLeft = _active.startLeft;
            let newTop = _active.startTop;

            // 水平方向
            if (dir.includes('e')) {
                newW = Math.max(MIN_W, _active.startWidth + dx);
            }
            if (dir.includes('w')) {
                const maxDx = _active.startWidth - MIN_W;
                const clampedDx = Math.min(dx, maxDx);
                newW = _active.startWidth - clampedDx;
                newLeft = _active.startLeft + clampedDx;
            }

            // 垂直方向
            if (dir.includes('s')) {
                newH = Math.max(MIN_H, _active.startHeight + dy);
            }
            if (dir.includes('n')) {
                const maxDy = _active.startHeight - MIN_H;
                const clampedDy = Math.min(dy, maxDy);
                newH = _active.startHeight - clampedDy;
                newTop = _active.startTop + clampedDy;
            }

            // 应用尺寸（使用 transform 避免触发 layout）
            _active.el.style.width = `${Math.round(newW)}px`;
            _active.el.style.height = `${Math.round(newH)}px`;
            if (dir.includes('w')) {
                _active.el.style.position = 'relative';
                _active.el.style.left = `${Math.round(newLeft - _active.startLeft)}px`;
            }
            if (dir.includes('n')) {
                _active.el.style.position = 'relative';
                _active.el.style.top = `${Math.round(newTop - _active.startTop)}px`;
            }

            Bus.emit('ws:resize:move', {
                cardId: _active.cardId,
                desktopId: _active.desktopId,
                direction: dir,
                width: Math.round(newW),
                height: Math.round(newH)
            });

            if (_onResizeMove) _onResizeMove({ ..._active, width: newW, height: newH });
        });
    }

    function _onMouseUp(e) {
        document.removeEventListener('mousemove', _onMouseMove);

        if (_rafId) {
            cancelAnimationFrame(_rafId);
            _rafId = null;
        }

        if (!_active) return;

        // 清理内联样式（让布局引擎接管）
        _active.el.style.width = '';
        _active.el.style.height = '';
        _active.el.style.position = '';
        _active.el.style.left = '';
        _active.el.style.top = '';
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        // 计算最终尺寸
        const finalRect = _active.el.getBoundingClientRect();
        const result = {
            cardId: _active.cardId,
            desktopId: _active.desktopId,
            direction: _active.direction,
            width: Math.round(finalRect.width),
            height: Math.round(finalRect.height)
        };

        Bus.emit('ws:resize:end', result);
        if (_onResizeEnd) _onResizeEnd(result);

        _active = null;
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 初始化 ResizeManager
     */
    function init(container) {
        if (!container) {
            Logger.warn('[ResizeManager] No container provided');
            return;
        }
        container.addEventListener('mousedown', _onMouseDown);
        Logger.info('[ResizeManager] Initialized');
    }

    /**
     * 销毁 ResizeManager
     */
    function destroy(container) {
        if (container) {
            container.removeEventListener('mousedown', _onMouseDown);
        }
        document.removeEventListener('mousemove', _onMouseMove);
        _active = null;
        Logger.info('[ResizeManager] Destroyed');
    }

    /**
     * 设置回调
     */
    function onCallbacks({ onStart, onMove, onEnd }) {
        _onResizeStart = onStart || null;
        _onResizeMove = onMove || null;
        _onResizeEnd = onEnd || null;
    }

    /**
     * 为卡片元素添加 resize handles
     */
    function addHandles(cardEl) {
        if (!cardEl || cardEl.querySelector('.ws-card__resize')) return;
        const handlesHTML = DIRECTIONS.map(dir =>
            `<div class="ws-card__resize ws-card__resize--${dir}" data-resize-dir="${dir}"></div>`
        ).join('');
        cardEl.insertAdjacentHTML('beforeend', handlesHTML);
    }

    return {
        init,
        destroy,
        onCallbacks,
        addHandles,
        MIN_W,
        MIN_H
    };
})();