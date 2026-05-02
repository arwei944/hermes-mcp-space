/**
 * 告警管理页面 - 告警历史时间线
 * 历史列表、筛选、确认
 */

import { ALERT_TYPES, LEVEL_COLORS, LEVEL_BADGE } from './constants.js';

const HistoryTab = (() => {
    let _history = [];
    let _filterType = 'all';
    let _filterTimeRange = 'all';
    let _destroyed = false;

    async function loadData() {
        try {
            const data = await API.get('/api/ops/alerts/history');
            _history = data.history || data || [];
        } catch (_err) {
            _history = [];
        }
    }

    function onSSEAlert() {
        loadData().then(() => {
            const historyContent = document.getElementById('alertsHistoryContent');
            if (historyContent) {
                historyContent.innerHTML = buildHistoryList();
                bindHistoryEvents(historyContent);
            }
            updateStats();
        }).catch(() => {});
    }

    async function render(containerSelector) {
        _destroyed = false;
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        try {
            await loadData();
        } catch (_err) {}

        if (_destroyed) return;
        container.innerHTML = buildHistoryTab();
        bindEvents(container);
    }

    function buildHistoryTab() {
        const unackCount = _history.filter((h) => h.status === 'triggered').length;
        const ackCount = _history.length - unackCount;

        const statsHtml = `<div id="alertsHistoryStats"><div class="stats">
            ${Components.renderStatCard('总告警', _history.length, '', 'alertTriangle', 'blue')}
            ${Components.renderStatCard('未确认', unackCount, '', 'alertTriangle', 'red')}
            ${Components.renderStatCard('已确认', ackCount, '', 'check', 'green')}
        </div></div>`;

        return `${statsHtml}${buildFilterBar()}<div id="alertsHistoryContent">${buildHistoryList()}</div>`;
    }

    function buildFilterBar() {
        const typeOptions = [
            { value: 'all', label: '全部类型' },
            ...Object.entries(ALERT_TYPES).map(([key, val]) => ({ value: key, label: val.label })),
        ];
        const timeOptions = [
            { value: 'all', label: '全部时间' },
            { value: '1h', label: '最近 1 小时' },
            { value: '6h', label: '最近 6 小时' },
            { value: '24h', label: '最近 24 小时' },
            { value: '7d', label: '最近 7 天' },
        ];

        return `<div style="display:flex;gap:12px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
            <select class="form-input" style="width:auto;min-width:160px" data-action="setFilterType">
                ${typeOptions.map((o) => `<option value="${o.value}" ${_filterType === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
            <select class="form-input" style="width:auto;min-width:140px" data-action="setFilterTimeRange">
                ${timeOptions.map((o) => `<option value="${o.value}" ${_filterTimeRange === o.value ? 'selected' : ''}>${o.label}</option>`).join('')}
            </select>
            <button class="btn btn-sm btn-ghost" data-action="refreshHistory">刷新</button>
        </div>`;
    }

    function buildHistoryList() {
        const filtered = filterHistory();
        if (filtered.length === 0) {
            return Components.createEmptyState(Components.icon('alertTriangle', 48), '暂无告警记录', '没有匹配的告警历史', '');
        }

        let html = '<div style="display:flex;flex-direction:column;gap:8px">';
        filtered.forEach((h) => {
            const typeConfig = ALERT_TYPES[h.type] || {};
            const isUnack = h.status === 'triggered';
            const level = h.level || 'warning';
            const borderColor = LEVEL_COLORS[level] || LEVEL_COLORS.warning;
            const levelText = { critical: '严重', warning: '警告', info: '信息' }[level] || '警告';
            const bgStyle = isUnack
                ? 'background:rgba(239,68,68,0.06);border-left:3px solid var(--red)'
                : 'background:var(--bg-secondary);border-left:3px solid var(--border)';

            html += `<div style="padding:12px 16px;border-radius:var(--radius-sm);${bgStyle};transition:background 0.15s" onmouseover="this.style.filter='brightness(1.02)'" onmouseout="this.style.filter='none'">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span style="color:${borderColor};font-weight:700;font-size:14px;flex-shrink:0">${Components.icon(typeConfig.icon || 'alertTriangle', 16)}</span>
                    <span style="font-weight:600;font-size:13px;flex:1">${Components.escapeHtml(h.rule_name || h.name || '未知规则')}</span>
                    ${Components.renderBadge(typeConfig.label || h.type, LEVEL_BADGE[level] || 'orange')}
                    ${Components.renderBadge(levelText, LEVEL_BADGE[level] || 'orange')}
                    ${isUnack ? Components.renderBadge('未确认', 'red') : Components.renderBadge('已确认', 'green')}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;padding-left:24px">
                    ${Components.escapeHtml(h.detail || h.message || '无详情')}
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;padding-left:24px">
                    <span style="font-size:11px;color:var(--text-tertiary)">${h.timestamp ? Components.formatDateTime(h.timestamp) : '-'}</span>
                    ${isUnack ? `<button class="btn btn-sm btn-ghost" style="color:var(--accent)" data-action="acknowledgeAlert" data-id="${h.id}">确认</button>` : ''}
                </div>
            </div>`;
        });
        html += '</div>';
        return html;
    }

    function filterHistory() {
        return _history.filter((h) => {
            if (_filterType !== 'all' && h.type !== _filterType) return false;
            if (_filterTimeRange !== 'all' && h.timestamp) {
                const now = Date.now();
                const ts = new Date(h.timestamp).getTime();
                const ranges = { '1h': 3600000, '6h': 21600000, '24h': 86400000, '7d': 604800000 };
                if (ranges[_filterTimeRange] && now - ts > ranges[_filterTimeRange]) return false;
            }
            return true;
        });
    }

    function updateStats() {
        const statsEl = document.getElementById('alertsHistoryStats');
        if (statsEl) {
            const unackCount = _history.filter((h) => h.status === 'triggered').length;
            const ackCount = _history.length - unackCount;
            statsEl.innerHTML = `<div class="stats">
                ${Components.renderStatCard('总告警', _history.length, '', 'alertTriangle', 'blue')}
                ${Components.renderStatCard('未确认', unackCount, '', 'alertTriangle', 'red')}
                ${Components.renderStatCard('已确认', ackCount, '', 'check', 'green')}
            </div>`;
        }
    }

    async function acknowledgeAlert(id) {
        try {
            await API.post(`/api/ops/alerts/acknowledge/${id}`);
            Components.Toast.success('告警已确认');
            await loadData();
            const historyContent = document.getElementById('alertsHistoryContent');
            if (historyContent) {
                historyContent.innerHTML = buildHistoryList();
                bindHistoryEvents(historyContent);
            }
            updateStats();
        } catch (err) {
            Components.Toast.error(`确认失败: ${err.message}`);
        }
    }

    async function refreshHistory() {
        Components.Toast.info('正在刷新...');
        await loadData();
        const historyContent = document.getElementById('alertsHistoryContent');
        if (historyContent) {
            historyContent.innerHTML = buildHistoryList();
            bindHistoryEvents(historyContent);
        }
        updateStats();
        Components.Toast.success('已刷新');
    }

    function _refreshHistoryContent() {
        const historyContent = document.getElementById('alertsHistoryContent');
        if (historyContent) {
            historyContent.innerHTML = buildHistoryList();
            bindHistoryEvents(historyContent);
        }
    }

    function bindEvents(container) {
        container.addEventListener('change', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            if (action === 'setFilterType') {
                _filterType = target.value;
                _refreshHistoryContent();
            } else if (action === 'setFilterTimeRange') {
                _filterTimeRange = target.value;
                _refreshHistoryContent();
            }
        });

        container.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const id = target.dataset.id;
            if (action === 'acknowledgeAlert') acknowledgeAlert(id);
            else if (action === 'refreshHistory') refreshHistory();
        });
    }

    function bindHistoryEvents(container) {
        container.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target || target.dataset.action !== 'acknowledgeAlert') return;
            acknowledgeAlert(target.dataset.id);
        });
    }

    function destroy() {
        _destroyed = true;
    }

    return { loadData, render, destroy, onSSEAlert };
})();

export default HistoryTab;
