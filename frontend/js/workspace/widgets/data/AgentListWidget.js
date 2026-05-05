/**
 * AgentListWidget — Agent 列表
 *
 * 数据源: DataService.fetch('agents')
 * 显示: 列表，每项显示Agent名称+状态，最多6条
 * 订阅: DataService.subscribe('agents', refresh)
 */
const AgentListWidget = (() => {
    'use strict';

    const SOURCE = 'agents';
    const MAX_ITEMS = 6;

    let _unsubscribe = null;

    function _statusDot(status) {
        const active = status === 'active' || status === 'online' || status === 'running' ||
                       status === '在线' || status === '运行中';
        const color = active ? 'var(--color-success, #4caf50)' : 'var(--text-tertiary, #999)';
        return `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${color};margin-right:6px;flex-shrink:0;"></span>`;
    }

    function _statusLabel(status) {
        const map = {
            active: '在线', online: '在线', running: '运行中', idle: '空闲',
            inactive: '离线', offline: '离线', error: '异常',
            '在线': '在线', '离线': '离线', '运行中': '运行中', '空闲': '空闲', '异常': '异常'
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

    WidgetRegistry.register('agent-list', {
        type: 'data',
        label: 'Agent 列表',
        icon: '\u{1F916}',
        description: '显示 Agent 列表及其在线状态',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount
    });
})();
