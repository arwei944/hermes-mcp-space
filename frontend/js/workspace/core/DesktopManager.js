/**
 * DesktopManager — 多桌面管理器
 *
 * 职责:
 * 1. 协调多桌面的创建/删除/切换/重命名
 * 2. 首次使用时创建默认桌面（含常用卡片）
 * 3. 桌面独立布局管理
 * 4. 桌面切换动画协调
 *
 * 依赖: StateManager, CardManager, Bus, Store, Logger (全局)
 */
const DesktopManager = (() => {
    'use strict';

    // ── Default Desktop Cards ─────────────────────────────
    const DEFAULT_CARDS = [
        { type: 'entry',    widget: 'knowledge-entry',  title: '知识库',   icon: '📖', w: 1, h: 1 },
        { type: 'entry',    widget: 'sessions-entry',   title: '会话管理', icon: '💬', w: 1, h: 1 },
        { type: 'entry',    widget: 'memory-entry',     title: '记忆管理', icon: '🧠', w: 1, h: 1 },
        { type: 'stat',     widget: 'dashboard-stats',  title: '系统概览', icon: '📊', w: 2, h: 1 },
        { type: 'function', widget: 'global-search',    title: '全局搜索', icon: '🔍', w: 1, h: 1 }
    ];

    // ── Internal State ────────────────────────────────────
    let _initialized = false;

    // ── Public API ────────────────────────────────────────

    /**
     * 初始化 DesktopManager
     * - 检查是否首次使用，创建默认桌面
     */
    function init() {
        if (_initialized) return;

        const desktopIds = StateManager.getDesktopIds();

        if (desktopIds.length === 0) {
            _createDefaultDesktop();
        }

        _initialized = true;
        Logger.info('[DesktopManager] Initialized, desktops:', StateManager.getDesktopIds().length);
    }

    /**
     * 创建默认桌面（含常用卡片）
     */
    function _createDefaultDesktop() {
        const desktopId = StateManager.createDesktop('主桌面');
        StateManager.setActiveDesktop(desktopId);

        // 添加默认卡片
        for (const cardDef of DEFAULT_CARDS) {
            StateManager.createCard(desktopId, {
                type: cardDef.type,
                widget: cardDef.widget,
                title: cardDef.title,
                icon: cardDef.icon,
                w: cardDef.w,
                h: cardDef.h,
                x: -1,
                y: -1,
                pinned: false
            });
        }

        StateManager.flush();
        Logger.info('[DesktopManager] Default desktop created with', DEFAULT_CARDS.length, 'cards');
        Bus.emit('ws:desktop:default-created', { desktopId });
    }

    /**
     * 切换到指定桌面
     */
    function switchTo(desktopId) {
        const ids = StateManager.getDesktopIds();
        if (!ids.includes(desktopId)) {
            Logger.warn('[DesktopManager] Desktop not found:', desktopId);
            return false;
        }

        StateManager.setActiveDesktop(desktopId);
        return true;
    }

    /**
     * 切换到下一个桌面
     */
    function switchNext() {
        const ids = StateManager.getDesktopIds();
        const activeId = StateManager.getActiveDesktopId();
        const currentIdx = ids.indexOf(activeId);
        const nextIdx = (currentIdx + 1) % ids.length;
        return switchTo(ids[nextIdx]);
    }

    /**
     * 切换到上一个桌面
     */
    function switchPrev() {
        const ids = StateManager.getDesktopIds();
        const activeId = StateManager.getActiveDesktopId();
        const currentIdx = ids.indexOf(activeId);
        const prevIdx = (currentIdx - 1 + ids.length) % ids.length;
        return switchTo(ids[prevIdx]);
    }

    /**
     * 创建新桌面
     */
    function createDesktop(name) {
        const id = StateManager.createDesktop(name);
        StateManager.setActiveDesktop(id);
        StateManager.flush();
        Logger.info('[DesktopManager] Desktop created:', id, name || '');
        return id;
    }

    /**
     * 删除桌面
     */
    function deleteDesktop(desktopId) {
        const result = StateManager.deleteDesktop(desktopId);
        if (result) {
            StateManager.flush();
            Logger.info('[DesktopManager] Desktop deleted:', desktopId);
        }
        return result;
    }

    /**
     * 重命名桌面
     */
    function renameDesktop(desktopId, newName) {
        if (!newName || !newName.trim()) return false;
        StateManager.renameDesktop(desktopId, newName.trim());
        StateManager.flush();
        Logger.info('[DesktopManager] Desktop renamed:', desktopId, '→', newName.trim());
        return true;
    }

    /**
     * 获取桌面信息
     */
    function getDesktop(desktopId) {
        return Store.get(`desktops.${desktopId}`);
    }

    /**
     * 获取所有桌面信息
     */
    function getAllDesktops() {
        return StateManager.getDesktopIds().map(id => ({
            id,
            ...Store.get(`desktops.${id}`)
        }));
    }

    /**
     * 获取当前活跃桌面
     */
    function getActiveDesktop() {
        const id = StateManager.getActiveDesktopId();
        return {
            id,
            ...Store.get(`desktops.${id}`)
        };
    }

    /**
     * 获取桌面数量
     */
    function getCount() {
        return StateManager.getDesktopIds().length;
    }

    return {
        init,
        switchTo,
        switchNext,
        switchPrev,
        createDesktop,
        deleteDesktop,
        renameDesktop,
        getDesktop,
        getAllDesktops,
        getActiveDesktop,
        getCount
    };
})();
