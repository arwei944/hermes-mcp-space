/**
 * Knowledge Base Page - Overview Tab
 * Stats cards, category grid, and empty state
 */

import KnowledgeUtils from './utils.js';

const OverviewTab = (() => {
    let _rulesStats = {};
    let _knowledgeStats = {};
    let _experiencesStats = {};
    let _memoriesStats = {};
    let _reviewsStats = {};

    async function loadOverviewData() {
        const [rulesStats, knowledgeStats, experiencesStats, memoriesStats, reviewsStats] = await Promise.allSettled([
            API.get('/api/rules/stats'),
            API.get('/api/knowledge/items/stats'),
            API.get('/api/experiences/stats'),
            API.get('/api/memories/stats'),
            API.get('/api/reviews/stats'),
        ]);

        _rulesStats = rulesStats.status === 'fulfilled' ? (rulesStats.value?.data || rulesStats.value || {}) : {};
        _knowledgeStats = knowledgeStats.status === 'fulfilled' ? (knowledgeStats.value?.data || knowledgeStats.value || {}) : {};
        _experiencesStats = experiencesStats.status === 'fulfilled' ? (experiencesStats.value?.data || experiencesStats.value || {}) : {};
        _memoriesStats = memoriesStats.status === 'fulfilled' ? (memoriesStats.value?.data || memoriesStats.value || {}) : {};
        _reviewsStats = reviewsStats.status === 'fulfilled' ? (reviewsStats.value?.data || reviewsStats.value || {}) : {};
    }

    function getStats() {
        return {
            rules: _rulesStats,
            knowledge: _knowledgeStats,
            experiences: _experiencesStats,
            memories: _memoriesStats,
            reviews: _reviewsStats,
        };
    }

    function updateBadges() {
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

    async function render(contentEl) {
        await loadOverviewData();

        const rulesTotal = _rulesStats.total || 0;
        const knowledgeTotal = _knowledgeStats.total || 0;
        const experiencesTotal = _experiencesStats.total || 0;
        const memoriesTotal = _memoriesStats.total || 0;
        const reviewsPending = _reviewsStats.pending || 0;
        const allTotal = rulesTotal + knowledgeTotal + experiencesTotal + memoriesTotal;

        contentEl.innerHTML = `
            <!-- 统计卡片行 -->
            <div class="ov-stats-row">
                <div class="ov-stat-card" data-action="switchTab" data-tab="rules">
                    <div class="ov-stat-icon" style="color:#0071e3">${Components.icon('shield', 20)}</div>
                    <div class="ov-stat-num">${rulesTotal}</div>
                    <div class="ov-stat-label">规则</div>
                </div>
                <div class="ov-stat-card" data-action="switchTab" data-tab="knowledge">
                    <div class="ov-stat-icon" style="color:#bf5af2">${Components.icon('book', 20)}</div>
                    <div class="ov-stat-num">${knowledgeTotal}</div>
                    <div class="ov-stat-label">知识</div>
                </div>
                <div class="ov-stat-card" data-action="switchTab" data-tab="experiences">
                    <div class="ov-stat-icon" style="color:#ff9f0a">${Components.icon('lightbulb', 20)}</div>
                    <div class="ov-stat-num">${experiencesTotal}</div>
                    <div class="ov-stat-label">经验</div>
                </div>
                <div class="ov-stat-card" data-action="switchTab" data-tab="memories">
                    <div class="ov-stat-icon" style="color:#30d158">${Components.icon('brain', 20)}</div>
                    <div class="ov-stat-num">${memoriesTotal}</div>
                    <div class="ov-stat-label">记忆</div>
                </div>
                <div class="ov-stat-card ${reviewsPending > 0 ? 'ov-stat-warn' : ''}" data-action="switchTab" data-tab="reviews">
                    <div class="ov-stat-icon" style="color:#ff453a">${Components.icon('clipboard', 20)}</div>
                    <div class="ov-stat-num">${reviewsPending}</div>
                    <div class="ov-stat-label">待审核</div>
                </div>
            </div>

            <!-- 分类卡片 2x2 -->
            <div class="ov-category-grid">
                <div class="ov-cat-card ov-cat-rules" data-action="switchTab" data-tab="rules">
                    <div class="ov-cat-header">
                        <div class="ov-cat-icon">${Components.icon('shield', 18)}</div>
                        <div class="ov-cat-title">规则</div>
                        <div class="ov-cat-count">${rulesTotal} 条</div>
                    </div>
                    <div class="ov-cat-desc">Agent 行为规则与约束，定义 AI 的行为边界和优先级</div>
                </div>
                <div class="ov-cat-card ov-cat-knowledge" data-action="switchTab" data-tab="knowledge">
                    <div class="ov-cat-header">
                        <div class="ov-cat-icon">${Components.icon('book', 18)}</div>
                        <div class="ov-cat-title">知识条目</div>
                        <div class="ov-cat-count">${knowledgeTotal} 条</div>
                    </div>
                    <div class="ov-cat-desc">结构化知识内容，包括技术文档、领域知识和参考信息</div>
                </div>
                <div class="ov-cat-card ov-cat-exp" data-action="switchTab" data-tab="experiences">
                    <div class="ov-cat-header">
                        <div class="ov-cat-icon">${Components.icon('lightbulb', 18)}</div>
                        <div class="ov-cat-title">经验</div>
                        <div class="ov-cat-count">${experiencesTotal} 条</div>
                    </div>
                    <div class="ov-cat-desc">从工具调用和错误中积累的最佳实践与问题解决方案</div>
                </div>
                <div class="ov-cat-card ov-cat-mem" data-action="switchTab" data-tab="memories">
                    <div class="ov-cat-header">
                        <div class="ov-cat-icon">${Components.icon('brain', 18)}</div>
                        <div class="ov-cat-title">记忆</div>
                        <div class="ov-cat-count">${memoriesTotal} 条</div>
                    </div>
                    <div class="ov-cat-desc">长期记忆与用户偏好，包括画像、习惯和重要上下文</div>
                </div>
            </div>

            ${allTotal === 0 ? `
            <!-- 空状态引导 -->
            <div class="ov-empty">
                <div class="ov-empty-icon">📚</div>
                <p class="ov-empty-title">知识库还是空的</p>
                <p class="ov-empty-sub">点击「新建」添加第一条知识，或使用 MCP 工具自动提取</p>
            </div>
            ` : ''}
        `;
    }

    return { loadOverviewData, getStats, updateBadges, render };
})();

export default OverviewTab;
