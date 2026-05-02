/**
 * Knowledge Base Page - Create Form
 * Create dialog form building and submission via Dialogs.showModal
 */

import KnowledgeUtils from './utils.js';
import KnowledgeModal from './Modal.js';
import KnowledgeDialogs from './Dialogs.js';

const KnowledgeForms = (() => {
    // ==========================================
    // Create Dialog
    // ==========================================
    function showCreateDialog(type) {
        const typeLabels = {
            rules: '创建规则',
            knowledge: '创建知识',
            experiences: '创建经验',
            memories: '创建记忆',
        };

        const title = typeLabels[type] || '创建条目';
        const formHtml = _buildCreateForm(type);

        KnowledgeModal.showModal(title, formHtml, async function (modalOverlay) {
            const data = KnowledgeDialogs.collectFormData(type, modalOverlay);
            if (!data) return false;

            try {
                switch (type) {
                    case 'rules':
                        await API.post('/api/rules', data);
                        break;
                    case 'knowledge':
                        await API.post('/api/knowledge/items', data);
                        break;
                    case 'experiences':
                        await API.post('/api/experiences', data);
                        break;
                    case 'memories':
                        await API.post('/api/memories', data);
                        break;
                    default:
                        KnowledgeUtils.showToast('未知类型: ' + type, 'error');
                        return false;
                }
                KnowledgeUtils.showToast('创建成功', 'success');
                return true;
            } catch (err) {
                KnowledgeUtils.showToast('创建失败: ' + (err.message || '未知错误'), 'error');
                return false;
            }
        });
    }

    function _buildCreateForm(type) {
        let html = '';
        const esc = KnowledgeUtils.escapeHtml;

        switch (type) {
            case 'rules':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" placeholder="规则标题" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" placeholder="规则内容..." required></textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" placeholder="例如: 行为, 安全" /></div>';
                html += '<div class="form-group"><label class="form-label">优先级</label>';
                html += '<select class="modal-select" name="priority">';
                html += '<option value="low">低</option><option value="medium" selected>中</option><option value="high">高</option>';
                html += '</select></div></div>';
                html += '<div class="form-group"><label class="form-label">作用域</label>';
                html += '<input class="modal-input" name="scope" placeholder="例如: 全局, 会话" /></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" placeholder="标签1, 标签2, 标签3" /></div>';
                break;

            case 'knowledge':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" placeholder="知识标题" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" placeholder="知识内容..." required></textarea></div>';
                html += '<div class="form-group"><label class="form-label">摘要</label>';
                html += '<textarea class="modal-textarea" name="summary" placeholder="简要摘要..." style="min-height:60px"></textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" placeholder="例如: 技术, 流程" /></div>';
                html += '<div class="form-group"><label class="form-label">来源</label>';
                html += '<input class="modal-input" name="source" placeholder="例如: 手动, 自动提取" /></div></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" placeholder="标签1, 标签2, 标签3" /></div>';
                break;

            case 'experiences':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" placeholder="经验标题" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" placeholder="学到了什么..." required></textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" placeholder="例如: 错误, 优化" /></div>';
                html += '<div class="form-group"><label class="form-label">严重度</label>';
                html += '<select class="modal-select" name="severity">';
                html += '<option value="low">低</option><option value="medium" selected>中</option><option value="high">高</option>';
                html += '</select></div></div>';
                html += '<div class="form-group"><label class="form-label">上下文</label>';
                html += '<textarea class="modal-textarea" name="context" placeholder="上下文或背景..." style="min-height:60px"></textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">工具名</label>';
                html += '<input class="modal-input" name="tool_name" placeholder="相关工具" /></div>';
                html += '<div class="form-group"><label class="form-label">错误类型</label>';
                html += '<input class="modal-input" name="error_type" placeholder="错误分类" /></div></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" placeholder="标签1, 标签2, 标签3" /></div>';
                break;

            case 'memories':
                html += '<div class="form-group"><label class="form-label">标题</label>';
                html += '<input class="modal-input" name="title" placeholder="记忆标题" /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" placeholder="记忆内容..." required></textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" placeholder="例如: 偏好, 事实" /></div>';
                html += '<div class="form-group"><label class="form-label">重要性</label>';
                html += '<select class="modal-select" name="importance">';
                html += '<option value="low">低</option><option value="medium" selected>中</option><option value="high">高</option>';
                html += '</select></div></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" placeholder="标签1, 标签2, 标签3" /></div>';
                break;

            default:
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" placeholder="标题" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" placeholder="内容..." required></textarea></div>';
        }

        return html;
    }

    return { showCreateDialog };
})();

export default KnowledgeForms;
