/**
 * Knowledge Base Page - Shared Utilities
 * Reusable helper functions used across all tabs
 */

const KnowledgeUtils = (() => {
    function escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = String(str);
        return div.innerHTML;
    }

    function formatTime(dateStr) {
        if (!dateStr) return '-';
        try {
            if (Components && typeof Components.formatTime === 'function') {
                return Components.formatTime(dateStr);
            }
        } catch (e) {}
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        const now = new Date();
        const diff = Math.floor((now - d) / 1000);
        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + '分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + '小时前';
        if (diff < 604800) return Math.floor(diff / 86400) + '天前';
        return d.toLocaleDateString();
    }

    function showToast(message, type) {
        if (Components && Components.Toast && typeof Components.Toast.show === 'function') {
            Components.Toast.show(message, type || 'info');
        } else {
            _customToast(message, type || 'info');
        }
    }

    function _customToast(message, type) {
        const colors = {
            success: 'var(--green)',
            error: 'var(--red)',
            warning: 'var(--orange)',
            info: 'var(--accent)',
        };
        const color = colors[type] || colors.info;
        const toast = document.createElement('div');
        toast.style.cssText =
            'position:fixed;top:20px;right:20px;z-index:10000;padding:12px 20px;' +
            'background:var(--surface);color:var(--text-primary);border-radius:8px;' +
            'border:1px solid var(--border);box-shadow:0 4px 16px rgba(0,0,0,0.12);' +
            'font-size:13px;max-width:400px;border-left:3px solid ' + color + ';' +
            'animation:slideIn 0.3s ease;';
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.2s';
            setTimeout(() => toast.remove(), 200);
        }, 3000);
    }

    function truncate(str, maxLen) {
        if (!str) return '';
        maxLen = maxLen || 80;
        return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
    }

    return { escapeHtml, formatTime, showToast, truncate };
})();

export default KnowledgeUtils;
