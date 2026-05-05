/**
 * KnowledgeGraphWidget — 知识图谱
 *
 * 数据源: DataService.fetch('knowledge')
 * 显示: 知识/规则/经验/记忆的数量对比条形图（纯CSS实现）
 * 订阅: DataService.subscribe('knowledge', refresh)
 */
const KnowledgeGraphWidget = (() => {
    'use strict';

    const SOURCE = 'knowledge';

    let _unsubscribe = null;

    function _barRow(label, value, max, color) {
        const pct = max > 0 ? Math.round((value / max) * 100) : 0;
        return `
            <div class="ws-bar-row" style="margin-bottom:10px;">
                <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:3px;">
                    <span style="font-size:12px;color:var(--text-secondary);">${label}</span>
                    <span style="font-size:13px;font-weight:600;color:var(--text-primary);">${value}</span>
                </div>
                <div style="width:100%;height:8px;background:var(--bg-secondary, #f0f0f0);border-radius:4px;overflow:hidden;">
                    <div style="width:${pct}%;height:100%;background:${color};border-radius:4px;transition:width 0.4s ease;"></div>
                </div>
            </div>`;
    }

    async function mount(container, props) {
        let data;
        try { data = await DataService.fetch(SOURCE); } catch (e) { data = {}; }

        function render(stats) {
            const s = stats || {};
            const knowledge   = s.knowledge   ?? s.knowledgeCount   ?? 0;
            const rules       = s.rules       ?? s.rulesCount       ?? 0;
            const experiences = s.experiences ?? s.experienceCount  ?? 0;
            const memories    = s.memories    ?? s.memoryCount      ?? 0;

            const max = Math.max(knowledge, rules, experiences, memories, 1);

            container.innerHTML = `
                <div class="ws-widget">
                    <div class="ws-widget__content" style="padding:12px;">
                        ${_barRow('知识', knowledge, max, 'var(--color-primary, #5b8def)')}
                        ${_barRow('规则', rules, max, 'var(--color-warning, #ff9800)')}
                        ${_barRow('经验', experiences, max, 'var(--color-success, #4caf50)')}
                        ${_barRow('记忆', memories, max, 'var(--color-info, #2196f3)')}
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

    WidgetRegistry.register('knowledge-graph', {
        type: 'stat',
        label: '知识图谱',
        icon: '\u{1F578}\uFE0F',
        description: '显示知识/规则/经验/记忆的数量对比条形图',
        defaultSize: { w: 2, h: 2 },
        category: 'stats',
        mount
    });
})();
