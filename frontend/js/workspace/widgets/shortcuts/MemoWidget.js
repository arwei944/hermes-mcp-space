/**
 * MemoWidget — 备忘录
 *
 * 功能: 简单的文本备忘录，内容保存到 localStorage，自动保存（防抖2s）
 * 类型: shortcut, category: shortcuts, defaultSize: {w:1, h:1}
 *
 * 依赖: WidgetRegistry (全局)
 */
const MemoWidget = (() => {
    'use strict';

    const DEBOUNCE_MS = 2000;

    function mount(container, props) {
        const cardId = props?.cardId || 'default';
        const storageKey = `hermes_workspace_memo_${cardId}`;

        // 读取已保存内容
        const savedContent = (() => {
            try {
                return localStorage.getItem(storageKey) || '';
            } catch (e) {
                return '';
            }
        })();

        container.innerHTML = `
            <div class="ws-widget" style="display:flex; flex-direction:column; height:100%;">
                <div class="ws-widget__content" style="flex:1; display:flex; flex-direction:column; padding:0;">
                    <textarea class="ws-widget__memo-textarea"
                              placeholder="在这里记录备忘..."
                              style="flex:1; width:100%; padding:12px; border:none; background:transparent; color:var(--text-primary); font-size:var(--text-sm); line-height:1.6; resize:none; outline:none; font-family:inherit;"
                    >${savedContent}</textarea>
                </div>
            </div>`;

        const textarea = container.querySelector('.ws-widget__memo-textarea');
        let _debounceTimer = null;
        let _saveIndicator = null;

        // 自动保存（防抖）
        const _handleInput = () => {
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => {
                try {
                    localStorage.setItem(storageKey, textarea.value);
                } catch (e) {
                    // localStorage 不可用时静默失败
                }
            }, DEBOUNCE_MS);
        };
        textarea.addEventListener('input', _handleInput);

        return {
            destroy() {
                // 销毁前立即保存
                clearTimeout(_debounceTimer);
                try {
                    localStorage.setItem(storageKey, textarea.value);
                } catch (e) {
                    // ignore
                }
                container.innerHTML = '';
            },
            refresh() {
                // 从 localStorage 重新加载
                try {
                    const content = localStorage.getItem(storageKey) || '';
                    textarea.value = content;
                } catch (e) {
                    // ignore
                }
            }
        };
    }

    WidgetRegistry.register('memo', {
        type: 'shortcut',
        label: '备忘录',
        icon: 'fileText',
        description: '文本备忘录，自动保存到本地',
        defaultSize: { w: 1, h: 1 },
        category: 'shortcuts',
        mount
    });
})();
