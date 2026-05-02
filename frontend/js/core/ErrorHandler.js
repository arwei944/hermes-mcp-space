// -*- coding: utf-8 -*-
/**
 * ErrorHandler — 三层错误边界处理器
 * 支持 wrap / handleError / fallbackUI / getErrorLog / initGlobal
 */
const ErrorHandler = (() => {
    'use strict';

    const _errorLog = [];
    const MAX_LOG = 100;

    /**
     * 记录错误到日志（最多100条）
     */
    function handleError(err, context) {
        const entry = {
            error: err,
            context: context || 'unknown',
            timestamp: new Date().toISOString(),
            message: err instanceof Error ? err.message : String(err),
            stack: err instanceof Error ? err.stack : null
        };
        _errorLog.push(entry);
        if (_errorLog.length > MAX_LOG) _errorLog.shift();

        // console.error
        console.error(`[ErrorHandler] (${entry.context})`, err);

        // Bus.emit
        if (window.Bus && typeof Bus.emit === 'function') {
            try { Bus.emit('error:component', entry); } catch (_) { /* ignore */ }
        }

        // Toast.error（如果存在）
        if (window.Toast && typeof Toast.error === 'function') {
            try { Toast.error(entry.message); } catch (_) { /* ignore */ }
        }
    }

    /**
     * 错误占位 UI
     */
    function fallbackUI(err) {
        const msg = err instanceof Error ? err.message : String(err);
        return `
<div class="error-boundary-fallback" style="
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 48px 24px; text-align: center; color: #ff3b30; font-family: -apple-system, BlinkMacSystemFont, sans-serif;
">
    <div style="font-size: 48px; margin-bottom: 16px;">&#x26A0;&#xFE0F;</div>
    <h3 style="margin: 0 0 8px; font-size: 18px; color: #1d1d1f;">组件渲染出错</h3>
    <p style="margin: 0 0 20px; font-size: 14px; color: #86868b; max-width: 400px; word-break: break-word;">${_escapeHtml(msg)}</p>
    <button onclick="location.reload()" style="
        padding: 8px 20px; border: 1px solid #ff3b30; border-radius: 8px;
        background: transparent; color: #ff3b30; font-size: 14px; cursor: pointer;
        transition: background 0.2s;
    " onmouseover="this.style.background='#fff5f5'" onmouseout="this.style.background='transparent'">
        重新加载
    </button>
</div>`;
    }

    /** 简单 HTML 转义 */
    function _escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * 用 Proxy 包装页面模块，捕获 render / onSSEEvent / destroy 中的错误
     */
    function wrap(pageModule) {
        if (!pageModule || typeof pageModule !== 'object') return pageModule;

        return new Proxy(pageModule, {
            get(target, prop) {
                const value = target[prop];
                // 只拦截函数方法
                if (typeof value !== 'function') return value;

                // render 出错返回 fallbackUI
                if (prop === 'render') {
                    return function (...args) {
                        try {
                            return value.apply(this, args);
                        } catch (err) {
                            handleError(err, `render:${target.name || target.id || 'unknown'}`);
                            return fallbackUI(err);
                        }
                    };
                }

                // onSSEEvent / destroy 出错返回 undefined
                if (prop === 'onSSEEvent' || prop === 'destroy') {
                    return function (...args) {
                        try {
                            return value.apply(this, args);
                        } catch (err) {
                            handleError(err, `${prop}:${target.name || target.id || 'unknown'}`);
                            return undefined;
                        }
                    };
                }

                // 其他方法透传
                return value.bind(target);
            }
        });
    }

    /**
     * 获取错误日志
     */
    function getErrorLog() {
        return [..._errorLog];
    }

    /**
     * 设置全局错误捕获
     */
    function initGlobal() {
        window.onerror = function (message, source, lineno, colno, error) {
            handleError(error || new Error(String(message)), 'global:onerror');
            return true; // 阻止默认处理
        };

        window.addEventListener('unhandledrejection', function (event) {
            const reason = event.reason;
            handleError(reason instanceof Error ? reason : new Error(String(reason)), 'global:unhandledrejection');
            event.preventDefault();
        });
    }

    return { wrap, handleError, fallbackUI, getErrorLog, initGlobal };
})();
window.ErrorHandler = ErrorHandler;
