/**
 * 关于页面 - 技术栈 Tab
 */

const TechStackTab = (() => {
    let _destroyed = false;

    function buildTechStackTab() {
        const techGroups = [
            {
                title: '后端',
                icon: 'server',
                items: ['Python 3.10+', 'FastAPI', 'Gradio', 'Uvicorn'],
            },
            {
                title: '前端',
                icon: 'monitor',
                items: ['Vanilla JS (IIFE 模块)', 'CSS Variables', 'SSE 实时通信'],
            },
            {
                title: '存储',
                icon: 'database',
                items: ['Git 持久化', 'HF Buckets'],
            },
            {
                title: 'AI',
                icon: 'brain',
                items: ['MCP Protocol (JSON-RPC)', 'Multi-agent 架构'],
            },
            {
                title: '部署',
                icon: 'cloud',
                items: ['HuggingFace Spaces', 'Docker 支持'],
            },
        ];

        return `<div style="max-width:960px">
            ${Components.sectionTitle('技术栈')}
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
                ${techGroups.map((group) => `
                    ${Components.renderSection(
                        '',
                        `
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                            <span>${Components.icon(group.icon, 18)}</span>
                            <span style="font-weight:600;font-size:14px">${group.title}</span>
                        </div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px">
                            ${group.items.map((item) => `
                                <span style="padding:4px 10px;background:var(--bg-secondary);border:1px solid var(--border);border-radius:var(--radius-tag);font-size:12px;color:var(--text-secondary)">${item}</span>
                            `).join('')}
                        </div>
                    `,
                    )}
                `).join('')}
            </div>
        </div>`;
    }

    function render(containerSelector) {
        _destroyed = false;
        const container = document.querySelector(containerSelector);
        if (!container) return;
        container.innerHTML = buildTechStackTab();
    }

    function destroy() {
        _destroyed = true;
    }

    return { render, destroy };
})();

export default TechStackTab;
