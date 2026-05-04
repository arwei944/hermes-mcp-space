/**
 * Knowledge Base Page - Experience Tab
 * Experience/learnings list with category filters, card rendering
 */

import KnowledgeUtils from './utils.js';

const ExperienceTab = (() => {
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
            API.get('/api/experiences', { limit: 100 }),
            API.get('/api/experiences/stats'),
        ]);

        _data = items.status === 'fulfilled' ? (items.value?.data || items.value || []) : [];
        _stats = stats.status === 'fulfilled' ? (stats.value?.data || stats.value || {}) : {};

        contentEl.innerHTML = buildContent();
    }

    function buildContent() {
        const categories = ['all'];
        const catSet = new Set();
        (_data || []).forEach(function (e) {
            if (e.category) catSet.add(e.category);
        });
        catSet.forEach(function (c) { categories.push(c); });

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        categories.forEach(function (cat) {
            html += '<button class="filter-btn ' + (_filter === cat ? 'active' : '') + '" data-action="filterExperiences" data-filter="' + KnowledgeUtils.escapeHtml(cat) + '">' + KnowledgeUtils.escapeHtml(cat === 'all' ? '全部' : cat) + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">' + (_data || []).length + ' 条经验</div>';
        html += '</div>';

        const filtered = _filter === 'all' ? _data : _data.filter(function (e) { return e.category === _filter; });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无经验</div>';
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
        const severity = item.severity || 'medium';
        const toolName = item.tool_name || '';
        const errorType = item.error_type || '';
        const tags = item.tags || [];
        const title = item.title || 'Untitled Experience';
        const content = item.content || '';
        const updatedAt = KnowledgeUtils.formatTime(item.updated_at || item.created_at);
        const esc = KnowledgeUtils.escapeHtml;

        let html = '<div class="item-card" data-id="' + esc(String(id)) + '">';
        html += '<div class="item-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="item-category">' + esc(category) + '</span>';
        html += '<span class="item-severity ' + esc(severity) + '">' + esc(severity) + '</span>';
        if (toolName) html += '<span class="item-tool">' + esc(toolName) + '</span>';
        if (errorType) html += '<span class="item-status">' + esc(errorType) + '</span>';
        html += '</div>';
        html += '<div class="item-actions">';
        html += '<button data-action="viewItem" data-type="experiences" data-id="' + esc(String(id)) + '">' + Components.icon('eye', 12) + '</button>';
        html += '<button data-action="editItem" data-type="experiences" data-id="' + esc(String(id)) + '">' + Components.icon('edit', 12) + '</button>';
        html += '<button class="btn-delete" data-action="deleteItem" data-type="experiences" data-id="' + esc(String(id)) + '">' + Components.icon('trash', 12) + '</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="item-title" data-action="viewItem" data-type="experiences" data-id="' + esc(String(id)) + '">' + esc(title) + '</div>';
        html += '<div class="item-preview">' + esc(KnowledgeUtils.truncate(content, 120)) + '</div>';
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

export default ExperienceTab;
