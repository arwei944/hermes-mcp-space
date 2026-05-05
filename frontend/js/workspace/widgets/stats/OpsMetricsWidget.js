/**
 * OpsMetricsWidget — 运维指标
 *
 * 数据源: DataService.fetch('ops.metrics')
 * 显示: API调用量 + 错误率 + 平均响应时间 + MCP健康度
 * 订阅: SSE 'sse:ops.metrics' 触发 DataService 刷新
 */
const OpsMetricsWidget = (() => {
    'use strict';

    const SOURCE = 'ops.metrics';

    let _unsubscribe = null;

    function _metricItem(label, value, unit, color) {
        return `
            <div class="ws-metric-item" style="text-align:center;flex:1;">
                <div style="font-size:18px;font-weight:700;color:${color || 'var(--text-primary)'};">${value ?? '-'}</div>
                <div style="font-size:11px;color:var(--text-tertiary);margin-top:2px;">${label}${unit ? ` (${unit})` : ''}</div>
            </div>`;
    }

    async function mount(container, props) {
        let data;
        try { data = await DataService.fetch(SOURCE); } catch (e) { data = {}; }

        function render(metrics) {
            const m = metrics || {};
            const apiCalls    = m.apiCalls    ?? m.totalCalls    ?? '-';
            const errorRate   = m.errorRate   ?? m.errorPercent  ?? '-';
            const avgResponse = m.avgResponse ?? m.avgLatency    ?? '-';
            const mcpHealth   = m.mcpHealth   ?? m.mcpScore      ?? '-';

            // 格式化数值
            const callsDisplay = typeof apiCalls === 'number'
                ? (apiCalls >= 10000 ? (apiCalls / 1000).toFixed(1) + 'k' : apiCalls)
                : apiCalls;
            const errorDisplay = typeof errorRate === 'number'
                ? errorRate.toFixed(1) + '%'
                : errorRate;
            const responseDisplay = typeof avgResponse === 'number'
                ? avgResponse + 'ms'
                : avgResponse;
            const healthDisplay = typeof mcpHealth === 'number'
                ? mcpHealth + '%'
                : mcpHealth;

            // 错误率颜色
            const errorColor = typeof errorRate === 'number'
                ? (errorRate > 5 ? 'var(--color-danger, #f44336)' :
                   errorRate > 1 ? 'var(--color-warning, #ff9800)' :
                   'var(--color-success, #4caf50)')
                : 'var(--text-primary)';

            container.innerHTML = `
                <div class="ws-widget">
                    <div class="ws-widget__content" style="padding:8px 0;">
                        <div style="display:flex;align-items:center;justify-content:space-around;">
                            ${_metricItem('API调用量', callsDisplay, '', 'var(--color-primary, #5b8def)')}
                            ${_metricItem('错误率', errorDisplay, '', errorColor)}
                            ${_metricItem('平均响应', responseDisplay, '', 'var(--text-primary)')}
                            ${_metricItem('MCP健康度', healthDisplay, '', 'var(--color-success, #4caf50)')}
                        </div>
                    </div>
                </div>`;
        }

        render(data);
        _unsubscribe = DataService.subscribe('ops', () => {
            DataService.refresh(SOURCE).then(render);
        });

        return {
            destroy() { if (_unsubscribe) _unsubscribe(); },
            refresh() { DataService.refresh(SOURCE).then(render); }
        };
    }

    WidgetRegistry.register('ops-metrics', {
        type: 'stat',
        label: '运维指标',
        icon: '\u{1F4C8}',
        description: '显示运维核心指标：API调用量、错误率、平均响应时间、MCP健康度',
        defaultSize: { w: 2, h: 1 },
        category: 'stats',
        mount
    });
})();
