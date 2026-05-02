/**
 * MCP 服务 Tab - 配置生成器
 * 包含各 IDE/编辑器的 MCP 配置模板和 System Prompt
 */

const MCPConfig = (() => {
    function getConfigs() {
        const baseUrl = window.location.origin;
        return {
            trae: {
                label: 'Trae',
                icon: Components.icon('zap', 16),
                description: 'Trae IDE 内置 MCP 客户端',
                config: JSON.stringify({ mcpServers: { hermes: { url: `${baseUrl}/mcp` } } }, null, 2),
                steps: ['打开 Trae → 设置 → MCP', '点击「添加 MCP Server」', '粘贴上方 JSON 配置', '重启 Trae 使配置生效'],
            },
            claude: {
                label: 'Claude Desktop',
                icon: Components.icon('bot', 16),
                description: 'Claude 桌面版 MCP 客户端',
                config: JSON.stringify({ mcpServers: { hermes: { url: `${baseUrl}/mcp`, type: 'streamable-http' } } }, null, 2),
                steps: ['打开 Claude Desktop 配置文件', '路径: ~/Library/Application Support/Claude/claude_desktop_config.json', '粘贴上方 JSON 配置', '重启 Claude Desktop'],
            },
            vscode: {
                label: 'VS Code (Copilot)',
                icon: Components.icon('monitor', 16),
                description: 'VS Code + GitHub Copilot MCP',
                config: JSON.stringify({ servers: { hermes: { url: `${baseUrl}/mcp`, type: 'streamable-http' } } }, null, 2),
                steps: ['打开 VS Code 设置 (JSON)', '添加 mcp.servers 配置', '粘贴上方 JSON 配置', '重新加载窗口'],
            },
            cursor: {
                label: 'Cursor',
                icon: Components.icon('monitor', 16),
                description: 'Cursor IDE MCP 客户端',
                config: JSON.stringify({ mcpServers: { hermes: { url: `${baseUrl}/mcp` } } }, null, 2),
                steps: ['打开 Cursor → Settings → MCP', '点击「Add MCP Server」', '粘贴上方 JSON 配置', '重启 Cursor'],
            },
        };
    }

    function getSystemPrompt() {
        return `你连接了 Hermes Agent MCP 服务。每次对话时请遵循以下规则：

1. 新话题开始时，调用 create_session 创建会话：
   - title: 话题摘要（简洁明了）
   - source: "trae"（或其他客户端名称）

2. 用户发消息后，调用 log_conversation 记录：
   - role: "user"
   - content: 用户消息原文
   - session_id: 当前会话ID

3. 你回复后，调用 log_conversation 记录：
   - role: "assistant"
   - content: 回复摘要（精简到 2-3 句，保留关键信息）
   - session_id: 当前会话ID

4. 遇到以下重要信息时，调用 write_memory 更新记忆：
   - 用户偏好（语言、框架、工具）
   - 项目信息（名称、技术栈、架构）
   - 重要决策（方案选择、设计约定）
   - 错误解决方案（bug 和修复方法）
   - 待办事项（用户提到的后续任务）

5. MCP 调用失败时静默忽略，不影响正常对话流程。`;
    }

    function buildConfigSection(configTab, configs) {
        const configTabKeys = Object.keys(configs);
        const configTabHtml = `<div style="display:flex;gap:4px;margin-bottom:12px;flex-wrap:wrap">
            ${configTabKeys
                .map(
                    (k) => `<button type="button" class="btn btn-sm ${configTab === k ? 'btn-primary' : 'btn-ghost'}" data-action="switchConfigTab" data-tab="${k}">${configs[k].icon} ${configs[k].label}</button>`,
                )
                .join('')}
            <button type="button" class="btn btn-sm ${configTab === 'prompt' ? 'btn-primary' : 'btn-ghost'}" data-action="switchConfigTab" data-tab="prompt">${Components.icon('clipboard', 14)} System Prompt</button>
        </div>`;

        let configContentHtml = '';
        if (configTab === 'prompt') {
            const prompt = getSystemPrompt();
            configContentHtml = Components.renderSection(
                'System Prompt 模板',
                `<p style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">将以下内容添加到 Trae / Claude / Cursor 的 System Prompt 或自定义指令中：</p>
                <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                    <button type="button" class="btn btn-sm btn-ghost" data-action="copyPrompt">${Components.icon('clipboard', 14)} 复制 Prompt</button>
                </div>
                <div class="schema-display" id="systemPromptDisplay" style="white-space:pre-wrap;font-size:13px;line-height:1.7">${Components.escapeHtml(prompt)}</div>`,
            );
        } else {
            const cfg = configs[configTab];
            if (cfg) {
                configContentHtml = Components.renderSection(
                    `${cfg.icon} ${cfg.label} 配置`,
                    `<p style="font-size:12px;color:var(--text-tertiary);margin-bottom:12px">${cfg.description}</p>
                    <div style="display:flex;justify-content:flex-end;margin-bottom:8px">
                        <button type="button" class="btn btn-sm btn-ghost" data-action="copyConfig">${Components.icon('clipboard', 14)} 复制配置</button>
                    </div>
                    <div class="schema-display" id="configDisplay">${Components.escapeHtml(cfg.config)}</div>
                    <div style="margin-top:16px">
                        <div style="font-size:13px;font-weight:600;margin-bottom:8px">配置步骤</div>
                        <ol style="margin:0;padding-left:20px;font-size:12px;color:var(--text-secondary);line-height:2">
                            ${cfg.steps.map((st) => `<li>${st}</li>`).join('')}
                        </ol>
                    </div>`,
                );
            }
        }

        return Components.renderSection('连接配置', `${configTabHtml}${configContentHtml}`);
    }

    return { getConfigs, getSystemPrompt, buildConfigSection };
})();

export default MCPConfig;
