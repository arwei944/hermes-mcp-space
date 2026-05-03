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
            return '<div id="ops-center-' + tab.key + '" style="' + visible + '"></div>';
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
            '@media (max-width: 1024px) {' +
                '.ops-health-grid { grid-template-columns: repeat(3, 1fr); }' +
                '.ops-overview-two-col, .ops-quality-two-col, .ops-resource-two-col { grid-template-columns: 1fr; }' +
            '}' +
            '@media (max-width: 640px) {' +
                '.ops-health-grid { grid-template-columns: repeat(2, 1fr); }' +
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

        // 更新 tab 高亮
        document.querySelectorAll('.tabs .tab-item').forEach(function(el) {
            el.classList.toggle('active', el.dataset.key === tab);
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
