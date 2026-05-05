/**
 * OpsCard.js - 运维监控卡片
 *
 * 支持 4 种尺寸: small(1x1) / medium(2x1) / large(2x2) / xlarge(全屏覆盖)
 * xlarge 模式支持 3 个标签页: 系统概览 / MCP健康 / 告警
 *
 * 依赖全局: WidgetRegistry, HermesClient, DataService, CardOverlay, Components, Bus
 */
var OpsCard = (() => {
    'use strict';

    // ========== 常量 ==========
    var API_STATUS = '/api/system/status';
    var API_DASHBOARD = '/api/system/dashboard';
    var API_MCP = '/api/mcp/servers';
    var API_ALERTS = '/api/alerts';
    var CACHE_DASHBOARD = 'ops:dashboard';
    var CACHE_MCP = 'ops:mcp';
    var CACHE_STATUS = 'ops:status';
    var CACHE_ALERTS = 'ops:alerts';
    var DASHBOARD_TTL = 10;          // 仪表盘缓存 10 秒
    var AUTO_REFRESH_MS = 10000;     // xlarge 自动刷新 10 秒
    var MAX_ALERTS_LARGE = 3;        // large 尺寸显示最近 3 条告警
    var TRUNCATE_MSG_LARGE = 40;     // large 告警消息截断长度

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (document.getElementById('oc-styles')) return;
        var style = document.createElement('style');
        style.id = 'oc-styles';
        style.textContent = [
            /* ===== 基础布局 ===== */
            '.oc-root { display:flex; flex-direction:column; height:100%; overflow:hidden; }',
            '.oc-header { display:flex; align-items:center; gap:8px; padding:10px 12px; flex-shrink:0; }',
            '.oc-header__icon { font-size:16px; flex-shrink:0; }',
            '.oc-header__title { font-size:var(--text-sm, 13px); font-weight:600; color:var(--text-primary); flex:1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.oc-header__status { width:8px; height:8px; border-radius:50%; flex-shrink:0; }',
            '.oc-header__status--ok { background:var(--green, #22c55e); box-shadow:0 0 4px rgba(34,197,94,0.4); }',
            '.oc-header__status--error { background:var(--red, #ef4444); box-shadow:0 0 4px rgba(239,68,68,0.4); }',
            '.oc-header__status--unknown { background:var(--text-tertiary); }',
            '.oc-body { flex:1; overflow-y:auto; overflow-x:hidden; padding:0 12px 12px; -webkit-overflow-scrolling:touch; }',
            '.oc-body::-webkit-scrollbar { width:4px; }',
            '.oc-body::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:2px; }',

            /* ===== Small 尺寸 (1x1) ===== */
            '.oc-small { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; cursor:pointer; padding:16px 8px; text-align:center; transition:opacity 0.15s; }',
            '.oc-small:hover { opacity:0.85; }',
            '.oc-small__emoji { font-size:32px; margin-bottom:6px; }',
            '.oc-small__label { font-size:var(--text-sm, 13px); font-weight:600; color:var(--text-primary); display:flex; align-items:center; gap:6px; }',
            '.oc-small__dot { width:8px; height:8px; border-radius:50%; display:inline-block; }',

            /* ===== Medium 迷你统计 ===== */
            '.oc-mini-stats { display:flex; gap:8px; padding:0 12px 10px; }',
            '.oc-mini-stat { flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; padding:8px 4px; border-radius:var(--radius-sm, 6px); background:var(--bg-secondary, rgba(0,0,0,0.03)); }',
            '.oc-mini-stat__value { font-size:var(--text-lg, 16px); font-weight:700; color:var(--accent); }',
            '.oc-mini-stat__label { font-size:10px; color:var(--text-tertiary); }',
            '.oc-alert-badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:var(--radius-xs, 4px); background:rgba(239,68,68,0.1); color:var(--red, #ef4444); font-size:10px; font-weight:600; }',

            /* ===== Large 统计网格 ===== */
            '.oc-stats-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin-bottom:10px; }',
            '.oc-stat-card { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:var(--radius-sm, 6px); background:var(--bg-secondary, rgba(0,0,0,0.03)); }',
            '.oc-stat-card__icon { font-size:16px; flex-shrink:0; }',
            '.oc-stat-card__info { display:flex; flex-direction:column; gap:1px; min-width:0; }',
            '.oc-stat-card__value { font-size:var(--text-sm, 13px); font-weight:700; color:var(--text-primary); }',
            '.oc-stat-card__label { font-size:10px; color:var(--text-tertiary); }',

            /* ===== Large MCP 健康 ===== */
            '.oc-mcp-section { margin-bottom:10px; }',
            '.oc-mcp-section__title { font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:6px; display:flex; align-items:center; gap:6px; }',
            '.oc-mcp-section__count { font-size:10px; color:var(--text-tertiary); font-weight:400; }',
            '.oc-mcp-dots { display:flex; gap:4px; flex-wrap:wrap; }',
            '.oc-mcp-dot { width:10px; height:10px; border-radius:50%; }',
            '.oc-mcp-dot--connected { background:var(--green, #22c55e); }',
            '.oc-mcp-dot--unknown { background:var(--text-tertiary); }',
            '.oc-mcp-dot--error { background:var(--red, #ef4444); }',

            /* ===== Large 最近告警 ===== */
            '.oc-alerts-section__title { font-size:11px; font-weight:600; color:var(--text-secondary); margin-bottom:6px; }',
            '.oc-alert-item { display:flex; align-items:flex-start; gap:6px; padding:6px 8px; border-radius:var(--radius-xs, 4px); cursor:pointer; transition:background 0.15s; margin-bottom:3px; }',
            '.oc-alert-item:hover { background:var(--bg-tertiary, rgba(0,0,0,0.04)); }',
            '.oc-alert-item__badge { font-size:9px; padding:1px 5px; border-radius:3px; font-weight:600; flex-shrink:0; margin-top:1px; }',
            '.oc-alert-item__badge--info { background:rgba(59,130,246,0.1); color:var(--blue, #3b82f6); }',
            '.oc-alert-item__badge--warning { background:rgba(234,179,8,0.1); color:var(--yellow, #eab308); }',
            '.oc-alert-item__badge--error { background:rgba(239,68,68,0.1); color:var(--red, #ef4444); }',
            '.oc-alert-item__msg { font-size:var(--text-xs, 11px); color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }',

            /* ===== Xlarge 全屏覆盖 ===== */
            '.oc-xl { display:flex; flex-direction:column; height:100%; }',
            '.oc-xl__header { display:flex; align-items:center; gap:10px; padding:14px 20px 10px; flex-shrink:0; border-bottom:1px solid var(--border); }',
            '.oc-xl__title { font-size:var(--text-lg, 16px); font-weight:700; color:var(--text-primary); flex:1; }',
            '.oc-xl__refresh { display:flex; align-items:center; gap:4px; padding:4px 10px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs, 11px); cursor:pointer; transition:all 0.15s; }',
            '.oc-xl__refresh:hover { border-color:var(--accent); color:var(--accent); }',

            /* ===== Xlarge 标签页 ===== */
            '.oc-xl__tabs { display:flex; gap:6px; padding:10px 20px 0; flex-shrink:0; overflow-x:auto; -webkit-overflow-scrolling:touch; }',
            '.oc-xl__tabs::-webkit-scrollbar { display:none; }',
            '.oc-xl__tab { padding:5px 14px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:transparent; color:var(--text-secondary); font-size:var(--text-sm, 13px); cursor:pointer; white-space:nowrap; transition:all 0.15s; }',
            '.oc-xl__tab:hover { border-color:var(--accent); color:var(--accent); }',
            '.oc-xl__tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }',
            '.oc-xl__body { flex:1; overflow-y:auto; padding:14px 20px; -webkit-overflow-scrolling:touch; }',
            '.oc-xl__body::-webkit-scrollbar { width:6px; }',
            '.oc-xl__body::-webkit-scrollbar-thumb { background:var(--border); border-radius:3px; }',

            /* ===== Xlarge 概览统计网格 ===== */
            '.oc-xl-stats { display:grid; grid-template-columns:repeat(auto-fill, minmax(140px, 1fr)); gap:10px; margin-bottom:16px; }',
            '.oc-xl-stat { padding:14px; border:1px solid var(--border); border-radius:var(--radius-sm, 8px); display:flex; flex-direction:column; gap:6px; transition:box-shadow 0.15s; }',
            '.oc-xl-stat:hover { box-shadow:var(--shadow, 0 1px 3px rgba(0,0,0,0.08)); }',
            '.oc-xl-stat__top { display:flex; align-items:center; gap:8px; }',
            '.oc-xl-stat__icon { font-size:20px; }',
            '.oc-xl-stat__label { font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.5px; }',
            '.oc-xl-stat__value { font-size:var(--text-lg, 18px); font-weight:700; color:var(--text-primary); }',
            '.oc-xl-stat__sub { font-size:10px; color:var(--text-tertiary); }',

            /* ===== Xlarge MCP 服务器列表 ===== */
            '.oc-xl-mcp-summary { display:flex; gap:12px; margin-bottom:14px; }',
            '.oc-xl-mcp-stat { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:var(--radius-sm, 6px); background:var(--bg-secondary); }',
            '.oc-xl-mcp-stat__dot { width:8px; height:8px; border-radius:50%; }',
            '.oc-xl-mcp-stat__value { font-size:var(--text-sm, 13px); font-weight:600; color:var(--text-primary); }',
            '.oc-xl-mcp-stat__label { font-size:10px; color:var(--text-tertiary); }',
            '.oc-xl-mcp-list { display:flex; flex-direction:column; gap:6px; }',
            '.oc-xl-mcp-server { padding:10px 14px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); cursor:pointer; transition:background 0.15s, box-shadow 0.15s; }',
            '.oc-xl-mcp-server:hover { background:var(--bg-tertiary); box-shadow:var(--shadow); }',
            '.oc-xl-mcp-server__top { display:flex; align-items:center; gap:8px; margin-bottom:4px; }',
            '.oc-xl-mcp-server__name { font-size:var(--text-sm, 13px); font-weight:500; color:var(--text-primary); flex:1; }',
            '.oc-xl-mcp-server__status { width:8px; height:8px; border-radius:50%; flex-shrink:0; }',
            '.oc-xl-mcp-server__meta { display:flex; align-items:center; gap:10px; font-size:10px; color:var(--text-tertiary); }',
            '.oc-xl-mcp-server__detail { display:none; padding-top:8px; margin-top:8px; border-top:1px solid var(--border); font-size:var(--text-xs, 11px); color:var(--text-secondary); }',
            '.oc-xl-mcp-server.expanded .oc-xl-mcp-server__detail { display:block; }',
            '.oc-xl-mcp-server__chevron { font-size:10px; color:var(--text-tertiary); transition:transform 0.2s; }',
            '.oc-xl-mcp-server.expanded .oc-xl-mcp-server__chevron { transform:rotate(180deg); }',

            /* ===== Xlarge 告警列表 ===== */
            '.oc-xl-alert-filters { display:flex; gap:6px; margin-bottom:12px; }',
            '.oc-xl-alert-filter { padding:4px 12px; border:1px solid var(--border); border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs, 11px); cursor:pointer; transition:all 0.15s; }',
            '.oc-xl-alert-filter:hover { border-color:var(--accent); color:var(--accent); }',
            '.oc-xl-alert-filter.active { background:var(--accent); color:#fff; border-color:var(--accent); }',
            '.oc-xl-alert-actions { display:flex; gap:8px; margin-bottom:12px; }',
            '.oc-xl-alert-action { padding:4px 12px; border:1px solid var(--border); border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs, 11px); cursor:pointer; transition:all 0.15s; }',
            '.oc-xl-alert-action:hover { border-color:var(--accent); color:var(--accent); }',
            '.oc-xl-alert-action.danger:hover { border-color:var(--red, #ef4444); color:var(--red, #ef4444); }',
            '.oc-xl-alert-list { display:flex; flex-direction:column; gap:6px; }',
            '.oc-xl-alert { padding:10px 14px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); cursor:pointer; transition:background 0.15s; }',
            '.oc-xl-alert:hover { background:var(--bg-tertiary); }',
            '.oc-xl-alert__top { display:flex; align-items:center; gap:8px; margin-bottom:4px; }',
            '.oc-xl-alert__badge { font-size:10px; padding:2px 8px; border-radius:var(--radius-xs, 4px); font-weight:600; flex-shrink:0; }',
            '.oc-xl-alert__badge--info { background:rgba(59,130,246,0.1); color:var(--blue, #3b82f6); }',
            '.oc-xl-alert__badge--warning { background:rgba(234,179,8,0.1); color:var(--yellow, #eab308); }',
            '.oc-xl-alert__badge--error { background:rgba(239,68,68,0.1); color:var(--red, #ef4444); }',
            '.oc-xl-alert__source { font-size:10px; color:var(--text-tertiary); margin-left:auto; }',
            '.oc-xl-alert__time { font-size:10px; color:var(--text-tertiary); flex-shrink:0; }',
            '.oc-xl-alert__msg { font-size:var(--text-sm, 13px); color:var(--text-primary); line-height:1.4; margin-bottom:4px; }',
            '.oc-xl-alert__unread { width:6px; height:6px; border-radius:50%; background:var(--accent); flex-shrink:0; }',
            '.oc-xl-alert__detail { display:none; padding-top:8px; margin-top:8px; border-top:1px solid var(--border); }',
            '.oc-xl-alert.expanded .oc-xl-alert__detail { display:block; }',
            '.oc-xl-alert__detail-msg { font-size:var(--text-xs, 11px); color:var(--text-secondary); line-height:1.6; margin-bottom:8px; }',
            '.oc-xl-alert__detail-actions { display:flex; gap:6px; }',
            '.oc-xl-alert__detail-btn { padding:3px 10px; border:1px solid var(--border); border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-secondary); font-size:10px; cursor:pointer; transition:all 0.15s; }',
            '.oc-xl-alert__detail-btn:hover { border-color:var(--accent); color:var(--accent); }',

            /* ===== 状态提示 ===== */
            '.oc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--text-tertiary); text-align:center; }',
            '.oc-empty__icon { font-size:40px; margin-bottom:10px; opacity:0.5; }',
            '.oc-empty__text { font-size:var(--text-sm, 13px); }',
            '.oc-error { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px 20px; text-align:center; gap:10px; }',
            '.oc-error__icon { font-size:32px; }',
            '.oc-error__text { font-size:var(--text-sm, 13px); color:var(--red, #ef4444); }',
            '.oc-loading { display:flex; align-items:center; justify-content:center; padding:30px; }',
            '.oc-loading__spinner { width:24px; height:24px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:oc-spin 0.6s linear infinite; }',
            '@keyframes oc-spin { to { transform:rotate(360deg); } }',

            /* ===== 骨架屏 ===== */
            '.oc-skeleton { display:flex; flex-direction:column; gap:8px; padding:12px; }',
            '.oc-skeleton__line { height:12px; border-radius:4px; background:linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%); background-size:200% 100%; animation:oc-shimmer 1.5s infinite; }',
            '.oc-skeleton__line.short { width:60%; }',
            '.oc-skeleton__line.medium { width:80%; }',
            '@keyframes oc-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }'
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

    /** 格式化相对时间 */
    function _formatTime(ts) {
        if (!ts) return '';
        if (typeof Components !== 'undefined' && Components.formatDateTime) {
            return Components.formatDateTime(ts);
        }
        try {
            var d = new Date(ts);
            var now = new Date();
            var diff = now - d;
            if (diff < 60000) return '刚刚';
            if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前';
            if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
            if (diff < 604800000) return Math.floor(diff / 86400000) + '天前';
            return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        } catch (e) {
            return String(ts);
        }
    }

    /** 格式化运行时间（秒 → 可读） */
    function _formatUptime(seconds) {
        if (!seconds && seconds !== 0) return '-';
        var d = Math.floor(seconds / 86400);
        var h = Math.floor((seconds % 86400) / 3600);
        var m = Math.floor((seconds % 3600) / 60);
        if (d > 0) return d + '天' + h + '小时';
        if (h > 0) return h + '小时' + m + '分';
        return m + '分钟';
    }

    /** 告警级别徽章 CSS 类 */
    function _alertBadgeClass(level) {
        var l = (level || 'info').toLowerCase();
        if (l === 'warning') return 'oc-alert-item__badge--warning';
        if (l === 'error') return 'oc-alert-item__badge--error';
        return 'oc-alert-item__badge--info';
    }

    /** xlarge 告警级别徽章 CSS 类 */
    function _xlAlertBadgeClass(level) {
        var l = (level || 'info').toLowerCase();
        if (l === 'warning') return 'oc-xl-alert__badge--warning';
        if (l === 'error') return 'oc-xl-alert__badge--error';
        return 'oc-xl-alert__badge--info';
    }

    /** 告警级别标签 */
    function _alertLevelLabel(level) {
        var l = (level || 'info').toLowerCase();
        var map = { info: '信息', warning: '警告', error: '错误' };
        return map[l] || level || '信息';
    }

    /** MCP 状态 CSS 类 */
    function _mcpDotClass(status) {
        var s = (status || '').toLowerCase();
        if (s === 'connected') return 'oc-mcp-dot--connected';
        if (s === 'error') return 'oc-mcp-dot--error';
        return 'oc-mcp-dot--unknown';
    }

    /** 系统状态 CSS 类 */
    function _statusDotClass(status) {
        var s = (status || '').toLowerCase();
        if (s === 'ok' || s === 'healthy') return 'oc-header__status--ok';
        if (s === 'error' || s === 'unhealthy') return 'oc-header__status--error';
        return 'oc-header__status--unknown';
    }

    /** 骨架屏 HTML */
    function _skeletonHtml(lines) {
        var html = '<div class="oc-skeleton">';
        for (var i = 0; i < (lines || 4); i++) {
            var cls = i === lines - 1 ? ' oc-skeleton__line short' : (i % 2 === 0 ? '' : ' oc-skeleton__line medium');
            html += '<div class="oc-skeleton__line' + cls + '"></div>';
        }
        html += '</div>';
        return html;
    }

    /** 加载中 HTML */
    function _loadingHtml() {
        return '<div class="oc-loading"><div class="oc-loading__spinner"></div></div>';
    }

    /** 空状态 HTML */
    function _emptyHtml(text) {
        return '<div class="oc-empty"><div class="oc-empty__icon">📭</div><div class="oc-empty__text">' + (text || '暂无数据') + '</div></div>';
    }

    /** 错误状态 HTML */
    function _errorHtml(msg) {
        return '<div class="oc-error"><div class="oc-error__icon">⚠️</div><div class="oc-error__text">' + _esc(msg || '加载失败') + '</div><button class="btn btn-sm btn-ghost" data-action="retry">重试</button></div>';
    }

    /** Toast 提示 */
    function _showToast(msg, type) {
        if (typeof Components !== 'undefined' && Components.showToast) {
            Components.showToast(msg, type);
        } else {
            console.log('[OpsCard] ' + (type || 'info') + ': ' + msg);
        }
    }

    // ========== 数据获取 ==========

    /** 获取系统状态 */
    function _fetchStatus() {
        return HermesClient.cachedGet(CACHE_STATUS, function() {
            return HermesClient.get(API_STATUS);
        }, DASHBOARD_TTL);
    }

    /** 获取仪表盘统计 */
    function _fetchDashboard() {
        return HermesClient.cachedGet(CACHE_DASHBOARD, function() {
            return HermesClient.get(API_DASHBOARD);
        }, DASHBOARD_TTL);
    }

    /** 获取 MCP 服务器列表 */
    function _fetchMcpServers() {
        return HermesClient.cachedGet(CACHE_MCP, function() {
            return HermesClient.get(API_MCP);
        }, DASHBOARD_TTL);
    }

    /** 获取告警列表 */
    function _fetchAlerts() {
        return HermesClient.cachedGet(CACHE_ALERTS, function() {
            return HermesClient.get(API_ALERTS);
        }, DASHBOARD_TTL);
    }

    /** 标记告警已读 */
    function _markAlertRead(id) {
        return HermesClient.put(API_ALERTS + '/' + id + '/read');
    }

    /** 清除所有告警 */
    function _clearAllAlerts() {
        return HermesClient.del(API_ALERTS);
    }

    // ========== 判断尺寸 ==========

    function _getSize(props) {
        var config = props.config || {};
        var w = config.w || 2;
        var h = config.h || 1;
        if (w <= 1 && h <= 1) return 'small';
        if (w <= 2 && h <= 1) return 'medium';
        if (w <= 2 && h <= 2) return 'large';
        return 'xlarge';
    }

    // ========== 主挂载函数 ==========

    async function mount(container, props) {
        var cardId = props.cardId;
        var desktopId = props.desktopId;
        var size = _getSize(props);

        // 注入样式
        _injectStyles();

        // 内部状态
        var sysStatus = null;       // { status, version, uptime, memory_usage, cpu_usage }
        var dashboard = null;       // { total_sessions, total_knowledge, total_agents, total_tools }
        var mcpServers = [];        // [{ name, status, tools_count, ... }]
        var alerts = [];            // [{ id, level, message, timestamp, source, read }]
        var loading = true;
        var error = null;

        // xlarge 状态
        var xlTab = 'overview';     // 'overview' | 'mcp' | 'alerts'
        var xlAlertFilter = 'all';  // 'all' | 'info' | 'warning' | 'error'
        var expandedAlertId = null;
        var expandedMcpName = null;
        var autoRefreshTimer = null;

        // 事件处理函数引用（用于清理）
        var _clickHandler = null;
        var _sseHandlers = {};

        // ---------- 数据加载 ----------
        async function loadData() {
            loading = true;
            error = null;
            _render();

            try {
                var results = await Promise.allSettled([
                    _fetchStatus(),
                    _fetchDashboard(),
                    _fetchMcpServers(),
                    _fetchAlerts()
                ]);

                if (results[0].status === 'fulfilled') sysStatus = results[0].value;
                if (results[1].status === 'fulfilled') dashboard = results[1].value;
                if (results[2].status === 'fulfilled') {
                    mcpServers = Array.isArray(results[2].value) ? results[2].value : [];
                }
                if (results[3].status === 'fulfilled') {
                    alerts = Array.isArray(results[3].value) ? results[3].value : [];
                }

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
            // 清除缓存后重新加载
            try {
                if (typeof HermesClient !== 'undefined' && HermesClient.clearCache) {
                    HermesClient.clearCache(CACHE_STATUS);
                    HermesClient.clearCache(CACHE_DASHBOARD);
                    HermesClient.clearCache(CACHE_MCP);
                    HermesClient.clearCache(CACHE_ALERTS);
                }
            } catch (e) { /* ignore */ }

            try {
                var results = await Promise.allSettled([
                    _fetchStatus(),
                    _fetchDashboard(),
                    _fetchMcpServers(),
                    _fetchAlerts()
                ]);

                if (results[0].status === 'fulfilled') sysStatus = results[0].value;
                if (results[1].status === 'fulfilled') dashboard = results[1].value;
                if (results[2].status === 'fulfilled') {
                    mcpServers = Array.isArray(results[2].value) ? results[2].value : [];
                }
                if (results[3].status === 'fulfilled') {
                    alerts = Array.isArray(results[3].value) ? results[3].value : [];
                }

                loading = false;
                error = null;
                _render();
            } catch (e) {
                error = e.message || '刷新失败';
                _render();
            }
        }

        // ---------- xlarge 自动刷新 ----------
        function _startAutoRefresh() {
            if (autoRefreshTimer) clearInterval(autoRefreshTimer);
            autoRefreshTimer = setInterval(function() {
                refresh();
            }, AUTO_REFRESH_MS);
        }

        function _stopAutoRefresh() {
            if (autoRefreshTimer) {
                clearInterval(autoRefreshTimer);
                autoRefreshTimer = null;
            }
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

        // ========== Small 渲染 (1x1) ==========
        function _renderSmall() {
            var statusCls = 'oc-header__status--unknown';
            if (sysStatus && sysStatus.status) {
                statusCls = _statusDotClass(sysStatus.status);
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="oc-small" data-action="open-overlay">' +
                        '<div class="oc-small__emoji">📊</div>' +
                        '<div class="oc-small__label">运维中心 <span class="oc-small__dot ' + statusCls + '"></span></div>' +
                    '</div>' +
                '</div>';
        }

        // ========== Medium 渲染 (2x1) ==========
        function _renderMedium() {
            if (loading) {
                container.innerHTML = '<div class="ws-widget"><div class="oc-header"><span class="oc-header__icon">📊</span><span class="oc-header__title">运维中心</span></div>' + _skeletonHtml(3) + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="ws-widget"><div class="oc-header"><span class="oc-header__icon">📊</span><span class="oc-header__title">运维中心</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            var statusCls = 'oc-header__status--unknown';
            if (sysStatus && sysStatus.status) {
                statusCls = _statusDotClass(sysStatus.status);
            }

            var sessions = (dashboard && dashboard.total_sessions) || 0;
            var knowledge = (dashboard && dashboard.total_knowledge) || 0;
            var agents = (dashboard && dashboard.total_agents) || 0;
            var unreadAlerts = 0;
            for (var i = 0; i < alerts.length; i++) {
                if (!alerts[i].read) unreadAlerts++;
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="oc-header">' +
                        '<span class="oc-header__icon">📊</span>' +
                        '<span class="oc-header__title">运维中心</span>' +
                        '<span class="oc-header__status ' + statusCls + '"></span>' +
                        (unreadAlerts > 0
                            ? '<span class="oc-alert-badge">🔔 ' + unreadAlerts + '</span>'
                            : '') +
                    '</div>' +
                    '<div class="oc-mini-stats">' +
                        '<div class="oc-mini-stat" data-action="open-overlay">' +
                            '<span class="oc-mini-stat__value">' + sessions + '</span>' +
                            '<span class="oc-mini-stat__label">会话数</span>' +
                        '</div>' +
                        '<div class="oc-mini-stat" data-action="open-overlay">' +
                            '<span class="oc-mini-stat__value">' + knowledge + '</span>' +
                            '<span class="oc-mini-stat__label">知识数</span>' +
                        '</div>' +
                        '<div class="oc-mini-stat" data-action="open-overlay">' +
                            '<span class="oc-mini-stat__value">' + agents + '</span>' +
                            '<span class="oc-mini-stat__label">Agent数</span>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }

        // ========== Large 渲染 (2x2) ==========
        function _renderLarge() {
            if (loading) {
                container.innerHTML = '<div class="ws-widget"><div class="oc-header"><span class="oc-header__icon">📊</span><span class="oc-header__title">运维中心</span></div>' + _skeletonHtml(6) + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="ws-widget"><div class="oc-header"><span class="oc-header__icon">📊</span><span class="oc-header__title">运维中心</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            var statusCls = 'oc-header__status--unknown';
            if (sysStatus && sysStatus.status) {
                statusCls = _statusDotClass(sysStatus.status);
            }

            var sessions = (dashboard && dashboard.total_sessions) || 0;
            var knowledge = (dashboard && dashboard.total_knowledge) || 0;
            var agents = (dashboard && dashboard.total_agents) || 0;
            var tools = (dashboard && dashboard.total_tools) || 0;

            // 统计网格
            var statsHtml =
                '<div class="oc-stats-grid">' +
                    '<div class="oc-stat-card" data-action="open-overlay">' +
                        '<span class="oc-stat-card__icon">💬</span>' +
                        '<div class="oc-stat-card__info"><span class="oc-stat-card__value">' + sessions + '</span><span class="oc-stat-card__label">会话数</span></div>' +
                    '</div>' +
                    '<div class="oc-stat-card" data-action="open-overlay">' +
                        '<span class="oc-stat-card__icon">📖</span>' +
                        '<div class="oc-stat-card__info"><span class="oc-stat-card__value">' + knowledge + '</span><span class="oc-stat-card__label">知识数</span></div>' +
                    '</div>' +
                    '<div class="oc-stat-card" data-action="open-overlay">' +
                        '<span class="oc-stat-card__icon">🤖</span>' +
                        '<div class="oc-stat-card__info"><span class="oc-stat-card__value">' + agents + '</span><span class="oc-stat-card__label">Agent数</span></div>' +
                    '</div>' +
                    '<div class="oc-stat-card" data-action="open-overlay">' +
                        '<span class="oc-stat-card__icon">🔧</span>' +
                        '<div class="oc-stat-card__info"><span class="oc-stat-card__value">' + tools + '</span><span class="oc-stat-card__label">工具数</span></div>' +
                    '</div>' +
                '</div>';

            // MCP 健康
            var connectedCount = 0;
            var mcpDotsHtml = '';
            for (var i = 0; i < mcpServers.length; i++) {
                var s = mcpServers[i];
                var dotCls = _mcpDotClass(s.status);
                mcpDotsHtml += '<span class="oc-mcp-dot ' + dotCls + '" title="' + _esc(s.name) + ': ' + _esc(s.status) + '"></span>';
                if (s.status === 'connected') connectedCount++;
            }

            var mcpHtml =
                '<div class="oc-mcp-section">' +
                    '<div class="oc-mcp-section__title">MCP 健康 <span class="oc-mcp-section__count">' + connectedCount + '/' + mcpServers.length + '</span></div>' +
                    (mcpServers.length > 0
                        ? '<div class="oc-mcp-dots">' + mcpDotsHtml + '</div>'
                        : '<div style="font-size:10px;color:var(--text-tertiary);">暂无 MCP 服务器</div>') +
                '</div>';

            // 最近告警
            var recentAlerts = alerts.slice(0, MAX_ALERTS_LARGE);
            var alertsHtml = '';
            if (recentAlerts.length > 0) {
                alertsHtml = '<div class="oc-alerts-section__title">最近告警</div>';
                for (var j = 0; j < recentAlerts.length; j++) {
                    var a = recentAlerts[j];
                    var badgeCls = _alertBadgeClass(a.level);
                    alertsHtml +=
                        '<div class="oc-alert-item" data-action="open-alert-overlay" data-alert-id="' + _esc(a.id) + '">' +
                            '<span class="oc-alert-item__badge ' + badgeCls + '">' + _alertLevelLabel(a.level) + '</span>' +
                            '<span class="oc-alert-item__msg">' + _esc(_truncate(a.message, TRUNCATE_MSG_LARGE)) + '</span>' +
                        '</div>';
                }
            } else {
                alertsHtml = '<div class="oc-alerts-section__title">最近告警</div><div style="font-size:10px;color:var(--text-tertiary);padding:4px 0;">暂无告警</div>';
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="oc-header">' +
                        '<span class="oc-header__icon">📊</span>' +
                        '<span class="oc-header__title">运维中心</span>' +
                        '<span class="oc-header__status ' + statusCls + '"></span>' +
                    '</div>' +
                    '<div class="oc-body">' +
                        statsHtml +
                        mcpHtml +
                        alertsHtml +
                    '</div>' +
                '</div>';
        }

        // ========== Xlarge 渲染 ==========
        function _renderXlarge() {
            switch (xlTab) {
                case 'overview': _renderXlOverview(); break;
                case 'mcp':      _renderXlMcp(); break;
                case 'alerts':   _renderXlAlerts(); break;
            }
        }

        // ----- Xlarge 系统概览 -----
        function _renderXlOverview() {
            if (loading) {
                container.innerHTML = '<div class="oc-xl"><div class="oc-xl__header"><span class="oc-xl__title">运维中心</span></div>' + _loadingHtml() + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="oc-xl"><div class="oc-xl__header"><span class="oc-xl__title">运维中心</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            var version = (sysStatus && sysStatus.version) || '-';
            var uptime = _formatUptime(sysStatus && sysStatus.uptime);
            var memory = (sysStatus && sysStatus.memory_usage) || '-';
            var cpu = (sysStatus && sysStatus.cpu_usage) || '-';
            var sessions = (dashboard && dashboard.total_sessions) || 0;
            var knowledge = (dashboard && dashboard.total_knowledge) || 0;
            var agents = (dashboard && dashboard.total_agents) || 0;
            var tools = (dashboard && dashboard.total_tools) || 0;

            var statsHtml =
                '<div class="oc-xl-stats">' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">🏷️</span><span class="oc-xl-stat__label">版本</span></div><span class="oc-xl-stat__value">' + _esc(version) + '</span></div>' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">⏱️</span><span class="oc-xl-stat__label">运行时间</span></div><span class="oc-xl-stat__value">' + _esc(uptime) + '</span></div>' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">💬</span><span class="oc-xl-stat__label">会话数</span></div><span class="oc-xl-stat__value">' + sessions + '</span></div>' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">📖</span><span class="oc-xl-stat__label">知识数</span></div><span class="oc-xl-stat__value">' + knowledge + '</span></div>' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">🤖</span><span class="oc-xl-stat__label">Agent数</span></div><span class="oc-xl-stat__value">' + agents + '</span></div>' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">🔧</span><span class="oc-xl-stat__label">工具数</span></div><span class="oc-xl-stat__value">' + tools + '</span></div>' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">💾</span><span class="oc-xl-stat__label">内存</span></div><span class="oc-xl-stat__value">' + _esc(memory) + '</span></div>' +
                    '<div class="oc-xl-stat"><div class="oc-xl-stat__top"><span class="oc-xl-stat__icon">⚡</span><span class="oc-xl-stat__label">CPU</span></div><span class="oc-xl-stat__value">' + _esc(cpu) + '</span></div>' +
                '</div>';

            container.innerHTML =
                '<div class="oc-xl">' +
                    '<div class="oc-xl__header">' +
                        '<span class="oc-xl__title">运维中心</span>' +
                        '<button class="oc-xl__refresh" data-action="refresh">🔄 刷新</button>' +
                    '</div>' +
                    '<div class="oc-xl__tabs">' +
                        '<button class="oc-xl__tab active" data-action="switch-tab" data-tab="overview">系统概览</button>' +
                        '<button class="oc-xl__tab" data-action="switch-tab" data-tab="mcp">MCP健康</button>' +
                        '<button class="oc-xl__tab" data-action="switch-tab" data-tab="alerts">告警</button>' +
                    '</div>' +
                    '<div class="oc-xl__body">' + statsHtml + '</div>' +
                '</div>';
        }

        // ----- Xlarge MCP 健康 -----
        function _renderXlMcp() {
            if (loading) {
                container.innerHTML = '<div class="oc-xl"><div class="oc-xl__header"><span class="oc-xl__title">运维中心</span></div>' + _loadingHtml() + '</div>';
                return;
            }

            var connectedCount = 0;
            for (var i = 0; i < mcpServers.length; i++) {
                if (mcpServers[i].status === 'connected') connectedCount++;
            }

            // 汇总统计
            var summaryHtml =
                '<div class="oc-xl-mcp-summary">' +
                    '<div class="oc-xl-mcp-stat"><span class="oc-xl-mcp-stat__dot" style="background:var(--green, #22c55e);"></span><span class="oc-xl-mcp-stat__value">' + connectedCount + '</span><span class="oc-xl-mcp-stat__label">已连接</span></div>' +
                    '<div class="oc-xl-mcp-stat"><span class="oc-xl-mcp-stat__dot" style="background:var(--text-tertiary);"></span><span class="oc-xl-mcp-stat__value">' + mcpServers.length + '</span><span class="oc-xl-mcp-stat__label">总计</span></div>' +
                '</div>';

            // 服务器列表
            var listHtml = '';
            if (mcpServers.length === 0) {
                listHtml = _emptyHtml('暂无 MCP 服务器');
            } else {
                listHtml = '<div class="oc-xl-mcp-list">';
                for (var j = 0; j < mcpServers.length; j++) {
                    var srv = mcpServers[j];
                    var dotColor = srv.status === 'connected' ? 'var(--green, #22c55e)' : (srv.status === 'error' ? 'var(--red, #ef4444)' : 'var(--text-tertiary)');
                    var isExpanded = expandedMcpName === srv.name;
                    var toolsCount = srv.tools_count || 0;
                    var lastCheck = _formatTime(srv.last_check || srv.updated_at);

                    listHtml +=
                        '<div class="oc-xl-mcp-server' + (isExpanded ? ' expanded' : '') + '" data-action="toggle-mcp" data-name="' + _esc(srv.name) + '">' +
                            '<div class="oc-xl-mcp-server__top">' +
                                '<span class="oc-xl-mcp-server__status" style="background:' + dotColor + ';"></span>' +
                                '<span class="oc-xl-mcp-server__name">' + _esc(srv.name) + '</span>' +
                                '<span class="oc-xl-mcp-server__chevron">▼</span>' +
                            '</div>' +
                            '<div class="oc-xl-mcp-server__meta">' +
                                '<span>🔧 ' + toolsCount + ' 个工具</span>' +
                                '<span>🕐 ' + lastCheck + '</span>' +
                            '</div>' +
                            '<div class="oc-xl-mcp-server__detail">' +
                                '<div style="display:grid;grid-template-columns:auto 1fr;gap:4px 12px;">' +
                                    '<span style="color:var(--text-tertiary);">状态:</span><span>' + _esc(srv.status || 'unknown') + '</span>' +
                                    '<span style="color:var(--text-tertiary);">工具数:</span><span>' + toolsCount + '</span>' +
                                    (srv.description ? '<span style="color:var(--text-tertiary);">描述:</span><span>' + _esc(srv.description) + '</span>' : '') +
                                    (srv.endpoint ? '<span style="color:var(--text-tertiary);">端点:</span><span>' + _esc(srv.endpoint) + '</span>' : '') +
                                '</div>' +
                            '</div>' +
                        '</div>';
                }
                listHtml += '</div>';
            }

            container.innerHTML =
                '<div class="oc-xl">' +
                    '<div class="oc-xl__header">' +
                        '<span class="oc-xl__title">运维中心</span>' +
                        '<button class="oc-xl__refresh" data-action="refresh">🔄 刷新</button>' +
                    '</div>' +
                    '<div class="oc-xl__tabs">' +
                        '<button class="oc-xl__tab" data-action="switch-tab" data-tab="overview">系统概览</button>' +
                        '<button class="oc-xl__tab active" data-action="switch-tab" data-tab="mcp">MCP健康</button>' +
                        '<button class="oc-xl__tab" data-action="switch-tab" data-tab="alerts">告警</button>' +
                    '</div>' +
                    '<div class="oc-xl__body">' + summaryHtml + listHtml + '</div>' +
                '</div>';
        }

        // ----- Xlarge 告警 -----
        function _renderXlAlerts() {
            if (loading) {
                container.innerHTML = '<div class="oc-xl"><div class="oc-xl__header"><span class="oc-xl__title">运维中心</span></div>' + _loadingHtml() + '</div>';
                return;
            }

            // 过滤告警
            var filtered = alerts;
            if (xlAlertFilter !== 'all') {
                filtered = [];
                for (var i = 0; i < alerts.length; i++) {
                    if (alerts[i].level === xlAlertFilter) filtered.push(alerts[i]);
                }
            }

            // 筛选按钮
            var filtersHtml =
                '<div class="oc-xl-alert-filters">' +
                    '<button class="oc-xl-alert-filter' + (xlAlertFilter === 'all' ? ' active' : '') + '" data-action="alert-filter" data-filter="all">全部</button>' +
                    '<button class="oc-xl-alert-filter' + (xlAlertFilter === 'info' ? ' active' : '') + '" data-action="alert-filter" data-filter="info">信息</button>' +
                    '<button class="oc-xl-alert-filter' + (xlAlertFilter === 'warning' ? ' active' : '') + '" data-action="alert-filter" data-filter="warning">警告</button>' +
                    '<button class="oc-xl-alert-filter' + (xlAlertFilter === 'error' ? ' active' : '') + '" data-action="alert-filter" data-filter="error">错误</button>' +
                '</div>';

            // 操作按钮
            var actionsHtml =
                '<div class="oc-xl-alert-actions">' +
                    '<button class="oc-xl-alert-action" data-action="mark-all-read">全部已读</button>' +
                    '<button class="oc-xl-alert-action danger" data-action="clear-all-alerts">清除全部</button>' +
                '</div>';

            // 告警列表
            var listHtml = '';
            if (filtered.length === 0) {
                listHtml = _emptyHtml('暂无告警');
            } else {
                listHtml = '<div class="oc-xl-alert-list">';
                for (var j = 0; j < filtered.length; j++) {
                    var a = filtered[j];
                    var badgeCls = _xlAlertBadgeClass(a.level);
                    var isExpanded = expandedAlertId === a.id;

                    listHtml +=
                        '<div class="oc-xl-alert' + (isExpanded ? ' expanded' : '') + '" data-action="toggle-alert" data-alert-id="' + _esc(a.id) + '">' +
                            '<div class="oc-xl-alert__top">' +
                                (!a.read ? '<span class="oc-xl-alert__unread"></span>' : '') +
                                '<span class="oc-xl-alert__badge ' + badgeCls + '">' + _alertLevelLabel(a.level) + '</span>' +
                                '<span class="oc-xl-alert__source">' + _esc(a.source || '') + '</span>' +
                                '<span class="oc-xl-alert__time">' + _formatTime(a.timestamp) + '</span>' +
                            '</div>' +
                            '<div class="oc-xl-alert__msg">' + _esc(a.message) + '</div>' +
                            '<div class="oc-xl-alert__detail">' +
                                '<div class="oc-xl-alert__detail-msg">' + _esc(a.message) + '</div>' +
                                '<div class="oc-xl-alert__detail-actions">' +
                                    (!a.read ? '<button class="oc-xl-alert__detail-btn" data-action="mark-read" data-alert-id="' + _esc(a.id) + '">标为已读</button>' : '') +
                                '</div>' +
                            '</div>' +
                        '</div>';
                }
                listHtml += '</div>';
            }

            container.innerHTML =
                '<div class="oc-xl">' +
                    '<div class="oc-xl__header">' +
                        '<span class="oc-xl__title">运维中心</span>' +
                        '<button class="oc-xl__refresh" data-action="refresh">🔄 刷新</button>' +
                    '</div>' +
                    '<div class="oc-xl__tabs">' +
                        '<button class="oc-xl__tab" data-action="switch-tab" data-tab="overview">系统概览</button>' +
                        '<button class="oc-xl__tab" data-action="switch-tab" data-tab="mcp">MCP健康</button>' +
                        '<button class="oc-xl__tab active" data-action="switch-tab" data-tab="alerts">告警</button>' +
                    '</div>' +
                    '<div class="oc-xl__body">' + filtersHtml + actionsHtml + listHtml + '</div>' +
                '</div>';
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
                        CardOverlay.open('ops-card');
                    }
                    break;

                // ----- Large: 点击告警打开覆盖层 -----
                case 'open-alert-overlay':
                    e.preventDefault();
                    var alertId = target.getAttribute('data-alert-id');
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.open('ops-card', { tab: 'alerts', alertId: alertId });
                    }
                    break;

                // ----- Xlarge: 切换标签页 -----
                case 'switch-tab':
                    e.preventDefault();
                    var tab = target.getAttribute('data-tab');
                    if (tab) {
                        xlTab = tab;
                        expandedAlertId = null;
                        expandedMcpName = null;
                        _renderXlarge();
                    }
                    break;

                // ----- Xlarge: 刷新 -----
                case 'refresh':
                    e.preventDefault();
                    refresh();
                    break;

                // ----- Xlarge: 告警筛选 -----
                case 'alert-filter':
                    e.preventDefault();
                    var filter = target.getAttribute('data-filter');
                    if (filter) {
                        xlAlertFilter = filter;
                        expandedAlertId = null;
                        _renderXlAlerts();
                    }
                    break;

                // ----- Xlarge: 展开/折叠告警 -----
                case 'toggle-alert':
                    e.preventDefault();
                    var tid = target.getAttribute('data-alert-id');
                    expandedAlertId = (expandedAlertId === tid) ? null : tid;
                    _renderXlAlerts();
                    break;

                // ----- Xlarge: 展开/折叠 MCP 服务器 -----
                case 'toggle-mcp':
                    e.preventDefault();
                    var name = target.getAttribute('data-name');
                    expandedMcpName = (expandedMcpName === name) ? null : name;
                    _renderXlMcp();
                    break;

                // ----- Xlarge: 标记单条已读 -----
                case 'mark-read':
                    e.preventDefault();
                    e.stopPropagation();
                    var readId = target.getAttribute('data-alert-id');
                    _doMarkRead(readId);
                    break;

                // ----- Xlarge: 全部已读 -----
                case 'mark-all-read':
                    e.preventDefault();
                    _doMarkAllRead();
                    break;

                // ----- Xlarge: 清除全部告警 -----
                case 'clear-all-alerts':
                    e.preventDefault();
                    _doClearAll();
                    break;

                // ----- 重试 -----
                case 'retry':
                    e.preventDefault();
                    loadData();
                    break;
            }
        }

        // ---------- 标记单条已读 ----------
        async function _doMarkRead(id) {
            try {
                await _markAlertRead(id);
                // 更新本地状态
                for (var i = 0; i < alerts.length; i++) {
                    if (alerts[i].id === id) {
                        alerts[i].read = true;
                        break;
                    }
                }
                if (typeof HermesClient !== 'undefined' && HermesClient.clearCache) {
                    HermesClient.clearCache(CACHE_ALERTS);
                }
                _showToast('已标为已读', 'success');
                _renderXlAlerts();
            } catch (e) {
                _showToast('操作失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ---------- 全部已读 ----------
        async function _doMarkAllRead() {
            try {
                for (var i = 0; i < alerts.length; i++) {
                    if (!alerts[i].read) {
                        await _markAlertRead(alerts[i].id);
                        alerts[i].read = true;
                    }
                }
                if (typeof HermesClient !== 'undefined' && HermesClient.clearCache) {
                    HermesClient.clearCache(CACHE_ALERTS);
                }
                _showToast('已全部标为已读', 'success');
                _renderXlAlerts();
            } catch (e) {
                _showToast('操作失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ---------- 清除全部 ----------
        async function _doClearAll() {
            try {
                await _clearAllAlerts();
                alerts = [];
                if (typeof HermesClient !== 'undefined' && HermesClient.clearCache) {
                    HermesClient.clearCache(CACHE_ALERTS);
                }
                _showToast('已清除全部告警', 'success');
                _renderXlAlerts();
            } catch (e) {
                _showToast('清除失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ========== 事件绑定 ==========
        _clickHandler = _handleClick;
        container.addEventListener('click', _clickHandler);

        // SSE 事件订阅
        if (typeof Bus !== 'undefined') {
            _sseHandlers['sse:alert.*'] = refresh;
            _sseHandlers['sse:system.*'] = refresh;
            Bus.on('sse:alert.*', refresh);
            Bus.on('sse:system.*', refresh);
        }

        // 初始加载数据
        loadData();

        // xlarge 模式启动自动刷新
        if (size === 'xlarge') {
            _startAutoRefresh();
        }

        // ========== 返回接口 ==========
        return {
            destroy: function() {
                // 移除 DOM 事件
                if (_clickHandler) container.removeEventListener('click', _clickHandler);

                // 停止自动刷新
                _stopAutoRefresh();

                // 取消 SSE 订阅
                if (typeof Bus !== 'undefined') {
                    Bus.off('sse:alert.*', refresh);
                    Bus.off('sse:system.*', refresh);
                }

                // 清空内容
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

        var sysStatus = null;
        var loaded = false;

        async function loadStatus() {
            try {
                sysStatus = await _fetchStatus();
                loaded = true;
                _renderEntry();
            } catch (e) {
                loaded = true;
                _renderEntry();
            }
        }

        function _renderEntry() {
            var statusCls = 'oc-header__status--unknown';
            if (sysStatus && sysStatus.status) {
                statusCls = _statusDotClass(sysStatus.status);
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="oc-small" data-action="open-overlay">' +
                        '<div class="oc-small__emoji">📊</div>' +
                        '<div class="oc-small__label">运维中心 <span class="oc-small__dot ' + statusCls + '"></span></div>' +
                    '</div>' +
                '</div>';
        }

        var _clickHandler = function(e) {
            var target = e.target.closest('[data-action="open-overlay"]');
            if (target && typeof CardOverlay !== 'undefined') {
                CardOverlay.open('ops-card');
            }
        };
        container.addEventListener('click', _clickHandler);

        _renderEntry();
        loadStatus();

        // SSE 事件订阅
        if (typeof Bus !== 'undefined') {
            var _sseRefresh = function() { loadStatus(); };
            Bus.on('sse:system.*', _sseRefresh);

            return {
                destroy: function() {
                    container.removeEventListener('click', _clickHandler);
                    if (typeof Bus !== 'undefined') {
                        Bus.off('sse:system.*', _sseRefresh);
                    }
                    container.innerHTML = '';
                },
                refresh: function() { loadStatus(); }
            };
        }

        return {
            destroy: function() {
                container.removeEventListener('click', _clickHandler);
                container.innerHTML = '';
            },
            refresh: function() { loadStatus(); }
        };
    }

    // ========== 注册卡片 ==========
    WidgetRegistry.register('ops-card', {
        type: 'stat',
        label: '运维中心',
        icon: '📊',
        description: '系统监控、MCP健康状态、告警管理',
        defaultSize: { w: 2, h: 1 },
        category: 'stats',
        mount: mount
    });

    WidgetRegistry.register('ops-entry', {
        type: 'entry',
        label: '运维中心入口',
        icon: '📊',
        description: '运维中心快速入口',
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
