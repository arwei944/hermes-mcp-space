/**
 * Knowledge Base Page - Dialogs
 * View, Edit, Delete, Rebuild Index, Collect Form Data
 */
import KnowledgeUtils from './utils.js';
import KnowledgeModal from './Modal.js';

const KnowledgeDialogs = (() => {
    // View Item
    async function viewItem(type, id) {
        let endpoint = '';
        switch (type) {
            case 'rules': endpoint = '/api/rules/' + id; break;
            case 'knowledge': endpoint = '/api/knowledge/items/' + id; break;
            case 'experiences': endpoint = '/api/experiences/' + id; break;
            case 'memories': endpoint = '/api/memories/' + id; break;
            default: KnowledgeUtils.showToast('未知类型', 'error'); return;
        }

        let item = null;
        try { item = await API.get(endpoint); }
        catch (err) { KnowledgeUtils.showToast('加载条目失败: ' + err.message, 'error'); return; }

        if (!item) { KnowledgeUtils.showToast('条目未找到', 'error'); return; }

        const typeLabels = { rules: '规则详情', knowledge: '知识详情', experiences: '经验详情', memories: '记忆详情' };
        KnowledgeModal.showModal(typeLabels[type] || '条目详情', _buildItemDetail(item), null, true);
    }

    function _buildItemDetail(item) {
        let html = '<div style="font-size:13px;line-height:1.7">';
        const esc = KnowledgeUtils.escapeHtml;

        if (item.title) html += '<div style="margin-bottom:12px"><strong style="font-size:15px;color:var(--text-primary)">' + esc(item.title) + '</strong></div>';
        if (item.content) html += '<div style="margin-bottom:12px;white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:var(--radius-xs);font-family:var(--font-mono);font-size:12px;line-height:1.6">' + esc(item.content) + '</div>';
        if (item.summary) html += '<div style="margin-bottom:12px"><strong>摘要:</strong><div style="margin-top:4px;color:var(--text-secondary)">' + esc(item.summary) + '</div></div>';
        if (item.context) html += '<div style="margin-bottom:12px"><strong>上下文:</strong><div style="margin-top:4px;color:var(--text-secondary);white-space:pre-wrap">' + esc(item.context) + '</div></div>';

        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';
        ['category', 'priority', 'severity', 'scope', 'source', 'confidence', 'importance', 'tool_name', 'error_type', 'type', 'status'].forEach(function (field) {
            if (item[field]) {
                const label = field.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
                html += '<div><span style="color:var(--text-tertiary);font-size:11px">' + label + ':</span> <span style="font-weight:500">' + esc(String(item[field])) + '</span></div>';
            }
        });
        if (item.created_at) html += '<div><span style="color:var(--text-tertiary);font-size:11px">创建时间:</span> <span>' + KnowledgeUtils.formatTime(item.created_at) + '</span></div>';
        if (item.updated_at) html += '<div><span style="color:var(--text-tertiary);font-size:11px">更新时间:</span> <span>' + KnowledgeUtils.formatTime(item.updated_at) + '</span></div>';
        html += '</div>';

        if (item.tags && item.tags.length > 0) {
            html += '<div style="margin-top:12px;display:flex;gap:4px;flex-wrap:wrap">';
            item.tags.forEach(function (t) { html += '<span class="tag">' + esc(t) + '</span>'; });
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    // Edit Dialog
    async function showEditDialog(type, id) {
        let endpoint = '';
        switch (type) {
            case 'rules': endpoint = '/api/rules/' + id; break;
            case 'knowledge': endpoint = '/api/knowledge/items/' + id; break;
            case 'experiences': endpoint = '/api/experiences/' + id; break;
            case 'memories': endpoint = '/api/memories/' + id; break;
            default: KnowledgeUtils.showToast('未知类型', 'error'); return;
        }

        let item = null;
        try { item = await API.get(endpoint); }
        catch (err) { KnowledgeUtils.showToast('加载条目失败: ' + err.message, 'error'); return; }

        if (!item) { KnowledgeUtils.showToast('条目未找到', 'error'); return; }

        const typeLabels = { rules: '编辑规则', knowledge: '编辑知识', experiences: '编辑经验', memories: '编辑记忆' };
        KnowledgeModal.showModal(typeLabels[type] || '编辑条目', _buildEditForm(type, item), async function (modalOverlay) {
            const data = collectFormData(type, modalOverlay);
            if (!data) return false;
            try {
                await API.put(endpoint, data);
                KnowledgeUtils.showToast('更新成功', 'success');
                return true;
            } catch (err) {
                KnowledgeUtils.showToast('更新失败: ' + (err.message || '未知错误'), 'error');
                return false;
            }
        });
    }

    function _buildEditForm(type, item) {
        let html = '';
        const esc = KnowledgeUtils.escapeHtml;

        switch (type) {
            case 'rules':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + esc(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + esc(item.content || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + esc(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">优先级</label>';
                html += '<select class="modal-select" name="priority">';
                html += '<option value="low"' + (item.priority === 'low' ? ' selected' : '') + '>低</option>';
                html += '<option value="medium"' + (item.priority === 'medium' ? ' selected' : '') + '>中</option>';
                html += '<option value="high"' + (item.priority === 'high' ? ' selected' : '') + '>高</option>';
                html += '</select></div></div>';
                html += '<div class="form-group"><label class="form-label">作用域</label>';
                html += '<input class="modal-input" name="scope" value="' + esc(item.scope || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + esc((item.tags || []).join(', ')) + '" /></div>';
                break;
            case 'knowledge':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + esc(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + esc(item.content || '') + '</textarea></div>';
                html += '<div class="form-group"><label class="form-label">摘要</label>';
                html += '<textarea class="modal-textarea" name="summary" style="min-height:60px">' + esc(item.summary || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + esc(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">来源</label>';
                html += '<input class="modal-input" name="source" value="' + esc(item.source || '') + '" /></div></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + esc((item.tags || []).join(', ')) + '" /></div>';
                break;
            case 'experiences':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + esc(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + esc(item.content || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + esc(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">严重度</label>';
                html += '<select class="modal-select" name="severity">';
                html += '<option value="low"' + (item.severity === 'low' ? ' selected' : '') + '>低</option>';
                html += '<option value="medium"' + (item.severity === 'medium' ? ' selected' : '') + '>中</option>';
                html += '<option value="high"' + (item.severity === 'high' ? ' selected' : '') + '>高</option>';
                html += '</select></div></div>';
                html += '<div class="form-group"><label class="form-label">上下文</label>';
                html += '<textarea class="modal-textarea" name="context" style="min-height:60px">' + esc(item.context || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">工具名</label>';
                html += '<input class="modal-input" name="tool_name" value="' + esc(item.tool_name || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">错误类型</label>';
                html += '<input class="modal-input" name="error_type" value="' + esc(item.error_type || '') + '" /></div></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + esc((item.tags || []).join(', ')) + '" /></div>';
                break;
            case 'memories':
                html += '<div class="form-group"><label class="form-label">标题</label>';
                html += '<input class="modal-input" name="title" value="' + esc(item.title || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + esc(item.content || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + esc(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">重要性</label>';
                html += '<select class="modal-select" name="importance">';
                html += '<option value="low"' + (item.importance === 'low' ? ' selected' : '') + '>低</option>';
                html += '<option value="medium"' + (item.importance === 'medium' ? ' selected' : '') + '>中</option>';
                html += '<option value="high"' + (item.importance === 'high' ? ' selected' : '') + '>高</option>';
                html += '</select></div></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + esc((item.tags || []).join(', ')) + '" /></div>';
                break;
            default:
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + esc(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + esc(item.content || '') + '</textarea></div>';
        }
        return html;
    }

    // Collect Form Data
    function collectFormData(type, modalOverlay) {
        const titleInput = modalOverlay.querySelector('[name="title"]');
        const contentInput = modalOverlay.querySelector('[name="content"]');
        const title = titleInput ? titleInput.value.trim() : '';
        const content = contentInput ? contentInput.value.trim() : '';

        if (!title && !content) {
            KnowledgeUtils.showToast('标题或内容为必填项', 'warning');
            return null;
        }

        const tagsInput = modalOverlay.querySelector('[name="tags"]');
        const tagsRaw = tagsInput ? tagsInput.value.trim() : '';
        const tags = tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];
        const data = { title: title, content: content, tags: tags };

        switch (type) {
            case 'rules': {
                const cat = modalOverlay.querySelector('[name="category"]');
                const pri = modalOverlay.querySelector('[name="priority"]');
                const scope = modalOverlay.querySelector('[name="scope"]');
                data.category = cat ? cat.value.trim() : '';
                data.priority = pri ? pri.value : 'medium';
                data.scope = scope ? scope.value.trim() : '';
                break;
            }
            case 'knowledge': {
                const sum = modalOverlay.querySelector('[name="summary"]');
                const cat = modalOverlay.querySelector('[name="category"]');
                const src = modalOverlay.querySelector('[name="source"]');
                data.summary = sum ? sum.value.trim() : '';
                data.category = cat ? cat.value.trim() : '';
                data.source = src ? src.value.trim() : '';
                break;
            }
            case 'experiences': {
                const cat = modalOverlay.querySelector('[name="category"]');
                const ctx = modalOverlay.querySelector('[name="context"]');
                const tool = modalOverlay.querySelector('[name="tool_name"]');
                const err = modalOverlay.querySelector('[name="error_type"]');
                const sev = modalOverlay.querySelector('[name="severity"]');
                data.category = cat ? cat.value.trim() : '';
                data.context = ctx ? ctx.value.trim() : '';
                data.tool_name = tool ? tool.value.trim() : '';
                data.error_type = err ? err.value.trim() : '';
                data.severity = sev ? sev.value : 'medium';
                break;
            }
            case 'memories': {
                const cat = modalOverlay.querySelector('[name="category"]');
                const imp = modalOverlay.querySelector('[name="importance"]');
                data.category = cat ? cat.value.trim() : '';
                data.importance = imp ? imp.value : 'medium';
                break;
            }
        }
        return data;
    }

    // Delete
    async function confirmDelete(type, id) {
        const typeLabels = { rules: '规则', knowledge: '知识条目', experiences: '经验', memories: '记忆' };
        const label = typeLabels[type] || '条目';

        if (Components && Components.Modal && Components.Modal.confirm) {
            const confirmed = await Components.Modal.confirm({
                title: '删除' + label,
                message: '确定要删除这条' + label + '吗？此操作不可撤销。',
                confirmText: '删除', type: 'danger',
            });
            if (!confirmed) return;
        } else if (typeof showConfirmDialog === 'function') {
            showConfirmDialog('删除' + label, '确定要删除这条' + label + '吗？此操作不可撤销。', async function () { await _doDelete(type, id); });
            return;
        } else {
            if (!confirm('确定删除此' + label + '？')) return;
        }
        await _doDelete(type, id);
    }

    async function _doDelete(type, id) {
        let endpoint = '';
        switch (type) {
            case 'rules': endpoint = '/api/rules/' + id; break;
            case 'knowledge': endpoint = '/api/knowledge/items/' + id; break;
            case 'experiences': endpoint = '/api/experiences/' + id; break;
            case 'memories': endpoint = '/api/memories/' + id; break;
            default: KnowledgeUtils.showToast('未知类型', 'error'); return;
        }
        try {
            await API.del(endpoint);
            KnowledgeUtils.showToast('删除成功', 'success');
        } catch (err) {
            KnowledgeUtils.showToast('删除失败: ' + (err.message || '未知错误'), 'error');
        }
    }

    // Rebuild Search Index
    async function rebuildIndex() {
        KnowledgeUtils.showToast('正在重建搜索索引...', 'info');
        try {
            await API.post('/api/search/index/rebuild');
            KnowledgeUtils.showToast('搜索索引已重建', 'success');
        } catch (err) {
            KnowledgeUtils.showToast('重建失败: ' + (err.message || '未知错误'), 'error');
        }
    }

    return { viewItem, showEditDialog, confirmDelete, rebuildIndex, collectFormData };
})();

export default KnowledgeDialogs;
