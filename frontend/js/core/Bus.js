// -*- coding: utf-8 -*-
/**
 * Bus — 事件总线
 * 支持 on / once / off / emit / bridgeSSE / listenerCount / clear
 */
const Bus = (() => {
    'use strict';

    const _events = {};   // { eventName: [{ handler, context, once }] }

    /**
     * 注册监听
     * @param {string}   event
     * @param {Function} handler
     * @param {*}        [context]  handler 执行时的 this
     * @returns {Function} 取消函数
     */
    function on(event, handler, context) {
        if (!_events[event]) _events[event] = [];
        const entry = { handler, context: context || null, once: false };
        _events[event].push(entry);
        return () => off(event, handler);
    }

    /**
     * 一次性监听
     */
    function once(event, handler, context) {
        if (!_events[event]) _events[event] = [];
        const entry = { handler, context: context || null, once: true };
        _events[event].push(entry);
        return () => off(event, handler);
    }

    /**
     * 取消监听
     */
    function off(event, handler) {
        const list = _events[event];
        if (!list) return;
        for (let i = list.length - 1; i >= 0; i--) {
            if (list[i].handler === handler) {
                list.splice(i, 1);
            }
        }
        if (list.length === 0) delete _events[event];
    }

    /**
     * 触发事件，每个 handler 用 try/catch 隔离
     */
    function emit(event, data) {
        const list = _events[event];
        if (!list || list.length === 0) return;
        // 复制一份，防止回调中修改列表
        const snapshot = list.slice();
        for (const entry of snapshot) {
            try {
                entry.handler.call(entry.context, data);
            } catch (e) {
                console.error(`[Bus] error in handler for "${event}":`, e);
            }
            if (entry.once) {
                off(event, entry.handler);
            }
        }
    }

    /**
     * 监听 window 'hermes:event' 自定义事件，转发为 Bus 事件（加 sse: 前缀）
     */
    function bridgeSSE() {
        window.addEventListener('hermes:event', (e) => {
            if (e.detail && e.detail.type) {
                const busEvent = 'sse:' + e.detail.type;
                emit(busEvent, e.detail.data !== undefined ? e.detail.data : e.detail);
            }
        });
    }

    /**
     * 调试：获取某事件的监听器数量
     */
    function listenerCount(event) {
        const list = _events[event];
        return list ? list.length : 0;
    }

    /**
     * 清除所有监听器（测试用）
     */
    function clear() {
        for (const key of Object.keys(_events)) {
            delete _events[key];
        }
    }

    return { on, once, off, emit, bridgeSSE, listenerCount, clear };
})();
window.Bus = Bus;
