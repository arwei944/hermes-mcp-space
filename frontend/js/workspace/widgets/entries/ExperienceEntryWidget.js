/**
 * ExperienceEntryWidget.js
 * 经验入口卡片 - 显示经验总数，点击跳转到知识库页面
 */
const ExperienceEntryWidget = (() => {
    'use strict';

    async function mount(container, props) {
        const { cardId, desktopId, config } = props;

        // 获取统计数据
        let data;
        try {
            data = await DataService.fetch('experiences');
        } catch (e) {
            data = null;
        }

        const count = Array.isArray(data) ? data.length : (data?.total || data?.length || 0);

        // 渲染卡片
        container.innerHTML = `
            <div class="ws-widget" style="cursor:pointer; text-align:center; padding:20px;">
                <div style="font-size:36px; margin-bottom:8px;">💡</div>
                <div style="font-size:var(--text-lg); font-weight:600; color:var(--text-primary);">经验</div>
                <div style="font-size:var(--text-2xl); font-weight:700; color:var(--accent); margin-top:8px;">${count}</div>
                <div style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:4px;">条经验</div>
            </div>`;

        // 点击跳转
        const handleClick = () => {
            if (typeof Router !== 'undefined') Router.navigate('knowledge');
        };
        container.addEventListener('click', handleClick);

        return {
            destroy() {
                container.removeEventListener('click', handleClick);
                container.innerHTML = '';
            },
            async refresh() {
                let newData;
                try {
                    newData = await DataService.fetch('experiences');
                } catch (e) {
                    newData = null;
                }
                const newCount = Array.isArray(newData) ? newData.length : (newData?.total || newData?.length || 0);
                const countEl = container.querySelector('.ws-widget div:nth-child(3)');
                if (countEl) countEl.textContent = newCount;
            }
        };
    }

    WidgetRegistry.register('experience-entry', {
        type: 'entry',
        label: '经验入口',
        icon: '💡',
        description: '经验快速入口，显示经验总数',
        defaultSize: { w: 1, h: 1 },
        category: 'entries',
        mount
    });
})();
