/**
 * DesktopTabs — 桌面标签组件
 *
 * 职责:
 * 1. 渲染桌面标签栏（底部 Dock 风格）
 * 2. 标签点击切换桌面
 * 3. 右键菜单（重命名/删除）
 * 4. 添加桌面按钮
 * 5. 指示点（桌面数量多时显示）
 *
 * 依赖: DesktopManager, StateManager, Bus, Logger (全局)
 */
const DesktopTabs = (() => {
    'use strict';

    // ── Internal State ────────────────────────────────────
    let _el = null;
    let _contextMenu = null;
    let _initialized = false;

    // ── Render ────────────────────────────────────────────

    /**
     * 渲染标签栏
     */
    function render() {
        const desktops = DesktopManager.getAllDesktops();
        const activeId = DesktopManager.getActiveDesktop().id;

        const tabsHtml = desktops.map(d => `
            <button class="ws-tabs__item ${d.id === activeId ? 'ws-tabs__item--active' : ''}"
                    data-action="switch-desktop" data-desktop-id="${d.id}"
                    data-context="desktop-tab" data-desktop-id="${d.id}">
                ${d.name}
            </button>
        `).join('');

        const dotsHtml = desktops.length > 5 ? desktops.map(d => `
            <span class="ws-tabs__dot ${d.id === activeId ? 'ws-tabs__dot--active' : ''}"></span>
        `).join('') : '';

        return `
        <div class="ws-tabs" id="wsDesktopTabs">
            ${tabsHtml}
            <button class="ws-tabs__add" data-action="add-desktop" title="添加桌面">+</button>
            ${dotsHtml ? `<div class="ws-tabs__dots">${dotsHtml}</div>` : ''}
        </div>`;
    }

    /**
     * 更新标签栏（局部刷新）
     */
    function update() {
        if (!_el) {
            _el = document.getElementById('wsDesktopTabs');
        }
        if (!_el) return;

        // 临时替换
        const temp = document.createElement('div');
        temp.innerHTML = render();
        const newTabs = temp.firstElementChild;
        if (newTabs) {
            _el.replaceWith(newTabs);
            _el = newTabs;
            _bindContextMenu();
        }
    }

    /**
     * 更新活跃标签高亮
     */
    function setActive(desktopId) {
        if (!_el) _el = document.getElementById('wsDesktopTabs');
        if (!_el) return;

        _el.querySelectorAll('.ws-tabs__item').forEach(btn => {
            btn.classList.toggle('ws-tabs__item--active', btn.dataset.desktopId === desktopId);
        });

        _el.querySelectorAll('.ws-tabs__dot').forEach((dot, idx) => {
            const desktops = DesktopManager.getAllDesktops();
            dot.classList.toggle('ws-tabs__dot--active', desktops[idx] && desktops[idx].id === desktopId);
        });
    }

    // ── Context Menu ──────────────────────────────────────

    function _bindContextMenu() {
        if (!_el) return;

        _el.addEventListener('contextmenu', _onContextMenu);
    }

    function _onContextMenu(e) {
        const tab = e.target.closest('[data-context="desktop-tab"]');
        if (!tab) return;

        e.preventDefault();
        const desktopId = tab.dataset.desktopId;
        _showContextMenu(e.clientX, e.clientY, desktopId);
    }

    function _showContextMenu(x, y, desktopId) {
        _hideContextMenu();

        const desktop = DesktopManager.getDesktop(desktopId);
        const canDelete = DesktopManager.getCount() > 1;

        _contextMenu = document.createElement('div');
        _contextMenu.className = 'ws-context-menu';
        _contextMenu.style.cssText = `position:fixed; left:${x}px; top:${y}px; z-index:500; background:var(--surface); border:1px solid var(--border); border-radius:var(--radius-sm); box-shadow:var(--shadow-lg); padding:4px 0; min-width:140px;`;
        _contextMenu.innerHTML = `
            <button class="ws-context-menu__item" data-action="rename-desktop" data-desktop-id="${desktopId}">
                重命名「${desktop?.name || '桌面'}」
            </button>
            <button class="ws-context-menu__item ${canDelete ? '' : 'ws-context-menu__item--disabled'}" 
                    data-action="delete-desktop" data-desktop-id="${desktopId}"
                    ${canDelete ? '' : 'disabled'}>
                删除桌面
            </button>
        `;

        document.body.appendChild(_contextMenu);

        // 点击其他区域关闭
        setTimeout(() => {
            document.addEventListener('click', _hideContextMenu, { once: true });
        }, 0);
    }

    function _hideContextMenu() {
        if (_contextMenu && _contextMenu.parentNode) {
            _contextMenu.parentNode.removeChild(_contextMenu);
        }
        _contextMenu = null;
    }

    // ── Init / Destroy ────────────────────────────────────

    function init() {
        if (_initialized) return;
        _bindContextMenu();
        _initialized = true;
        Logger.info('[DesktopTabs] Initialized');
    }

    function destroy() {
        _hideContextMenu();
        if (_el) {
            _el.removeEventListener('contextmenu', _onContextMenu);
        }
        _el = null;
        _initialized = false;
    }

    return {
        render,
        update,
        setActive,
        init,
        destroy
    };
})();

// ── Context Menu Global Styles (injected once) ───────────
(function injectContextMenuStyles() {
    if (document.getElementById('ws-context-menu-styles')) return;
    const style = document.createElement('style');
    style.id = 'ws-context-menu-styles';
    style.textContent = `
        .ws-context-menu__item {
            display: block;
            width: 100%;
            padding: 8px 14px;
            border: none;
            background: transparent;
            text-align: left;
            font-size: 13px;
            color: var(--text-primary);
            cursor: pointer;
            white-space: nowrap;
        }
        .ws-context-menu__item:hover {
            background: var(--accent-light);
            color: var(--accent);
        }
        .ws-context-menu__item--disabled {
            color: var(--text-tertiary);
            cursor: not-allowed;
        }
        .ws-context-menu__item--disabled:hover {
            background: transparent;
            color: var(--text-tertiary);
        }
    `;
    document.head.appendChild(style);
})();
