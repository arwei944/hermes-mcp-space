/**
 * RulesListWidget — 规则列表
 *
 * 数据源: DataService.fetch('rules')
 * 显示: 列表，每项显示规则名称，最多8条
 * 订阅: DataService.subscribe('rules', refresh)
 */
const RulesListWidget = (() => {
    'use strict';

    const SOURCE = 'rules';
    const MAX_ITEMS = 8;

    let _unsubscribe = null;

    async function mount(container, props) {
        let data;
        try { data = await DataService.fetch(SOURCE); } catch (e) { data = []; }

        function render(list) {
            const items = (Array.isArray(list) ? list : []).slice(0, MAX_ITEMS);
            container.innerHTML = items.length ? `
                <div class="ws-widget">
                    <div class="ws-widget__content">
                        <ul class="ws-widget__list">
                            ${items.map(item => `<li class="ws-widget__list-item">
                                <span class="ws-truncate">${item.name || item.title || '-'}</span>
                            </li>`).join('')}
                        </ul>
                    </div>
                </div>` : `<div class="ws-widget"><div class="ws-widget__content" style="text-align:center;padding:20px;color:var(--text-tertiary);">暂无数据</div></div>`;
        }

        render(data);
        _unsubscribe = DataService.subscribe(SOURCE, (newData) => render(newData));

        return {
            destroy() { if (_unsubscribe) _unsubscribe(); },
            refresh() { DataService.refresh(SOURCE).then(render); }
        };
    }

    WidgetRegistry.register('rules-list', {
        type: 'data',
        label: '规则列表',
        icon: '\u{1F4CF}',
        description: '显示系统规则列表',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount
    });
})();
