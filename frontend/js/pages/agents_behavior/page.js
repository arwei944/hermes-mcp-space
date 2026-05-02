/**
 * Agent 行为管理页面 - 页面骨架 + Tab 切换 + 事件委托
 * 管理页面布局、tab 导航、全局事件委托、SSE 分发
 */

import PersonalityTab from './PersonalityTab.js';
import BehaviorLog from './BehaviorLog.js';
import StatsTab from './StatsTab.js';

const AgentsBehaviorLayout = (() => {
    // ========== 状态 ==========
    let _activeTab = 'personality';
    let _boundClickHandler = null;
    let _boundKeyHandler = null;

    // ========== 公开方法 ==========

    function getActiveTab() { return _activeTab; }

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        // 并行加载所有 tab 的初始数据（非致命）
        try {
            await Promise.all([
                PersonalityTab.loadData(),
                BehaviorLog.loadData(),
                StatsTab.loadData(),
            ]);
        } catch (_err) {
            // 静默处理，使用默认值
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function destroy() {
        if (_boundClickHandler) {
            const container = document.getElementById('contentBody');
            if (container) {
                container.removeEventListener('click', _boundClickHandler);
                container.removeEventListener('keydown', _boundKeyHandler);
            }
            _boundClickHandler = null;
            _boundKeyHandler = null;
        }
        _activeTab = 'personality';
        BehaviorLog.destroy();
        PersonalityTab.destroy();
        StatsTab.destroy();
    }

    function onSSEEvent(type, data) {
        // SSE 事件分发到各 tab 模块
        BehaviorLog.onSSEEvent(type, data);
        StatsTab.onSSEEvent(type, data);
    }

    // ========== 页面构建 ==========

    function buildPage() {
        const tabs = [
            { key: 'personality', label: '人格定义', icon: Components.icon('ghost', 14) },
            { key: 'log', label: '行为日志', icon: Components.icon('activity', 14), count: BehaviorLog.getCount() },
            { key: 'stats', label: '行为统计', icon: Components.icon('barChart', 14) },
        ];

        let tabsHtml = '<div style="display:flex;gap:4px;margin-bottom:16px;border-bottom:1px solid var(--border);padding-bottom:8px;flex-wrap:wrap">';
        tabs.forEach((t) => {
            const active = _activeTab === t.key;
            const bg = active ? 'var(--accent)' : 'transparent';
            const color = active ? '#fff' : 'var(--text-secondary)';
            const countBadge = t.count !== undefined ? `<span style="font-size:10px;opacity:0.7">${t.count}</span>` : '';
            tabsHtml += `<button type="button" class="ab-tab" data-action="switchTab" data-tab="${t.key}" style="padding:6px 14px;border-radius:8px;border:none;cursor:pointer;font-size:13px;font-weight:500;background:${bg};color:${color};transition:all 0.2s;display:flex;align-items:center;gap:6px">
                <span>${t.icon}</span>
                <span>${t.label}</span>
                ${countBadge}
            </button>`;
        });
        tabsHtml += '</div>';

        return `${tabsHtml}<div id="abContent">${buildTabContent()}</div>`;
    }

    function buildTabContent() {
        switch (_activeTab) {
            case 'personality':
                return PersonalityTab.buildContent();
            case 'log':
                return BehaviorLog.buildContent();
            case 'stats':
                return StatsTab.buildContent();
            default:
                return PersonalityTab.buildContent();
        }
    }

    // ========== Tab 切换 ==========

    function switchTab(tab) {
        _activeTab = tab;
        const el = document.getElementById('abContent');
        if (!el) return;
        el.innerHTML = buildTabContent();
        bindTabEvents();

        // 更新 tab 按钮样式
        document.querySelectorAll('.ab-tab').forEach((btn) => {
            const isActive = btn.dataset.tab === tab;
            btn.style.background = isActive ? 'var(--accent)' : 'transparent';
            btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
        });

        // 切换到 personality 时绑定编辑器事件
        if (tab === 'personality') {
            PersonalityTab.bindEditorEvents();
        }
    }

    // ========== 事件绑定 ==========

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        // 全局事件委托
        _boundClickHandler = (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            switch (action) {
                case 'switchTab':
                    switchTab(btn.dataset.tab);
                    break;
                case 'saveSoul':
                    PersonalityTab.saveSoul();
                    break;
                case 'fillTemplate':
                    PersonalityTab.fillTemplate();
                    break;
                case 'clearLog':
                    BehaviorLog.clearLog();
                    break;
                case 'refreshStats':
                    StatsTab.refreshStats();
                    break;
            }
        };

        container.addEventListener('click', _boundClickHandler);

        // Ctrl+S 快捷键
        _boundKeyHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (_activeTab === 'personality') {
                    PersonalityTab.saveSoul();
                }
            }
        };

        container.addEventListener('keydown', _boundKeyHandler);

        // 初始 tab 的事件绑定
        bindTabEvents();

        // 如果初始 tab 是 personality，绑定编辑器事件
        if (_activeTab === 'personality') {
            PersonalityTab.bindEditorEvents();
        }
    }

    function bindTabEvents() {
        const tabContent = document.getElementById('abContent');
        if (!tabContent) return;

        tabContent.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            switch (action) {
                case 'saveSoul':
                    PersonalityTab.saveSoul();
                    break;
                case 'fillTemplate':
                    PersonalityTab.fillTemplate();
                    break;
                case 'clearLog':
                    BehaviorLog.clearLog();
                    break;
                case 'refreshStats':
                    StatsTab.refreshStats();
                    break;
            }
        });

        // 行为日志 hover 效果（替代 inline onmouseover/onmouseout）
        tabContent.addEventListener('mouseover', (e) => {
            const row = e.target.closest('.ab-log-row');
            if (row) row.style.background = 'var(--bg)';
        });
        tabContent.addEventListener('mouseout', (e) => {
            const row = e.target.closest('.ab-log-row');
            if (row) row.style.background = 'var(--bg-secondary)';
        });
    }

    return { render, destroy, onSSEEvent, getActiveTab };
})();

export default AgentsBehaviorLayout;
