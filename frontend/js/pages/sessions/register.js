/**
 * 会话页面 - 注册入口
 * V2 目录结构：register.js / page.js / SessionList.js / ChatView.js / AnalyticsView.js / SessionDetail.js
 */

const SessionsPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.sessionList = await import('./SessionList.js');
        _modules.chatView = await import('./ChatView.js');
        _modules.analyticsView = await import('./AnalyticsView.js');
        _modules.sessionDetail = await import('./SessionDetail.js');
    }

    async function render(sessionId) {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        // Load base data
        let sessions = [];
        let allTags = [];
        try { sessions = await API.sessions.list(); } catch (_e) {}
        try { allTags = await API.sessions.tags(); } catch (_e) {}

        // Determine view mode
        const viewMode = _modules.sessionDetail.getViewMode();

        if (viewMode === 'analytics') {
            await _modules.analyticsView.loadAnalytics();
            container.innerHTML = _modules.page.buildLayout('analytics');
            _modules.analyticsView.render('#sessions-analytics');
            _modules.analyticsView.bindEvents();
            return;
        }

        // Chat view - load messages
        let currentId = sessionId || (sessions.length > 0 ? (sessions[0].id || sessions[0].session_id) : null);
        let messages = [];
        if (currentId) {
            try {
                const data = await API.sessions.messages(currentId);
                messages = data.messages || data || [];
            } catch (_e) {}
        }

        container.innerHTML = _modules.page.buildLayout('chat');
        _modules.sessionList.render('#sessions-sidebar', sessions, allTags, currentId);
        _modules.chatView.render('#sessions-main', sessions, currentId, messages);
        _modules.sessionDetail.bindGlobalEvents();
    }

    function onSSEEvent(type, data) {
        if (!_modules.sessionDetail) return;
        _modules.sessionDetail.onSSEEvent(type, data);
    }

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.SessionsPage = ErrorHandler.wrap(SessionsPage);
