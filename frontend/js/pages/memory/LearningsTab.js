/**
 * 记忆管理页面 - 学习记录 Tab
 */

const LearningsTab = (() => {
    let _learnings = [];
    let _searchTerm = '';
    let _destroyed = false;

    function buildLearningsTab() {
        if (_learnings.length === 0) {
            return `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('lightbulb', 32)}</div>
                <div style="font-size:14px;margin-bottom:4px">暂无学习记录</div>
                <div style="font-size:12px">Agent 在对话中积累的经验将自动记录在这里</div>
            </div>`;
        }

        const filtered = _searchTerm
            ? _learnings.filter(
                  (l) =>
                      (l.content || '').toLowerCase().includes(_searchTerm.toLowerCase()) ||
                      (l.title || '').toLowerCase().includes(_searchTerm.toLowerCase()),
              )
            : _learnings;

        if (filtered.length === 0) {
            return `<div style="padding:40px 20px;text-align:center;color:var(--text-tertiary)">
                <div>未找到匹配的学习记录</div>
            </div>`;
        }

        return `<div style="padding:8px 16px">
            <input type="text" id="memoryLearningsSearch" placeholder="搜索..." value="${Components.escapeHtml(_searchTerm)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text-primary)">
        </div>
        <div style="display:flex;flex-direction:column;gap:12px;padding:0 16px 16px">
            ${filtered
                .map(
                    (l, i) => `<div style="padding:16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border)">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                        <span style="font-weight:500;font-size:13px">${Components.escapeHtml(l.title || `学习记录 #${i + 1}`)}</span>
                        <span style="font-size:11px;color:var(--text-tertiary)">${l.created_at ? Components.formatDateTime(l.created_at) : ''}</span>
                    </div>
                    <div class="markdown-body" style="font-size:13px">${Components.renderMarkdown(l.content || '（无内容）')}</div>
                </div>`,
                )
                .join('')}
        </div>`;
    }

    function bindEvents() {
        const searchInput = document.getElementById('memoryLearningsSearch');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _searchTerm = e.target.value;
                    refreshContent();
                }, 300),
            );
        }
    }

    function refreshContent() {
        const container = document.querySelector('#memory-learnings');
        if (!container) return;
        container.innerHTML = buildLearningsTab();
        bindEvents();
    }

    function render(containerSelector, learnings) {
        _destroyed = false;
        _learnings = learnings || [];
        _searchTerm = '';

        const container = document.querySelector(containerSelector);
        if (!container) return;
        container.innerHTML = buildLearningsTab();
        bindEvents();
    }

    function destroy() {
        _destroyed = true;
        _learnings = [];
        _searchTerm = '';
    }

    return { render, destroy };
})();

export default LearningsTab;
