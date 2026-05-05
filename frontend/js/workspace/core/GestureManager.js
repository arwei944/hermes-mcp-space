/**
 * GestureManager — 手势识别管理器
 *
 * 职责:
 * 1. 长按检测 → 进入编辑模式（iOS 风格）
 * 2. 左右滑动 → 切换桌面
 * 3. 点击空白区域 → 退出编辑模式
 * 4. 触摸事件支持（移动端）
 *
 * 依赖: Bus, StateManager, Logger (全局)
 */
const GestureManager = (() => {
    'use strict';

    // ── Constants ─────────────────────────────────────────
    const LONG_PRESS_MS = 500;       // 长按阈值
    const SWIPE_THRESHOLD = 50;      // 滑动最小距离
    const SWIPE_MAX_VERTICAL = 80;   // 垂直方向最大偏移（超过则不算水平滑动）
    const MOVE_THRESHOLD = 10;       // 移动超过此距离取消长按

    // ── Internal State ────────────────────────────────────
    let _container = null;
    let _longPressTimer = null;
    let _startX = 0;
    let _startY = 0;
    let _startTarget = null;
    let _isLongPressing = false;
    let _swipeStartX = 0;
    let _swipeStartY = 0;
    let _swiping = false;
    let _onSwipeLeft = null;
    let _onSwipeRight = null;
    let _initialized = false;

    // ── Long Press ────────────────────────────────────────

    function _onPointerDown(e) {
        // 忽略按钮、输入框等交互元素上的长按
        const target = e.target;
        if (target.closest('button, input, textarea, select, a, [data-action="card-delete"], [data-action="card-expand"], [data-action="card-more"], [data-action="card-refresh"], .ws-card__resize, .ws-layout-switcher, .ws-tabs'))) {
            return;
        }

        _startX = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        _startY = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        _startTarget = target;

        _longPressTimer = setTimeout(() => {
            _isLongPressing = true;
            StateManager.enterEditMode();
            // 触觉反馈（如果支持）
            if (navigator.vibrate) navigator.vibrate(10);
            Bus.emit('ws:gesture:longpress');
            Logger.debug('[GestureManager] Long press detected');
        }, LONG_PRESS_MS);
    }

    function _onPointerMove(e) {
        const x = e.clientX || (e.touches && e.touches[0].clientX) || 0;
        const y = e.clientY || (e.touches && e.touches[0].clientY) || 0;
        const dx = Math.abs(x - _startX);
        const dy = Math.abs(y - _startY);

        // 移动超过阈值 → 取消长按
        if (dx > MOVE_THRESHOLD || dy > MOVE_THRESHOLD) {
            _cancelLongPress();
        }

        // 水平滑动检测（仅在非编辑模式下）
        if (!_isLongPressing && !StateManager.getConfig().editMode) {
            if (!_swiping && dx > SWIPE_THRESHOLD && dy < SWIPE_MAX_VERTICAL) {
                _swiping = true;
                _swipeStartX = _startX;
                _swipeStartY = _startY;
                document.body.style.cursor = 'grabbing';
                document.body.style.userSelect = 'none';
            }
        }
    }

    function _onPointerUp(e) {
        _cancelLongPress();

        const x = e.clientX || (e.changedTouches && e.changedTouches[0].clientX) || 0;
        const y = e.clientY || (e.changedTouches && e.changedTouches[0].clientY) || 0;

        if (_swiping) {
            const dx = x - _swipeStartX;
            const dy = Math.abs(y - _swipeStartY);

            if (Math.abs(dx) > SWIPE_THRESHOLD && dy < SWIPE_MAX_VERTICAL) {
                if (dx < 0 && _onSwipeLeft) {
                    _onSwipeLeft();
                    Bus.emit('ws:gesture:swipe-left');
                } else if (dx > 0 && _onSwipeRight) {
                    _onSwipeRight();
                    Bus.emit('ws:gesture:swipe-right');
                }
            }

            _swiping = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    }

    function _cancelLongPress() {
        if (_longPressTimer) {
            clearTimeout(_longPressTimer);
            _longPressTimer = null;
        }
    }

    // ── Edit Mode Exit ────────────────────────────────────

    function _onBackgroundClick(e) {
        if (!StateManager.getConfig().editMode) return;

        // 点击空白区域退出编辑模式
        const target = e.target;
        if (target.closest('.ws-card, .ws-tabs, .ws-layout-switcher, .ws-store-overlay')) {
            return;
        }

        StateManager.exitEditMode();
        Logger.debug('[GestureManager] Edit mode exited (background click)');
    }

    // ── Public API ────────────────────────────────────────

    function init(container) {
        if (_initialized || !container) return;

        _container = container;

        // 鼠标事件
        container.addEventListener('mousedown', _onPointerDown);
        document.addEventListener('mousemove', _onPointerMove);
        document.addEventListener('mouseup', _onPointerUp);

        // 触摸事件
        container.addEventListener('touchstart', _onPointerDown, { passive: true });
        document.addEventListener('touchmove', _onPointerMove, { passive: true });
        document.addEventListener('touchend', _onPointerUp);

        // 点击空白退出编辑模式
        container.addEventListener('click', _onBackgroundClick);

        _initialized = true;
        Logger.info('[GestureManager] Initialized');
    }

    function destroy() {
        if (!_initialized) return;

        if (_container) {
            _container.removeEventListener('mousedown', _onPointerDown);
            _container.removeEventListener('touchstart', _onPointerDown);
            _container.removeEventListener('click', _onBackgroundClick);
        }

        document.removeEventListener('mousemove', _onPointerMove);
        document.removeEventListener('mouseup', _onPointerUp);
        document.removeEventListener('touchmove', _onPointerMove);
        document.removeEventListener('touchend', _onPointerUp);

        _cancelLongPress();
        _container = null;
        _initialized = false;
        Logger.info('[GestureManager] Destroyed');
    }

    /**
     * 设置滑动回调
     */
    function onSwipe({ onLeft, onRight }) {
        _onSwipeLeft = onLeft || null;
        _onSwipeRight = onRight || null;
    }

    return {
        init,
        destroy,
        onSwipe
    };
})();
