/**
 * QuickCreateWidget — 快捷创建
 *
 * 功能: 显示4个快捷创建按钮（创建知识/创建规则/创建记忆/创建会话）
 * 类型: function, category: functions, defaultSize: {w:1, h:1}
 *
 * 依赖: Router (全局), WidgetRegistry (全局)
 */
const QuickCreateWidget = (() => {
    'use strict';

    function mount(container, props) {
        const actions = [
            { icon: '📖', label: '知识', page: 'knowledge' },
            { icon: '📏', label: '规则', page: 'knowledge' },
            { icon: '🧠', label: '记忆', page: 'memory' },
            { icon: '💬', label: '会话', page: 'sessions' }
        ];

        container.innerHTML = `
            <div class="ws-widget">
                <div class="ws-widget__content" style="display:grid; grid-template-columns:1fr 1fr; gap:8px; padding:12px;">
                    ${actions.map(a => `
                        <button class="ws-widget__action-btn" data-page="${a.page}"
                                style="display:flex; flex-direction:column; align-items:center; gap:4px; padding:12px 8px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); cursor:pointer; transition:all 0.15s;">
                            <span style="font-size:20px;">${a.icon}</span>
                            <span style="font-size:var(--text-xs); color:var(--text-secondary);">${a.label}</span>
                        </button>
                    `).join('')}
                </div>
            </div>`;

        // 按钮悬停效果
        container.querySelectorAll('.ws-widget__action-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                btn.style.background = 'var(--surface-hover, var(--surface))';
                btn.style.borderColor = 'var(--primary, var(--border))';
                btn.style.transform = 'translateY(-1px)';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.background = 'var(--surface)';
                btn.style.borderColor = 'var(--border)';
                btn.style.transform = 'translateY(0)';
            });
        });

        // 点击导航
        const _handleClick = (e) => {
            const btn = e.target.closest('[data-page]');
            if (btn && typeof Router !== 'undefined') {
                Router.navigate(btn.dataset.page);
            }
        };
        container.addEventListener('click', _handleClick);

        return {
            destroy() {
                container.removeEventListener('click', _handleClick);
                container.innerHTML = '';
            },
            refresh() {
                // 静态内容，无需刷新
            }
        };
    }

    WidgetRegistry.register('quick-create', {
        type: 'function',
        label: '快捷创建',
        icon: '➕',
        description: '快捷创建知识、规则、记忆、会话',
        defaultSize: { w: 1, h: 1 },
        category: 'functions',
        mount
    });
})();
