/**
 * KnowledgeListWidget — 知识列表
 *
 * 数据源: DataService.fetch('knowledge')
 * 显示: 列表形式，每项显示标题（截断30字），最多显示8条
 * 点击: Router.navigate('knowledge')
 * 订阅: DataService.subscribe('knowledge', refresh)
 */
const KnowledgeListWidget = (() => {
    'use strict';

    const SOURCE = 'knowledge';
    const MAX_ITEMS = 8;
    const TRUNCATE_LEN = 30;

    let _unsubscribe = null;

    function _truncate(str, len) {
        if (!str) return '-';
        return str.length > len ? str.slice(0, len) + '...' : str;
    }

    async function mount(container, props) {
        let data;
        try { data = await DataService.fetch(SOURCE); } catch (e) { data = []; }

        function render(list) {
            const items = (Array.isArray(list) ? list : []).slice(0, MAX_ITEMS);
            container.innerHTML = items.length ? `
                <div class="ws-widget">
                    <div class="ws-widget__content">
                        <ul class="ws-widget__list">
                            ${items.map(item => `<li class="ws-widget__list-item" data-action="navigate" data-route="knowledge">
                                <span class="ws-truncate">${_truncate(item.title || item.name, TRUNCATE_LEN)}</span>
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

    WidgetRegistry.register('knowledge-list', {
        type: 'data',
        label: '知识列表',
        icon: '\u{1F4D6}',
        description: '显示知识库条目列表，点击可跳转到知识管理页面',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount
    });
})();
