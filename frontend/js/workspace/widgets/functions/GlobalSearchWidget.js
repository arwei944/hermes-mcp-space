/**
 * GlobalSearchWidget — 全局搜索
 *
 * 功能: 搜索输入框 + 搜索按钮，输入后按 Enter 或点击搜索触发全局搜索
 * 类型: function, category: functions, defaultSize: {w:1, h:1}
 *
 * 依赖: Router (全局), App (全局), WidgetRegistry (全局)
 */
const GlobalSearchWidget = (() => {
    'use strict';

    function mount(container, props) {
        container.innerHTML = `
            <div class="ws-widget">
                <div class="ws-widget__content" style="display:flex; align-items:center; gap:8px; padding:12px;">
                    <div style="position:relative; flex:1; display:flex; align-items:center;">
                        <span style="position:absolute; left:10px; font-size:14px; color:var(--text-tertiary); pointer-events:none;">🔍</span>
                        <input type="text" class="ws-widget__search-input"
                               placeholder="搜索知识、规则、记忆..."
                               style="width:100%; padding:8px 36px 8px 32px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); color:var(--text-primary); font-size:var(--text-sm); outline:none; transition:border-color 0.15s;"
                        />
                        <button class="ws-widget__search-btn"
                                style="position:absolute; right:4px; padding:4px 8px; border:none; border-radius:var(--radius-sm); background:var(--primary, #4f46e5); color:#fff; cursor:pointer; font-size:var(--text-xs); transition:opacity 0.15s;">
                            搜索
                        </button>
                    </div>
                </div>
            </div>`;

        const input = container.querySelector('.ws-widget__search-input');
        const btn = container.querySelector('.ws-widget__search-btn');

        // 输入框聚焦样式
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--primary, #4f46e5)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = 'var(--border)';
        });

        // 执行搜索
        const _doSearch = () => {
            const query = input.value.trim();
            if (!query) return;

            // 优先使用 App.handleGlobalSearch，其次 Router.navigate
            if (typeof App !== 'undefined' && typeof App.handleGlobalSearch === 'function') {
                App.handleGlobalSearch(query);
            } else if (typeof Router !== 'undefined') {
                Router.navigate('search', { query });
            }
        };

        // Enter 键搜索
        const _handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                _doSearch();
            }
        };
        input.addEventListener('keydown', _handleKeydown);

        // 按钮点击搜索
        btn.addEventListener('click', _doSearch);

        return {
            destroy() {
                input.removeEventListener('keydown', _handleKeydown);
                container.innerHTML = '';
            },
            refresh() {
                input.value = '';
            }
        };
    }

    WidgetRegistry.register('global-search', {
        type: 'function',
        label: '全局搜索',
        icon: '🔍',
        description: '全局搜索知识、规则、记忆等',
        defaultSize: { w: 1, h: 1 },
        category: 'functions',
        mount
    });
})();
