/**
 * DashboardStatsWidget — 系统概览
 *
 * 数据源: DataService.fetch('system.dashboard')
 * 显示: 会话数 + 知识数 + 工具数 + MCP连接数（2x2网格）
 * 订阅: DataService.subscribe('sessions', refresh) + SSE
 */
const DashboardStatsWidget = (() => {
    'use strict';

    const SOURCE = 'system.dashboard';

    let _unsubscribe1 = null;
    let _unsubscribe2 = null;

    function _statCard(label, value, icon) {
        return `
            <div class="ws-stat-card">
                <span class="ws-stat-card__icon">${icon}</span>
                <span class="ws-stat-card__number">${value ?? 0}</span>
                <span class="ws-stat-card__label">${label}</span>
            </div>`;
    }

    async function mount(container, props) {
        let data;
        try { data = await DataService.fetch(SOURCE); } catch (e) { data = {}; }

        function render(stats) {
            const s = stats || {};
            const sessions  = s.sessions  ?? s.sessionCount  ?? 0;
            const knowledge = s.knowledge ?? s.knowledgeCount ?? 0;
            const tools     = s.tools     ?? s.toolCount     ?? 0;
            const mcp       = s.mcp       ?? s.mcpConnections ?? s.mcpCount ?? 0;

            container.innerHTML = `
                <div class="ws-widget">
                    <div class="ws-widget__content">
                        <div class="ws-stat-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
                            ${_statCard('会话数', sessions, '\u{1F4AC}')}
                            ${_statCard('知识数', knowledge, '\u{1F4D6}')}
                            ${_statCard('工具数', tools, '\u{1F527}')}
                            ${_statCard('MCP连接', mcp, '\u{1F50C}')}
                        </div>
                    </div>
                </div>`;
        }

        render(data);
        _unsubscribe1 = DataService.subscribe('sessions', () => {
            DataService.refresh(SOURCE).then(render);
        });
        _unsubscribe2 = DataService.subscribe('knowledge', () => {
            DataService.refresh(SOURCE).then(render);
        });

        return {
            destroy() {
                if (_unsubscribe1) _unsubscribe1();
                if (_unsubscribe2) _unsubscribe2();
            },
            refresh() { DataService.refresh(SOURCE).then(render); }
        };
    }

    WidgetRegistry.register('dashboard-stats', {
        type: 'stat',
        label: '系统概览',
        icon: '\u{1F4CA}',
        description: '显示系统核心指标：会话数、知识数、工具数、MCP连接数',
        defaultSize: { w: 2, h: 1 },
        category: 'stats',
        mount
    });
})();
