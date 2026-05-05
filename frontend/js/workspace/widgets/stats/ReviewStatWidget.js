/**
 * ReviewStatWidget — 审核统计
 *
 * 数据源: DataService.fetch('reviews.stats')
 * 显示: 待审核数(大字) + 已通过数 + 已拒绝数
 * 订阅: DataService.subscribe('reviews', refresh)
 */
const ReviewStatWidget = (() => {
    'use strict';

    const SOURCE = 'reviews.stats';
    const SUBSCRIBE_SOURCE = 'reviews';

    let _unsubscribe = null;

    async function mount(container, props) {
        let data;
        try { data = await DataService.fetch(SOURCE); } catch (e) { data = {}; }

        function render(stats) {
            const s = stats || {};
            const pending  = s.pending  ?? s.pendingCount  ?? 0;
            const approved = s.approved ?? s.approvedCount ?? 0;
            const rejected = s.rejected ?? s.rejectedCount ?? 0;

            container.innerHTML = `
                <div class="ws-widget">
                    <div class="ws-widget__content ws-stat-widget">
                        <div class="ws-stat-widget__primary">
                            <span class="ws-stat-widget__number">${pending}</span>
                            <span class="ws-stat-widget__label">待审核</span>
                        </div>
                        <div class="ws-stat-widget__row">
                            <div class="ws-stat-widget__item">
                                <span class="ws-stat-widget__number ws-stat-widget__number--success">${approved}</span>
                                <span class="ws-stat-widget__label">已通过</span>
                            </div>
                            <div class="ws-stat-widget__item">
                                <span class="ws-stat-widget__number ws-stat-widget__number--danger">${rejected}</span>
                                <span class="ws-stat-widget__label">已拒绝</span>
                            </div>
                        </div>
                    </div>
                </div>`;
        }

        render(data);
        _unsubscribe = DataService.subscribe(SUBSCRIBE_SOURCE, () => {
            DataService.refresh(SOURCE).then(render);
        });

        return {
            destroy() { if (_unsubscribe) _unsubscribe(); },
            refresh() { DataService.refresh(SOURCE).then(render); }
        };
    }

    WidgetRegistry.register('review-stat', {
        type: 'stat',
        label: '审核统计',
        icon: '\u2705',
        description: '显示审核统计数据：待审核数、已通过数、已拒绝数',
        defaultSize: { w: 1, h: 1 },
        category: 'stats',
        mount
    });
})();
