/**
 * Hermes Agent 管理面板 - 通用 UI 组件 (Mac 极简风格)
 */

const Components = (() => {

    // ==========================================
    // Icon 图标系统 (Lucide 风格, 24x24 viewBox)
    // ==========================================
    const ICONS = {
        // 侧边栏导航
        dashboard: '<rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/>',
        session: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
        tools: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
        skills: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
        memory: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
        plugins: '<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61 1.61a2.404 2.404 0 0 1 1.705-.707c.618 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894-.527.967-1.02z"/>',
        cron: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        agents: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
        mcp: '<path d="M12 22v-5"/><path d="M9 8V2"/><path d="M15 8V2"/><path d="M18 8v5a6 6 0 0 1-12 0V8z"/>',
        logs: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 9H8"/><path d="M16 13H8"/><path d="M16 17H8"/>',
        config: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        about: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        theme: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
        moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
        // 通用操作
        refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        close: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        trash: '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" x2="10" y1="11" y2="17"/><line x1="14" x2="14" y1="11" y2="17"/>',
        edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
        eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
        plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
        minus: '<path d="M5 12h14"/>',
        chevronDown: '<path d="m6 9 6 6 6-6"/>',
        chevronRight: '<path d="m9 18 6-6-6-6"/>',
        externalLink: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
        warning: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
        error: '<circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>',
        success: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
        menu: '<line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/>',
        code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
        terminal: '<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>',
        star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
        download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>',
        upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" x2="12" y1="3" y2="15"/>',
        copy: '<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        play: '<polygon points="6 3 20 12 6 21 6 3"/>',
        pause: '<rect width="4" height="16" x="6" y="4"/><rect width="4" height="16" x="14" y="4"/>',
    };

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

            const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

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
            ? `<div class="stat-change ${change.startsWith('↑') || change.startsWith('▲') ? 'up' : change.startsWith('↓') ? 'down' : ''}">${change}</div>`
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
                <span class="tree-icon">${item.icon || '📄'}</span>
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
        const pad = n => String(n).padStart(2, '0');
        const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
        // 今天：只显示时间
        if (diff < 86400000 && date.getDate() === now.getDate()) return time;
        // 昨天
        const yesterday = new Date(now); yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth()) return `昨天 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
        // 更早
        return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
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

    // ==========================================
    // Icon 渲染
    // ==========================================
    function icon(name, size = 16, className = '') {
        const paths = ICONS[name];
        if (!paths) return '';
        const cls = className ? ` class="${className}"` : '';
        return `<svg${cls} width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
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
        icon, ICONS,
    };
})();

// 全局 Toast 快捷函数
function showToast(message, type = 'info', duration = 3500) {
    return Components.Toast.show(message, type, duration);
}
