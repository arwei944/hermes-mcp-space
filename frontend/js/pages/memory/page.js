/**
 * 记忆管理页面 - 页面骨架与 Tab 切换
 */

const MemoryPageLayout = (() => {
    let _activeTab = 'memory';
    let _editorTab = null;

    function setEditorTab(editorTab) {
        _editorTab = editorTab;
    }

    function buildLayout() {
        const tabs = Components.createTabs(
            [
                { key: 'memory', label: '长期记忆' },
                { key: 'user', label: '用户画像' },
                { key: 'learnings', label: '学习记录' },
                { key: 'summaries', label: '会话摘要' },
            ],
            _activeTab,
            'MemoryPage.switchTab',
        );

        return `${tabs}
            <div id="memoryTabContent">
                <div id="memory-editor"></div>
                <div id="memory-learnings" style="display:none"></div>
                <div id="memory-summaries" style="display:none"></div>
            </div>`;
    }

    async function switchTab(tab) {
        if (_activeTab === tab) return;

        // 未保存检测：仅在编辑器 Tab 之间切换时检查
        if ((_activeTab === 'memory' || _activeTab === 'user') && _editorTab) {
            const hasUnsaved = _editorTab.hasUnsavedChanges(_activeTab);
            if (hasUnsaved) {
                const ok = await Components.Modal.confirm({
                    title: '未保存的更改',
                    message: '当前编辑器有未保存的更改，切换 Tab 将丢失这些更改。是否继续？',
                    confirmText: '放弃更改',
                    type: 'warning',
                });
                if (!ok) return;
            }
        }

        _activeTab = tab;

        const panels = {
            memory: '#memory-editor',
            user: '#memory-editor',
            learnings: '#memory-learnings',
            summaries: '#memory-summaries',
        };

        Object.entries(panels).forEach(([key, selector]) => {
            const el = document.querySelector(selector);
            if (el) el.style.display = key === tab ? '' : 'none';
        });

        document.querySelectorAll('#memoryTabs .tab-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.key === tab);
        });

        // 通知编辑器切换了子 tab
        if ((tab === 'memory' || tab === 'user') && _editorTab) {
            _editorTab.onTabSwitch(tab);
        }
    }

    function getActiveTab() {
        return _activeTab;
    }

    return { buildLayout, switchTab, setEditorTab, getActiveTab };
})();

export default MemoryPageLayout;
