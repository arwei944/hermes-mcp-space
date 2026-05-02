// -*- coding: utf-8 -*-
/**
 * Logger — 结构化日志
 * 5 个级别（debug/info/warn/error/silent），彩色控制台输出，日志缓冲
 */
const Logger = (() => {
    'use strict';
    const _buffer = [];
    const MAX_BUFFER = 100;
    let _level = 'info';
    const LEVELS = { debug: 0, info: 1, warn: 2, error: 3, silent: 4 };
    const COLORS = { debug: '#8e8e93', info: '#0071e3', warn: '#ff9500', error: '#ff3b30' };

    function _log(level, args) {
        if (LEVELS[level] < LEVELS[_level]) return;
        const ts = new Date().toLocaleTimeString('zh-CN', { hour12: false });
        const entry = { level, timestamp: ts, args: args.map(a => { try { return typeof a === 'object' ? JSON.stringify(a) : String(a); } catch { return String(a); } }) };
        _buffer.push(entry);
        if (_buffer.length > MAX_BUFFER) _buffer.shift();
        const color = COLORS[level] || '#000';
        console.log(`%c[${ts}] [${level.toUpperCase()}]`, `color: ${color}; font-weight: bold`, ...args);
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
