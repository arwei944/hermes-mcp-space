/**
 * Hermes Agent 管理面板 - Toast 通知 & Modal 模态框
 */

// ==========================================
// Toast 通知
// ==========================================
const _Toast = {
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

    success(msg, duration) {
        return this.show(msg, 'success', duration);
    },
    error(msg, duration) {
        return this.show(msg, 'error', duration);
    },
    warning(msg, duration) {
        return this.show(msg, 'warning', duration);
    },
    info(msg, duration) {
        return this.show(msg, 'info', duration);
    },

    _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    },
};

// ==========================================
// Modal 模态框
// ==========================================
const _Modal = {
    overlay: null,
    titleEl: null,
    bodyEl: null,
    footerEl: null,
    _onClose: null,

    init() {
        this.overlay = document.getElementById('modalOverlay');
        this.titleEl = document.getElementById('modalTitle');
        this.bodyEl = document.getElementById('modalBody');
        this.footerEl = document.getElementById('modalFooter');
        document.getElementById('modalClose').addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.close();
        });
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
        if (this._onClose) {
            this._onClose();
            this._onClose = null;
        }
    },

    /**
     * 确认弹窗 — 用于删除/重置等破坏性操作
     * @param {Object} options
     * @param {string} options.title - 标题
     * @param {string} options.message - 描述文字（支持 HTML）
     * @param {string} [options.confirmText='确认'] - 确认按钮文字
     * @param {string} [options.cancelText='取消'] - 取消按钮文字
     * @param {string} [options.type='danger'] - 类型：danger / warning / info
     * @returns {Promise<boolean>} true=确认, false=取消
     */
    confirm({ title, message, confirmText, cancelText, type }) {
        return new Promise((resolve) => {
            const iconMap = { danger: 'alertTriangle', warning: 'alertTriangle', info: 'info' };
            const colorMap = { danger: 'var(--red)', warning: 'var(--orange)', info: 'var(--accent)' };
            const t = type || 'danger';
            const icon = iconMap[t] || 'alertTriangle';
            const color = colorMap[t] || 'var(--red)';

            const footer = `<div style="display:flex;gap:8px;justify-content:flex-end">
                <button class="btn btn-ghost" id="modalCancel">${cancelText || '取消'}</button>
                <button class="btn" id="modalConfirm" style="background:${color};color:#fff">${confirmText || '确认'}</button>
            </div>`;

            this.open({
                title: title || '确认操作',
                content: `<div style="display:flex;align-items:flex-start;gap:12px;padding:8px 0">
                    <div style="flex-shrink:0;color:${color};margin-top:2px">${Components.icon(icon, 20)}</div>
                    <div style="font-size:14px;line-height:1.6;color:var(--text-secondary)">${message || '确定要执行此操作吗？'}</div>
                </div>`,
                footer,
            });

            const cleanup = (result) => {
                this.close();
                resolve(result);
            };

            document.getElementById('modalCancel').onclick = () => cleanup(false);
            document.getElementById('modalConfirm').onclick = () => cleanup(true);
        });
    },

    /**
     * 提示弹窗 — 用于信息展示
     * @param {Object} options
     * @param {string} options.title - 标题
     * @param {string} options.message - 内容（支持 HTML）
     * @param {string} [options.buttonText='知道了'] - 按钮文字
     * @param {string} [options.type='info'] - 类型：info / success / warning / danger
     * @returns {Promise<void>}
     */
    alert({ title, message, buttonText, type }) {
        return new Promise((resolve) => {
            const iconMap = { info: 'info', success: 'checkCircle', warning: 'alertTriangle', danger: 'xCircle' };
            const colorMap = { info: 'var(--accent)', success: 'var(--green)', warning: 'var(--orange)', danger: 'var(--red)' };
            const t = type || 'info';
            const icon = iconMap[t] || 'info';
            const color = colorMap[t] || 'var(--accent)';

            const footer = `<div style="display:flex;justify-content:flex-end">
                <button class="btn" id="modalOk" style="background:${color};color:#fff">${buttonText || '知道了'}</button>
            </div>`;

            this.open({
                title: title || '提示',
                content: `<div style="display:flex;align-items:flex-start;gap:12px;padding:8px 0">
                    <div style="flex-shrink:0;color:${color};margin-top:2px">${Components.icon(icon, 20)}</div>
                    <div style="font-size:14px;line-height:1.6;color:var(--text-secondary)">${message || ''}</div>
                </div>`,
                footer,
            });

            document.getElementById('modalOk').onclick = () => {
                this.close();
                resolve();
            };
        });
    },
};
