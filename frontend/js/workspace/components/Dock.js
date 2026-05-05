/**
 * Dock.js - 底部 Dock 栏
 * macOS 风格，点击放大对应功能卡片
 * 使用 IIFE 包裹，暴露全局变量
 */
var Dock = (() => {
    'use strict';

    // ========== 默认 Dock 项 ==========
    var DEFAULT_ITEMS = [
        { id: 'marketplace', icon: '🛒', label: '功能商店', bg: 'linear-gradient(135deg, #007aff, #5856d6)' },
        { id: 'agents',      icon: '🤖', label: 'AI 助手',  bg: 'linear-gradient(135deg, #34c759, #30d158)' },
        { id: 'ops_center',  icon: '📊', label: '运维中心', bg: 'linear-gradient(135deg, #ff9500, #ff6b00)' },
        { id: 'config',      icon: '⚙️', label: '系统配置', bg: 'linear-gradient(135deg, #8e8e93, #636366)' }
    ];

    // ========== 状态 ==========
    var _container = null;
    var _items = []; // 当前 Dock 项列表（可动态增删）
    var _stylesInjected = false;

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;

        var css = `
            /* Dock 容器 */
            .dock-wrapper {
                position: fixed;
                bottom: 12px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 7000;
            }

            .dock {
                display: flex;
                align-items: flex-end;
                gap: 6px;
                padding: 6px 10px;
                border-radius: 22px;
                background: rgba(255, 255, 255, 0.65);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12),
                            0 2px 8px rgba(0, 0, 0, 0.06);
                border: 1px solid rgba(255, 255, 255, 0.3);
            }

            /* Dock 项 */
            .dock-item {
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            .dock-item-icon {
                width: 48px;
                height: 48px;
                border-radius: 12px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 24px;
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1),
                            box-shadow 0.3s ease;
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                will-change: transform;
            }

            .dock-item:hover .dock-item-icon {
                transform: scale(1.25) translateY(-8px);
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            }

            .dock-item:active .dock-item-icon {
                transform: scale(1.15) translateY(-4px);
                transition-duration: 0.1s;
            }

            /* Dock 项 tooltip */
            .dock-item-tooltip {
                position: absolute;
                bottom: calc(100% + 8px);
                left: 50%;
                transform: translateX(-50%) translateY(4px);
                padding: 4px 10px;
                border-radius: 6px;
                background: rgba(0, 0, 0, 0.75);
                color: #fff;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s, transform 0.2s;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .dock-item:hover .dock-item-tooltip {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }

            /* Dock 分隔线 */
            .dock-separator {
                width: 1px;
                height: 36px;
                background: rgba(0, 0, 0, 0.12);
                margin: 0 4px;
                align-self: center;
                flex-shrink: 0;
            }

            /* Dock 项角标（可选） */
            .dock-item-badge {
                position: absolute;
                top: -4px;
                right: -4px;
                min-width: 18px;
                height: 18px;
                padding: 0 4px;
                border-radius: 9px;
                background: #ff3b30;
                color: #fff;
                font-size: 11px;
                font-weight: 600;
                display: flex;
                align-items: center;
                justify-content: center;
                box-shadow: 0 2px 6px rgba(255, 59, 48, 0.4);
                z-index: 1;
            }

            /* 深色模式 */
            @media (prefers-color-scheme: dark) {
                .dock {
                    background: rgba(40, 40, 40, 0.7);
                    border-color: rgba(255, 255, 255, 0.08);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3),
                                0 2px 8px rgba(0, 0, 0, 0.15);
                }

                .dock-item-icon {
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
                }

                .dock-item:hover .dock-item-icon {
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
                }

                .dock-separator {
                    background: rgba(255, 255, 255, 0.12);
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'dockStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ========== 构建 Dock 项 HTML ==========
    function _buildItemHTML(item) {
        var badgeHTML = item.badge ?
            `<span class="dock-item-badge">${item.badge > 99 ? '99+' : item.badge}</span>` : '';

        return `
            <div class="dock-item" data-dock-id="${item.id}" title="${item.label || ''}">
                <span class="dock-item-tooltip">${item.label || ''}</span>
                ${badgeHTML}
                <div class="dock-item-icon" style="background: ${item.bg || 'linear-gradient(135deg, #667eea, #764ba2)'}">
                    ${item.icon || '📦'}
                </div>
            </div>
        `;
    }

    // ========== 渲染 Dock ==========
    function render(container) {
        if (!container) {
            console.warn('[Dock] render() 缺少 container 参数');
            return;
        }

        _injectStyles();
        _container = container;

        // 初始化项列表（深拷贝默认项）
        _items = DEFAULT_ITEMS.map(item => Object.assign({}, item));

        _renderDock();
    }

    // ========== 渲染 Dock 内容 ==========
    function _renderDock() {
        if (!_container) return;

        // 构建 HTML：项之间插入分隔线
        var html = '<div class="dock">';
        for (var i = 0; i < _items.length; i++) {
            html += _buildItemHTML(_items[i]);
            // 在第 2 个和第 3 个项之间加分隔线
            if (i === 1 && _items.length > 2) {
                html += '<div class="dock-separator"></div>';
            }
        }
        html += '</div>';

        _container.innerHTML = `<div class="dock-wrapper">${html}</div>`;

        // 绑定事件
        _bindEvents();
    }

    // ========== 绑定事件 ==========
    function _bindEvents() {
        var dockItems = _container.querySelectorAll('.dock-item');
        for (var i = 0; i < dockItems.length; i++) {
            (function(el) {
                el.addEventListener('click', function() {
                    var itemId = el.getAttribute('data-dock-id');
                    if (!itemId) return;

                    // 查找对应的 item 数据
                    var itemData = null;
                    for (var j = 0; j < _items.length; j++) {
                        if (_items[j].id === itemId) {
                            itemData = _items[j];
                            break;
                        }
                    }

                    // 点击动画反馈
                    _animateClick(el);

                    // 打开 CardOverlay
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.open(itemId, itemData);
                    } else {
                        console.warn('[Dock] CardOverlay 未加载，无法打开:', itemId);
                    }
                });
            })(dockItems[i]);
        }
    }

    // ========== 点击动画反馈 ==========
    function _animateClick(el) {
        var icon = el.querySelector('.dock-item-icon');
        if (!icon) return;

        // 添加点击波纹效果
        icon.style.transform = 'scale(0.9)';
        setTimeout(() => {
            icon.style.transform = '';
        }, 150);
    }

    // ========== 动态添加 Dock 项 ==========
    function addItem(item) {
        if (!item || !item.id) {
            console.warn('[Dock] addItem() 缺少 id 参数');
            return;
        }

        // 检查是否已存在
        for (var i = 0; i < _items.length; i++) {
            if (_items[i].id === item.id) {
                console.warn('[Dock] 项已存在:', item.id);
                return;
            }
        }

        // 添加到列表
        _items.push(Object.assign({}, item));

        // 重新渲染
        _renderDock();
    }

    // ========== 移除 Dock 项 ==========
    function removeItem(id) {
        if (!id) return;

        var found = false;
        for (var i = 0; i < _items.length; i++) {
            if (_items[i].id === id) {
                _items.splice(i, 1);
                found = true;
                break;
            }
        }

        if (!found) {
            console.warn('[Dock] 项不存在:', id);
            return;
        }

        // 重新渲染
        _renderDock();
    }

    // ========== 更新 Dock 项角标 ==========
    function updateBadge(id, count) {
        for (var i = 0; i < _items.length; i++) {
            if (_items[i].id === id) {
                _items[i].badge = count;
                break;
            }
        }

        // 重新渲染
        _renderDock();
    }

    // ========== 销毁 ==========
    function destroy() {
        if (_container) {
            _container.innerHTML = '';
        }
        _container = null;
        _items = [];
    }

    // ========== 公开 API ==========
    return {
        render: render,
        addItem: addItem,
        removeItem: removeItem,
        updateBadge: updateBadge,
        destroy: destroy
    };
})();

window.Dock = Dock;
