/**
 * ContextMenuManager - 右键菜单管理器
 * Hermes Workspace V2
 * 负责卡片和桌面的右键上下文菜单
 */
var ContextMenuManager = (() => {

    /* ============================
     * 常量与状态
     * ============================ */
    var MENU_Z_INDEX = 10000;          // 菜单层级
    var ANIM_DURATION = 150;           // 动画时长（毫秒）
    var SUBMENU_DELAY = 180;           // 子菜单展开延迟（毫秒）
    var MIN_WIDTH = 180;               // 菜单最小宽度
    var ITEM_HEIGHT = 34;              // 菜单项预估高度（用于键盘导航计算）

    var _container = null;             // 挂载容器
    var _menuEl = null;                // 当前菜单 DOM
    var _submenuEl = null;             // 当前子菜单 DOM
    var _visible = false;              // 菜单是否可见
    var _context = null;               // 当前菜单上下文数据
    var _activeIndex = -1;             // 键盘导航当前选中索引
    var _items = [];                   // 当前菜单项数据
    var _submenuTimer = null;          // 子菜单延迟定时器
    var _boundHandlers = {};           // 绑定的事件处理器（用于销毁时解绑）
    var _copiedCardId = null;          // 被复制的卡片 ID（粘贴功能用）

    /* ============================
     * 样式注入
     * ============================ */
    function _injectStyles() {
        if (document.getElementById('ctx-menu-styles')) {
            return; // 已存在，不重复注入
        }

        var style = document.createElement('style');
        style.id = 'ctx-menu-styles';
        style.textContent = [
            /* 菜单容器 */
            '.ctx-menu {',
            '  position: fixed;',
            '  z-index: ' + MENU_Z_INDEX + ';',
            '  min-width: ' + MIN_WIDTH + 'px;',
            '  background: #1e1e2e;',
            '  border: 1px solid rgba(255, 255, 255, 0.08);',
            '  border-radius: 8px;',
            '  padding: 4px 0;',
            '  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);',
            '  opacity: 0;',
            '  transform: scale(0.95);',
            '  transform-origin: top left;',
            '  transition: opacity ' + ANIM_DURATION + 'ms ease, transform ' + ANIM_DURATION + 'ms ease;',
            '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
            '  font-size: 13px;',
            '  color: #cdd6f4;',
            '  user-select: none;',
            '}',

            /* 菜单显示动画 */
            '.ctx-menu--visible {',
            '  opacity: 1;',
            '  transform: scale(1);',
            '}',

            /* 菜单项 */
            '.ctx-menu__item {',
            '  display: flex;',
            '  align-items: center;',
            '  padding: 8px 12px;',
            '  cursor: pointer;',
            '  white-space: nowrap;',
            '  position: relative;',
            '  transition: background 80ms ease;',
            '}',

            '.ctx-menu__item:hover,',
            '.ctx-menu__item--active {',
            '  background: rgba(255, 255, 255, 0.08);',
            '}',

            /* 菜单项图标 */
            '.ctx-menu__icon {',
            '  width: 20px;',
            '  text-align: center;',
            '  margin-right: 8px;',
            '  font-size: 14px;',
            '  flex-shrink: 0;',
            '}',

            /* 菜单项标签 */
            '.ctx-menu__label {',
            '  flex: 1;',
            '  overflow: hidden;',
            '  text-overflow: ellipsis;',
            '}',

            /* 快捷键文本 */
            '.ctx-menu__shortcut {',
            '  margin-left: 24px;',
            '  color: #6c7086;',
            '  font-size: 12px;',
            '  flex-shrink: 0;',
            '}',

            /* 子菜单箭头 */
            '.ctx-menu__arrow {',
            '  margin-left: 16px;',
            '  color: #6c7086;',
            '  font-size: 10px;',
            '  flex-shrink: 0;',
            '}',

            /* 危险操作（红色） */
            '.ctx-menu__item--danger {',
            '  color: #f38ba8;',
            '}',

            '.ctx-menu__item--danger:hover,',
            '.ctx-menu__item--danger.ctx-menu__item--active {',
            '  background: rgba(243, 139, 168, 0.12);',
            '}',

            /* 禁用状态 */
            '.ctx-menu__item--disabled {',
            '  color: #585b70;',
            '  cursor: default;',
            '  pointer-events: none;',
            '}',

            /* 分割线 */
            '.ctx-menu__divider {',
            '  height: 1px;',
            '  margin: 4px 8px;',
            '  background: rgba(255, 255, 255, 0.06);',
            '}',

            /* 子菜单 */
            '.ctx-menu__submenu {',
            '  position: fixed;',
            '  z-index: ' + (MENU_Z_INDEX + 1) + ';',
            '  min-width: ' + MIN_WIDTH + 'px;',
            '  background: #1e1e2e;',
            '  border: 1px solid rgba(255, 255, 255, 0.08);',
            '  border-radius: 8px;',
            '  padding: 4px 0;',
            '  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.3);',
            '  opacity: 0;',
            '  transform: scale(0.95);',
            '  transform-origin: top left;',
            '  transition: opacity ' + ANIM_DURATION + 'ms ease, transform ' + ANIM_DURATION + 'ms ease;',
            '  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;',
            '  font-size: 13px;',
            '  color: #cdd6f4;',
            '  user-select: none;',
            '}',

            '.ctx-menu__submenu--visible {',
            '  opacity: 1;',
            '  transform: scale(1);',
            '}',

            /* 子菜单组标题 */
            '.ctx-menu__group-title {',
            '  padding: 6px 12px 2px;',
            '  font-size: 11px;',
            '  color: #6c7086;',
            '  text-transform: uppercase;',
            '  letter-spacing: 0.5px;',
            '  pointer-events: none;',
            '}'
        ].join('\n');

        document.head.appendChild(style);
    }

    /* ============================
     * 视口边界检测与位置修正
     * ============================ */

    /**
     * 修正菜单位置，确保不超出视口
     * @param {HTMLElement} el - 菜单 DOM 元素
     * @param {number} x - 目标 X 坐标
     * @param {number} y - 目标 Y 坐标
     * @returns {{ x: number, y: number, flipX: boolean, flipY: boolean }}
     */
    function _adjustPosition(el, x, y) {
        var rect = el.getBoundingClientRect();
        var vw = window.innerWidth;
        var vh = window.innerHeight;
        var gap = 4; // 与视口边缘的最小间距
        var flipX = false;
        var flipY = false;

        // 右侧溢出 → 向左翻转
        if (x + rect.width + gap > vw) {
            x = Math.max(gap, x - rect.width);
            flipX = true;
        }

        // 底部溢出 → 向上翻转
        if (y + rect.height + gap > vh) {
            y = Math.max(gap, y - rect.height);
            flipY = true;
        }

        // 确保不超出左/上边界
        x = Math.max(gap, x);
        y = Math.max(gap, y);

        return { x: x, y: y, flipX: flipX, flipY: flipY };
    }

    /* ============================
     * DOM 构建
     * ============================ */

    /**
     * 创建菜单容器 DOM
     * @param {string} className - CSS 类名
     * @returns {HTMLElement}
     */
    function _createMenuContainer(className) {
        var menu = document.createElement('div');
        menu.className = className;
        return menu;
    }

    /**
     * 创建单个菜单项 DOM
     * @param {Object} item - 菜单项配置
     * @param {number} index - 在列表中的索引
     * @returns {HTMLElement|null} 分割线返回 null
     */
    function _createMenuItem(item, index) {
        // 分割线
        if (item.divider) {
            var divider = document.createElement('div');
            divider.className = 'ctx-menu__divider';
            divider.setAttribute('data-index', String(index));
            return divider;
        }

        var el = document.createElement('div');
        var classes = ['ctx-menu__item'];

        if (item.danger) {
            classes.push('ctx-menu__item--danger');
        }
        if (item.disabled) {
            classes.push('ctx-menu__item--disabled');
        }

        el.className = classes.join(' ');
        el.setAttribute('data-index', String(index));
        el.setAttribute('role', 'menuitem');

        // 图标
        if (item.icon) {
            var iconSpan = document.createElement('span');
            iconSpan.className = 'ctx-menu__icon';
            iconSpan.textContent = item.icon;
            el.appendChild(iconSpan);
        }

        // 标签
        var labelSpan = document.createElement('span');
        labelSpan.className = 'ctx-menu__label';
        labelSpan.textContent = item.label || '';
        el.appendChild(labelSpan);

        // 快捷键
        if (item.shortcut) {
            var shortcutSpan = document.createElement('span');
            shortcutSpan.className = 'ctx-menu__shortcut';
            shortcutSpan.textContent = item.shortcut;
            el.appendChild(shortcutSpan);
        }

        // 子菜单箭头
        if (item.submenu) {
            var arrowSpan = document.createElement('span');
            arrowSpan.className = 'ctx-menu__arrow';
            arrowSpan.textContent = '\u25B6'; // ▶
            el.appendChild(arrowSpan);
        }

        return el;
    }

    /**
     * 渲染菜单项列表到容器
     * @param {HTMLElement} container - 菜单容器
     * @param {Array} items - 菜单项数据
     */
    function _renderItems(container, items) {
        // 清空容器
        container.innerHTML = '';

        for (var i = 0; i < items.length; i++) {
            var itemEl = _createMenuItem(items[i], i);
            if (itemEl) {
                container.appendChild(itemEl);
            }
        }
    }

    /* ============================
     * 菜单项构建 - 卡片右键菜单
     * ============================ */

    /**
     * 构建卡片右键菜单项
     * @param {Object} ctx - 上下文 { cardId, cardEl, desktopId, state }
     * @returns {Array}
     */
    function _buildCardMenuItems(ctx) {
        var items = [];
        var state = ctx.state || {};
        var isPinned = !!state.pinned;
        var isCollapsed = !!state.collapsed;

        // 1. 展开
        items.push({
            icon: '\uD83D\uDD0D',  // 🔍
            label: '\u5C55\u5F00',  // 展开
            shortcut: 'Click',
            action: function () {
                if (typeof CardOverlay !== 'undefined' && CardOverlay.open) {
                    CardOverlay.open(ctx.cardId);
                }
            }
        });

        // 2. 刷新
        items.push({
            icon: '\uD83D\uDD04',  // 🔄
            label: '\u5237\u65B0',  // 刷新
            shortcut: 'R',
            action: function () {
                Bus.emit('ws:card:refresh', {
                    cardId: ctx.cardId,
                    desktopId: ctx.desktopId
                });
            }
        });

        // 3. 分割线
        items.push({ divider: true });

        // 4. 置顶
        items.push({
            icon: '\uD83D\uDCCC',  // 📌
            label: isPinned ? '\u53D6\u6D88\u7F6E\u9876' : '\u7F6E\u9876',  // 取消置顶 / 置顶
            action: function () {
                if (typeof ZIndexManager !== 'undefined' && ZIndexManager.bringToTop) {
                    ZIndexManager.bringToTop(ctx.cardEl);
                }
                // 保存置顶状态
                if (typeof StateManager !== 'undefined' && StateManager.updateCard) {
                    StateManager.updateCard(ctx.cardId, { pinned: !isPinned });
                }
            }
        });

        // 5. 固定位置
        items.push({
            icon: '\uD83D\uDCCF',  // 📏
            label: isPinned ? '\u53D6\u6D88\u56FA\u5B9A' : '\u56FA\u5B9A\u4F4D\u7F6E',  // 取消固定 / 固定位置
            action: function () {
                if (typeof StateManager !== 'undefined' && StateManager.updateCard) {
                    StateManager.updateCard(ctx.cardId, { pinned: !isPinned });
                }
            }
        });

        // 6. 分割线
        items.push({ divider: true });

        // 7. 折叠
        items.push({
            icon: '\uD83D\uDCE6',  // 📦
            label: isCollapsed ? '\u5C55\u5F00\u5361\u7247' : '\u6298\u53E0',  // 展开卡片 / 折叠
            action: function () {
                Bus.emit('ws:card:collapse', {
                    cardId: ctx.cardId,
                    desktopId: ctx.desktopId
                });
            }
        });

        // 8. 移动到...（子菜单，仅当有多个桌面时显示）
        var desktops = _getDesktopList();
        if (desktops.length > 1) {
            var submenuItems = [];
            for (var d = 0; d < desktops.length; d++) {
                (function (desktop) {
                    submenuItems.push({
                        icon: desktop.icon || '\uD83D\uDDBE',  // 🖾
                        label: desktop.name || ('\u684C\u9762 ' + (d + 1)),  // 桌面 N
                        disabled: desktop.id === ctx.desktopId,
                        action: function () {
                            Bus.emit('ws:card:move', {
                                cardId: ctx.cardId,
                                fromDesktopId: ctx.desktopId,
                                toDesktopId: desktop.id
                            });
                        }
                    });
                })(desktops[d]);
            }

            items.push({
                icon: '\uD83D\uDCC2',  // 📂
                label: '\u79FB\u52A8\u5230...',  // 移动到...
                submenu: submenuItems
            });
        }

        // 9. 分割线
        items.push({ divider: true });

        // 10. 删除
        items.push({
            icon: '\uD83D\uDDD1\uFE0F',  // 🗑️
            label: '\u5220\u9664',  // 删除
            shortcut: 'Del',
            danger: true,
            action: function () {
                if (typeof CardManager !== 'undefined' && CardManager.deleteCard) {
                    CardManager.deleteCard(ctx.desktopId, ctx.cardId);
                }
            }
        });

        return items;
    }

    /* ============================
     * 菜单项构建 - 桌面背景右键菜单
     * ============================ */

    /**
     * 构建桌面背景右键菜单项
     * @param {Object} ctx - 上下文 { desktopId, event }
     * @returns {Array}
     */
    function _buildDesktopMenuItems(ctx) {
        var items = [];

        // 1. 添加卡片
        items.push({
            icon: '\u2795',  // ➕
            label: '\u6DFB\u52A0\u5361\u7247',  // 添加卡片
            action: function () {
                Bus.emit('ws:card:store:open', { desktopId: ctx.desktopId });
            }
        });

        // 2. 粘贴卡片（仅当有已复制的卡片时可用）
        items.push({
            icon: '\uD83D\uDCCB',  // 📋
            label: '\u7C98\u8D34\u5361\u7247',  // 粘贴卡片
            disabled: !_copiedCardId,
            action: function () {
                if (_copiedCardId) {
                    Bus.emit('ws:card:paste', {
                        cardId: _copiedCardId,
                        desktopId: ctx.desktopId
                    });
                }
            }
        });

        // 3. 分割线
        items.push({ divider: true });

        // 4. 切换布局（子菜单）
        items.push({
            icon: '\uD83D\uDCD0',  // 📐
            label: '\u5207\u6362\u5E03\u5C40',  // 切换布局
            submenu: [
                {
                    icon: '\u2588',  // █
                    label: '\u7F51\u683C',  // 网格
                    action: function () {
                        Bus.emit('ws:layout:change', { desktopId: ctx.desktopId, layout: 'grid' });
                    }
                },
                {
                    icon: '\u2630',  // ☰
                    label: '\u5217\u8868',  // 列表
                    action: function () {
                        Bus.emit('ws:layout:change', { desktopId: ctx.desktopId, layout: 'list' });
                    }
                },
                {
                    icon: '\u2261',  // ≡
                    label: '\u7011\u5E03\u6D41',  // 瀑布流
                    action: function () {
                        Bus.emit('ws:layout:change', { desktopId: ctx.desktopId, layout: 'masonry' });
                    }
                },
                {
                    icon: '\u25A1',  // □
                    label: '\u753B\u5E03',  // 画布
                    action: function () {
                        Bus.emit('ws:layout:change', { desktopId: ctx.desktopId, layout: 'canvas' });
                    }
                }
            ]
        });

        // 5. 重排所有卡片
        items.push({
            icon: '\uD83D\uDD00',  // 🔀
            label: '\u91CD\u6392\u6240\u6709\u5361\u7247',  // 重排所有卡片
            action: function () {
                if (typeof LayoutEngine !== 'undefined' && LayoutEngine.clearPinned) {
                    LayoutEngine.clearPinned();
                }
                Bus.emit('ws:layout:reflow', { desktopId: ctx.desktopId });
            }
        });

        // 6. 分割线
        items.push({ divider: true });

        // 7. 桌面设置
        items.push({
            icon: '\u2699\uFE0F',  // ⚙️
            label: '\u684C\u9762\u8BBE\u7F6E',  // 桌面设置
            action: function () {
                Bus.emit('ws:desktop:settings', { desktopId: ctx.desktopId });
            }
        });

        return items;
    }

    /* ============================
     * 辅助函数
     * ============================ */

    /**
     * 获取桌面列表
     * @returns {Array}
     */
    function _getDesktopList() {
        if (typeof StateManager !== 'undefined' && StateManager.getDesktops) {
            return StateManager.getDesktops() || [];
        }
        return [];
    }

    /**
     * 获取卡片状态
     * @param {string} cardId
     * @returns {Object|null}
     */
    function _getCardState(cardId) {
        if (typeof StateManager !== 'undefined' && StateManager.getCard) {
            return StateManager.getCard(cardId);
        }
        return null;
    }

    /**
     * 判断点击目标是否为卡片元素
     * @param {HTMLElement} target
     * @returns {Object|null} { cardId, cardEl, desktopId }
     */
    function _findCardFromTarget(target) {
        var el = target;
        var maxDepth = 10; // 最多向上查找 10 层

        while (el && maxDepth > 0) {
            if (el.getAttribute && el.getAttribute('data-card-id')) {
                return {
                    cardId: el.getAttribute('data-card-id'),
                    cardEl: el,
                    desktopId: el.getAttribute('data-desktop-id') || ''
                };
            }
            el = el.parentElement;
            maxDepth--;
        }

        return null;
    }

    /**
     * 判断点击目标是否为桌面背景区域
     * @param {HTMLElement} target
     * @returns {boolean}
     */
    function _isDesktopBackground(target) {
        // 桌面背景通常有 data-desktop-id 但不是卡片
        var el = target;
        var maxDepth = 10;

        while (el && maxDepth > 0) {
            if (el.getAttribute && el.getAttribute('data-desktop-id') && !el.getAttribute('data-card-id')) {
                return true;
            }
            el = el.parentElement;
            maxDepth--;
        }

        return false;
    }

    /**
     * 获取可操作的菜单项（排除分割线和禁用项）
     * @returns {Array}
     */
    function _getActionableItems() {
        var result = [];
        for (var i = 0; i < _items.length; i++) {
            var item = _items[i];
            if (!item.divider && !item.disabled) {
                result.push({ index: i, item: item });
            }
        }
        return result;
    }

    /* ============================
     * 菜单显示与隐藏
     * ============================ */

    /**
     * 显示菜单
     * @param {number} x - 鼠标 X 坐标
     * @param {number} y - 鼠标 Y 坐标
     * @param {Array} items - 菜单项数据
     * @param {Object} context - 上下文数据
     */
    function show(x, y, items, context) {
        // 先隐藏已有菜单
        hide();

        _items = items || [];
        _context = context || {};
        _activeIndex = -1;

        // 创建菜单 DOM
        _menuEl = _createMenuContainer('ctx-menu');
        _renderItems(_menuEl, _items);
        document.body.appendChild(_menuEl);

        // 先设为可见以测量尺寸，但透明
        _menuEl.style.left = '-9999px';
        _menuEl.style.top = '-9999px';
        _menuEl.style.display = 'block';

        // 计算修正后的位置
        var pos = _adjustPosition(_menuEl, x, y);
        _menuEl.style.left = pos.x + 'px';
        _menuEl.style.top = pos.y + 'px';

        // 设置 transform-origin 根据翻转方向调整
        if (pos.flipX && pos.flipY) {
            _menuEl.style.transformOrigin = 'bottom right';
        } else if (pos.flipX) {
            _menuEl.style.transformOrigin = 'top right';
        } else if (pos.flipY) {
            _menuEl.style.transformOrigin = 'bottom left';
        }

        // 触发动画
        requestAnimationFrame(function () {
            if (_menuEl) {
                _menuEl.classList.add('ctx-menu--visible');
            }
        });

        _visible = true;

        // 绑定菜单项事件
        _bindItemEvents(_menuEl, _items);
    }

    /**
     * 隐藏菜单
     */
    function hide() {
        // 隐藏子菜单
        _hideSubmenu();

        if (_menuEl) {
            _menuEl.classList.remove('ctx-menu--visible');

            // 等待动画结束后移除 DOM
            var menuRef = _menuEl;
            setTimeout(function () {
                if (menuRef && menuRef.parentNode) {
                    menuRef.parentNode.removeChild(menuRef);
                }
            }, ANIM_DURATION + 20);

            _menuEl = null;
        }

        _visible = false;
        _items = [];
        _context = null;
        _activeIndex = -1;
    }

    /**
     * 菜单是否可见
     * @returns {boolean}
     */
    function isVisible() {
        return _visible;
    }

    /* ============================
     * 子菜单管理
     * ============================ */

    /**
     * 显示子菜单
     * @param {HTMLElement} parentItemEl - 父菜单项 DOM
     * @param {Array} submenuItems - 子菜单项数据
     */
    function _showSubmenu(parentItemEl, submenuItems) {
        _hideSubmenu();

        var parentRect = parentItemEl.getBoundingClientRect();

        _submenuEl = _createMenuContainer('ctx-menu__submenu');
        _renderItems(_submenuEl, submenuItems);
        document.body.appendChild(_submenuEl);

        // 先定位到屏幕外以测量
        _submenuEl.style.left = '-9999px';
        _submenuEl.style.top = '-9999px';
        _submenuEl.style.display = 'block';

        // 默认在父项右侧展开
        var subX = parentRect.right;
        var subY = parentRect.top;

        // 如果右侧空间不足，尝试左侧
        if (subX + _submenuEl.offsetWidth + 4 > window.innerWidth) {
            subX = parentRect.left - _submenuEl.offsetWidth;
        }

        // 如果左侧也不够，则紧贴右边缘
        if (subX < 4) {
            subX = window.innerWidth - _submenuEl.offsetWidth - 4;
        }

        // 底部溢出修正
        if (subY + _submenuEl.offsetHeight + 4 > window.innerHeight) {
            subY = window.innerHeight - _submenuEl.offsetHeight - 4;
        }

        _submenuEl.style.left = subX + 'px';
        _submenuEl.style.top = subY + 'px';

        // 触发动画
        requestAnimationFrame(function () {
            if (_submenuEl) {
                _submenuEl.classList.add('ctx-menu__submenu--visible');
            }
        });

        // 绑定子菜单项事件
        _bindItemEvents(_submenuEl, submenuItems);
    }

    /**
     * 隐藏子菜单
     */
    function _hideSubmenu() {
        if (_submenuTimer) {
            clearTimeout(_submenuTimer);
            _submenuTimer = null;
        }

        if (_submenuEl) {
            _submenuEl.classList.remove('ctx-menu__submenu--visible');

            var subRef = _submenuEl;
            setTimeout(function () {
                if (subRef && subRef.parentNode) {
                    subRef.parentNode.removeChild(subRef);
                }
            }, ANIM_DURATION + 20);

            _submenuEl = null;
        }
    }

    /* ============================
     * 事件绑定
     * ============================ */

    /**
     * 绑定菜单项的点击和悬停事件
     * @param {HTMLElement} container - 菜单容器
     * @param {Array} items - 菜单项数据
     */
    function _bindItemEvents(container, items) {
        var itemEls = container.querySelectorAll('.ctx-menu__item');

        for (var i = 0; i < itemEls.length; i++) {
            (function (el, idx) {
                var item = items[idx];
                if (!item || item.divider || item.disabled) {
                    return;
                }

                // 点击执行动作
                el.addEventListener('click', function (e) {
                    e.stopPropagation();
                    e.preventDefault();

                    if (item.action) {
                        item.action();
                    }

                    hide();
                });

                // 悬停高亮 + 子菜单展开
                el.addEventListener('mouseenter', function () {
                    _clearActiveItems(container);
                    el.classList.add('ctx-menu__item--active');

                    // 如果有子菜单，延迟展开
                    if (item.submenu) {
                        if (_submenuTimer) {
                            clearTimeout(_submenuTimer);
                        }
                        _submenuTimer = setTimeout(function () {
                            _showSubmenu(el, item.submenu);
                        }, SUBMENU_DELAY);
                    } else {
                        // 没有子菜单则关闭已有子菜单
                        _hideSubmenu();
                    }
                });

                el.addEventListener('mouseleave', function () {
                    el.classList.remove('ctx-menu__item--active');

                    // 鼠标离开时取消子菜单展开
                    if (item.submenu && _submenuTimer) {
                        clearTimeout(_submenuTimer);
                        _submenuTimer = null;
                    }
                });
            })(itemEls[i], parseInt(itemEls[i].getAttribute('data-index'), 10));
        }
    }

    /**
     * 清除菜单容器中所有项的激活状态
     * @param {HTMLElement} container
     */
    function _clearActiveItems(container) {
        var activeEls = container.querySelectorAll('.ctx-menu__item--active');
        for (var i = 0; i < activeEls.length; i++) {
            activeEls[i].classList.remove('ctx-menu__item--active');
        }
    }

    /**
     * 绑定全局事件（点击外部关闭、Esc 关闭、滚动关闭）
     */
    function _bindGlobalEvents() {
        // 点击外部关闭菜单
        _boundHandlers.documentClick = function (e) {
            if (!_visible) {
                return;
            }

            // 检查点击是否在菜单内部
            if (_menuEl && _menuEl.contains(e.target)) {
                return;
            }
            if (_submenuEl && _submenuEl.contains(e.target)) {
                return;
            }

            hide();
        };
        document.addEventListener('mousedown', _boundHandlers.documentClick, true);

        // Esc 键关闭
        _boundHandlers.keydown = function (e) {
            if (!_visible) {
                return;
            }

            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    if (_submenuEl) {
                        _hideSubmenu();
                    } else {
                        hide();
                    }
                    break;

                case 'ArrowDown':
                    e.preventDefault();
                    _navigateMenu(1);
                    break;

                case 'ArrowUp':
                    e.preventDefault();
                    _navigateMenu(-1);
                    break;

                case 'ArrowRight':
                    e.preventDefault();
                    _openActiveSubmenu();
                    break;

                case 'ArrowLeft':
                    e.preventDefault();
                    if (_submenuEl) {
                        _hideSubmenu();
                    }
                    break;

                case 'Enter':
                    e.preventDefault();
                    _activateCurrentItem();
                    break;
            }
        };
        document.addEventListener('keydown', _boundHandlers.keydown, true);

        // 滚动关闭
        _boundHandlers.scroll = function () {
            if (_visible) {
                hide();
            }
        };
        window.addEventListener('scroll', _boundHandlers.scroll, true);
        window.addEventListener('wheel', _boundHandlers.scroll, true);

        // 新的 contextmenu 事件关闭旧菜单
        _boundHandlers.contextmenu = function () {
            if (_visible) {
                hide();
            }
        };
        document.addEventListener('contextmenu', _boundHandlers.contextmenu, true);
    }

    /**
     * 解绑全局事件
     */
    function _unbindGlobalEvents() {
        if (_boundHandlers.documentClick) {
            document.removeEventListener('mousedown', _boundHandlers.documentClick, true);
        }
        if (_boundHandlers.keydown) {
            document.removeEventListener('keydown', _boundHandlers.keydown, true);
        }
        if (_boundHandlers.scroll) {
            window.removeEventListener('scroll', _boundHandlers.scroll, true);
            window.removeEventListener('wheel', _boundHandlers.scroll, true);
        }
        if (_boundHandlers.contextmenu) {
            document.removeEventListener('contextmenu', _boundHandlers.contextmenu, true);
        }
        _boundHandlers = {};
    }

    /* ============================
     * 键盘导航
     * ============================ */

    /**
     * 上下箭头导航菜单
     * @param {number} direction - 1 向下, -1 向上
     */
    function _navigateMenu(direction) {
        var actionable = _getActionableItems();
        if (actionable.length === 0) {
            return;
        }

        // 清除所有高亮
        if (_menuEl) {
            _clearActiveItems(_menuEl);
        }

        // 计算新索引
        var currentPos = -1;
        for (var i = 0; i < actionable.length; i++) {
            if (actionable[i].index === _activeIndex) {
                currentPos = i;
                break;
            }
        }

        var newPos = currentPos + direction;
        if (newPos < 0) {
            newPos = actionable.length - 1; // 循环到底部
        } else if (newPos >= actionable.length) {
            newPos = 0; // 循环到顶部
        }

        _activeIndex = actionable[newPos].index;

        // 高亮当前项
        if (_menuEl) {
            var targetEl = _menuEl.querySelector('[data-index="' + _activeIndex + '"]');
            if (targetEl) {
                targetEl.classList.add('ctx-menu__item--active');

                // 确保可见（如果菜单项超出视口则滚动）
                targetEl.scrollIntoView({ block: 'nearest' });
            }
        }
    }

    /**
     * 打开当前激活项的子菜单
     */
    function _openActiveSubmenu() {
        if (!_menuEl || _activeIndex < 0) {
            return;
        }

        var item = _items[_activeIndex];
        if (!item || !item.submenu) {
            return;
        }

        var targetEl = _menuEl.querySelector('[data-index="' + _activeIndex + '"]');
        if (targetEl) {
            _showSubmenu(targetEl, item.submenu);
        }
    }

    /**
     * 激活当前选中项（执行动作）
     */
    function _activateCurrentItem() {
        if (!_menuEl || _activeIndex < 0) {
            return;
        }

        var item = _items[_activeIndex];
        if (!item || item.divider || item.disabled) {
            return;
        }

        if (item.action) {
            item.action();
        }

        hide();
    }

    /* ============================
     * 容器事件处理
     * ============================ */

    /**
     * 处理容器内的 contextmenu 事件
     * @param {MouseEvent} e
     */
    function _handleContextMenu(e) {
        e.preventDefault();
        e.stopPropagation();

        var target = e.target;
        var mouseX = e.clientX;
        var mouseY = e.clientY;

        // 尝试识别为卡片
        var cardInfo = _findCardFromTarget(target);
        if (cardInfo) {
            var cardState = _getCardState(cardInfo.cardId);
            var cardItems = _buildCardMenuItems({
                cardId: cardInfo.cardId,
                cardEl: cardInfo.cardEl,
                desktopId: cardInfo.desktopId,
                state: cardState
            });
            show(mouseX, mouseY, cardItems, {
                type: 'card',
                cardId: cardInfo.cardId,
                cardEl: cardInfo.cardEl,
                desktopId: cardInfo.desktopId
            });
            return;
        }

        // 尝试识别为桌面背景
        var desktopEl = target;
        var maxDepth = 10;
        var desktopId = '';

        while (desktopEl && maxDepth > 0) {
            if (desktopEl.getAttribute && desktopEl.getAttribute('data-desktop-id')) {
                desktopId = desktopEl.getAttribute('data-desktop-id');
                break;
            }
            desktopEl = desktopEl.parentElement;
            maxDepth--;
        }

        if (desktopId) {
            var desktopItems = _buildDesktopMenuItems({
                desktopId: desktopId,
                event: e
            });
            show(mouseX, mouseY, desktopItems, {
                type: 'desktop',
                desktopId: desktopId
            });
            return;
        }
    }

    /* ============================
     * 公共 API - 初始化与销毁
     * ============================ */

    /**
     * 初始化上下文菜单管理器
     * @param {HTMLElement} container - 工作区容器 DOM
     */
    function init(container) {
        if (!container) {
            console.warn('[ContextMenuManager] \u521D\u59CB\u5316\u5931\u8D25\uFF1A\u7F3A\u5C11\u5BB9\u5668\u5143\u7D20');
            return;
        }

        _container = container;

        // 注入样式
        _injectStyles();

        // 绑定容器右键事件
        _boundHandlers.containerContextmenu = function (e) {
            _handleContextMenu(e);
        };
        _container.addEventListener('contextmenu', _boundHandlers.containerContextmenu);

        // 绑定全局事件（点击外部关闭、键盘导航等）
        _bindGlobalEvents();

        // 监听卡片复制事件
        if (typeof Bus !== 'undefined') {
            Bus.on('ws:card:copied', function (data) {
                _copiedCardId = data.cardId || null;
            });

            Bus.on('ws:card:pasted', function () {
                _copiedCardId = null;
            });
        }

        console.log('[ContextMenuManager] \u521D\u59CB\u5316\u5B8C\u6210');
    }

    /**
     * 销毁上下文菜单管理器，清理所有事件和 DOM
     */
    function destroy() {
        // 隐藏菜单
        hide();

        // 解绑容器事件
        if (_container && _boundHandlers.containerContextmenu) {
            _container.removeEventListener('contextmenu', _boundHandlers.containerContextmenu);
        }

        // 解绑全局事件
        _unbindGlobalEvents();

        // 移除注入的样式
        var styleEl = document.getElementById('ctx-menu-styles');
        if (styleEl && styleEl.parentNode) {
            styleEl.parentNode.removeChild(styleEl);
        }

        // 重置状态
        _container = null;
        _copiedCardId = null;
        _items = [];
        _context = null;

        // 取消 Bus 监听
        if (typeof Bus !== 'undefined') {
            Bus.off('ws:card:copied');
            Bus.off('ws:card:pasted');
        }

        console.log('[ContextMenuManager] \u5DF2\u9500\u6BC1');
    }

    /* ============================
     * 导出公共接口
     * ============================ */
    return {
        init: init,
        destroy: destroy,
        show: show,
        hide: hide,
        isVisible: isVisible
    };

})();
