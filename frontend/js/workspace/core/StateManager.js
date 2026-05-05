/**
 * StateManager — 工作台状态管理器
 *
 * 职责:
 * 1. 在 Store 上定义 workspace / desktops / cards 命名空间
 * 2. 提供命名空间隔离的读写 API
 * 3. 自动持久化到 localStorage（防抖 1s）
 * 4. 页面加载时从 localStorage 恢复状态
 *
 * 依赖: Store (全局), Bus (全局), Logger (全局)
 */
const StateManager = (() => {
    'use strict';

    // ── Constants ─────────────────────────────────────────
    const STORAGE_KEY = 'hermes_workspace_state';
    const DEBOUNCE_MS = 1000;
    const PERSIST_PATHS = [
        'workspace.config',
        'workspace.activeDesktop',
        'workspace.desktops',
        'desktops',
        'cards'
    ];

    // ── Internal State ────────────────────────────────────
    let _debounceTimer = null;
    let _isRestoring = false;
    let _watcherIds = [];
    let _initialized = false;

    // ── Default Values ────────────────────────────────────
    const DEFAULT_WORKSPACE_CONFIG = {
        theme: 'auto',           // 'auto' | 'light' | 'dark'
        editMode: false,
        gridSize: { cols: 4, rows: 4 },
        gridGap: 16,
        defaultLayout: 'grid',   // 'grid' | 'list' | 'masonry' | 'canvas'
        showGrid: true
    };

    const DEFAULT_DESKTOP = {
        id: 'desktop_1',
        name: '主桌面',
        layout: 'grid',
        cardIds: [],
        createdAt: Date.now()
    };

    // ── Helpers ───────────────────────────────────────────

    /**
     * 生成唯一 ID
     */
    function _generateId(prefix = 'id') {
        return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
    }

    /**
     * 深度合并对象
     */
    function _deepMerge(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (
                source[key] &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                target[key] &&
                typeof target[key] === 'object' &&
                !Array.isArray(target[key])
            ) {
                result[key] = _deepMerge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    /**
     * 从 Store 中提取需要持久化的状态子集
     */
    function _extractPersistState() {
        const state = {};
        for (const path of PERSIST_PATHS) {
            const val = Store.get(path);
            if (val !== undefined) {
                state[path] = val;
            }
        }
        return state;
    }

    /**
     * 防抖写入 localStorage
     */
    function _schedulePersist() {
        if (_debounceTimer) clearTimeout(_debounceTimer);
        _debounceTimer = setTimeout(() => {
            _persistToStorage();
            _debounceTimer = null;
        }, DEBOUNCE_MS);
    }

    /**
     * 实际写入 localStorage
     */
    function _persistToStorage() {
        try {
            const state = _extractPersistState();
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            Logger.debug('[StateManager] State persisted to localStorage');
        } catch (e) {
            Logger.warn('[StateManager] Failed to persist state:', e.message);
            // localStorage 满了，尝试清理
            if (e.name === 'QuotaExceededError') {
                _handleStorageFull();
            }
        }
    }

    /**
     * localStorage 满时清理策略：只保留桌面结构和卡片配置，清除数据缓存
     */
    function _handleStorageFull() {
        try {
            const state = _extractPersistState();
            // 清除卡片数据缓存
            if (state.cards) {
                for (const desktopId of Object.keys(state.cards)) {
                    for (const cardId of Object.keys(state.cards[desktopId])) {
                        delete state.cards[desktopId][cardId].data;
                        delete state.cards[desktopId][cardId].loading;
                        delete state.cards[desktopId][cardId].error;
                    }
                }
            }
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            Logger.warn('[StateManager] Storage full, cleared card data caches');
        } catch (e2) {
            Logger.error('[StateManager] Storage cleanup failed:', e2.message);
        }
    }

    /**
     * 从 localStorage 恢复状态
     */
    function _restoreFromStorage() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (e) {
            Logger.warn('[StateManager] Failed to restore state:', e.message);
            return null;
        }
    }

    /**
     * 设置 watcher 监听状态变化，触发持久化
     */
    function _setupWatchers() {
        // 监听 workspace 命名空间变化
        const id1 = Store.watch('workspace', () => {
            if (!_isRestoring) _schedulePersist();
        });

        // 监听 desktops 命名空间变化
        const id2 = Store.watch('desktops', () => {
            if (!_isRestoring) _schedulePersist();
        });

        // 监听 cards 命名空间变化
        const id3 = Store.watch('cards', () => {
            if (!_isRestoring) _schedulePersist();
        });

        _watcherIds = [id1, id2, id3];
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 初始化 StateManager
     * 1. 在 Store 上定义 workspace / desktops / cards 命名空间
     * 2. 从 localStorage 恢复状态
     * 3. 设置 watcher 自动持久化
     */
    function init() {
        if (_initialized) {
            Logger.warn('[StateManager] Already initialized');
            return;
        }

        Logger.info('[StateManager] Initializing...');

        // 1. 定义 workspace 全局状态
        Store.define('workspace', {
            config: { ...DEFAULT_WORKSPACE_CONFIG },
            activeDesktop: 'desktop_1',
            desktops: ['desktop_1']
        });

        // 2. 尝试从 localStorage 恢复
        const saved = _restoreFromStorage();
        if (saved) {
            _isRestoring = true;
            try {
                // 恢复 workspace 配置（合并默认值）
                if (saved['workspace.config']) {
                    const mergedConfig = _deepMerge(DEFAULT_WORKSPACE_CONFIG, saved['workspace.config']);
                    Store.set('workspace.config', mergedConfig);
                }
                if (saved['workspace.activeDesktop']) {
                    Store.set('workspace.activeDesktop', saved['workspace.activeDesktop']);
                }
                if (saved['workspace.desktops']) {
                    Store.set('workspace.desktops', saved['workspace.desktops']);
                }

                // 恢复桌面状态
                if (saved['desktops']) {
                    for (const [desktopId, desktopState] of Object.entries(saved['desktops'])) {
                        Store.define(`desktops.${desktopId}`, desktopState);
                    }
                }

                // 恢复卡片状态
                if (saved['cards']) {
                    for (const [desktopId, cards] of Object.entries(saved['cards'])) {
                        for (const [cardId, cardState] of Object.entries(cards)) {
                            Store.define(`cards.${desktopId}.${cardId}`, cardState);
                        }
                    }
                }

                Logger.info('[StateManager] State restored from localStorage');
            } catch (e) {
                Logger.error('[StateManager] Failed to restore state:', e.message);
            } finally {
                _isRestoring = false;
            }
        }

        // 3. 确保至少有一个默认桌面
        const desktops = Store.get('workspace.desktops') || [];
        if (desktops.length === 0) {
            Store.set('workspace.desktops', ['desktop_1']);
            Store.set('workspace.activeDesktop', 'desktop_1');
            Store.define('desktops.desktop_1', { ...DEFAULT_DESKTOP });
        } else {
            // 确保每个桌面都有状态定义
            for (const desktopId of desktops) {
                if (!Store.get(`desktops.${desktopId}`)) {
                    Store.define(`desktops.${desktopId}`, {
                        ...DEFAULT_DESKTOP,
                        id: desktopId,
                        name: desktopId === 'desktop_1' ? '主桌面' : `桌面 ${desktopId.split('_')[1]}`
                    });
                }
            }
        }

        // 4. 设置 watcher
        _setupWatchers();

        _initialized = true;
        Logger.info('[StateManager] Initialized successfully');
        Bus.emit('ws:state:ready');
    }

    // ── Workspace Config API ──────────────────────────────

    /**
     * 获取工作台配置
     */
    function getConfig() {
        return Store.get('workspace.config');
    }

    /**
     * 更新工作台配置（部分更新）
     */
    function updateConfig(partial) {
        const current = Store.get('workspace.config');
        Store.set('workspace.config', { ...current, ...partial });
    }

    // ── Desktop API ───────────────────────────────────────

    /**
     * 获取所有桌面 ID 列表
     */
    function getDesktopIds() {
        return Store.get('workspace.desktops') || [];
    }

    /**
     * 获取当前活跃桌面 ID
     */
    function getActiveDesktopId() {
        return Store.get('workspace.activeDesktop');
    }

    /**
     * 切换活跃桌面
     */
    function setActiveDesktop(desktopId) {
        const ids = getDesktopIds();
        if (!ids.includes(desktopId)) {
            Logger.warn('[StateManager] Desktop not found:', desktopId);
            return false;
        }
        Store.set('workspace.activeDesktop', desktopId);
        Bus.emit('ws:desktop:switched', { desktopId });
        return true;
    }

    /**
     * 创建新桌面
     * @returns {string} 新桌面 ID
     */
    function createDesktop(name) {
        const id = _generateId('desktop');
        const desktopCount = getDesktopIds().length + 1;
        const desktopState = {
            id,
            name: name || `桌面 ${desktopCount}`,
            layout: Store.get('workspace.config.defaultLayout') || 'grid',
            cardIds: [],
            createdAt: Date.now()
        };

        Store.define(`desktops.${id}`, desktopState);
        Store.set('workspace.desktops', [...getDesktopIds(), id]);
        Bus.emit('ws:desktop:created', { desktopId: id, desktop: desktopState });
        Logger.info('[StateManager] Desktop created:', id);
        return id;
    }

    /**
     * 删除桌面
     */
    function deleteDesktop(desktopId) {
        const ids = getDesktopIds();
        if (ids.length <= 1) {
            Logger.warn('[StateManager] Cannot delete the last desktop');
            return false;
        }

        const idx = ids.indexOf(desktopId);
        if (idx === -1) return false;

        // 清理桌面状态
        const cardIds = Store.get(`desktops.${desktopId}.cardIds`) || [];
        for (const cardId of cardIds) {
            Store.set(`cards.${desktopId}.${cardId}`, undefined);
        }
        Store.set(`desktops.${desktopId}`, undefined);

        // 从列表移除
        const newIds = ids.filter(id => id !== desktopId);
        Store.set('workspace.desktops', newIds);

        // 如果删除的是当前活跃桌面，切换到相邻桌面
        if (getActiveDesktopId() === desktopId) {
            const newActive = newIds[Math.min(idx, newIds.length - 1)];
            Store.set('workspace.activeDesktop', newActive);
        }

        Bus.emit('ws:desktop:deleted', { desktopId });
        Logger.info('[StateManager] Desktop deleted:', desktopId);
        return true;
    }

    /**
     * 重命名桌面
     */
    function renameDesktop(desktopId, newName) {
        Store.set(`desktops.${desktopId}.name`, newName);
        Bus.emit('ws:desktop:renamed', { desktopId, name: newName });
    }

    /**
     * 获取桌面布局模式
     */
    function getDesktopLayout(desktopId) {
        return Store.get(`desktops.${desktopId}.layout`) || 'grid';
    }

    /**
     * 设置桌面布局模式
     */
    function setDesktopLayout(desktopId, layout) {
        Store.set(`desktops.${desktopId}.layout`, layout);
        Bus.emit('ws:desktop:layout-changed', { desktopId, layout });
    }

    // ── Card API ──────────────────────────────────────────

    /**
     * 获取桌面上的所有卡片 ID
     */
    function getCardIds(desktopId) {
        return Store.get(`desktops.${desktopId}.cardIds`) || [];
    }

    /**
     * 获取卡片状态
     */
    function getCard(desktopId, cardId) {
        return Store.get(`cards.${desktopId}.${cardId}`);
    }

    /**
     * 创建卡片
     * @returns {string} 新卡片 ID
     */
    function createCard(desktopId, cardConfig) {
        const id = _generateId('card');
        const cardState = {
            id,
            type: cardConfig.type || 'data',
            widget: cardConfig.widget || '',
            title: cardConfig.title || '',
            icon: cardConfig.icon || '',
            layout: {
                x: cardConfig.x ?? -1,
                y: cardConfig.y ?? -1,
                w: cardConfig.w ?? 1,
                h: cardConfig.h ?? 1,
                z: cardConfig.z ?? 0,
                pinned: cardConfig.pinned ?? false
            },
            data: null,
            loading: false,
            error: null,
            config: cardConfig.config || {},
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        Store.define(`cards.${desktopId}.${id}`, cardState);
        Store.set(`desktops.${desktopId}.cardIds`, [...getCardIds(desktopId), id]);
        Bus.emit('ws:card:created', { desktopId, cardId: id, card: cardState });
        Logger.info('[StateManager] Card created:', id, 'on desktop:', desktopId);
        return id;
    }

    /**
     * 更新卡片状态（部分更新）
     */
    function updateCard(desktopId, cardId, partial) {
        const current = Store.get(`cards.${desktopId}.${cardId}`);
        if (!current) {
            Logger.warn('[StateManager] Card not found:', cardId);
            return false;
        }

        const updated = { ...current, ...partial, updatedAt: Date.now() };
        // 深度合并 layout
        if (partial.layout && current.layout) {
            updated.layout = { ...current.layout, ...partial.layout };
        }
        Store.set(`cards.${desktopId}.${cardId}`, updated);
        Bus.emit('ws:card:updated', { desktopId, cardId, changes: partial });
        return true;
    }

    /**
     * 删除卡片
     */
    function deleteCard(desktopId, cardId) {
        const ids = getCardIds(desktopId);
        if (!ids.includes(cardId)) return false;

        Store.set(`desktops.${desktopId}.cardIds`, ids.filter(id => id !== cardId));
        Store.set(`cards.${desktopId}.${cardId}`, undefined);
        Bus.emit('ws:card:deleted', { desktopId, cardId });
        Logger.info('[StateManager] Card deleted:', cardId);
        return true;
    }

    /**
     * 更新卡片布局位置
     */
    function updateCardLayout(desktopId, cardId, layoutPartial) {
        return updateCard(desktopId, cardId, { layout: layoutPartial });
    }

    /**
     * 设置卡片数据缓存
     */
    function setCardData(desktopId, cardId, data) {
        return updateCard(desktopId, cardId, { data, loading: false, error: null });
    }

    /**
     * 设置卡片加载状态
     */
    function setCardLoading(desktopId, cardId, loading) {
        return updateCard(desktopId, cardId, { loading });
    }

    /**
     * 设置卡片错误状态
     */
    function setCardError(desktopId, cardId, error) {
        return updateCard(desktopId, cardId, { error, loading: false });
    }

    /**
     * 提升卡片 z-index（点击置顶）
     */
    function bringCardToFront(desktopId, cardId) {
        const current = Store.get(`cards.${desktopId}.${cardId}`);
        if (!current) return;

        // 找到当前桌面最高 z-index
        const cardIds = getCardIds(desktopId);
        let maxZ = 0;
        for (const cid of cardIds) {
            const card = Store.get(`cards.${desktopId}.${cid}`);
            if (card && card.layout && card.layout.z > maxZ) {
                maxZ = card.layout.z;
            }
        }

        if (current.layout.z < maxZ) {
            updateCardLayout(desktopId, cardId, { z: maxZ + 1 });
        }
    }

    // ── Edit Mode API ─────────────────────────────────────

    /**
     * 进入编辑模式
     */
    function enterEditMode() {
        Store.set('workspace.config.editMode', true);
        Bus.emit('ws:edit:enter');
    }

    /**
     * 退出编辑模式
     */
    function exitEditMode() {
        Store.set('workspace.config.editMode', false);
        Bus.emit('ws:edit:exit');
    }

    /**
     * 切换编辑模式
     */
    function toggleEditMode() {
        const isEditing = Store.get('workspace.config.editMode');
        if (isEditing) {
            exitEditMode();
        } else {
            enterEditMode();
        }
    }

    // ── Utility API ───────────────────────────────────────

    /**
     * 获取完整状态快照（用于调试）
     */
    function getSnapshot() {
        return {
            workspace: Store.get('workspace'),
            desktops: Store.get('desktops'),
            cards: Store.get('cards')
        };
    }

    /**
     * 重置所有工作台状态
     */
    function resetAll() {
        // 清除 localStorage
        try {
            localStorage.removeItem(STORAGE_KEY);
        } catch (e) { /* ignore */ }

        // 重置 Store 状态
        Store.reset('workspace');
        Store.reset('desktops');
        Store.reset('cards');

        // 重新初始化
        _initialized = false;
        init();

        Bus.emit('ws:state:reset');
        Logger.info('[StateManager] All state reset');
    }

    /**
     * 强制立即持久化（绕过防抖）
     */
    function flush() {
        if (_debounceTimer) {
            clearTimeout(_debounceTimer);
            _debounceTimer = null;
        }
        _persistToStorage();
    }

    /**
     * 销毁 StateManager
     */
    function destroy() {
        if (_debounceTimer) {
            clearTimeout(_debounceTimer);
            _debounceTimer = null;
        }
        for (const wid of _watcherIds) {
            // Store doesn't have unwatch, but watchers are cleaned when path is reset
        }
        _watcherIds = [];
        _initialized = false;
        Logger.info('[StateManager] Destroyed');
    }

    // ── Expose ────────────────────────────────────────────
    return {
        init,
        destroy,
        // Config
        getConfig,
        updateConfig,
        // Desktop
        getDesktopIds,
        getActiveDesktopId,
        setActiveDesktop,
        createDesktop,
        deleteDesktop,
        renameDesktop,
        getDesktopLayout,
        setDesktopLayout,
        // Card
        getCardIds,
        getCard,
        createCard,
        updateCard,
        deleteCard,
        updateCardLayout,
        setCardData,
        setCardLoading,
        setCardError,
        bringCardToFront,
        // Edit Mode
        enterEditMode,
        exitEditMode,
        toggleEditMode,
        // Utility
        getSnapshot,
        resetAll,
        flush
    };
})();
