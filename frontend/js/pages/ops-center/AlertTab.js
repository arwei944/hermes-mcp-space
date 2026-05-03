/**
 * Ops Center - 告警管理 Tab
 * 复用 ops-alerts 的 RulesTab 和 HistoryTab
 */

var OpsAlertTab = (() => {
    var _destroyed = false;
    var _modules = {};
    var _currentSubTab = 'rules';

    function _buildSubTabs() {
        var tabs = [
            { key: 'rules', label: '告警规则管理' },
            { key: 'history', label: '告警历史' },
        ];

        var tabsHtml = tabs.map(function(tab) {
            var isActive = tab.key === _currentSubTab;
            var activeStyle = isActive
                ? 'background:var(--accent);color:#fff'
                : 'background:var(--bg-secondary);color:var(--text-secondary)';
            return '<button class="btn btn-sm" data-action="switchAlertSubTab" data-tab="' + tab.key + '" style="' + activeStyle + ';border:1px solid var(--border);padding:6px 16px;border-radius:var(--radius-tag);cursor:pointer;font-size:12px;transition:all 0.15s">' +
                Components.escapeHtml(tab.label) +
            '</button>';
        }).join('');

        return '<div style="display:flex;gap:8px;margin-bottom:16px">' + tabsHtml + '</div>';
    }

    function _switchSubTab(tab) {
        _currentSubTab = tab;
        var rulesEl = document.getElementById('opsAlertRulesPanel');
        var historyEl = document.getElementById('opsAlertHistoryPanel');
        if (rulesEl) rulesEl.style.display = tab === 'rules' ? '' : 'none';
        if (historyEl) historyEl.style.display = tab === 'history' ? '' : 'none';

        // Update tab button styles
        var container = document.querySelector('#opsAlertTabContainer');
        if (container) {
            container.querySelectorAll('[data-action="switchAlertSubTab"]').forEach(function(btn) {
                var isActive = btn.dataset.tab === tab;
                btn.style.background = isActive ? 'var(--accent)' : 'var(--bg-secondary)';
                btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
            });
        }
    }

    function bindEvents(container) {
        container.addEventListener('click', function(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;
            if (target.dataset.action === 'switchAlertSubTab') {
                _switchSubTab(target.dataset.tab);
            }
        });
    }

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // 动态导入 ops-alerts 组件
        try {
            _modules.rulesTab = (await import('../ops-alerts/RulesTab.js')).default;
            _modules.historyTab = (await import('../ops-alerts/HistoryTab.js')).default;
        } catch (_err) {
            container.innerHTML = '<div style="text-align:center;color:var(--red);padding:40px">组件加载失败</div>';
            return;
        }

        if (_destroyed) return;

        container.innerHTML =
            '<div id="opsAlertTabContainer">' +
                _buildSubTabs() +
                '<div id="opsAlertRulesPanel"></div>' +
                '<div id="opsAlertHistoryPanel" style="display:none"></div>' +
            '</div>';

        bindEvents(container);

        // 渲染子 tab
        try {
            await _modules.rulesTab.render('#opsAlertRulesPanel');
            await _modules.historyTab.render('#opsAlertHistoryPanel');
        } catch (_err) {
            // ignore
        }
    }

    function onSSEEvent(type, data) {
        if (type === 'ops.alert') {
            if (_modules.historyTab && _modules.historyTab.onSSEAlert) {
                _modules.historyTab.onSSEAlert();
            }
        }
    }

    function destroy() {
        _destroyed = true;
        if (_modules.rulesTab && _modules.rulesTab.destroy) _modules.rulesTab.destroy();
        if (_modules.historyTab && _modules.historyTab.destroy) _modules.historyTab.destroy();
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

export default OpsAlertTab;
