/**
 * Knowledge Base Page - Register Entry Point
 * V2 directory structure: register.js / page.js / tab modules
 */

const KnowledgePage = (() => {
    let _page = null;

    async function _ensureModules() {
        if (_page) return;
        _page = await import('./page.js');
        const KnowledgeModal = await import('./Modal.js');
        KnowledgeModal.init(_page.getActiveTab(), _page.loadTab);
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        if (!container) return;

        container.innerHTML = Components.createLoading();

        _page._ensureStylesheet();

        // Load initial overview data (non-fatal)
        try {
            const OverviewTab = await import('./OverviewTab.js');
            await OverviewTab.loadOverviewData();
        } catch (_err) {}

        container.innerHTML = _page.buildPage();
        _page.bindEvents();

        // Load active tab content
        await _page.loadTab(_page.getActiveTab());
    }

    function destroy() {
        if (_page) {
            _page.destroy();
            _page = null;
        }
    }

    function onSSEEvent(type, data) {
        if (_page) _page.onSSEEvent(type, data);
    }

    return { render, destroy, onSSEEvent };
})();

window.KnowledgePage = ErrorHandler.wrap(KnowledgePage);
