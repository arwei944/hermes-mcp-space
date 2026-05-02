/**
 * Hermes Agent 管理面板 - 布局组件
 */

// ==========================================
// 加载 / 骨架 / 空状态
// ==========================================
function _createLoading() {
    return '<div class="loading-spinner"><div class="spinner"></div></div>';
}

function _createSkeleton(rows = 3) {
    let html = '';
    for (let i = 0; i < rows; i++) {
        html += `<div class="skeleton" style="height:20px;margin-bottom:12px;width:${60 + Math.random() * 40}%"></div>`;
    }
    return html;
}

function _createEmptyState(icon, title, description, actionHtml) {
    return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-desc">${description}</div>${actionHtml || ''}</div>`;
}

// ==========================================
// Section 区块
// ==========================================
function _renderSection(title, content, action) {
    return `<div class="section">
        <div class="section-header">
            <span class="section-title">${title}</span>
            ${action ? `<span class="section-action">${action}</span>` : ''}
        </div>
        <div class="section-body">${content}</div>
    </div>`;
}

// ==========================================
// 页面区块标题
// ==========================================
function _sectionTitle(title) {
    return `<div class="page-section-title">${title}</div>`;
}

// ==========================================
// Tab 切换
// ==========================================
function _createTabs(tabs, activeTab, onClickFn) {
    const tabsHtml = tabs
        .map((tab) => {
            const isActive = tab.key === activeTab;
            return `<div class="tab-item ${isActive ? 'active' : ''}" onclick="${onClickFn}('${tab.key}')">${tab.label}</div>`;
        })
        .join('');
    return `<div class="tabs">${tabsHtml}</div>`;
}

// ==========================================
// 文件树
// ==========================================
function _createFileTree({ title, items, actions, activeId }) {
    const itemsHtml = items
        .map(
            (item) => `
        <div class="file-tree-item ${activeId === item.id ? 'active' : ''}" data-id="${item.id}" onclick="${item.onClick || ''}">
            <span class="tree-icon">${item.icon || Components.icon('file', 14)}</span>
            <span class="tree-name">${item.name}</span>
            <div class="tree-actions">${actions ? actions(item) : ''}</div>
        </div>
    `,
        )
        .join('');

    return `<div class="file-tree"><div class="file-tree-header"><h3>${title || '文件树'}</h3></div>${itemsHtml}</div>`;
}

// ==========================================
// 过滤标签组
// ==========================================
function _createFilterGroup(tags, activeTag, onClickFn) {
    const tagsHtml = tags
        .map((tag) => {
            const isActive = tag === activeTag || (activeTag === 'all' && tag === '全部');
            return `<span class="filter-tag ${isActive ? 'active' : ''}" onclick="${onClickFn}('${tag}')">${tag}</span>`;
        })
        .join('');
    return `<div class="filter-group">${tagsHtml}</div>`;
}
