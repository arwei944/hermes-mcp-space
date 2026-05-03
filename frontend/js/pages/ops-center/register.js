/**
 * Ops Center - 注册入口
 * 懒加载所有 Tab 模块，绑定事件，SSE 转发
 */

var OpsCenterPage = (() => {
    var _modules = {};
    var _currentTab = 'overview';
    var _initializedTabs = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = (await import('./page.js')).default;
        _modules.overviewTab = (await import('./OverviewTab.js')).default;
        _modules.pipelineTab = (await import('./PipelineTab.js')).default;
        _modules.resourceTab = (await import('./ResourceTab.js')).default;
        _modules.qualityTab = (await import('./QualityTab.js')).default;
        _modules.errorTraceTab = (await import('./ErrorTraceTab.js')).default;
        _modules.alertTab = (await import('./AlertTab.js')).default;
        _modules.logTab = (await import('./LogTab.js')).default;
        _modules.aboutTab = (await import('./AboutTab.js')).default;
    }

    async function _renderTab(tab) {
        if (_initializedTabs[tab]) return;
        _initializedTabs[tab] = true;

        var renderMap = {
            overview: function() { return _modules.overviewTab.render('#ops-center-overview'); },
            pipeline: function() { return _modules.pipelineTab.render('#ops-center-pipeline'); },
            resource: function() { return _modules.resourceTab.render('#ops-center-resource'); },
            quality: function() { return _modules.qualityTab.render('#ops-center-quality'); },
            errors: function() { return _modules.errorTraceTab.render('#ops-center-errors'); },
            alerts: function() { return _modules.alertTab.render('#ops-center-alerts'); },
            logs: function() { return _modules.logTab.render('#ops-center-logs'); },
            about: function() { return _modules.aboutTab.render('#ops-center-about'); },
        };

        var fn = renderMap[tab];
        if (fn) {
            try {
                await fn();
            } catch (_err) {
                // ignore render errors
            }
        }
    }

    async function render() {
        await _ensureModules();
        var container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        container.innerHTML = _modules.page.buildLayout();

        // 渲染初始 tab
        await _renderTab(_currentTab);
    }

    function switchTab(tab) {
        _currentTab = tab;
        _modules.page.switchTab(tab);
        _renderTab(tab);
    }

    function onSSEEvent(type, data) {
        // 转发到 AlertTab
        if (_modules.alertTab && _modules.alertTab.onSSEEvent) {
            _modules.alertTab.onSSEEvent(type, data);
        }

        // Toast 通知
        if (type === 'ops.alert') {
            var level = data.level || 'info';
            var msg = data.message || data.msg || '收到运维告警';
            Components.Toast.show(msg, level === 'error' ? 'error' : level === 'warning' ? 'warning' : 'info');
        }
    }

    function destroy() {
        Object.values(_modules).forEach(function(m) {
            if (m && m.destroy) m.destroy();
        });
        _modules = {};
        _initializedTabs = {};
    }

    return { render, switchTab, _renderTab, onSSEEvent, destroy };
})();

window.OpsCenterPage = ErrorHandler.wrap(OpsCenterPage);
