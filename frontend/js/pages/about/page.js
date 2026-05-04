/**
 * 关于页面 - 页面骨架与 Tab 切换
 */

const AboutPageLayout = (() => {
    let _activeTab = 'version';
    let _metaUrls = null;

    const FALLBACK_URLS = {
        github: 'https://github.com/arwei944/hermes-mcp-space',
        huggingface: 'https://huggingface.co/spaces/arwei944/hermes-mcp-space',
    };

    async function _loadMetaUrls() {
        if (_metaUrls) return _metaUrls;
        try {
            const meta = await API.meta();
            _metaUrls = {
                github: meta.github_url || FALLBACK_URLS.github,
                huggingface: meta.huggingface_url || FALLBACK_URLS.huggingface,
            };
        } catch {
            _metaUrls = { ...FALLBACK_URLS };
        }
        return _metaUrls;
    }

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
                    <a id="about-link-github" href="${FALLBACK_URLS.github}" target="_blank" style="color:var(--accent);text-decoration:none">GitHub</a>
                    &middot;
                    <a id="about-link-huggingface" href="${FALLBACK_URLS.huggingface}" target="_blank" style="color:var(--accent);text-decoration:none">HuggingFace</a>
                </p>
            </div>`;
    }

    async function initLinks() {
        const urls = await _loadMetaUrls();
        const ghLink = document.getElementById('about-link-github');
        const hfLink = document.getElementById('about-link-huggingface');
        if (ghLink) ghLink.href = urls.github;
        if (hfLink) hfLink.href = urls.huggingface;
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

    return { buildLayout, switchTab, initLinks };
})();

export default AboutPageLayout;
