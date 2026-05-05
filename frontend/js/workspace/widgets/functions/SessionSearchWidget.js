/**
 * SessionSearchWidget — 会话搜索
 *
 * 功能: 搜索输入框，输入后搜索会话，显示搜索结果列表（最多5条），点击跳转
 * 类型: function, category: functions, defaultSize: {w:1, h:1}
 *
 * 依赖: DataService (全局), Router (全局), WidgetRegistry (全局)
 */
const SessionSearchWidget = (() => {
    'use strict';

    const MAX_RESULTS = 5;

    function mount(container, props) {
        container.innerHTML = `
            <div class="ws-widget">
                <div class="ws-widget__content" style="display:flex; flex-direction:column; padding:12px; gap:8px;">
                    <div style="position:relative; display:flex; align-items:center;">
                        <span style="position:absolute; left:10px; font-size:14px; color:var(--text-tertiary); pointer-events:none;">🔎</span>
                        <input type="text" class="ws-widget__session-search-input"
                               placeholder="搜索会话..."
                               style="width:100%; padding:8px 10px 8px 32px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--surface); color:var(--text-primary); font-size:var(--text-sm); outline:none; transition:border-color 0.15s;"
                        />
                    </div>
                    <div class="ws-widget__session-results" style="display:flex; flex-direction:column; gap:4px; max-height:160px; overflow-y:auto;"></div>
                </div>
            </div>`;

        const input = container.querySelector('.ws-widget__session-search-input');
        const resultsEl = container.querySelector('.ws-widget__session-results');
        let _sessions = [];
        let _debounceTimer = null;

        // 输入框聚焦样式
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--primary, #4f46e5)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = 'var(--border)';
        });

        // 加载会话数据
        async function _loadSessions() {
            try {
                if (typeof DataService !== 'undefined') {
                    const data = await DataService.fetch('sessions');
                    _sessions = Array.isArray(data) ? data : (data?.items || data?.results || []);
                }
            } catch (err) {
                _sessions = [];
            }
        }

        // 渲染搜索结果
        function _renderResults(query) {
            if (!query) {
                resultsEl.innerHTML = '';
                return;
            }

            const keyword = query.toLowerCase();
            const filtered = _sessions.filter(s => {
                const title = (s.title || s.name || s.topic || '').toLowerCase();
                const summary = (s.summary || s.lastMessage || '').toLowerCase();
                return title.includes(keyword) || summary.includes(keyword);
            }).slice(0, MAX_RESULTS);

            if (filtered.length === 0) {
                resultsEl.innerHTML = `
                    <div style="text-align:center; padding:12px; color:var(--text-tertiary); font-size:var(--text-xs);">
                        未找到匹配的会话
                    </div>`;
                return;
            }

            resultsEl.innerHTML = filtered.map(s => {
                const title = s.title || s.name || s.topic || '未命名会话';
                const summary = s.summary || s.lastMessage || '';
                const sessionId = s.id || s.session_id || '';
                return `
                    <div class="ws-widget__session-item" data-session-id="${sessionId}"
                         style="padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius-sm); cursor:pointer; transition:background 0.15s;">
                        <div style="font-size:var(--text-sm); color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${title}</div>
                        ${summary ? `<div style="font-size:var(--text-xs); color:var(--text-tertiary); margin-top:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${summary}</div>` : ''}
                    </div>`;
            }).join('');

            // 结果项悬停效果
            resultsEl.querySelectorAll('.ws-widget__session-item').forEach(item => {
                item.addEventListener('mouseenter', () => {
                    item.style.background = 'var(--surface-hover, var(--surface))';
                });
                item.addEventListener('mouseleave', () => {
                    item.style.background = '';
                });
            });
        }

        // 输入事件（防抖 300ms）
        const _handleInput = () => {
            clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => {
                _renderResults(input.value.trim());
            }, 300);
        };
        input.addEventListener('input', _handleInput);

        // 点击结果跳转
        const _handleClick = (e) => {
            const item = e.target.closest('[data-session-id]');
            if (item && item.dataset.sessionId && typeof Router !== 'undefined') {
                Router.navigate('sessions', { id: item.dataset.sessionId });
            }
        };
        resultsEl.addEventListener('click', _handleClick);

        // 初始加载会话数据
        _loadSessions();

        return {
            destroy() {
                clearTimeout(_debounceTimer);
                input.removeEventListener('input', _handleInput);
                resultsEl.removeEventListener('click', _handleClick);
                container.innerHTML = '';
            },
            async refresh() {
                await _loadSessions();
                _renderResults(input.value.trim());
            }
        };
    }

    WidgetRegistry.register('session-search', {
        type: 'function',
        label: '会话搜索',
        icon: 'search',
        description: '搜索会话并快速跳转',
        defaultSize: { w: 1, h: 1 },
        category: 'functions',
        mount
    });
})();
