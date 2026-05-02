/**
 * Store 模块单元测试
 * 使用 eval 重新加载源码以获得全新实例
 */
const fs = require('fs');
const path = require('path');

const CORE_DIR = path.resolve(__dirname, '../../frontend/js/core');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(CORE_DIR, filename), 'utf-8');
    eval(code);
}

describe('Store', () => {
    let Store;

    beforeEach(() => {
        // 清理 window 上的旧引用
        delete window.Store;
        delete window.Bus;
        delete window.Logger;
        delete window.Events;
        delete window.ErrorHandler;
        delete window.Router;
        delete window.APIClient;
        // 重新加载 Store（不依赖其他模块，除了 console）
        loadModule('Store.js');
        Store = window.Store;
    });

    // ---------- define / get / set ----------

    describe('define() and get/set', () => {
        test('define() sets initial value, get() retrieves it', () => {
            Store.define('name', 'hermes');
            expect(Store.get('name')).toBe('hermes');
        });

        test('set() updates value, get() returns new value', () => {
            Store.define('count', 0);
            Store.set('count', 42);
            expect(Store.get('count')).toBe(42);
        });

        test('set() does nothing if value is the same (no-op on equal)', () => {
            Store.define('val', 'hello');
            const spy = jest.fn();
            Store.watch('val', spy);
            Store.set('val', 'hello');
            expect(spy).not.toHaveBeenCalled();
        });

        test('get() without path returns entire state', () => {
            Store.define('a', 1);
            Store.define('b', 2);
            const state = Store.get();
            expect(state.a).toBe(1);
            expect(state.b).toBe(2);
        });
    });

    // ---------- dot-path access ----------

    describe('dot-path access', () => {
        test('set() with dot-path creates nested structure', () => {
            Store.set('a.b.c', 1);
            expect(Store.get('a.b.c')).toBe(1);
        });

        test('get() with dot-path reads nested value', () => {
            Store.define('user', { name: 'test', age: 20 });
            expect(Store.get('user.name')).toBe('test');
            expect(Store.get('user.age')).toBe(20);
        });

        test('get() returns undefined for non-existent path', () => {
            expect(Store.get('non.existent.path')).toBeUndefined();
        });
    });

    // ---------- watch ----------

    describe('watch()', () => {
        test('watch() fires callback on value change', () => {
            Store.define('x', 0);
            const spy = jest.fn();
            Store.watch('x', spy);
            Store.set('x', 10);
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(10, 'x');
        });

        test('watch() with immediate option fires immediately', () => {
            Store.define('x', 5);
            const spy = jest.fn();
            Store.watch('x', spy, { immediate: true });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(5, 'x');
        });

        test('watch() returns unsubscribe function', () => {
            Store.define('y', 0);
            const spy = jest.fn();
            const unsub = Store.watch('y', spy);
            Store.set('y', 1);
            expect(spy).toHaveBeenCalledTimes(1);
            unsub();
            Store.set('y', 2);
            expect(spy).toHaveBeenCalledTimes(1);
        });

        test('watch() fires on prefix match (parent watches child changes)', () => {
            Store.define('user', { name: 'a' });
            const spy = jest.fn();
            Store.watch('user', spy);
            Store.set('user.name', 'b');
            expect(spy).toHaveBeenCalledTimes(1);
        });
    });

    // ---------- computed ----------

    describe('computed()', () => {
        test('computed() returns derived value', () => {
            Store.define('a', 2);
            Store.define('b', 3);
            Store.computed('sum', () => Store.get('a') + Store.get('b'), ['a', 'b']);
            expect(Store.get('sum')).toBe(5);
        });

        test('computed() updates when dependencies change', () => {
            Store.define('a', 2);
            Store.define('b', 3);
            Store.computed('sum', () => Store.get('a') + Store.get('b'), ['a', 'b']);
            Store.set('a', 10);
            expect(Store.get('sum')).toBe(13);
        });
    });

    // ---------- batch ----------

    describe('batch()', () => {
        test('batch() defers watcher notifications until end', () => {
            Store.define('x', 0);
            const spy = jest.fn();
            Store.watch('x', spy);
            Store.batch(() => {
                Store.set('x', 1);
                Store.set('x', 2);
                Store.set('x', 3);
                expect(spy).not.toHaveBeenCalled();
            });
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy).toHaveBeenCalledWith(3, 'x');
        });
    });

    // ---------- middleware ----------

    describe('middleware pipeline', () => {
        test('use() middleware can transform value', () => {
            Store.define('val', 0);
            Store.use(({ value }) => ({ value: value * 2 }));
            Store.set('val', 5);
            expect(Store.get('val')).toBe(10);
        });

        test('use() middleware can cancel set', () => {
            Store.define('val', 0);
            Store.use(() => ({ cancelled: true }));
            Store.set('val', 99);
            expect(Store.get('val')).toBe(0);
        });
    });

    // ---------- reset ----------

    describe('reset()', () => {
        test('reset() restores initial values', () => {
            Store.define('count', 0);
            Store.set('count', 100);
            Store.reset();
            expect(Store.get('count')).toBe(0);
        });

        test('reset(path) restores specific path', () => {
            Store.define('a', 1);
            Store.define('b', 2);
            Store.set('a', 99);
            Store.set('b', 88);
            Store.reset('a');
            expect(Store.get('a')).toBe(1);
            expect(Store.get('b')).toBe(88);
        });
    });
});
