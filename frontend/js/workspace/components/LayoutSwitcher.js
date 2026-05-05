/**
 * LayoutSwitcher — 布局切换器组件
 *
 * 职责:
 * 1. 渲染布局切换按钮（网格/列表/瀑布流/画布）
 * 2. 高亮当前布局
 * 3. 切换布局时通知 CardManager
 *
 * 依赖: CardManager, StateManager, Bus, Logger (全局)
 */
const LayoutSwitcher = (() => {
    'use strict';

    const LAYOUTS = [
        { id: 'grid',    label: '网格',   icon: 'grid' },
        { id: 'list',    label: '列表',   icon: 'list' },
        { id: 'masonry', label: '瀑布流', icon: 'masonry' },
        { id: 'canvas',  label: '画布',   icon: 'canvas' }
    ];

    const ICONS = {
        grid: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/>
            <rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/>
        </svg>`,
        list: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="14" height="3" rx="1"/><rect x="1" y="6.5" width="14" height="3" rx="1"/>
            <rect x="1" y="12" width="14" height="3" rx="1"/>
        </svg>`,
        masonry: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="6" height="8" rx="1"/><rect x="9" y="1" width="6" height="5" rx="1"/>
            <rect x="9" y="8" width="6" height="7" rx="1"/><rect x="1" y="11" width="6" height="4" rx="1"/>
        </svg>`,
        canvas: `<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="1" y="1" width="5" height="5" rx="0.5"/><rect x="7" y="3" width="4" height="4" rx="0.5"/>
            <rect x="3" y="8" width="6" height="4" rx="0.5"/><rect x="11" y="9" width="4" height="5" rx="0.5"/>
        </svg>`
    };

    let _currentLayout = 'grid';
    let _el = null;

    /**
     * 渲染布局切换器
     */
    function render(currentLayout) {
        _currentLayout = currentLayout || 'grid';

        return `
        <div class="ws-layout-switcher" id="wsLayoutSwitcher">
            ${LAYOUTS.map(l => `
                <button class="ws-layout-switcher__btn ${l.id === _currentLayout ? 'ws-layout-switcher__btn--active' : ''}"
                        data-action="switch-layout" data-layout="${l.id}"
                        title="${l.label}">
                    ${ICONS[l.id]}
                </button>
            `).join('')}
            <div style="width:1px; height:20px; background:var(--border); margin:0 4px;"></div>
            <button class="ws-layout-switcher__btn" data-action="reset-layout" title="一键重排">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                    <path d="M3 3v5h5"/>
                </svg>
            </button>
        </div>`;
    }

    /**
     * 更新激活状态
     */
    function setActive(layout) {
        _currentLayout = layout;
        if (!_el) _el = document.getElementById('wsLayoutSwitcher');
        if (!_el) return;

        _el.querySelectorAll('.ws-layout-switcher__btn[data-layout]').forEach(btn => {
            btn.classList.toggle('ws-layout-switcher__btn--active', btn.dataset.layout === layout);
        });
    }

    return {
        render,
        setActive,
        LAYOUTS
    };
})();