/**
 * ExperienceListWidget — 经验列表
 *
 * 数据源: DataService.fetch('experiences')
 * 显示: 列表，每项显示问题描述（截断30字），最多8条
 * 订阅: DataService.subscribe('experiences', refresh)
 */
const ExperienceListWidget = (() => {
    'use strict';

    const SOURCE = 'experiences';
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
                            ${items.map(item => `<li class="ws-widget__list-item">
                                <span class="ws-truncate">${_truncate(item.question || item.title || item.description, TRUNCATE_LEN)}</span>
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

    WidgetRegistry.register('experience-list', {
        type: 'data',
        label: '经验列表',
        icon: '\u{1F4A1}',
        description: '显示经验库条目列表',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount
    });
})();
