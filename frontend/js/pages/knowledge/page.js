/**
 * Knowledge Base Page - Page Skeleton & Tab Switching
 * Manages page layout, tab navigation, and event delegation
 */

import KnowledgeUtils from './utils.js';
import SearchBar from './SearchBar.js';
import OverviewTab from './OverviewTab.js';
import RulesTab from './RulesTab.js';
import KnowledgeTab from './KnowledgeTab.js';
import ExperienceTab from './ExperienceTab.js';
import MemoryTab from './MemoryTab.js';
import ReviewTab from './ReviewTab.js';
import KnowledgeForms from './Forms.js';
import KnowledgeDialogs from './Dialogs.js';

const KnowledgePageLayout = (() => {
    let _activeTab = 'overview';
    let _boundHandler = null;
    let _refreshTimer = null;

    function getActiveTab() { return _activeTab; }
    function setActiveTab(tab) { _activeTab = tab; }

    function _ensureStylesheet() {
        if (document.getElementById('knowledge-css')) return;
        const link = document.createElement('link');
        link.id = 'knowledge-css';
        link.rel = 'stylesheet';
        link.href = '/css/knowledge.css';
        document.head.appendChild(link);
    }

    function buildPage() {
        const esc = KnowledgeUtils.escapeHtml;
        return `
            <div class="knowledge-page">
                <div class="knowledge-header">
                    <div class="knowledge-search">
                        <span class="search-icon">${Components.icon('search', 14)}</span>
                        <input type="text" id="kbSearchInput" placeholder="搜索知识库..." value="${esc(SearchBar.getSearchTerm())}" />
                        <button class="search-btn" data-action="doSearch">搜索</button>
                    </div>
                    <button class="btn-primary" data-action="showCreate" data-type="${_activeTab === 'overview' ? 'knowledge' : _activeTab}">
                        ${Components.icon('plus', 14)} 新建
                    </button>
                    <button class="btn-secondary" data-action="rebuildIndex" title="重建搜索索引">
                        ${Components.icon('refresh', 14)} 重建索引
                    </button>
                </div>
                <div class="knowledge-tabs" id="kbTabs">
                    <button class="tab-btn ${_activeTab === 'overview' ? 'active' : ''}" data-action="switchTab" data-tab="overview">
                        ${Components.icon('chart', 14)} 概览
                    </button>
                    <button class="tab-btn ${_activeTab === 'rules' ? 'active' : ''}" data-action="switchTab" data-tab="rules">
                        ${Components.icon('shield', 14)} 规则 <span class="tab-badge" id="rulesBadge">-</span>
                    </button>
                    <button class="tab-btn ${_activeTab === 'knowledge' ? 'active' : ''}" data-action="switchTab" data-tab="knowledge">
                        ${Components.icon('book', 14)} 知识 <span class="tab-badge" id="knowledgeBadge">-</span>
                    </button>
                    <button class="tab-btn ${_activeTab === 'experiences' ? 'active' : ''}" data-action="switchTab" data-tab="experiences">
                        ${Components.icon('lightbulb', 14)} 经验 <span class="tab-badge" id="experiencesBadge">-</span>
                    </button>
                    <button class="tab-btn ${_activeTab === 'memories' ? 'active' : ''}" data-action="switchTab" data-tab="memories">
                        ${Components.icon('brain', 14)} 记忆 <span class="tab-badge" id="memoriesBadge">-</span>
                    </button>
                    <button class="tab-btn ${_activeTab === 'reviews' ? 'active' : ''}" data-action="switchTab" data-tab="reviews">
                        ${Components.icon('clipboard', 14)} 审核 <span class="tab-badge" id="reviewsBadge">-</span>
                    </button>
                </div>
                <div id="kbContent">${Components.createLoading()}</div>
            </div>
        `;
    }

    function switchTab(tabId) {
        _activeTab = tabId;
        ReviewTab.clearSelectedReviews();

        const tabsContainer = document.getElementById('kbTabs');
        if (tabsContainer) {
            tabsContainer.querySelectorAll('.tab-btn').forEach(function (btn) {
                btn.classList.toggle('active', btn.dataset.tab === tabId);
            });
        }

        const createBtn = document.querySelector('[data-action="showCreate"]');
        if (createBtn) {
            createBtn.dataset.type = tabId === 'overview' ? 'knowledge' : tabId;
        }

        loadTab(tabId);
    }

    async function loadTab(tabId) {
        const contentEl = document.getElementById('kbContent');
        if (!contentEl) return;
        contentEl.innerHTML = Components.createLoading();

        try {
            switch (tabId) {
                case 'overview':
                    await OverviewTab.render(contentEl);
                    break;
                case 'rules':
                    await RulesTab.load(contentEl);
                    break;
                case 'knowledge':
                    await KnowledgeTab.load(contentEl);
                    break;
                case 'experiences':
                    await ExperienceTab.load(contentEl);
                    break;
                case 'memories':
                    await MemoryTab.load(contentEl);
                    break;
                case 'reviews':
                    await ReviewTab.load(contentEl);
                    break;
                default:
                    contentEl.innerHTML = '<div class="empty-text">未知标签页</div>';
            }
            OverviewTab.updateBadges();
        } catch (err) {
            console.error('[KnowledgePage] Failed to load tab:', tabId, err);
            contentEl.innerHTML = '<div class="empty-text">数据加载失败: ' + KnowledgeUtils.escapeHtml(err.message) + '</div>';
        }
    }

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        if (_boundHandler) {
            container.removeEventListener('click', _boundHandler);
        }

        _boundHandler = function (e) {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;

            switch (action) {
                case 'switchTab':
                    switchTab(target.dataset.tab);
                    break;
                case 'doSearch':
                    e.preventDefault();
                    var si = document.getElementById('kbSearchInput');
                    if (si) SearchBar.performSearch(si.value);
                    break;
                case 'clearSearch':
                    SearchBar.clearSearch();
                    break;
                case 'showCreate':
                    KnowledgeForms.showCreateDialog(target.dataset.type || 'knowledge');
                    break;
                case 'rebuildIndex':
                    KnowledgeDialogs.rebuildIndex();
                    break;
                case 'viewItem':
                    KnowledgeDialogs.viewItem(target.dataset.type, target.dataset.id);
                    break;
                case 'editItem':
                    KnowledgeDialogs.showEditDialog(target.dataset.type, target.dataset.id);
                    break;
                case 'deleteItem':
                    KnowledgeDialogs.confirmDelete(target.dataset.type, target.dataset.id);
                    break;
                case 'filterRules':
                    RulesTab.setFilter(target.dataset.filter);
                    var ce = document.getElementById('kbContent');
                    if (ce) ce.innerHTML = RulesTab.buildContent();
                    break;
                case 'filterKnowledge':
                    KnowledgeTab.setFilter(target.dataset.filter);
                    var ce2 = document.getElementById('kbContent');
                    if (ce2) ce2.innerHTML = KnowledgeTab.buildContent();
                    break;
                case 'filterExperiences':
                    ExperienceTab.setFilter(target.dataset.filter);
                    var ce3 = document.getElementById('kbContent');
                    if (ce3) ce3.innerHTML = ExperienceTab.buildContent();
                    break;
                case 'filterMemories':
                    MemoryTab.setFilter(target.dataset.filter);
                    var ce4 = document.getElementById('kbContent');
                    if (ce4) ce4.innerHTML = MemoryTab.buildContent();
                    break;
                case 'filterReviews':
                    ReviewTab.setFilter(target.dataset.filter);
                    ReviewTab.clearSelectedReviews();
                    loadTab('reviews');
                    break;
                case 'approveReview':
                    ReviewTab.approveReview(target.dataset.id).then(function (ok) { if (ok) loadTab('reviews'); });
                    break;
                case 'rejectReview':
                    ReviewTab.rejectReview(target.dataset.id).then(function (ok) { if (ok) loadTab('reviews'); });
                    break;
                case 'batchApprove':
                    ReviewTab.batchApprove().then(function (ok) { if (ok) loadTab('reviews'); });
                    break;
                case 'batchReject':
                    ReviewTab.batchReject().then(function (ok) { if (ok) loadTab('reviews'); });
                    break;
                case 'toggleReviewSelect':
                    ReviewTab.toggleReviewSelect(target.dataset.id);
                    break;
                case 'closeModal':
                case 'submitModal':
                    break;
            }
        };

        container.addEventListener('click', _boundHandler);

        var searchInput = document.getElementById('kbSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') SearchBar.performSearch(searchInput.value);
            });
        }
    }

    function onSSEEvent(type, _data) {
        var refreshTypes = [
            'knowledge.updated', 'rules.updated', 'experiences.updated',
            'memories.updated', 'reviews.updated',
        ];
        if (refreshTypes.indexOf(type) !== -1) {
            if (_refreshTimer) return;
            _refreshTimer = setTimeout(function () {
                _refreshTimer = null;
                if (_activeTab === 'overview') {
                    OverviewTab.loadOverviewData().catch(function () {});
                }
            }, 500);
        }
    }

    function destroy() {
        if (_boundHandler) {
            const container = document.getElementById('contentBody');
            if (container) container.removeEventListener('click', _boundHandler);
            _boundHandler = null;
        }
        _activeTab = 'overview';
        _refreshTimer = null;
        SearchBar.setSearchTerm('');
        RulesTab.destroy();
        KnowledgeTab.destroy();
        ExperienceTab.destroy();
        MemoryTab.destroy();
        ReviewTab.destroy();
        document.querySelectorAll('.kb-modal-overlay').forEach(function (el) { el.remove(); });
    }

    return {
        _ensureStylesheet, buildPage, switchTab, loadTab,
        bindEvents, onSSEEvent, destroy,
        getActiveTab, setActiveTab,
    };
})();

export default KnowledgePageLayout;
