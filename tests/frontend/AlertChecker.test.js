/**
 * AlertChecker 模块单元测试
 */
const fs = require('fs');
const path = require('path');

const SERVICE_DIR = path.resolve(__dirname, '../../frontend/js/services');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(SERVICE_DIR, filename), 'utf-8');
    eval(code);
}

describe('AlertChecker', () => {
    let AlertChecker;

    beforeEach(() => {
        jest.useFakeTimers();
        delete window.AlertChecker;

        window.Store = {
            get: jest.fn(),
            set: jest.fn(),
        };
        window.Bus = { emit: jest.fn() };
        window.Events = { ALERT_TRIGGERED: 'alert:triggered' };
        window.Logger = { info: jest.fn(), warn: jest.fn() };

        loadModule('AlertChecker.js');
        AlertChecker = window.AlertChecker;
    });

    afterEach(() => {
        AlertChecker.stop();
        jest.useRealTimers();
    });

    test('start/stop lifecycle', () => {
        expect(AlertChecker.isActive()).toBe(false);
        AlertChecker.start();
        expect(AlertChecker.isActive()).toBe(true);
        AlertChecker.stop();
        expect(AlertChecker.isActive()).toBe(false);
    });

    test('start() is idempotent', () => {
        AlertChecker.start();
        AlertChecker.start();
        expect(AlertChecker.isActive()).toBe(true);
    });

    test('check() does nothing when no rules', () => {
        window.Store.get.mockReturnValue([]);
        AlertChecker.check();
        expect(window.Bus.emit).not.toHaveBeenCalled();
    });

    test('check() emits alert for cpu_high when threshold exceeded', () => {
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alertRules') return [{ id: 'r1', name: 'CPU高', type: 'cpu_high', enabled: true, threshold: 80 }];
            if (path === 'ops.metrics') return { cpu: 95 };
            return undefined;
        });

        AlertChecker.check();
        expect(window.Bus.emit).toHaveBeenCalledWith('alert:triggered', expect.objectContaining({
            ruleName: 'CPU高',
            type: 'cpu_high',
            source: 'frontend',
        }));
    });

    test('check() emits alert for memory_high', () => {
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alertRules') return [{ id: 'r2', name: '内存高', type: 'memory_high', enabled: true, threshold: 85 }];
            if (path === 'ops.metrics') return { memory: 90 };
            return undefined;
        });

        AlertChecker.check();
        expect(window.Bus.emit).toHaveBeenCalledWith('alert:triggered', expect.objectContaining({
            type: 'memory_high',
        }));
    });

    test('check() emits alert for disk_high', () => {
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alertRules') return [{ id: 'r3', name: '磁盘高', type: 'disk_high', enabled: true, threshold: 90 }];
            if (path === 'ops.metrics') return { disk: 95 };
            return undefined;
        });

        AlertChecker.check();
        expect(window.Bus.emit).toHaveBeenCalledWith('alert:triggered', expect.objectContaining({
            type: 'disk_high',
        }));
    });

    test('check() emits alert for mcp_disconnected', () => {
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alertRules') return [{ id: 'r4', name: 'MCP断连', type: 'mcp_disconnected', enabled: true }];
            if (path === 'ops.mcpHealth') return { status: 'unhealthy' };
            return undefined;
        });

        AlertChecker.check();
        expect(window.Bus.emit).toHaveBeenCalledWith('alert:triggered', expect.objectContaining({
            type: 'mcp_disconnected',
            level: 'critical',
        }));
    });

    test('check() respects cooldown and skips recently triggered rule', () => {
        const recentTime = new Date(Date.now() - 10000).toISOString(); // 10s ago, cooldown default 300s
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alertRules') return [{ id: 'r5', name: 'CPU', type: 'cpu_high', enabled: true, threshold: 80, lastTriggered: recentTime }];
            if (path === 'ops.metrics') return { cpu: 99 };
            return undefined;
        });

        AlertChecker.check();
        expect(window.Bus.emit).not.toHaveBeenCalled();
    });

    test('check() does not emit when value below threshold', () => {
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alertRules') return [{ id: 'r6', name: 'CPU', type: 'cpu_high', enabled: true, threshold: 80 }];
            if (path === 'ops.metrics') return { cpu: 50 };
            return undefined;
        });

        AlertChecker.check();
        expect(window.Bus.emit).not.toHaveBeenCalled();
    });
});
