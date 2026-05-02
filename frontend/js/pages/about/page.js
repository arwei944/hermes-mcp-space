/**
 * 关于页面 - 页面骨架与 Tab 切换
 */

const AboutPageLayout = (() => {
    let _activeTab = 'version';

    function buildLayout() {
        const tabs = Components.createTabs(
            [
                { key: 'version', label: '版本信息' },
                { key: 'changelog', label: '变更记录' },
                { key: 'techstack', label: '技术栈' },
            ],
            _activeTab,
            'AboutPage.switchTab',
        );

        return `${tabs}
            <div id="aboutTabContent">
                <div id="about-version"></div>
                <div id="about-changelog" style="display:none"></div>
                <div id="about-techstack" style="display:none"></div>
            </div>
            <div style="max-width:960px;text-align:center;padding:24px 0;color:var(--text-tertiary);font-size:12px">
                <p>&copy; 2026 Hermes Agent &middot; MIT License</p>
                <p style="margin-top:4px">
                    <a href="https://github.com/arwei944/hermes-mcp-space" target="_blank" style="color:var(--accent);text-decoration:none">GitHub</a>
                    &middot;
                    <a href="https://huggingface.co/spaces/arwei944/hermes-mcp-space" target="_blank" style="color:var(--accent);text-decoration:none">HuggingFace</a>
                </p>
            </div>`;
    }

    function switchTab(tab) {
        _activeTab = tab;
        const panels = {
            version: '#about-version',
            changelog: '#about-changelog',
            techstack: '#about-techstack',
        };
        Object.entries(panels).forEach(([key, selector]) => {
            const el = document.querySelector(selector);
            if (el) el.style.display = key === tab ? '' : 'none';
        });
        document.querySelectorAll('#aboutTabs .tab-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.key === tab);
        });
    }

    return { buildLayout, switchTab };
})();

export default AboutPageLayout;
