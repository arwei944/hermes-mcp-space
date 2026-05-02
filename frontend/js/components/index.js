/**
 * Hermes Agent 管理面板 - 通用 UI 组件 (Mac 极简风格)
 *
 * 组装入口：将所有子模块组装为 window.Components 对象
 * 加载顺序由 register.js 控制
 */

const Components = {
    // Icon 图标系统
    ICONS: _ICONS,
    icon: _icon,

    // Toast 通知
    Toast: _Toast,

    // Modal 模态框
    Modal: _Modal,

    // 布局组件
    createLoading: _createLoading,
    createSkeleton: _createSkeleton,
    createEmptyState: _createEmptyState,
    renderSection: _renderSection,
    createCard: _renderSection,
    createCardGrid: () => '',
    sectionTitle: _sectionTitle,
    createTabs: _createTabs,
    createFileTree: _createFileTree,
    createFilterGroup: _createFilterGroup,

    // 表单组件
    formGroup: _formGroup,
    formInput: _formInput,
    formTextarea: _formTextarea,
    formSelect: _formSelect,
    formSwitch: _formSwitch,

    // 数据展示
    renderStatCard: _renderStatCard,
    createStatsGrid: _createStatsGrid,
    createStatCard: _createStatCard,
    createTable: _createTable,
    renderBadge: _renderBadge,
    badge: _badge,
    renderToolCard: _renderToolCard,

    // 工具函数
    escapeHtml: _escapeHtml,
    formatTime: _formatTime,
    formatDateTime: _formatDateTime,
    truncate: _truncate,
    debounce: _debounce,
    renderMarkdown: _renderMarkdown,
    renderJson: _renderJson,
};

// 挂载到全局
window.Components = Components;

// 全局 Toast 快捷函数
function showToast(message, type = 'info', duration = 3500) {
    return Components.Toast.show(message, type, duration);
}
