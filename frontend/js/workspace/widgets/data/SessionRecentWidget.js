/**
 * SessionRecentWidget — 最近会话
 *
 * 数据源: DataService.fetch('sessions.recent')
 * 显示: 列表，每项显示会话标题+时间，最多6条
 * 点击: Router.navigate('sessions')
 * 订阅: DataService.subscribe('sessions', refresh)
 */
const SessionRecentWidget = (() => {
    'use strict';

    const SOURCE = 'sessions.recent';
    const SUBSCRIBE_SOURCE = 'sessions';
    const MAX_ITEMS = 6;

    let _unsubscribe = null;

    function _formatTime(ts) {
        if (!ts) return '';
        const d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return '刚刚';
        if (diffMin < 60) return `${diffMin}分钟前`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}小时前`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `${diffDay}天前`;
        return `${d.getMonth() + 1}/${d.getDate()}`;
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
                            ${items.map(item => `<li class="ws-widget__list-item" data-action="navigate" data-route="sessions">
                                <span class="ws-truncate" style="flex:1;">${item.title || item.name || '未命名会话'}</span>
                                <span class="ws-widget__list-meta">${_formatTime(item.updatedAt || item.createdAt || item.time)}</span>
                            </li>`).join('')}
                        </ul>
                    </div>
                </div>` : `<div class="ws-widget"><div class="ws-widget__content" style="text-align:center;padding:20px;color:var(--text-tertiary);">暂无数据</div></div>`;
        }

        render(data);
        _unsubscribe = DataService.subscribe(SUBSCRIBE_SOURCE, (newData) => render(newData));

        return {
            destroy() { if (_unsubscribe) _unsubscribe(); },
            refresh() { DataService.refresh(SOURCE).then(render); }
        };
    }

    WidgetRegistry.register('session-recent', {
        type: 'data',
        label: '最近会话',
        icon: '\u{1F4AC}',
        description: '显示最近的会话记录，点击可跳转到会话管理页面',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount
    });
})();
