/**
 * KnowledgeCard.js - 统一知识库卡片
 *
 * 支持 4 种尺寸: small(1x1) / medium(2x1) / large(2x2) / xlarge(全屏覆盖)
 * xlarge 模式支持卡片内导航: 列表 <-> 详情 <-> 编辑/新建
 *
 * 依赖全局: WidgetRegistry, HermesClient, DataService, CardOverlay, Components, Bus
 */
var KnowledgeCard = (() => {
    'use strict';

    // ========== 常量 ==========
    var API_BASE = '/api/knowledge/items';
    var CACHE_KEY = 'knowledge:list';
    var MAX_ITEMS_SMALL = 0;       // small 不显示列表
    var MAX_ITEMS_MEDIUM = 5;
    var MAX_ITEMS_LARGE = 8;
    var TRUNCATE_TITLE_MEDIUM = 25;
    var TRUNCATE_SUMMARY_LARGE = 50;
    var SEARCH_DEBOUNCE_MS = 300;

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (document.getElementById('kc-styles')) return;
        var style = document.createElement('style');
        style.id = 'kc-styles';
        style.textContent = [
            /* ===== 基础布局 ===== */
            '.kc-root { display:flex; flex-direction:column; height:100%; overflow:hidden; }',
            '.kc-header { display:flex; align-items:center; gap:8px; padding:12px 14px 8px; flex-shrink:0; }',
            '.kc-header__icon { font-size:18px; flex-shrink:0; }',
            '.kc-header__title { font-size:var(--text-sm, 13px); font-weight:600; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }',
            '.kc-header__count { font-size:var(--text-xs, 11px); color:var(--text-tertiary); flex-shrink:0; }',
            '.kc-body { flex:1; overflow-y:auto; overflow-x:hidden; padding:0 14px 12px; -webkit-overflow-scrolling:touch; }',
            '.kc-body::-webkit-scrollbar { width:4px; }',
            '.kc-body::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:2px; }',

            /* ===== Small 尺寸 ===== */
            '.kc-small { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; cursor:pointer; padding:16px 8px; text-align:center; transition:opacity 0.15s; }',
            '.kc-small:hover { opacity:0.85; }',
            '.kc-small__emoji { font-size:32px; margin-bottom:6px; }',
            '.kc-small__label { font-size:var(--text-sm, 13px); font-weight:600; color:var(--text-primary); }',
            '.kc-small__count { font-size:var(--text-2xl, 20px); font-weight:700; color:var(--accent); margin-top:4px; }',
            '.kc-small__unit { font-size:var(--text-xs, 11px); color:var(--text-tertiary); margin-top:2px; }',

            /* ===== Medium 列表 ===== */
            '.kc-medium-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:2px; }',
            '.kc-medium-item { display:flex; align-items:center; justify-content:space-between; padding:6px 8px; border-radius:var(--radius-sm, 6px); cursor:pointer; transition:background 0.15s; gap:8px; }',
            '.kc-medium-item:hover { background:var(--bg-tertiary, rgba(0,0,0,0.04)); }',
            '.kc-medium-item__title { font-size:var(--text-sm, 13px); color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }',
            '.kc-medium-item__time { font-size:var(--text-xs, 11px); color:var(--text-tertiary); flex-shrink:0; }',

            /* ===== Large 搜索 & 筛选 ===== */
            '.kc-search { display:flex; align-items:center; gap:6px; padding:0 14px 8px; flex-shrink:0; }',
            '.kc-search__input { flex:1; padding:5px 10px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:var(--bg-secondary, #f5f5f5); color:var(--text-primary); font-size:var(--text-xs, 11px); outline:none; transition:border-color 0.15s; }',
            '.kc-search__input:focus { border-color:var(--accent); }',
            '.kc-search__input::placeholder { color:var(--text-tertiary); }',

            '.kc-filters { display:flex; gap:4px; padding:0 14px 8px; flex-shrink:0; overflow-x:auto; -webkit-overflow-scrolling:touch; }',
            '.kc-filters::-webkit-scrollbar { display:none; }',
            '.kc-filter-btn { padding:3px 10px; border:1px solid var(--border); border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-secondary); font-size:var(--text-xs, 11px); cursor:pointer; white-space:nowrap; transition:all 0.15s; }',
            '.kc-filter-btn:hover { border-color:var(--accent); color:var(--accent); }',
            '.kc-filter-btn.active { background:var(--accent); color:#fff; border-color:var(--accent); }',

            /* ===== Large 列表项 ===== */
            '.kc-large-list { display:flex; flex-direction:column; gap:6px; }',
            '.kc-large-item { padding:8px 10px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); cursor:pointer; transition:background 0.15s, box-shadow 0.15s; }',
            '.kc-large-item:hover { background:var(--bg-tertiary, rgba(0,0,0,0.03)); box-shadow:var(--shadow, 0 1px 3px rgba(0,0,0,0.08)); }',
            '.kc-large-item__top { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:4px; }',
            '.kc-large-item__title { font-size:var(--text-sm, 13px); font-weight:500; color:var(--text-primary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; }',
            '.kc-large-item__badge { font-size:10px; padding:1px 6px; border-radius:var(--radius-xs, 4px); background:var(--bg-tertiary, rgba(0,0,0,0.06)); color:var(--text-secondary); flex-shrink:0; }',
            '.kc-large-item__summary { font-size:var(--text-xs, 11px); color:var(--text-tertiary); margin-bottom:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }',
            '.kc-large-item__tags { display:flex; gap:4px; flex-wrap:wrap; }',

            /* ===== 标签 ===== */
            '.kc-tag { font-size:10px; padding:1px 6px; border-radius:var(--radius-xs, 4px); background:rgba(99,102,241,0.1); color:#6366f1; }',

            /* ===== Xlarge 全屏覆盖 ===== */
            '.kc-xl { display:flex; flex-direction:column; height:100%; }',
            '.kc-xl__header { display:flex; align-items:center; gap:10px; padding:16px 20px 12px; flex-shrink:0; border-bottom:1px solid var(--border); }',
            '.kc-xl__title { font-size:var(--text-lg, 16px); font-weight:700; color:var(--text-primary); flex:1; }',
            '.kc-xl__search { flex:1; max-width:320px; padding:7px 12px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:var(--bg-secondary); color:var(--text-primary); font-size:var(--text-sm); outline:none; transition:border-color 0.15s; }',
            '.kc-xl__search:focus { border-color:var(--accent); }',
            '.kc-xl__search::placeholder { color:var(--text-tertiary); }',
            '.kc-xl__body { flex:1; overflow-y:auto; padding:16px 20px; -webkit-overflow-scrolling:touch; }',

            /* ===== Xlarge 分类标签页 ===== */
            '.kc-xl__tabs { display:flex; gap:6px; padding:12px 20px 0; flex-shrink:0; overflow-x:auto; -webkit-overflow-scrolling:touch; }',
            '.kc-xl__tabs::-webkit-scrollbar { display:none; }',
            '.kc-xl__tab { padding:5px 14px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:transparent; color:var(--text-secondary); font-size:var(--text-sm); cursor:pointer; white-space:nowrap; transition:all 0.15s; }',
            '.kc-xl__tab:hover { border-color:var(--accent); color:var(--accent); }',
            '.kc-xl__tab.active { background:var(--accent); color:#fff; border-color:var(--accent); }',

            /* ===== Xlarge 列表卡片 ===== */
            '.kc-xl__list { display:flex; flex-direction:column; gap:10px; margin-top:12px; }',
            '.kc-xl__card { padding:14px 16px; border:1px solid var(--border); border-radius:var(--radius-sm, 8px); transition:background 0.15s, box-shadow 0.15s; cursor:pointer; }',
            '.kc-xl__card:hover { background:var(--bg-tertiary); box-shadow:var(--shadow); }',
            '.kc-xl__card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; margin-bottom:6px; }',
            '.kc-xl__card-title { font-size:var(--text-sm); font-weight:600; color:var(--text-primary); flex:1; line-height:1.4; }',
            '.kc-xl__card-actions { display:flex; gap:4px; flex-shrink:0; }',
            '.kc-xl__card-action { width:28px; height:28px; display:flex; align-items:center; justify-content:center; border:none; border-radius:var(--radius-xs, 4px); background:transparent; color:var(--text-tertiary); cursor:pointer; font-size:14px; transition:all 0.15s; }',
            '.kc-xl__card-action:hover { background:var(--bg-tertiary); color:var(--text-primary); }',
            '.kc-xl__card-action.danger:hover { background:rgba(239,68,68,0.1); color:var(--red, #ef4444); }',
            '.kc-xl__card-summary { font-size:var(--text-xs); color:var(--text-secondary); margin-bottom:8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; line-height:1.5; }',
            '.kc-xl__card-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }',
            '.kc-xl__card-badge { font-size:10px; padding:2px 8px; border-radius:var(--radius-xs, 4px); background:rgba(99,102,241,0.1); color:#6366f1; }',
            '.kc-xl__card-confidence { font-size:10px; padding:2px 8px; border-radius:var(--radius-xs, 4px); }',
            '.kc-xl__card-confidence.high { background:rgba(34,197,94,0.1); color:var(--green, #22c55e); }',
            '.kc-xl__card-confidence.medium { background:rgba(234,179,8,0.1); color:var(--yellow, #eab308); }',
            '.kc-xl__card-confidence.low { background:rgba(239,68,68,0.1); color:var(--red, #ef4444); }',
            '.kc-xl__card-time { font-size:10px; color:var(--text-tertiary); margin-left:auto; }',

            /* ===== Xlarge 详情视图 ===== */
            '.kc-detail { display:flex; flex-direction:column; height:100%; }',
            '.kc-detail__back { display:flex; align-items:center; gap:6px; padding:0 0 12px; cursor:pointer; color:var(--text-secondary); font-size:var(--text-sm); border:none; background:none; transition:color 0.15s; flex-shrink:0; }',
            '.kc-detail__back:hover { color:var(--text-primary); }',
            '.kc-detail__back-arrow { font-size:16px; }',
            '.kc-detail__title { font-size:var(--text-lg, 18px); font-weight:700; color:var(--text-primary); margin-bottom:16px; line-height:1.4; padding-bottom:12px; border-bottom:1px solid var(--border); }',
            '.kc-detail__content { font-size:var(--text-sm); color:var(--text-primary); line-height:1.7; margin-bottom:20px; flex:1; overflow-y:auto; }',
            '.kc-detail__content h1, .kc-detail__content h2, .kc-detail__content h3 { margin:16px 0 8px; font-weight:600; }',
            '.kc-detail__content h1 { font-size:var(--text-lg); }',
            '.kc-detail__content h2 { font-size:var(--text-sm); }',
            '.kc-detail__content h3 { font-size:var(--text-sm); }',
            '.kc-detail__content p { margin:8px 0; }',
            '.kc-detail__content code { font-family:var(--font-mono, monospace); background:var(--bg-tertiary); padding:1px 4px; border-radius:3px; font-size:0.9em; }',
            '.kc-detail__content pre { background:var(--bg-tertiary); padding:12px; border-radius:var(--radius-sm); overflow-x:auto; margin:8px 0; }',
            '.kc-detail__content pre code { background:none; padding:0; }',
            '.kc-detail__content ul, .kc-detail__content ol { padding-left:20px; margin:8px 0; }',
            '.kc-detail__content blockquote { border-left:3px solid var(--accent); padding-left:12px; margin:8px 0; color:var(--text-secondary); }',
            '.kc-detail__meta { display:grid; grid-template-columns:repeat(auto-fill, minmax(160px, 1fr)); gap:10px; margin-bottom:16px; padding:14px; background:var(--bg-secondary); border-radius:var(--radius-sm, 8px); }',
            '.kc-detail__meta-item { display:flex; flex-direction:column; gap:2px; }',
            '.kc-detail__meta-label { font-size:10px; color:var(--text-tertiary); text-transform:uppercase; letter-spacing:0.5px; }',
            '.kc-detail__meta-value { font-size:var(--text-sm); color:var(--text-primary); font-weight:500; }',
            '.kc-detail__tags { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }',
            '.kc-detail__actions { display:flex; gap:8px; padding-top:12px; border-top:1px solid var(--border); flex-shrink:0; }',

            /* ===== Xlarge 编辑/新建表单 ===== */
            '.kc-form { display:flex; flex-direction:column; gap:14px; }',
            '.kc-form__group { display:flex; flex-direction:column; gap:4px; }',
            '.kc-form__label { font-size:var(--text-xs); font-weight:600; color:var(--text-secondary); }',
            '.kc-form__input, .kc-form__textarea, .kc-form__select { padding:8px 12px; border:1px solid var(--border); border-radius:var(--radius-sm, 6px); background:var(--bg-secondary); color:var(--text-primary); font-size:var(--text-sm); outline:none; transition:border-color 0.15s; font-family:inherit; }',
            '.kc-form__input:focus, .kc-form__textarea:focus, .kc-form__select:focus { border-color:var(--accent); }',
            '.kc-form__textarea { min-height:120px; resize:vertical; line-height:1.6; }',
            '.kc-form__actions { display:flex; gap:8px; justify-content:flex-end; padding-top:8px; }',

            /* ===== 状态提示 ===== */
            '.kc-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; color:var(--text-tertiary); text-align:center; }',
            '.kc-empty__icon { font-size:40px; margin-bottom:10px; opacity:0.5; }',
            '.kc-empty__text { font-size:var(--text-sm); }',
            '.kc-error { display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px 20px; text-align:center; gap:10px; }',
            '.kc-error__icon { font-size:32px; }',
            '.kc-error__text { font-size:var(--text-sm); color:var(--red, #ef4444); }',
            '.kc-loading { display:flex; align-items:center; justify-content:center; padding:30px; }',
            '.kc-loading__spinner { width:24px; height:24px; border:2px solid var(--border); border-top-color:var(--accent); border-radius:50%; animation:kc-spin 0.6s linear infinite; }',
            '@keyframes kc-spin { to { transform:rotate(360deg); } }',

            /* ===== 骨架屏 ===== */
            '.kc-skeleton { display:flex; flex-direction:column; gap:8px; padding:12px 14px; }',
            '.kc-skeleton__line { height:12px; border-radius:4px; background:linear-gradient(90deg, var(--bg-tertiary) 25%, var(--bg-secondary) 50%, var(--bg-tertiary) 75%); background-size:200% 100%; animation:kc-shimmer 1.5s infinite; }',
            '.kc-skeleton__line.short { width:60%; }',
            '.kc-skeleton__line.medium { width:80%; }',
            '@keyframes kc-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }'
        ].join('\n');
        document.head.appendChild(style);
    }

    // ========== 工具函数 ==========

    /** HTML 转义 */
    function _esc(str) {
        if (!str) return '';
        return Components.escapeHtml ? Components.escapeHtml(str) : str.replace(/[&<>"']/g, function(c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    /** 截断文本 */
    function _truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '...' : str;
    }

    /** 格式化时间 */
    function _formatTime(ts) {
        if (!ts) return '';
        if (Components.formatDateTime) return Components.formatDateTime(ts);
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

    /** 渲染 Markdown */
    function _renderMd(text) {
        if (!text) return '';
        if (Components.renderMarkdown) return Components.renderMarkdown(text);
        return _esc(text).replace(/\n/g, '<br>');
    }

    /** 置信度样式类 */
    function _confidenceClass(confidence) {
        if (!confidence) return '';
        var c = String(confidence).toLowerCase();
        if (c === 'high' || c === '高') return 'high';
        if (c === 'medium' || c === '中') return 'medium';
        if (c === 'low' || c === '低') return 'low';
        return '';
    }

    /** 置信度显示文本 */
    function _confidenceLabel(confidence) {
        if (!confidence) return '';
        var c = String(confidence).toLowerCase();
        var map = { 'high': '高', 'medium': '中', 'low': '低', '高': '高', '中': '中', '低': '低' };
        return map[c] || confidence;
    }

    /** 从数据中提取唯一分类 */
    function _extractCategories(items) {
        var set = {};
        var result = [];
        if (!Array.isArray(items)) return result;
        for (var i = 0; i < items.length; i++) {
            var cat = items[i].category;
            if (cat && !set[cat]) {
                set[cat] = true;
                result.push(cat);
            }
        }
        return result;
    }

    /** 搜索过滤 */
    function _filterItems(items, keyword, category) {
        if (!Array.isArray(items)) return [];
        var result = [];
        var kw = (keyword || '').toLowerCase().trim();
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            // 分类过滤
            if (category && category !== '全部' && item.category !== category) continue;
            // 关键词搜索
            if (kw) {
                var haystack = ((item.title || '') + ' ' + (item.summary || '') + ' ' + (item.content || '') + ' ' + (item.tags || []).join(' ')).toLowerCase();
                if (haystack.indexOf(kw) === -1) continue;
            }
            result.push(item);
        }
        return result;
    }

    /** 骨架屏 HTML */
    function _skeletonHtml(lines) {
        var html = '<div class="kc-skeleton">';
        for (var i = 0; i < (lines || 4); i++) {
            var cls = i === lines - 1 ? ' kc-skeleton__line short' : (i % 2 === 0 ? '' : ' kc-skeleton__line medium');
            html += '<div class="kc-skeleton__line' + cls + '"></div>';
        }
        html += '</div>';
        return html;
    }

    /** 加载中 HTML */
    function _loadingHtml() {
        return '<div class="kc-loading"><div class="kc-loading__spinner"></div></div>';
    }

    /** 空状态 HTML */
    function _emptyHtml(text) {
        return '<div class="kc-empty"><div class="kc-empty__icon">📭</div><div class="kc-empty__text">' + (text || '暂无数据') + '</div></div>';
    }

    /** 错误状态 HTML */
    function _errorHtml(msg) {
        return '<div class="kc-error"><div class="kc-error__icon">⚠️</div><div class="kc-error__text">' + _esc(msg || '加载失败') + '</div><button class="btn btn-sm btn-ghost" data-action="retry">重试</button></div>';
    }

    /** 渲染标签列表 */
    function _renderTags(tags) {
        if (!Array.isArray(tags) || tags.length === 0) return '';
        return tags.map(function(t) { return '<span class="kc-tag">' + _esc(t) + '</span>'; }).join('');
    }

    // ========== 数据获取 ==========

    /** 获取知识列表（带缓存） */
    function _fetchItems() {
        return HermesClient.cachedGet(CACHE_KEY, function() {
            return HermesClient.get(API_BASE, { limit: 100 });
        });
    }

    /** 获取统计数据 */
    function _fetchStats() {
        return HermesClient.get(API_BASE + '/stats').catch(function() { return null; });
    }

    /** 获取单条详情 */
    function _fetchItem(id) {
        return HermesClient.get(API_BASE + '/' + id);
    }

    /** 创建知识条目 */
    function _createItem(data) {
        return HermesClient.post(API_BASE, data);
    }

    /** 更新知识条目 */
    function _updateItem(id, data) {
        return HermesClient.put(API_BASE + '/' + id, data);
    }

    /** 删除知识条目 */
    function _deleteItem(id) {
        return HermesClient.del(API_BASE + '/' + id);
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
        var items = [];
        var loading = true;
        var error = null;
        var searchKeyword = '';
        var activeCategory = '全部';
        var categories = [];
        var currentItemId = null;   // xlarge 详情视图当前查看的条目 ID
        var xlState = 'list';       // xlarge 状态: 'list' | 'detail' | 'edit' | 'create'
        var editItem = null;        // 编辑中的条目副本
        var debounceTimer = null;

        // 事件处理函数引用（用于清理）
        var _clickHandler = null;
        var _inputHandler = null;
        var _sseHandlers = {};

        // ---------- 数据加载 ----------
        async function loadData() {
            loading = true;
            error = null;
            _render();

            try {
                items = await _fetchItems();
                if (!Array.isArray(items)) items = [];
                categories = _extractCategories(items);
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
                items = await _fetchItems();
                if (!Array.isArray(items)) items = [];
                categories = _extractCategories(items);
                loading = false;
                error = null;
                _render();
            } catch (e) {
                error = e.message || '刷新失败';
                _render();
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

        // ========== Small 渲染 ==========
        function _renderSmall() {
            var count = items.length;
            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="kc-small" data-action="open-overlay">' +
                        '<div class="kc-small__emoji">📖</div>' +
                        '<div class="kc-small__label">知识库</div>' +
                        (loading
                            ? '<div class="kc-loading" style="padding:8px 0;"><div class="kc-loading__spinner" style="width:18px;height:18px;border-width:2px;"></div></div>'
                            : '<div class="kc-small__count">' + count + '</div>' +
                              '<div class="kc-small__unit">条知识</div>') +
                    '</div>' +
                '</div>';
        }

        // ========== Medium 渲染 ==========
        function _renderMedium() {
            if (loading) {
                container.innerHTML = '<div class="ws-widget"><div class="kc-header"><span class="kc-header__icon">📖</span><span class="kc-header__title">知识库</span></div>' + _skeletonHtml(5) + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="ws-widget"><div class="kc-header"><span class="kc-header__icon">📖</span><span class="kc-header__title">知识库</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            var list = items.slice(0, MAX_ITEMS_MEDIUM);
            var listHtml = '';
            if (list.length === 0) {
                listHtml = _emptyHtml('暂无知识条目');
            } else {
                listHtml = '<ul class="kc-medium-list">' +
                    list.map(function(item) {
                        return '<li class="kc-medium-item" data-action="open-detail" data-id="' + _esc(item.id) + '">' +
                            '<span class="kc-medium-item__title">' + _esc(_truncate(item.title, TRUNCATE_TITLE_MEDIUM)) + '</span>' +
                            '<span class="kc-medium-item__time">' + _formatTime(item.updated_at) + '</span>' +
                        '</li>';
                    }).join('') +
                '</ul>';
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="kc-header">' +
                        '<span class="kc-header__icon">📖</span>' +
                        '<span class="kc-header__title">知识库</span>' +
                        '<span class="kc-header__count">' + items.length + '条</span>' +
                    '</div>' +
                    '<div class="kc-body">' + listHtml + '</div>' +
                '</div>';
        }

        // ========== Large 渲染 ==========
        function _renderLarge() {
            if (loading) {
                container.innerHTML = '<div class="ws-widget"><div class="kc-header"><span class="kc-header__icon">📖</span><span class="kc-header__title">知识库</span></div>' + _skeletonHtml(6) + '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="ws-widget"><div class="kc-header"><span class="kc-header__icon">📖</span><span class="kc-header__title">知识库</span></div>' + _errorHtml(error) + '</div>';
                return;
            }

            var filtered = _filterItems(items, searchKeyword, activeCategory);
            var list = filtered.slice(0, MAX_ITEMS_LARGE);

            // 分类按钮
            var filterHtml = '<div class="kc-filters">' +
                '<button class="kc-filter-btn' + (activeCategory === '全部' ? ' active' : '') + '" data-action="filter" data-category="全部">全部</button>' +
                categories.map(function(cat) {
                    return '<button class="kc-filter-btn' + (activeCategory === cat ? ' active' : '') + '" data-action="filter" data-category="' + _esc(cat) + '">' + _esc(cat) + '</button>';
                }).join('') +
            '</div>';

            // 列表
            var listHtml = '';
            if (list.length === 0) {
                listHtml = _emptyHtml(searchKeyword ? '未找到匹配的知识条目' : '暂无知识条目');
            } else {
                listHtml = '<div class="kc-large-list">' +
                    list.map(function(item) {
                        return '<div class="kc-large-item" data-action="open-detail" data-id="' + _esc(item.id) + '">' +
                            '<div class="kc-large-item__top">' +
                                '<span class="kc-large-item__title">' + _esc(item.title) + '</span>' +
                                (item.category ? '<span class="kc-large-item__badge">' + _esc(item.category) + '</span>' : '') +
                            '</div>' +
                            '<div class="kc-large-item__summary">' + _esc(_truncate(item.summary, TRUNCATE_SUMMARY_LARGE)) + '</div>' +
                            '<div class="kc-large-item__tags">' + _renderTags(item.tags) + '</div>' +
                        '</div>';
                    }).join('') +
                '</div>';
            }

            container.innerHTML =
                '<div class="ws-widget">' +
                    '<div class="kc-header">' +
                        '<span class="kc-header__icon">📖</span>' +
                        '<span class="kc-header__title">知识库</span>' +
                        '<span class="kc-header__count">' + items.length + '条</span>' +
                    '</div>' +
                    '<div class="kc-search">' +
                        '<input class="kc-search__input" type="text" placeholder="搜索知识..." value="' + _esc(searchKeyword) + '" data-role="search-input" />' +
                    '</div>' +
                    filterHtml +
                    '<div class="kc-body">' + listHtml + '</div>' +
                '</div>';
        }

        // ========== Xlarge 渲染 ==========
        function _renderXlarge() {
            switch (xlState) {
                case 'list':   _renderXlList(); break;
                case 'detail': _renderXlDetail(); break;
                case 'edit':   _renderXlEdit(); break;
                case 'create': _renderXlCreate(); break;
            }
        }

        // ----- Xlarge 列表视图 -----
        function _renderXlList() {
            if (loading) {
                container.innerHTML = '<div class="kc-xl">' +
                    '<div class="kc-xl__header"><span class="kc-xl__title">知识库</span></div>' +
                    _loadingHtml() +
                '</div>';
                return;
            }
            if (error) {
                container.innerHTML = '<div class="kc-xl">' +
                    '<div class="kc-xl__header"><span class="kc-xl__title">知识库</span></div>' +
                    _errorHtml(error) +
                '</div>';
                return;
            }

            var filtered = _filterItems(items, searchKeyword, activeCategory);

            // 分类标签页
            var tabsHtml = '<div class="kc-xl__tabs">' +
                '<button class="kc-xl__tab' + (activeCategory === '全部' ? ' active' : '') + '" data-action="filter" data-category="全部">全部</button>' +
                categories.map(function(cat) {
                    return '<button class="kc-xl__tab' + (activeCategory === cat ? ' active' : '') + '" data-action="filter" data-category="' + _esc(cat) + '">' + _esc(cat) + '</button>';
                }).join('') +
            '</div>';

            // 列表
            var listHtml = '';
            if (filtered.length === 0) {
                listHtml = _emptyHtml(searchKeyword ? '未找到匹配的知识条目' : '暂无知识条目，点击右上角新建');
            } else {
                listHtml = '<div class="kc-xl__list">' +
                    filtered.map(function(item) {
                        var confCls = _confidenceClass(item.confidence);
                        return '<div class="kc-xl__card" data-action="view-item" data-id="' + _esc(item.id) + '">' +
                            '<div class="kc-xl__card-top">' +
                                '<span class="kc-xl__card-title">' + _esc(item.title) + '</span>' +
                                '<div class="kc-xl__card-actions">' +
                                    '<button class="kc-xl__card-action" data-action="edit-item" data-id="' + _esc(item.id) + '" title="编辑">✏️</button>' +
                                    '<button class="kc-xl__card-action danger" data-action="delete-item" data-id="' + _esc(item.id) + '" title="删除">🗑️</button>' +
                                '</div>' +
                            '</div>' +
                            (item.summary ? '<div class="kc-xl__card-summary">' + _esc(item.summary) + '</div>' : '') +
                            '<div class="kc-xl__card-meta">' +
                                (item.category ? '<span class="kc-xl__card-badge">' + _esc(item.category) + '</span>' : '') +
                                (item.confidence ? '<span class="kc-xl__card-confidence ' + confCls + '">置信度: ' + _esc(_confidenceLabel(item.confidence)) + '</span>' : '') +
                                _renderTags(item.tags) +
                                '<span class="kc-xl__card-time">' + _formatTime(item.updated_at) + '</span>' +
                            '</div>' +
                        '</div>';
                    }).join('') +
                '</div>';
            }

            container.innerHTML =
                '<div class="kc-xl">' +
                    '<div class="kc-xl__header">' +
                        '<span class="kc-xl__title">知识库</span>' +
                        '<input class="kc-xl__search" type="text" placeholder="搜索知识..." value="' + _esc(searchKeyword) + '" data-role="search-input" />' +
                        '<button class="btn btn-sm btn-primary" data-action="create-item">新建</button>' +
                    '</div>' +
                    tabsHtml +
                    '<div class="kc-xl__body">' + listHtml + '</div>' +
                '</div>';
        }

        // ----- Xlarge 详情视图 -----
        function _renderXlDetail() {
            var item = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].id === currentItemId) { item = items[i]; break; }
            }

            if (!item) {
                // 条目不在缓存中，尝试从 API 获取
                container.innerHTML = '<div class="kc-xl"><div class="kc-xl__body">' + _loadingHtml() + '</div></div>';
                _fetchItem(currentItemId).then(function(data) {
                    if (data) {
                        items.push(data);
                        _renderXlDetail();
                    } else {
                        container.innerHTML = '<div class="kc-xl"><div class="kc-xl__body">' + _errorHtml('知识条目不存在') + '</div></div>';
                    }
                }).catch(function() {
                    container.innerHTML = '<div class="kc-xl"><div class="kc-xl__body">' + _errorHtml('加载详情失败') + '</div></div>';
                });
                return;
            }

            container.innerHTML =
                '<div class="kc-xl">' +
                    '<div class="kc-xl__body">' +
                        '<div class="kc-detail">' +
                            '<button class="kc-detail__back" data-action="back-to-list"><span class="kc-detail__back-arrow">←</span> 返回列表</button>' +
                            '<div class="kc-detail__title">' + _esc(item.title) + '</div>' +
                            '<div class="kc-detail__content">' + _renderMd(item.content) + '</div>' +
                            '<div class="kc-detail__meta">' +
                                '<div class="kc-detail__meta-item"><span class="kc-detail__meta-label">分类</span><span class="kc-detail__meta-value">' + _esc(item.category || '-') + '</span></div>' +
                                '<div class="kc-detail__meta-item"><span class="kc-detail__meta-label">置信度</span><span class="kc-detail__meta-value">' + _esc(_confidenceLabel(item.confidence) || '-') + '</span></div>' +
                                '<div class="kc-detail__meta-item"><span class="kc-detail__meta-label">来源</span><span class="kc-detail__meta-value">' + _esc(item.source || '-') + '</span></div>' +
                                '<div class="kc-detail__meta-item"><span class="kc-detail__meta-label">创建时间</span><span class="kc-detail__meta-value">' + _formatTime(item.created_at) + '</span></div>' +
                                '<div class="kc-detail__meta-item"><span class="kc-detail__meta-label">更新时间</span><span class="kc-detail__meta-value">' + _formatTime(item.updated_at) + '</span></div>' +
                            '</div>' +
                            (Array.isArray(item.tags) && item.tags.length > 0
                                ? '<div class="kc-detail__tags">' + _renderTags(item.tags) + '</div>'
                                : '') +
                            '<div class="kc-detail__actions">' +
                                '<button class="btn btn-sm btn-primary" data-action="edit-item" data-id="' + _esc(item.id) + '">编辑</button>' +
                                '<button class="btn btn-sm btn-danger" data-action="delete-item" data-id="' + _esc(item.id) + '">删除</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }

        // ----- Xlarge 编辑视图 -----
        function _renderXlEdit() {
            if (!editItem) {
                xlState = 'list';
                _renderXlarge();
                return;
            }

            container.innerHTML =
                '<div class="kc-xl">' +
                    '<div class="kc-xl__body">' +
                        '<div class="kc-detail">' +
                            '<button class="kc-detail__back" data-action="back-to-list"><span class="kc-detail__back-arrow">←</span> 返回列表</button>' +
                            '<div class="kc-detail__title">编辑知识条目</div>' +
                            '<div class="kc-form">' +
                                '<div class="kc-form__group"><label class="kc-form__label">标题</label><input class="kc-form__input" type="text" data-field="title" value="' + _esc(editItem.title || '') + '" /></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">分类</label><input class="kc-form__input" type="text" data-field="category" value="' + _esc(editItem.category || '') + '" placeholder="例如: 技术、产品、运营" /></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">摘要</label><textarea class="kc-form__textarea" data-field="summary" rows="2">' + _esc(editItem.summary || '') + '</textarea></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">内容（支持 Markdown）</label><textarea class="kc-form__textarea" data-field="content" rows="8">' + _esc(editItem.content || '') + '</textarea></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">标签（逗号分隔）</label><input class="kc-form__input" type="text" data-field="tags" value="' + _esc((editItem.tags || []).join(', ')) + '" placeholder="标签1, 标签2" /></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">置信度</label><select class="kc-form__select" data-field="confidence"><option value="high"' + (editItem.confidence === 'high' ? ' selected' : '') + '>高</option><option value="medium"' + (editItem.confidence === 'medium' ? ' selected' : '') + '>中</option><option value="low"' + (editItem.confidence === 'low' ? ' selected' : '') + '>低</option></select></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">来源</label><input class="kc-form__input" type="text" data-field="source" value="' + _esc(editItem.source || '') + '" /></div>' +
                                '<div class="kc-form__actions">' +
                                    '<button class="btn btn-sm btn-ghost" data-action="cancel-edit">取消</button>' +
                                    '<button class="btn btn-sm btn-primary" data-action="save-edit">保存</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }

        // ----- Xlarge 新建视图 -----
        function _renderXlCreate() {
            container.innerHTML =
                '<div class="kc-xl">' +
                    '<div class="kc-xl__body">' +
                        '<div class="kc-detail">' +
                            '<button class="kc-detail__back" data-action="back-to-list"><span class="kc-detail__back-arrow">←</span> 返回列表</button>' +
                            '<div class="kc-detail__title">新建知识条目</div>' +
                            '<div class="kc-form">' +
                                '<div class="kc-form__group"><label class="kc-form__label">标题 *</label><input class="kc-form__input" type="text" data-field="title" placeholder="请输入知识标题" /></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">分类</label><input class="kc-form__input" type="text" data-field="category" placeholder="例如: 技术、产品、运营" /></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">摘要</label><textarea class="kc-form__textarea" data-field="summary" rows="2" placeholder="简要描述这条知识..."></textarea></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">内容（支持 Markdown）</label><textarea class="kc-form__textarea" data-field="content" rows="8" placeholder="详细内容..."></textarea></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">标签（逗号分隔）</label><input class="kc-form__input" type="text" data-field="tags" placeholder="标签1, 标签2" /></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">置信度</label><select class="kc-form__select" data-field="confidence"><option value="high">高</option><option value="medium" selected>中</option><option value="low">低</option></select></div>' +
                                '<div class="kc-form__group"><label class="kc-form__label">来源</label><input class="kc-form__input" type="text" data-field="source" placeholder="知识来源" /></div>' +
                                '<div class="kc-form__actions">' +
                                    '<button class="btn btn-sm btn-ghost" data-action="cancel-create">取消</button>' +
                                    '<button class="btn btn-sm btn-primary" data-action="save-create">创建</button>' +
                                '</div>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }

        // ========== 表单数据收集 ==========

        function _collectFormData() {
            var data = {};
            var fields = container.querySelectorAll('[data-field]');
            for (var i = 0; i < fields.length; i++) {
                var field = fields[i];
                var key = field.getAttribute('data-field');
                var val = field.value;
                if (key === 'tags') {
                    // 标签字段: 逗号分隔转数组
                    data[key] = val ? val.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [];
                } else {
                    data[key] = val;
                }
            }
            return data;
        }

        // ========== 事件处理 ==========

        function _handleClick(e) {
            var target = e.target.closest('[data-action]');
            if (!target) return;

            var action = target.getAttribute('data-action');
            var id = target.getAttribute('data-id');
            var category = target.getAttribute('data-category');

            switch (action) {
                // ----- 通用: 打开覆盖层 -----
                case 'open-overlay':
                    e.preventDefault();
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.open('knowledge-card');
                    }
                    break;

                // ----- Medium/Large: 打开详情覆盖层 -----
                case 'open-detail':
                    e.preventDefault();
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.open('knowledge-card', { itemId: id });
                    }
                    break;

                // ----- Large: 分类筛选 -----
                case 'filter':
                    e.preventDefault();
                    activeCategory = category || '全部';
                    _render();
                    break;

                // ----- Xlarge: 查看条目详情（卡片内导航） -----
                case 'view-item':
                    e.preventDefault();
                    e.stopPropagation();
                    currentItemId = id;
                    xlState = 'detail';
                    if (typeof CardOverlay !== 'undefined') {
                        CardOverlay.pushView(function(body) {
                            // pushView 会替换 body 内容，但我们的 xlarge 模式
                            // 直接在 container 内切换状态，不需要 pushView
                        });
                    }
                    _renderXlarge();
                    break;

                // ----- Xlarge: 编辑条目 -----
                case 'edit-item':
                    e.preventDefault();
                    e.stopPropagation();
                    var editTarget = null;
                    for (var i = 0; i < items.length; i++) {
                        if (items[i].id === id) { editTarget = items[i]; break; }
                    }
                    if (editTarget) {
                        editItem = JSON.parse(JSON.stringify(editTarget));
                        currentItemId = id;
                        xlState = 'edit';
                        _renderXlarge();
                    }
                    break;

                // ----- Xlarge: 删除条目 -----
                case 'delete-item':
                    e.preventDefault();
                    e.stopPropagation();
                    _confirmDelete(id);
                    break;

                // ----- Xlarge: 新建条目 -----
                case 'create-item':
                    e.preventDefault();
                    editItem = null;
                    xlState = 'create';
                    _renderXlarge();
                    break;

                // ----- Xlarge: 返回列表 -----
                case 'back-to-list':
                    e.preventDefault();
                    // 如果在 overlay 内使用了 pushView，先 popView
                    if (typeof CardOverlay !== 'undefined' && CardOverlay.isOpen()) {
                        CardOverlay.popView();
                    }
                    xlState = 'list';
                    currentItemId = null;
                    editItem = null;
                    _renderXlarge();
                    break;

                // ----- Xlarge: 取消编辑 -----
                case 'cancel-edit':
                    e.preventDefault();
                    xlState = 'detail';
                    _renderXlarge();
                    break;

                // ----- Xlarge: 保存编辑 -----
                case 'save-edit':
                    e.preventDefault();
                    _handleSaveEdit();
                    break;

                // ----- Xlarge: 取消新建 -----
                case 'cancel-create':
                    e.preventDefault();
                    xlState = 'list';
                    _renderXlarge();
                    break;

                // ----- Xlarge: 保存新建 -----
                case 'save-create':
                    e.preventDefault();
                    _handleSaveCreate();
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

        // ---------- 确认删除 ----------
        function _confirmDelete(id) {
            var item = null;
            for (var i = 0; i < items.length; i++) {
                if (items[i].id === id) { item = items[i]; break; }
            }
            if (!item) return;

            var msg = '确定要删除知识条目「' + (item.title || '未命名') + '」吗？此操作不可撤销。';
            if (typeof Components !== 'undefined' && Components.showToast) {
                // 使用 toast + 内联确认方式
                _showDeleteConfirm(id, msg);
            } else if (confirm) {
                // 回退到原生 confirm
                if (confirm(msg)) {
                    _doDelete(id);
                }
            }
        }

        // ---------- 内联删除确认 ----------
        function _showDeleteConfirm(id, msg) {
            // 在容器顶部插入确认条
            var confirmBar = document.createElement('div');
            confirmBar.className = 'kc-delete-confirm';
            confirmBar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:var(--radius-sm,6px);margin-bottom:10px;font-size:var(--text-xs);color:var(--text-primary);';
            confirmBar.innerHTML =
                '<span style="flex:1;">' + _esc(msg) + '</span>' +
                '<button class="btn btn-sm btn-danger" data-action="confirm-delete" data-id="' + _esc(id) + '">确认删除</button>' +
                '<button class="btn btn-sm btn-ghost" data-action="cancel-delete">取消</button>';

            var body = container.querySelector('.kc-xl__body');
            if (body) {
                body.insertBefore(confirmBar, body.firstChild);
            }

            // 自动消失定时器
            var autoClose = setTimeout(function() {
                if (confirmBar.parentNode) confirmBar.parentNode.removeChild(confirmBar);
            }, 10000);

            // 绑定确认/取消事件
            confirmBar.addEventListener('click', function(ev) {
                var btn = ev.target.closest('[data-action]');
                if (!btn) return;
                var act = btn.getAttribute('data-action');
                clearTimeout(autoClose);
                if (act === 'confirm-delete') {
                    _doDelete(btn.getAttribute('data-id'));
                }
                if (confirmBar.parentNode) confirmBar.parentNode.removeChild(confirmBar);
            });
        }

        // ---------- 执行删除 ----------
        async function _doDelete(id) {
            try {
                await _deleteItem(id);
                // 从本地列表移除
                items = items.filter(function(item) { return item.id !== id; });
                categories = _extractCategories(items);
                // 清除缓存
                if (typeof HermesClient !== 'undefined' && HermesClient.clearCache) {
                    HermesClient.clearCache(CACHE_KEY);
                }
                if (Components.showToast) Components.showToast('删除成功', 'success');
                // 返回列表
                xlState = 'list';
                currentItemId = null;
                editItem = null;
                _renderXlarge();
            } catch (e) {
                if (Components.showToast) Components.showToast('删除失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ---------- 保存编辑 ----------
        async function _handleSaveEdit() {
            var data = _collectFormData();
            if (!data.title || !data.title.trim()) {
                if (Components.showToast) Components.showToast('标题不能为空', 'error');
                return;
            }

            try {
                var updated = await _updateItem(currentItemId, data);
                // 更新本地列表
                for (var i = 0; i < items.length; i++) {
                    if (items[i].id === currentItemId) {
                        items[i] = Object.assign({}, items[i], updated || data);
                        break;
                    }
                }
                categories = _extractCategories(items);
                // 清除缓存
                if (typeof HermesClient !== 'undefined' && HermesClient.clearCache) {
                    HermesClient.clearCache(CACHE_KEY);
                }
                if (Components.showToast) Components.showToast('保存成功', 'success');
                editItem = null;
                xlState = 'detail';
                _renderXlarge();
            } catch (e) {
                if (Components.showToast) Components.showToast('保存失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ---------- 保存新建 ----------
        async function _handleSaveCreate() {
            var data = _collectFormData();
            if (!data.title || !data.title.trim()) {
                if (Components.showToast) Components.showToast('标题不能为空', 'error');
                return;
            }

            try {
                var created = await _createItem(data);
                // 添加到本地列表
                if (created) {
                    items.unshift(created);
                } else {
                    items.unshift(data);
                }
                categories = _extractCategories(items);
                // 清除缓存
                if (typeof HermesClient !== 'undefined' && HermesClient.clearCache) {
                    HermesClient.clearCache(CACHE_KEY);
                }
                if (Components.showToast) Components.showToast('创建成功', 'success');
                xlState = 'list';
                editItem = null;
                _renderXlarge();
            } catch (e) {
                if (Components.showToast) Components.showToast('创建失败: ' + (e.message || '未知错误'), 'error');
            }
        }

        // ========== 事件绑定 ==========
        _clickHandler = _handleClick;
        _inputHandler = _handleInput;
        container.addEventListener('click', _clickHandler);
        container.addEventListener('input', _inputHandler);

        // SSE 事件订阅
        if (typeof Bus !== 'undefined') {
            _sseHandlers['sse:knowledge.updated'] = refresh;
            _sseHandlers['sse:knowledge.created'] = refresh;
            _sseHandlers['sse:knowledge.deleted'] = refresh;
            Bus.on('sse:knowledge.updated', refresh);
            Bus.on('sse:knowledge.created', refresh);
            Bus.on('sse:knowledge.deleted', refresh);
        }

        // 初始加载数据
        loadData();

        // ========== 返回接口 ==========
        return {
            destroy: function() {
                // 移除 DOM 事件
                if (_clickHandler) container.removeEventListener('click', _clickHandler);
                if (_inputHandler) container.removeEventListener('input', _inputHandler);

                // 取消搜索防抖
                if (debounceTimer) clearTimeout(debounceTimer);

                // 取消 SSE 订阅
                if (typeof Bus !== 'undefined') {
                    Bus.off('sse:knowledge.updated', refresh);
                    Bus.off('sse:knowledge.created', refresh);
                    Bus.off('sse:knowledge.deleted', refresh);
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

        var count = 0;
        var loaded = false;

        async function loadCount() {
            try {
                var data = await _fetchItems();
                if (Array.isArray(data)) {
                    count = data.length;
                } else if (data && typeof data.total === 'number') {
                    count = data.total;
                }
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
                    '<div class="kc-small" data-action="open-overlay">' +
                        '<div class="kc-small__emoji">📖</div>' +
                        '<div class="kc-small__label">知识库</div>' +
                        (loaded
                            ? '<div class="kc-small__count">' + count + '</div><div class="kc-small__unit">条知识</div>'
                            : '<div class="kc-loading" style="padding:8px 0;"><div class="kc-loading__spinner" style="width:18px;height:18px;border-width:2px;"></div></div>') +
                    '</div>' +
                '</div>';
        }

        var _clickHandler = function(e) {
            var target = e.target.closest('[data-action="open-overlay"]');
            if (target && typeof CardOverlay !== 'undefined') {
                CardOverlay.open('knowledge-card');
            }
        };
        container.addEventListener('click', _clickHandler);

        _renderEntry();
        loadCount();

        // SSE 事件订阅
        if (typeof Bus !== 'undefined') {
            var _sseRefresh = function() { loadCount(); };
            Bus.on('sse:knowledge.created', _sseRefresh);
            Bus.on('sse:knowledge.deleted', _sseRefresh);

            return {
                destroy: function() {
                    container.removeEventListener('click', _clickHandler);
                    if (typeof Bus !== 'undefined') {
                        Bus.off('sse:knowledge.created', _sseRefresh);
                        Bus.off('sse:knowledge.deleted', _sseRefresh);
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
    WidgetRegistry.register('knowledge-card', {
        type: 'data',
        label: '知识库',
        icon: '📖',
        description: '知识库管理，支持查看/创建/编辑/删除知识条目',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount: mount
    });

    WidgetRegistry.register('knowledge-entry', {
        type: 'entry',
        label: '知识库入口',
        icon: '📖',
        description: '知识库快速入口',
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
