/**
 * 记忆管理页面 - 注册入口
 * V2 目录结构：register.js / page.js / EditorTab.js / LearningsTab.js / SummariesTab.js
 */

const MemoryPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = (await import('./page.js')).default;
        _modules.editorTab = (await import('./EditorTab.js')).default;
        _modules.learningsTab = (await import('./LearningsTab.js')).default;
        _modules.summariesTab = (await import('./SummariesTab.js')).default;
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        const [memoryData, userData, statsData] = await Promise.all([
            API.memory.getMemory().catch(() => ''),
            API.memory.getUser().catch(() => ''),
            API.memory.stats().catch(() => null),
        ]);

        const memoryContent = typeof memoryData === 'string' ? memoryData : memoryData.memory || '';
        const userContent = typeof userData === 'string' ? userData : userData.user || '';

        const learningsResp = await API.get('/api/knowledge/experiences').catch(() => ({ experiences: [] }));
        const learnings = (learningsResp.data || learningsResp.experiences || []);

        const sessionsResp = await API.get('/api/sessions').catch(() => ({ sessions: [] }));
        const _sessions = Array.isArray(sessionsResp) ? sessionsResp : (sessionsResp.data || sessionsResp.sessions || []);
        const summaries = _sessions.slice(0, 20).map((s) => ({
            id: s.id || s.session_id,
            title: s.title,
            messages: s.message_count || 0,
            created: s.created_at,
        }));

        container.innerHTML = _modules.page.buildLayout();

        _modules.editorTab.render('#memory-editor', memoryContent, userContent, statsData);
        _modules.learningsTab.render('#memory-learnings', learnings);
        _modules.summariesTab.render('#memory-summaries', summaries);
    }

    function switchTab(tab) {
        _modules.page.switchTab(tab);
    }

    function onSSEEvent(type, data) {}

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, switchTab, onSSEEvent, destroy };
})();

window.MemoryPage = ErrorHandler.wrap(MemoryPage);
