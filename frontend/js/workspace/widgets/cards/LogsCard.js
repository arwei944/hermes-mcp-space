;(function() {
  'use strict';

  /* ========== CSS ========== */
  var STYLE_ID = 'hermes-logs-card-css';
  var PFX = 'lc';

  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.' + PFX + '-root { width:100%; height:100%; display:flex; flex-direction:column; font-family:inherit; color:var(--text-primary,#e0e0e0); background:var(--card-bg,#1e1e2e); border-radius:12px; overflow:hidden; }',
      '.' + PFX + '-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--card-header-bg,#2a2a3e); border-bottom:1px solid var(--border,#333); flex-shrink:0; }',
      '.' + PFX + '-header-title { font-size:14px; font-weight:600; display:flex; align-items:center; gap:6px; }',
      '.' + PFX + '-header-title span.icon { font-size:16px; }',
      '.' + PFX + '-body { flex:1; overflow-y:auto; padding:12px; }',
      '.' + PFX + '-body::-webkit-scrollbar { width:4px; }',
      '.' + PFX + '-body::-webkit-scrollbar-thumb { background:var(--scrollbar,#555); border-radius:2px; }',

      /* Small */
      '.' + PFX + '-small { display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; gap:6px; transition:background .2s; position:relative; }',
      '.' + PFX + '-small:hover { background:var(--card-hover,#2a2a3e); }',
      '.' + PFX + '-small-icon { font-size:28px; }',
      '.' + PFX + '-small-label { font-size:12px; color:var(--text-secondary,#aaa); }',
      '.' + PFX + '-badge { position:absolute; top:6px; right:6px; background:#e74c3c; color:#fff; font-size:10px; font-weight:700; min-width:18px; height:18px; border-radius:9px; display:flex; align-items:center; justify-content:center; padding:0 5px; }',

      /* Log item */
      '.' + PFX + '-log-item { display:flex; align-items:flex-start; gap:8px; padding:6px 8px; border-bottom:1px solid var(--border,#333); font-size:11px; line-height:1.4; }',
      '.' + PFX + '-log-item:last-child { border-bottom:none; }',
      '.' + PFX + '-log-level { flex-shrink:0; padding:1px 6px; border-radius:3px; font-size:9px; font-weight:700; text-transform:uppercase; min-width:42px; text-align:center; }',
      '.' + PFX + '-level-DEBUG { background:rgba(150,150,150,.2); color:#999; }',
      '.' + PFX + '-level-INFO { background:rgba(52,152,219,.2); color:#3498db; }',
      '.' + PFX + '-level-WARNING { background:rgba(243,156,18,.2); color:#f39c12; }',
      '.' + PFX + '-level-ERROR { background:rgba(231,76,60,.2); color:#e74c3c; }',
      '.' + PFX + '-log-content { flex:1; min-width:0; }',
      '.' + PFX + '-log-msg { color:var(--text-primary,#e0e0e0); word-break:break-all; }',
      '.' + PFX + '-log-msg-trunc { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:100%; }',
      '.' + PFX + '-log-source { color:var(--text-secondary,#888); font-size:10px; margin-top:1px; }',
      '.' + PFX + '-log-time { flex-shrink:0; color:var(--text-secondary,#888); font-size:10px; white-space:nowrap; }',

      /* Filter buttons */
      '.' + PFX + '-filters { display:flex; gap:4px; padding:8px 12px; flex-shrink:0; flex-wrap:wrap; }',
      '.' + PFX + '-filter-btn { padding:3px 10px; border:1px solid var(--border,#333); border-radius:12px; background:transparent; color:var(--text-secondary,#aaa); font-size:10px; cursor:pointer; transition:all .2s; }',
      '.' + PFX + '-filter-btn:hover { border-color:var(--accent,#7c6ff7); color:var(--text-primary,#e0e0e0); }',
      '.' + PFX + '-filter-btn.active { background:var(--accent,#7c6ff7); border-color:var(--accent,#7c6ff7); color:#fff; }',

      /* Search */
      '.' + PFX + '-search { padding:0 12px 8px; flex-shrink:0; }',
      '.' + PFX + '-search-input { width:100%; padding:6px 10px; background:var(--input-bg,#1a1a2e); border:1px solid var(--border,#333); border-radius:6px; color:var(--text-primary,#e0e0e0); font-size:11px; outline:none; box-sizing:border-box; }',
      '.' + PFX + '-search-input:focus { border-color:var(--accent,#7c6ff7); }',
      '.' + PFX + '-search-input::placeholder { color:var(--text-secondary,#666); }',

      /* Buttons */
      '.' + PFX + '-btn { padding:5px 12px; border:none; border-radius:6px; font-size:11px; font-weight:500; cursor:pointer; transition:all .2s; }',
      '.' + PFX + '-btn-danger { background:#e74c3c; color:#fff; }',
      '.' + PFX + '-btn-danger:hover { filter:brightness(1.15); }',

      /* Header actions */
      '.' + PFX + '-header-actions { display:flex; gap:4px; }',

      /* States */
      '.' + PFX + '-loading, .' + PFX + '-error, .' + PFX + '-empty { display:flex; align-items:center; justify-content:center; flex:1; font-size:13px; color:var(--text-secondary,#aaa); }',
      '.' + PFX + '-error { color:#e74c3c; }',
      '.' + PFX + '-spinner { width:20px; height:20px; border:2px solid var(--border,#333); border-top-color:var(--accent,#7c6ff7); border-radius:50%; animation:' + PFX + '-spin .6s linear infinite; margin-right:8px; }',
      '@keyframes ' + PFX + '-spin { to { transform:rotate(360deg); } }',

      /* Auto-scroll indicator */
      '.' + PFX + '-scroll-bottom { position:absolute; bottom:8px; right:8px; width:28px; height:28px; border-radius:50%; background:var(--accent,#7c6ff7); color:#fff; border:none; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:14px; box-shadow:0 2px 8px rgba(0,0,0,.3); opacity:0; transition:opacity .3s; pointer-events:none; }',
      '.' + PFX + '-scroll-bottom.visible { opacity:1; pointer-events:auto; }'
    ].join('\n');
    document.head.appendChild(s);
  }

  /* ========== Helpers ========== */
  function $(sel, ctx) { return (ctx || document).querySelector(sel); }
  function $$(sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
  }
  function formatTimeFull(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0') + ':' + String(d.getSeconds()).padStart(2,'0');
  }
  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  /* ========== Card Component ========== */
  function LogsCard(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.size = this.opts.size || 'medium';
    this.logs = [];
    this.stats = { DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0 };
    this.levelFilter = 'ALL';
    this.searchQuery = '';
    this.loading = false;
    this.error = null;
    this.autoScroll = true;
    this._subs = [];
    this._bound = {};
    injectCSS();
    this.render();
    this._bindEvents();
    this.fetchLogs();
    this.fetchStats();
  }

  LogsCard.prototype._bindEvents = function() {
    var self = this;
    this._bound._delegate = function(e) {
      var t = e.target.closest('[data-action]');
      if (!t) return;
      var action = t.getAttribute('data-action');
      var id = t.getAttribute('data-id') || '';
      self._handleAction(action, id, e);
    };
    this.container.addEventListener('click', this._bound._delegate);
  };

  LogsCard.prototype._handleAction = function(action, id) {
    switch (action) {
      case 'open-overlay':
        CardOverlay.open('logs-card', { w: 2, h: 2 });
        break;
      case 'filter-level':
        this.levelFilter = id;
        this.render();
        break;
      case 'clear-logs':
        this.clearLogs();
        break;
      case 'scroll-bottom':
        this._scrollToBottom();
        break;
    }
  };

  /* ========== Data ========== */
  LogsCard.prototype.fetchLogs = function() {
    var self = this;
    this.loading = true;
    this.error = null;
    this.render();
    var params = '?limit=100';
    if (this.levelFilter !== 'ALL') params += '&level=' + this.levelFilter;
    HermesClient.get('/api/logs' + params).then(function(data) {
      self.logs = Array.isArray(data) ? data : (data.logs || []);
      self.loading = false;
      self.render();
      if (self.autoScroll) self._scrollToBottom();
    }).catch(function(err) {
      self.error = err.message || '加载日志失败';
      self.loading = false;
      self.render();
    });
  };

  LogsCard.prototype.fetchStats = function() {
    var self = this;
    HermesClient.get('/api/logs/stats').then(function(data) {
      self.stats = data || { DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0 };
      self.render();
    }).catch(function() {
      /* stats optional */
    });
  };

  LogsCard.prototype.clearLogs = function() {
    var self = this;
    /* Assuming a DELETE /api/logs endpoint for clearing */
    HermesClient.delete('/api/logs').then(function() {
      self.logs = [];
      self.stats = { DEBUG: 0, INFO: 0, WARNING: 0, ERROR: 0 };
      Bus.emit('notification', { type: 'success', message: '日志已清空' });
      self.render();
    }).catch(function(err) {
      Bus.emit('notification', { type: 'error', message: '清空失败: ' + (err.message || '') });
    });
  };

  LogsCard.prototype._getFilteredLogs = function() {
    var self = this;
    var logs = this.logs;
    if (this.levelFilter !== 'ALL') {
      logs = logs.filter(function(l) { return l.level === self.levelFilter; });
    }
    if (this.searchQuery) {
      var q = this.searchQuery.toLowerCase();
      logs = logs.filter(function(l) {
        return (l.message && l.message.toLowerCase().indexOf(q) !== -1) ||
               (l.source && l.source.toLowerCase().indexOf(q) !== -1);
      });
    }
    return logs;
  };

  LogsCard.prototype._scrollToBottom = function() {
    var body = $('.' + PFX + '-body', this.container);
    if (body) body.scrollTop = body.scrollHeight;
  };

  /* ========== Render ========== */
  LogsCard.prototype.render = function() {
    var c = this.container;
    c.innerHTML = '';
    var root = el('div', PFX + '-root');
    root.appendChild(this._renderHeader());
    if (this.loading) {
      root.appendChild(el('div', PFX + '-loading', '<div class="' + PFX + '-spinner"></div>加载中...'));
    } else if (this.error) {
      root.appendChild(el('div', PFX + '-error', this.error));
    } else {
      var body = this._renderBody();
      if (body) root.appendChild(body);
    }
    c.appendChild(root);
  };

  LogsCard.prototype._renderHeader = function() {
    var h = el('div', PFX + '-header');
    h.innerHTML = '<div class="' + PFX + '-header-title"><span class="icon">\uD83D\uDCDD</span>系统日志</div>';
    return h;
  };

  LogsCard.prototype._renderBody = function() {
    switch (this.size) {
      case 'small': return this._renderSmall();
      case 'medium': return this._renderMedium();
      case 'large': return this._renderLarge();
      case 'xlarge': return this._renderXLarge();
      default: return this._renderMedium();
    }
  };

  LogsCard.prototype._renderSmall = function() {
    var body = el('div', PFX + '-body ' + PFX + '-small');
    body.setAttribute('data-action', 'open-overlay');
    body.style.position = 'relative';
    var errCount = this.stats.ERROR || 0;
    var badgeHtml = errCount > 0 ? '<div class="' + PFX + '-badge">' + errCount + '</div>' : '';
    body.innerHTML = '<div class="' + PFX + '-small-icon">\uD83D\uDCDD</div><div class="' + PFX + '-small-label">日志</div>' + badgeHtml;
    return body;
  };

  LogsCard.prototype._renderMedium = function() {
    var body = el('div', PFX + '-body');
    var logs = this.logs.slice(-5);
    if (logs.length === 0) {
      body.appendChild(el('div', PFX + '-empty', '暂无日志'));
      return body;
    }
    logs.forEach(function(log) {
      var item = el('div', PFX + '-log-item');
      item.innerHTML =
        '<span class="' + PFX + '-log-level ' + PFX + '-level-' + (log.level || 'INFO') + '">' + (log.level || 'INFO') + '</span>' +
        '<div class="' + PFX + '-log-content"><div class="' + PFX + '-log-msg ' + PFX + '-log-msg-trunc">' + (log.message || '') + '</div></div>' +
        '<span class="' + PFX + '-log-time">' + formatTime(log.timestamp) + '</span>';
      body.appendChild(item);
    });
    return body;
  };

  LogsCard.prototype._renderLarge = function() {
    var self = this;
    var root = el('div', '');

    /* Level filter buttons */
    var filters = el('div', PFX + '-filters');
    var levels = ['ALL', 'INFO', 'WARNING', 'ERROR'];
    levels.forEach(function(lv) {
      var btn = el('button', PFX + '-filter-btn' + (self.levelFilter === lv ? ' active' : ''));
      btn.setAttribute('data-action', 'filter-level');
      btn.setAttribute('data-id', lv);
      btn.textContent = lv;
      filters.appendChild(btn);
    });
    root.appendChild(filters);

    /* Log list */
    var body = el('div', PFX + '-body');
    var logs = this._getFilteredLogs();
    if (logs.length === 0) {
      body.appendChild(el('div', PFX + '-empty', '暂无日志'));
    } else {
      logs.forEach(function(log) {
        var item = el('div', PFX + '-log-item');
        item.innerHTML =
          '<span class="' + PFX + '-log-level ' + PFX + '-level-' + (log.level || 'INFO') + '">' + (log.level || 'INFO') + '</span>' +
          '<div class="' + PFX + '-log-content">' +
            '<div class="' + PFX + '-log-msg">' + (log.message || '') + '</div>' +
            '<div class="' + PFX + '-log-source">' + (log.source || '') + '</div>' +
          '</div>' +
          '<span class="' + PFX + '-log-time">' + formatTime(log.timestamp) + '</span>';
        body.appendChild(item);
      });
    }
    root.appendChild(body);
    return root;
  };

  LogsCard.prototype._renderXLarge = function() {
    var self = this;
    var root = el('div', '');

    /* Header with clear button */
    var header = el('div', PFX + '-header');
    header.innerHTML = '<div class="' + PFX + '-header-title"><span class="icon">\uD83D\uDCDD</span>系统日志</div><div class="' + PFX + '-header-actions"><button class="' + PFX + '-btn ' + PFX + '-btn-danger" data-action="clear-logs">清空日志</button></div>';
    root.appendChild(header);

    /* Level filters */
    var filters = el('div', PFX + '-filters');
    var levels = ['ALL', 'DEBUG', 'INFO', 'WARNING', 'ERROR'];
    levels.forEach(function(lv) {
      var btn = el('button', PFX + '-filter-btn' + (self.levelFilter === lv ? ' active' : ''));
      btn.setAttribute('data-action', 'filter-level');
      btn.setAttribute('data-id', lv);
      btn.textContent = lv;
      filters.appendChild(btn);
    });
    root.appendChild(filters);

    /* Search */
    var search = el('div', PFX + '-search');
    var searchInput = el('input', PFX + '-search-input');
    searchInput.type = 'text';
    searchInput.placeholder = '搜索日志...';
    searchInput.value = this.searchQuery;
    searchInput.addEventListener('input', function(e) {
      self.searchQuery = e.target.value;
      self.render();
    });
    search.appendChild(searchInput);
    root.appendChild(search);

    /* Log list */
    var bodyWrap = el('div', '');
    bodyWrap.style.position = 'relative';
    bodyWrap.style.flex = '1';
    bodyWrap.style.overflow = 'hidden';
    var body = el('div', PFX + '-body');
    var logs = this._getFilteredLogs();
    if (logs.length === 0) {
      body.appendChild(el('div', PFX + '-empty', '暂无日志'));
    } else {
      logs.forEach(function(log) {
        var item = el('div', PFX + '-log-item');
        item.innerHTML =
          '<span class="' + PFX + '-log-level ' + PFX + '-level-' + (log.level || 'INFO') + '">' + (log.level || 'INFO') + '</span>' +
          '<div class="' + PFX + '-log-content">' +
            '<div class="' + PFX + '-log-msg">' + (log.message || '') + '</div>' +
            (log.source ? '<div class="' + PFX + '-log-source">' + log.source + '</div>' : '') +
          '</div>' +
          '<span class="' + PFX + '-log-time">' + formatTimeFull(log.timestamp) + '</span>';
        body.appendChild(item);
      });
    }
    bodyWrap.appendChild(body);

    /* Scroll to bottom button */
    var scrollBtn = el('button', PFX + '-scroll-bottom');
    scrollBtn.setAttribute('data-action', 'scroll-bottom');
    scrollBtn.textContent = '\u2193';
    scrollBtn.title = '滚动到底部';
    bodyWrap.appendChild(scrollBtn);

    root.appendChild(bodyWrap);
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.flex = '1';

    return root;
  };

  /* ========== SSE ========== */
  LogsCard.prototype.subscribe = function() {
    var self = this;
    if (typeof DataService !== 'undefined' && DataService.subscribe) {
      var sub = DataService.subscribe('logs:new', function(data) {
        if (data && data.log) {
          self.logs.push(data.log);
          if (self.logs.length > 200) self.logs = self.logs.slice(-200);
          if (data.log.level === 'ERROR') self.stats.ERROR = (self.stats.ERROR || 0) + 1;
          self.render();
          if (self.autoScroll && self.size === 'xlarge') self._scrollToBottom();
        }
      });
      this._subs.push(sub);
    }
  };

  /* ========== Destroy ========== */
  LogsCard.prototype.destroy = function() {
    this.container.removeEventListener('click', this._bound._delegate);
    this._subs.forEach(function(s) { if (s && s.unsubscribe) s.unsubscribe(); });
    this._subs = [];
    this.container.innerHTML = '';
  };

  /* ========== Mount ========== */
  function mount(container, opts) {
    var card = new LogsCard(container, opts);
    card.subscribe();
    return card;
  }

  function mountEntry(container, opts) {
    var card = new LogsCard(container, Object.assign({}, opts, { size: 'small' }));
    card.subscribe();
    return card;
  }

  /* ========== Register ========== */
  if (typeof WidgetRegistry !== 'undefined') {
    WidgetRegistry.register('logs-card', {
      type: 'data',
      label: '系统日志',
      icon: 'fileText',
      defaultSize: { w: 2, h: 1 },
      category: 'data',
      mount: mount
    });
    WidgetRegistry.register('logs-entry', {
      type: 'entry',
      label: '日志入口',
      icon: 'fileText',
      defaultSize: { w: 1, h: 1 },
      category: 'entries',
      mount: mountEntry
    });
  }

})();
