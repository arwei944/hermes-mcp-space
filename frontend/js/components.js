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
        // 知识库/数据
        knowledge: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/><path d="M6 1v2"/><path d="M18 1v2"/><path d="M6 21v2"/><path d="M18 21v2"/>',
        brain: '<path d="M12 2a8 8 0 0 0-8 8c0 3.4 2.1 6.3 5 7.5V20a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-2.5c2.9-1.2 5-4.1 5-7.5a8 8 0 0 0-8-8z"/><path d="M9 14h6"/><path d="M9 18h6"/>',
        lightbulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 2c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
        zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
        ghost: '<path d="M12 2a8 8 0 0 0-8 8v10l3-3 2 3 2-3 3 3V10a8 8 0 0 0-8-8z"/><circle cx="9" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="10" r="1" fill="currentColor" stroke="none"/>',
        globe: '<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>',
        plug: '<path d="M12 22v-5"/><path d="M9 10V4"/><path d="M15 10V4"/><path d="M18 10v5a6 6 0 0 1-12 0V10z"/>',
        wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
        chart: '<path d="M3 3v18h18"/><path d="m19 9-5 5-4-4-3 3"/>',
        activity: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
        bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
        user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
        package: '<path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/>',
        microscope: '<path d="M6 18h8"/><path d="M3 22h18"/><path d="M14 22a7 7 0 1 0 0-14h-1"/><path d="M9 14h2"/><path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z"/><path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3"/>',
        shield: '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
        dot: '<circle cx="12" cy="12" r="3"/>',
        store: '<path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/>',
        book: '<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>',
        puzzle: '<path d="M19.439 7.85c-.049.322.059.648.289.878l1.568 1.568c.47.47.706 1.087.706 1.704s-.235 1.233-.706 1.704l-1.611 1.611a.98.98 0 0 1-.837.276c-.47-.07-.802-.48-.968-.925a2.501 2.501 0 1 0-3.214 3.214c.446.166.855.497.925.968a.979.979 0 0 1-.276.837l-1.61 1.61a2.404 2.404 0 0 1-1.705.707 2.402 2.402 0 0 1-1.704-.706l-1.568-1.568a1.026 1.026 0 0 0-.877-.29c-.493.074-.84.504-1.02.968a2.5 2.5 0 1 1-3.237-3.237c.464-.18.894-.527.967-1.02a1.026 1.026 0 0 0-.289-.877l-1.568-1.568A2.402 2.402 0 0 1 1.998 12c0-.617.236-1.234.706-1.704L4.315 8.685a.98.98 0 0 1 .837-.276c.47.07.802.48.968.925a2.501 2.501 0 1 0 3.214-3.214c-.446-.166-.855-.497-.925-.968a.979.979 0 0 1 .276-.837l1.61-1.61a2.404 2.404 0 0 1 1.705-.707c.618 0 1.234.236 1.704.706l1.568 1.568c.23.23.556.338.877.29.493-.074.84-.504 1.02-.968a2.5 2.5 0 1 1 3.237 3.237c-.464.18-.894.527-.967 1.02z"/>',
        clipboard: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/>',
        settings: '<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
        x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
        radio: '<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>',
        file: '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M10 18H8"/><path d="M16 18h-2"/><path d="M12 12h.01"/>',
        monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
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

            const iconMap = { success: 'check', error: 'x', warning: 'alertTriangle', info: 'info' };
            const iconHtml = Components.icon(iconMap[type] || 'info', 14);

            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.innerHTML = `
                <span class="toast-icon">${iconHtml}</span>
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
        // icon 可以是 SVG 字符串或图标名称（自动转换）
        const iconHtml = (typeof icon === 'string' && icon.length < 20 && !icon.includes('<'))
            ? Components.icon(icon, 18)
            : icon;
        const changeHtml = change
            ? `<div class="stat-change ${change.startsWith('↑') || change.startsWith('▲') ? 'up' : change.startsWith('↓') ? 'down' : ''}">${change}</div>`
            : '';
        return `
            <div class="stat-card">
                <div class="stat-icon ${color || 'blue'}">${iconHtml}</div>
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

        let bodyHtml;
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
                <span class="tree-icon">${item.icon || Components.icon('file', 14)}</span>
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
        // 转换为北京时间 UTC+8
        const utc = date.getTime() + (date.getTimezoneOffset() * 60000);
        const bj = new Date(utc + (8 * 3600000));
        const now = new Date();
        const nowUtc = now.getTime() + (now.getTimezoneOffset() * 60000);
        const nowBj = new Date(nowUtc + (8 * 3600000));
        const pad = n => String(n).padStart(2, '0');
        const time = `${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`;
        // 今天（北京时间）
        if (bj.toDateString() === nowBj.toDateString()) return time;
        // 昨天（北京时间）
        const yesterdayBj = new Date(nowBj); yesterdayBj.setDate(yesterdayBj.getDate() - 1);
        if (bj.toDateString() === yesterdayBj.toDateString()) return `昨天 ${pad(bj.getHours())}:${pad(bj.getMinutes())}`;
        // 更早
        return `${bj.getFullYear()}-${pad(bj.getMonth()+1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}`;
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
