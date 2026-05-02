/**
 * 数据同步页面 - 变更记录
 */

const Changelog = (() => {
    let _changelog = [];

    async function load() {
        try {
            const resp = await API.get('/api/version/changelog');
            _changelog = (resp.versions || []).slice(0, 5);
        } catch (_err) {
            _changelog = [];
        }
    }

    function buildSection() {
        if (_changelog.length === 0) return '';

        const listHtml = _changelog
            .map(
                (v) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span class="mono" style="font-weight:600;font-size:13px">v${Components.escapeHtml(v.version)}</span>
                    ${Components.renderBadge(v.title || '', 'blue')}
                    <span style="font-size:11px;color:var(--text-tertiary)">${Components.escapeHtml(v.date || '')}</span>
                </div>
                ${(v.changes || []).length > 0
                    ? `<ul style="margin:4px 0 0 16px;font-size:12px;color:var(--text-secondary);line-height:1.8">
                        ${v.changes.map((c) => `<li>${Components.escapeHtml(c)}</li>`).join('')}
                    </ul>`
                    : ''}
            </div>
        `,
            )
            .join('');

        return Components.renderSection('变更记录 (最近 5 个版本)', listHtml);
    }

    function destroy() {
        _changelog = [];
    }

    return { load, buildSection, destroy };
})();

export default Changelog;
