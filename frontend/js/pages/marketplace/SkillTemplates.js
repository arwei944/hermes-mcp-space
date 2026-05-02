/**
 * 技能管理 Tab - 模板库
 * 包含内置技能模板和模板选择 Modal
 */

const SkillTemplates = (() => {
    const SKILL_TEMPLATES = [
        { name: 'batch-rename', category: '文件操作', description: '批量重命名文件', content: '# 批量重命名\n\n## 描述\n批量重命名指定目录下的文件，支持正则表达式匹配。\n\n## 使用方法\n1. 指定目标目录\n2. 设置匹配规则（正则表达式）\n3. 设置替换模板\n4. 预览变更后确认执行\n\n## 参数\n- `directory`: 目标目录路径\n- `pattern`: 文件名匹配模式\n- `replacement`: 替换模板\n- `dry_run`: 预览模式（默认 true）\n\n## 注意事项\n- 建议先使用 dry_run 预览\n- 操作不可撤销，请确保有备份' },
        { name: 'log-analyzer', category: '文件操作', description: '日志分析工具', content: '# 日志分析\n\n## 描述\n分析日志文件，提取关键信息、统计错误和警告。\n\n## 功能\n- 按时间范围过滤\n- 错误/警告级别统计\n- 频率 Top N 分析\n- 正则模式匹配\n\n## 使用方法\n1. 指定日志文件路径\n2. 设置过滤条件\n3. 查看分析报告' },
        { name: 'web-monitor', category: 'Web 操作', description: '网页内容监控', content: '# 网页监控\n\n## 描述\n定期检查网页内容变化，发现更新时发送通知。\n\n## 配置\n- `url`: 监控的网页地址\n- `selector`: CSS 选择器（可选）\n- `interval`: 检查间隔（分钟）\n- `keyword`: 关键词过滤（可选）' },
        { name: 'api-tester', category: 'Web 操作', description: 'API 接口测试', content: '# API 测试\n\n## 描述\n快速测试 REST API 接口，支持多种 HTTP 方法。\n\n## 功能\n- GET/POST/PUT/DELETE 请求\n- 自定义 Headers\n- JSON Body 编辑\n- 响应格式化展示\n- 请求历史记录' },
        { name: 'csv-processor', category: '数据处理', description: 'CSV 数据处理', content: '# CSV 处理\n\n## 描述\n读取、过滤、转换和导出 CSV 数据。\n\n## 功能\n- 读取 CSV/TSV 文件\n- 列过滤和排序\n- 数据清洗（去重、空值处理）\n- 格式转换（CSV ↔ JSON）\n- 聚合统计' },
        { name: 'json-formatter', category: '数据处理', description: 'JSON 格式化工具', content: '# JSON 格式化\n\n## 描述\n格式化、验证和转换 JSON 数据。\n\n## 功能\n- 美化/压缩 JSON\n- JSON Schema 验证\n- JSON ↔ YAML 转换\n- JSON Path 查询\n- Diff 对比' },
        { name: 'health-check', category: '系统管理', description: '系统健康检查', content: '# 系统健康检查\n\n## 描述\n检查系统运行状态，包括 CPU、内存、磁盘、网络等。\n\n## 检查项\n- CPU 使用率\n- 内存使用情况\n- 磁盘空间\n- 网络连通性\n- 进程状态\n- 服务可用性' },
        { name: 'backup-manager', category: '系统管理', description: '备份管理工具', content: '# 备份管理\n\n## 描述\n管理文件和数据库的备份任务。\n\n## 功能\n- 创建备份任务\n- 定时自动备份\n- 备份版本管理\n- 一键恢复\n- 备份空间清理' },
    ];

    function getTemplates() {
        return SKILL_TEMPLATES;
    }

    function getCategories(skills) {
        const categories = new Set(skills.map((s) => s.category || '未分类').filter(Boolean));
        SKILL_TEMPLATES.forEach((t) => categories.add(t.category));
        return Array.from(categories).sort();
    }

    function findTemplate(name) {
        return SKILL_TEMPLATES.find((t) => t.name === name);
    }

    function showTemplateLibrary(onUseTemplate) {
        const categories = [...new Set(SKILL_TEMPLATES.map((t) => t.category))].sort();
        const modalHtml = `<div class="modal-overlay" data-action="hideTemplateLibrary">
            <div class="modal" style="max-width:700px;width:90%;max-height:80vh;overflow-y:auto" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>技能模板库</h3>
                    <button type="button" class="modal-close" data-action="hideTemplateLibrary">${Components.icon('x', 14)}</button>
                </div>
                <div class="modal-body">
                    <p style="font-size:12px;color:var(--text-tertiary);margin-bottom:16px">选择一个模板快速创建技能，内容将预填到编辑器中。</p>
                    ${categories
                        .map(
                            (cat) => `<div style="margin-bottom:16px">
                                <h4 style="font-size:13px;font-weight:600;margin-bottom:8px;color:var(--text-secondary)">${Components.escapeHtml(cat)}</h4>
                                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">
                                    ${SKILL_TEMPLATES.filter((t) => t.category === cat)
                                        .map(
                                            (t) => `<div class="template-card" data-action="useTemplate" data-template="${Components.escapeHtml(t.name)}" style="padding:12px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer;transition:border-color 0.2s">
                                            <div style="font-weight:500;font-size:13px;margin-bottom:4px">${Components.escapeHtml(t.name)}</div>
                                            <div style="font-size:11px;color:var(--text-tertiary)">${Components.escapeHtml(t.description)}</div>
                                        </div>`,
                                        )
                                        .join('')}
                                </div>
                            </div>`,
                        )
                        .join('')}
                </div>
            </div>
        </div>`;
        const container = document.getElementById('contentBody');
        if (container) {
            const div = document.createElement('div');
            div.id = 'templateLibraryModal';
            div.innerHTML = modalHtml;

            // 绑定模板库内部事件
            div.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action]');
                if (!btn) return;
                if (btn.dataset.action === 'hideTemplateLibrary') {
                    div.remove();
                } else if (btn.dataset.action === 'useTemplate') {
                    div.remove();
                    if (onUseTemplate) onUseTemplate(btn.dataset.template);
                }
            });

            container.appendChild(div);
        }
    }

    return { getTemplates, getCategories, findTemplate, showTemplateLibrary };
})();

export default SkillTemplates;
