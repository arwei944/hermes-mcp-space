// -*- coding: utf-8 -*-
/**
 * Logger — 结构化日志
 * 5 个级别（debug/info/warn/error/silent），彩色控制台输出，日志缓冲
 * v12: warn/error 级别自动上报后端
 */
const Logger = (() => {
    'use strict';
    const _buffer = [];
    const MAX_BUFFER = 100;
    let _level = 'info';
    const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
    const COLORS = { debug: '#8e8e93', info: '#0071e3', warn: '#ff9500', error: '#ff3b30' };

    // --- 日志上报模块 ---
    var _reportBuffer = [];
    var _reportTimer = null;

    function _flushToBackend() {
        if (_reportBuffer.length === 0) return;
        var batch = _reportBuffer.splice(0, 10);
        var payload = {
            type: 'js_warn',
            message: batch.map(function(b) { return '[' + b.level + '] ' + b.msg; }).join('\n'),
            context: 'Logger',
            count: batch.length,
        };
        try {
            if (navigator && navigator.sendBeacon) {
                navigator.sendBeacon('/api/ops/frontend-errors', JSON.stringify(payload));
            } else if (typeof fetch !== 'undefined') {
                fetch('/api/ops/frontend-errors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload),
                    keepalive: true,
                }).catch(function() {});
            }
        } catch (_) { /* ignore */ }
    }

    function _log(level, args) {
        if (LEVELS[level] < LEVELS[_level]) return;
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const entry = { level: level, timestamp: ts, args: args.map(function(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); } }) };
        _buffer.push(entry);
        if (_buffer.length > MAX_BUFFER) _buffer.shift();
        const color = COLORS[level] || '#000';
        console.log('%c[' + ts + '] [' + level.toUpperCase() + ']', 'color: ' + color + '; font-weight: bold', ...args);

        // warn/error 级别上报后端
        if (level === 'warn' || level === 'error') {
            var msg = args.map(function(a) { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch(e) { return String(a); } }).join(' ');
            _reportBuffer.push({ level: level, msg: msg });
            if (_reportBuffer.length >= 10) _flushToBackend();
            if (!_reportTimer) _reportTimer = setInterval(_flushToBackend, 10000);
        }
    }

    function debug(...a) { _log('debug', a); }
    function info(...a) { _log('info', a); }
    function warn(...a) { _log('warn', a); }
    function error(...a) { _log('error', a); }
    function setLevel(l) { _level = l; }
    function getBuffer() { return [..._buffer]; }
    function clear() { _buffer.length = 0; }

    return { debug, info, warn, error, setLevel, getBuffer, clear };
})();
window.Logger = Logger;
