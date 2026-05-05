/**
 * CardStore — 卡片商店组件
 *
 * 职责:
 * 1. 展示所有可添加的 Widget（按类别分组）
 * 2. 点击 Widget 添加到当前桌面
 * 3. 底部弹出式面板（iOS 风格）
 * 4. 搜索过滤
 *
 * 依赖: WidgetRegistry, StateManager, CardManager, Bus, Logger (全局)
 */
const CardStore = (() => {
    'use strict';

    // ── Internal State ────────────────────────────────────
    let _overlay = null;
    let _isOpen = false;
    let _searchQuery = '';

    // ── Category Labels ───────────────────────────────────
    const CATEGORY_LABELS = {
        entries: '入口',
        data: '数据',
        stats: '统计',
        functions: '功能',
        shortcuts: '快捷方式'
    };

    // ── Render ────────────────────────────────────────────

    function _renderStore() {
        const allWidgets = WidgetRegistry.list();
        let filtered = allWidgets;

        if (_searchQuery) {
            const q = _searchQuery.toLowerCase();
            filtered = allWidgets.filter(w =>
                w.label.toLowerCase().includes(q) ||
                w.description.toLowerCase().includes(q) ||
                w.name.toLowerCase().includes(q)
            );
        }

        // 按类别分组
        const grouped = {};
        for (const w of filtered) {
            const cat = w.category || 'other';
            if (!grouped[cat]) grouped[cat] = [];
            grouped[cat].push(w);
        }

        const categoriesHtml = Object.entries(grouped).map(([cat, widgets]) => `
            <div class="ws-store__category">
                <div class="ws-store__category-title">${CATEGORY_LABELS[cat] || cat}</div>
                <div class="ws-store__grid">
                    ${widgets.map(w => `
                        <div class="ws-store__item" data-action="add-widget" data-widget="${w.name}"
                             title="${w.description}">
                            <div class="ws-store__item-icon">${w.icon}</div>
                            <div class="ws-store__item-name">${w.label}</div>
                            <div class="ws-store__item-desc">${w.description}</div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('');

        const emptyHtml = filtered.length === 0 ? `
            <div style="text-align:center; padding:40px; color:var(--text-tertiary);">
                没有找到匹配的组件
            </div>` : '';

        return `
        <div class="ws-store__header">
            <div class="ws-store__title">添加卡片</div>
            <div style="display:flex; align-items:center; gap:8px;">
                <input type="text" class="ws-store__search" placeholder="搜索组件..."
                       value="${_searchQuery}" data-action="store-search"
                       style="padding:6px 12px; border:1px solid var(--border); border-radius:var(--radius-xs);
                              background:var(--surface-hover); font-size:13px; width:180px; outline:none;
                              color:var(--text-primary);">
                <button class="ws-store__close" data-action="close-store" title="关闭">✕</button>
            </div>
        </div>
        <div class="ws-store__body">
            ${categoriesHtml}
            ${emptyHtml}
        </div>`;
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 打开卡片商店
     */
    function open() {
        if (_isOpen) return;
        _isOpen = true;
        _searchQuery = '';

        // 创建 overlay
        _overlay = document.createElement('div');
        _overlay.className = 'ws-store-overlay';
        _overlay.innerHTML = `
        <div class="ws-store">
            ${_renderStore()}
        </div>`;

        document.body.appendChild(_overlay);

        // 触发动画
        requestAnimationFrame(() => {
            _overlay.classList.add('ws-store-overlay--open');
        });

        // 绑定事件
        _overlay.addEventListener('click', _handleStoreClick);
        _overlay.addEventListener('input', _handleSearch);

        Logger.debug('[CardStore] Opened');
    }

    /**
     * 关闭卡片商店
     */
    function close() {
        if (!_isOpen || !_overlay) return;

        _overlay.classList.remove('ws-store-overlay--open');

        setTimeout(() => {
            if (_overlay && _overlay.parentNode) {
                _overlay.parentNode.removeChild(_overlay);
            }
            _overlay = null;
            _isOpen = false;
        }, 350);

        Logger.debug('[CardStore] Closed');
    }

    /**
     * 是否打开
     */
    function isOpen() {
        return _isOpen;
    }

    // ── Event Handlers ────────────────────────────────────

    function _handleStoreClick(e) {
        const action = e.target.closest('[data-action]');
        if (!action) return;

        switch (action.dataset.action) {
            case 'close-store':
                close();
                break;
            case 'add-widget':
                _addWidget(action.dataset.widget);
                break;
        }
    }

    function _handleSearch(e) {
        if (e.target.matches('.ws-store__search')) {
            _searchQuery = e.target.value;
            // 重新渲染内容
            const storeEl = _overlay.querySelector('.ws-store');
            if (storeEl) {
                storeEl.innerHTML = _renderStore();
            }
        }
    }

    function _addWidget(widgetName) {
        const widgetDef = WidgetRegistry.get(widgetName);
        if (!widgetDef) {
            Logger.warn('[CardStore] Widget not found:', widgetName);
            return;
        }

        const desktopId = StateManager.getActiveDesktopId();
        if (!desktopId) return;

        CardManager.createCard(desktopId, {
            type: widgetDef.type,
            widget: widgetName,
            title: widgetDef.label,
            icon: widgetDef.icon,
            w: widgetDef.defaultSize?.w || 1,
            h: widgetDef.defaultSize?.h || 1,
            x: -1,
            y: -1,
            pinned: false
        });

        Bus.emit('ws:card:created', { desktopId, widget: widgetName });
        Logger.info('[CardStore] Widget added:', widgetName, 'to desktop:', desktopId);

        // 不自动关闭，允许连续添加
    }

    /**
     * 渲染"添加卡片"触发按钮到指定容器
     * @param {HTMLElement} container - 目标容器
     */
    function renderTrigger(container) {
        if (!container) return;

        // 注入样式（仅一次）
        if (!document.getElementById('ws-store-trigger-style')) {
            var style = document.createElement('style');
            style.id = 'ws-store-trigger-style';
            style.textContent =
                '.ws-card-store-trigger-container {' +
                '  position:absolute; bottom:80px; right:20px; z-index:100;' +
                '}' +
                '.ws-store-trigger {' +
                '  display:flex; align-items:center; justify-content:center;' +
                '  width:48px; height:48px; border-radius:14px;' +
                '  background:var(--accent, #0071e3);' +
                '  border:none; cursor:pointer; transition:all 0.2s ease;' +
                '  color:#fff; font-size:28px; line-height:1; user-select:none;' +
                '  box-shadow:0 4px 16px rgba(0,113,227,0.35);' +
                '}' +
                '.ws-store-trigger:hover {' +
                '  transform:scale(1.1);' +
                '  box-shadow:0 6px 24px rgba(0,113,227,0.45);' +
                '}' +
                '.ws-store-trigger:active {' +
                '  transform:scale(0.95);' +
                '}';
            document.head.appendChild(style);
        }

        // 创建按钮
        var btn = document.createElement('div');
        btn.className = 'ws-store-trigger';
        btn.setAttribute('data-action', 'card-store-open');
        btn.setAttribute('title', '添加卡片');
        btn.textContent = '+';
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            open();
        });
        container.appendChild(btn);
    }

    return {
        open,
        close,
        isOpen,
        renderTrigger
    };
})();

// ── Bus Integration ──────────────────────────────────────
// 监听 ws:store:open 事件
(function initCardStoreBus() {
    if (typeof Bus !== 'undefined') {
        Bus.on('ws:store:open', () => CardStore.open());
    }
})();
