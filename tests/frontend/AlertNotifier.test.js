/**
 * AlertNotifier 模块单元测试
 */
const fs = require('fs');
const path = require('path');

const SERVICE_DIR = path.resolve(__dirname, '../../frontend/js/services');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(SERVICE_DIR, filename), 'utf-8');
    eval(code);
}

describe('AlertNotifier', () => {
    let AlertNotifier;

    beforeEach(() => {
        delete window.AlertNotifier;

        window.Store = {
            get: jest.fn(),
            set: jest.fn(),
            batch: jest.fn(fn => fn()),
            watch: jest.fn(),
        };
        window.Bus = {
            on: jest.fn(),
            emit: jest.fn(),
        };
        window.Events = {
            ALERT_TRIGGERED: 'alert:triggered',
            ALERT_ACKNOWLEDGED: 'alert:acknowledged',
        };
        window.Components = {
            Toast: {
                error: jest.fn(),
                warning: jest.fn(),
                info: jest.fn(),
            },
        };
        window.Logger = { info: jest.fn(), warn: jest.fn() };

        loadModule('AlertNotifier.js');
        AlertNotifier = window.AlertNotifier;
    });

    test('init() sets up Bus listeners', () => {
        AlertNotifier.init();
        expect(window.Bus.on).toHaveBeenCalledWith('alert:triggered', expect.any(Function));
        expect(window.Bus.on).toHaveBeenCalledWith('alert:acknowledged', expect.any(Function));
        expect(window.Bus.on).toHaveBeenCalledWith('sse:ops.alert', expect.any(Function));
    });

    test('init() is idempotent', () => {
        AlertNotifier.init();
        AlertNotifier.init();
        expect(window.Bus.on).toHaveBeenCalledTimes(3);
    });

    test('init() sets up Store.watch for sidebar badge', () => {
        AlertNotifier.init();
        expect(window.Store.watch).toHaveBeenCalledWith('ops.alerts.unread', expect.any(Function));
    });

    test('_onAlert updates Store and shows Toast for critical', () => {
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alerts.unread') return 0;
            if (path === 'ops.alertHistory') return [];
            if (path === 'app.currentPage') return 'dashboard';
            if (path === 'ui.notifications') return [];
            return undefined;
        });

        AlertNotifier.init();
        const onAlert = window.Bus.on.mock.calls.find(c => c[0] === 'alert:triggered')[1];

        onAlert({ level: 'critical', ruleName: 'CPU', message: 'CPU 95%', type: 'cpu_high' });

        expect(window.Store.set).toHaveBeenCalledWith('ops.alerts.unread', 1);
        expect(window.Store.set).toHaveBeenCalledWith('ops.alerts.lastTriggered', expect.objectContaining({ level: 'critical' }));
        expect(window.Components.Toast.error).toHaveBeenCalledWith(
            expect.stringContaining('CPU'),
            8000
        );
    });

    test('_onAlert shows warning Toast with 5s duration', () => {
        window.Store.get.mockImplementation(path => {
            if (path === 'ops.alerts.unread') return 0;
            if (path === 'ops.alertHistory') return [];
            if (path === 'app.currentPage') return 'ops_alerts';
            return undefined;
        });

        AlertNotifier.init();
        const onAlert = window.Bus.on.mock.calls.find(c => c[0] === 'alert:triggered')[1];

        onAlert({ level: 'warning', ruleName: 'MEM', message: 'Mem 88%', type: 'memory_high' });

        expect(window.Components.Toast.warning).toHaveBeenCalledWith(
            expect.stringContaining('MEM'),
            5000
        );
        // On ops_alerts page, should not add notification
        expect(window.Store.set).not.toHaveBeenCalledWith('ui.notifications', expect.anything());
    });

    test('_onAcknowledge decrements unread count', () => {
        window.Store.get.mockReturnValue(5);

        AlertNotifier.init();
        const onAck = window.Bus.on.mock.calls.find(c => c[0] === 'alert:acknowledged')[1];

        onAck('alert-123');
        expect(window.Store.set).toHaveBeenCalledWith('ops.alerts.unread', 4);
    });

    test('_onAcknowledge does not go below zero', () => {
        window.Store.get.mockReturnValue(0);

        AlertNotifier.init();
        const onAck = window.Bus.on.mock.calls.find(c => c[0] === 'alert:acknowledged')[1];

        onAck('alert-123');
        expect(window.Store.set).toHaveBeenCalledWith('ops.alerts.unread', 0);
    });

    test('_updateSidebarBadge shows badge with count', () => {
        const badge = { textContent: '', style: { display: '' } };
        document.querySelector = jest.fn(() => badge);

        AlertNotifier.init();
        const updateBadge = window.Store.watch.mock.calls.find(
            c => c[0] === 'ops.alerts.unread'
        )[1];

        updateBadge(5);
        expect(badge.textContent).toBe(5);
        expect(badge.style.display).toBe('flex');
    });

    test('_updateSidebarBadge hides badge when zero', () => {
        const badge = { textContent: '', style: { display: '' } };
        document.querySelector = jest.fn(() => badge);

        AlertNotifier.init();
        const updateBadge = window.Store.watch.mock.calls.find(
            c => c[0] === 'ops.alerts.unread'
        )[1];

        updateBadge(0);
        expect(badge.style.display).toBe('none');
    });
});
