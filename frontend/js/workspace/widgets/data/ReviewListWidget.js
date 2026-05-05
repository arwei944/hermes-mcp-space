/**
 * ReviewListWidget — 审核列表
 *
 * 数据源: DataService.fetch('reviews')
 * 显示: 列表，每项显示标题+状态标签，最多8条
 * 订阅: DataService.subscribe('reviews', refresh)
 */
const ReviewListWidget = (() => {
    'use strict';

    const SOURCE = 'reviews';
    const MAX_ITEMS = 8;

    let _unsubscribe = null;

    function _statusBadge(status) {
        const map = {
            pending:  { label: '待审核', cls: 'ws-badge--warning' },
            approved: { label: '已通过', cls: 'ws-badge--success' },
            rejected: { label: '已拒绝', cls: 'ws-badge--danger' },
            '待审核': { label: '待审核', cls: 'ws-badge--warning' },
            '已通过': { label: '已通过', cls: 'ws-badge--success' },
            '已拒绝': { label: '已拒绝', cls: 'ws-badge--danger' }
        };
        const info = map[status] || { label: status || '未知', cls: '' };
        return `<span class="ws-badge ${info.cls}">${info.label}</span>`;
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
                                <span class="ws-truncate" style="flex:1;">${item.title || item.name || '-'}</span>
                                ${_statusBadge(item.status)}
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

    WidgetRegistry.register('review-list', {
        type: 'data',
        label: '审核列表',
        icon: '\u2705',
        description: '显示待审核/已审核条目列表',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount
    });
})();
