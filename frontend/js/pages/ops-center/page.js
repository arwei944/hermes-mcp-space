/**
 * Ops Center - 主页面
 * 8 个 Tab 的页面骨架，Tab 切换逻辑
 */

import { OPS_TABS } from './constants.js';

var OpsCenterPageLayout = (() => {
    var _currentTab = 'overview';

    function buildLayout() {
        var tabsHtml = Components.createTabs(
            OPS_TABS,
            _currentTab,
            'OpsCenterPageLayout.switchTab',
        );

        var containers = OPS_TABS.map(function(tab) {
            var visible = tab.key === _currentTab ? '' : 'display:none';
            var versionTag = tab.version ? '<div style="text-align:right;font-size:10px;color:var(--text-tertiary);padding:4px 0;margin-top:8px;border-top:1px solid var(--border)">模块版本: ' + tab.version + '</div>' : '';
            return '<div id="ops-center-' + tab.key + '" style="' + visible + '">' + versionTag + '</div>';
        }).join('');

        return '<div class="page-container">' +
            '<h2 class="page-title">' + Components.icon('activity', 20) + ' 运维中心</h2>' +
            tabsHtml +
            '<div style="margin-top:16px">' + containers + '</div>' +
        '</div>' +
        '<style>' +
            '.ops-health-grid { grid-template-columns: repeat(5, 1fr); }' +
            '.ops-overview-two-col { grid-template-columns: 1fr 1fr; }' +
            '.ops-quality-two-col { grid-template-columns: 1fr 1fr; }' +
            '.ops-resource-two-col { grid-template-columns: 1fr 1fr; }' +
            /* 增强 Tab 选中样式 */
            '#contentBody .tabs .tab-item { padding: 10px 18px; font-size: 13px; font-weight: 500; color: var(--text-tertiary); border-bottom: 2px solid transparent; border-radius: 6px 6px 0 0; transition: all 0.2s; cursor: pointer; user-select: none; }' +
            '#contentBody .tabs .tab-item:hover { color: var(--text-primary); background: var(--bg-secondary); }' +
            '#contentBody .tabs .tab-item.active { color: var(--accent); border-bottom-color: var(--accent); background: var(--bg-secondary); font-weight: 600; }' +
            '@media (max-width: 1024px) {' +
                '.ops-health-grid { grid-template-columns: repeat(3, 1fr); }' +
                '.ops-overview-two-col, .ops-quality-two-col, .ops-resource-two-col { grid-template-columns: 1fr; }' +
            '}' +
            '@media (max-width: 640px) {' +
                '.ops-health-grid { grid-template-columns: repeat(2, 1fr); }' +
                '#contentBody .tabs .tab-item { padding: 8px 12px; font-size: 12px; }' +
            '}' +
        '</style>';
    }

    function switchTab(tab) {
        _currentTab = tab;

        // 显示/隐藏容器
        OPS_TABS.forEach(function(t) {
            var el = document.getElementById('ops-center-' + t.key);
            if (el) el.style.display = t.key === tab ? '' : 'none';
        });

        // 更新 tab 高亮（用 onclick 属性匹配，因为 tab-item 没有 data-key）
        document.querySelectorAll('.tabs .tab-item').forEach(function(el) {
            var onclick = el.getAttribute('onclick') || '';
            var isActive = onclick.indexOf("'" + tab + "'") !== -1;
            el.classList.toggle('active', isActive);
        });

        // 通知 register.js 渲染对应 tab（首次切换时懒加载）
        // 注意：直接调用 _renderTab 而非 switchTab，避免循环
        if (window.OpsCenterPage && typeof window.OpsCenterPage._renderTab === 'function') {
            window.OpsCenterPage._renderTab(tab);
        }
    }

    return { buildLayout, switchTab };
})();

// 挂载到 window 供 Components.createTabs 回调使用
window.OpsCenterPageLayout = OpsCenterPageLayout;

export default OpsCenterPageLayout;
