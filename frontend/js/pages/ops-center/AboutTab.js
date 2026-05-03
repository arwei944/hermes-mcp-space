/**
 * Ops Center - 关于系统 Tab
 * 复用 about 页面的 VersionTab, ChangelogTab, TechStackTab
 */

var OpsAboutTab = (() => {
    var _destroyed = false;
    var _modules = {};
    var _currentSubTab = 'version';

    function _buildSubTabs() {
        var tabs = [
            { key: 'version', label: '版本信息' },
            { key: 'changelog', label: '变更记录' },
            { key: 'techstack', label: '技术栈' },
        ];

        var tabsHtml = tabs.map(function(tab) {
            var isActive = tab.key === _currentSubTab;
            var activeStyle = isActive
                ? 'background:var(--accent);color:#fff'
                : 'background:var(--bg-secondary);color:var(--text-secondary)';
            return '<button class="btn btn-sm" data-action="switchAboutSubTab" data-tab="' + tab.key + '" style="' + activeStyle + ';border:1px solid var(--border);padding:6px 16px;border-radius:var(--radius-tag);cursor:pointer;font-size:12px;transition:all 0.15s">' +
                Components.escapeHtml(tab.label) +
            '</button>';
        }).join('');

        return '<div style="display:flex;gap:8px;margin-bottom:16px">' + tabsHtml + '</div>';
    }

    function _switchSubTab(tab) {
        _currentSubTab = tab;

        var panels = {
            version: '#opsAboutVersion',
            changelog: '#opsAboutChangelog',
            techstack: '#opsAboutTechstack',
        };

        Object.keys(panels).forEach(function(key) {
            var el = document.querySelector(panels[key]);
            if (el) el.style.display = key === tab ? '' : 'none';
        });

        // Update tab button styles
        var container = document.querySelector('#opsAboutTabContainer');
        if (container) {
            container.querySelectorAll('[data-action="switchAboutSubTab"]').forEach(function(btn) {
                var isActive = btn.dataset.tab === tab;
                btn.style.background = isActive ? 'var(--accent)' : 'var(--bg-secondary)';
                btn.style.color = isActive ? '#fff' : 'var(--text-secondary)';
            });
        }
    }

    function bindEvents(container) {
        container.addEventListener('click', function(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;
            if (target.dataset.action === 'switchAboutSubTab') {
                _switchSubTab(target.dataset.tab);
            }
        });
    }

    async function render(containerSelector) {
        _destroyed = false;
        var container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createLoading();

        // 动态导入 about 页面组件
        try {
            _modules.versionTab = (await import('../about/VersionTab.js')).default;
            _modules.changelogTab = (await import('../about/ChangelogTab.js')).default;
            _modules.techStackTab = (await import('../about/TechStackTab.js')).default;
        } catch (_err) {
            container.innerHTML = '<div style="text-align:center;color:var(--red);padding:40px">组件加载失败</div>';
            return;
        }

        if (_destroyed) return;

        container.innerHTML =
            '<div id="opsAboutTabContainer">' +
                _buildSubTabs() +
                '<div id="opsAboutVersion"></div>' +
                '<div id="opsAboutChangelog" style="display:none"></div>' +
                '<div id="opsAboutTechstack" style="display:none"></div>' +
            '</div>';

        bindEvents(container);

        // 渲染子 tab
        try {
            await _modules.versionTab.render('#opsAboutVersion');
            await _modules.changelogTab.render('#opsAboutChangelog');
            await _modules.techStackTab.render('#opsAboutTechstack');
        } catch (_err) {
            // ignore
        }
    }

    function destroy() {
        _destroyed = true;
        if (_modules.versionTab && _modules.versionTab.destroy) _modules.versionTab.destroy();
        if (_modules.changelogTab && _modules.changelogTab.destroy) _modules.changelogTab.destroy();
        if (_modules.techStackTab && _modules.techStackTab.destroy) _modules.techStackTab.destroy();
        _modules = {};
    }

    return { render, destroy };
})();

export default OpsAboutTab;
