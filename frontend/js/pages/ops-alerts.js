/**
 * 告警管理页面 (Mac 极简风格)
 * 告警规则管理 + 告警历史
 */

const OpsAlertsPage = (() => {
    // ==========================================
    // 状态
    // ==========================================
    let _currentTab = 'rules';
    let _rules = [];
    let _history = [];
    let _filterType = 'all';
    let _filterTimeRange = 'all';

    // 告警类型配置
    const ALERT_TYPES = {
        cpu_high: { label: 'CPU 使用率过高', unit: '%', defaultThreshold: 80, icon: 'cpu' },
        memory_high: { label: '内存使用率过高', unit: '%', defaultThreshold: 85, icon: 'memory' },
        disk_high: { label: '磁盘使用率过高', unit: '%', defaultThreshold: 90, icon: 'disk' },
        tool_error_rate: { label: '工具错误率过高', unit: '%', defaultThreshold: 20, icon: 'alertTriangle' },
        mcp_disconnected: { label: 'MCP 服务断开', unit: '', defaultThreshold: 1, icon: 'plug' },
    };

    // 告警级别颜色
    const LEVEL_COLORS = {
        critical: 'var(--red)',
        warning: 'var(--orange)',
        info: 'var(--blue)',
    };

    const LEVEL_BADGE = {
        critical: 'red',
        warning: 'orange',
        info: 'blue',
    };

    // ==========================================
    // 生命周期
    // ==========================================

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            await Promise.all([_loadRules(), _loadHistory()]);
        } catch (_err) {
            // 静默处理
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function destroy() {
        // 清理资源（如有定时器等）
    }

    // ==========================================
    // SSE 事件
    // ==========================================

    function onSSEEvent(type, _data) {
        if (type === 'ops.alert') {
            // 自动刷新告警历史
            _loadHistory().then(() => {
                const historyContent = document.getElementById('alertsHistoryContent');
                if (historyContent && _currentTab === 'history') {
                    historyContent.innerHTML = _buildHistoryList();
                    _bindHistoryEvents();
                }
                // 更新统计
                _updateStats();
            }).catch(() => {});
        }
    }

    // ==========================================
    // 数据加载
    // ==========================================

    async function _loadRules() {
        try {
            const data = await API.get('/api/ops/alerts/rules');
            _rules = data.rules || data || [];
        } catch (_err) {
            _rules = [];
        }
    }

    async function _loadHistory() {
        try {
            const data = await API.get('/api/ops/alerts/history');
            _history = data.history || data || [];
        } catch (_err) {
            _history = [];
        }
    }

    // ==========================================
    // 页面构建
    // ==========================================

    function buildPage() {
        const tabsHtml = Components.createTabs(
            [
                { key: 'rules', label: '告警规则管理' },
                { key: 'history', label: '告警历史' },
            ],
            _currentTab,
            'OpsAlertsPage.switchTab',
        );

        const contentHtml = _currentTab === 'rules' ? _buildRulesTab() : _buildHistoryTab();

        return `${tabsHtml}<div style="margin-top:16px">${contentHtml}</div>`;
    }

    // ==========================================
    // Tab 1: 告警规则管理
    // ==========================================

    function _buildRulesTab() {
        const enabledCount = _rules.filter((r) => r.enabled).length;
        const disabledCount = _rules.length - enabledCount;

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总规则', _rules.length, '', 'alertTriangle', 'blue')}
            ${Components.renderStatCard('已启用', enabledCount, '', 'check', 'green')}
            ${Components.renderStatCard('已禁用', disabledCount, '', 'pause', 'orange')}
        </div>`;

        // 操作按钮
        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-primary" onclick="OpsAlertsPage.showRuleModal()">添加规则</button>
        </div>`;

        // 规则列表
        const rulesHtml =
            _rules.length === 0
                ? Components.createEmptyState(
                      Components.icon('alertTriangle', 48),
                      '暂无告警规则',
                      '点击「添加规则」创建第一条告警规则',
                      '',
                  )
                : `<div class="table-wrapper"><table class="table">
                <thead><tr><th>规则名称</th><th>类型</th><th>阈值</th><th>状态</th><th>冷却时间</th><th>上次触发</th><th>操作</th></tr></thead>
                <tbody>
                    ${_rules
                        .map((r) => {
                            const typeConfig = ALERT_TYPES[r.type] || {};
                            const thresholdDisplay = typeConfig.unit
                                ? `${r.threshold}${typeConfig.unit}`
                                : r.threshold;
                            const statusBadge = r.enabled
                                ? Components.renderBadge('开启', 'green')
                                : Components.renderBadge('关闭', 'orange');
                            return `<tr>
                                <td style="font-weight:500">${Components.escapeHtml(r.name || '-')}</td>
                                <td>${Components.renderBadge(typeConfig.label || r.type, 'blue')}</td>
                                <td class="mono" style="font-weight:600">${thresholdDisplay}</td>
                                <td>${statusBadge}</td>
                                <td class="mono" style="font-size:12px">${r.cooldown || 0}s</td>
                                <td style="font-size:12px;color:var(--text-tertiary)">${r.last_triggered ? Components.formatDateTime(r.last_triggered) : '-'}</td>
                                <td>
                                    <div style="display:flex;gap:4px">
                                        <button class="btn btn-sm btn-ghost" onclick="OpsAlertsPage.showRuleModal('${r.id}')" title="编辑">${Components.icon('edit', 14)}</button>
                                        <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="OpsAlertsPage.deleteRule('${r.id}')" title="删除">${Components.icon('trash', 16)}</button>
                                    </div>
                                </td>
                            </tr>`;
                        })
                        .join('')}
                </tbody>
            </table></div>`;

        return `${statsHtml}${actionsHtml}${rulesHtml}`;
    }

    // ==========================================
    // Tab 2: 告警历史
    // ==========================================

    function _buildHistoryTab() {
        const unackCount = _history.filter((h) => h.status === 'triggered').length;
        const ackCount = _history.length - unackCount;

        // 统计卡片
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总告警', _history.length, '', 'alertTriangle', 'blue')}
            ${Components.renderStatCard('未确认', unackCount, '', 'alertTriangle', 'red')}
            ${Components.renderStatCard('已确认', ackCount, '', 'check', 'green')}
        </div>`;

        // 筛选栏
        const filterHtml = _buildFilterBar();

        // 历史列表
        const historyHtml = `<div id="alertsHistoryContent">${_buildHistoryList()}</div>`;

        return `${statsHtml}${filterHtml}${historyHtml}`;
    }

    function _buildFilterBar() {
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
            <select class="form-input" style="width:auto;min-width:160px" onchange="OpsAlertsPage.setFilterType(this.value)">
                ${typeOptions
                    .map(
                        (o) =>
                            `<option value="${o.value}" ${_filterType === o.value ? 'selected' : ''}>${o.label}</option>`,
                    )
                    .join('')}
            </select>
            <select class="form-input" style="width:auto;min-width:140px" onchange="OpsAlertsPage.setFilterTimeRange(this.value)">
                ${timeOptions
                    .map(
                        (o) =>
                            `<option value="${o.value}" ${_filterTimeRange === o.value ? 'selected' : ''}>${o.label}</option>`,
                    )
                    .join('')}
            </select>
            <button class="btn btn-sm btn-ghost" onclick="OpsAlertsPage.refreshHistory()">刷新</button>
        </div>`;
    }

    function _buildHistoryList() {
        const filtered = _filterHistory();

        if (filtered.length === 0) {
            return Components.createEmptyState(
                Components.icon('alertTriangle', 48),
                '暂无告警记录',
                '没有匹配的告警历史',
                '',
            );
        }

        // 时间线形式
        let html = '<div style="display:flex;flex-direction:column;gap:8px">';

        filtered.forEach((h) => {
            const typeConfig = ALERT_TYPES[h.type] || {};
            const isUnack = h.status === 'triggered';
            const level = h.level || 'warning';
            const borderColor = LEVEL_COLORS[level] || LEVEL_COLORS.warning;
            const levelText = { critical: '严重', warning: '警告', info: '信息' }[level] || '警告';

            // 未确认高亮
            const bgStyle = isUnack
                ? 'background:rgba(239,68,68,0.06);border-left:3px solid var(--red)'
                : 'background:var(--bg-secondary);border-left:3px solid var(--border)';

            html += `<div style="padding:12px 16px;border-radius:var(--radius-sm);${bgStyle};transition:background 0.15s" onmouseover="this.style.filter='brightness(1.02)'" onmouseout="this.style.filter='none'">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                    <span style="color:${borderColor};font-weight:700;font-size:14px;flex-shrink:0">${Components.icon(typeConfig.icon || 'alertTriangle', 16)}</span>
                    <span style="font-weight:600;font-size:13px;flex:1">${Components.escapeHtml(h.rule_name || h.name || '未知规则')}</span>
                    ${Components.renderBadge(typeConfig.label || h.type, LEVEL_BADGE[level] || 'orange')}
                    ${Components.renderBadge(levelText, LEVEL_BADGE[level] || 'orange')}
                    ${isUnack
                        ? Components.renderBadge('未确认', 'red')
                        : Components.renderBadge('已确认', 'green')}
                </div>
                <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px;padding-left:24px">
                    ${Components.escapeHtml(h.detail || h.message || '无详情')}
                </div>
                <div style="display:flex;align-items:center;justify-content:space-between;padding-left:24px">
                    <span style="font-size:11px;color:var(--text-tertiary)">${h.timestamp ? Components.formatDateTime(h.timestamp) : '-'}</span>
                    ${isUnack
                        ? `<button class="btn btn-sm btn-ghost" style="color:var(--accent)" onclick="OpsAlertsPage.acknowledgeAlert('${h.id}')">确认</button>`
                        : ''}
                </div>
            </div>`;
        });

        html += '</div>';
        return html;
    }

    function _filterHistory() {
        return _history.filter((h) => {
            // 类型筛选
            if (_filterType !== 'all' && h.type !== _filterType) return false;

            // 时间范围筛选
            if (_filterTimeRange !== 'all' && h.timestamp) {
                const now = Date.now();
                const ts = new Date(h.timestamp).getTime();
                const ranges = {
                    '1h': 3600000,
                    '6h': 21600000,
                    '24h': 86400000,
                    '7d': 604800000,
                };
                if (ranges[_filterTimeRange] && now - ts > ranges[_filterTimeRange]) return false;
            }

            return true;
        });
    }

    // ==========================================
    // 更新统计（增量）
    // ==========================================

    function _updateStats() {
        // 如果在历史 tab，更新统计数字
        if (_currentTab === 'history') {
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
    }

    // ==========================================
    // 规则弹窗
    // ==========================================

    function _showRuleModal(rule) {
        const isEdit = !!rule;
        const typeConfig = rule ? ALERT_TYPES[rule.type] || {} : {};

        const typeOptions = Object.entries(ALERT_TYPES).map(([key, val]) => ({
            value: key,
            label: val.label,
        }));

        const content = `
            ${Components.formGroup('规则名称', `<input class="form-input" id="alertRuleName" placeholder="例如: CPU 使用率监控" value="${Components.escapeHtml(rule?.name || '')}">`)}
            ${Components.formGroup(
                '告警类型',
                Components.formSelect('alertRuleType', typeOptions, rule?.type || ''),
            )}
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
            ${Components.formGroup(
                '启用状态',
                Components.formSwitch('alertRuleEnabled', '启用此告警规则', rule?.enabled !== false),
            )}
        `;

        const footer = `<div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn btn-ghost" onclick="Components.Modal.close()">取消</button>
            <button class="btn btn-primary" onclick="OpsAlertsPage._saveRuleFromModal('${rule?.id || ''}')">${isEdit ? '保存' : '创建'}</button>
        </div>`;

        Components.Modal.open({
            title: isEdit ? '编辑告警规则' : '添加告警规则',
            content,
            footer,
        });

        // 绑定阈值提示更新
        setTimeout(() => {
            const typeSelect = document.querySelector('[name="alertRuleType"]');
            if (typeSelect) {
                typeSelect.addEventListener('change', _updateThresholdHint);
                _updateThresholdHint();
            }
        }, 50);
    }

    function _updateThresholdHint() {
        const typeSelect = document.querySelector('[name="alertRuleType"]');
        const hintEl = document.getElementById('alertThresholdHint');
        const thresholdInput = document.getElementById('alertRuleThreshold');

        if (!typeSelect || !hintEl) return;

        const type = typeSelect.value;
        const config = ALERT_TYPES[type];

        if (config) {
            if (config.unit) {
                hintEl.textContent = `超过 ${config.defaultThreshold}${config.unit} 时触发告警`;
            } else {
                hintEl.textContent = '触发条件（布尔值：1=触发）';
            }
            // 更新默认值（仅添加时）
            if (thresholdInput && !thresholdInput.dataset.touched) {
                thresholdInput.value = config.defaultThreshold;
            }
        }

        // 标记输入框已手动修改
        if (thresholdInput) {
            thresholdInput.addEventListener('input', () => {
                thresholdInput.dataset.touched = 'true';
            }, { once: true });
        }
    }

    // ==========================================
    // CRUD 操作
    // ==========================================

    async function _saveRuleFromModal(ruleId) {
        const name = document.getElementById('alertRuleName')?.value.trim();
        const type = document.querySelector('[name="alertRuleType"]')?.value;
        const threshold = parseFloat(document.getElementById('alertRuleThreshold')?.value);
        const cooldown = parseInt(document.getElementById('alertRuleCooldown')?.value) || 0;
        const enabled = document.querySelector('[name="alertRuleEnabled"]')?.checked ?? true;

        // 表单验证
        if (!name) {
            Components.Toast.error('请填写规则名称');
            return;
        }
        if (!type) {
            Components.Toast.error('请选择告警类型');
            return;
        }
        if (isNaN(threshold) || threshold < 0) {
            Components.Toast.error('阈值必须为非负数');
            return;
        }

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
            await render();
        } catch (err) {
            Components.Toast.error(`操作失败: ${err.message}`);
        }
    }

    async function _deleteRule(id) {
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
            await render();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function _acknowledgeAlert(id) {
        try {
            await API.post(`/api/ops/alerts/acknowledge/${id}`);
            Components.Toast.success('告警已确认');
            // 刷新历史
            await _loadHistory();
            const historyContent = document.getElementById('alertsHistoryContent');
            if (historyContent) {
                historyContent.innerHTML = _buildHistoryList();
                _bindHistoryEvents();
            }
            _updateStats();
        } catch (err) {
            Components.Toast.error(`确认失败: ${err.message}`);
        }
    }

    // ==========================================
    // Tab 切换
    // ==========================================

    function switchTab(tab) {
        _currentTab = tab;
        const container = document.getElementById('contentBody');
        if (container) {
            container.innerHTML = buildPage();
            bindEvents();
        }
        // 更新 tab 高亮
        document.querySelectorAll('.tabs .tab-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.key === tab);
        });
    }

    // ==========================================
    // 筛选
    // ==========================================

    function setFilterType(type) {
        _filterType = type;
        const historyContent = document.getElementById('alertsHistoryContent');
        if (historyContent) {
            historyContent.innerHTML = _buildHistoryList();
            _bindHistoryEvents();
        }
    }

    function setFilterTimeRange(range) {
        _filterTimeRange = range;
        const historyContent = document.getElementById('alertsHistoryContent');
        if (historyContent) {
            historyContent.innerHTML = _buildHistoryList();
            _bindHistoryEvents();
        }
    }

    async function refreshHistory() {
        Components.Toast.info('正在刷新...');
        await _loadHistory();
        const historyContent = document.getElementById('alertsHistoryContent');
        if (historyContent) {
            historyContent.innerHTML = _buildHistoryList();
            _bindHistoryEvents();
        }
        _updateStats();
        Components.Toast.success('已刷新');
    }

    // ==========================================
    // 事件绑定
    // ==========================================

    function bindEvents() {}

    function _bindHistoryEvents() {}

    // ==========================================
    // 公开 API
    // ==========================================

    return {
        render,
        destroy,
        onSSEEvent,
        switchTab,
        showRuleModal: (id) => {
            const rule = id ? _rules.find((r) => r.id === id || r.id === String(id)) : null;
            _showRuleModal(rule);
        },
        deleteRule: _deleteRule,
        acknowledgeAlert: _acknowledgeAlert,
        setFilterType,
        setFilterTimeRange,
        refreshHistory,
        _saveRuleFromModal,
    };
})();
