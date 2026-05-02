/**
 * 告警管理页面 - 页面骨架
 * Tab 切换逻辑
 */

const OpsAlertsPageLayout = (() => {
    let _currentTab = 'rules';

    function buildLayout() {
        const tabsHtml = Components.createTabs(
            [
                { key: 'rules', label: '告警规则管理' },
                { key: 'history', label: '告警历史' },
            ],
            _currentTab,
            'OpsAlertsPageLayout.switchTab',
        );

        const rulesVisible = _currentTab === 'rules' ? '' : 'display:none';
        const historyVisible = _currentTab === 'history' ? '' : 'display:none';

        return `${tabsHtml}
            <div style="margin-top:16px">
                <div id="ops-alerts-rules" style="${rulesVisible}"></div>
                <div id="ops-alerts-history" style="${historyVisible}"></div>
            </div>`;
    }

    function switchTab(tab) {
        _currentTab = tab;
        const container = document.getElementById('contentBody');
        if (container) {
            container.innerHTML = buildLayout();
            bindEvents();
        }
        // 更新 tab 高亮
        document.querySelectorAll('.tabs .tab-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.key === tab);
        });
        // 通知子模块重新渲染
        if (tab === 'rules') {
            import('./RulesTab.js').then(m => m.default.render('#ops-alerts-rules'));
        } else if (tab === 'history') {
            import('./HistoryTab.js').then(m => m.default.render('#ops-alerts-history'));
        }
    }

    function bindEvents() {
        // Tab 切换事件委托已由 Components.createTabs 处理
    }

    return { buildLayout, bindEvents, switchTab };
})();

// 挂载到 window 供 Components.createTabs 回调使用
window.OpsAlertsPageLayout = OpsAlertsPageLayout;

export default OpsAlertsPageLayout;
