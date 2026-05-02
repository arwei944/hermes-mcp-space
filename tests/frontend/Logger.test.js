/**
 * Logger 模块单元测试
 * 使用 eval 重新加载源码以获得全新实例
 */
const fs = require('fs');
const path = require('path');

const CORE_DIR = path.resolve(__dirname, '../../frontend/js/core');

function loadModule(filename) {
    const code = fs.readFileSync(path.join(CORE_DIR, filename), 'utf-8');
    eval(code);
}

describe('Logger', () => {
    let Logger;

    beforeEach(() => {
        delete window.Logger;
        delete window.Bus;
        delete window.Store;
        delete window.Events;
        delete window.ErrorHandler;
        delete window.Router;
        delete window.APIClient;
        loadModule('Logger.js');
        Logger = window.Logger;
        Logger.clear();
        Logger.setLevel('debug');
    });

    afterEach(() => {
        Logger.setLevel('info');
    });

    // ---------- log levels ----------

    describe('log levels', () => {
        test('debug() logs at debug level', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
            Logger.debug('test debug');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toContain('DEBUG');
            spy.mockRestore();
        });

        test('info() logs at info level', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
            Logger.info('test info');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toContain('INFO');
            spy.mockRestore();
        });

        test('warn() logs at warn level', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
            Logger.warn('test warn');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toContain('WARN');
            spy.mockRestore();
        });

        test('error() logs at error level', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
            Logger.error('test error');
            expect(spy).toHaveBeenCalledTimes(1);
            expect(spy.mock.calls[0][0]).toContain('ERROR');
            spy.mockRestore();
        });

        test('setLevel() filters lower-priority messages', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
            Logger.setLevel('warn');
            Logger.debug('should not appear');
            Logger.info('should not appear');
            Logger.warn('should appear');
            Logger.error('should also appear');
            expect(spy).toHaveBeenCalledTimes(2);
            spy.mockRestore();
        });

        test('setLevel("silent") suppresses all output', () => {
            const spy = jest.spyOn(console, 'log').mockImplementation(() => {});
            Logger.setLevel('silent');
            Logger.debug('no');
            Logger.info('no');
            Logger.warn('no');
            Logger.error('no');
            expect(spy).not.toHaveBeenCalled();
            spy.mockRestore();
        });
    });

    // ---------- buffer management ----------

    describe('buffer management', () => {
        test('getBuffer() returns logged entries', () => {
            Logger.debug('entry1');
            Logger.info('entry2');
            const buf = Logger.getBuffer();
            expect(buf.length).toBe(2);
            expect(buf[0].level).toBe('debug');
            expect(buf[1].level).toBe('info');
        });

        test('clear() empties the buffer', () => {
            Logger.info('will be cleared');
            Logger.clear();
            expect(Logger.getBuffer()).toEqual([]);
        });

        test('buffer respects MAX_BUFFER (100)', () => {
            Logger.setLevel('debug');
            for (let i = 0; i < 110; i++) {
                Logger.debug(`msg-${i}`);
            }
            const buf = Logger.getBuffer();
            expect(buf.length).toBe(100);
            expect(buf[0].args[0]).toBe('msg-10');
        });

        test('buffer entries have timestamp and level', () => {
            Logger.info('check');
            const buf = Logger.getBuffer();
            expect(buf[0]).toHaveProperty('timestamp');
            expect(buf[0]).toHaveProperty('level');
            expect(buf[0]).toHaveProperty('args');
            expect(buf[0].level).toBe('info');
        });
    });
});
