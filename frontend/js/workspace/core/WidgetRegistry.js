/**
 * WidgetRegistry.js
 * Widget 注册表 - IIFE 模式，挂载到全局
 *
 * API:
 *   register(name, definition)       - 注册 Widget
 *   get(name)                        - 获取 Widget 定义
 *   has(name)                        - 检查是否已注册
 *   list()                           - 列出所有 Widget
 *   listByCategory(category)         - 按类别列出
 *   listByType(type)                 - 按类型列出
 */
const WidgetRegistry = (() => {
    'use strict';

    /** @type {Map<string, object>} */
    const _registry = new Map();

    /**
     * 注册一个 Widget
     * @param {string} name - Widget 唯一名称
     * @param {object} definition - Widget 定义
     * @param {string} definition.type - Widget 类型 (entry, chart, etc.)
     * @param {string} definition.label - 显示名称
     * @param {string} definition.icon - 图标
     * @param {string} definition.description - 描述
     * @param {{w: number, h: number}} definition.defaultSize - 默认尺寸
     * @param {string} definition.category - 分类
     * @param {function} definition.mount - 挂载函数 (container, props) => { destroy, refresh }
     */
    function register(name, definition) {
        if (!name || typeof name !== 'string') {
            throw new Error('[WidgetRegistry] register: name 必须是非空字符串');
        }
        if (!definition || typeof definition !== 'object') {
            throw new Error('[WidgetRegistry] register: definition 必须是对象');
        }
        if (!definition.mount || typeof definition.mount !== 'function') {
            throw new Error('[WidgetRegistry] register: definition.mount 必须是函数');
        }

        _registry.set(name, {
            name,
            type: definition.type || 'unknown',
            label: definition.label || name,
            icon: definition.icon || '',
            description: definition.description || '',
            defaultSize: definition.defaultSize || { w: 1, h: 1 },
            category: definition.category || 'general',
            mount: definition.mount
        });
    }

    /**
     * 获取 Widget 定义
     * @param {string} name
     * @returns {object|undefined}
     */
    function get(name) {
        return _registry.get(name);
    }

    /**
     * 检查 Widget 是否已注册
     * @param {string} name
     * @returns {boolean}
     */
    function has(name) {
        return _registry.has(name);
    }

    /**
     * 列出所有已注册的 Widget
     * @returns {Array<object>}
     */
    function list() {
        return Array.from(_registry.values());
    }

    /**
     * 按类别列出 Widget
     * @param {string} category
     * @returns {Array<object>}
     */
    function listByCategory(category) {
        return list().filter(widget => widget.category === category);
    }

    /**
     * 按类型列出 Widget
     * @param {string} type
     * @returns {Array<object>}
     */
    function listByType(type) {
        return list().filter(widget => widget.type === type);
    }

    // 公开 API
    return {
        register,
        get,
        has,
        list,
        listByCategory,
        listByType
    };
})();
