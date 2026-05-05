/**
 * CardWidget — 卡片外壳组件
 *
 * 职责:
 * 1. 渲染卡片 DOM 结构（header / body / footer / resize handles）
 * 2. 管理卡片内部状态（loading / error / expanded）
 * 3. 挂载/卸载内部 Widget
 * 4. 内容自适应（小卡片截断，大卡片填充）
 *
 * 依赖: Components (全局), DataService, ZIndexManager, ResizeManager, Bus, Logger
 */
const CardWidget = (() => {
    'use strict';

    // ── Internal State ────────────────────────────────────
    const _instances = new Map();  // cardId → { el, widgetInstance, expanded, desktopId }

    // ── Render ────────────────────────────────────────────

    /**
     * 创建卡片 DOM
     */
    function createDOM(card, desktopId) {
        const el = document.createElement('div');
        el.className = `ws-card ws-card--${_getSizeClass(card)}`;
        el.dataset.cardId = card.id;
        el.dataset.desktopId = desktopId;
        el.dataset.action = 'card';
        el.style.zIndex = ZIndexManager.getZ(card.id);

        el.innerHTML = `
            <div class="ws-card__delete-badge" data-action="card-delete" data-card-id="${card.id}" data-desktop-id="${desktopId}">×</div>
            <div class="ws-card__header">
                <div class="ws-card__title">
                    ${card.icon ? `<span class="ws-card__icon">${card.icon}</span>` : ''}
                    <span class="ws-card__title-text">${card.title || '未命名卡片'}</span>
                </div>
                <div class="ws-card__actions">
                    <button class="ws-card__action-btn" data-action="card-refresh" data-card-id="${card.id}" data-desktop-id="${desktopId}" title="刷新">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
                    </button>
                    <button class="ws-card__action-btn" data-action="card-expand" data-card-id="${card.id}" title="展开/收起">↕</button>
                    <button class="ws-card__action-btn" data-action="card-more" data-card-id="${card.id}" title="更多">⋯</button>
                </div>
            </div>
            <div class="ws-card__body">
                <div class="ws-card__body-content"></div>
            </div>
            <div class="ws-card__expand">
                <div class="ws-card__expand-content"></div>
            </div>
            <div class="ws-card__footer">
                <span class="ws-card__type-badge">${_getTypeLabel(card.type)}</span>
                <span class="ws-card__timestamp"></span>
            </div>
        `;

        // 添加 resize handles
        ResizeManager.addHandles(el);

        return el;
    }

    /**
     * 获取尺寸 class
     */
    function _getSizeClass(card) {
        if (!card.layout) return 'sm';
        if (card.layout.w >= 2 && card.layout.h >= 2) return 'lg';
        if (card.layout.w >= 2) return 'md';
        return 'sm';
    }

    /**
     * 获取类型标签
     */
    function _getTypeLabel(type) {
        const map = {
            entry: '入口',
            data: '数据',
            stat: '统计',
            function: '功能',
            shortcut: '快捷'
        };
        return map[type] || type || '卡片';
    }

    // ── Widget Mounting ──────────────────────────────────

    /**
     * 挂载内部 Widget
     */
    async function mountWidget(cardId, desktopId) {
        const instance = _instances.get(cardId);
        if (!instance) return;

        const card = StateManager.getCard(desktopId, cardId);
        if (!card || !card.widget) {
            _renderPlaceholder(instance, card);
            return;
        }

        const container = instance.el.querySelector('.ws-card__body-content');
        if (!container) return;

        // 检查 Widget 是否已注册
        if (typeof WidgetRegistry !== 'undefined' && WidgetRegistry.has(card.widget)) {
            try {
                const widgetDef = WidgetRegistry.get(card.widget);
                if (!widgetDef || typeof widgetDef.mount !== 'function') {
                    _renderPlaceholder(instance, card);
                    return;
                }

                _renderLoading(instance);

                // 错误边界：隔离单个 Widget 的错误
                let widgetInstance;
                try {
                    widgetInstance = await widgetDef.mount(container, {
                        cardId,
                        desktopId,
                        config: card.config || {}
                    });
                } catch (mountError) {
                    Logger.error('[CardWidget] Widget mount error:', card.widget, mountError.message);
                    _renderError(instance, mountError);
                    return;
                }

                // 验证返回值
                if (!widgetInstance || typeof widgetInstance !== 'object') {
                    Logger.warn('[CardWidget] Widget did not return instance:', card.widget);
                    widgetInstance = { destroy: () => {}, refresh: () => {} };
                }

                instance.widgetInstance = widgetInstance;
                _clearLoading(instance);

                // 包装 destroy 方法，防止 Widget 销毁时报错
                const originalDestroy = widgetInstance.destroy.bind(widgetInstance);
                widgetInstance.destroy = () => {
                    try { originalDestroy(); } catch (e) {
                        Logger.warn('[CardWidget] Widget destroy error:', card.widget, e.message);
                    }
                };

                // 包装 refresh 方法
                if (typeof widgetInstance.refresh === 'function') {
                    const originalRefresh = widgetInstance.refresh.bind(widgetInstance);
                    widgetInstance.refresh = () => {
                        try { return originalRefresh(); } catch (e) {
                            Logger.warn('[CardWidget] Widget refresh error:', card.widget, e.message);
                            _renderError(instance, e);
                        }
                    };
                }

                Logger.debug('[CardWidget] Widget mounted:', card.widget, 'for card:', cardId);
            } catch (err) {
                Logger.error('[CardWidget] Widget system error:', card.widget, err.message);
                _renderError(instance, err);
            }
        } else {
            // Widget 未注册，显示占位
            _renderPlaceholder(instance, card);
        }
    }

    /**
     * 卸载内部 Widget
     */
    function unmountWidget(cardId) {
        const instance = _instances.get(cardId);
        if (!instance || !instance.widgetInstance) return;

        if (typeof instance.widgetInstance.destroy === 'function') {
            try {
                instance.widgetInstance.destroy();
            } catch (e) {
                Logger.warn('[CardWidget] Widget destroy error:', e.message);
            }
        }

        instance.widgetInstance = null;
    }

    // ── State Rendering ───────────────────────────────────

    function _renderLoading(instance) {
        const body = instance.el.querySelector('.ws-card__body');
        if (body) body.classList.add('ws-card__body--loading');
        const content = instance.el.querySelector('.ws-card__body-content');
        if (content) {
            content.innerHTML = '<div class="ws-card__spinner"></div>';
        }
    }

    function _clearLoading(instance) {
        const body = instance.el.querySelector('.ws-card__body');
        if (body) body.classList.remove('ws-card__body--loading');
    }

    function _renderError(instance, error) {
        _clearLoading(instance);
        const body = instance.el.querySelector('.ws-card__body');
        if (body) body.classList.add('ws-card__body--error');
        const content = instance.el.querySelector('.ws-card__body-content');
        if (content) {
            const msg = error?._type === 'network' ? '网络连接失败' :
                        error?._type === 'timeout' ? '请求超时' :
                        error?.message || '加载失败';
            content.innerHTML = `
                <div style="text-align:center; padding: 16px;">
                    <div style="font-size: 24px; margin-bottom: 8px;">⚠️</div>
                    <div style="color: var(--text-tertiary); font-size: 13px; margin-bottom: 12px;">${msg}</div>
                    <button class="ws-card__retry-btn" data-action="card-retry" data-card-id="${instance.el.dataset.cardId}" data-desktop-id="${instance.el.dataset.desktopId}">重试</button>
                </div>
            `;
        }
    }

    function _renderPlaceholder(instance, card) {
        const content = instance.el.querySelector('.ws-card__body-content');
        if (content) {
            content.innerHTML = `
                <div class="ws-card__summary">
                    组件 "${card?.widget || '未分配'}" 尚未注册。类型: ${card?.type || '-'}
                </div>
            `;
        }
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 注册卡片实例
     */
    function register(cardId, desktopId, el) {
        _instances.set(cardId, {
            el,
            widgetInstance: null,
            expanded: false,
            desktopId
        });
    }

    /**
     * 注销卡片实例
     */
    function unregister(cardId) {
        unmountWidget(cardId);
        _instances.delete(cardId);
    }

    /**
     * 获取卡片实例
     */
    function get(cardId) {
        return _instances.get(cardId);
    }

    /**
     * 获取卡片 DOM 元素
     */
    function getElement(cardId) {
        const instance = _instances.get(cardId);
        return instance ? instance.el : null;
    }

    /**
     * 切换展开/收起
     */
    function toggleExpand(cardId) {
        const instance = _instances.get(cardId);
        if (!instance) return;

        instance.expanded = !instance.expanded;
        const expandEl = instance.el.querySelector('.ws-card__expand');
        if (expandEl) {
            expandEl.classList.toggle('ws-card__expand--open', instance.expanded);
        }
    }

    /**
     * 更新卡片标题
     */
    function updateTitle(cardId, title) {
        const instance = _instances.get(cardId);
        if (!instance) return;
        const titleEl = instance.el.querySelector('.ws-card__title-text');
        if (titleEl) titleEl.textContent = title;
    }

    /**
     * 设置编辑模式
     */
    function setEditMode(cardId, editing) {
        const instance = _instances.get(cardId);
        if (!instance) return;
        instance.el.classList.toggle('ws-card--editing', editing);
        if (editing) {
            ZIndexManager.setEditZ(cardId);
        }
    }

    /**
     * 更新 z-index
     */
    function updateZIndex(cardId, z) {
        const instance = _instances.get(cardId);
        if (!instance) return;
        instance.el.style.zIndex = z;
    }

    /**
     * 销毁所有实例
     */
    function destroyAll() {
        for (const [cardId] of _instances) {
            unregister(cardId);
        }
        _instances.clear();
    }

    return {
        createDOM,
        register,
        unregister,
        get,
        getElement,
        mountWidget,
        unmountWidget,
        toggleExpand,
        updateTitle,
        setEditMode,
        updateZIndex,
        destroyAll
    };
})();
