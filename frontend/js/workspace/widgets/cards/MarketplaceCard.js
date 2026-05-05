/**
 * MarketplaceCard.js - 功能商店卡片
 *
 * 支持 4 种尺寸: small(1x1) / medium(2x1) / large(2x2) / xlarge(全屏覆盖)
 * 管理 MCP 服务、技能、工具、插件四大类功能模块
 *
 * 依赖全局: WidgetRegistry, HermesClient, DataService, CardOverlay, Components, Bus
 */
var MarketplaceCard = (() => {
    'use strict';

    // ========== 常量 ==========
    var API_MCP_SERVERS = '/api/mcp/servers';
    var API_SKILLS = '/api/skills';
    var API_TOOLS = '/api/tools';
    var API_PLUGINS_MARKET = '/api/plugins/market';
    var API_PLUGINS_INSTALLED = '/api/plugins';
    var API_PLUGINS_INSTALL = '/api/plugins/install';
    var SEARCH_DEBOUNCE_MS = 300;
    var MAX_ITEMS_LARGE = 8;

    // 标签页定义
    var TABS = [
        { key: 'mcp', label: 'MCP服务', icon: '\u{1F517}' },
        { key: 'skills', label: '技能', icon: '\u{1F9E0}' },
        { key: 'tools', label: '工具', icon: '\u{1F6E0}\uFE0F' },
        { key: 'plugins', label: '插件', icon: '\u{1F4E6}' }
    ];

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (document.getElementById('mpc-styles')) return;
        var style = document.createElement('style');
        style.id = 'mpc-styles';
        style.textContent = [
            /* ===== 基础布局 ===== */
            '.mpc-root { display:flex; flex-direction:column; height:100%; overflow:hidden; }',
            '.mpc-header { display:flex; align-items:center; gap:8px; padding:12px 14px 8px; flex-shrink:0; }',
            '.mpc-header__icon { font-size:18px; flex-shrink:0; }',
            '.mpc-header__title { font-size:var(--text-sm, 13px); font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }',
            '.mpc-header__count { font-size:var(--text-xs, 11px); color:var(--text-tertiary); flex-shrink:0; }',
            '.mpc-body { flex:1; overflow-y:auto; overflow-x:hidden; padding:0 14px 12px; -webkit-overflow-scrolling:touch; }',
            '.mpc-body::-webkit-scrollbar { width:4px; }',
            '.mpc-body::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:2px; }',

            /* ===== Small 尺寸 ===== */
            '.mpc-small { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; cursor:pointer; padding:16px 8px; text-align:center; transition:opacity 0.15s; }',
            '.mpc-small:hover { opacity:0.85; }',
            '.mpc-small__emoji { font-size:32px; margin-bottom:6px; }',
            '.mpc-small__label { font-size:var(--text-sm, 13px); font-weight:600; color:var(--text-primary); }',
            '.mpc-small__count { font-size:var(--text-2xl, 20px); font-weight:700; color:var(--accent); margin-top:4px; }',
            '.mpc-small__unit { font-size:var(--text-xs, 11px); color:var(--text-tertiary); margin-top:2px; }',

            /* ===== Medium 统计行 ===== */
            '.mpc-stats { display:flex; gap:4px; padding:0 14px 12px; }',
            '.mpc-stat { flex:1; display:flex; flex-direction:column; align-items:center; padding:8px 4px; border-radius:var(--radius-sm, 6px); cursor:pointer; transition:background 0.15s; gap:2px; }',
            '.mpc-stat:hover { background:var(--bg-tertiary, rgba(0,0,0,0.04)); }',
            '.mpc-stat__icon { font-size:16px; }',
            '.mpc-stat__value { font-size:var(--text-sm, 13px); font-weight:700; color:var(--text-primary); }',
            '.mpc-stat__label { font-size:10px; color:var(--text-tertiary); }',

            /* ===== Large 标签按钮 ===== */
            '.mpc-tabs { display:flex; gap:4px; padding:0 14px 8px; flex-shrink:0; overflow-x:auto; -webkit-overflow-scrolling:touch; }',
            '.mpc-tabs::-webkit-scrollbar { display:none; }',
            '.mpc-tab { padding:4px 10px; border:1px solid var(--border); border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs, 11px); cursor:pointer; white-space:nowrap; transition:all 0.15s; }',
            '.mpc-tab:hover { border-color:var(--accent); color:var(--accent); }',
            '.mpc-tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }',

            /* ===== Large 列表项 ===== */
            '.mpc-list { display:flex; flex-direction:column; gap:4px; }',
            '.mpc-item { display:flex; align-items:center; gap:8px; padding:6px 8px; border-radius:var(--radius-sm, 6px); cursor:pointer; transition:background 0.15s; }',
            '.mpc-item:hover { background:var(--bg-tertiary, rgba(0,0,0,0.04)); }',
            '.mpc-item__name { font-size:var(--text-xs, 11px); color:var(--text-primary); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.mpc-item__badge { font-size:10px; padding:1px 6px; border-radius:var(--radius-xs, 4px); flex-shrink:0; }',
            '.mpc-item__badge--connected { background:rgba(34,197,94,0.1); color:#22c55e; }',
            '.mpc-item__badge--unknown { background:rgba(234,179,8,0.1); color:#eab308; }',
            '.mpc-item__badge--active { background:rgba(34,197,94,0.1); color:#22c55e; }',
            '.mpc-item__badge--disabled { background:rgba(156,163,175,0.1); color:#9ca3af; }',
            '.mpc-item__badge--installed { background:rgba(99,102,241,0.1); color:#6366f1; }',
            '.mpc-item__count { font-size:10px; color:var(--text-tertiary); flex-shrink:0; }',
            '.mpc-item__toggle { width:32px; height:18px; border-radius:9px; border:none; cursor:pointer; position:relative; transition:background 0.2s; flex-shrink:0; }',
            '.mpc-item__toggle.on { background:var(--accent); }',
            '.mpc-item__toggle.off { background:var(--border); }',
            '.mpc-item__toggle::after { content:""; position:absolute; top:2px; width:14px; height:14px; border-radius:50%; background:#fff; transition:left 0.2s; }',
            '.mpc-item__toggle.on::after { left:16px; }',
            '.mpc-item__toggle.off::after { left:2px; }',

            /* ===== Xlarge 全屏覆盖 ===== */
            '.mpc-xl { display:flex; flex-direction:column; height:100%; }',
            '.mpc-xl__header { display:flex; align-items:center; gap:10px; padding:16px 20px 12px; flex-shrink:0; border-bottom:1px solid var(--border); }',
            '.mpc-xl__title { font-size:var(--text-lg, 16px); font-weight:700; color:var(--text-primary); flex:1; }',
            '.mpc-xl__body { flex:1; overflow-y:auto; padding:16px 20px; -webkit-overflow-scrolling:touch; }',
            '.mpc-xl__body::-webkit-scrollbar { width:6px; }',
            '.mpc-xl__body::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }',

            /* ===== Xlarge 标签页 ===== */
            '.mpc-xl__tabs { display:flex; gap:6px; padding:12px 20px 0; flex-shrink:0; overflow-x:auto; -webkit-overflow-scrolling:touch; }',
            '.mpc-xl__tabs::-webkit-scrollbar { display:none; }',
            '.mpc-xl__tab { padding:6px 16px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:transparent; color:var(--text-secondary); font-size:var(--text-sm); cursor:pointer; white-space:nowrap; transition:all 0.15s; }',
            '.mpc-xl__tab:hover { border-color:var(--accent); color:var(--accent); }',
            '.mpc-xl__tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }',

            /* ===== Xlarge 统计行 ===== */
            '.mpc-xl__stats { display:flex; gap:16px; padding:12px 20px; flex-shrink:0; border-bottom:1px solid var(--border); }',
            '.mpc-xl__stat { display:flex; align-items:center; gap:6px; font-size:var(--text-sm); color:var(--text-secondary); }',
            '.mpc-xl__stat-value { font-weight:700; color:var(--text-primary); }',

            /* ===== Xlarge 搜索栏 ===== */
            '.mpc-xl__search { display:flex; align-items:center; gap:8px; padding:12px 20px; flex-shrink:0; }',
            '.mpc-xl__search-input { flex:1; max-width:320px; padding:7px 12px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:var(--bg-secondary); color:var(--text-primary); font-size:var(--text-sm); outline:none; transition:border-color 0.15s; }',
            '.mpc-xl__search-input:focus { border-color:var(--accent); }',
            '.mpc-xl__search-input::placeholder { color:var(--text-tertiary); }',
            '.mpc-xl__filter { padding:5px 12px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs); cursor:pointer; white-space:nowrap; transition:all 0.15s; }',
            '.mpc-xl__filter:hover { border-color:var(--accent); color:var(--accent); }',
            '.mpc-xl__filter.active { background:var(--accent); color:#fff; border-color:var(--accent); }',

            /* ===== Xlarge 操作栏 ===== */
            '.mpc-xl__actions { display:flex; gap:8px; padding:0 20px 12px; flex-shrink:0; }',
            '.mpc-xl__btn { padding:6px 14px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs); cursor:pointer; transition:all 0.15s; display:flex; align-items:center; gap:4px; }',
            '.mpc-xl__btn:hover { border-color:var(--accent); color:var(--accent); }',
            '.mpc-xl__btn--primary { background:var(--accent); color:#fff; border-color:var(--accent); }',
            '.mpc-xl__btn--primary:hover { opacity:0.85; }',
            '.mpc-xl__btn--danger:hover { border-color:var(--red, #ef4444); color:var(--red, #ef4444); }',

            /* ===== Xlarge 服务器列表 ===== */
            '.mpc-xl__list { display:flex; flex-direction:column; gap:8px; }',
            '.mpc-xl__card { padding:12px 14px; border:1px solid var(--border); border-radius:var(--radius-sm, 8px); transition:background 0.15s, box-shadow 0.15s; }',
            '.mpc-xl__card:hover { background:var(--bg-tertiary); box-shadow:var(--shadow, 0 1px 3px rgba(0,0,0,0.08)); }',
            '.mpc-xl__card-top { display:flex; align-items:center; gap:10px; margin-bottom:4px; }',
            '.mpc-xl__card-name { font-size:var(--text-sm); font-weight:600; color:var(--text-primary); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.mpc-xl__card-actions { display:flex; gap:4px; flex-shrink:0; }',
            '.mpc-xl__card-action { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-tertiary); cursor:pointer; font-size:14px; transition:all 0.15s; }',
            '.mpc-xl__card-action:hover { background:var(--bg-tertiary); color:var(--text-primary); }',
            '.mpc-xl__card-action.danger:hover { background:rgba(239,68,68,0.1); color:var(--red, #ef4444); }',
            '.mpc-xl__card-desc { font-size:var(--text-xs); color:var(--text-secondary); margin-bottom:6px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.5; }',
            '.mpc-xl__card-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }',
            '.mpc-xl__card-badge { font-size:10px; padding:2px 8px; border-radius:var(--radius-xs, 4px); background:rgba(99,102,241,0.1); color:#6366f1; }',
            '.mpc-xl__card-url { font-size:10px; color:var(--text-tertiary); font-family:var(--font-mono, monospace); }',
            '.mpc-xl__card-status { width:8px; height:8px; border-radius:50%; flex-shrink:0; }',
            '.mpc-xl__card-status.connected { background:#22c55e; }',
            '.mpc-xl__card-status.unknown { background:#eab308; }',

            /* ===== Xlarge 添加服务器表单 ===== */
            '.mpc-xl__form { padding:12px 14px; border:1px dashed var(--border); border-radius:var(--radius-sm, 8px); margin-top:12px; display:flex; flex-direction:column; gap:8px; }',
            '.mpc-xl__form-row { display:flex; gap:8px; align-items:center; }',
            '.mpc-xl__form-input { flex:1; padding:6px 10px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:var(--bg-secondary); color:var(--text-primary); font-size:var(--text-xs); outline:none; transition:border-color 0.15s; }',
            '.mpc-xl__form-input:focus { border-color:var(--accent); }',
            '.mpc-xl__form-input::placeholder { color:var(--text-tertiary); }',
            '.mpc-xl__form-label { font-size:var(--text-xs); color:var(--text-secondary); font-weight:500; white-space:nowrap; }',

            /* ===== Xlarge 插件子标签 ===== */
            '.mpc-xl__sub-tabs { display:flex; gap:4px; margin-bottom:12px; }',
            '.mpc-xl__sub-tab { padding:4px 12px; border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs); cursor:pointer; border:none; transition:all 0.15s; }',
            '.mpc-xl__sub-tab:hover { background:var(--bg-secondary); }',
            '.mpc-xl__sub-tab.active { background:var(--accent); color:#fff; }',

            /* ===== Xlarge 工具网格 ===== */
            '.mpc-xl__grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(240px, 1fr)); gap:8px; }',
            '.mpc-xl__grid-card { padding:10px 12px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); display:flex; flex-direction:column; gap:4px; transition:background 0.15s; }',
            '.mpc-xl__grid-card:hover { background:var(--bg-tertiary); }',
            '.mpc-xl__grid-card-top { display:flex; align-items:center; justify-content:space-between; gap:8px; }',
            '.mpc-xl__grid-card-name { font-size:var(--text-xs); font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.mpc-xl__grid-card-desc { font-size:10px; color:var(--text-tertiary); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.4; }',
            '.mpc-xl__grid-card-toolset { font-size:10px; color:var(--text-tertiary); }',

            /* ===== 状态提示 ===== */
            '.mpc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--text-tertiary); text-align:center; }',
            '.mpc-empty__icon { font-size:40px; margin-bottom:10px; opacity:0.5; }',
            '.mpc-empty__text { font-size:var(--text-sm); }',
            '.mpc-error { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px 20px; text-align:center; gap:10px; }',
            '.mpc-error__icon { font-size:32px; }',
            '.mpc-error__text { font-size:var(--text-sm); color:var(--red, #ef4444); }',
            '.mpc-loading { display:flex; align-items:center; justify-content:center; padding:30px; }',
            '.mpc-loading__spinner { width:24px; height:24px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:mpc-spin 0.6s linear infinite; }',
            '@keyframes mpc-spin { to { transform:rotate(360deg); } }',

            /* ===== 骨架屏 ===== */
            '.mpc-skeleton { display:flex; flex-direction:column; gap:8px; padding:12px 14px; }',
            '.mpc-skeleton__line { height:12px; border-radius:4px; background:linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%); background-size:200% 100%; animation:mpc-shimmer 1.5s infinite; }',
            '.mpc-skeleton__line.short { width:60%; }',
            '@keyframes mpc-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }'
        ].join('\n');
        document.head.appendChild(style);
    }

    // ========== 工具函数 ==========

    /** HTML 转义 */
    function _esc(str) {
        if (!str) return '';
        if (typeof Components !== 'undefined' && Components.escapeHtml) {
            return Components.escapeHtml(str);
        }
        return String(str).replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /** 截断文本 */
    function _truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '...' : str;
    }

    /** 显示 Toast */
    function _toast(msg, type) {
        if (typeof Components !== 'undefined' && Components.showToast) {
            Components.showToast(msg, type);
        } else {
            console.log('[MarketplaceCard] ' + (type || 'info') + ': ' + msg);
        }
    }

    /** 骨架屏 */
    function _skeletonHtml(lines) {
        var html = '<div class="mpc-skeleton">';
        for (var i = 0; i < (lines || 4); i++) {
            var cls = i === lines - 1 ? ' mpc-skeleton__line short' : '';
            html += '<div class="mpc-skeleton__line' + cls + '"></div>';
        }
        html += '</div>';
        return html;
    }

    /** 加载中 */
    function _loadingHtml() {
        return '<div class="mpc-loading"><div class="mpc-loading__spinner"></div></div>';
    }

    /** 空状态 */
    function _emptyHtml(text) {
        return '<div class="mpc-empty"><div class="mpc-empty__icon">\u{1F6D2}</div><div class="mpc-empty__text">' + (text || '暂无数据') + '</div></div>';
    }

    /** 错误状态 */
    function _errorHtml(msg) {
        return '<div class="mpc-error"><div class="mpc-error__icon">\u26A0\uFE0F</div><div class="mpc-error__text">' + _esc(msg || '加载失败') + '</div><button class="btn btn-sm btn-ghost" data-action="retry">重试</button></div>';
    }

    /** 判断尺寸 */
    function _getSize(props) {
        var config = props.config || {};
        var w = config.w || 2;
        var h = config.h || 1;
        if (w <= 1 && h <= 1) return 'small';
        if (w <= 2 && h <= 1) return 'medium';
        if (w <= 2 && h <= 2) return 'large';
        return 'xlarge';
    }

    /** 搜索过滤 */
    function _filterByKeyword(items, keyword, fields) {
        if (!Array.isArray(items)) return [];
        if (!keyword || !keyword.trim()) return items;
        var kw = keyword.toLowerCase().trim();
        return items.filter(function(item) {
            for (var i = 0; i < fields.length; i++) {
                var val = item[fields[i]];
                if (val && String(val).toLowerCase().indexOf(kw) !== -1) return true;
            }
            return false;
        });
    }

    // ========== 数据获取 ==========

    function _fetchMcpServers() {
        return HermesClient.get(API_MCP_SERVERS).catch(function() { return []; });
    }

    function _fetchSkills() {
        return HermesClient.get(API_SKILLS).catch(function() { return []; });
    }

    function _fetchTools() {
        return HermesClient.get(API_TOOLS).catch(function() { return []; });
    }

    function _fetchPluginsMarket() {
        return HermesClient.get(API_PLUGINS_MARKET).catch(function() { return []; });
    }

    function _fetchPluginsInstalled() {
        return HermesClient.get(API_PLUGINS_INSTALLED).catch(function() { return []; });
    }

    function _addMcpServer(data) {
        return HermesClient.post(API_MCP_SERVERS, data);
    }

    function _removeMcpServer(name) {
        return HermesClient.del(API_MCP_SERVERS + '/' + encodeURIComponent(name));
    }

    function _refreshMcpServer(name) {
        return HermesClient.post(API_MCP_SERVERS + '/' + encodeURIComponent(name) + '/refresh');
    }

    function _restartMcp() {
        return HermesClient.post('/api/mcp/restart');
    }

    function _deleteSkill(name) {
        return HermesClient.del(API_SKILLS + '/' + encodeURIComponent(name));
    }

    function _toggleTool(name, enabled) {
        return HermesClient.post(API_TOOLS + '/' + encodeURIComponent(name) + '/toggle', { enabled: enabled });
    }

    function _installPlugin(name) {
        return HermesClient.post(API_PLUGINS_INSTALL, { name: name });
    }

    function _uninstallPlugin(name) {
        return HermesClient.del(API_PLUGINS + '/' + encodeURIComponent(name));
    }

    // ========== 主挂载函数 ==========

    async function mount(container, props) {
        var size = _getSize(props);

        // 注入样式
        _injectStyles();

        // 内部状态
        var mcpServers = [];
        var skills = [];
        var tools = [];
        var pluginsMarket = [];
        var pluginsInstalled = [];
        var loading = true;
        var error = null;
        var activeTab = 'mcp';
        var searchKeyword = '';
        var pluginSubTab = 'market'; // 'market' | 'installed'
        var toolsetFilter = '';
        var typeFilter = '';
        var debounceTimer = null;
        var showAddServerForm = false;

        // 事件处理函数引用
        var _clickHandler = null;
        var _inputHandler = null;
        var _sseHandlers = [];

        // ---------- 数据加载 ----------
        async function loadData() {
            loading = true;
            error = null;
            _render();

            try {
                var results = await Promise.all([
                    _fetchMcpServers(),
                    _fetchSkills(),
                    _fetchTools(),
                    _fetchPluginsMarket(),
                    _fetchPluginsInstalled()
                ]);
                mcpServers = Array.isArray(results[0]) ? results[0] : [];
                skills = Array.isArray(results[1]) ? results[1] : [];
                tools = Array.isArray(results[2]) ? results[2] : [];
                pluginsMarket = Array.isArray(results[3]) ? results[3] : [];
                pluginsInstalled = Array.isArray(results[4]) ? results[4] : [];
                loading = false;
                error = null;
                _render();
            } catch (e) {
                loading = false;
                error = e.message || '加载失败';
                _render();
            }
        }

        // ---------- 刷新（SSE 触发） ----------
        async function refresh() {
            try {
                var results = await Promise.all([
                    _fetchMcpServers(),
                    _fetchSkills(),
                    _fetchTools(),
                    _fetchPluginsMarket(),
                    _fetchPluginsInstalled()
                ]);
                mcpServers = Array.isArray(results[0]) ? results[0] : [];
                skills = Array.isArray(results[1]) ? results[1] : [];
                tools = Array.isArray(results[2]) ? results[2] : [];
                pluginsMarket = Array.isArray(results[3]) ? results[3] : [];
                pluginsInstalled = Array.isArray(results[4]) ? results[4] : [];
                loading = false;
                error = null;
                _render();
            } catch (e) {
                error = e.message || '刷新失败';
                _render();
            }
        }

        // ---------- 计算总数 ----------
        function _totalCount() {
            return mcpServers.length + skills.length + tools.length + pluginsInstalled.length;
        }

        // ---------- 提取唯一 toolset ----------
        function _getToolsets() {
            var set = {};
            var result = [];
            for (var i = 0; i < tools.length; i++) {
                var ts = tools[i].toolset || 'default';
                if (!set[ts]) {
                    set[ts] = true;
                    result.push(ts);
                }
            }
            return result;
        }

        // ---------- 提取唯一插件类型 ----------
        function _getPluginTypes() {
            var set = {};
            var result = [];
            var all = pluginSubTab === 'market' ? pluginsMarket : pluginsInstalled;
            for (var i = 0; i < all.length; i++) {
                var t = all[i].type || 'other';
                if (!set[t]) {
                    set[t] = true;
                    result.push(t);
                }
            }
            return result;
        }

        // ---------- 渲染分发 ----------
        function _render() {
            switch (size) {
                case 'small':  _renderSmall(); break;
                case 'medium': _renderMedium(); break;
                case 'large':  _renderLarge(); break;
                case 'xlarge': _renderXlarge(); break;
            }
        }

        // ========== Small 渲染 ==========
        function _renderSmall() {
            var count = _totalCount();
            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="mpc-small" data-action="open-overlay">' +
                        '<div class="mpc-small__emoji">\u{1F6D2}</div>' +
                        '<div class="mpc-small__label">功能商店</div>' +
                        (loading
                            ? '<div class="mpc-loading" style="padding:8px 0;"><div class="mpc-loading__spinner" style="width:18px;height:18px;border-width:2px;"></div></div>'
                            : '<div class="mpc-small__count">' + count + '</div>' +
                              '<div class="mpc-small__unit">项功能</div>') +
                    '</div>' +
                '</div>';
        }

        // ========== Medium 渲染 ==========
        function _renderMedium() {
            if (loading) {
                container.innerHTML = '<div class="ws-widget"><div class="mpc-header"><span class="mpc-header__icon">\u{1F6D2}</span><span class="mpc-header__title">功能商店</span></div>' + _skeletonHtml(4) + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="ws-widget"><div class="mpc-header"><span class="mpc-header__icon">\u{1F6D2}</span><span class="mpc-header__title">功能商店</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="mpc-header">' +
                        '<span class="mpc-header__icon">\u{1F6D2}</span>' +
                        '<span class="mpc-header__title">功能商店</span>' +
                        '<span class="mpc-header__count">' + _totalCount() + '项</span>' +
                    '</div>' +
                    '<div class="mpc-stats">' +
                        _renderStatItem('mcp', '\u{1F517}', mcpServers.length, 'MCP服务') +
                        _renderStatItem('skills', '\u{1F9E0}', skills.length, '技能') +
                        _renderStatItem('tools', '\u{1F6E0}\uFE0F', tools.length, '工具') +
                        _renderStatItem('plugins', '\u{1F4E6}', pluginsInstalled.length, '插件') +
                    '</div>' +
                '</div>';
        }

        function _renderStatItem(tab, icon, value, label) {
            return '<div class="mpc-stat" data-action="open-overlay-tab" data-tab="' + tab + '">' +
                '<span class="mpc-stat__icon">' + icon + '</span>' +
                '<span class="mpc-stat__value">' + value + '</span>' +
                '<span class="mpc-stat__label">' + label + '</span>' +
            '</div>';
        }

        // ========== Large 渲染 ==========
        function _renderLarge() {
            if (loading) {
                container.innerHTML = '<div class="ws-widget"><div class="mpc-header"><span class="mpc-header__icon">\u{1F6D2}</span><span class="mpc-header__title">功能商店</span></div>' + _skeletonHtml(6) + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="ws-widget"><div class="mpc-header"><span class="mpc-header__icon">\u{1F6D2}</span><span class="mpc-header__title">功能商店</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            // 标签按钮
            var tabsHtml = '<div class="mpc-tabs">';
            for (var i = 0; i < TABS.length; i++) {
                var t = TABS[i];
                tabsHtml += '<button class="mpc-tab' + (activeTab === t.key ? ' active' : '') + '" data-action="switch-tab" data-tab="' + t.key + '">' + t.icon + ' ' + t.label + '</button>';
            }
            tabsHtml += '</div>';

            // 列表内容
            var listHtml = '';
            switch (activeTab) {
                case 'mcp':
                    listHtml = _renderLargeMcpList();
                    break;
                case 'skills':
                    listHtml = _renderLargeSkillsList();
                    break;
                case 'tools':
                    listHtml = _renderLargeToolsList();
                    break;
                case 'plugins':
                    listHtml = _renderLargePluginsList();
                    break;
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="mpc-header">' +
                        '<span class="mpc-header__icon">\u{1F6D2}</span>' +
                        '<span class="mpc-header__title">功能商店</span>' +
                        '<span class="mpc-header__count">' + _totalCount() + '项</span>' +
                    '</div>' +
                    tabsHtml +
                    '<div class="mpc-body">' + listHtml + '</div>' +
                '</div>';
        }

        function _renderLargeMcpList() {
            if (mcpServers.length === 0) return _emptyHtml('暂无 MCP 服务');
            var html = '<div class="mpc-list">';
            for (var i = 0; i < Math.min(mcpServers.length, MAX_ITEMS_LARGE); i++) {
                var s = mcpServers[i];
                var statusCls = s.status === 'connected' ? 'mpc-item__badge--connected' : 'mpc-item__badge--unknown';
                html += '<div class="mpc-item" data-action="open-item" data-tab="mcp" data-item-id="' + _esc(s.name) + '">' +
                    '<span class="mpc-xl__card-status ' + (s.status || 'unknown') + '"></span>' +
                    '<span class="mpc-item__name">' + _esc(s.name) + '</span>' +
                    '<span class="mpc-item__badge ' + statusCls + '">' + _esc(s.status || 'unknown') + '</span>' +
                    '<span class="mpc-item__count">' + (s.tools_count || 0) + ' 工具</span>' +
                '</div>';
            }
            html += '</div>';
            return html;
        }

        function _renderLargeSkillsList() {
            if (skills.length === 0) return _emptyHtml('暂无技能');
            var html = '<div class="mpc-list">';
            for (var i = 0; i < Math.min(skills.length, MAX_ITEMS_LARGE); i++) {
                var s = skills[i];
                var statusCls = s.status === 'active' ? 'mpc-item__badge--active' : 'mpc-item__badge--disabled';
                html += '<div class="mpc-item" data-action="open-item" data-tab="skills" data-item-id="' + _esc(s.name) + '">' +
                    '<span class="mpc-item__name">' + _esc(s.name) + '</span>' +
                    '<span class="mpc-item__badge ' + statusCls + '">' + _esc(s.status || 'disabled') + '</span>' +
                '</div>';
            }
            html += '</div>';
            return html;
        }

        function _renderLargeToolsList() {
            if (tools.length === 0) return _emptyHtml('暂无工具');
            var html = '<div class="mpc-list">';
            for (var i = 0; i < Math.min(tools.length, MAX_ITEMS_LARGE); i++) {
                var t = tools[i];
                var toggleCls = t.enabled ? 'on' : 'off';
                html += '<div class="mpc-item">' +
                    '<span class="mpc-item__name">' + _esc(t.name) + '</span>' +
                    '<button class="mpc-item__toggle ' + toggleCls + '" data-action="toggle-tool" data-tool-name="' + _esc(t.name) + '"></button>' +
                '</div>';
            }
            html += '</div>';
            return html;
        }

        function _renderLargePluginsList() {
            if (pluginsInstalled.length === 0) return _emptyHtml('暂无已安装插件');
            var html = '<div class="mpc-list">';
            for (var i = 0; i < Math.min(pluginsInstalled.length, MAX_ITEMS_LARGE); i++) {
                var p = pluginsInstalled[i];
                html += '<div class="mpc-item" data-action="open-item" data-tab="plugins" data-item-id="' + _esc(p.name) + '">' +
                    '<span class="mpc-item__name">' + _esc(p.name) + '</span>' +
                    '<span class="mpc-item__badge mpc-item__badge--installed">已安装</span>' +
                '</div>';
            }
            html += '</div>';
            return html;
        }

        // ========== Xlarge 渲染 ==========
        function _renderXlarge() {
            if (loading) {
                container.innerHTML = '<div class="mpc-xl"><div class="mpc-xl__header"><span class="mpc-xl__title">功能商店</span></div>' + _loadingHtml() + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="mpc-xl"><div class="mpc-xl__header"><span class="mpc-xl__title">功能商店</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            // 标签页
            var tabsHtml = '<div class="mpc-xl__tabs">';
            for (var i = 0; i < TABS.length; i++) {
                var t = TABS[i];
                tabsHtml += '<button class="mpc-xl__tab' + (activeTab === t.key ? ' active' : '') + '" data-action="switch-tab" data-tab="' + t.key + '">' + t.icon + ' ' + t.label + '</button>';
            }
            tabsHtml += '</div>';

            // 内容区
            var contentHtml = '';
            switch (activeTab) {
                case 'mcp':     contentHtml = _renderXlMcp(); break;
                case 'skills':  contentHtml = _renderXlSkills(); break;
                case 'tools':   contentHtml = _renderXlTools(); break;
                case 'plugins': contentHtml = _renderXlPlugins(); break;
            }

            container.innerHTML =
                '<div class="mpc-xl">' +
                    '<div class="mpc-xl__header">' +
                        '<span style="font-size:20px;">\u{1F6D2}</span>' +
                        '<span class="mpc-xl__title">功能商店</span>' +
                    '</div>' +
                    tabsHtml +
                    contentHtml +
                '</div>';
        }

        // ----- Xlarge: MCP Tab -----
        function _renderXlMcp() {
            var connected = 0;
            for (var i = 0; i < mcpServers.length; i++) {
                if (mcpServers[i].status === 'connected') connected++;
            }

            // 统计行
            var statsHtml = '<div class="mpc-xl__stats">' +
                '<div class="mpc-xl__stat"><span class="mpc-xl__stat-value">' + connected + '</span> 已连接</div>' +
                '<div class="mpc-xl__stat"><span class="mpc-xl__stat-value">' + mcpServers.length + '</span> 总计</div>' +
            '</div>';

            // 搜索栏 + 操作按钮
            var actionsHtml = '<div class="mpc-xl__search">' +
                '<input class="mpc-xl__search-input" type="text" placeholder="搜索 MCP 服务..." value="' + _esc(searchKeyword) + '" data-role="search-input" />' +
                '<button class="mpc-xl__btn mpc-xl__btn--primary" data-action="toggle-add-server">\u2795 添加服务</button>' +
                '<button class="mpc-xl__btn" data-action="restart-mcp">\u{1F504} 重启 MCP</button>' +
            '</div>';

            // 服务器列表
            var filtered = _filterByKeyword(mcpServers, searchKeyword, ['name', 'url', 'prefix']);
            var listHtml = '';
            if (filtered.length === 0) {
                listHtml = _emptyHtml(searchKeyword ? '未找到匹配的 MCP 服务' : '暂无 MCP 服务，点击上方添加');
            } else {
                listHtml = '<div class="mpc-xl__list">';
                for (var i = 0; i < filtered.length; i++) {
                    var s = filtered[i];
                    listHtml += '<div class="mpc-xl__card">' +
                        '<div class="mpc-xl__card-top">' +
                            '<span class="mpc-xl__card-status ' + (s.status || 'unknown') + '"></span>' +
                            '<span class="mpc-xl__card-name">' + _esc(s.name) + '</span>' +
                            '<span class="mpc-xl__card-badge">' + (s.tools_count || 0) + ' 工具</span>' +
                            '<div class="mpc-xl__card-actions">' +
                                '<button class="mpc-xl__card-action" data-action="refresh-server" data-name="' + _esc(s.name) + '" title="刷新">\u{1F504}</button>' +
                                '<button class="mpc-xl__card-action danger" data-action="remove-server" data-name="' + _esc(s.name) + '" title="移除">\u{1F5D1}\uFE0F</button>' +
                            '</div>' +
                        '</div>' +
                        (s.url ? '<div class="mpc-xl__card-url">' + _esc(s.url) + '</div>' : '') +
                        (s.prefix ? '<div class="mpc-xl__card-meta"><span class="mpc-xl__card-badge">前缀: ' + _esc(s.prefix) + '</span></div>' : '') +
                    '</div>';
                }
                listHtml += '</div>';
            }

            // 添加服务器表单
            var formHtml = '';
            if (showAddServerForm) {
                formHtml = '<div class="mpc-xl__form">' +
                    '<div style="font-size:var(--text-xs); font-weight:600; color:var(--text-secondary);">添加 MCP 服务</div>' +
                    '<div class="mpc-xl__form-row"><span class="mpc-xl__form-label">名称</span><input class="mpc-xl__form-input" type="text" placeholder="服务名称" data-field="server-name" /></div>' +
                    '<div class="mpc-xl__form-row"><span class="mpc-xl__form-label">URL</span><input class="mpc-xl__form-input" type="text" placeholder="http://localhost:8080" data-field="server-url" /></div>' +
                    '<div class="mpc-xl__form-row"><span class="mpc-xl__form-label">前缀</span><input class="mpc-xl__form-input" type="text" placeholder="可选前缀" data-field="server-prefix" /></div>' +
                    '<div class="mpc-xl__form-row" style="justify-content:flex-end;">' +
                        '<button class="mpc-xl__btn" data-action="toggle-add-server">取消</button>' +
                        '<button class="mpc-xl__btn mpc-xl__btn--primary" data-action="add-server">添加</button>' +
                    '</div>' +
                '</div>';
            }

            return statsHtml + actionsHtml + '<div class="mpc-xl__body">' + listHtml + formHtml + '</div>';
        }

        // ----- Xlarge: Skills Tab -----
        function _renderXlSkills() {
            var active = 0;
            for (var i = 0; i < skills.length; i++) {
                if (skills[i].status === 'active') active++;
            }

            // 统计行
            var statsHtml = '<div class="mpc-xl__stats">' +
                '<div class="mpc-xl__stat"><span class="mpc-xl__stat-value">' + skills.length + '</span> 总计</div>' +
                '<div class="mpc-xl__stat"><span class="mpc-xl__stat-value">' + active + '</span> 已激活</div>' +
            '</div>';

            // 搜索栏
            var searchHtml = '<div class="mpc-xl__search">' +
                '<input class="mpc-xl__search-input" type="text" placeholder="搜索技能..." value="' + _esc(searchKeyword) + '" data-role="search-input" />' +
            '</div>';

            // 列表
            var filtered = _filterByKeyword(skills, searchKeyword, ['name', 'description', 'category', 'tags']);
            var listHtml = '';
            if (filtered.length === 0) {
                listHtml = _emptyHtml(searchKeyword ? '未找到匹配的技能' : '暂无技能');
            } else {
                listHtml = '<div class="mpc-xl__list">';
                for (var i = 0; i < filtered.length; i++) {
                    var s = filtered[i];
                    var statusCls = s.status === 'active' ? 'mpc-item__badge--active' : 'mpc-item__badge--disabled';
                    var tags = Array.isArray(s.tags) ? s.tags : [];
                    var tagsHtml = '';
                    for (var j = 0; j < Math.min(tags.length, 3); j++) {
                        tagsHtml += '<span class="mpc-xl__card-badge">' + _esc(tags[j]) + '</span>';
                    }
                    listHtml += '<div class="mpc-xl__card">' +
                        '<div class="mpc-xl__card-top">' +
                            '<span class="mpc-xl__card-name">' + _esc(s.name) + '</span>' +
                            '<span class="mpc-item__badge ' + statusCls + '">' + _esc(s.status || 'disabled') + '</span>' +
                            '<div class="mpc-xl__card-actions">' +
                                '<button class="mpc-xl__card-action danger" data-action="delete-skill" data-name="' + _esc(s.name) + '" title="删除">\u{1F5D1}\uFE0F</button>' +
                            '</div>' +
                        '</div>' +
                        (s.description ? '<div class="mpc-xl__card-desc">' + _esc(s.description) + '</div>' : '') +
                        '<div class="mpc-xl__card-meta">' +
                            (s.category ? '<span class="mpc-xl__card-badge">' + _esc(s.category) + '</span>' : '') +
                            tagsHtml +
                        '</div>' +
                    '</div>';
                }
                listHtml += '</div>';
            }

            return statsHtml + searchHtml + '<div class="mpc-xl__body">' + listHtml + '</div>';
        }

        // ----- Xlarge: Tools Tab -----
        function _renderXlTools() {
            var enabled = 0;
            for (var i = 0; i < tools.length; i++) {
                if (tools[i].enabled) enabled++;
            }

            // 统计行
            var statsHtml = '<div class="mpc-xl__stats">' +
                '<div class="mpc-xl__stat"><span class="mpc-xl__stat-value">' + tools.length + '</span> 总计</div>' +
                '<div class="mpc-xl__stat"><span class="mpc-xl__stat-value">' + enabled + '</span> 已启用</div>' +
            '</div>';

            // 搜索 + toolset 过滤
            var toolsets = _getToolsets();
            var filtersHtml = '<div class="mpc-xl__search">' +
                '<input class="mpc-xl__search-input" type="text" placeholder="搜索工具..." value="' + _esc(searchKeyword) + '" data-role="search-input" />' +
                (toolsets.length > 1
                    ? toolsets.map(function(ts) {
                        return '<button class="mpc-xl__filter' + (toolsetFilter === ts ? ' active' : '') + '" data-action="filter-toolset" data-toolset="' + _esc(ts) + '">' + _esc(ts) + '</button>';
                    }).join('')
                    : '') +
            '</div>';

            // 过滤工具
            var filtered = _filterByKeyword(tools, searchKeyword, ['name', 'description']);
            if (toolsetFilter) {
                filtered = filtered.filter(function(t) { return (t.toolset || 'default') === toolsetFilter; });
            }

            // 网格
            var gridHtml = '';
            if (filtered.length === 0) {
                gridHtml = _emptyHtml(searchKeyword || toolsetFilter ? '未找到匹配的工具' : '暂无工具');
            } else {
                gridHtml = '<div class="mpc-xl__grid">';
                for (var i = 0; i < filtered.length; i++) {
                    var t = filtered[i];
                    var toggleCls = t.enabled ? 'on' : 'off';
                    gridHtml += '<div class="mpc-xl__grid-card">' +
                        '<div class="mpc-xl__grid-card-top">' +
                            '<span class="mpc-xl__grid-card-name">' + _esc(t.name) + '</span>' +
                            '<button class="mpc-item__toggle ' + toggleCls + '" data-action="toggle-tool" data-tool-name="' + _esc(t.name) + '"></button>' +
                        '</div>' +
                        (t.description ? '<div class="mpc-xl__grid-card-desc">' + _esc(_truncate(t.description, 60)) + '</div>' : '') +
                        (t.toolset ? '<div class="mpc-xl__grid-card-toolset">' + _esc(t.toolset) + '</div>' : '') +
                    '</div>';
                }
                gridHtml += '</div>';
            }

            return statsHtml + filtersHtml + '<div class="mpc-xl__body">' + gridHtml + '</div>';
        }

        // ----- Xlarge: Plugins Tab -----
        function _renderXlPlugins() {
            // 子标签
            var subTabsHtml = '<div class="mpc-xl__search">' +
                '<div class="mpc-xl__sub-tabs">' +
                    '<button class="mpc-xl__sub-tab' + (pluginSubTab === 'market' ? ' active' : '') + '" data-action="switch-plugin-sub" data-sub="market">市场</button>' +
                    '<button class="mpc-xl__sub-tab' + (pluginSubTab === 'installed' ? ' active' : '') + '" data-action="switch-plugin-sub" data-sub="installed">已安装</button>' +
                '</div>' +
                '<input class="mpc-xl__search-input" type="text" placeholder="搜索插件..." value="' + _esc(searchKeyword) + '" data-role="search-input" />' +
            '</div>';

            // 类型过滤
            var types = _getPluginTypes();
            var typeFilterHtml = '';
            if (types.length > 1) {
                typeFilterHtml = '<div class="mpc-xl__search" style="padding-top:0;">' +
                    types.map(function(tp) {
                        return '<button class="mpc-xl__filter' + (typeFilter === tp ? ' active' : '') + '" data-action="filter-plugin-type" data-type="' + _esc(tp) + '">' + _esc(tp) + '</button>';
                    }).join('') +
                '</div>';
            }

            // 数据源
            var source = pluginSubTab === 'market' ? pluginsMarket : pluginsInstalled;
            var filtered = _filterByKeyword(source, searchKeyword, ['name', 'description', 'author', 'category', 'tags']);
            if (typeFilter) {
                filtered = filtered.filter(function(p) { return (p.type || 'other') === typeFilter; });
            }

            // 列表
            var listHtml = '';
            if (filtered.length === 0) {
                listHtml = _emptyHtml(searchKeyword ? '未找到匹配的插件' : (pluginSubTab === 'market' ? '插件市场为空' : '暂无已安装插件'));
            } else {
                listHtml = '<div class="mpc-xl__list">';
                for (var i = 0; i < filtered.length; i++) {
                    var p = filtered[i];
                    var isInstalled = p.installed || pluginSubTab === 'installed';
                    var btnHtml = '';
                    if (isInstalled) {
                        btnHtml = '<button class="mpc-xl__btn mpc-xl__btn--danger" data-action="uninstall-plugin" data-name="' + _esc(p.name) + '">卸载</button>';
                    } else {
                        btnHtml = '<button class="mpc-xl__btn mpc-xl__btn--primary" data-action="install-plugin" data-name="' + _esc(p.name) + '">安装</button>';
                    }

                    var tags = Array.isArray(p.tags) ? p.tags : [];
                    var tagsHtml = '';
                    for (var j = 0; j < Math.min(tags.length, 3); j++) {
                        tagsHtml += '<span class="mpc-xl__card-badge">' + _esc(tags[j]) + '</span>';
                    }

                    listHtml += '<div class="mpc-xl__card">' +
                        '<div class="mpc-xl__card-top">' +
                            '<span class="mpc-xl__card-name">' + _esc(p.name) + '</span>' +
                            (p.version ? '<span class="mpc-xl__card-badge">v' + _esc(p.version) + '</span>' : '') +
                            (p.rating ? '<span class="mpc-xl__card-badge">\u2B50 ' + _esc(String(p.rating)) + '</span>' : '') +
                            btnHtml +
                        '</div>' +
                        (p.description ? '<div class="mpc-xl__card-desc">' + _esc(p.description) + '</div>' : '') +
                        '<div class="mpc-xl__card-meta">' +
                            (p.author ? '<span style="font-size:10px;color:var(--text-tertiary);">' + _esc(p.author) + '</span>' : '') +
                            (p.downloads ? '<span style="font-size:10px;color:var(--text-tertiary);">\u{1F4E5} ' + _esc(String(p.downloads)) + '</span>' : '') +
                            (p.category ? '<span class="mpc-xl__card-badge">' + _esc(p.category) + '</span>' : '') +
                            tagsHtml +
                        '</div>' +
                    '</div>';
                }
                listHtml += '</div>';
            }

            return subTabsHtml + typeFilterHtml + '<div class="mpc-xl__body">' + listHtml + '</div>';
        }

        // ========== 事件处理 ==========

        function _handleClick(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;

            var action = target.getAttribute('data-action');

            switch (action) {
                // ----- 通用: 打开覆盖层 -----
                case 'open-overlay':
                    e.preventDefault();
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.open('marketplace-card');
                    }
                    break;

                // ----- Medium: 打开覆盖层并跳转标签 -----
                case 'open-overlay-tab':
                    e.preventDefault();
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.open('marketplace-card', { tab: target.getAttribute('data-tab') });
                    }
                    break;

                // ----- Large/Xlarge: 切换标签 -----
                case 'switch-tab':
                    e.preventDefault();
                    activeTab = target.getAttribute('data-tab') || 'mcp';
                    searchKeyword = '';
                    toolsetFilter = '';
                    typeFilter = '';
                    _render();
                    break;

                // ----- Large: 打开项目详情 -----
                case 'open-item':
                    e.preventDefault();
                    var tab = target.getAttribute('data-tab');
                    var itemId = target.getAttribute('data-item-id');
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.open('marketplace-card', { tab: tab, itemId: itemId });
                    }
                    break;

                // ----- Xlarge MCP: 刷新服务器 -----
                case 'refresh-server':
                    e.preventDefault();
                    e.stopPropagation();
                    _doRefreshServer(target.getAttribute('data-name'));
                    break;

                // ----- Xlarge MCP: 移除服务器 -----
                case 'remove-server':
                    e.preventDefault();
                    e.stopPropagation();
                    _doRemoveServer(target.getAttribute('data-name'));
                    break;

                // ----- Xlarge MCP: 切换添加表单 -----
                case 'toggle-add-server':
                    e.preventDefault();
                    showAddServerForm = !showAddServerForm;
                    _render();
                    break;

                // ----- Xlarge MCP: 添加服务器 -----
                case 'add-server':
                    e.preventDefault();
                    _doAddServer();
                    break;

                // ----- Xlarge MCP: 重启 MCP -----
                case 'restart-mcp':
                    e.preventDefault();
                    _doRestartMcp();
                    break;

                // ----- Xlarge Skills: 删除技能 -----
                case 'delete-skill':
                    e.preventDefault();
                    e.stopPropagation();
                    _doDeleteSkill(target.getAttribute('data-name'));
                    break;

                // ----- Large/Xlarge Tools: 切换工具 -----
                case 'toggle-tool':
                    e.preventDefault();
                    e.stopPropagation();
                    _doToggleTool(target.getAttribute('data-tool-name'));
                    break;

                // ----- Xlarge Tools: 过滤 toolset -----
                case 'filter-toolset':
                    e.preventDefault();
                    toolsetFilter = target.getAttribute('data-toolset') || '';
                    _render();
                    break;

                // ----- Xlarge Plugins: 切换子标签 -----
                case 'switch-plugin-sub':
                    e.preventDefault();
                    pluginSubTab = target.getAttribute('data-sub') || 'market';
                    searchKeyword = '';
                    typeFilter = '';
                    _render();
                    break;

                // ----- Xlarge Plugins: 过滤类型 -----
                case 'filter-plugin-type':
                    e.preventDefault();
                    typeFilter = target.getAttribute('data-type') || '';
                    _render();
                    break;

                // ----- Xlarge Plugins: 安装插件 -----
                case 'install-plugin':
                    e.preventDefault();
                    e.stopPropagation();
                    _doInstallPlugin(target.getAttribute('data-name'));
                    break;

                // ----- Xlarge Plugins: 卸载插件 -----
                case 'uninstall-plugin':
                    e.preventDefault();
                    e.stopPropagation();
                    _doUninstallPlugin(target.getAttribute('data-name'));
                    break;

                // ----- 重试 -----
                case 'retry':
                    e.preventDefault();
                    loadData();
                    break;
            }
        }

        // ---------- 搜索输入处理 ----------
        function _handleInput(e) {
            var input = e.target.closest('[data-role="search-input"]');
            if (!input) return;

            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(function() {
                searchKeyword = input.value;
                _render();
            }, SEARCH_DEBOUNCE_MS);
        }

        // ---------- MCP 操作 ----------
        async function _doRefreshServer(name) {
            _toast('正在刷新 ' + name + '...', 'info');
            try {
                await _refreshMcpServer(name);
                _toast(name + ' 刷新成功', 'success');
                refresh();
            } catch (e) {
                _toast('刷新失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        async function _doRemoveServer(name) {
            var msg = '确定要移除 MCP 服务「' + name + '」吗？';
            if (typeof Components !== 'undefined' && Components.confirm) {
                var confirmed = await Components.confirm(msg);
                if (!confirmed) return;
            } else if (typeof confirm === 'function') {
                if (!confirm(msg)) return;
            }

            try {
                await _removeMcpServer(name);
                _toast(name + ' 已移除', 'success');
                refresh();
            } catch (e) {
                _toast('移除失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        async function _doAddServer() {
            var nameInput = container.querySelector('[data-field="server-name"]');
            var urlInput = container.querySelector('[data-field="server-url"]');
            var prefixInput = container.querySelector('[data-field="server-prefix"]');

            var name = nameInput ? nameInput.value.trim() : '';
            var url = urlInput ? urlInput.value.trim() : '';
            var prefix = prefixInput ? prefixInput.value.trim() : '';

            if (!name) { _toast('请输入服务名称', 'error'); return; }
            if (!url) { _toast('请输入服务 URL', 'error'); return; }

            try {
                await _addMcpServer({ name: name, url: url, prefix: prefix });
                _toast(name + ' 添加成功', 'success');
                showAddServerForm = false;
                refresh();
            } catch (e) {
                _toast('添加失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        async function _doRestartMcp() {
            _toast('正在重启 MCP...', 'info');
            try {
                await _restartMcp();
                _toast('MCP 重启成功', 'success');
                refresh();
            } catch (e) {
                _toast('重启失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ---------- Skills 操作 ----------
        async function _doDeleteSkill(name) {
            var msg = '确定要删除技能「' + name + '」吗？此操作不可撤销。';
            if (typeof Components !== 'undefined' && Components.confirm) {
                var confirmed = await Components.confirm(msg);
                if (!confirmed) return;
            } else if (typeof confirm === 'function') {
                if (!confirm(msg)) return;
            }

            try {
                await _deleteSkill(name);
                _toast(name + ' 已删除', 'success');
                refresh();
            } catch (e) {
                _toast('删除失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ---------- Tools 操作 ----------
        async function _doToggleTool(name) {
            var tool = null;
            for (var i = 0; i < tools.length; i++) {
                if (tools[i].name === name) { tool = tools[i]; break; }
            }
            if (!tool) return;

            var newState = !tool.enabled;
            try {
                await _toggleTool(name, newState);
                tool.enabled = newState;
                _toast(name + (newState ? ' 已启用' : ' 已禁用'), 'success');
                _render();
            } catch (e) {
                _toast('操作失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ---------- Plugins 操作 ----------
        async function _doInstallPlugin(name) {
            _toast('正在安装 ' + name + '...', 'info');
            try {
                await _installPlugin(name);
                _toast(name + ' 安装成功', 'success');
                refresh();
            } catch (e) {
                _toast('安装失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        async function _doUninstallPlugin(name) {
            var msg = '确定要卸载插件「' + name + '」吗？';
            if (typeof Components !== 'undefined' && Components.confirm) {
                var confirmed = await Components.confirm(msg);
                if (!confirmed) return;
            } else if (typeof confirm === 'function') {
                if (!confirm(msg)) return;
            }

            try {
                await _uninstallPlugin(name);
                _toast(name + ' 已卸载', 'success');
                refresh();
            } catch (e) {
                _toast('卸载失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ========== 事件绑定 ==========
        _clickHandler = _handleClick;
        _inputHandler = _handleInput;
        container.addEventListener('click', _clickHandler);
        container.addEventListener('input', _inputHandler);

        // SSE 事件订阅
        if (typeof Bus !== 'undefined') {
            var sseRefresh = refresh;
            Bus.on('sse:mcp.*', sseRefresh);
            Bus.on('sse:skill.*', sseRefresh);
            Bus.on('sse:tool.*', sseRefresh);
            _sseHandlers.push(
                { event: 'sse:mcp.*', fn: sseRefresh },
                { event: 'sse:skill.*', fn: sseRefresh },
                { event: 'sse:tool.*', fn: sseRefresh }
            );
        }

        // 初始加载数据
        loadData();

        // ========== 返回接口 ==========
        return {
            destroy: function() {
                if (_clickHandler) container.removeEventListener('click', _clickHandler);
                if (_inputHandler) container.removeEventListener('input', _inputHandler);
                if (debounceTimer) clearTimeout(debounceTimer);

                // 移除 SSE 订阅
                if (typeof Bus !== 'undefined') {
                    for (var i = 0; i < _sseHandlers.length; i++) {
                        Bus.off(_sseHandlers[i].event, _sseHandlers[i].fn);
                    }
                }

                container.innerHTML = '';
            },
            refresh: function() {
                loadData();
            }
        };
    }

    // ========== 入口卡片（简化版 1x1） ==========
    async function mountEntry(container, props) {
        _injectStyles();

        var totalCount = 0;
        var loaded = false;

        async function loadCount() {
            try {
                var results = await Promise.all([
                    _fetchMcpServers(),
                    _fetchSkills(),
                    _fetchTools(),
                    _fetchPluginsInstalled()
                ]);
                var mcp = Array.isArray(results[0]) ? results[0] : [];
                var skl = Array.isArray(results[1]) ? results[1] : [];
                var tls = Array.isArray(results[2]) ? results[2] : [];
                var plg = Array.isArray(results[3]) ? results[3] : [];
                totalCount = mcp.length + skl.length + tls.length + plg.length;
                loaded = true;
                _renderEntry();
            } catch (e) {
                loaded = true;
                _renderEntry();
            }
        }

        function _renderEntry() {
            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="mpc-small" data-action="open-overlay">' +
                        '<div class="mpc-small__emoji">\u{1F6D2}</div>' +
                        '<div class="mpc-small__label">功能商店</div>' +
                        (loaded
                            ? '<div class="mpc-small__count">' + totalCount + '</div><div class="mpc-small__unit">项功能</div>'
                            : '<div class="mpc-loading" style="padding:8px 0;"><div class="mpc-loading__spinner" style="width:18px;height:18px;border-width:2px;"></div></div>') +
                    '</div>' +
                '</div>';
        }

        var _clickHandler = function(e) {
            var target = e.target.closest('[data-action="open-overlay"]');
            if (target && typeof CardOverlay !== 'undefined') {
                CardOverlay.open('marketplace-card');
            }
        };
        container.addEventListener('click', _clickHandler);

        _renderEntry();
        loadCount();

        // SSE 事件订阅
        var _sseRefresh = function() { loadCount(); };
        if (typeof Bus !== 'undefined') {
            Bus.on('sse:mcp.*', _sseRefresh);
            Bus.on('sse:skill.*', _sseRefresh);
            Bus.on('sse:tool.*', _sseRefresh);

            return {
                destroy: function() {
                    container.removeEventListener('click', _clickHandler);
                    if (typeof Bus !== 'undefined') {
                        Bus.off('sse:mcp.*', _sseRefresh);
                        Bus.off('sse:skill.*', _sseRefresh);
                        Bus.off('sse:tool.*', _sseRefresh);
                    }
                    container.innerHTML = '';
                },
                refresh: function() { loadCount(); }
            };
        }

        return {
            destroy: function() {
                container.removeEventListener('click', _clickHandler);
                container.innerHTML = '';
            },
            refresh: function() { loadCount(); }
        };
    }

    // ========== 注册卡片 ==========
    WidgetRegistry.register('marketplace-card', {
        type: 'function',
        label: '功能商店',
        icon: '\u{1F6D2}',
        description: 'MCP服务/技能/工具/插件管理',
        defaultSize: { w: 2, h: 1 },
        category: 'functions',
        mount: mount
    });

    WidgetRegistry.register('marketplace-entry', {
        type: 'entry',
        label: '功能商店入口',
        icon: '\u{1F6D2}',
        description: '功能商店快速入口',
        defaultSize: { w: 1, h: 1 },
        category: 'entries',
        mount: mountEntry
    });

    // ========== 公开接口（调试用） ==========
    return {
        mount: mount,
        mountEntry: mountEntry
    };
})();
