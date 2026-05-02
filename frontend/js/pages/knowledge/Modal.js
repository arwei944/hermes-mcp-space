/**
 * Knowledge Base Page - Modal System
 * Custom modal overlay with open/close/submit lifecycle
 */

import KnowledgeUtils from './utils.js';

const KnowledgeModal = (() => {
    let _loadTabFn = null;
    let _activeTab = 'overview';

    function init(activeTab, loadTabFn) {
        _activeTab = activeTab;
        _loadTabFn = loadTabFn;
    }

    function showModal(title, bodyHtml, onSubmit, readonly) {
        document.querySelectorAll('.kb-modal-overlay').forEach(function (el) { el.remove(); });

        const overlay = document.createElement('div');
        overlay.className = 'kb-modal-overlay modal-overlay';

        let footerHtml = '';
        if (readonly) {
            footerHtml = '<button class="btn-secondary" data-action="closeModal">关闭</button>';
        } else {
            footerHtml = '<button class="btn-secondary" data-action="closeModal">取消</button>';
            footerHtml += '<button class="btn-primary" data-action="submitModal">保存</button>';
        }

        overlay.innerHTML =
            '<div class="modal">' +
                '<div class="modal-header">' +
                    '<h2>' + KnowledgeUtils.escapeHtml(title) + '</h2>' +
                    '<button class="modal-close" data-action="closeModal">' + Components.icon('close', 16) + '</button>' +
                '</div>' +
                '<div class="modal-body">' + bodyHtml + '</div>' +
                (footerHtml ? '<div class="modal-footer">' + footerHtml + '</div>' : '') +
            '</div>';

        document.body.appendChild(overlay);
        requestAnimationFrame(function () { overlay.classList.add('active'); });
        overlay._onSubmit = onSubmit;

        overlay.addEventListener('click', function (e) {
            const actionEl = e.target.closest('[data-action]');
            if (!actionEl) { if (e.target === overlay) _closeModal(overlay); return; }
            switch (actionEl.dataset.action) {
                case 'closeModal': _closeModal(overlay); break;
                case 'submitModal': _handleSubmit(overlay); break;
            }
        });

        function escHandler(e) {
            if (e.key === 'Escape') { _closeModal(overlay); document.removeEventListener('keydown', escHandler); }
        }
        document.addEventListener('keydown', escHandler);
    }

    function _closeModal(overlay) {
        if (!overlay) return;
        overlay.classList.remove('active');
        setTimeout(function () { if (overlay.parentNode) overlay.remove(); }, 250);
    }

    async function _handleSubmit(overlay) {
        if (!overlay._onSubmit) { _closeModal(overlay); return; }
        const shouldClose = await overlay._onSubmit(overlay);
        if (shouldClose) { _closeModal(overlay); if (_loadTabFn) _loadTabFn(_activeTab); }
    }

    return { init, showModal };
})();

export default KnowledgeModal;
