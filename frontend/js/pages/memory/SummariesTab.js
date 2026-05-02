/**
 * 记忆管理页面 - 会话摘要 Tab
 */

const SummariesTab = (() => {
    let _summaries = [];
    let _searchTerm = '';
    let _destroyed = false;

    function buildSummariesTab() {
        if (_summaries.length === 0) {
            return `<div style="padding:60px 20px;text-align:center;color:var(--text-tertiary)">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('messageCircle', 32)}</div>
                <div style="font-size:14px;margin-bottom:4px">暂无会话摘要</div>
                <div style="font-size:12px">会话记录将自动生成摘要展示在这里</div>
            </div>`;
        }

        const filtered = _searchTerm
            ? _summaries.filter(
                  (s) =>
                      (s.title || '').toLowerCase().includes(_searchTerm.toLowerCase()) ||
                      (s.id || '').toLowerCase().includes(_searchTerm.toLowerCase()),
              )
            : _summaries;

        return `<div style="padding:8px 16px">
            <input type="text" id="memorySummariesSearch" placeholder="搜索..." value="${Components.escapeHtml(_searchTerm)}" style="width:100%;padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg);font-size:13px;outline:none;color:var(--text-primary)">
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;padding:0 16px 16px">
            ${filtered
                .map(
                    (s) => `<div class="session-item" data-action="viewSession" data-id="${s.id}" style="padding:12px 16px;background:var(--bg-secondary);border-radius:var(--radius-sm);border:1px solid var(--border);cursor:pointer">
                    <div style="display:flex;justify-content:space-between;align-items:center">
                        <span style="font-weight:500;font-size:13px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(s.title || s.id)}</span>
                        <span style="font-size:11px;color:var(--text-tertiary);margin-left:8px">${s.messages} 条消息</span>
                    </div>
                    <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px">${s.created ? Components.formatDateTime(s.created) : ''}</div>
                </div>`,
                )
                .join('')}
        </div>`;
    }

    function bindEvents() {
        const searchInput = document.getElementById('memorySummariesSearch');
        if (searchInput) {
            searchInput.addEventListener(
                'input',
                Components.debounce((e) => {
                    _searchTerm = e.target.value;
                    refreshContent();
                }, 300),
            );
        }

        const container = document.querySelector('#memory-summaries');
        if (container) {
            container.addEventListener('click', (e) => {
                const btn = e.target.closest('[data-action="viewSession"]');
                if (!btn) return;
                if (btn.dataset.id && window.App) {
                    window.App.navigate('sessions', btn.dataset.id);
                }
            });
        }
    }

    function refreshContent() {
        const container = document.querySelector('#memory-summaries');
        if (!container) return;
        container.innerHTML = buildSummariesTab();
        bindEvents();
    }

    function render(containerSelector, summaries) {
        _destroyed = false;
        _summaries = summaries || [];
        _searchTerm = '';

        const container = document.querySelector(containerSelector);
        if (!container) return;
        container.innerHTML = buildSummariesTab();
        bindEvents();
    }

    function destroy() {
        _destroyed = true;
        _summaries = [];
        _searchTerm = '';
    }

    return { render, destroy };
})();

export default SummariesTab;
