/**
 * Knowledge Base Page - Search Bar Component
 * Handles search input, search execution, and result rendering
 */

import KnowledgeUtils from './utils.js';

const SearchBar = (() => {
    let _searchTerm = '';
    let _searchResults = null;
    let _searchLoading = false;
    let _activeTab = 'overview';
    let _loadTabFn = null;

    function init(activeTab, loadTabFn) {
        _activeTab = activeTab;
        _loadTabFn = loadTabFn;
    }

    function getSearchTerm() {
        return _searchTerm;
    }

    function setSearchTerm(term) {
        _searchTerm = term;
    }

    function clearSearch() {
        _searchTerm = '';
        _searchResults = null;
        const si = document.getElementById('kbSearchInput');
        if (si) si.value = '';
        if (_loadTabFn) _loadTabFn(_activeTab);
    }

    async function performSearch(term) {
        if (!term || !term.trim()) {
            _searchTerm = '';
            _searchResults = null;
            if (_loadTabFn) _loadTabFn(_activeTab);
            return;
        }

        _searchTerm = term.trim();
        _searchLoading = true;

        const contentEl = document.getElementById('kbContent');
        if (contentEl) contentEl.innerHTML = Components.createLoading();

        try {
            const result = await API.get('/api/search', { q: _searchTerm, limit: 50 });
            _searchResults = result || { results: [], total: 0 };
            _searchLoading = false;
            _renderSearchResults(contentEl);
        } catch (err) {
            _searchLoading = false;
            if (contentEl) contentEl.innerHTML = '<div class="empty-text">搜索失败: ' + KnowledgeUtils.escapeHtml(err.message) + '</div>';
        }
    }

    function _renderSearchResults(contentEl) {
        if (!contentEl) return;

        if (!_searchResults || !_searchResults.results || _searchResults.results.length === 0) {
            contentEl.innerHTML = '<div class="empty-text">无搜索结果: "' + KnowledgeUtils.escapeHtml(_searchTerm) + '"</div>';
            return;
        }

        const typeLabels = {
            rule: '规则',
            knowledge: '知识',
            experience: '经验',
            memory: '记忆',
            review: '审核',
        };

        let html = '<div class="tab-header">';
        html += '<div class="tab-info">搜索结果：' + (_searchResults.total || _searchResults.results.length) + ' 条结果，关键词: "' + KnowledgeUtils.escapeHtml(_searchTerm) + '"</div>';
        html += '<button class="btn-secondary" data-action="clearSearch">清除搜索</button>';
        html += '</div>';

        html += '<div class="items-list">';
        _searchResults.results.forEach(function (r) {
            const rType = r.type || 'unknown';
            const rTitle = r.title || 'Untitled';
            const rSnippet = r.snippet || r.content || r.preview || '';
            const rId = r.id || r._id || '';

            html += '<div class="search-result-item" data-action="viewItem" data-type="' + KnowledgeUtils.escapeHtml(rType) + '" data-id="' + KnowledgeUtils.escapeHtml(String(rId)) + '">';
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
            html += '<span class="result-type">' + KnowledgeUtils.escapeHtml(typeLabels[rType] || rType) + '</span>';
            html += '<span class="result-title">' + KnowledgeUtils.escapeHtml(rTitle) + '</span>';
            html += '</div>';
            if (rSnippet) {
                html += '<div class="result-snippet">' + KnowledgeUtils.escapeHtml(KnowledgeUtils.truncate(rSnippet, 150)) + '</div>';
            }
            html += '</div>';
        });
        html += '</div>';

        contentEl.innerHTML = html;
    }

    return { init, getSearchTerm, setSearchTerm, clearSearch, performSearch };
})();

export default SearchBar;
