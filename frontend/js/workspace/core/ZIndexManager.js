/**
 * ZIndexManager — 层级管理器
 *
 * 职责:
 * 1. 点击卡片自动置顶
 * 2. 拖拽时提升层级
 * 3. 编辑模式层级管理
 * 4. z-index 自动递增，避免冲突
 *
 * 依赖: Bus (全局), Logger (全局)
 */
const ZIndexManager = (() => {
    'use strict';

    // ── Constants ─────────────────────────────────────────
    const BASE_Z = 10;
    const DRAG_Z = 100;
    const EDIT_Z = 50;
    const MAX_Z = 9999;

    // ── Internal State ────────────────────────────────────
    let _counter = BASE_Z;
    const _cardZMap = new Map();   // cardId → z-index
    let _initialized = false;

    // ── Helpers ───────────────────────────────────────────

    function _nextZ() {
        _counter++;
        if (_counter > MAX_Z) _counter = BASE_Z + 1;
        return _counter;
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 初始化
     */
    function init() {
        if (_initialized) return;
        _initialized = true;
        Logger.info('[ZIndexManager] Initialized');
    }

    /**
     * 将卡片提升到最顶层
     */
    function bringToFront(cardId) {
        const z = _nextZ();
        _cardZMap.set(cardId, z);
        Bus.emit('ws:zindex:changed', { cardId, z });
        return z;
    }

    /**
     * 获取卡片的 z-index
     */
    function getZ(cardId) {
        return _cardZMap.get(cardId) || BASE_Z;
    }

    /**
     * 设置拖拽层级
     */
    function setDragZ(cardId) {
        _cardZMap.set(cardId, DRAG_Z);
        Bus.emit('ws:zindex:changed', { cardId, z: DRAG_Z });
        return DRAG_Z;
    }

    /**
     * 恢复卡片到正常层级
     */
    function restoreZ(cardId) {
        const z = _nextZ();
        _cardZMap.set(cardId, z);
        Bus.emit('ws:zindex:changed', { cardId, z });
        return z;
    }

    /**
     * 设置编辑模式层级
     */
    function setEditZ(cardId) {
        _cardZMap.set(cardId, EDIT_Z);
        return EDIT_Z;
    }

    /**
     * 获取最高 z-index
     */
    function getMaxZ() {
        let max = BASE_Z;
        for (const z of _cardZMap.values()) {
            if (z > max) max = z;
        }
        return max;
    }

    /**
     * 重置所有层级
     */
    function resetAll() {
        _counter = BASE_Z;
        _cardZMap.clear();
        Logger.debug('[ZIndexManager] All z-indices reset');
    }

    /**
     * 移除卡片层级记录
     */
    function remove(cardId) {
        _cardZMap.delete(cardId);
    }

    /**
     * 销毁
     */
    function destroy() {
        _cardZMap.clear();
        _counter = BASE_Z;
        _initialized = false;
    }

    return {
        init,
        bringToFront,
        getZ,
        setDragZ,
        restoreZ,
        setEditZ,
        getMaxZ,
        resetAll,
        remove,
        destroy,
        BASE_Z,
        DRAG_Z,
        EDIT_Z
    };
})();