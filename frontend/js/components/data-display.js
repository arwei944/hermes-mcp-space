/**
 * Hermes Agent 管理面板 - 数据展示组件
 */

// ==========================================
// 统计卡片 (Mac 风格)
// ==========================================
function _renderStatCard(label, value, change, icon, color, desc) {
    // icon 可以是 SVG 字符串或图标名称（自动转换）
    const iconHtml =
        typeof icon === 'string' && icon.length < 20 && !icon.includes('<') ? Components.icon(icon, 18) : icon;
    const descHtml = desc ? `<div class="stat-desc" style="font-size:11px;color:var(--text-tertiary);margin-top:4px;line-height:1.4">${desc}</div>` : '';
    const changeHtml = change
        ? `<div class="stat-change ${change.startsWith('↑') || change.startsWith('▲') ? 'up' : change.startsWith('↓') ? 'down' : ''}">${change}</div>`
        : '';
    return `
        <div class="stat-card">
            <div class="stat-icon ${color || 'blue'}">${iconHtml}</div>
            <div class="stat-label">${label}</div>
            <div class="stat-value">${value}</div>
            ${changeHtml}
            ${descHtml}
        </div>
    `;
}

function _createStatsGrid(stats) {
    return `<div class="stats">${stats.map((s) => _renderStatCard(s.label, s.value, s.change, s.icon, s.color)).join('')}</div>`;
}

// 兼容旧接口
function _createStatCard(icon, value, label, changeText, changeType) {
    const changeHtml = changeText ? `<div class="stat-change ${changeType || ''}">${changeText}</div>` : '';
    return `<div class="stat-card"><div class="stat-icon blue">${icon}</div><div class="stat-value">${value}</div><div class="stat-label">${label}</div>${changeHtml}</div>`;
}

// ==========================================
// 表格
// ==========================================
function _createTable({ columns, rows, actions, emptyText, toolbar }) {
    const headerCells = columns.map((col) => `<th>${col.label}</th>`).join('');
    let allHeaderCells = headerCells;
    if (actions) allHeaderCells += '<th style="width:120px">操作</th>';

    let bodyHtml;
    if (!rows || rows.length === 0) {
        const colSpan = columns.length + (actions ? 1 : 0);
        bodyHtml = `<tr><td colspan="${colSpan}" style="text-align:center;padding:40px;color:var(--text-tertiary)">${emptyText || '暂无数据'}</td></tr>`;
    } else {
        bodyHtml = rows
            .map((row, idx) => {
                const cells = columns
                    .map((col) => {
                        const value = col.render ? col.render(row[col.key], row, idx) : (row[col.key] ?? '-');
                        return `<td>${value}</td>`;
                    })
                    .join('');
                let actionCell = '';
                if (actions) actionCell = `<td class="table-actions-cell">${actions(row, idx)}</td>`;
                return `<tr>${cells}${actionCell}</tr>`;
            })
            .join('');
    }

    let toolbarHtml = '';
    if (toolbar) {
        toolbarHtml = `<div class="table-toolbar">
            ${toolbar.search ? `<div class="search-input"><input type="text" placeholder="${toolbar.search.placeholder || '搜索...'}" id="${toolbar.search.id || 'tableSearch'}"></div>` : ''}
            <div class="table-actions">${toolbar.actions || ''}</div>
        </div>`;
    }

    return `<div class="section">${toolbarHtml}<table class="table"><thead><tr>${allHeaderCells}</tr></thead><tbody>${bodyHtml}</tbody></table></div>`;
}

// ==========================================
// Badge 标签
// ==========================================
function _renderBadge(text, type = 'blue') {
    return `<span class="badge badge-${type}">${text}</span>`;
}

function _badge(text, type = 'blue') {
    return _renderBadge(text, type);
}

// ==========================================
// 工具卡片
// ==========================================
function _renderToolCard(name, desc, set) {
    return `<div class="tool-card"><div class="tool-name">${_escapeHtml(name)}</div><div class="tool-desc">${_escapeHtml(desc)}</div><div class="tool-set">${set || ''}</div></div>`;
}
