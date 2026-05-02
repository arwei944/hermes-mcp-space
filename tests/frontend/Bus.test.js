/**
 * Bus 模块单元测试
 * 使用 eval 重新加载源码以获得全新实例
 */
const fs = require('fs');
const path = require('path');

const CORE_DIR = path.resolve(__dirname, '../../frontend/js/core');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(CORE_DIR, filename), 'utf-8');
    eval(code);
}

describe('Bus', () => {
    let Bus;

    beforeEach(() => {
        delete window.Bus;
        delete window.Store;
        delete window.Logger;
        delete window.Events;
        delete window.ErrorHandler;
        delete window.Router;
        delete window.APIClient;
        loadModule('Bus.js');
        Bus = window.Bus;
    });

    // ---------- on / emit ----------

    describe('on() and emit()', () => {
        test('on() registers handler, emit() calls it', () => {
            const spy = jest.fn();
            Bus.on('test:event', spy);
            Bus.emit('test:event', { data: 42 });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith({ data: 42 });
        });

        test('emit() with no handlers does not throw', () => {
            expect(() => Bus.emit('nonexistent')).not.toThrow();
        });

        test('multiple handlers on same event all fire', () => {
            const spy1 = jest.fn();
            const spy2 = jest.fn();
            Bus.on('multi', spy1);
            Bus.on('multi', spy2);
            Bus.emit('multi');
            expect(spy1).toHaveBeenCalledTimes(1);
            expect(spy2).toHaveBeenCalledTimes(1);
        });

        test('on() returns unsubscribe function', () => {
            const spy = jest.fn();
            const unsub = Bus.on('unsub', spy);
            Bus.emit('unsub');
            expect(spy).toHaveBeenCalledTimes(1);
            unsub();
            Bus.emit('unsub');
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });

    // ---------- once ----------

    describe('once()', () => {
        test('once() handler fires only once', () => {
            const spy = jest.fn();
            Bus.once('once:test', spy);
            Bus.emit('once:test');
            Bus.emit('once:test');
            Bus.emit('once:test');
            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('once() returns unsubscribe function', () => {
            const spy = jest.fn();
            const unsub = Bus.once('once:unsub', spy);
            unsub();
            Bus.emit('once:unsub');
            expect(spy).not.toHaveBeenCalled();
        });
    });

    // ---------- off ----------

    describe('off()', () => {
        test('off() removes specific handler', () => {
            const spy1 = jest.fn();
            const spy2 = jest.fn();
            Bus.on('off:test', spy1);
            Bus.on('off:test', spy2);
            Bus.off('off:test', spy1);
            Bus.emit('off:test');
            expect(spy1).not.toHaveBeenCalled();
            expect(spy2).toHaveBeenCalledTimes(1);
        });

        test('off() on non-existent event does not throw', () => {
            expect(() => Bus.off('no:event', () => {})).not.toThrow();
        });
    });

    // ---------- error isolation ----------

    describe('error isolation', () => {
        test('handler error does not affect other handlers', () => {
            const badHandler = jest.fn(() => {
                throw new Error('boom');
            });
            const goodHandler = jest.fn();
            Bus.on('isolation', badHandler);
            Bus.on('isolation', goodHandler);

            const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

            expect(() => Bus.emit('isolation')).not.toThrow();
            expect(badHandler).toHaveBeenCalledTimes(1);
            expect(goodHandler).toHaveBeenCalledTimes(1);

            consoleSpy.mockRestore();
        });
    });

    // ---------- listenerCount ----------

    describe('listenerCount()', () => {
        test('returns correct count', () => {
            expect(Bus.listenerCount('count:test')).toBe(0);
            Bus.on('count:test', () => {});
            Bus.on('count:test', () => {});
            expect(Bus.listenerCount('count:test')).toBe(2);
        });

        test('count decreases after off()', () => {
            const handler = () => {};
            Bus.on('count:dec', handler);
            Bus.on('count:dec', () => {});
            expect(Bus.listenerCount('count:dec')).toBe(2);
            Bus.off('count:dec', handler);
            expect(Bus.listenerCount('count:dec')).toBe(1);
        });
    });

    // ---------- clear ----------

    describe('clear()', () => {
        test('clear() removes all handlers', () => {
            Bus.on('a', () => {});
            Bus.on('b', () => {});
            Bus.clear();
            expect(Bus.listenerCount('a')).toBe(0);
            expect(Bus.listenerCount('b')).toBe(0);
        });
    });
});
