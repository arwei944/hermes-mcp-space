/**
 * 统一管理页面 - 页面骨架与 Tab 切换
 */

const MarketplacePageLayout = (() => {
    function buildLayout(activeTab, counts) {
        const tabs = [
            { key: 'mcp', label: 'MCP服务', icon: Components.icon('plug', 14), count: counts.mcpTools || 0 },
            { key: 'skills', label: '技能', icon: Components.icon('zap', 16), count: counts.skills || 0 },
            { key: 'tools', label: '工具', icon: Components.icon('wrench', 16), count: counts.tools || 0 },
            { key: 'plugins', label: '插件市场', icon: Components.icon('puzzle', 16), count: counts.plugins || 0 },
        ];

        const tabHtml = `<div class="marketplace-tabs">
            ${tabs
                .map(
                    (t) => `
                <button type="button" class="marketplace-tab ${activeTab === t.key ? 'active' : ''}" data-action="switchTab" data-tab="${t.key}">
                    <span>${t.icon}</span>
                    <span>${t.label}</span>
                    <span class="tab-count">${t.count}</span>
                </button>
            `,
                )
                .join('')}
        </div>`;

        return `${tabHtml}<div class="marketplace-content">
            <div id="marketplace-mcp" style="display:${activeTab === 'mcp' ? '' : 'none'}"></div>
            <div id="marketplace-skills" style="display:${activeTab === 'skills' ? '' : 'none'}"></div>
            <div id="marketplace-tools" style="display:${activeTab === 'tools' ? '' : 'none'}"></div>
            <div id="marketplace-plugins" style="display:${activeTab === 'plugins' ? '' : 'none'}"></div>
        </div>`;
    }

    return { buildLayout };
})();

export default MarketplacePageLayout;
