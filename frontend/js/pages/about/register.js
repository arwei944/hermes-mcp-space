/**
 * 关于页面 - 注册入口
 * V2 目录结构：register.js / page.js / VersionTab.js / ChangelogTab.js / TechStackTab.js
 */

const AboutPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = await import('./page.js');
        _modules.versionTab = await import('./VersionTab.js');
        _modules.changelogTab = await import('./ChangelogTab.js');
        _modules.techStackTab = await import('./TechStackTab.js');
    }

    async function render() {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = _modules.page.buildLayout();
        _modules.versionTab.render('#about-version');
        _modules.changelogTab.render('#about-changelog');
        _modules.techStackTab.render('#about-techstack');
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

window.AboutPage = ErrorHandler.wrap(AboutPage);
