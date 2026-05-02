// -*- coding: utf-8 -*-
/**
 * Store — 响应式状态管理
 * 支持深层路径读写、watcher、computed、batch、middleware、snapshot、reset
 */
const Store = (() => {
    'use strict';

    /* ---------- 内部状态 ---------- */
    const _state = {};
    const _initialValues = {};
    const _watchers = {};          // { path: [{ callback, exact, id }] }
    const _computeds = {};         // { name: { fn, deps, value, dirty } }
    const _middlewares = [];
    let _batchDepth = 0;
    let _batchPending = null;      // Set of paths changed during batch
    let _watcherId = 0;

    /* ---------- 工具函数 ---------- */

    /** 点号路径深层读取 */
    function _deepGet(obj, path) {
        if (!path || path === '') return obj;
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length; i++) {
            if (cur == null) return undefined;
            cur = cur[keys[i]];
        }
        return cur;
    }

    /** 点号路径深层写入，沿途自动创建对象 */
    function _deepSet(obj, path, value) {
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (cur[keys[i]] == null || typeof cur[keys[i]] !== 'object') {
                cur[keys[i]] = {};
            }
            cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = value;
    }

    /** 浅比较 + JSON 深比较混合策略 */
    function _isEqual(a, b) {
        if (a === b) return true;
        if (a == null || b == null) return false;
        if (typeof a !== typeof b) return false;
        if (typeof a !== 'object') return false;
        try {
            return JSON.stringify(a) === JSON.stringify(b);
        } catch {
            return false;
        }
    }

    /** 通知 watchers：精确匹配 + 前缀匹配 */
    function _notifyWatchers(path) {
        if (_batchDepth > 0) {
            if (!_batchPending) _batchPending = new Set();
            _batchPending.add(path);
            return;
        }
        _doNotify(path);
    }

    function _doNotify(path) {
        // 精确匹配
        const exact = _watchers[path];
        if (exact) {
            for (const w of exact) {
                if (!w.exact) continue;
                try { w.callback(_deepGet(_state, path), path); } catch (e) { console.error('[Store] watcher error:', e); }
            }
        }
        // 前缀匹配（遍历所有 watcher 路径）
        for (const wPath of Object.keys(_watchers)) {
            if (wPath === path) continue;
            if (path.startsWith(wPath + '.')) {
                const list = _watchers[wPath];
                for (const w of list) {
                    try { w.callback(_deepGet(_state, wPath), wPath); } catch (e) { console.error('[Store] watcher error:', e); }
                }
            }
        }
        // 更新受影响的 computed
        _invalidateComputeds(path);
    }

    /** 标记依赖该路径的 computed 为脏 */
    function _invalidateComputeds(changedPath) {
        for (const name of Object.keys(_computeds)) {
            const c = _computeds[name];
            if (c.deps.some(d => d === changedPath || changedPath.startsWith(d + '.'))) {
                c.dirty = true;
            }
        }
    }

    /** 执行中间件管道 */
    function _runMiddlewares(action, path, value, oldValue) {
        let result = { value, cancelled: false };
        for (const mw of _middlewares) {
            try {
                const r = mw({ action, path, value, oldValue });
                if (r && typeof r === 'object') {
                    if (r.cancelled) { result.cancelled = true; break; }
                    if (r.value !== undefined) result.value = r.value;
                }
            } catch (e) {
                console.error('[Store] middleware error:', e);
            }
        }
        return result;
    }

    /* ---------- 公开 API ---------- */

    /**
     * 定义状态节点
     * @param {string} path  点号路径
     * @param {*} initialValue
     */
    function define(path, initialValue) {
        if (path in _state && !(path in _initialValues)) {
            // 首次 define 才记录初始值
        }
        _initialValues[path] = typeof initialValue === 'object' ? JSON.parse(JSON.stringify(initialValue)) : initialValue;
        _deepSet(_state, path, typeof initialValue === 'object' ? JSON.parse(JSON.stringify(initialValue)) : initialValue);
    }

    /**
     * 深层获取
     */
    function get(path) {
        if (!path) return _state;
        // 先检查 computed
        if (path in _computeds) {
            const c = _computeds[path];
            if (c.dirty) {
                try { c.value = c.fn(); c.dirty = false; } catch (e) { console.error('[Store] computed error:', e); }
            }
            return c.value;
        }
        return _deepGet(_state, path);
    }

    /**
     * 设置值，自动 diff，触发 watchers
     */
    function set(path, value) {
        const oldValue = _deepGet(_state, path);
        if (_isEqual(oldValue, value)) return;

        const mwResult = _runMiddlewares('set', path, value, oldValue);
        if (mwResult.cancelled) return;

        _deepSet(_state, path, mwResult.value);
        _notifyWatchers(path);
    }

    /**
     * 监听变化
     * @param {string}   path
     * @param {Function} callback
     * @param {Object}   [options]  { immediate: boolean }
     * @returns {Function} 取消函数
     */
    function watch(path, callback, options = {}) {
        if (!_watchers[path]) _watchers[path] = [];
        const id = ++_watcherId;
        const entry = { callback, exact: true, id };
        _watchers[path].push(entry);
        if (options.immediate) {
            try { callback(get(path), path); } catch (e) { console.error('[Store] watcher immediate error:', e); }
        }
        return () => {
            const list = _watchers[path];
            if (list) {
                const idx = list.findIndex(w => w.id === id);
                if (idx !== -1) list.splice(idx, 1);
            }
        };
    }

    /**
     * 计算属性
     */
    function computed(name, fn, deps) {
        _computeds[name] = { fn, deps, value: undefined, dirty: true };
        // 监听依赖变化
        deps.forEach(dep => {
            watch(dep, () => {
                _computeds[name].dirty = true;
            });
        });
    }

    /**
     * 批量更新，合并通知
     */
    function batch(fn) {
        _batchDepth++;
        try {
            fn();
        } finally {
            _batchDepth--;
            if (_batchDepth === 0 && _batchPending) {
                const pending = _batchPending;
                _batchPending = null;
                pending.forEach(p => _doNotify(p));
            }
        }
    }

    /**
     * 中间件
     */
    function use(middleware) {
        if (typeof middleware === 'function') {
            _middlewares.push(middleware);
        }
    }

    /**
     * 状态快照
     */
    function snapshot() {
        return JSON.parse(JSON.stringify(_state));
    }

    /**
     * 重置到初始值
     */
    function reset(path) {
        if (path) {
            if (path in _initialValues) {
                const v = typeof _initialValues[path] === 'object'
                    ? JSON.parse(JSON.stringify(_initialValues[path]))
                    : _initialValues[path];
                set(path, v);
            }
        } else {
            // 全量重置
            for (const p of Object.keys(_initialValues)) {
                const v = typeof _initialValues[p] === 'object'
                    ? JSON.parse(JSON.stringify(_initialValues[p]))
                    : _initialValues[p];
                _deepSet(_state, p, v);
            }
            _batchPending = new Set(Object.keys(_initialValues));
            _batchDepth++;
            _batchDepth--;
            if (_batchPending) {
                const pending = _batchPending;
                _batchPending = null;
                pending.forEach(p => _doNotify(p));
            }
        }
    }

    return { define, get, set, watch, computed, batch, use, snapshot, reset };
})();
window.Store = Store;
