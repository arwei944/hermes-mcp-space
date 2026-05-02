/**
 * Knowledge Base Page - Rules Tab
 * Rules list with category filters, card rendering
 */

import KnowledgeUtils from './utils.js';

const RulesTab = (() => {
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
            API.get('/api/rules', { limit: 100 }),
            API.get('/api/rules/stats'),
        ]);

        _data = items.status === 'fulfilled' ? (items.value || []) : [];
        _stats = stats.status === 'fulfilled' ? (stats.value || {}) : {};

        contentEl.innerHTML = buildContent();
    }

    function buildContent() {
        const categories = ['all'];
        const catSet = new Set();
        (_data || []).forEach(function (r) {
            if (r.category) catSet.add(r.category);
        });
        catSet.forEach(function (c) { categories.push(c); });

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        categories.forEach(function (cat) {
            html += '<button class="filter-btn ' + (_filter === cat ? 'active' : '') + '" data-action="filterRules" data-filter="' + KnowledgeUtils.escapeHtml(cat) + '">' + KnowledgeUtils.escapeHtml(cat === 'all' ? '全部' : cat) + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">' + (_data || []).length + ' 条规则</div>';
        html += '</div>';

        const filtered = _filter === 'all' ? _data : _data.filter(function (r) { return r.category === _filter; });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无规则</div>';
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
        const priority = item.priority || 'medium';
        const category = item.category || 'general';
        const scope = item.scope || '';
        const tags = item.tags || [];
        const title = item.title || 'Untitled Rule';
        const content = item.content || '';
        const preview = KnowledgeUtils.truncate(content, 120);
        const updatedAt = KnowledgeUtils.formatTime(item.updated_at || item.created_at);
        const esc = KnowledgeUtils.escapeHtml;

        let html = '<div class="item-card" data-id="' + esc(String(id)) + '">';
        html += '<div class="item-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="item-category">' + esc(category) + '</span>';
        html += '<span class="item-priority ' + esc(priority) + '">' + esc(priority) + '</span>';
        if (scope) html += '<span class="item-status">' + esc(scope) + '</span>';
        html += '</div>';
        html += '<div class="item-actions">';
        html += '<button data-action="viewItem" data-type="rules" data-id="' + esc(String(id)) + '">' + Components.icon('eye', 12) + '</button>';
        html += '<button data-action="editItem" data-type="rules" data-id="' + esc(String(id)) + '">' + Components.icon('edit', 12) + '</button>';
        html += '<button class="btn-delete" data-action="deleteItem" data-type="rules" data-id="' + esc(String(id)) + '">' + Components.icon('trash', 12) + '</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="item-title" data-action="viewItem" data-type="rules" data-id="' + esc(String(id)) + '">' + esc(title) + '</div>';
        html += '<div class="item-preview">' + esc(preview) + '</div>';
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

export default RulesTab;
