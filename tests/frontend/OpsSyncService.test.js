/**
 * OpsSyncService 模块单元测试
 */
const fs = require('fs');
const path = require('path');

const SERVICE_DIR = path.resolve(__dirname, '../../frontend/js/services');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(SERVICE_DIR, filename), 'utf-8');
    eval(code);
}

describe('OpsSyncService', () => {
    let OpsSyncService;

    beforeEach(() => {
        jest.useFakeTimers();
        delete window.OpsSyncService;

        window.Store = {
            get: jest.fn(),
            set: jest.fn(),
            batch: jest.fn(fn => fn()),
        };
        window.Bus = { emit: jest.fn() };
        window.Events = { OPS_MCP_DEGRADED: 'ops:mcp_degraded' };
        window.API = { get: jest.fn() };
        window.Logger = { info: jest.fn(), warn: jest.fn() };

        document.addEventListener = jest.fn();
        document.removeEventListener = jest.fn();

        loadModule('OpsSyncService.js');
        OpsSyncService = window.OpsSyncService;
    });

    afterEach(() => {
        OpsSyncService.stop();
        jest.useRealTimers();
    });

    test('start/stop lifecycle', () => {
        expect(OpsSyncService.isActive()).toBe(false);
        OpsSyncService.start();
        expect(OpsSyncService.isActive()).toBe(true);
        OpsSyncService.stop();
        expect(OpsSyncService.isActive()).toBe(false);
    });

    test('start() is idempotent', () => {
        OpsSyncService.start();
        OpsSyncService.start();
        expect(OpsSyncService.isActive()).toBe(true);
    });

    test('start() registers visibilitychange listener', () => {
        OpsSyncService.start();
        expect(document.addEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    test('stop() removes visibilitychange listener', () => {
        OpsSyncService.start();
        OpsSyncService.stop();
        expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });

    test('_syncMetrics calls API.get and Store.set', async () => {
        const metricsData = { cpu: 45, memory: 60, disk: 30 };
        window.API.get.mockResolvedValue(metricsData);
        window.Store.get.mockReturnValue([]);

        OpsSyncService.start();
        await jest.advanceTimersByTimeAsync(0);

        expect(window.API.get).toHaveBeenCalledWith('/api/ops/metrics');
        expect(window.Store.set).toHaveBeenCalledWith('ops.metrics', metricsData);
    });

    test('_syncMcpHealth emits Bus event when unhealthy', async () => {
        window.API.get.mockResolvedValue({ status: 'unhealthy', servers: [] });

        OpsSyncService.start();
        await jest.advanceTimersByTimeAsync(0);

        expect(window.Bus.emit).toHaveBeenCalledWith('ops:mcp_degraded', { status: 'unhealthy', servers: [] });
    });

    test('_syncAlerts calls Store.set with rules and history', async () => {
        const rules = [{ id: '1', name: 'cpu', enabled: true }];
        const history = [{ id: 'h1', acknowledged: false }];
        window.API.get.mockImplementation(url =>
            Promise.resolve(url.includes('rules') ? rules : history)
        );

        OpsSyncService.start();
        await jest.advanceTimersByTimeAsync(0);

        expect(window.Store.set).toHaveBeenCalledWith('ops.alertRules', rules);
        expect(window.Store.set).toHaveBeenCalledWith('ops.alertHistory', history);
    });

    test('stop() calls removeEventListener for visibilitychange', () => {
        OpsSyncService.start();
        OpsSyncService.stop();
        expect(document.removeEventListener).toHaveBeenCalledWith('visibilitychange', expect.any(Function));
    });
});
