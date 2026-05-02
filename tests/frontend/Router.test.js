/**
 * Router 模块单元测试
 * 使用 eval 重新加载源码以获得全新实例
 */
const fs = require('fs');
const path = require('path');

const CORE_DIR = path.resolve(__dirname, '../../frontend/js/core');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(CORE_DIR, filename), 'utf-8');
    eval(code);
}

describe('Router', () => {
    let Router, Store, Bus, Events, Logger;

    beforeEach(() => {
        // 清理所有 window 全局变量
        delete window.Store;
        delete window.Bus;
        delete window.Logger;
        delete window.Events;
        delete window.ErrorHandler;
        delete window.Router;
        delete window.APIClient;

        // 按依赖顺序加载
        loadModule('constants.js');
        loadModule('Logger.js');
        loadModule('Bus.js');
        loadModule('Store.js');
        loadModule('ErrorHandler.js');
        loadModule('Router.js');

        Router = window.Router;
        Store = window.Store;
        Bus = window.Bus;
        Events = window.Events;
        Logger = window.Logger;
    });

    // ---------- register / registerAll ----------

    describe('register() and registerAll()', () => {
        test('register() adds a single route', () => {
            Router.register('home', { title: 'Home', icon: 'home', group: 'main' });
            const routes = Router.getRoutes();
            expect(routes.home).toBeDefined();
            expect(routes.home.title).toBe('Home');
        });

        test('registerAll() adds multiple routes', () => {
            Router.registerAll({
                dashboard: { title: 'Dashboard', icon: 'dash', group: 'main' },
                settings: { title: 'Settings', icon: 'gear', group: 'system' },
            });
            const routes = Router.getRoutes();
            expect(routes.dashboard).toBeDefined();
            expect(routes.settings).toBeDefined();
            expect(routes.dashboard.title).toBe('Dashboard');
            expect(routes.settings.title).toBe('Settings');
        });
    });

    // ---------- navigate ----------

    describe('navigate()', () => {
        beforeEach(() => {
            Router.register('dashboard', { title: 'Dashboard', icon: 'dash', group: 'main' });
            Router.register('settings', { title: 'Settings', icon: 'gear', group: 'system' });
        });

        test('navigate() to existing route succeeds', async () => {
            const result = await Router.navigate('dashboard');
            expect(result).toBe(true);
            expect(Router.current()).toBe('dashboard');
        });

        test('navigate() to non-existent route returns false', async () => {
            const result = await Router.navigate('nonexistent');
            expect(result).toBe(false);
        });

        test('navigate() updates current state', async () => {
            await Router.navigate('dashboard');
            expect(Router.current()).toBe('dashboard');
            await Router.navigate('settings');
            expect(Router.current()).toBe('settings');
        });

        test('navigate() records history', async () => {
            await Router.navigate('dashboard');
            await Router.navigate('settings');
            const history = Router.getHistory();
            expect(history).toContain('dashboard');
        });
    });

    // ---------- guard ----------

    describe('guard()', () => {
        beforeEach(() => {
            Router.register('protected', { title: 'Protected', icon: 'lock', group: 'main' });
            Router.register('public', { title: 'Public', icon: 'globe', group: 'main' });
        });

        test('guard allowing navigation returns true', async () => {
            Router.guard(() => true);
            const result = await Router.navigate('protected');
            expect(result).toBe(true);
        });

        test('guard blocking navigation returns false', async () => {
            Router.guard(() => false);
            const result = await Router.navigate('protected');
            expect(result).toBe(false);
        });

        test('guard with async check', async () => {
            Router.guard(async () => {
                await new Promise(r => setTimeout(r, 10));
                return true;
            });
            const result = await Router.navigate('protected');
            expect(result).toBe(true);
        });

        test('blocked navigation does not update current', async () => {
            await Router.navigate('public');
            Router.guard(() => false);
            const result = await Router.navigate('protected');
            expect(result).toBe(false);
            expect(Router.current()).toBe('public');
        });
    });

    // ---------- back ----------

    describe('back()', () => {
        beforeEach(() => {
            Router.register('page1', { title: 'Page1', icon: 'p1', group: 'main' });
            Router.register('page2', { title: 'Page2', icon: 'p2', group: 'main' });
            Router.register('page3', { title: 'Page3', icon: 'p3', group: 'main' });
        });

        test('back() pops from history and sets hash', async () => {
            await Router.navigate('page1');
            await Router.navigate('page2');
            const historyBefore = Router.getHistory();
            expect(historyBefore).toContain('page1');
            Router.back();
            // back() sets window.location.hash but does not update _current
            // (that's handled by hashchange listener in init())
            expect(window.location.hash).toBe('#page1');
            const historyAfter = Router.getHistory();
            expect(historyAfter).not.toContain('page1');
        });

        test('back() with empty history does nothing', () => {
            const before = Router.current();
            Router.back();
            expect(Router.current()).toBe(before);
        });
    });

    // ---------- current ----------

    describe('current()', () => {
        test('current() returns null initially', () => {
            expect(Router.current()).toBeNull();
        });

        test('current() returns current route after navigate', async () => {
            Router.register('test', { title: 'Test', icon: 't', group: 'main' });
            await Router.navigate('test');
            expect(Router.current()).toBe('test');
        });
    });

    // ---------- getRoutes ----------

    describe('getRoutes()', () => {
        test('getRoutes() returns a copy of routes', () => {
            Router.register('a', { title: 'A' });
            const routes = Router.getRoutes();
            expect(routes.a).toBeDefined();
            routes.a = null;
            expect(Router.getRoutes().a).toBeDefined();
        });
    });
});
