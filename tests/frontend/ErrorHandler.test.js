/**
 * ErrorHandler 模块单元测试
 * 使用 eval 重新加载源码以获得全新实例
 */
const fs = require('fs');
const path = require('path');

const CORE_DIR = path.resolve(__dirname, '../../frontend/js/core');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(CORE_DIR, filename), 'utf-8');
    eval(code);
}

describe('ErrorHandler', () => {
    let ErrorHandler, Bus;

    beforeEach(() => {
        delete window.Store;
        delete window.Bus;
        delete window.Logger;
        delete window.Events;
        delete window.ErrorHandler;
        delete window.Router;
        delete window.APIClient;

        loadModule('constants.js');
        loadModule('Logger.js');
        loadModule('Bus.js');
        loadModule('ErrorHandler.js');

        ErrorHandler = window.ErrorHandler;
        Bus = window.Bus;
    });

    // ---------- wrap ----------

    describe('wrap()', () => {
        test('wrap() returns a proxy object', () => {
            const mod = {
                name: 'TestPage',
                render: jest.fn(() => '<div>ok</div>'),
            };
            const wrapped = ErrorHandler.wrap(mod);
            expect(wrapped).toBeDefined();
            expect(wrapped.name).toBe('TestPage');
        });

        test('wrap() - render() success returns result normally', () => {
            const mod = {
                name: 'TestPage',
                render: jest.fn(() => '<div>ok</div>'),
            };
            const wrapped = ErrorHandler.wrap(mod);
            const result = wrapped.render();
            expect(result).toBe('<div>ok</div>');
            expect(mod.render).toHaveBeenCalledTimes(1);
        });

        test('wrap() - render() error triggers fallbackUI', () => {
            const mod = {
                name: 'TestPage',
                render: jest.fn(() => {
                    throw new Error('render boom');
                }),
            };
            const wrapped = ErrorHandler.wrap(mod);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const result = wrapped.render();
            expect(result).toContain('error-boundary-fallback');
            expect(result).toContain('render boom');
            consoleSpy.mockRestore();
        });

        test('wrap() - onSSEEvent() error returns undefined', () => {
            const mod = {
                name: 'TestPage',
                onSSEEvent: jest.fn(() => {
                    throw new Error('sse boom');
                }),
            };
            const wrapped = ErrorHandler.wrap(mod);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const result = wrapped.onSSEEvent({ type: 'test' });
            expect(result).toBeUndefined();
            consoleSpy.mockRestore();
        });

        test('wrap() - destroy() error returns undefined', () => {
            const mod = {
                name: 'TestPage',
                destroy: jest.fn(() => {
                    throw new Error('destroy boom');
                }),
            };
            const wrapped = ErrorHandler.wrap(mod);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            const result = wrapped.destroy();
            expect(result).toBeUndefined();
            consoleSpy.mockRestore();
        });

        test('wrap() - other methods pass through normally', () => {
            const mod = {
                name: 'TestPage',
                someMethod: jest.fn(() => 'hello'),
            };
            const wrapped = ErrorHandler.wrap(mod);
            const result = wrapped.someMethod();
            expect(result).toBe('hello');
        });

        test('wrap(null) returns null', () => {
            expect(ErrorHandler.wrap(null)).toBeNull();
        });

        test('wrap(undefined) returns undefined', () => {
            expect(ErrorHandler.wrap(undefined)).toBeUndefined();
        });
    });

    // ---------- handleError ----------

    describe('handleError()', () => {
        test('handleError() logs error to error log', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            ErrorHandler.handleError(new Error('test error'), 'test:context');
            const log = ErrorHandler.getErrorLog();
            expect(log.length).toBe(1);
            expect(log[0].message).toBe('test error');
            expect(log[0].context).toBe('test:context');
            consoleSpy.mockRestore();
        });

        test('handleError() emits error:component event on Bus', () => {
            const spy = jest.fn();
            Bus.on('error:component', spy);
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            ErrorHandler.handleError(new Error('bus test'), 'test');
            expect(spy).toHaveBeenCalledTimes(1);
            consoleSpy.mockRestore();
        });
    });

    // ---------- fallbackUI ----------

    describe('fallbackUI()', () => {
        test('fallbackUI() returns HTML string with error message', () => {
            const html = ErrorHandler.fallbackUI(new Error('test fallback'));
            expect(html).toContain('error-boundary-fallback');
            expect(html).toContain('test fallback');
        });

        test('fallbackUI() escapes HTML in error message', () => {
            const html = ErrorHandler.fallbackUI(new Error('<script>alert("xss")</script>'));
            expect(html).not.toContain('<script>');
            expect(html).toContain('&lt;script&gt;');
        });
    });

    // ---------- getErrorLog ----------

    describe('getErrorLog()', () => {
        test('getErrorLog() returns a copy of the log', () => {
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
            ErrorHandler.handleError(new Error('e1'), 'c1');
            ErrorHandler.handleError(new Error('e2'), 'c2');
            const log = ErrorHandler.getErrorLog();
            expect(log.length).toBe(2);
            log.length = 0;
            expect(ErrorHandler.getErrorLog().length).toBe(2);
            consoleSpy.mockRestore();
        });
    });
});
