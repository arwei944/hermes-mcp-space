/**
 * CronListWidget — 定时任务
 *
 * 数据源: DataService.fetch('cron')
 * 显示: 列表，每项显示任务名+状态，最多6条
 * 订阅: DataService.subscribe('cron', refresh)
 */
const CronListWidget = (() => {
    'use strict';

    const SOURCE = 'cron';
    const MAX_ITEMS = 6;

    let _unsubscribe = null;

    function _statusDot(status) {
        const active = status === 'active' || status === 'running' || status === 'enabled' ||
                       status === '运行中' || status === '已启用';
        const color = active ? 'var(--color-success, #4caf50)' : 'var(--text-tertiary, #999)';
        return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:6px;flex-shrink:0;"></span>`;
    }

    function _statusLabel(status) {
        const map = {
            active: '运行中', running: '运行中', enabled: '已启用',
            inactive: '已停止', stopped: '已停止', disabled: '已禁用',
            paused: '已暂停',
            '运行中': '运行中', '已停止': '已停止', '已启用': '已启用',
            '已禁用': '已禁用', '已暂停': '已暂停'
        };
        return map[status] || status || '未知';
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
                                <span class="ws-truncate" style="flex:1;">${item.name || item.title || '-'}</span>
                                <span class="ws-widget__list-meta">${_statusDot(item.status)}${_statusLabel(item.status)}</span>
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

    WidgetRegistry.register('cron-list', {
        type: 'data',
        label: '定时任务',
        icon: 'clock',
        description: '显示定时任务列表及其运行状态',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount
    });
})();
