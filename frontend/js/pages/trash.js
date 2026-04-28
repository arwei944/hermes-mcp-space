/**
 * 回收站页面
 * 查看已删除项目、恢复、永久删除
 */

const TrashPage = (() => {
    let _items = [];
    let _filterType = '';

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();
        try {
            const data = await API.request('GET', '/api/trash');
            _items = data.items || [];
        } catch (err) { _items = []; }
        container.innerHTML = buildPage();
        bindEvents();
    }

    function getFiltered() {
        if (!_filterType) return _items;
        return _items.filter(i => i.type === _filterType);
    }

    function buildPage() {
        const filtered = getFiltered();
        const typeCounts = {};
        _items.forEach(i => { typeCounts[i.type] = (typeCounts[i.type] || 0) + 1; });
        const typeLabels = { session: '会话', skill: '技能', memory: '记忆', plugin: '插件', config: '配置' };

        const filterHtml = `<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap">
            <select id="trashFilter" style="padding:8px 12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg);font-size:13px;outline:none;color:var(--text)">
                <option value="">全部 (${_items.length})</option>
                ${Object.entries(typeCounts).map(([t, c]) => `<option value="${t}" ${_filterType === t ? 'selected' : ''}>${typeLabels[t] || t} (${c})</option>`).join('')}
            </select>
            ${_items.length > 0 ? `<button type="button" class="btn btn-sm btn-ghost" style="color:var(--red);margin-left:auto" data-action="emptyTrash">清空回收站</button>` : ''}
        </div>`;

        const listHtml = filtered.length === 0
            ? Components.createEmptyState('🗑️', '回收站为空', '删除的项目会出现在这里', '')
            : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px">
                ${filtered.map(item => {
                    const typeLabel = typeLabels[item.type] || item.type;
                    const typeColor = { session: 'blue', skill: 'purple', memory: 'green', plugin: 'orange', config: 'gray' }[item.type] || 'gray';
                    return `<div style="border:1px solid var(--border);border-radius:var(--radius-sm);padding:16px">
                        <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
                            <div>
                                <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px">
                                    <span style="font-weight:600;font-size:14px">${Components.escapeHtml(item.item_name || item.item_id)}</span>
                                    ${Components.renderBadge(typeLabel, typeColor)}
                                </div>
                                <div style="font-size:11px;color:var(--text-tertiary)">删除于 ${Components.formatDateTime(item.deleted_at)}</div>
                            </div>
                        </div>
                        ${item.metadata && item.metadata.description ? `<div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px">${Components.escapeHtml(item.metadata.description)}</div>` : ''}
                        <div style="display:flex;gap:8px;justify-content:flex-end">
                            <button type="button" class="btn btn-sm btn-primary" data-action="restore" data-id="${item.id}">恢复</button>
                            <button type="button" class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="permDelete" data-id="${item.id}">永久删除</button>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

        return Components.renderSection('回收站', filterHtml + listHtml);
    }

    async function restoreItem(id) {
        try {
            await API.request('POST', `/api/trash/restore/${id}`);
            Components.Toast.success('已恢复');
            await render();
        } catch (err) { Components.Toast.error(`恢复失败: ${err.message}`); }
    }

    async function permanentDelete(id) {
        try {
            await API.request('DELETE', `/api/trash/${id}`);
            Components.Toast.success('已永久删除');
            await render();
        } catch (err) { Components.Toast.error(`删除失败: ${err.message}`); }
    }

    async function emptyTrash() {
        try {
            await API.request('DELETE', '/api/trash');
            Components.Toast.success('回收站已清空');
            await render();
        } catch (err) { Components.Toast.error(`清空失败: ${err.message}`); }
    }

    function bindEvents() {
        const container = document.getElementById('contentBody');
        if (!container) return;

        container.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action]');
            if (!btn) return;
            const action = btn.dataset.action;
            const id = btn.dataset.id;
            switch (action) {
                case 'restore': restoreItem(id); break;
                case 'permDelete': permanentDelete(id); break;
                case 'emptyTrash': emptyTrash(); break;
            }
        });

        const filter = document.getElementById('trashFilter');
        if (filter) {
            filter.addEventListener('change', (e) => {
                _filterType = e.target.value;
                document.getElementById('contentBody').innerHTML = buildPage();
                bindEvents();
            });
        }
    }

    return { render };
})();
