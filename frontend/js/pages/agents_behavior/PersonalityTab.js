/**
 * Agent 行为管理页面 - 人格定义 Tab
 * AGENTS.md 编辑器 + Markdown 预览 + 保存 + 填充模板
 */

import { DEFAULT_TEMPLATE } from './constants.js';

const PersonalityTab = (() => {
    // ========== 私有状态 ==========
    let _soulContent = '';
    let _originalSoulContent = '';
    let _isSaving = false;
    let _isDirty = false;

    // ========== 数据加载 ==========

    async function loadData() {
        const soulResult = await API.get('/api/knowledge/soul').catch(() => null);
        _soulContent = (soulResult && typeof soulResult === 'object' ? soulResult.content : soulResult) || '';
        _originalSoulContent = _soulContent;
    }

    // ========== 内容构建 ==========

    function buildContent() {
        const charCount = _soulContent.length;
        const lineCount = _soulContent ? _soulContent.split('\n').length : 0;
        const dirtyIndicator = _isDirty ? '<span style="color:var(--orange);font-size:11px;margin-left:8px">* 未保存</span>' : '';

        return `<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${Components.icon('ghost', 16)} AGENTS.md 人格定义</span>
                ${dirtyIndicator}
            </div>
            <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:11px;color:var(--text-tertiary)">${charCount} 字符 / ${lineCount} 行</span>
                <button type="button" class="btn btn-sm btn-ghost" data-action="fillTemplate">${Components.icon('clipboard', 12)} 填充模板</button>
                <button type="button" class="btn btn-sm btn-primary" data-action="saveSoul" ${_isSaving ? 'disabled' : ''}>${Components.icon('save', 12)} 保存</button>
            </div>
        </div>
        <div id="abEditorPane" style="display:grid;grid-template-columns:1fr 1fr;gap:12px;height:calc(100vh - 260px);min-height:400px">
            <div style="display:flex;flex-direction:column;overflow:hidden">
                <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;display:flex;align-items:center;gap:4px">
                    ${Components.icon('edit', 12)} 编辑器 <span style="margin-left:auto;font-size:10px;color:var(--text-tertiary)">Ctrl+S 保存</span>
                </div>
                <textarea id="abSoulEditor" style="flex:1;width:100%;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);color:var(--text);font-family:'SF Mono',Menlo,monospace;font-size:13px;line-height:1.6;resize:none;outline:none;tab-size:4">${Components.escapeHtml(_soulContent)}</textarea>
            </div>
            <div style="display:flex;flex-direction:column;overflow:hidden">
                <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:6px;display:flex;align-items:center;gap:4px">
                    ${Components.icon('eye', 12)} Markdown 预览
                </div>
                <div id="abSoulPreview" style="flex:1;overflow-y:auto;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-secondary);font-size:13px;line-height:1.7;color:var(--text-primary)">
                    ${Components.renderMarkdown(_soulContent)}
                </div>
            </div>
        </div>`;
    }

    // ========== 编辑器事件 ==========

    function bindEditorEvents() {
        const editor = document.getElementById('abSoulEditor');
        if (!editor) return;

        const debouncedPreview = Components.debounce(() => {
            const preview = document.getElementById('abSoulPreview');
            if (preview) {
                preview.innerHTML = Components.renderMarkdown(editor.value);
            }
        }, 300);

        editor.addEventListener('input', () => {
            _soulContent = editor.value;
            _isDirty = _soulContent !== _originalSoulContent;
            debouncedPreview();
        });
    }

    // ========== 操作函数 ==========

    async function saveSoul() {
        if (_isSaving) return;
        const editor = document.getElementById('abSoulEditor');
        if (!editor) return;

        const content = editor.value;
        if (!content.trim()) {
            Components.Toast.warning('内容不能为空');
            return;
        }

        _isSaving = true;
        try {
            await API.post('/api/knowledge/soul', { content: content });
            _soulContent = content;
            _originalSoulContent = content;
            _isDirty = false;
            Components.Toast.success('人格定义已保存');
            // 更新预览
            const preview = document.getElementById('abSoulPreview');
            if (preview) {
                preview.innerHTML = Components.renderMarkdown(content);
            }
        } catch (err) {
            Components.Toast.error('保存失败: ' + (err.message || '未知错误'));
        } finally {
            _isSaving = false;
        }
    }

    async function fillTemplate() {
        if (_soulContent.trim() && _isDirty) {
            const confirmed = await Components.Modal.confirm({
                title: '填充模板',
                message: '当前编辑器有未保存的内容，填充模板将覆盖现有内容。是否继续？',
                confirmText: '覆盖',
                cancelText: '取消',
                type: 'warning',
            });
            if (!confirmed) return;
        }
        const editor = document.getElementById('abSoulEditor');
        if (!editor) return;
        editor.value = DEFAULT_TEMPLATE;
        _soulContent = DEFAULT_TEMPLATE;
        _isDirty = true;
        // 更新预览
        const preview = document.getElementById('abSoulPreview');
        if (preview) {
            preview.innerHTML = Components.renderMarkdown(DEFAULT_TEMPLATE);
        }
        Components.Toast.info('已填充默认模板，请根据需要修改');
    }

    // ========== 生命周期 ==========

    function destroy() {
        _soulContent = '';
        _originalSoulContent = '';
        _isSaving = false;
        _isDirty = false;
    }

    return {
        loadData,
        buildContent,
        bindEditorEvents,
        saveSoul,
        fillTemplate,
        destroy,
    };
})();

export default PersonalityTab;
