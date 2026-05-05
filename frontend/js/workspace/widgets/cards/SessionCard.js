/**
 * SessionCard.js
 * 统一会话卡片 — 支持 4 种尺寸 (small/medium/large/xlarge)
 * xlarge 模式下包含卡片内导航：会话列表 ↔ 聊天界面
 *
 * 依赖: WidgetRegistry, HermesClient, DataService, CardOverlay, Components, Bus
 */
var SessionCard = (() => {
    'use strict';

    // ========== 常量 ==========
    var CACHE_KEY = 'sessions:list';
    var API_SESSIONS = '/api/sessions';
    var API_MESSAGES = '/api/sessions/{id}/messages';
    var API_SEARCH = '/api/sessions/search';
    var API_SEND_MSG = '/api/sessions/{id}/messages';
    var DEBOUNCE_MS = 300;
    var MAX_ITEMS = {
        small: 0,
        medium: 4,
        large: 6,
        xlarge: 50
    };

    // ========== 工具函数 ==========

    /**
     * 相对时间格式化
     */
    function formatRelativeTime(ts) {
        if (!ts) return '';
        var d = new Date(ts);
        if (isNaN(d.getTime())) return '';
        var now = new Date();
        var diffMs = now - d;
        var diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return '刚刚';
        if (diffMin < 60) return diffMin + '分钟前';
        var diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return diffHr + '小时前';
        var diffDay = Math.floor(diffHr / 24);
        if (diffDay < 30) return diffDay + '天前';
        return (d.getMonth() + 1) + '/' + d.getDate();
    }

    /**
     * 截断字符串
     */
    function truncate(str, maxLen) {
        if (!str) return '';
        if (str.length <= maxLen) return str;
        return str.substring(0, maxLen) + '...';
    }

    /**
     * 判断卡片尺寸
     */
    function getSize(props) {
        if (!props || !props.config) return 'medium';
        var w = props.config.w || 2;
        var h = props.config.h || 1;
        if (w === 1 && h === 1) return 'small';
        if (w === 2 && h === 1) return 'medium';
        if (w === 2 && h === 2) return 'large';
        return 'xlarge';
    }

    /**
     * 获取消息数量
     */
    function getMsgCount(session) {
        return session.message_count || session.messages || 0;
    }

    /**
     * 获取会话 ID
     */
    function getSessionId(session) {
        return session.id || session.session_id || '';
    }

    /**
     * 获取会话标题
     */
    function getSessionTitle(session) {
        return session.title || '未命名会话';
    }

    /**
     * 状态文本映射
     */
    function statusText(status) {
        var map = { active: '活跃', completed: '完成' };
        return map[status] || status || '未知';
    }

    /**
     * 状态颜色映射
     */
    function statusColor(status) {
        var map = { active: 'var(--green)', completed: 'var(--text-tertiary)' };
        return map[status] || 'var(--text-tertiary)';
    }

    /**
     * 安全 HTML 转义
     */
    function esc(str) {
        if (typeof Components !== 'undefined' && Components.escapeHtml) {
            return Components.escapeHtml(str);
        }
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    /**
     * 安全渲染 Markdown
     */
    function renderMd(text) {
        if (typeof Components !== 'undefined' && Components.renderMarkdown) {
            return Components.renderMarkdown(text);
        }
        return esc(text || '');
    }

    /**
     * 安全格式化日期时间
     */
    function formatDT(ts) {
        if (typeof Components !== 'undefined' && Components.formatDateTime) {
            return Components.formatDateTime(ts);
        }
        if (!ts) return '';
        return new Date(ts).toLocaleString('zh-CN');
    }

    /**
     * 渲染标签徽章
     */
    function renderBadge(text, color) {
        if (typeof Components !== 'undefined' && Components.renderBadge) {
            return Components.renderBadge(text, color);
        }
        return '<span style="display:inline-block;padding:1px 6px;border-radius:4px;font-size:10px;background:' +
            (color || 'var(--bg-tertiary)') + ';color:var(--text-secondary);">' + esc(text) + '</span>';
    }

    /**
     * 创建加载占位
     */
    function createLoading() {
        if (typeof Components !== 'undefined' && Components.createLoading) {
            return Components.createLoading();
        }
        return '<div style="display:flex;align-items:center;justify-content:center;padding:20px;color:var(--text-tertiary);">加载中...</div>';
    }

    /**
     * 显示 Toast 提示
     */
    function showToast(msg, type) {
        if (typeof Components !== 'undefined' && Components.showToast) {
            Components.showToast(msg, type);
        } else {
            console.log('[SessionCard] ' + (type || 'info') + ': ' + msg);
        }
    }

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (document.getElementById('sc-styles')) return;
        var style = document.createElement('style');
        style.id = 'sc-styles';
        style.textContent = [
            /* ===== 会话卡片基础 ===== */
            '.sc-card { display:flex; flex-direction:column; height:100%; overflow:hidden; }',
            '.sc-card__header { display:flex; align-items:center; gap:8px; padding:10px 12px; flex-shrink:0; }',
            '.sc-card__title { font-size:var(--text-sm); font-weight:600; color:var(--text-primary); flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
            '.sc-card__count { font-size:var(--text-xs); color:var(--text-tertiary); flex-shrink:0; }',
            '.sc-card__body { flex:1; overflow-y:auto; overflow-x:hidden; padding:0 12px 12px; }',
            '.sc-card__body::-webkit-scrollbar { width:4px; }',
            '.sc-card__body::-webkit-scrollbar-thumb { background:var(--border); border-radius:2px; }',

            /* ===== 小尺寸 (1x1) ===== */
            '.sc-small { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; cursor:pointer; padding:16px; text-align:center; transition:opacity .2s; }',
            '.sc-small:hover { opacity:0.85; }',
            '.sc-small__icon { font-size:32px; margin-bottom:6px; }',
            '.sc-small__label { font-size:var(--text-sm); font-weight:600; color:var(--text-primary); }',
            '.sc-small__count { font-size:var(--text-2xl); font-weight:700; color:var(--accent); margin-top:4px; }',
            '.sc-small__unit { font-size:var(--text-xs); color:var(--text-tertiary); margin-top:2px; }',

            /* ===== 会话列表项 ===== */
            '.sc-item { display:flex; align-items:center; gap:8px; padding:8px; border-radius:var(--radius-sm); cursor:pointer; transition:background .15s; }',
            '.sc-item:hover { background:var(--bg-secondary); }',
            '.sc-item__info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }',
            '.sc-item__title { font-size:var(--text-xs); color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
            '.sc-item__meta { display:flex; align-items:center; gap:6px; font-size:10px; color:var(--text-tertiary); }',
            '.sc-item__badge { flex-shrink:0; }',
            '.sc-item__tags { display:flex; gap:3px; flex-wrap:wrap; margin-top:2px; }',
            '.sc-item__tag { font-size:9px; padding:0 4px; border-radius:3px; background:var(--bg-tertiary); color:var(--text-tertiary); }',
            '.sc-item__status { width:6px; height:6px; border-radius:50%; flex-shrink:0; }',

            /* ===== 搜索框 ===== */
            '.sc-search { display:flex; align-items:center; gap:6px; padding:0 12px; flex-shrink:0; }',
            '.sc-search__input { flex:1; padding:5px 10px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-secondary); color:var(--text-primary); font-size:var(--text-xs); outline:none; transition:border-color .2s; }',
            '.sc-search__input:focus { border-color:var(--accent); }',
            '.sc-search__input::placeholder { color:var(--text-tertiary); }',

            /* ===== 状态过滤标签 ===== */
            '.sc-filters { display:flex; gap:4px; padding:4px 12px; flex-shrink:0; }',
            '.sc-filter { padding:3px 10px; border-radius:var(--radius-xs); font-size:var(--text-xs); color:var(--text-secondary); background:transparent; border:none; cursor:pointer; transition:all .15s; }',
            '.sc-filter:hover { background:var(--bg-secondary); }',
            '.sc-filter--active { background:var(--accent); color:#fff; }',

            /* ===== xlarge 列表视图 ===== */
            '.sc-xlarge { display:flex; flex-direction:column; height:100%; }',
            '.sc-xlarge__header { display:flex; align-items:center; gap:10px; padding:14px 16px; border-bottom:1px solid var(--border); flex-shrink:0; }',
            '.sc-xlarge__title { font-size:var(--text-lg); font-weight:600; color:var(--text-primary); }',
            '.sc-xlarge__search { flex:1; max-width:280px; }',
            '.sc-xlarge__search-input { width:100%; padding:7px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-secondary); color:var(--text-primary); font-size:var(--text-sm); outline:none; transition:border-color .2s; }',
            '.sc-xlarge__search-input:focus { border-color:var(--accent); }',
            '.sc-xlarge__search-input::placeholder { color:var(--text-tertiary); }',
            '.sc-xlarge__filters { display:flex; gap:6px; padding:8px 16px; border-bottom:1px solid var(--border); flex-shrink:0; }',
            '.sc-xlarge__filter { padding:5px 14px; border-radius:var(--radius-sm); font-size:var(--text-sm); color:var(--text-secondary); background:transparent; border:1px solid transparent; cursor:pointer; transition:all .15s; }',
            '.sc-xlarge__filter:hover { background:var(--bg-secondary); }',
            '.sc-xlarge__filter--active { background:var(--accent); color:#fff; border-color:var(--accent); }',
            '.sc-xlarge__list { flex:1; overflow-y:auto; padding:8px 12px; }',
            '.sc-xlarge__list::-webkit-scrollbar { width:6px; }',
            '.sc-xlarge__list::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }',
            '.sc-xlarge__item { display:flex; align-items:center; gap:10px; padding:10px 12px; border-radius:var(--radius-sm); cursor:pointer; transition:background .15s; margin-bottom:2px; }',
            '.sc-xlarge__item:hover { background:var(--bg-secondary); }',
            '.sc-xlarge__item-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }',
            '.sc-xlarge__item-title { font-size:var(--text-sm); font-weight:500; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
            '.sc-xlarge__item-meta { display:flex; align-items:center; gap:8px; font-size:var(--text-xs); color:var(--text-tertiary); }',
            '.sc-xlarge__item-tags { display:flex; gap:4px; flex-wrap:wrap; }',
            '.sc-xlarge__item-tag { font-size:10px; padding:1px 6px; border-radius:4px; background:var(--bg-tertiary); color:var(--text-tertiary); }',

            /* ===== xlarge 聊天视图 ===== */
            '.sc-chat { display:flex; flex-direction:column; height:100%; }',
            '.sc-chat__header { display:flex; align-items:center; gap:10px; padding:12px 16px; border-bottom:1px solid var(--border); flex-shrink:0; }',
            '.sc-chat__back { display:flex; align-items:center; justify-content:center; width:32px; height:32px; border:none; border-radius:var(--radius-sm); background:var(--bg-secondary); color:var(--text-secondary); font-size:16px; cursor:pointer; transition:background .15s; flex-shrink:0; }',
            '.sc-chat__back:hover { background:var(--bg-tertiary); }',
            '.sc-chat__session-info { flex:1; min-width:0; display:flex; align-items:center; gap:8px; }',
            '.sc-chat__session-title { font-size:var(--text-sm); font-weight:600; color:var(--text-primary); overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
            '.sc-chat__msg-count { font-size:var(--text-xs); color:var(--text-tertiary); flex-shrink:0; }',

            /* ===== 聊天消息列表 ===== */
            '.sc-chat__messages { flex:1; overflow-y:auto; padding:16px; display:flex; flex-direction:column; gap:12px; }',
            '.sc-chat__messages::-webkit-scrollbar { width:6px; }',
            '.sc-chat__messages::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }',

            /* ===== 消息气泡 ===== */
            '.sc-msg { display:flex; flex-direction:column; max-width:80%; animation:scMsgFadeIn .3s ease; }',
            '.sc-msg--user { align-self:flex-end; align-items:flex-end; }',
            '.sc-msg--assistant { align-self:flex-start; align-items:flex-start; }',
            '.sc-msg--system { align-self:center; align-items:center; max-width:90%; }',
            '.sc-msg__header { display:flex; align-items:center; gap:6px; margin-bottom:4px; }',
            '.sc-msg__role { font-size:10px; font-weight:600; color:var(--text-secondary); text-transform:uppercase; }',
            '.sc-msg__time { font-size:10px; color:var(--text-tertiary); }',
            '.sc-msg__bubble { padding:10px 14px; border-radius:var(--radius-sm); font-size:var(--text-sm); line-height:1.6; word-break:break-word; }',
            '.sc-msg--user .sc-msg__bubble { background:var(--accent); color:#fff; border-bottom-right-radius:4px; }',
            '.sc-msg--assistant .sc-msg__bubble { background:var(--bg-secondary); color:var(--text-primary); border-bottom-left-radius:4px; }',
            '.sc-msg--system .sc-msg__bubble { background:var(--bg-tertiary); color:var(--text-tertiary); font-size:var(--text-xs); }',
            '.sc-msg__bubble p { margin:0 0 6px; }',
            '.sc-msg__bubble p:last-child { margin-bottom:0; }',
            '.sc-msg__bubble code { font-family:var(--font-mono); font-size:12px; background:rgba(0,0,0,0.08); padding:1px 4px; border-radius:3px; }',
            '.sc-msg__bubble pre { background:rgba(0,0,0,0.06); padding:8px 10px; border-radius:var(--radius-xs); overflow-x:auto; margin:6px 0; }',
            '.sc-msg__bubble pre code { background:none; padding:0; }',

            /* ===== 工具调用卡片 ===== */
            '.sc-tool { margin:4px 0; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-secondary); overflow:hidden; }',
            '.sc-tool__header { display:flex; align-items:center; gap:8px; padding:8px 10px; cursor:pointer; user-select:none; transition:background .15s; }',
            '.sc-tool__header:hover { background:var(--bg-tertiary); }',
            '.sc-tool__name { font-size:var(--text-xs); font-weight:500; color:var(--accent); }',
            '.sc-tool__status { font-size:10px; display:flex; align-items:center; gap:3px; }',
            '.sc-tool__status--success { color:var(--green); }',
            '.sc-tool__status--error { color:var(--red); }',
            '.sc-tool__duration { font-size:10px; color:var(--text-tertiary); }',
            '.sc-tool__chevron { margin-left:auto; color:var(--text-tertiary); transition:transform .2s; font-size:12px; }',
            '.sc-tool__chevron--open { transform:rotate(180deg); }',
            '.sc-tool__result { display:none; padding:8px 10px; border-top:1px solid var(--border); font-size:11px; font-family:var(--font-mono); color:var(--text-secondary); max-height:200px; overflow:auto; white-space:pre-wrap; background:var(--bg); }',
            '.sc-tool__result--open { display:block; }',

            /* ===== 输入栏 ===== */
            '.sc-chat__input-bar { display:flex; align-items:center; gap:8px; padding:12px 16px; border-top:1px solid var(--border); background:var(--bg); flex-shrink:0; }',
            '.sc-chat__input { flex:1; padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-sm); background:var(--bg-secondary); color:var(--text-primary); font-size:var(--text-sm); outline:none; resize:none; transition:border-color .2s; font-family:inherit; }',
            '.sc-chat__input:focus { border-color:var(--accent); }',
            '.sc-chat__input::placeholder { color:var(--text-tertiary); }',
            '.sc-chat__send { padding:8px 16px; border:none; border-radius:var(--radius-sm); background:var(--accent); color:#fff; font-size:var(--text-sm); font-weight:500; cursor:pointer; transition:opacity .15s; flex-shrink:0; }',
            '.sc-chat__send:hover { opacity:0.85; }',
            '.sc-chat__send:disabled { opacity:0.4; cursor:not-allowed; }',

            /* ===== 打字指示器 ===== */
            '.sc-typing { display:flex; gap:4px; padding:10px 14px; align-self:flex-start; }',
            '.sc-typing__dot { width:6px; height:6px; border-radius:50%; background:var(--text-tertiary); animation:scTypingBounce .6s infinite alternate; }',
            '.sc-typing__dot:nth-child(2) { animation-delay:.2s; }',
            '.sc-typing__dot:nth-child(3) { animation-delay:.4s; }',

            /* ===== 空状态 ===== */
            '.sc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px 20px; color:var(--text-tertiary); text-align:center; }',
            '.sc-empty__icon { font-size:28px; margin-bottom:8px; opacity:0.6; }',
            '.sc-empty__text { font-size:var(--text-xs); }',

            /* ===== 错误状态 ===== */
            '.sc-error { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:20px; color:var(--red); text-align:center; gap:6px; }',
            '.sc-error__icon { font-size:24px; }',
            '.sc-error__text { font-size:var(--text-xs); }',
            '.sc-error__retry { padding:4px 12px; border:1px solid var(--red); border-radius:var(--radius-xs); background:transparent; color:var(--red); font-size:var(--text-xs); cursor:pointer; margin-top:4px; }',

            /* ===== 动画 ===== */
            '@keyframes scMsgFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }',
            '@keyframes scTypingBounce { from { transform:translateY(0); } to { transform:translateY(-4px); } }'
        ].join('\n');
        document.head.appendChild(style);
    }

    // ========== 数据获取 ==========

    /**
     * 获取会话列表（带缓存）
     */
    function fetchSessions() {
        if (typeof HermesClient !== 'undefined' && HermesClient.cachedGet) {
            return HermesClient.cachedGet(CACHE_KEY, function () {
                return HermesClient.get(API_SESSIONS);
            });
        }
        if (typeof DataService !== 'undefined') {
            return DataService.fetch('sessions');
        }
        if (typeof HermesClient !== 'undefined') {
            return HermesClient.get(API_SESSIONS);
        }
        return Promise.resolve([]);
    }

    /**
     * 搜索会话
     */
    function searchSessions(term) {
        if (!term || !term.trim()) return fetchSessions();
        if (typeof HermesClient !== 'undefined') {
            return HermesClient.get(API_SEARCH + '?q=' + encodeURIComponent(term.trim()));
        }
        return Promise.resolve([]);
    }

    /**
     * 获取会话消息
     */
    function fetchMessages(sessionId) {
        if (!sessionId) return Promise.resolve([]);
        var url = API_MESSAGES.replace('{id}', sessionId);
        if (typeof HermesClient !== 'undefined') {
            return HermesClient.get(url);
        }
        return Promise.resolve([]);
    }

    /**
     * 发送消息
     */
    function sendMessage(sessionId, content) {
        if (!sessionId || !content) return Promise.reject(new Error('缺少参数'));
        var url = API_SEND_MSG.replace('{id}', sessionId);
        if (typeof HermesClient !== 'undefined') {
            return HermesClient.post(url, { content: content });
        }
        return Promise.reject(new Error('HermesClient 不可用'));
    }

    // ========== 渲染函数：Small (1x1) ==========

    function renderSmall(container, sessions) {
        var count = Array.isArray(sessions) ? sessions.length : 0;
        container.innerHTML =
            '<div class="sc-small" data-action="openOverlay">' +
                '<div class="sc-small__icon">\u{1F4AC}</div>' +
                '<div class="sc-small__label">会话</div>' +
                '<div class="sc-small__count">' + count + '</div>' +
                '<div class="sc-small__unit">个会话</div>' +
            '</div>';
    }

    // ========== 渲染函数：Medium (2x1) ==========

    function renderMedium(container, sessions) {
        var count = Array.isArray(sessions) ? sessions.length : 0;
        var items = (Array.isArray(sessions) ? sessions : []).slice(0, MAX_ITEMS.medium);
        var itemsHtml = '';

        if (items.length === 0) {
            itemsHtml = '<div class="sc-empty"><div class="sc-empty__icon">\u{1F4ED}</div><div class="sc-empty__text">暂无会话</div></div>';
        } else {
            for (var i = 0; i < items.length; i++) {
                var s = items[i];
                var sid = getSessionId(s);
                var title = truncate(getSessionTitle(s), 20);
                var msgCount = getMsgCount(s);
                var time = formatRelativeTime(s.updated_at || s.createdAt);
                itemsHtml +=
                    '<div class="sc-item" data-action="openSession" data-session-id="' + esc(sid) + '">' +
                        '<div class="sc-item__info">' +
                            '<div class="sc-item__title">' + esc(title) + '</div>' +
                            '<div class="sc-item__meta">' +
                                '<span>' + msgCount + ' 条消息</span>' +
                                '<span>' + time + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
            }
        }

        container.innerHTML =
            '<div class="sc-card">' +
                '<div class="sc-card__header">' +
                    '<span>\u{1F4AC}</span>' +
                    '<span class="sc-card__title">会话</span>' +
                    '<span class="sc-card__count">' + count + '</span>' +
                '</div>' +
                '<div class="sc-card__body">' + itemsHtml + '</div>' +
            '</div>';
    }

    // ========== 渲染函数：Large (2x2) ==========

    function renderLarge(container, sessions, filter, searchTerm) {
        var filtered = _filterSessions(sessions, filter, searchTerm);
        var count = Array.isArray(sessions) ? sessions.length : 0;
        var items = filtered.slice(0, MAX_ITEMS.large);
        var itemsHtml = '';

        if (items.length === 0) {
            itemsHtml = '<div class="sc-empty"><div class="sc-empty__icon">\u{1F50D}</div><div class="sc-empty__text">' +
                (searchTerm ? '未找到匹配的会话' : '暂无会话') + '</div></div>';
        } else {
            for (var i = 0; i < items.length; i++) {
                itemsHtml += _renderListItem(items[i], false);
            }
        }

        container.innerHTML =
            '<div class="sc-card">' +
                '<div class="sc-card__header">' +
                    '<span>\u{1F4AC}</span>' +
                    '<span class="sc-card__title">会话</span>' +
                    '<span class="sc-card__count">' + count + '</span>' +
                '</div>' +
                '<div class="sc-search">' +
                    '<input class="sc-search__input" type="text" placeholder="搜索会话..." data-action="search" value="' + esc(searchTerm || '') + '">' +
                '</div>' +
                '<div class="sc-filters">' +
                    '<button class="sc-filter' + (filter === 'all' ? ' sc-filter--active' : '') + '" data-action="setFilter" data-filter="all">全部</button>' +
                    '<button class="sc-filter' + (filter === 'active' ? ' sc-filter--active' : '') + '" data-action="setFilter" data-filter="active">活跃</button>' +
                    '<button class="sc-filter' + (filter === 'completed' ? ' sc-filter--active' : '') + '" data-action="setFilter" data-filter="completed">完成</button>' +
                '</div>' +
                '<div class="sc-card__body">' + itemsHtml + '</div>' +
            '</div>';
    }

    // ========== 渲染函数：XLarge (全屏 Overlay) ==========

    /**
     * 渲染 xlarge 列表视图
     */
    function renderXlargeList(container, sessions, filter, searchTerm) {
        var filtered = _filterSessions(sessions, filter, searchTerm);
        var items = filtered.slice(0, MAX_ITEMS.xlarge);
        var itemsHtml = '';

        if (items.length === 0) {
            itemsHtml = '<div class="sc-empty" style="padding:60px 20px;"><div class="sc-empty__icon">\u{1F50D}</div><div class="sc-empty__text">' +
                (searchTerm ? '未找到匹配的会话' : '暂无会话') + '</div></div>';
        } else {
            for (var i = 0; i < items.length; i++) {
                itemsHtml += _renderListItem(items[i], true);
            }
        }

        container.innerHTML =
            '<div class="sc-xlarge">' +
                '<div class="sc-xlarge__header">' +
                    '<span style="font-size:20px;">\u{1F4AC}</span>' +
                    '<span class="sc-xlarge__title">会话</span>' +
                    '<div class="sc-xlarge__search">' +
                        '<input class="sc-xlarge__search-input" type="text" placeholder="搜索会话..." data-action="search" value="' + esc(searchTerm || '') + '">' +
                    '</div>' +
                '</div>' +
                '<div class="sc-xlarge__filters">' +
                    '<button class="sc-xlarge__filter' + (filter === 'all' ? ' sc-xlarge__filter--active' : '') + '" data-action="setFilter" data-filter="all">全部</button>' +
                    '<button class="sc-xlarge__filter' + (filter === 'active' ? ' sc-xlarge__filter--active' : '') + '" data-action="setFilter" data-filter="active">活跃</button>' +
                    '<button class="sc-xlarge__filter' + (filter === 'completed' ? ' sc-xlarge__filter--active' : '') + '" data-action="setFilter" data-filter="completed">完成</button>' +
                '</div>' +
                '<div class="sc-xlarge__list">' + itemsHtml + '</div>' +
            '</div>';
    }

    /**
     * 渲染 xlarge 聊天视图
     */
    function renderXlargeChat(container, session, messages, isTyping) {
        var sessionTitle = getSessionTitle(session);
        var model = session.model || '';
        var msgCount = messages ? messages.length : 0;
        var messagesHtml = '';

        if (!messages || messages.length === 0) {
            messagesHtml = '<div class="sc-empty"><div class="sc-empty__icon">\u{1F4AC}</div><div class="sc-empty__text">暂无消息</div></div>';
        } else {
            for (var i = 0; i < messages.length; i++) {
                messagesHtml += _renderMessage(messages[i]);
            }
        }

        // 打字指示器
        if (isTyping) {
            messagesHtml +=
                '<div class="sc-msg sc-msg--assistant">' +
                    '<div class="sc-msg__header"><span class="sc-msg__role">助手</span></div>' +
                    '<div class="sc-typing">' +
                        '<span class="sc-typing__dot"></span>' +
                        '<span class="sc-typing__dot"></span>' +
                        '<span class="sc-typing__dot"></span>' +
                    '</div>' +
                '</div>';
        }

        container.innerHTML =
            '<div class="sc-chat">' +
                '<div class="sc-chat__header">' +
                    '<button class="sc-chat__back" data-action="backToList" title="返回">\u2190</button>' +
                    '<div class="sc-chat__session-info">' +
                        '<span class="sc-chat__session-title">' + esc(sessionTitle) + '</span>' +
                        (model ? renderBadge(model, 'blue') : '') +
                    '</div>' +
                    '<span class="sc-chat__msg-count">' + msgCount + ' 条消息</span>' +
                '</div>' +
                '<div class="sc-chat__messages" data-action="messageList">' + messagesHtml + '</div>' +
                '<div class="sc-chat__input-bar">' +
                    '<input class="sc-chat__input" type="text" placeholder="输入消息... (Enter 发送, Shift+Enter 换行)" data-action="chatInput">' +
                    '<button class="sc-chat__send" data-action="sendMessage">发送</button>' +
                '</div>' +
            '</div>';

        // 自动滚动到底部
        _scrollToBottom(container);
    }

    // ========== 列表项渲染 ==========

    function _renderListItem(session, isXlarge) {
        var sid = getSessionId(session);
        var title = getSessionTitle(session);
        var msgCount = getMsgCount(session);
        var time = formatRelativeTime(session.updated_at || session.createdAt);
        var model = session.model || '';
        var status = session.status || '';
        var tags = session.tags || [];
        var prefix = isXlarge ? 'sc-xlarge__item' : 'sc-item';
        var subPrefix = isXlarge ? 'sc-xlarge__item' : 'sc-item';

        // 标签 HTML
        var tagsHtml = '';
        if (tags.length > 0 && isXlarge) {
            tagsHtml = '<div class="' + subPrefix + '-tags">';
            for (var t = 0; t < Math.min(tags.length, 3); t++) {
                tagsHtml += '<span class="' + subPrefix + '-tag">' + esc(tags[t]) + '</span>';
            }
            if (tags.length > 3) {
                tagsHtml += '<span class="' + subPrefix + '-tag">+' + (tags.length - 3) + '</span>';
            }
            tagsHtml += '</div>';
        }

        // 状态指示点
        var statusDot = '';
        if (status) {
            statusDot = '<span class="' + subPrefix + '__status" style="background:' + statusColor(status) + ';" title="' + statusText(status) + '"></span>';
        }

        return '<div class="' + prefix + '" data-action="openSession" data-session-id="' + esc(sid) + '">' +
            statusDot +
            '<div class="' + subPrefix + '-info">' +
                '<div class="' + subPrefix + '-title">' + esc(title) + '</div>' +
                '<div class="' + subPrefix + '-meta">' +
                    (model ? '<span class="' + subPrefix + '__badge">' + renderBadge(model, 'blue') + '</span>' : '') +
                    '<span>' + msgCount + ' 条消息</span>' +
                    '<span>' + time + '</span>' +
                '</div>' +
                tagsHtml +
            '</div>' +
        '</div>';
    }

    // ========== 消息渲染 ==========

    function _renderMessage(msg) {
        if (!msg) return '';
        var role = msg.role || 'user';
        var content = typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content || '');
        var ts = msg.timestamp || '';
        var roleMap = { user: '用户', assistant: '助手', system: '系统' };
        var roleLabel = roleMap[role] || role;

        var html = '<div class="sc-msg sc-msg--' + role + '">' +
            '<div class="sc-msg__header">' +
                '<span class="sc-msg__role">' + roleLabel + '</span>' +
                (ts ? '<span class="sc-msg__time">' + formatDT(ts) + '</span>' : '') +
            '</div>' +
            '<div class="sc-msg__bubble">' + renderMd(content) + '</div>';

        // 工具调用卡片
        if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
            for (var i = 0; i < msg.tool_calls.length; i++) {
                html += _renderToolCall(msg.tool_calls[i], i);
            }
        }

        html += '</div>';
        return html;
    }

    /**
     * 渲染工具调用卡片
     */
    function _renderToolCall(tool, index) {
        if (!tool) return '';
        var name = tool.name || '工具调用';
        var status = tool.status || 'unknown';
        var duration = tool.duration || 0;
        var result = tool.result || '';
        var isSuccess = status === 'success' || status === 'completed';
        var statusClass = isSuccess ? 'sc-tool__status--success' : 'sc-tool__status--error';
        var statusLabel = isSuccess ? '成功' : '失败';
        var durationText = duration > 0 ? duration + 'ms' : '';
        var resultStr = typeof result === 'string' ? result : JSON.stringify(result || {}, null, 2);

        return '<div class="sc-tool" data-action="toggleTool" data-tool-index="' + index + '">' +
            '<div class="sc-tool__header">' +
                '<span style="color:var(--accent);">\u26A1</span>' +
                '<span class="sc-tool__name">' + esc(name) + '</span>' +
                '<span class="sc-tool__status ' + statusClass + '">\u2713 ' + statusLabel + '</span>' +
                (durationText ? '<span class="sc-tool__duration">' + durationText + '</span>' : '') +
                '<span class="sc-tool__chevron">\u25BC</span>' +
            '</div>' +
            '<div class="sc-tool__result">' + esc(resultStr) + '</div>' +
        '</div>';
    }

    // ========== 过滤逻辑 ==========

    function _filterSessions(sessions, filter, searchTerm) {
        var list = Array.isArray(sessions) ? sessions : [];

        // 状态过滤
        if (filter && filter !== 'all') {
            list = list.filter(function (s) { return s.status === filter; });
        }

        // 搜索过滤
        if (searchTerm && searchTerm.trim()) {
            var term = searchTerm.trim().toLowerCase();
            list = list.filter(function (s) {
                var title = (s.title || '').toLowerCase();
                var model = (s.model || '').toLowerCase();
                var tags = (s.tags || []).join(' ').toLowerCase();
                return title.indexOf(term) !== -1 || model.indexOf(term) !== -1 || tags.indexOf(term) !== -1;
            });
        }

        return list;
    }

    // ========== 滚动控制 ==========

    function _scrollToBottom(container) {
        requestAnimationFrame(function () {
            var msgList = container.querySelector('[data-action="messageList"]');
            if (msgList) {
                msgList.scrollTop = msgList.scrollHeight;
            }
        });
    }

    function _isScrolledUp(container) {
        var msgList = container.querySelector('[data-action="messageList"]');
        if (!msgList) return false;
        var threshold = 60;
        return (msgList.scrollHeight - msgList.scrollTop - msgList.clientHeight) > threshold;
    }

    // ========== 主挂载函数 ==========

    async function mount(container, props) {
        var cardId = props.cardId;
        var desktopId = props.desktopId;
        var config = props.config || {};
        var size = getSize(props);

        // 注入样式
        _injectStyles();

        // 内部状态
        var state = {
            sessions: [],
            filter: 'all',
            searchTerm: '',
            // xlarge 聊天状态
            currentSession: null,
            messages: [],
            isTyping: false,
            viewState: 'list', // 'list' | 'chat'
            userScrolledUp: false,
            // 事件处理
            handlers: [],
            searchTimer: null
        };

        // 显示加载
        container.innerHTML = createLoading();

        // 获取数据
        try {
            state.sessions = await fetchSessions();
        } catch (err) {
            console.error('[SessionCard] 获取会话列表失败:', err);
            container.innerHTML =
                '<div class="sc-error">' +
                    '<div class="sc-error__icon">\u26A0\uFE0F</div>' +
                    '<div class="sc-error__text">加载失败</div>' +
                    '<button class="sc-error__retry" data-action="retry">重试</button>' +
                '</div>';
            _bindEvents(container, state, size);
            return _buildLifecycle(state, container, size);
        }

        // 渲染
        _render(container, state, size);

        // 绑定事件
        _bindEvents(container, state, size);

        // SSE 事件订阅
        _subscribeSSE(state, container, size);

        return _buildLifecycle(state, container, size);
    }

    // ========== 渲染分发 ==========

    function _render(container, state, size) {
        switch (size) {
            case 'small':
                renderSmall(container, state.sessions);
                break;
            case 'medium':
                renderMedium(container, state.sessions);
                break;
            case 'large':
                renderLarge(container, state.sessions, state.filter, state.searchTerm);
                break;
            case 'xlarge':
                if (state.viewState === 'chat' && state.currentSession) {
                    renderXlargeChat(container, state.currentSession, state.messages, state.isTyping);
                } else {
                    renderXlargeList(container, state.sessions, state.filter, state.searchTerm);
                }
                break;
        }
    }

    // ========== 事件绑定 ==========

    function _bindEvents(container, state, size) {
        // 事件委托
        function handleClick(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;

            var action = target.getAttribute('data-action');

            switch (action) {
                case 'openOverlay':
                    _handleOpenOverlay();
                    break;
                case 'openSession':
                    _handleOpenSession(target, state, size);
                    break;
                case 'setFilter':
                    _handleSetFilter(target, state, container, size);
                    break;
                case 'search':
                    // 搜索框获取焦点，由 input 事件处理
                    break;
                case 'backToList':
                    _handleBackToList(state, container, size);
                    break;
                case 'sendMessage':
                    _handleSendMessage(state, container, size);
                    break;
                case 'toggleTool':
                    _handleToggleTool(target);
                    break;
                case 'retry':
                    _handleRetry(container, state, size);
                    break;
            }
        }

        function handleInput(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;
            var action = target.getAttribute('data-action');

            if (action === 'search') {
                _handleSearch(target, state, container, size);
            }
        }

        function handleKeyDown(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;
            var action = target.getAttribute('data-action');

            if (action === 'chatInput') {
                // Enter 发送，Shift+Enter 换行
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    _handleSendMessage(state, container, size);
                }
            }
        }

        // 聊天消息列表滚动检测
        function handleScroll(e) {
            var msgList = container.querySelector('[data-action="messageList"]');
            if (e.target === msgList) {
                state.userScrolledUp = _isScrolledUp(container);
            }
        }

        container.addEventListener('click', handleClick);
        container.addEventListener('input', handleInput);
        container.addEventListener('keydown', handleKeyDown);
        container.addEventListener('scroll', handleScroll, true);

        // 保存引用以便清理
        state.handlers.push(
            { el: container, type: 'click', fn: handleClick },
            { el: container, type: 'input', fn: handleInput },
            { el: container, type: 'keydown', fn: handleKeyDown },
            { el: container, type: 'scroll', fn: handleScroll, capture: true }
        );
    }

    // ========== SSE 订阅 ==========

    function _subscribeSSE(state, container, size) {
        if (typeof Bus === 'undefined') return;

        // 新消息事件
        function onNewMessage(data) {
            // 如果当前正在查看该会话的聊天
            if (state.viewState === 'chat' && state.currentSession) {
                var msgSessionId = data.session_id || data.sessionId || '';
                if (msgSessionId === getSessionId(state.currentSession)) {
                    // 追加新消息
                    if (data.message) {
                        state.messages.push(data.message);
                        if (!state.userScrolledUp) {
                            _render(container, state, size);
                        }
                    }
                }
            }
            // 刷新列表数据
            fetchSessions().then(function (sessions) {
                state.sessions = sessions;
                if (state.viewState === 'list') {
                    _render(container, state, size);
                }
            }).catch(function () {});
        }

        // 会话创建事件
        function onSessionCreated() {
            fetchSessions().then(function (sessions) {
                state.sessions = sessions;
                _render(container, state, size);
            }).catch(function () {});
        }

        // 会话更新事件
        function onSessionUpdated(data) {
            // 如果正在查看该会话，更新标题等信息
            if (state.viewState === 'chat' && state.currentSession) {
                var updatedId = data.session_id || data.sessionId || data.id || '';
                if (updatedId === getSessionId(state.currentSession)) {
                    if (data.title) state.currentSession.title = data.title;
                    if (data.status) state.currentSession.status = data.status;
                }
            }
            fetchSessions().then(function (sessions) {
                state.sessions = sessions;
                if (state.viewState === 'list') {
                    _render(container, state, size);
                }
            }).catch(function () {});
        }

        Bus.on('sse:session.message', onNewMessage);
        Bus.on('sse:session.created', onSessionCreated);
        Bus.on('sse:session.updated', onSessionUpdated);

        // 保存引用以便清理
        state._sseHandlers = {
            'sse:session.message': onNewMessage,
            'sse:session.created': onSessionCreated,
            'sse:session.updated': onSessionUpdated
        };
    }

    // ========== 事件处理函数 ==========

    /**
     * 打开 Overlay（small 尺寸点击）
     */
    function _handleOpenOverlay() {
        if (typeof CardOverlay !== 'undefined') {
            CardOverlay.open('session-card');
        }
    }

    /**
     * 打开会话详情
     */
    function _handleOpenSession(target, state, size) {
        var sessionId = target.getAttribute('data-session-id');
        if (!sessionId) return;

        if (size === 'xlarge') {
            // xlarge 模式：卡片内导航到聊天视图
            _openChatView(state, sessionId);
        } else {
            // 其他尺寸：打开 Overlay
            if (typeof CardOverlay !== 'undefined') {
                CardOverlay.open('session-card', { sessionId: sessionId });
            }
        }
    }

    /**
     * 在 xlarge 模式下打开聊天视图
     */
    async function _openChatView(state, sessionId) {
        // 查找会话
        var session = null;
        for (var i = 0; i < state.sessions.length; i++) {
            if (getSessionId(state.sessions[i]) === sessionId) {
                session = state.sessions[i];
                break;
            }
        }
        if (!session) return;

        state.currentSession = session;
        state.messages = [];
        state.isTyping = false;
        state.viewState = 'chat';
        state.userScrolledUp = false;

        // 获取消息
        try {
            state.messages = await fetchMessages(sessionId);
        } catch (err) {
            console.error('[SessionCard] 获取消息失败:', err);
            state.messages = [];
        }

        // 重新渲染（由外部调用 _render）
        // 这里通过刷新回调来触发
        if (state._refreshFn) {
            state._refreshFn();
        }
    }

    /**
     * 返回列表视图
     */
    function _handleBackToList(state, container, size) {
        state.currentSession = null;
        state.messages = [];
        state.isTyping = false;
        state.viewState = 'list';
        _render(container, state, size);
    }

    /**
     * 设置过滤条件
     */
    function _handleSetFilter(target, state, container, size) {
        var filter = target.getAttribute('data-filter');
        if (!filter) return;
        state.filter = filter;
        _render(container, state, size);
    }

    /**
     * 搜索处理（带防抖）
     */
    function _handleSearch(target, state, container, size) {
        var term = target.value || '';

        // 清除之前的定时器
        if (state.searchTimer) {
            clearTimeout(state.searchTimer);
        }

        // 防抖
        state.searchTimer = setTimeout(function () {
            state.searchTerm = term;
            _render(container, state, size);

            // 如果有搜索词，调用搜索 API
            if (term.trim()) {
                searchSessions(term).then(function (results) {
                    if (Array.isArray(results)) {
                        state.sessions = results;
                        _render(container, state, size);
                    }
                }).catch(function () {});
            } else {
                // 清空搜索时恢复完整列表
                fetchSessions().then(function (sessions) {
                    state.sessions = sessions;
                    _render(container, state, size);
                }).catch(function () {});
            }
        }, DEBOUNCE_MS);
    }

    /**
     * 发送消息
     */
    function _handleSendMessage(state, container, size) {
        var input = container.querySelector('[data-action="chatInput"]');
        if (!input) return;

        var content = (input.value || '').trim();
        if (!content || !state.currentSession) return;

        var sessionId = getSessionId(state.currentSession);

        // 立即清空输入框并追加用户消息到界面
        input.value = '';

        var userMsg = {
            id: 'temp-' + Date.now(),
            role: 'user',
            content: content,
            timestamp: new Date().toISOString()
        };
        state.messages.push(userMsg);
        state.isTyping = true;
        state.userScrolledUp = false;
        _render(container, state, size);

        // 发送请求
        sendMessage(sessionId, content).then(function () {
            state.isTyping = false;
            // 重新获取消息列表以确保同步
            return fetchMessages(sessionId);
        }).then(function (msgs) {
            if (Array.isArray(msgs)) {
                state.messages = msgs;
            }
            _render(container, state, size);
        }).catch(function (err) {
            console.error('[SessionCard] 发送消息失败:', err);
            state.isTyping = false;
            _render(container, state, size);
            showToast('发送失败: ' + (err.message || '未知错误'), 'error');
        });
    }

    /**
     * 切换工具调用卡片展开/折叠
     */
    function _handleToggleTool(target) {
        var toolEl = target.closest('.sc-tool');
        if (!toolEl) return;

        var result = toolEl.querySelector('.sc-tool__result');
        var chevron = toolEl.querySelector('.sc-tool__chevron');
        if (!result) return;

        var isOpen = result.classList.contains('sc-tool__result--open');
        if (isOpen) {
            result.classList.remove('sc-tool__result--open');
            if (chevron) chevron.classList.remove('sc-tool__chevron--open');
        } else {
            result.classList.add('sc-tool__result--open');
            if (chevron) chevron.classList.add('sc-tool__chevron--open');
        }
    }

    /**
     * 重试加载
     */
    async function _handleRetry(container, state, size) {
        container.innerHTML = createLoading();
        try {
            state.sessions = await fetchSessions();
            _render(container, state, size);
            _bindEvents(container, state, size);
        } catch (err) {
            container.innerHTML =
                '<div class="sc-error">' +
                    '<div class="sc-error__icon">\u26A0\uFE0F</div>' +
                    '<div class="sc-error__text">加载失败，请重试</div>' +
                    '<button class="sc-error__retry" data-action="retry">重试</button>' +
                '</div>';
        }
    }

    // ========== 生命周期构建 ==========

    function _buildLifecycle(state, container, size) {
        // 保存刷新回调
        state._refreshFn = function () {
            _render(container, state, size);
        };

        return {
            /**
             * 销毁卡片，清理所有资源
             */
            destroy: function () {
                // 移除 DOM 事件
                for (var i = 0; i < state.handlers.length; i++) {
                    var h = state.handlers[i];
                    if (h.el) {
                        h.el.removeEventListener(h.type, h.fn, h.capture || false);
                    }
                }
                state.handlers = [];

                // 清除搜索定时器
                if (state.searchTimer) {
                    clearTimeout(state.searchTimer);
                    state.searchTimer = null;
                }

                // 移除 SSE 事件监听
                if (state._sseHandlers && typeof Bus !== 'undefined') {
                    var events = Object.keys(state._sseHandlers);
                    for (var j = 0; j < events.length; j++) {
                        Bus.off(events[j], state._sseHandlers[events[j]]);
                    }
                    state._sseHandlers = null;
                }

                // 清空容器
                container.innerHTML = '';

                // 重置状态
                state.sessions = [];
                state.currentSession = null;
                state.messages = [];
                state.isTyping = false;
                state.viewState = 'list';
                state._refreshFn = null;
            },

            /**
             * 刷新卡片数据
             */
            refresh: async function () {
                try {
                    state.sessions = await fetchSessions();
                    _render(container, state, size);

                    // 如果在聊天视图，也刷新消息
                    if (state.viewState === 'chat' && state.currentSession) {
                        var sid = getSessionId(state.currentSession);
                        state.messages = await fetchMessages(sid);
                        _render(container, state, size);
                    }
                } catch (err) {
                    console.error('[SessionCard] 刷新失败:', err);
                }
            }
        };
    }

    // ========== 入口卡片挂载函数 ==========

    async function mountEntry(container, props) {
        _injectStyles();

        var entryState = { sessions: [], handlers: [] };

        container.innerHTML = createLoading();

        try {
            entryState.sessions = await fetchSessions();
        } catch (err) {
            entryState.sessions = [];
        }

        renderSmall(container, entryState.sessions);

        function handleClick(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;
            if (target.getAttribute('data-action') === 'openOverlay') {
                if (typeof CardOverlay !== 'undefined') {
                    CardOverlay.open('session-card');
                }
            }
        }

        container.addEventListener('click', handleClick);
        entryState.handlers.push({ el: container, type: 'click', fn: handleClick });

        return {
            destroy: function () {
                for (var i = 0; i < entryState.handlers.length; i++) {
                    var h = entryState.handlers[i];
                    h.el.removeEventListener(h.type, h.fn);
                }
                entryState.handlers = [];
                container.innerHTML = '';
            },
            refresh: async function () {
                try {
                    entryState.sessions = await fetchSessions();
                    renderSmall(container, entryState.sessions);
                } catch (err) {
                    console.error('[SessionCard] 入口刷新失败:', err);
                }
            }
        };
    }

    // ========== 注册 Widget ==========

    if (typeof WidgetRegistry !== 'undefined') {
        WidgetRegistry.register('session-card', {
            type: 'data',
            label: '会话',
            icon: '\u{1F4AC}',
            description: '会话管理，支持查看会话列表和聊天记录',
            defaultSize: { w: 2, h: 1 },
            category: 'data',
            mount: mount
        });

        WidgetRegistry.register('session-entry', {
            type: 'entry',
            label: '会话入口',
            icon: '\u{1F4AC}',
            description: '会话快速入口',
            defaultSize: { w: 1, h: 1 },
            category: 'entries',
            mount: mountEntry
        });
    }

    // ========== 公开 API ==========
    return {
        mount: mount,
        mountEntry: mountEntry,
        renderSmall: renderSmall,
        renderMedium: renderMedium,
        renderLarge: renderLarge,
        renderXlargeList: renderXlargeList,
        renderXlargeChat: renderXlargeChat
    };
})();
