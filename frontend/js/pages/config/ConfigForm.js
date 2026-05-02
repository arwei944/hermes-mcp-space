/**
 * 系统配置页面 - 配置表单 (Mac 极简风格)
 * 仅保留系统级设置，工具/记忆/MCP 设置归入各自模块
 */

const ConfigForm = (() => {
    let _config = null;
    let _versions = [];
    let _container = null;

    async function render(containerSelector) {
        _container = document.querySelector(containerSelector);
        _container.innerHTML = Components.createLoading();

        try {
            const [configData, versionData] = await Promise.all([API.config.get(), API.config.versions()]);
            _config = configData.config || configData || {};
            _versions = versionData.versions || versionData || [];
        } catch (_err) {
            _config = {};
            _versions = [];
        }

        _container.innerHTML = buildPage();
        bindEvents();
    }

    function buildPage() {
        const c = _config;

        // 版本历史
        const versionHtml =
            _versions.length > 0
                ? `
            ${Components.sectionTitle('配置变更历史')}
            ${Components.renderSection(
                '',
                `
                <div style="max-height:300px;overflow-y:auto">
                    <table class="table">
                        <thead><tr><th>版本</th><th>时间</th><th>变更摘要</th><th>操作</th></tr></thead>
                        <tbody>
                            ${_versions
                                .map(
                                    (v, i) => `<tr>
                                <td class="mono">v${v.version || i + 1}</td>
                                <td style="font-size:12px;color:var(--text-tertiary)">${Components.formatDateTime(v.timestamp)}</td>
                                <td style="font-size:12px">${Components.escapeHtml(v.summary || '无描述')}</td>
                                <td><button class="btn btn-sm btn-ghost" data-action="rollback" data-index="${i}">回滚</button></td>
                            </tr>`,
                                )
                                .join('')}
                        </tbody>
                    </table>
                </div>
            `,
            )}`
                : '';

        return `<div style="max-width:720px">
            ${Components.sectionTitle('模型设置')}
            ${Components.renderSection(
                '',
                `
                ${Components.formGroup(
                    '默认模型',
                    Components.formSelect(
                        'model',
                        [
                            { value: 'gpt-4o', label: 'GPT-4o' },
                            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                            { value: 'claude-4-sonnet', label: 'Claude 4 Sonnet' },
                            { value: 'claude-4-opus', label: 'Claude 4 Opus' },
                            { value: 'qwen3-coder', label: 'Qwen3 Coder' },
                            { value: 'deepseek-v3', label: 'DeepSeek V3' },
                        ],
                        c.model,
                    ),
                )}
                <div class="form-row">
                    ${Components.formGroup('温度', `<input class="form-input" type="number" name="temperature" min="0" max="2" step="0.1" value="${c.temperature ?? 0.7}">`, '0-2，越高越随机')}
                    ${Components.formGroup('最大 Token', `<input class="form-input" type="number" name="maxTokens" min="256" max="128000" step="256" value="${c.maxTokens ?? 4096}">`)}
                </div>
                ${Components.formGroup('系统提示词', Components.formTextarea('systemPrompt', '系统提示词...', c.systemPrompt || '', 4))}
            `,
            )}

            ${Components.sectionTitle('数据管理')}
            ${Components.renderSection(
                '',
                `
                ${Components.formGroup('自动保存会话', Components.formSwitch('autoSaveSessions', '每次对话后自动保存会话记录', c.autoSaveSessions))}
                ${Components.formGroup('会话保留天数', `<input class="form-input" type="number" name="sessionRetentionDays" min="1" max="365" value="${c.sessionRetentionDays ?? 30}">`, '超过天数的会话自动清理')}
                ${Components.formGroup('日志保留条数', `<input class="form-input" type="number" name="maxLogEntries" min="50" max="5000" step="50" value="${c.maxLogEntries ?? 500}">`)}
                ${Components.formGroup(
                    '数据导出格式',
                    Components.formSelect(
                        'exportFormat',
                        [
                            { value: 'json', label: 'JSON' },
                            { value: 'markdown', label: 'Markdown' },
                            { value: 'csv', label: 'CSV' },
                        ],
                        c.exportFormat || 'json',
                    ),
                )}
            `,
            )}

            ${Components.sectionTitle('通知设置')}
            ${Components.renderSection(
                '',
                `
                ${Components.formGroup('启用 SSE 推送', Components.formSwitch('sseEnabled', '实时推送操作状态到前端', c.sseEnabled !== false))}
                ${Components.formGroup('操作通知', Components.formSwitch('operationNotification', '写操作完成后显示 Toast 通知', c.operationNotification !== false))}
                ${Components.formGroup('Agent 状态通知', Components.formSwitch('agentNotification', 'Agent 状态变化时通知', c.agentNotification !== false))}
            `,
            )}

            ${Components.sectionTitle('安全设置')}
            ${Components.renderSection(
                '',
                `
                ${Components.formGroup('API 访问密钥', `<input class="form-input" type="password" name="apiKey" placeholder="留空则不启用认证" value="${Components.escapeHtml(c.apiKey || '')}">`, '设置后 API 调用需要携带密钥')}
                ${Components.formGroup('允许外部访问', Components.formSwitch('allowExternal', '允许非本地 IP 访问管理面板', c.allowExternal))}
            `,
            )}

            ${Components.sectionTitle('高级设置')}
            ${Components.renderSection(
                '',
                `
                ${Components.formGroup(
                    '日志级别',
                    Components.formSelect(
                        'logLevel',
                        [
                            { value: 'debug', label: '调试' },
                            { value: 'info', label: '信息' },
                            { value: 'warn', label: '警告' },
                            { value: 'error', label: '错误' },
                        ],
                        c.logLevel || 'info',
                    ),
                )}
                ${Components.formGroup('调试模式', Components.formSwitch('debugMode', '启用详细日志和调试信息', c.debugMode))}
                ${Components.formGroup('请求超时(秒)', `<input class="form-input" type="number" name="requestTimeout" min="5" max="300" value="${c.requestTimeout ?? 30}">`)}
                ${Components.formGroup('最大并发请求数', `<input class="form-input" type="number" name="maxConcurrent" min="1" max="100" value="${c.maxConcurrent ?? 10}">`)}
            `,
            )}

            ${versionHtml}

            <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px">
                <button class="btn btn-secondary" data-action="resetConfig">重置默认</button>
                <button class="btn btn-primary" data-action="saveConfig">保存配置</button>
            </div>
        </div>`;
    }

    function collectFormData() {
        if (!_container) return {};
        return {
            model: _container.querySelector('[name="model"]')?.value,
            temperature: parseFloat(_container.querySelector('[name="temperature"]')?.value),
            maxTokens: parseInt(_container.querySelector('[name="maxTokens"]')?.value),
            systemPrompt: _container.querySelector('[name="systemPrompt"]')?.value,
            autoSaveSessions: _container.querySelector('[name="autoSaveSessions"]')?.checked,
            sessionRetentionDays: parseInt(_container.querySelector('[name="sessionRetentionDays"]')?.value),
            maxLogEntries: parseInt(_container.querySelector('[name="maxLogEntries"]')?.value),
            exportFormat: _container.querySelector('[name="exportFormat"]')?.value,
            sseEnabled: _container.querySelector('[name="sseEnabled"]')?.checked,
            operationNotification: _container.querySelector('[name="operationNotification"]')?.checked,
            agentNotification: _container.querySelector('[name="agentNotification"]')?.checked,
            apiKey: _container.querySelector('[name="apiKey"]')?.value,
            allowExternal: _container.querySelector('[name="allowExternal"]')?.checked,
            logLevel: _container.querySelector('[name="logLevel"]')?.value,
            debugMode: _container.querySelector('[name="debugMode"]')?.checked,
            requestTimeout: parseInt(_container.querySelector('[name="requestTimeout"]')?.value),
            maxConcurrent: parseInt(_container.querySelector('[name="maxConcurrent"]')?.value),
        };
    }

    async function saveConfig() {
        const config = collectFormData();
        // 生成变更摘要
        const changes = [];
        if (_config) {
            for (const [key, val] of Object.entries(config)) {
                if (JSON.stringify(val) !== JSON.stringify(_config[key])) {
                    changes.push(key);
                }
            }
        }
        const summary = changes.length > 0 ? `修改了 ${changes.length} 项: ${changes.join(', ')}` : '无变更';

        try {
            await API.config.save(config, summary);
            _config = config;
            Components.Toast.success('配置已保存（版本已记录）');
            render('#config-form');
        } catch (err) {
            Components.Toast.error(`保存失败: ${err.message}`);
        }
    }

    async function resetConfig() {
        const ok = await Components.Modal.confirm({
            title: '重置默认配置',
            message: '确定要将所有配置恢复为默认值吗？当前配置将被覆盖，此操作不可撤销。',
            confirmText: '重置',
            type: 'danger',
        });
        if (!ok) return;

        try {
            await API.config.reset();
            Components.Toast.success('配置已重置');
            render('#config-form');
        } catch (err) {
            Components.Toast.error(`重置失败: ${err.message}`);
        }
    }

    async function rollback(index) {
        const version = _versions[index];
        if (!version) return;

        const ok = await Components.Modal.confirm({
            title: '回滚配置',
            message: `确定要回滚到版本 v${version.version || index + 1}（${Components.formatDateTime(version.timestamp)}）吗？当前配置将被替换。`,
            confirmText: '回滚',
            type: 'warning',
        });
        if (!ok) return;

        try {
            await API.config.rollback(index);
            Components.Toast.success('已回滚');
            render('#config-form');
        } catch (err) {
            Components.Toast.error(`回滚失败: ${err.message}`);
        }
    }

    function bindEvents() {
        if (!_container) return;
        _container.addEventListener('click', _handleAction);
    }

    function _handleAction(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'saveConfig') saveConfig();
        else if (action === 'resetConfig') resetConfig();
        else if (action === 'rollback') rollback(parseInt(btn.dataset.index));
    }

    function destroy() {
        if (_container) {
            _container.removeEventListener('click', _handleAction);
        }
        _container = null;
        _config = null;
        _versions = [];
    }

    return { render, destroy };
})();

export default ConfigForm;
