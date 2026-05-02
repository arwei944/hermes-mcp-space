// frontend/js/core/Router.js
// -*- coding: utf-8 -*-
/**
 * Router — 增强路由
 *
 * 特性：
 * - 路由守卫（beforeEach）
 * - 编程式导航
 * - 导航历史
 * - 与 Bus 联动
 * - 与 Store 联动
 */

const Router = (() => {
    'use strict';

    const _routes = {};       // { 'dashboard': { title, icon, group, component } }
    const _guards = [];       // 路由守卫函数
    const _history = [];      // 导航历史
    let _current = null;      // 当前路由
    let _initialized = false;

    /**
     * 注册路由
     * @param {string} path - 路由路径（hash 值）
     * @param {Object} config
     * @param {string} config.title - 页面标题
     * @param {string} config.icon - 导航图标名
     * @param {string} config.group - 导航分组
     * @param {Function} config.component - 页面组件（全局变量名或模块）
     */
    function register(path, config) {
        _routes[path] = config;
    }

    /**
     * 批量注册路由
     * @param {Object} routesMap - { path: config }
     */
    function registerAll(routesMap) {
        Object.assign(_routes, routesMap);
    }

    /**
     * 编程式导航
     * @param {string} path - 目标路由
     * @param {Object} [params] - 路由参数
     * @returns {Promise<boolean>} 是否导航成功
     */
    async function navigate(path, params) {
        const route = _routes[path];
        if (!route) {
            if (typeof Logger !== 'undefined') Logger.warn('[Router]', `Route not found: "${path}"`);
            return false;
        }

        // 执行路由守卫
        for (const guard of _guards) {
            try {
                const allowed = await guard(path, _current, params);
                if (allowed === false) return false;
            } catch (err) {
                if (typeof Logger !== 'undefined') Logger.error('[Router]', 'Guard error:', err);
            }
        }

        // 记录历史
        if (_current && _current !== path) {
            _history.push(_current);
            // 限制历史记录长度
            if (_history.length > 50) _history.shift();
        }

        // 更新 hash
        window.location.hash = path;
        _current = path;

        // 更新 Store
        if (window.Store) {
            Store.set('app.currentPage', path);
        }

        // 发送事件
        if (window.Bus && window.Events) {
            Bus.emit(Events.PAGE_CHANGED, { path, params });
        }

        return true;
    }

    /**
     * 添加路由守卫
     * @param {Function} guardFn - (to, from, params) => boolean | Promise<boolean>
     */
    function guard(guardFn) {
        _guards.push(guardFn);
    }

    /**
     * 返回上一页
     */
    function back() {
        if (_history.length > 0) {
            const prev = _history.pop();
            window.location.hash = prev;
        }
    }

    /**
     * 获取当前路由
     */
    function current() {
        return _current;
    }

    /**
     * 获取所有注册的路由
     */
    function getRoutes() {
        return { ..._routes };
    }

    /**
     * 获取导航历史
     */
    function getHistory() {
        return [..._history];
    }

    /**
     * 清除历史
     */
    function clearHistory() {
        _history.length = 0;
    }

    /**
     * 初始化 hash 监听
     */
    function init() {
        if (_initialized) return;
        _initialized = true;

        window.addEventListener('hashchange', () => {
            const hash = window.location.hash.slice(1) || 'dashboard';
            if (hash !== _current) {
                _current = hash;
                if (window.Store) Store.set('app.currentPage', hash);
                if (window.Bus && window.Events) {
                    Bus.emit(Events.PAGE_CHANGED, { path: hash });
                }
            }
        });

        if (typeof Logger !== 'undefined') Logger.info('[Router]', 'Initialized');
    }

    return { register, registerAll, navigate, guard, back, current, getRoutes, getHistory, clearHistory, init };
})();

window.Router = Router;
