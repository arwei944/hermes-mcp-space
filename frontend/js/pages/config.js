/**
 * 系统配置页面
 * 配置表单、保存/重置
 */

const ConfigPage = (() => {
    let _config = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.config.get();
            _config = data.config || data || {};
        } catch (err) {
            _config = getMockConfig();
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockConfig() {
        return {
            model: 'gpt-4o',
            temperature: 0.7,
            maxTokens: 4096,
            systemPrompt: '你是一个有用的 AI 助手。',
            enabledToolsets: ['filesystem', 'system', 'web'],
            memoryEnabled: true,
            autoSaveMemory: true,
            maxContextLength: 128000,
            mcpEnabled: true,
            mcpPort: 3000,
            logLevel: 'info',
            debugMode: false,
        };
    }

    function buildPage() {
        const c = _config;

        return `
            <div class="page-enter">
                <div style="max-width:720px">
                    <!-- 模型设置 -->
                    ${Components.sectionTitle('模型设置')}
                    <div class="card" style="margin-bottom:24px">
                        ${Components.formGroup('默认模型', Components.formSelect('model', [
                            { value: 'gpt-4o', label: 'GPT-4o' },
                            { value: 'gpt-4o-mini', label: 'GPT-4o Mini' },
                            { value: 'claude-3-opus', label: 'Claude 3 Opus' },
                            { value: 'claude-3-sonnet', label: 'Claude 3 Sonnet' },
                            { value: 'claude-3-haiku', label: 'Claude 3 Haiku' },
                        ], c.model))}
                        ${Components.formRow(`
                            ${Components.formGroup('Temperature', `<input class="form-input" type="number" name="temperature" min="0" max="2" step="0.1" value="${c.temperature ?? 0.7}">`, '0-2，越高越随机')}
                            ${Components.formGroup('最大 Token', `<input class="form-input" type="number" name="maxTokens" min="256" max="128000" step="256" value="${c.maxTokens ?? 4096}">`)}
                        `)}
                        ${Components.formGroup('系统提示词', Components.formTextarea('systemPrompt', '系统提示词...', c.systemPrompt || '', 4))}
                    </div>

                    <!-- 工具设置 -->
                    ${Components.sectionTitle('工具设置')}
                    <div class="card" style="margin-bottom:24px">
                        ${Components.formGroup('启用的工具集', `
                            <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:4px">
                                ${['filesystem', 'system', 'web', 'creative', 'memory', 'skills', 'mcp'].map(ts => `
                                    <label class="form-switch">
                                        <input type="checkbox" name="toolset_${ts}" ${(c.enabledToolsets || []).includes(ts) ? 'checked' : ''}>
                                        <span class="switch-label">${ts}</span>
                                    </label>
                                `).join('')}
                            </div>
                        `)}
                    </div>

                    <!-- 记忆设置 -->
                    ${Components.sectionTitle('记忆设置')}
                    <div class="card" style="margin-bottom:24px">
                        ${Components.formGroup('启用记忆系统', Components.formSwitch('memoryEnabled', '允许 Agent 读写记忆文件', c.memoryEnabled))}
                        ${Components.formGroup('自动保存记忆', Components.formSwitch('autoSaveMemory', '每次对话后自动保存重要信息到记忆', c.autoSaveMemory))}
                        ${Components.formGroup('最大上下文长度', `<input class="form-input" type="number" name="maxContextLength" min="1000" max="200000" step="1000" value="${c.maxContextLength ?? 128000}">`)}
                    </div>

                    <!-- MCP 设置 -->
                    ${Components.sectionTitle('MCP 服务设置')}
                    <div class="card" style="margin-bottom:24px">
                        ${Components.formGroup('启用 MCP', Components.formSwitch('mcpEnabled', '启用 MCP 服务端', c.mcpEnabled))}
                        ${Components.formGroup('MCP 端口', `<input class="form-input" type="number" name="mcpPort" min="1024" max="65535" value="${c.mcpPort ?? 3000}">`)}
                    </div>

                    <!-- 高级设置 -->
                    ${Components.sectionTitle('高级设置')}
                    <div class="card" style="margin-bottom:24px">
                        ${Components.formGroup('日志级别', Components.formSelect('logLevel', [
                            { value: 'debug', label: 'Debug' },
                            { value: 'info', label: 'Info' },
                            { value: 'warn', label: 'Warn' },
                            { value: 'error', label: 'Error' },
                        ], c.logLevel || 'info'))}
                        ${Components.formGroup('调试模式', Components.formSwitch('debugMode', '启用详细日志和调试信息', c.debugMode))}
                    </div>

                    <!-- 操作按钮 -->
                    <div style="display:flex;gap:12px;justify-content:flex-end">
                        <button class="btn btn-ghost" onclick="ConfigPage.resetConfig()">重置默认</button>
                        <button class="btn btn-primary" onclick="ConfigPage.saveConfig()">保存配置</button>
                    </div>
                </div>
            </div>
        `;
    }

    function collectFormData() {
        const form = document.querySelector('#contentBody');
        if (!form) return {};

        const config = {
            model: form.querySelector('[name="model"]')?.value,
            temperature: parseFloat(form.querySelector('[name="temperature"]')?.value),
            maxTokens: parseInt(form.querySelector('[name="maxTokens"]')?.value),
            systemPrompt: form.querySelector('[name="systemPrompt"]')?.value,
            enabledToolsets: [],
            memoryEnabled: form.querySelector('[name="memoryEnabled"]')?.checked,
            autoSaveMemory: form.querySelector('[name="autoSaveMemory"]')?.checked,
            maxContextLength: parseInt(form.querySelector('[name="maxContextLength"]')?.value),
            mcpEnabled: form.querySelector('[name="mcpEnabled"]')?.checked,
            mcpPort: parseInt(form.querySelector('[name="mcpPort"]')?.value),
            logLevel: form.querySelector('[name="logLevel"]')?.value,
            debugMode: form.querySelector('[name="debugMode"]')?.checked,
        };

        // 收集工具集
        ['filesystem', 'system', 'web', 'creative', 'memory', 'skills', 'mcp'].forEach(ts => {
            const checkbox = form.querySelector(`[name="toolset_${ts}"]`);
            if (checkbox && checkbox.checked) {
                config.enabledToolsets.push(ts);
            }
        });

        return config;
    }

    async function saveConfig() {
        const config = collectFormData();

        try {
            await API.config.save(config);
            _config = config;
            Components.Toast.success('配置已保存');
        } catch (err) {
            Components.Toast.error(`保存失败: ${err.message}`);
        }
    }

    async function resetConfig() {
        if (!confirm('确定要重置为默认配置吗？')) return;

        try {
            await API.config.reset();
            Components.Toast.success('配置已重置');
            render();
        } catch (err) {
            Components.Toast.error(`重置失败: ${err.message}`);
        }
    }

    function bindEvents() {}

    function init() {}

    return { render, init, saveConfig, resetConfig };
})();
