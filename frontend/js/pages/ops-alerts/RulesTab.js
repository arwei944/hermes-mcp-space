/**
 * 告警管理页面 - 告警规则管理 (CRUD)
 * 规则列表、添加/编辑/删除
 */

import { ALERT_TYPES } from './constants.js';

const RulesTab = (() => {
    let _rules = [];
    let _destroyed = false;
    let _unwatch = null;
    let _containerSelector = null;

    function _loadFromStore() {
        if (!window.Store) return;
        var data = Store.get('ops.alertRules');
        _rules = data ? (data.rules || data || []) : [];
    }

    function _onRulesUpdate(rules) {
        if (_destroyed) return;
        _rules = rules ? (rules.rules || rules || []) : [];
        _rerender();
    }

    function _rerender() {
        if (_destroyed || !_containerSelector) return;
        var container = document.querySelector(_containerSelector);
        if (!container) return;
        container.innerHTML = buildRulesTab();
        bindEvents(container);
    }

    function startWatching() {
        if (!window.Store) return;
        if (_unwatch) return;
        _unwatch = Store.watch('ops.alertRules', _onRulesUpdate);
    }

    function stopWatching() {
        if (_unwatch) {
            _unwatch();
            _unwatch = null;
        }
    }

    async function loadData() {
        _loadFromStore();
    }

    async function render(containerSelector) {
        _destroyed = false;
        _containerSelector = containerSelector;
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // 从 Store 读取初始数据
        _loadFromStore();

        if (_destroyed) return;
        container.innerHTML = buildRulesTab();
        bindEvents(container);

        // 启动响应式监听
        startWatching();
    }

    function buildRulesTab() {
        const enabledCount = _rules.filter((r) => r.enabled).length;
        const disabledCount = _rules.length - enabledCount;

        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总规则', _rules.length, '', 'alertTriangle', 'blue')}
            ${Components.renderStatCard('已启用', enabledCount, '', 'check', 'green')}
            ${Components.renderStatCard('已禁用', disabledCount, '', 'pause', 'orange')}
        </div>`;

        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-primary" data-action="showRuleModal">添加规则</button>
        </div>`;

        const rulesHtml =
            _rules.length === 0
                ? Components.createEmptyState(Components.icon('alertTriangle', 48), '暂无告警规则', '点击「添加规则」创建第一条告警规则', '')
                : `<div class="table-wrapper"><table class="table">
                <thead><tr><th>规则名称</th><th>类型</th><th>阈值</th><th>状态</th><th>冷却时间</th><th>上次触发</th><th>操作</th></tr></thead>
                <tbody>
                    ${_rules
                        .map((r) => {
                            const typeConfig = ALERT_TYPES[r.type] || {};
                            const thresholdDisplay = typeConfig.unit ? `${r.threshold}${typeConfig.unit}` : r.threshold;
                            const statusBadge = r.enabled ? Components.renderBadge('开启', 'green') : Components.renderBadge('关闭', 'orange');
                            return `<tr>
                                <td style="font-weight:500">${Components.escapeHtml(r.name || '-')}</td>
                                <td>${Components.renderBadge(typeConfig.label || r.type, 'blue')}</td>
                                <td class="mono" style="font-weight:600">${thresholdDisplay}</td>
                                <td>${statusBadge}</td>
                                <td class="mono" style="font-size:12px">${r.cooldown || 0}s</td>
                                <td style="font-size:12px;color:var(--text-tertiary)">${r.last_triggered ? Components.formatDateTime(r.last_triggered) : '-'}</td>
                                <td>
                                    <div style="display:flex;gap:4px">
                                        <button class="btn btn-sm btn-ghost" data-action="editRule" data-id="${r.id}" title="编辑">${Components.icon('edit', 14)}</button>
                                        <button class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteRule" data-id="${r.id}" title="删除">${Components.icon('trash', 16)}</button>
                                    </div>
                                </td>
                            </tr>`;
                        })
                        .join('')}
                </tbody>
            </table></div>`;

        return `${statsHtml}${actionsHtml}${rulesHtml}`;
    }

    function showRuleModal(ruleId) {
        const rule = ruleId ? _rules.find((r) => r.id === ruleId || r.id === String(ruleId)) : null;
        const isEdit = !!rule;

        const typeOptions = Object.entries(ALERT_TYPES).map(([key, val]) => ({ value: key, label: val.label }));

        const content = `
            ${Components.formGroup('规则名称', `<input class="form-input" id="alertRuleName" placeholder="例如: CPU 使用率监控" value="${Components.escapeHtml(rule?.name || '')}">`)}
            ${Components.formGroup('告警类型', Components.formSelect('alertRuleType', typeOptions, rule?.type || ''))}
            ${Components.formGroup(
                '阈值',
                `<input class="form-input" type="number" id="alertRuleThreshold" min="0" step="1" value="${rule?.threshold ?? ALERT_TYPES.cpu_high.defaultThreshold}" placeholder="请输入阈值">`,
                '<span id="alertThresholdHint">触发告警的阈值</span>',
            )}
            ${Components.formGroup(
                '冷却时间（秒）',
                `<input class="form-input" type="number" id="alertRuleCooldown" min="0" step="1" value="${rule?.cooldown ?? 300}" placeholder="例如: 300">`,
                '同一规则在冷却时间内不会重复触发',
            )}
            ${Components.formGroup('启用状态', Components.formSwitch('alertRuleEnabled', '启用此告警规则', rule?.enabled !== false))}
        `;

        const footer = `<div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-ghost" data-action="closeModal">取消</button>
            <button class="btn btn-primary" data-action="saveRule" data-id="${rule?.id || ''}">${isEdit ? '保存' : '创建'}</button>
        </div>`;

        Components.Modal.open({
            title: isEdit ? '编辑告警规则' : '添加告警规则',
            content,
            footer,
        });

        setTimeout(() => {
            const typeSelect = document.querySelector('[name="alertRuleType"]');
            if (typeSelect) {
                typeSelect.addEventListener('change', updateThresholdHint);
                updateThresholdHint();
            }
            const modal = document.querySelector('.modal');
            if (modal) {
                modal.addEventListener('click', (e) => {
                    const target = e.target.closest('[data-action]');
                    if (!target) return;
                    if (target.dataset.action === 'closeModal') Components.Modal.close();
                    else if (target.dataset.action === 'saveRule') saveRuleFromModal(target.dataset.id);
                });
            }
        }, 50);
    }

    function updateThresholdHint() {
        const typeSelect = document.querySelector('[name="alertRuleType"]');
        const hintEl = document.getElementById('alertThresholdHint');
        const thresholdInput = document.getElementById('alertRuleThreshold');
        if (!typeSelect || !hintEl) return;

        const config = ALERT_TYPES[typeSelect.value];
        if (config) {
            hintEl.textContent = config.unit
                ? `超过 ${config.defaultThreshold}${config.unit} 时触发告警`
                : '触发条件（布尔值：1=触发）';
            if (thresholdInput && !thresholdInput.dataset.touched) {
                thresholdInput.value = config.defaultThreshold;
            }
        }

        if (thresholdInput) {
            thresholdInput.addEventListener('input', () => { thresholdInput.dataset.touched = 'true'; }, { once: true });
        }
    }

    async function saveRuleFromModal(ruleId) {
        const name = document.getElementById('alertRuleName')?.value.trim();
        const type = document.querySelector('[name="alertRuleType"]')?.value;
        const threshold = parseFloat(document.getElementById('alertRuleThreshold')?.value);
        const cooldown = parseInt(document.getElementById('alertRuleCooldown')?.value) || 0;
        const enabled = document.querySelector('[name="alertRuleEnabled"]')?.checked ?? true;

        if (!name) { Components.Toast.error('请填写规则名称'); return; }
        if (!type) { Components.Toast.error('请选择告警类型'); return; }
        if (isNaN(threshold) || threshold < 0) { Components.Toast.error('阈值必须为非负数'); return; }

        const body = { name, type, threshold, cooldown, enabled };

        try {
            if (ruleId) {
                await API.put(`/api/ops/alerts/rules/${ruleId}`, body);
                Components.Toast.success('规则已更新');
            } else {
                await API.post('/api/ops/alerts/rules', body);
                Components.Toast.success('规则已创建');
            }
            Components.Modal.close();
            // OpsSyncService 会重新同步并更新 Store，watch 回调会自动刷新
        } catch (err) {
            Components.Toast.error(`操作失败: ${err.message}`);
        }
    }

    async function deleteRule(id) {
        const ok = await Components.Modal.confirm({
            title: '删除规则',
            message: '确定要删除此告警规则吗？此操作不可撤销。',
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;

        try {
            await API.del(`/api/ops/alerts/rules/${id}`);
            Components.Toast.success('规则已删除');
            // OpsSyncService 会重新同步并更新 Store，watch 回调会自动刷新
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    function bindEvents(container) {
        container.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            const id = target.dataset.id;
            if (action === 'showRuleModal') showRuleModal(null);
            else if (action === 'editRule') showRuleModal(id);
            else if (action === 'deleteRule') deleteRule(id);
        });
    }

    function destroy() {
        _destroyed = true;
        stopWatching();
        _containerSelector = null;
    }

    return { loadData, render, destroy, startWatching, stopWatching };
})();

export default RulesTab;
