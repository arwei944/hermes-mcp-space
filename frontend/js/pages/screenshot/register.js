const ScreenshotPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.screenshotGrid = await import('./ScreenshotGrid.js');
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = _modules.page.buildLayout();
        await _modules.screenshotGrid.render('#screenshot-grid');
    }

    function onSSEEvent(type, data) {}

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.ScreenshotPage = ErrorHandler.wrap(ScreenshotPage);
