/**
 * Knowledge Base Page - Complete Rewrite
 * IIFE pattern with 6 tabs: overview, rules, knowledge, experiences, memories, reviews
 * Container: contentBody
 */

const KnowledgePage = (() => {
    // ==========================================
    // State
    // ==========================================
    let _activeTab = 'overview';
    let _searchTerm = '';
    let _searchResults = null;
    let _searchLoading = false;

    // Tab data caches
    let _rulesData = [];
    let _rulesStats = {};
    let _knowledgeData = [];
    let _knowledgeStats = {};
    let _experiencesData = [];
    let _experiencesStats = {};
    let _memoriesData = [];
    let _memoriesStats = {};
    let _reviewsData = [];
    let _reviewsStats = {};

    // Review selection state
    let _selectedReviews = new Set();
    let _refreshTimer = null;

    // Filter states per tab
    let _rulesFilter = 'all';
    let _knowledgeFilter = 'all';
    let _experiencesFilter = 'all';
    let _memoriesFilter = 'all';
    let _reviewsFilter = 'pending';

    // Event handler reference for cleanup
    let _boundHandler = null;

    // ==========================================
    // Utility Functions
    // ==========================================
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function formatTime(dateStr) {
        if (!dateStr) return '-';
        try {
            if (Components && typeof Components.formatTime === 'function') {
                return Components.formatTime(dateStr);
            }
        } catch (e) {}
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
        if (diff < 604800) return Math.floor(diff / 86400) + '天前';
        return d.toLocaleDateString();
    }

    function showToast(message, type) {
        if (Components && Components.Toast && typeof Components.Toast.show === 'function') {
            Components.Toast.show(message, type || 'info');
        } else {
            _customToast(message, type || 'info');
        }
    }

    function _customToast(message, type) {
        const colors = {
            success: 'var(--green)',
            error: 'var(--red)',
            warning: 'var(--orange)',
            info: 'var(--accent)',
        };
        const color = colors[type] || colors.info;
        const toast = document.createElement('div');
        toast.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:10000;padding:12px 20px;' +
            'background:var(--surface);color:var(--text-primary);border-radius:8px;' +
            'border:1px solid var(--border);box-shadow:0 4px 16px rgba(0,0,0,0.12);' +
            'font-size:13px;max-width:400px;border-left:3px solid ' + color + ';' +
            'animation:slideIn 0.3s ease;';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.2s';
            setTimeout(() => toast.remove(), 200);
        }, 3000);
    }

    function truncate(str, maxLen) {
        if (!str) return '';
        maxLen = maxLen || 80;
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    }

    // ==========================================
    // Render (Entry Point)
    // ==========================================
    async function render() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // Load CSS
        _ensureStylesheet();

        // Load initial data for overview
        try {
            await _loadOverviewData();
        } catch (_err) {
            // Overview data load failure is non-fatal
        }

        container.innerHTML = buildPage();
        _bindEvents();

        // Load active tab content
        await loadTab(_activeTab);
    }

    function destroy() {
        _activeTab = 'overview';
        _searchTerm = '';
        _searchResults = null;
        _selectedReviews.clear();
        _rulesData = [];
        _knowledgeData = [];
        _experiencesData = [];
        _memoriesData = [];
        _reviewsData = [];
        _rulesFilter = 'all';
        _knowledgeFilter = 'all';
        _experiencesFilter = 'all';
        _memoriesFilter = 'all';
        _reviewsFilter = 'pending';

        // Remove custom modal overlays
        document.querySelectorAll('.kb-modal-overlay').forEach((el) => el.remove());
    }

    function _ensureStylesheet() {
        if (document.getElementById('knowledge-css')) return;
        const link = document.createElement('link');
        link.id = 'knowledge-css';
        link.rel = 'stylesheet';
        link.href = '/css/knowledge.css';
        document.head.appendChild(link);
    }

    // ==========================================
    // Page Structure
    // ==========================================
    function buildPage() {
        return `
            <div class="knowledge-page">
                <div class="knowledge-header">
                    <div class="knowledge-search">
                        <span class="search-icon">${Components.icon('search', 14)}</span>
                        <input type="text" id="kbSearchInput" placeholder="搜索知识库..." value="${escapeHtml(_searchTerm)}" />
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

    // ==========================================
    // Tab Switching
    // ==========================================
    function switchTab(tabId) {
        _activeTab = tabId;
        _selectedReviews.clear();

        // Update tab button active states
        const tabsContainer = document.getElementById('kbTabs');
        if (tabsContainer) {
            tabsContainer.querySelectorAll('.tab-btn').forEach((btn) => {
                btn.classList.toggle('active', btn.dataset.tab === tabId);
            });
        }

        // Update the "New" button data-type
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
                    await _loadOverviewTab(contentEl);
                    break;
                case 'rules':
                    await _loadRulesTab(contentEl);
                    break;
                case 'knowledge':
                    await _loadKnowledgeTab(contentEl);
                    break;
                case 'experiences':
                    await _loadExperiencesTab(contentEl);
                    break;
                case 'memories':
                    await _loadMemoriesTab(contentEl);
                    break;
                case 'reviews':
                    await _loadReviewsTab(contentEl);
                    break;
                default:
                    contentEl.innerHTML = '<div class="empty-text">未知标签页</div>';
            }
        } catch (err) {
            console.error('[KnowledgePage] Failed to load tab:', tabId, err);
            contentEl.innerHTML = '<div class="empty-text">数据加载失败: ' + escapeHtml(err.message) + '</div>';
        }
    }

    // ==========================================
    // Overview Tab
    // ==========================================
    async function _loadOverviewData() {
        const [rulesStats, knowledgeStats, experiencesStats, memoriesStats, reviewsStats] = await Promise.allSettled([
            API.get('/api/rules/stats'),
            API.get('/api/knowledge/items/stats'),
            API.get('/api/experiences/stats'),
            API.get('/api/memories/stats'),
            API.get('/api/reviews/stats'),
        ]);

        _rulesStats = rulesStats.status === 'fulfilled' ? (rulesStats.value || {}) : {};
        _knowledgeStats = knowledgeStats.status === 'fulfilled' ? (knowledgeStats.value || {}) : {};
        _experiencesStats = experiencesStats.status === 'fulfilled' ? (experiencesStats.value || {}) : {};
        _memoriesStats = memoriesStats.status === 'fulfilled' ? (memoriesStats.value || {}) : {};
        _reviewsStats = reviewsStats.status === 'fulfilled' ? (reviewsStats.value || {}) : {};

        // Update badges
        _updateBadges();
    }

    function _updateBadges() {
        const rulesBadge = document.getElementById('rulesBadge');
        const knowledgeBadge = document.getElementById('knowledgeBadge');
        const experiencesBadge = document.getElementById('experiencesBadge');
        const memoriesBadge = document.getElementById('memoriesBadge');
        const reviewsBadge = document.getElementById('reviewsBadge');

        if (rulesBadge) rulesBadge.textContent = _rulesStats.total || 0;
        if (knowledgeBadge) knowledgeBadge.textContent = _knowledgeStats.total || 0;
        if (experiencesBadge) experiencesBadge.textContent = _experiencesStats.total || 0;
        if (memoriesBadge) memoriesBadge.textContent = _memoriesStats.total || 0;
        if (reviewsBadge) {
            const pending = _reviewsStats.pending || 0;
            reviewsBadge.textContent = pending;
            reviewsBadge.style.background = pending > 0 ? 'var(--orange-bg)' : '';
            reviewsBadge.style.color = pending > 0 ? 'var(--orange)' : '';
        }
    }

    async function _loadOverviewTab(contentEl) {
        await _loadOverviewData();

        const rulesTotal = _rulesStats.total || 0;
        const knowledgeTotal = _knowledgeStats.total || 0;
        const experiencesTotal = _experiencesStats.total || 0;
        const memoriesTotal = _memoriesStats.total || 0;
        const reviewsPending = _reviewsStats.pending || 0;
        const reviewsTotal = _reviewsStats.total || 0;

        // Calculate budget bar percentages
        const total = rulesTotal + knowledgeTotal + experiencesTotal + memoriesTotal + reviewsTotal;
        const pcts = total > 0
            ? [
                ((rulesTotal / total) * 100).toFixed(1),
                ((knowledgeTotal / total) * 100).toFixed(1),
                ((experiencesTotal / total) * 100).toFixed(1),
                ((memoriesTotal / total) * 100).toFixed(1),
                ((reviewsTotal / total) * 100).toFixed(1),
              ]
            : [20, 20, 20, 20, 20];

        contentEl.innerHTML = `
            <div class="overview-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px">
                <div class="stat-card" style="padding:16px">
                    <div class="stat-icon" style="background:var(--blue-bg);color:var(--blue)">${Components.icon('shield', 18)}</div>
                    <div class="stat-label">规则</div>
                    <div class="stat-value">${rulesTotal}</div>
                </div>
                <div class="stat-card" style="padding:16px">
                    <div class="stat-icon" style="background:var(--purple-bg);color:var(--purple)">${Components.icon('book', 18)}</div>
                    <div class="stat-label">知识条目</div>
                    <div class="stat-value">${knowledgeTotal}</div>
                </div>
                <div class="stat-card" style="padding:16px">
                    <div class="stat-icon" style="background:var(--orange-bg);color:var(--orange)">${Components.icon('lightbulb', 18)}</div>
                    <div class="stat-label">经验</div>
                    <div class="stat-value">${experiencesTotal}</div>
                </div>
                <div class="stat-card" style="padding:16px">
                    <div class="stat-icon" style="background:var(--green-bg);color:var(--green)">${Components.icon('brain', 18)}</div>
                    <div class="stat-label">记忆</div>
                    <div class="stat-value">${memoriesTotal}</div>
                </div>
                <div class="stat-card ${reviewsPending > 0 ? 'stat-warning' : ''}" style="padding:16px">
                    <div class="stat-icon" style="background:var(--red-bg);color:var(--red)">${Components.icon('clipboard', 18)}</div>
                    <div class="stat-label">待审核</div>
                    <div class="stat-value">${reviewsPending}</div>
                </div>
            </div>

            <div class="budget-section" style="margin-top:16px">
                <h4 style="font-size:14px;margin-bottom:8px">知识库分布</h4>
                <div class="budget-bar">
                    <div class="budget-item" style="width:${pcts[0]}%" title="规则: ${rulesTotal}"></div>
                    <div class="budget-item" style="width:${pcts[1]}%" title="知识: ${knowledgeTotal}"></div>
                    <div class="budget-item" style="width:${pcts[2]}%" title="经验: ${experiencesTotal}"></div>
                    <div class="budget-item" style="width:${pcts[3]}%" title="记忆: ${memoriesTotal}"></div>
                    <div class="budget-item" style="width:${pcts[4]}%" title="审核: ${reviewsTotal}"></div>
                </div>
                <div style="display:flex;gap:16px;margin-top:8px;font-size:11px;color:var(--text-tertiary);flex-wrap:wrap">
                    <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#6366f1;margin-right:4px"></span>规则</span>
                    <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#3b82f6;margin-right:4px"></span>知识</span>
                    <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#8b5cf6;margin-right:4px"></span>经验</span>
                    <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#a855f7;margin-right:4px"></span>记忆</span>
                    <span><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:#06b6d4;margin-right:4px"></span>审核</span>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:12px;margin-top:16px">
                <div class="stat-card" style="cursor:pointer;padding:14px" data-action="switchTab" data-tab="rules">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        ${Components.icon('shield', 16)}
                        <span style="font-size:14px;font-weight:600">规则</span>
                        <span style="margin-left:auto;font-size:12px;color:var(--text-tertiary)">${rulesTotal} 条</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary)">Agent 行为规则与约束</div>
                </div>
                <div class="stat-card" style="cursor:pointer;padding:14px" data-action="switchTab" data-tab="knowledge">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        ${Components.icon('book', 16)}
                        <span style="font-size:14px;font-weight:600">知识条目</span>
                        <span style="margin-left:auto;font-size:12px;color:var(--text-tertiary)">${knowledgeTotal} 条</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary)">结构化知识条目与文档</div>
                </div>
                <div class="stat-card" style="cursor:pointer;padding:14px" data-action="switchTab" data-tab="experiences">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        ${Components.icon('lightbulb', 16)}
                        <span style="font-size:14px;font-weight:600">经验</span>
                        <span style="margin-left:auto;font-size:12px;color:var(--text-tertiary)">${experiencesTotal} 条</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary)">从交互和错误中积累的经验</div>
                </div>
                <div class="stat-card" style="cursor:pointer;padding:14px" data-action="switchTab" data-tab="memories">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        ${Components.icon('brain', 16)}
                        <span style="font-size:14px;font-weight:600">记忆</span>
                        <span style="margin-left:auto;font-size:12px;color:var(--text-tertiary)">${memoriesTotal} 条</span>
                    </div>
                    <div style="font-size:12px;color:var(--text-secondary)">Agent 记忆、用户偏好与上下文</div>
                </div>
            </div>
        `;
    }

    // ==========================================
    // Rules Tab
    // ==========================================
    async function _loadRulesTab(contentEl) {
        const [items, stats] = await Promise.allSettled([
            API.get('/api/rules', { limit: 100 }),
            API.get('/api/rules/stats'),
        ]);

        _rulesData = items.status === 'fulfilled' ? (items.value || []) : [];
        _rulesStats = stats.status === 'fulfilled' ? (stats.value || {}) : {};
        _updateBadges();

        contentEl.innerHTML = _buildRulesContent();
    }

    function _buildRulesContent() {
        const categories = ['all'];
        const catSet = new Set();
        (_rulesData || []).forEach(function (r) {
            if (r.category) catSet.add(r.category);
        });
        catSet.forEach(function (c) { categories.push(c); });

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        categories.forEach(function (cat) {
            html += '<button class="filter-btn ' + (_rulesFilter === cat ? 'active' : '') + '" data-action="filterRules" data-filter="' + escapeHtml(cat) + '">' + escapeHtml(cat === 'all' ? '全部' : cat) + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">' + (_rulesData || []).length + ' 条规则</div>';
        html += '</div>';

        const filtered = _rulesFilter === 'all' ? _rulesData : _rulesData.filter(function (r) { return r.category === _rulesFilter; });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无规则</div>';
            return html;
        }

        html += '<div class="items-list">';
        filtered.forEach(function (item) {
            const id = item.id || item._id;
            html += _buildRuleCard(item, id);
        });
        html += '</div>';
        return html;
    }

    function _buildRuleCard(item, id) {
        const priority = item.priority || 'medium';
        const category = item.category || 'general';
        const scope = item.scope || '';
        const tags = item.tags || [];
        const title = item.title || 'Untitled Rule';
        const content = item.content || '';
        const preview = truncate(content, 120);
        const updatedAt = formatTime(item.updated_at || item.created_at);

        let html = '<div class="item-card" data-id="' + escapeHtml(String(id)) + '">';
        html += '<div class="item-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="item-category">' + escapeHtml(category) + '</span>';
        html += '<span class="item-priority ' + escapeHtml(priority) + '">' + escapeHtml(priority) + '</span>';
        if (scope) html += '<span class="item-status">' + escapeHtml(scope) + '</span>';
        html += '</div>';
        html += '<div class="item-actions">';
        html += '<button data-action="viewItem" data-type="rules" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('eye', 12) + '</button>';
        html += '<button data-action="editItem" data-type="rules" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('edit', 12) + '</button>';
        html += '<button class="btn-delete" data-action="deleteItem" data-type="rules" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('trash', 12) + '</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="item-title" data-action="viewItem" data-type="rules" data-id="' + escapeHtml(String(id)) + '">' + escapeHtml(title) + '</div>';
        html += '<div class="item-preview">' + escapeHtml(preview) + '</div>';
        if (tags.length > 0) {
            html += '<div class="item-tags">';
            tags.forEach(function (t) { html += '<span class="tag">' + escapeHtml(t) + '</span>'; });
            html += '</div>';
        }
        html += '<div class="item-meta"><span>' + updatedAt + '</span></div>';
        html += '</div>';
        return html;
    }

    // ==========================================
    // Knowledge Tab
    // ==========================================
    async function _loadKnowledgeTab(contentEl) {
        const [items, stats] = await Promise.allSettled([
            API.get('/api/knowledge/items', { limit: 100 }),
            API.get('/api/knowledge/items/stats'),
        ]);

        _knowledgeData = items.status === 'fulfilled' ? (items.value || []) : [];
        _knowledgeStats = stats.status === 'fulfilled' ? (stats.value || {}) : {};
        _updateBadges();

        contentEl.innerHTML = _buildKnowledgeContent();
    }

    function _buildKnowledgeContent() {
        const categories = ['all'];
        const catSet = new Set();
        (_knowledgeData || []).forEach(function (k) {
            if (k.category) catSet.add(k.category);
        });
        catSet.forEach(function (c) { categories.push(c); });

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        categories.forEach(function (cat) {
            html += '<button class="filter-btn ' + (_knowledgeFilter === cat ? 'active' : '') + '" data-action="filterKnowledge" data-filter="' + escapeHtml(cat) + '">' + escapeHtml(cat === 'all' ? '全部' : cat) + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">' + (_knowledgeData || []).length + ' 条知识</div>';
        html += '</div>';

        const filtered = _knowledgeFilter === 'all' ? _knowledgeData : _knowledgeData.filter(function (k) { return k.category === _knowledgeFilter; });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无知识条目</div>';
            return html;
        }

        html += '<div class="items-list">';
        filtered.forEach(function (item) {
            const id = item.id || item._id;
            html += _buildKnowledgeCard(item, id);
        });
        html += '</div>';
        return html;
    }

    function _buildKnowledgeCard(item, id) {
        const category = item.category || 'general';
        const tags = item.tags || [];
        const title = item.title || 'Untitled';
        const content = item.content || '';
        const summary = item.summary || '';
        const confidence = item.confidence || '';
        const source = item.source || '';
        const updatedAt = formatTime(item.updated_at || item.created_at);

        let html = '<div class="item-card" data-id="' + escapeHtml(String(id)) + '">';
        html += '<div class="item-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="item-category">' + escapeHtml(category) + '</span>';
        if (confidence) html += '<span class="item-confidence">' + escapeHtml(confidence) + '</span>';
        if (source) html += '<span class="item-access">' + escapeHtml(source) + '</span>';
        html += '</div>';
        html += '<div class="item-actions">';
        html += '<button data-action="viewItem" data-type="knowledge" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('eye', 12) + '</button>';
        html += '<button data-action="editItem" data-type="knowledge" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('edit', 12) + '</button>';
        html += '<button class="btn-delete" data-action="deleteItem" data-type="knowledge" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('trash', 12) + '</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="item-title" data-action="viewItem" data-type="knowledge" data-id="' + escapeHtml(String(id)) + '">' + escapeHtml(title) + '</div>';
        if (summary) {
            html += '<div class="item-summary">' + escapeHtml(summary) + '</div>';
        } else {
            html += '<div class="item-preview">' + escapeHtml(truncate(content, 120)) + '</div>';
        }
        if (tags.length > 0) {
            html += '<div class="item-tags">';
            tags.forEach(function (t) { html += '<span class="tag">' + escapeHtml(t) + '</span>'; });
            html += '</div>';
        }
        html += '<div class="item-meta"><span>' + updatedAt + '</span></div>';
        html += '</div>';
        return html;
    }

    // ==========================================
    // Experiences Tab
    // ==========================================
    async function _loadExperiencesTab(contentEl) {
        const [items, stats] = await Promise.allSettled([
            API.get('/api/experiences', { limit: 100 }),
            API.get('/api/experiences/stats'),
        ]);

        _experiencesData = items.status === 'fulfilled' ? (items.value || []) : [];
        _experiencesStats = stats.status === 'fulfilled' ? (stats.value || {}) : {};
        _updateBadges();

        contentEl.innerHTML = _buildExperiencesContent();
    }

    function _buildExperiencesContent() {
        const categories = ['all'];
        const catSet = new Set();
        (_experiencesData || []).forEach(function (e) {
            if (e.category) catSet.add(e.category);
        });
        catSet.forEach(function (c) { categories.push(c); });

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        categories.forEach(function (cat) {
            html += '<button class="filter-btn ' + (_experiencesFilter === cat ? 'active' : '') + '" data-action="filterExperiences" data-filter="' + escapeHtml(cat) + '">' + escapeHtml(cat === 'all' ? '全部' : cat) + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">' + (_experiencesData || []).length + ' 条经验</div>';
        html += '</div>';

        const filtered = _experiencesFilter === 'all' ? _experiencesData : _experiencesData.filter(function (e) { return e.category === _experiencesFilter; });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无经验</div>';
            return html;
        }

        html += '<div class="items-list">';
        filtered.forEach(function (item) {
            const id = item.id || item._id;
            html += _buildExperienceCard(item, id);
        });
        html += '</div>';
        return html;
    }

    function _buildExperienceCard(item, id) {
        const category = item.category || 'general';
        const severity = item.severity || 'medium';
        const toolName = item.tool_name || '';
        const errorType = item.error_type || '';
        const tags = item.tags || [];
        const title = item.title || 'Untitled Experience';
        const content = item.content || '';
        const context = item.context || '';
        const updatedAt = formatTime(item.updated_at || item.created_at);

        let html = '<div class="item-card" data-id="' + escapeHtml(String(id)) + '">';
        html += '<div class="item-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="item-category">' + escapeHtml(category) + '</span>';
        html += '<span class="item-severity ' + escapeHtml(severity) + '">' + escapeHtml(severity) + '</span>';
        if (toolName) html += '<span class="item-tool">' + escapeHtml(toolName) + '</span>';
        if (errorType) html += '<span class="item-status">' + escapeHtml(errorType) + '</span>';
        html += '</div>';
        html += '<div class="item-actions">';
        html += '<button data-action="viewItem" data-type="experiences" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('eye', 12) + '</button>';
        html += '<button data-action="editItem" data-type="experiences" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('edit', 12) + '</button>';
        html += '<button class="btn-delete" data-action="deleteItem" data-type="experiences" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('trash', 12) + '</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="item-title" data-action="viewItem" data-type="experiences" data-id="' + escapeHtml(String(id)) + '">' + escapeHtml(title) + '</div>';
        html += '<div class="item-preview">' + escapeHtml(truncate(content, 120)) + '</div>';
        if (tags.length > 0) {
            html += '<div class="item-tags">';
            tags.forEach(function (t) { html += '<span class="tag">' + escapeHtml(t) + '</span>'; });
            html += '</div>';
        }
        html += '<div class="item-meta"><span>' + updatedAt + '</span></div>';
        html += '</div>';
        return html;
    }

    // ==========================================
    // Memories Tab
    // ==========================================
    async function _loadMemoriesTab(contentEl) {
        const [items, stats] = await Promise.allSettled([
            API.get('/api/memories', { limit: 100 }),
            API.get('/api/memories/stats'),
        ]);

        _memoriesData = items.status === 'fulfilled' ? (items.value || []) : [];
        _memoriesStats = stats.status === 'fulfilled' ? (stats.value || {}) : {};
        _updateBadges();

        contentEl.innerHTML = _buildMemoriesContent();
    }

    function _buildMemoriesContent() {
        const categories = ['all'];
        const catSet = new Set();
        (_memoriesData || []).forEach(function (m) {
            if (m.category) catSet.add(m.category);
        });
        catSet.forEach(function (c) { categories.push(c); });

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        categories.forEach(function (cat) {
            html += '<button class="filter-btn ' + (_memoriesFilter === cat ? 'active' : '') + '" data-action="filterMemories" data-filter="' + escapeHtml(cat) + '">' + escapeHtml(cat === 'all' ? '全部' : cat) + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">' + (_memoriesData || []).length + ' 条记忆</div>';
        html += '</div>';

        const filtered = _memoriesFilter === 'all' ? _memoriesData : _memoriesData.filter(function (m) { return m.category === _memoriesFilter; });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无记忆</div>';
            return html;
        }

        html += '<div class="items-list">';
        filtered.forEach(function (item) {
            const id = item.id || item._id;
            html += _buildMemoryCard(item, id);
        });
        html += '</div>';
        return html;
    }

    function _buildMemoryCard(item, id) {
        const category = item.category || 'general';
        const importance = item.importance || 'medium';
        const tags = item.tags || [];
        const title = item.title || 'Untitled Memory';
        const content = item.content || '';
        const updatedAt = formatTime(item.updated_at || item.created_at);

        let html = '<div class="item-card" data-id="' + escapeHtml(String(id)) + '">';
        html += '<div class="item-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="item-category">' + escapeHtml(category) + '</span>';
        html += '<span class="item-importance ' + escapeHtml(importance) + '">' + escapeHtml(importance) + '</span>';
        html += '</div>';
        html += '<div class="item-actions">';
        html += '<button data-action="viewItem" data-type="memories" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('eye', 12) + '</button>';
        html += '<button data-action="editItem" data-type="memories" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('edit', 12) + '</button>';
        html += '<button class="btn-delete" data-action="deleteItem" data-type="memories" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('trash', 12) + '</button>';
        html += '</div>';
        html += '</div>';
        html += '<div class="item-title" data-action="viewItem" data-type="memories" data-id="' + escapeHtml(String(id)) + '">' + escapeHtml(title) + '</div>';
        html += '<div class="item-preview">' + escapeHtml(truncate(content, 150)) + '</div>';
        if (tags.length > 0) {
            html += '<div class="item-tags">';
            tags.forEach(function (t) { html += '<span class="tag">' + escapeHtml(t) + '</span>'; });
            html += '</div>';
        }
        html += '<div class="item-meta"><span>' + updatedAt + '</span></div>';
        html += '</div>';
        return html;
    }

    // ==========================================
    // Reviews Tab
    // ==========================================
    async function _loadReviewsTab(contentEl) {
        const [items, stats] = await Promise.allSettled([
            API.get('/api/reviews', { status: 'pending', limit: 50 }),
            API.get('/api/reviews/stats'),
        ]);

        _reviewsData = items.status === 'fulfilled' ? (items.value || []) : [];
        _reviewsStats = stats.status === 'fulfilled' ? (stats.value || {}) : {};
        _selectedReviews.clear();
        _updateBadges();

        contentEl.innerHTML = _buildReviewsContent();
    }

    function _buildReviewsContent() {
        const statuses = ['pending', 'approved', 'rejected'];
        const statusLabels = { pending: '待审核', approved: '已通过', rejected: '已拒绝' };

        let html = '<div class="tab-header">';
        html += '<div class="tab-filters">';
        statuses.forEach(function (s) {
            html += '<button class="filter-btn ' + (_reviewsFilter === s ? 'active' : '') + '" data-action="filterReviews" data-filter="' + s + '">' + statusLabels[s] + '</button>';
        });
        html += '</div>';
        html += '<div class="tab-info">';
        html += '<span>' + (_reviewsData || []).length + ' 条审核</span>';
        if (_selectedReviews.size > 0) {
            html += '<span style="margin-left:8px;color:var(--accent)">' + _selectedReviews.size + ' 已选择</span>';
        }
        html += '</div>';
        html += '</div>';

        // Batch actions
        if (_reviewsFilter === 'pending' && _reviewsData.length > 0) {
            html += '<div style="display:flex;gap:8px;margin-bottom:12px">';
            html += '<button class="btn-success" data-action="batchApprove">' + Components.icon('check', 12) + ' 批量通过</button>';
            html += '<button class="btn-danger" data-action="batchReject">' + Components.icon('x', 12) + ' 批量拒绝</button>';
            html += '</div>';
        }

        const filtered = _reviewsFilter === 'all' ? _reviewsData : _reviewsData.filter(function (r) {
            return (r.status || 'pending') === _reviewsFilter;
        });

        if (filtered.length === 0) {
            html += '<div class="empty-text">暂无审核记录</div>';
            return html;
        }

        html += '<div class="reviews-list">';
        filtered.forEach(function (item) {
            const id = item.id || item._id;
            html += _buildReviewCard(item, id);
        });
        html += '</div>';
        return html;
    }

    function _buildReviewCard(item, id) {
        const status = item.status || 'pending';
        const reviewType = item.type || item.action_type || 'update';
        const confidence = item.confidence || '';
        const reason = item.reason || '';
        const context = item.context || '';
        const content = item.content || item.new_content || '';
        const title = item.title || ('Review #' + String(id));
        const createdAt = formatTime(item.created_at);
        const isSelected = _selectedReviews.has(String(id));

        const statusClass = status === 'approved' ? 'review-approved' : status === 'rejected' ? 'review-rejected' : 'review-pending';

        let html = '<div class="review-card ' + statusClass + '" data-id="' + escapeHtml(String(id)) + '">';
        html += '<div class="review-header">';
        html += '<div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
        html += '<span class="review-type">' + escapeHtml(reviewType) + '</span>';
        if (confidence) html += '<span class="review-confidence">置信度: ' + escapeHtml(String(confidence)) + '</span>';
        html += '<span class="review-time">' + createdAt + '</span>';
        html += '</div>';
        html += '</div>';
        html += '<div class="review-title">' + escapeHtml(title) + '</div>';
        if (reason) {
            html += '<div class="review-reason">' + escapeHtml(reason) + '</div>';
        }
        if (context) {
            html += '<div class="review-context">' + escapeHtml(truncate(context, 300)) + '</div>';
        }
        if (content) {
            html += '<div class="review-content">' + escapeHtml(truncate(content, 200)) + '</div>';
        }

        if (status === 'pending') {
            html += '<div class="review-actions">';
            html += '<label class="review-checkbox"><input type="checkbox" data-action="toggleReviewSelect" data-id="' + escapeHtml(String(id)) + '" ' + (isSelected ? 'checked' : '') + ' /> 全选</label>';
            html += '<button class="btn-success" data-action="approveReview" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('check', 12) + ' 通过</button>';
            html += '<button class="btn-danger" data-action="rejectReview" data-id="' + escapeHtml(String(id)) + '">' + Components.icon('x', 12) + ' 拒绝</button>';
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // ==========================================
    // Search
    // ==========================================
    async function performSearch(term) {
        if (!term || !term.trim()) {
            _searchTerm = '';
            _searchResults = null;
            const contentEl = document.getElementById('kbContent');
            if (contentEl) loadTab(_activeTab);
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
            if (contentEl) contentEl.innerHTML = '<div class="empty-text">搜索失败: ' + escapeHtml(err.message) + '</div>';
        }
    }

    function _renderSearchResults(contentEl) {
        if (!contentEl) return;

        if (!_searchResults || !_searchResults.results || _searchResults.results.length === 0) {
            contentEl.innerHTML = '<div class="empty-text">无搜索结果: "' + escapeHtml(_searchTerm) + '"</div>';
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
        html += '<div class="tab-info">搜索结果：' + (_searchResults.total || _searchResults.results.length) + ' 条结果，关键词: "' + escapeHtml(_searchTerm) + '"</div>';
        html += '<button class="btn-secondary" data-action="clearSearch">清除搜索</button>';
        html += '</div>';

        html += '<div class="items-list">';
        _searchResults.results.forEach(function (r) {
            const rType = r.type || 'unknown';
            const rTitle = r.title || 'Untitled';
            const rSnippet = r.snippet || r.content || r.preview || '';
            const rId = r.id || r._id || '';

            html += '<div class="search-result-item" data-action="viewItem" data-type="' + escapeHtml(rType) + '" data-id="' + escapeHtml(String(rId)) + '">';
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">';
            html += '<span class="result-type">' + escapeHtml(typeLabels[rType] || rType) + '</span>';
            html += '<span class="result-title">' + escapeHtml(rTitle) + '</span>';
            html += '</div>';
            if (rSnippet) {
                html += '<div class="result-snippet">' + escapeHtml(truncate(rSnippet, 150)) + '</div>';
            }
            html += '</div>';
        });
        html += '</div>';

        contentEl.innerHTML = html;
    }

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

        _showModal(title, formHtml, async function (modalOverlay) {
            const data = _collectFormData(type, modalOverlay);
            if (!data) return false; // validation failed

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
                        showToast('未知类型: ' + type, 'error');
                        return false;
                }
                showToast('创建成功', 'success');
                return true; // close modal
            } catch (err) {
                showToast('创建失败: ' + (err.message || '未知错误'), 'error');
                return false; // keep modal open
            }
        });
    }

    function _buildCreateForm(type) {
        let html = '';

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
                html += '</select></div>';
                html += '</div>';
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
                html += '<input class="modal-input" name="source" placeholder="例如: 手动, 自动提取" /></div>';
                html += '</div>';
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
                html += '</select></div>';
                html += '</div>';
                html += '<div class="form-group"><label class="form-label">上下文</label>';
                html += '<textarea class="modal-textarea" name="context" placeholder="上下文或背景..." style="min-height:60px"></textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">工具名</label>';
                html += '<input class="modal-input" name="tool_name" placeholder="相关工具" /></div>';
                html += '<div class="form-group"><label class="form-label">错误类型</label>';
                html += '<input class="modal-input" name="error_type" placeholder="错误分类" /></div>';
                html += '</div>';
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
                html += '</select></div>';
                html += '</div>';
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

    function _collectFormData(type, modalOverlay) {
        const titleInput = modalOverlay.querySelector('[name="title"]');
        const contentInput = modalOverlay.querySelector('[name="content"]');

        const title = titleInput ? titleInput.value.trim() : '';
        const content = contentInput ? contentInput.value.trim() : '';

        if (!title && !content) {
            showToast('标题或内容为必填项', 'warning');
            return null;
        }

        const tagsInput = modalOverlay.querySelector('[name="tags"]');
        const tagsRaw = tagsInput ? tagsInput.value.trim() : '';
        const tags = tagsRaw ? tagsRaw.split(',').map(function (t) { return t.trim(); }).filter(Boolean) : [];

        const data = { title: title, content: content, tags: tags };

        switch (type) {
            case 'rules': {
                const catInput = modalOverlay.querySelector('[name="category"]');
                const priInput = modalOverlay.querySelector('[name="priority"]');
                const scopeInput = modalOverlay.querySelector('[name="scope"]');
                data.category = catInput ? catInput.value.trim() : '';
                data.priority = priInput ? priInput.value : 'medium';
                data.scope = scopeInput ? scopeInput.value.trim() : '';
                break;
            }
            case 'knowledge': {
                const sumInput = modalOverlay.querySelector('[name="summary"]');
                const catInput = modalOverlay.querySelector('[name="category"]');
                const srcInput = modalOverlay.querySelector('[name="source"]');
                data.summary = sumInput ? sumInput.value.trim() : '';
                data.category = catInput ? catInput.value.trim() : '';
                data.source = srcInput ? srcInput.value.trim() : '';
                break;
            }
            case 'experiences': {
                const catInput = modalOverlay.querySelector('[name="category"]');
                const ctxInput = modalOverlay.querySelector('[name="context"]');
                const toolInput = modalOverlay.querySelector('[name="tool_name"]');
                const errInput = modalOverlay.querySelector('[name="error_type"]');
                const sevInput = modalOverlay.querySelector('[name="severity"]');
                data.category = catInput ? catInput.value.trim() : '';
                data.context = ctxInput ? ctxInput.value.trim() : '';
                data.tool_name = toolInput ? toolInput.value.trim() : '';
                data.error_type = errInput ? errInput.value.trim() : '';
                data.severity = sevInput ? sevInput.value : 'medium';
                break;
            }
            case 'memories': {
                const catInput = modalOverlay.querySelector('[name="category"]');
                const impInput = modalOverlay.querySelector('[name="importance"]');
                data.category = catInput ? catInput.value.trim() : '';
                data.importance = impInput ? impInput.value : 'medium';
                break;
            }
        }

        return data;
    }

    // ==========================================
    // Edit Dialog
    // ==========================================
    async function showEditDialog(type, id) {
        let item = null;
        let endpoint = '';

        switch (type) {
            case 'rules': endpoint = '/api/rules/' + id; break;
            case 'knowledge': endpoint = '/api/knowledge/items/' + id; break;
            case 'experiences': endpoint = '/api/experiences/' + id; break;
            case 'memories': endpoint = '/api/memories/' + id; break;
            default: showToast('未知类型', 'error'); return;
        }

        try {
            item = await API.get(endpoint);
        } catch (err) {
            showToast('加载条目失败: ' + err.message, 'error');
            return;
        }

        if (!item) {
            showToast('条目未找到', 'error');
            return;
        }

        const typeLabels = {
            rules: '编辑规则',
            knowledge: '编辑知识',
            experiences: '编辑经验',
            memories: '编辑记忆',
        };

        const title = typeLabels[type] || '编辑条目';
        const formHtml = _buildEditForm(type, item);

        _showModal(title, formHtml, async function (modalOverlay) {
            const data = _collectFormData(type, modalOverlay);
            if (!data) return false;

            try {
                await API.put(endpoint, data);
                showToast('更新成功', 'success');
                return true;
            } catch (err) {
                showToast('更新失败: ' + (err.message || '未知错误'), 'error');
                return false;
            }
        });
    }

    function _buildEditForm(type, item) {
        // Reuse create form but pre-fill values
        let html = '';

        switch (type) {
            case 'rules':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + escapeHtml(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + escapeHtml(item.content || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + escapeHtml(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">优先级</label>';
                html += '<select class="modal-select" name="priority">';
                html += '<option value="low"' + (item.priority === 'low' ? ' selected' : '') + '>低</option>';
                html += '<option value="medium"' + (item.priority === 'medium' ? ' selected' : '') + '>中</option>';
                html += '<option value="high"' + (item.priority === 'high' ? ' selected' : '') + '>高</option>';
                html += '</select></div>';
                html += '</div>';
                html += '<div class="form-group"><label class="form-label">作用域</label>';
                html += '<input class="modal-input" name="scope" value="' + escapeHtml(item.scope || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + escapeHtml((item.tags || []).join(', ')) + '" /></div>';
                break;

            case 'knowledge':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + escapeHtml(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + escapeHtml(item.content || '') + '</textarea></div>';
                html += '<div class="form-group"><label class="form-label">摘要</label>';
                html += '<textarea class="modal-textarea" name="summary" style="min-height:60px">' + escapeHtml(item.summary || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + escapeHtml(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">来源</label>';
                html += '<input class="modal-input" name="source" value="' + escapeHtml(item.source || '') + '" /></div>';
                html += '</div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + escapeHtml((item.tags || []).join(', ')) + '" /></div>';
                break;

            case 'experiences':
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + escapeHtml(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + escapeHtml(item.content || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + escapeHtml(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">严重度</label>';
                html += '<select class="modal-select" name="severity">';
                html += '<option value="low"' + (item.severity === 'low' ? ' selected' : '') + '>低</option>';
                html += '<option value="medium"' + (item.severity === 'medium' ? ' selected' : '') + '>中</option>';
                html += '<option value="high"' + (item.severity === 'high' ? ' selected' : '') + '>高</option>';
                html += '</select></div>';
                html += '</div>';
                html += '<div class="form-group"><label class="form-label">上下文</label>';
                html += '<textarea class="modal-textarea" name="context" style="min-height:60px">' + escapeHtml(item.context || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">工具名</label>';
                html += '<input class="modal-input" name="tool_name" value="' + escapeHtml(item.tool_name || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">错误类型</label>';
                html += '<input class="modal-input" name="error_type" value="' + escapeHtml(item.error_type || '') + '" /></div>';
                html += '</div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + escapeHtml((item.tags || []).join(', ')) + '" /></div>';
                break;

            case 'memories':
                html += '<div class="form-group"><label class="form-label">标题</label>';
                html += '<input class="modal-input" name="title" value="' + escapeHtml(item.title || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + escapeHtml(item.content || '') + '</textarea></div>';
                html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">';
                html += '<div class="form-group"><label class="form-label">分类</label>';
                html += '<input class="modal-input" name="category" value="' + escapeHtml(item.category || '') + '" /></div>';
                html += '<div class="form-group"><label class="form-label">重要性</label>';
                html += '<select class="modal-select" name="importance">';
                html += '<option value="low"' + (item.importance === 'low' ? ' selected' : '') + '>低</option>';
                html += '<option value="medium"' + (item.importance === 'medium' ? ' selected' : '') + '>中</option>';
                html += '<option value="high"' + (item.importance === 'high' ? ' selected' : '') + '>高</option>';
                html += '</select></div>';
                html += '</div>';
                html += '<div class="form-group"><label class="form-label">标签（逗号分隔）</label>';
                html += '<input class="modal-input" name="tags" value="' + escapeHtml((item.tags || []).join(', ')) + '" /></div>';
                break;

            default:
                html += '<div class="form-group"><label class="form-label">标题 *</label>';
                html += '<input class="modal-input" name="title" value="' + escapeHtml(item.title || '') + '" required /></div>';
                html += '<div class="form-group"><label class="form-label">内容 *</label>';
                html += '<textarea class="modal-textarea" name="content" required>' + escapeHtml(item.content || '') + '</textarea></div>';
        }

        return html;
    }

    // ==========================================
    // View Item Dialog
    // ==========================================
    async function viewItem(type, id) {
        let endpoint = '';

        switch (type) {
            case 'rules': endpoint = '/api/rules/' + id; break;
            case 'knowledge': endpoint = '/api/knowledge/items/' + id; break;
            case 'experiences': endpoint = '/api/experiences/' + id; break;
            case 'memories': endpoint = '/api/memories/' + id; break;
            default: showToast('未知类型', 'error'); return;
        }

        let item = null;
        try {
            item = await API.get(endpoint);
        } catch (err) {
            showToast('加载条目失败: ' + err.message, 'error');
            return;
        }

        if (!item) {
            showToast('条目未找到', 'error');
            return;
        }

        const typeLabels = {
            rules: '规则详情',
            knowledge: '知识详情',
            experiences: '经验详情',
            memories: '记忆详情',
        };

        const title = typeLabels[type] || '条目详情';
        const detailHtml = _buildItemDetail(type, item);

        _showModal(title, detailHtml, null, true); // readonly modal
    }

    function _buildItemDetail(type, item) {
        let html = '<div style="font-size:13px;line-height:1.7">';

        // Common fields
        if (item.title) {
            html += '<div style="margin-bottom:12px"><strong style="font-size:15px;color:var(--text-primary)">' + escapeHtml(item.title) + '</strong></div>';
        }

        if (item.content) {
            html += '<div style="margin-bottom:12px;white-space:pre-wrap;background:var(--bg);padding:12px;border-radius:var(--radius-xs);font-family:var(--font-mono);font-size:12px;line-height:1.6">' + escapeHtml(item.content) + '</div>';
        }

        if (item.summary) {
            html += '<div style="margin-bottom:12px"><strong>摘要:</strong><div style="margin-top:4px;color:var(--text-secondary)">' + escapeHtml(item.summary) + '</div></div>';
        }

        if (item.context) {
            html += '<div style="margin-bottom:12px"><strong>上下文:</strong><div style="margin-top:4px;color:var(--text-secondary);white-space:pre-wrap">' + escapeHtml(item.context) + '</div></div>';
        }

        // Metadata
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">';

        const metaFields = ['category', 'priority', 'severity', 'scope', 'source', 'confidence', 'importance', 'tool_name', 'error_type', 'type', 'status'];
        metaFields.forEach(function (field) {
            if (item[field]) {
                const label = field.replace(/_/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); });
                html += '<div><span style="color:var(--text-tertiary);font-size:11px">' + label + ':</span> <span style="font-weight:500">' + escapeHtml(String(item[field])) + '</span></div>';
            }
        });

        if (item.created_at) {
            html += '<div><span style="color:var(--text-tertiary);font-size:11px">创建时间:</span> <span>' + formatTime(item.created_at) + '</span></div>';
        }
        if (item.updated_at) {
            html += '<div><span style="color:var(--text-tertiary);font-size:11px">更新时间:</span> <span>' + formatTime(item.updated_at) + '</span></div>';
        }

        html += '</div>';

        // Tags
        if (item.tags && item.tags.length > 0) {
            html += '<div style="margin-top:12px;display:flex;gap:4px;flex-wrap:wrap">';
            item.tags.forEach(function (t) { html += '<span class="tag">' + escapeHtml(t) + '</span>'; });
            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    // ==========================================
    // Delete
    // ==========================================
    async function confirmDelete(type, id) {
        const typeLabels = {
            rules: '规则',
            knowledge: '知识条目',
            experiences: '经验',
            memories: '记忆',
        };

        const label = typeLabels[type] || '条目';

        // Use Components.Modal.confirm if available
        if (Components && Components.Modal && Components.Modal.confirm) {
            const confirmed = await Components.Modal.confirm({
                title: '删除' + label,
                message: '确定要删除这条' + label + '吗？此操作不可撤销。',
                confirmText: '删除',
                type: 'danger',
            });
            if (!confirmed) return;
        } else if (typeof showConfirmDialog === 'function') {
            // Fallback to confirm-dialog.js
            showConfirmDialog(
                '删除' + label,
                '确定要删除这条' + label + '吗？此操作不可撤销。',
                async function () { await _doDelete(type, id); }
            );
            return;
        } else {
            // Last resort: native confirm
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
            default: showToast('未知类型', 'error'); return;
        }

        try {
            await API.del(endpoint);
            showToast('删除成功', 'success');
            // Reload current tab
            await loadTab(_activeTab);
        } catch (err) {
            showToast('删除失败: ' + (err.message || '未知错误'), 'error');
        }
    }

    // ==========================================
    // Review Actions
    // ==========================================
    async function approveReview(id) {
        try {
            await API.put('/api/reviews/' + id + '/approve');
            showToast('审核已通过', 'success');
            await loadTab('reviews');
        } catch (err) {
            showToast('通过失败: ' + (err.message || '未知错误'), 'error');
        }
    }

    async function rejectReview(id) {
        try {
            await API.put('/api/reviews/' + id + '/reject', {});
            showToast('审核已拒绝', 'success');
            await loadTab('reviews');
        } catch (err) {
            showToast('拒绝失败: ' + (err.message || '未知错误'), 'error');
        }
    }

    async function batchApprove() {
        if (_selectedReviews.size === 0) {
            showToast('未选择审核条目', 'warning');
            return;
        }

        const ids = Array.from(_selectedReviews);

        if (Components && Components.Modal && Components.Modal.confirm) {
            const confirmed = await Components.Modal.confirm({
                title: '批量通过',
                message: '确定要通过 ' + ids.length + ' 条审核吗？',
                confirmText: '全部通过',
                type: 'info',
            });
            if (!confirmed) return;
        } else if (typeof showConfirmDialog === 'function') {
            showConfirmDialog('批量通过', '通过 ' + ids.length + ' 条审核？', async function () {
                await _doBatchApprove(ids);
            });
            return;
        } else {
            if (!confirm('通过 ' + ids.length + ' 条审核？')) return;
        }

        await _doBatchApprove(ids);
    }

    async function _doBatchApprove(ids) {
        try {
            await API.post('/api/reviews/batch/approve', { ids: ids });
            showToast(ids.length + ' 条审核已通过', 'success');
            _selectedReviews.clear();
            await loadTab('reviews');
        } catch (err) {
            showToast('批量通过失败: ' + (err.message || '未知错误'), 'error');
        }
    }

    async function batchReject() {
        if (_selectedReviews.size === 0) {
            showToast('未选择审核条目', 'warning');
            return;
        }

        const ids = Array.from(_selectedReviews);

        if (Components && Components.Modal && Components.Modal.confirm) {
            const confirmed = await Components.Modal.confirm({
                title: '批量拒绝',
                message: '确定要拒绝 ' + ids.length + ' 条审核吗？',
                confirmText: '全部拒绝',
                type: 'danger',
            });
            if (!confirmed) return;
        } else if (typeof showConfirmDialog === 'function') {
            showConfirmDialog('批量拒绝', '拒绝 ' + ids.length + ' 条审核？', async function () {
                await _doBatchReject(ids);
            });
            return;
        } else {
            if (!confirm('拒绝 ' + ids.length + ' 条审核？')) return;
        }

        await _doBatchReject(ids);
    }

    async function _doBatchReject(ids) {
        try {
            await API.post('/api/reviews/batch/reject', { ids: ids });
            showToast(ids.length + ' 条审核已拒绝', 'success');
            _selectedReviews.clear();
            await loadTab('reviews');
        } catch (err) {
            showToast('批量拒绝失败: ' + (err.message || '未知错误'), 'error');
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
            let infoHtml = '<span>' + (_reviewsData || []).length + ' 条审核</span>';
            if (_selectedReviews.size > 0) {
                infoHtml += '<span style="margin-left:8px;color:var(--accent)">' + _selectedReviews.size + ' 已选择</span>';
            }
            infoEl.innerHTML = infoHtml;
        }
    }

    // ==========================================
    // Rebuild Search Index
    // ==========================================
    async function rebuildIndex() {
        showToast('正在重建搜索索引...', 'info');
        try {
            await API.post('/api/search/index/rebuild');
            showToast('搜索索引已重建', 'success');
        } catch (err) {
            showToast('重建失败: ' + (err.message || '未知错误'), 'error');
        }
    }

    // ==========================================
    // Custom Modal System
    // ==========================================
    function _showModal(title, bodyHtml, onSubmit, readonly) {
        // Remove any existing custom modal
        document.querySelectorAll('.kb-modal-overlay').forEach(function (el) { el.remove(); });

        const overlay = document.createElement('div');
        overlay.className = 'kb-modal-overlay modal-overlay';

        let footerHtml = '';
        if (readonly) {
            footerHtml = '<button class="btn-secondary" data-action="closeModal">关闭</button>';
        } else {
            footerHtml = '<button class="btn-secondary" data-action="closeModal">取消</button>';
            footerHtml += '<button class="btn-primary" data-action="submitModal">保存</button>';
        }

        overlay.innerHTML =
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<h2>' + escapeHtml(title) + '</h2>' +
                    '<button class="modal-close" data-action="closeModal">' + Components.icon('close', 16) + '</button>' +
                '</div>' +
                '<div class="modal-body">' + bodyHtml + '</div>' +
                (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
            '</div>';

        document.body.appendChild(overlay);

        // Activate with a small delay for animation
        requestAnimationFrame(function () {
            overlay.classList.add('active');
        });

        // Store onSubmit callback
        overlay._onSubmit = onSubmit;

        // Bind modal events
        overlay.addEventListener('click', function (e) {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) {
                // Click on overlay background -> close
                if (e.target === overlay) {
                    _closeModal(overlay);
                }
                return;
            }

            const action = actionEl.dataset.action;
            switch (action) {
                case 'closeModal':
                    _closeModal(overlay);
                    break;
                case 'submitModal':
                    _handleSubmit(overlay);
                    break;
            }
        });

        // ESC key to close
        function escHandler(e) {
            if (e.key === 'Escape') {
                _closeModal(overlay);
                document.removeEventListener('keydown', escHandler);
            }
        }
        document.addEventListener('keydown', escHandler);
    }

    function _closeModal(overlay) {
        if (!overlay) return;
        overlay.classList.remove('active');
        setTimeout(function () {
            if (overlay.parentNode) overlay.remove();
        }, 250);
    }

    async function _handleSubmit(overlay) {
        if (!overlay._onSubmit) {
            _closeModal(overlay);
            return;
        }

        const shouldClose = await overlay._onSubmit(overlay);
        if (shouldClose) {
            _closeModal(overlay);
            // Reload current tab
            await loadTab(_activeTab);
        }
    }

    // ==========================================
    // Event Binding (Event Delegation)
    // ==========================================
    function _bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        // Remove old handler if exists
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
                    var searchInput = document.getElementById('kbSearchInput');
                    if (searchInput) performSearch(searchInput.value);
                    break;

                case 'clearSearch':
                    _searchTerm = '';
                    _searchResults = null;
                    var si = document.getElementById('kbSearchInput');
                    if (si) si.value = '';
                    loadTab(_activeTab);
                    break;

                case 'showCreate':
                    showCreateDialog(target.dataset.type || 'knowledge');
                    break;

                case 'rebuildIndex':
                    rebuildIndex();
                    break;

                case 'viewItem':
                    viewItem(target.dataset.type, target.dataset.id);
                    break;

                case 'editItem':
                    showEditDialog(target.dataset.type, target.dataset.id);
                    break;

                case 'deleteItem':
                    confirmDelete(target.dataset.type, target.dataset.id);
                    break;

                case 'filterRules':
                    _rulesFilter = target.dataset.filter;
                    var contentEl = document.getElementById('kbContent');
                    if (contentEl) contentEl.innerHTML = _buildRulesContent();
                    break;

                case 'filterKnowledge':
                    _knowledgeFilter = target.dataset.filter;
                    var contentEl2 = document.getElementById('kbContent');
                    if (contentEl2) contentEl2.innerHTML = _buildKnowledgeContent();
                    break;

                case 'filterExperiences':
                    _experiencesFilter = target.dataset.filter;
                    var contentEl3 = document.getElementById('kbContent');
                    if (contentEl3) contentEl3.innerHTML = _buildExperiencesContent();
                    break;

                case 'filterMemories':
                    _memoriesFilter = target.dataset.filter;
                    var contentEl4 = document.getElementById('kbContent');
                    if (contentEl4) contentEl4.innerHTML = _buildMemoriesContent();
                    break;

                case 'filterReviews':
                    _reviewsFilter = target.dataset.filter;
                    _selectedReviews.clear();
                    loadTab('reviews');
                    break;

                case 'approveReview':
                    approveReview(target.dataset.id);
                    break;

                case 'rejectReview':
                    rejectReview(target.dataset.id);
                    break;

                case 'batchApprove':
                    batchApprove();
                    break;

                case 'batchReject':
                    batchReject();
                    break;

                case 'toggleReviewSelect':
                    // checkbox toggle is handled by the browser, we just update state
                    toggleReviewSelect(target.dataset.id);
                    break;

                case 'closeModal':
                case 'submitModal':
                    // These are handled by the modal's own event listener
                    break;
            }
        };

        container.addEventListener('click', _boundHandler);

        // Search input Enter key
        var searchInput = document.getElementById('kbSearchInput');
        if (searchInput) {
            searchInput.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') {
                    performSearch(searchInput.value);
                }
            });
        }
    }

    // ==========================================
    // SSE Event Handler
    // ==========================================
    function onSSEEvent(type, _data) {
        var refreshTypes = [
            'knowledge.updated',
            'rules.updated',
            'experiences.updated',
            'memories.updated',
            'reviews.updated',
        ];

        if (refreshTypes.indexOf(type) !== -1) {
            if (_refreshTimer) return;
            _refreshTimer = setTimeout(function () {
                _refreshTimer = null;
                if (_activeTab === 'overview') {
                    _loadOverviewData().catch(function () {});
                }
            }, 500);
        }
    }

    // ==========================================
    // Public API
    // ==========================================
    return {
        render: render,
        destroy: destroy,
        onSSEEvent: onSSEEvent,
    };
})();
