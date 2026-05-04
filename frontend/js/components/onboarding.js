/**
 * Hermes Agent - 新手引导组件 (v13.3.0)
 * 首次访问时展示 4 步引导，帮助新用户快速了解产品
 */
const _Onboarding = (() => {
    const STORAGE_KEY = 'hermes_onboarding_done';
    const steps = [
        {
            title: '欢迎使用 Hermes',
            desc: '你的 AI 助手管理中心。在这里管理知识库、监控运行状态、配置 AI 助手行为。',
            icon: 'sparkles',
            target: '.sidebar-brand'
        },
        {
            title: '知识库',
            desc: '存储和管理 AI 助手的知识、规则和经验，让它变得更聪明、更懂你。',
            icon: 'bookOpen',
            target: '[data-page="knowledge"]'
        },
        {
            title: '功能商店',
            desc: '浏览和安装 MCP 服务、技能和插件，扩展 AI 助手的能力边界。',
            icon: 'store',
            target: '[data-page="marketplace"]'
        },
        {
            title: '运维中心',
            desc: '实时监控 AI 助手的运行状态、资源使用和错误信息，一切尽在掌握。',
            icon: 'activity',
            target: '[data-page="ops_center"]'
        }
    ];

    let _currentStep = 0;
    let _overlay = null;

    function isDone() {
        return localStorage.getItem(STORAGE_KEY) === '1';
    }

    function reset() {
        localStorage.removeItem(STORAGE_KEY);
    }

    function start() {
        if (isDone()) return;
        _currentStep = 0;
        _createOverlay();
        _renderStep();
    }

    function _createOverlay() {
        if (_overlay) _overlay.remove();
        _overlay = document.createElement('div');
        _overlay.id = 'onboarding-overlay';
        _overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;animation:fadeIn 0.3s ease';
        document.body.appendChild(_overlay);
        _overlay.addEventListener('click', (e) => {
            if (e.target === _overlay) _close();
        });
    }

    function _renderStep() {
        if (_currentStep >= steps.length) {
            _close();
            return;
        }
        const step = steps[_currentStep];
        const isLast = _currentStep === steps.length - 1;
        const progress = ((_currentStep + 1) / steps.length * 100).toFixed(0);

        _overlay.innerHTML = `
            <div style="background:var(--bg-primary);border-radius:16px;padding:32px;max-width:420px;width:90%;box-shadow:0 20px 60px rgba(0,0,0,0.3);text-align:center;animation:scaleIn 0.3s ease">
                <div style="font-size:48px;margin-bottom:16px;color:var(--accent)">${Components.icon(step.icon, 48)}</div>
                <h2 style="font-size:20px;font-weight:700;color:var(--text-primary);margin:0 0 8px">${step.title}</h2>
                <p style="font-size:14px;line-height:1.7;color:var(--text-secondary);margin:0 0 24px">${step.desc}</p>
                <div style="display:flex;gap:4px;margin-bottom:20px;justify-content:center">
                    ${steps.map((_, i) => `<div style="width:${i === _currentStep ? '24px' : '8px'};height:8px;border-radius:4px;background:${i === _currentStep ? 'var(--accent)' : 'var(--border)'};transition:all 0.3s"></div>`).join('')}
                </div>
                <div style="display:flex;gap:10px;justify-content:center">
                    <button class="btn btn-ghost" onclick="Components.Onboarding._close()" style="min-width:80px">跳过</button>
                    <button class="btn btn-primary" onclick="Components.Onboarding._next()" style="min-width:80px">${isLast ? '开始使用' : '下一步'}</button>
                </div>
            </div>
        `;
    }

    function _next() {
        _currentStep++;
        if (_currentStep >= steps.length) {
            _close();
        } else {
            _renderStep();
        }
    }

    function _close() {
        localStorage.setItem(STORAGE_KEY, '1');
        if (_overlay) {
            _overlay.style.animation = 'fadeOut 0.2s ease';
            setTimeout(() => {
                if (_overlay) _overlay.remove();
                _overlay = null;
            }, 200);
        }
    }

    return { start, isDone, reset, _next: _next, _close: _close };
})();
