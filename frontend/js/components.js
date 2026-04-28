/**
 * Hermes Agent 管理面板 - 通用 UI 组件 (Mac 极简风格)
 */

const Components = (() => {

    // ==========================================
    // Toast 通知
    // ==========================================
    const Toast = {
        container: null,

        init() {
            this.container = document.getElementById('toastContainer');
        },

        show(message, type = 'info', duration = 3500) {
            if (!this.container) this.init();

            const icons = { success: '\u2713', error: '\u2715', warning: '\u26A0', info: '\u2139' };

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${icons[type] || icons.info}</span>
                <span class="toast-message">${this._escapeHtml(message)}</span>
                <button class="toast-close" onclick="this.parentElement.classList.add('toast-out');setTimeout(()=>this.parentElement.remove(),200)">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>
                </button>
            `;

            this.container.appendChild(toast);

            if (duration > 0) {
                setTimeout(() => {
                    toast.classList.add('toast-out');
                    setTimeout(() => toast.remove(), 200);
                }, duration);
            }

            return toast;
        },

        success(msg, duration) { return this.show(msg, 'success', duration); },
        error(msg, duration) { return this.show(msg, 'error', duration); },
        warning(msg, duration) { return this.show(msg, 'warning', duration); },
        info(msg, duration) { return this.show(msg, 'info', duration); },

        _escapeHtml(str) {
            const div = document.createElement('div');
            div.textContent = str;
            return div.innerHTML;
        },
    };

    // ==========================================
    // Modal 模态框
    // ==========================================
    const Modal = {
        overlay: null, titleEl: null, bodyEl: null, footerEl: null, _onClose: null,

        init() {
            this.overlay = document.getElementById('modalOverlay');
            this.titleEl = document.getElementById('modalTitle');
            this.bodyEl = document.getElementById('modalBody');
            this.footerEl = document.getElementById('modalFooter');
            document.getElementById('modalClose').addEventListener('click', () => this.close());
            this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.close(); });
        },

        open({ title, content, footer, size, onClose }) {
            if (!this.overlay) this.init();
            this.titleEl.textContent = title || '';
            this.bodyEl.innerHTML = content || '';
            this.footerEl.innerHTML = footer || '';
            this._onClose = onClose;
            this.overlay.querySelector('.modal').className = 'modal';
            if (size === 'lg') this.overlay.querySelector('.modal').classList.add('modal-lg');
            if (size === 'xl') this.overlay.querySelector('.modal').classList.add('modal-xl');
            this.overlay.classList.add('active');
            document.body.style.overflow = 'hidden';
        },

        close() {
            if (!this.overlay) return;
            this.overlay.classList.remove('active');
            document.body.style.overflow = '';
            if (this._onClose) { this._onClose(); this._onClose = null; }
        },
    };

    // ==========================================
    // 加载 / 骨架 / 空状态
    // ==========================================
    function createLoading() {
        return '<div class="loading-spinner"><div class="spinner"></div></div>';
    }

    function createSkeleton(rows = 3) {
        let html = '';
        for (let i = 0; i < rows; i++) {
            html += `<div class="skeleton" style="height:20px;margin-bottom:12px;width:${60 + Math.random() * 40}%"></div>`;
        }
        return html;
    }

    function createEmptyState(icon, title, description, actionHtml) {
        return `<div class="empty-state"><div class="empty-icon">${icon}</div><div class="empty-title">${title}</div><div class="empty-desc">${description}</div>${actionHtml || ''}</div>`;
    }

    // ==========================================
    // 统计卡片 (Mac 风格)
    // ==========================================
    function renderStatCard(label, value, change, icon, color) {
        const changeHtml = change
            ? `<div class="stat-change ${change.startsWith('\u2191') || change.startsWith('\u25B2') ? 'up' : change.startsWith('\u2193') ? 'down' : ''}">${change}</div>`
            : '';
        return `
            <div class="stat-card">
                <div class="stat-icon ${color || 'blue'}">${icon}</div>
                <div class="stat-label">${label}</div>
                <div class="stat-value">${value}</div>
                ${changeHtml}
            </div>
        `;
    }

    function createStatsGrid(stats) {
        return `<div class="stats">${stats.map(s => renderStatCard(s.label, s.value, s.change, s.icon, s.color)).join('')}</div>`;
    }

    // 兼容旧接口
    function createStatCard(icon, value, label, changeText, changeType) {
        const changeHtml = changeText ? `<div class="stat-change ${changeType || ''}">${changeText}</div>` : '';
        return `<div class="stat-card"><div class="stat-icon blue">${icon}</div><div class="stat-value">${value}</div><div class="stat-label">${label}</div>${changeHtml}</div>`;
    }

    // ==========================================
    // 表格
    // ==========================================
    function createTable({ columns, rows, actions, emptyText, toolbar }) {
        const headerCells = columns.map(col => `<th>${col.label}</th>`).join('');
        let allHeaderCells = headerCells;
        if (actions) allHeaderCells += '<th style="width:120px">操作</th>';

        let bodyHtml = '';
        if (!rows || rows.length === 0) {
            const colSpan = columns.length + (actions ? 1 : 0);
            bodyHtml = `<tr><td colspan="${colSpan}" style="text-align:center;padding:40px;color:var(--text-tertiary)">${emptyText || '暂无数据'}</td></tr>`;
        } else {
            bodyHtml = rows.map((row, idx) => {
                const cells = columns.map(col => {
                    const value = col.render ? col.render(row[col.key], row, idx) : (row[col.key] ?? '-');
                    return `<td>${value}</td>`;
                }).join('');
                let actionCell = '';
                if (actions) actionCell = `<td class="table-actions-cell">${actions(row, idx)}</td>`;
                return `<tr>${cells}${actionCell}</tr>`;
            }).join('');
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
    // Section 区块
    // ==========================================
    function renderSection(title, content, action) {
        return `<div class="section">
            <div class="section-header">
                <span class="section-title">${title}</span>
                ${action ? `<span class="section-action">${action}</span>` : ''}
            </div>
            <div class="section-body">${content}</div>
        </div>`;
    }

    // ==========================================
    // Badge 标签
    // ==========================================
    function renderBadge(text, type = 'blue') {
        return `<span class="badge badge-${type}">${text}</span>`;
    }

    function badge(text, type = 'blue') {
        return renderBadge(text, type);
    }

    // ==========================================
    // 工具卡片
    // ==========================================
    function renderToolCard(name, desc, set) {
        return `<div class="tool-card"><div class="tool-name">${escapeHtml(name)}</div><div class="tool-desc">${escapeHtml(desc)}</div><div class="tool-set">${set || ''}</div></div>`;
    }

    // ==========================================
    // 表单组件
    // ==========================================
    function formGroup(label, inputHtml, hint) {
        return `<div class="form-group"><label class="form-label">${label}</label>${inputHtml}${hint ? `<div class="form-hint">${hint}</div>` : ''}</div>`;
    }

    function formInput(name, placeholder, value, type = 'text') {
        return `<input class="form-input" type="${type}" name="${name}" placeholder="${placeholder || ''}" value="${value || ''}">`;
    }

    function formTextarea(name, placeholder, value, rows = 5) {
        return `<textarea class="form-textarea" name="${name}" placeholder="${placeholder || ''}" rows="${rows}">${value || ''}</textarea>`;
    }

    function formSelect(name, options, value) {
        const opts = options.map(opt => {
            const optValue = typeof opt === 'object' ? opt.value : opt;
            const optLabel = typeof opt === 'object' ? opt.label : opt;
            const selected = optValue === value ? 'selected' : '';
            return `<option value="${optValue}" ${selected}>${optLabel}</option>`;
        }).join('');
        return `<select class="form-select" name="${name}">${opts}</select>`;
    }

    function formSwitch(name, label, checked) {
        return `<label class="form-switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span class="switch-label">${label}</span></label>`;
    }

    // ==========================================
    // 文件树
    // ==========================================
    function createFileTree({ title, items, actions, activeId }) {
        const itemsHtml = items.map(item => `
            <div class="file-tree-item ${activeId === item.id ? 'active' : ''}" data-id="${item.id}" onclick="${item.onClick || ''}">
                <span class="tree-icon">${item.icon || '\uD83D\uDCC4'}</span>
                <span class="tree-name">${item.name}</span>
                <div class="tree-actions">${actions ? actions(item) : ''}</div>
            </div>
        `).join('');

        return `<div class="file-tree"><div class="file-tree-header"><h3>${title || '文件树'}</h3></div>${itemsHtml}</div>`;
    }

    // ==========================================
    // 过滤标签组
    // ==========================================
    function createFilterGroup(tags, activeTag, onClickFn) {
        const tagsHtml = tags.map(tag => {
            const isActive = tag === activeTag || (activeTag === 'all' && tag === '全部');
            return `<span class="filter-tag ${isActive ? 'active' : ''}" onclick="${onClickFn}('${tag}')">${tag}</span>`;
        }).join('');
        return `<div class="filter-group">${tagsHtml}</div>`;
    }

    // ==========================================
    // Tab 切换
    // ==========================================
    function createTabs(tabs, activeTab, onClickFn) {
        const tabsHtml = tabs.map(tab => {
            const isActive = tab.key === activeTab;
            return `<div class="tab-item ${isActive ? 'active' : ''}" onclick="${onClickFn}('${tab.key}')">${tab.label}</div>`;
        }).join('');
        return `<div class="tabs">${tabsHtml}</div>`;
    }

    // ==========================================
    // 页面区块标题
    // ==========================================
    function sectionTitle(title) {
        return `<div class="page-section-title">${title}</div>`;
    }

    // ==========================================
    // Markdown 渲染
    // ==========================================
    function renderMarkdown(text) {
        if (typeof marked !== 'undefined') {
            marked.setOptions({ breaks: true, gfm: true });
            return marked.parse(text || '');
        }
        return (text || '').replace(/\n/g, '<br>');
    }

    // ==========================================
    // JSON 格式化
    // ==========================================
    function renderJson(obj, indent = 2) {
        const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, indent);
        return `<div class="schema-display">${escapeHtml(json)}</div>`;
    }

    // ==========================================
    // 工具函数
    // ==========================================
    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function formatTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return '刚刚';
        if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
        if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    function formatDateTime(dateStr) {
        if (!dateStr) return '-';
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    function truncate(str, maxLen = 50) {
        if (!str) return '';
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    }

    function debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    return {
        Toast, Modal,
        createLoading, createSkeleton, createEmptyState,
        createStatCard, createStatsGrid, renderStatCard,
        createTable, createCard: renderSection, createCardGrid: () => '',
        createFileTree, createFilterGroup, createTabs,
        badge, renderBadge, renderToolCard, renderSection,
        sectionTitle,
        formGroup, formInput, formTextarea, formSelect, formSwitch,
        renderMarkdown, renderJson,
        escapeHtml, formatTime, formatDateTime, truncate, debounce,
    };
})();

// 全局 Toast 快捷函数
function showToast(message, type = 'info', duration = 3500) {
    return Components.Toast.show(message, type, duration);
}
