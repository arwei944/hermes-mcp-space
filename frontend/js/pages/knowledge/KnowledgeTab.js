/**
 * Knowledge Base Page - Knowledge Tab
 * Knowledge entries list with category filters, card rendering
 */

import KnowledgeUtils from './utils.js';

const KnowledgeTab = (() => {
    let _data = [];
    let _stats = {};
    let _filter = 'all';

    function getFilter() {
        return _filter;
    }

    function setFilter(filter) {
        _filter = filter;
    }

    async function load(contentEl) {
        const [items, stats] = await Promise.allSettled([
            API.get('/api/knowledge/items', { limit: 100 }),
            API.get('/api/knowledge/items/stats'),
        ]);

        _data = items.status === 'fulfilled' ? (items.value || []) : [];
        _stats = stats.status === 'fulfilled' ? (stats.value || {}) : {};

        contentEl.innerHTML = buildContent();
    }

    function buildContent() {
        const categories = ['all'];
        const catSet = new Set();
        (_data || []).forEach(function (k) {
            if (k.category) catSet.add(k.category);
        });
        catSet.forEach(function (c) { categories.push(c); });

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        categories.forEach(function (cat) {
            html += '<button class="filter-btn ' + (_filter === cat ? 'active' : '') + '" data-action="filterKnowledge" data-filter="' + KnowledgeUtils.escapeHtml(cat) + '">' + KnowledgeUtils.escapeHtml(cat === 'all' ? '全部' : cat) + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">' + (_data || []).length + ' 条知识</div>';
        html += '</div>';

        const filtered = _filter === 'all' ? _data : _data.filter(function (k) { return k.category === _filter; });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无知识条目</div>';
            return html;
        }

        html += '<div class="items-list">';
        filtered.forEach(function (item) {
            const id = item.id || item._id;
            html += _buildCard(item, id);
        });
        html += '</div>';
        return html;
    }

    function _buildCard(item, id) {
        const category = item.category || 'general';
        const tags = item.tags || [];
        const title = item.title || 'Untitled';
        const content = item.content || '';
        const summary = item.summary || '';
        const confidence = item.confidence || '';
        const source = item.source || '';
        const updatedAt = KnowledgeUtils.formatTime(item.updated_at || item.created_at);
        const esc = KnowledgeUtils.escapeHtml;

        let html = '<div class="item-card" data-id="' + esc(String(id)) + '">';
        html += '<div class="item-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="item-category">' + esc(category) + '</span>';
        if (confidence) html += '<span class="item-confidence">' + esc(confidence) + '</span>';
        if (source) html += '<span class="item-access">' + esc(source) + '</span>';
        html += '</div>';
        html += '<div class="item-actions">';
        html += '<button data-action="viewItem" data-type="knowledge" data-id="' + esc(String(id)) + '">' + Components.icon('eye', 12) + '</button>';
        html += '<button data-action="editItem" data-type="knowledge" data-id="' + esc(String(id)) + '">' + Components.icon('edit', 12) + '</button>';
        html += '<button class="btn-delete" data-action="deleteItem" data-type="knowledge" data-id="' + esc(String(id)) + '">' + Components.icon('trash', 12) + '</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="item-title" data-action="viewItem" data-type="knowledge" data-id="' + esc(String(id)) + '">' + esc(title) + '</div>';
        if (summary) {
            html += '<div class="item-summary">' + esc(summary) + '</div>';
        } else {
            html += '<div class="item-preview">' + esc(KnowledgeUtils.truncate(content, 120)) + '</div>';
        }
        if (tags.length > 0) {
            html += '<div class="item-tags">';
            tags.forEach(function (t) { html += '<span class="tag">' + esc(t) + '</span>'; });
            html += '</div>';
        }
        html += '<div class="item-meta"><span>' + updatedAt + '</span></div>';
        html += '</div>';
        return html;
    }

    function destroy() {
        _data = [];
        _stats = {};
        _filter = 'all';
    }

    return { getFilter, setFilter, load, buildContent, destroy };
})();

export default KnowledgeTab;
