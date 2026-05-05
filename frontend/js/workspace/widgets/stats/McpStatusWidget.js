/**
 * McpStatusWidget — MCP 状态
 *
 * 数据源: DataService.fetch('mcp')
 * 显示: 连接数 + 状态指示灯（绿色/红色）
 * 订阅: DataService.subscribe('mcp', refresh)
 */
const McpStatusWidget = (() => {
    'use strict';

    const SOURCE = 'mcp';

    let _unsubscribe = null;

    async function mount(container, props) {
        let data;
        try { data = await DataService.fetch(SOURCE); } catch (e) { data = {}; }

        function render(status) {
            const s = status || {};
            const connections = s.connections ?? s.count ?? s.servers ?? 0;
            const healthy = s.healthy ?? s.status === 'ok' ?? s.status === 'healthy' ?? true;
            const dotColor = healthy
                ? 'var(--color-success, #4caf50)'
                : 'var(--color-danger, #f44336)';
            const statusText = healthy ? '正常' : '异常';

            container.innerHTML = `
                <div class="ws-widget">
                    <div class="ws-widget__content ws-stat-widget" style="text-align:center;">
                        <div class="ws-stat-widget__primary" style="margin-bottom:8px;">
                            <span class="ws-stat-widget__number">${connections}</span>
                            <span class="ws-stat-widget__label">MCP 连接</span>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};box-shadow:0 0 6px ${dotColor};"></span>
                            <span style="font-size:12px;color:var(--text-secondary);">${statusText}</span>
                        </div>
                    </div>
                </div>`;
        }

        render(data);
        _unsubscribe = DataService.subscribe(SOURCE, (newData) => render(newData));

        return {
            destroy() { if (_unsubscribe) _unsubscribe(); },
            refresh() { DataService.refresh(SOURCE).then(render); }
        };
    }

    WidgetRegistry.register('mcp-status', {
        type: 'stat',
        label: 'MCP 状态',
        icon: '\u{1F50C}',
        description: '显示 MCP 连接数和健康状态',
        defaultSize: { w: 1, h: 1 },
        category: 'stats',
        mount
    });
})();
