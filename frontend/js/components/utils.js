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
    // 转换为北京时间 UTC+8
    const utc = date.getTime() + date.getTimezoneOffset() * 60000;
    const bj = new Date(utc + 8 * 3600000);
    const now = new Date();
    const nowUtc = now.getTime() + now.getTimezoneOffset() * 60000;
    const nowBj = new Date(nowUtc + 8 * 3600000);
    const pad = (n) => String(n).padStart(2, '0');
    const time = `${pad(bj.getHours())}:${pad(bj.getMinutes())}:${pad(bj.getSeconds())}`;
    // 今天（北京时间）
    if (bj.toDateString() === nowBj.toDateString()) return time;
    // 昨天（北京时间）
    const yesterdayBj = new Date(nowBj);
    yesterdayBj.setDate(yesterdayBj.getDate() - 1);
    if (bj.toDateString() === yesterdayBj.toDateString())
        return `昨天 ${pad(bj.getHours())}:${pad(bj.getMinutes())}`;
    // 更早
    return `${bj.getFullYear()}-${pad(bj.getMonth() + 1)}-${pad(bj.getDate())} ${pad(bj.getHours())}:${pad(bj.getMinutes())}`;
}

function _formatDateTime(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
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
        return marked.parse(text || '');
    }
    return (text || '').replace(/\n/g, '<br>');
}

function _renderJson(obj, indent = 2) {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, indent);
    return `<div class="schema-display">${_escapeHtml(json)}</div>`;
}
