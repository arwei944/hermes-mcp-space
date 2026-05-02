/**
 * Knowledge Base Page - Review Tab
 * Review queue with status filters, batch actions, selection
 */

import KnowledgeUtils from './utils.js';

const ReviewTab = (() => {
    let _data = [];
    let _stats = {};
    let _filter = 'pending';
    let _selectedReviews = new Set();

    function getFilter() {
        return _filter;
    }

    function setFilter(filter) {
        _filter = filter;
    }

    function getSelectedReviews() {
        return _selectedReviews;
    }

    function clearSelectedReviews() {
        _selectedReviews.clear();
    }

    async function load(contentEl) {
        const [items, stats] = await Promise.allSettled([
            API.get('/api/reviews', { status: 'pending', limit: 50 }),
            API.get('/api/reviews/stats'),
        ]);

        _data = items.status === 'fulfilled' ? (items.value || []) : [];
        _stats = stats.status === 'fulfilled' ? (stats.value || {}) : {};
        _selectedReviews.clear();

        contentEl.innerHTML = buildContent();
    }

    function buildContent() {
        const statuses = ['pending', 'approved', 'rejected'];
        const statusLabels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        statuses.forEach(function (s) {
            html += '<button class="filter-btn ' + (_filter === s ? 'active' : '') + '" data-action="filterReviews" data-filter="' + s + '">' + statusLabels[s] + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">';
        html += '<span>' + (_data || []).length + ' 条审核</span>';
        if (_selectedReviews.size > 0) {
            html += '<span style="margin-left:8px;color:var(--accent)">' + _selectedReviews.size + ' 已选择</span>';
        }
        html += '</div>';
        html += '</div>';

        // Batch actions
        if (_filter === 'pending' && _data.length > 0) {
            html += '<div style="display:flex;gap:8px;margin-bottom:12px">';
            html += '<button class="btn-success" data-action="batchApprove">' + Components.icon('check', 12) + ' 批量通过</button>';
            html += '<button class="btn-danger" data-action="batchReject">' + Components.icon('x', 12) + ' 批量拒绝</button>';
            html += '</div>';
        }

        const filtered = _filter === 'all' ? _data : _data.filter(function (r) {
            return (r.status || 'pending') === _filter;
        });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无审核记录</div>';
            return html;
        }

        html += '<div class="reviews-list">';
        filtered.forEach(function (item) {
            const id = item.id || item._id;
            html += _buildCard(item, id);
        });
        html += '</div>';
        return html;
    }

    function _buildCard(item, id) {
        const status = item.status || 'pending';
        const reviewType = item.type || item.action_type || 'update';
        const confidence = item.confidence || '';
        const reason = item.reason || '';
        const context = item.context || '';
        const content = item.content || item.new_content || '';
        const title = item.title || ('Review #' + String(id));
        const createdAt = KnowledgeUtils.formatTime(item.created_at);
        const isSelected = _selectedReviews.has(String(id));
        const esc = KnowledgeUtils.escapeHtml;

        const statusClass = status === 'approved' ? 'review-approved' : status === 'rejected' ? 'review-rejected' : 'review-pending';

        let html = '<div class="review-card ' + statusClass + '" data-id="' + esc(String(id)) + '">';
        html += '<div class="review-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="review-type">' + esc(reviewType) + '</span>';
        if (confidence) html += '<span class="review-confidence">置信度: ' + esc(String(confidence)) + '</span>';
        html += '<span class="review-time">' + createdAt + '</span>';
        html += '</div>';
        html += '</div>';
        html += '<div class="review-title">' + esc(title) + '</div>';
        if (reason) {
            html += '<div class="review-reason">' + esc(reason) + '</div>';
        }
        if (context) {
            html += '<div class="review-context">' + esc(KnowledgeUtils.truncate(context, 300)) + '</div>';
        }
        if (content) {
            html += '<div class="review-content">' + esc(KnowledgeUtils.truncate(content, 200)) + '</div>';
        }

        if (status === 'pending') {
            html += '<div class="review-actions">';
            html += '<label class="review-checkbox"><input type="checkbox" data-action="toggleReviewSelect" data-id="' + esc(String(id)) + '" ' + (isSelected ? 'checked' : '') + ' /> 全选</label>';
            html += '<button class="btn-success" data-action="approveReview" data-id="' + esc(String(id)) + '">' + Components.icon('check', 12) + ' 通过</button>';
            html += '<button class="btn-danger" data-action="rejectReview" data-id="' + esc(String(id)) + '">' + Components.icon('x', 12) + ' 拒绝</button>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // Review actions
    async function approveReview(id) {
        try {
            await API.put('/api/reviews/' + id + '/approve');
            KnowledgeUtils.showToast('审核已通过', 'success');
            return true;
        } catch (err) {
            KnowledgeUtils.showToast('通过失败: ' + (err.message || '未知错误'), 'error');
            return false;
        }
    }

    async function rejectReview(id) {
        try {
            await API.put('/api/reviews/' + id + '/reject', {});
            KnowledgeUtils.showToast('审核已拒绝', 'success');
            return true;
        } catch (err) {
            KnowledgeUtils.showToast('拒绝失败: ' + (err.message || '未知错误'), 'error');
            return false;
        }
    }

    async function batchApprove() {
        if (_selectedReviews.size === 0) {
            KnowledgeUtils.showToast('未选择审核条目', 'warning');
            return false;
        }

        const ids = Array.from(_selectedReviews);

        if (Components && Components.Modal && Components.Modal.confirm) {
            const confirmed = await Components.Modal.confirm({
                title: '批量通过',
                message: '确定要通过 ' + ids.length + ' 条审核吗？',
                confirmText: '全部通过',
                type: 'info',
            });
            if (!confirmed) return false;
        } else if (typeof showConfirmDialog === 'function') {
            showConfirmDialog('批量通过', '通过 ' + ids.length + ' 条审核？', async function () {
                await _doBatchApprove(ids);
            });
            return false;
        } else {
            if (!confirm('通过 ' + ids.length + ' 条审核？')) return false;
        }

        return await _doBatchApprove(ids);
    }

    async function _doBatchApprove(ids) {
        try {
            await API.post('/api/reviews/batch/approve', { ids: ids });
            KnowledgeUtils.showToast(ids.length + ' 条审核已通过', 'success');
            _selectedReviews.clear();
            return true;
        } catch (err) {
            KnowledgeUtils.showToast('批量通过失败: ' + (err.message || '未知错误'), 'error');
            return false;
        }
    }

    async function batchReject() {
        if (_selectedReviews.size === 0) {
            KnowledgeUtils.showToast('未选择审核条目', 'warning');
            return false;
        }

        const ids = Array.from(_selectedReviews);

        if (Components && Components.Modal && Components.Modal.confirm) {
            const confirmed = await Components.Modal.confirm({
                title: '批量拒绝',
                message: '确定要拒绝 ' + ids.length + ' 条审核吗？',
                confirmText: '全部拒绝',
                type: 'danger',
            });
            if (!confirmed) return false;
        } else if (typeof showConfirmDialog === 'function') {
            showConfirmDialog('批量拒绝', '拒绝 ' + ids.length + ' 条审核？', async function () {
                await _doBatchReject(ids);
            });
            return false;
        } else {
            if (!confirm('拒绝 ' + ids.length + ' 条审核？')) return false;
        }

        return await _doBatchReject(ids);
    }

    async function _doBatchReject(ids) {
        try {
            await API.post('/api/reviews/batch/reject', { ids: ids });
            KnowledgeUtils.showToast(ids.length + ' 条审核已拒绝', 'success');
            _selectedReviews.clear();
            return true;
        } catch (err) {
            KnowledgeUtils.showToast('批量拒绝失败: ' + (err.message || '未知错误'), 'error');
            return false;
        }
    }

    function toggleReviewSelect(id) {
        const idStr = String(id);
        if (_selectedReviews.has(idStr)) {
            _selectedReviews.delete(idStr);
        } else {
            _selectedReviews.add(idStr);
        }

        // Update the info display
        const infoEl = document.querySelector('.tab-info');
        if (infoEl) {
            let infoHtml = '<span>' + (_data || []).length + ' 条审核</span>';
            if (_selectedReviews.size > 0) {
                infoHtml += '<span style="margin-left:8px;color:var(--accent)">' + _selectedReviews.size + ' 已选择</span>';
            }
            infoEl.innerHTML = infoHtml;
        }
    }

    function destroy() {
        _data = [];
        _stats = {};
        _filter = 'pending';
        _selectedReviews.clear();
    }

    return {
        getFilter, setFilter, getSelectedReviews, clearSelectedReviews,
        load, buildContent, approveReview, rejectReview,
        batchApprove, batchReject, toggleReviewSelect, destroy,
    };
})();

export default ReviewTab;
