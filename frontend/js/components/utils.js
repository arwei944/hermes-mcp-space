/**
 * Hermes Agent 管理面板 - 工具函数
 */

function _escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function _formatTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    // 后端已统一使用北京时间，前端直接按北京时间显示
    const options = { timeZone: 'Asia/Shanghai', hour12: false };
    const timeStr = date.toLocaleTimeString('zh-CN', { ...options, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const now = new Date();
    const todayStr = now.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const dateStr2 = date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    // 今天
    if (dateStr2 === todayStr) return timeStr;
    // 昨天
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai' });
    if (dateStr2 === yesterdayStr) {
        const hmStr = date.toLocaleTimeString('zh-CN', { ...options, hour: '2-digit', minute: '2-digit' });
        return `昨天 ${hmStr}`;
    }
    // 更早
    return date.toLocaleDateString('zh-CN', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' })
        + ' ' + date.toLocaleTimeString('zh-CN', { ...options, hour: '2-digit', minute: '2-digit' });
}

function _formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleString('zh-CN', {
        timeZone: 'Asia/Shanghai',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    });
}

function _truncate(str, maxLen = 50) {
    if (!str) return '';
    return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function _debounce(fn, delay = 300) {
    let timer;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

function _renderMarkdown(text) {
    if (typeof marked !== 'undefined') {
        marked.setOptions({ breaks: true, gfm: true });
        const rawHtml = marked.parse(text || '');
        if (typeof DOMPurify !== 'undefined') {
            return DOMPurify.sanitize(rawHtml, {
                ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li',
                               'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'a',
                               'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'img', 'span', 'div'],
                ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class']
            });
        }
        return rawHtml;
    }
    return (text || '').replace(/\n/g, '<br>');
}

function _renderJson(obj, indent = 2) {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, indent);
    return `<div class="schema-display">${_escapeHtml(json)}</div>`;
}
