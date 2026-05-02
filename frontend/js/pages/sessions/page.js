/**
 * 会话页面 - 页面骨架
 * 提供页面框架：视图切换栏 + sidebar 容器 + main 容器 / analytics 容器
 */

const SessionsPageLayout = (() => {

    function buildViewToggle(viewMode, sessionCount) {
        return '<div style="display:flex;align-items:center;gap:4px;padding:8px 16px;background:var(--bg-secondary);border-bottom:1px solid var(--border)">' +
            '<div style="display:flex;gap:2px;background:var(--bg);border-radius:var(--radius-xs);padding:2px">' +
                '<button type="button" class="btn btn-sm" data-action="toggleViewMode" data-mode="chat" style="font-size:12px;padding:4px 12px;border-radius:var(--radius-xs);' + (viewMode === 'chat' ? 'background:var(--accent);color:#fff' : 'color:var(--text-secondary)') + ';display:flex;align-items:center;gap:4px">' + Components.icon('messageCircle', 13) + ' 对话</button>' +
                '<button type="button" class="btn btn-sm" data-action="toggleViewMode" data-mode="analytics" style="font-size:12px;padding:4px 12px;border-radius:var(--radius-xs);' + (viewMode === 'analytics' ? 'background:var(--accent);color:#fff' : 'color:var(--text-secondary)') + ';display:flex;align-items:center;gap:4px">' + Components.icon('chart', 13) + ' 分析</button>' +
            '</div>' +
            '<div style="flex:1"></div>' +
            '<span style="font-size:11px;color:var(--text-tertiary)">' + sessionCount + ' 个会话</span>' +
        '</div>';
    }

    function buildLayout(viewMode, sessionCount) {
        sessionCount = sessionCount || 0;
        var viewToggle = buildViewToggle(viewMode, sessionCount);

        if (viewMode === 'analytics') {
            return '<style>' +
                '.analytics-card { background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px; }' +
                '.analytics-card-title { font-size:13px;font-weight:500;display:flex;align-items:center;gap:6px;margin-bottom:12px;color:var(--text-primary); }' +
                '.overview-grid { display:grid;grid-template-columns:repeat(5,1fr);gap:12px; }' +
                '.overview-card { background:var(--bg);border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px;text-align:center; }' +
                '.overview-card .num { font-size:28px;font-weight:700;color:var(--text-primary);line-height:1.2; }' +
                '.overview-card .label { font-size:11px;color:var(--text-tertiary);margin-top:4px; }' +
                '.trend-bar-container { display:flex;align-items:flex-end;gap:3px;height:120px;padding:0 4px; }' +
                '.trend-bar { flex:1;min-width:0;border-radius:3px 3px 0 0;background:var(--blue);transition:height .3s ease;position:relative;cursor:pointer; }' +
                '.trend-bar:hover { opacity:0.8; }' +
                '.trend-labels { display:flex;gap:3px;padding:4px 4px 0;font-size:10px;color:var(--text-tertiary); }' +
                '.trend-labels span { flex:1;text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }' +
                '.period-toggle { display:inline-flex;gap:2px;background:var(--bg-secondary);border-radius:var(--radius-xs);padding:2px; }' +
                '.period-btn { font-size:11px;padding:3px 10px;border-radius:var(--radius-xs);cursor:pointer;border:none;background:transparent;color:var(--text-secondary); }' +
                '.period-btn.active { background:var(--accent);color:#fff; }' +
                '.dist-row { display:flex;align-items:center;gap:8px;margin-bottom:8px; }' +
                '.dist-label { font-size:12px;color:var(--text-secondary);width:100px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap; }' +
                '.dist-bar { flex:1;height:20px;border-radius:var(--radius-xs);min-width:4px;transition:width .3s ease; }' +
                '.dist-count { font-size:11px;color:var(--text-tertiary);width:40px;text-align:right;flex-shrink:0; }' +
                '.hour-bar-container { display:flex;align-items:flex-end;gap:4px;height:80px;padding:0 4px; }' +
                '.hour-bar { flex:1;min-width:0;border-radius:3px 3px 0 0;transition:height .3s ease; }' +
                '.hour-labels { display:flex;gap:4px;padding:4px 4px 0;font-size:10px;color:var(--text-tertiary); }' +
                '.hour-labels span { flex:1;text-align:center; }' +
                '.behavior-row { display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px; }' +
                '.behavior-row:last-child { border-bottom:none; }' +
                '.behavior-key { color:var(--text-secondary); }' +
                '.behavior-val { color:var(--text-primary);font-weight:500; }' +
            '</style>' +
            viewToggle +
            '<div id="sessions-analytics"></div>';
        }

        // Chat view
        return '<style>' +
            '@keyframes typingBounce { 0% { opacity: 0.3; transform: translateY(0); } 100% { opacity: 1; transform: translateY(-4px); } }' +
            '@keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(79,70,229,0.3); } 50% { box-shadow: 0 0 0 6px rgba(79,70,229,0); } }' +
            '.session-item.pulse { animation: pulse 1.5s infinite; }' +
            '.session-item.pulse.active { animation: none; }' +
            '.tool-call-card:hover { border-color: var(--accent); }' +
            '.export-dropdown div:hover { background: var(--bg-secondary); }' +
            '.knowledge-dropdown div:hover { background: var(--bg-secondary); }' +
            '.tag-chip:hover { opacity: 0.85; }' +
            '.batch-action-bar { position:sticky;bottom:0;left:0;right:0;background:var(--bg);border-top:1px solid var(--border);padding:10px 12px;display:flex;align-items:center;gap:8px;z-index:40;box-shadow:0 -2px 8px rgba(0,0,0,0.1); }' +
            '.batch-action-bar .btn { font-size: 12px; padding: 4px 10px; }' +
        '</style>' +
        viewToggle +
        '<div class="chat-layout">' +
            '<div class="chat-sidebar" id="sessions-sidebar"></div>' +
            '<div class="chat-main" id="sessions-main"></div>' +
        '</div>';
    }

    return { buildLayout, buildViewToggle };
})();

export default SessionsPageLayout;
