;(function() {
  'use strict';

  /* ========== CSS ========== */
  var STYLE_ID = 'hermes-trash-card-css';
  var PFX = 'tc';

  function injectCSS() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = [
      '.' + PFX + '-root { width:100%; height:100%; display:flex; flex-direction:column; font-family:inherit; color:var(--text-primary,#e0e0e0); background:var(--card-bg,#1e1e2e); border-radius:12px; overflow:hidden; }',
      '.' + PFX + '-header { display:flex; align-items:center; justify-content:space-between; padding:10px 14px; background:var(--card-header-bg,#2a2a3e); border-bottom:1px solid var(--border,#333); flex-shrink:0; }',
      '.' + PFX + '-header-title { font-size:14px; font-weight:600; display:flex; align-items:center; gap:6px; }',
      '.' + PFX + '-header-title span.icon { font-size:16px; }',
      '.' + PFX + '-header-actions { display:flex; gap:6px; }',
      '.' + PFX + '-body { flex:1; overflow-y:auto; padding:12px; }',
      '.' + PFX + '-body::-webkit-scrollbar { width:4px; }',
      '.' + PFX + '-body::-webkit-scrollbar-thumb { background:var(--scrollbar,#555); border-radius:2px; }',

      /* Small */
      '.' + PFX + '-small { display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; gap:6px; transition:background .2s; position:relative; }',
      '.' + PFX + '-small:hover { background:var(--card-hover,#2a2a3e); }',
      '.' + PFX + '-small-icon { font-size:28px; }',
      '.' + PFX + '-small-label { font-size:12px; color:var(--text-secondary,#aaa); }',
      '.' + PFX + '-badge { position:absolute; top:6px; right:6px; background:var(--accent,#7c6ff7); color:#fff; font-size:10px; font-weight:700; min-width:18px; height:18px; border-radius:9px; display:flex; align-items:center; justify-content:center; padding:0 5px; }',

      /* Type badge */
      '.' + PFX + '-type-badge { display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600; flex-shrink:0; }',
      '.' + PFX + '-type-knowledge { background:rgba(52,152,219,.2); color:#3498db; }',
      '.' + PFX + '-type-rule { background:rgba(155,89,182,.2); color:#9b59b6; }',
      '.' + PFX + '-type-experience { background:rgba(46,204,113,.2); color:#2ecc71; }',
      '.' + PFX + '-type-skill { background:rgba(243,156,18,.2); color:#f39c12; }',
      '.' + PFX + '-type-memory { background:rgba(231,76,60,.2); color:#e74c3c; }',

      /* Type icons map */
      '.' + PFX + '-type-icon { font-size:11px; }',

      /* Trash item */
      '.' + PFX + '-trash-item { display:flex; align-items:center; gap:8px; padding:8px 10px; background:var(--item-bg,#252538); border-radius:8px; margin-bottom:6px; font-size:12px; transition:background .2s; }',
      '.' + PFX + '-trash-item:hover { background:var(--card-hover,#2a2a3e); }',
      '.' + PFX + '-trash-info { flex:1; min-width:0; display:flex; flex-direction:column; gap:2px; }',
      '.' + PFX + '-trash-name { font-weight:500; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
      '.' + PFX + '-trash-meta { font-size:10px; color:var(--text-secondary,#888); }',
      '.' + PFX + '-trash-actions { display:flex; gap:4px; flex-shrink:0; }',

      /* Buttons */
      '.' + PFX + '-btn { padding:5px 12px; border:none; border-radius:6px; font-size:11px; font-weight:500; cursor:pointer; transition:all .2s; }',
      '.' + PFX + '-btn-primary { background:var(--accent,#7c6ff7); color:#fff; }',
      '.' + PFX + '-btn-primary:hover { filter:brightness(1.15); }',
      '.' + PFX + '-btn-danger { background:#e74c3c; color:#fff; }',
      '.' + PFX + '-btn-danger:hover { filter:brightness(1.15); }',
      '.' + PFX + '-btn-secondary { background:var(--item-bg,#252538); color:var(--text-primary,#e0e0e0); }',
      '.' + PFX + '-btn-secondary:hover { background:var(--card-hover,#2a2a3e); }',
      '.' + PFX + '-btn-sm { padding:3px 8px; font-size:10px; }',
      '.' + PFX + '-btn-warning { background:rgba(243,156,18,.15); color:#f39c12; border:1px solid rgba(243,156,18,.3); }',
      '.' + PFX + '-btn-warning:hover { background:rgba(243,156,18,.25); }',

      /* Filters */
      '.' + PFX + '-filters { display:flex; gap:4px; padding:8px 12px; flex-shrink:0; flex-wrap:wrap; }',
      '.' + PFX + '-filter-btn { padding:3px 10px; border:1px solid var(--border,#333); border-radius:12px; background:transparent; color:var(--text-secondary,#aaa); font-size:10px; cursor:pointer; transition:all .2s; }',
      '.' + PFX + '-filter-btn:hover { border-color:var(--accent,#7c6ff7); color:var(--text-primary,#e0e0e0); }',
      '.' + PFX + '-filter-btn.active { background:var(--accent,#7c6ff7); border-color:var(--accent,#7c6ff7); color:#fff; }',

      /* Confirm bar */
      '.' + PFX + '-confirm-bar { display:flex; align-items:center; gap:8px; padding:8px 10px; border-radius:6px; margin-top:6px; font-size:11px; }',
      '.' + PFX + '-confirm-bar span { flex:1; }',
      '.' + PFX + '-confirm-restore { background:rgba(46,204,113,.1); border:1px solid rgba(46,204,113,.3); color:#2ecc71; }',
      '.' + PFX + '-confirm-delete { background:rgba(231,76,60,.1); border:1px solid rgba(231,76,60,.3); color:#e74c3c; }',
      '.' + PFX + '-confirm-empty { background:rgba(243,156,18,.1); border:1px solid rgba(243,156,18,.3); color:#f39c12; margin:8px 12px; }',

      /* States */
      '.' + PFX + '-loading, .' + PFX + '-error, .' + PFX + '-empty { display:flex; align-items:center; justify-content:center; flex:1; font-size:13px; color:var(--text-secondary,#aaa); }',
      '.' + PFX + '-error { color:#e74c3c; }',
      '.' + PFX + '-spinner { width:20px; height:20px; border:2px solid var(--border,#333); border-top-color:var(--accent,#7c6ff7); border-radius:50%; animation:' + PFX + '-spin .6s linear infinite; margin-right:8px; }',
      '@keyframes ' + PFX + '-spin { to { transform:rotate(360deg); } }'
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

  var TYPE_MAP = {
    knowledge: { label: '知识', icon: '\uD83D\uDCDA', cls: 'knowledge' },
    rule:      { label: '规则', icon: '\uD83D\uDCDC', cls: 'rule' },
    experience:{ label: '经验', icon: '\uD83D\uDCAA', cls: 'experience' },
    skill:     { label: '技能', icon: '\u26A1', cls: 'skill' },
    memory:    { label: '记忆', icon: '\uD83D\uDCBE', cls: 'memory' }
  };

  function getTypeInfo(type) {
    return TYPE_MAP[type] || { label: type || '未知', icon: '\u2753', cls: '' };
  }

  function formatTime(ts) {
    if (!ts) return '';
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  /* ========== Card Component ========== */
  function TrashCard(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.size = this.opts.size || 'medium';
    this.items = [];
    this.typeFilter = 'all';
    this.confirmRestore = null;
    this.confirmDelete = null;
    this.confirmEmpty = false;
    this.loading = false;
    this.error = null;
    this._subs = [];
    this._bound = {};
    injectCSS();
    this.render();
    this._bindEvents();
    this.fetchItems();
  }

  TrashCard.prototype._bindEvents = function() {
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

  TrashCard.prototype._handleAction = function(action, id) {
    switch (action) {
      case 'open-overlay':
        CardOverlay.open('trash-card', { w: 2, h: 2 });
        break;
      case 'filter-type':
        this.typeFilter = id;
        this.confirmRestore = null;
        this.confirmDelete = null;
        this.render();
        break;
      case 'confirm-restore':
        this.confirmRestore = id;
        this.confirmDelete = null;
        this.render();
        break;
      case 'do-restore':
        this.restoreItem(this.confirmRestore);
        this.confirmRestore = null;
        break;
      case 'cancel-restore':
        this.confirmRestore = null;
        this.render();
        break;
      case 'confirm-delete':
        this.confirmDelete = id;
        this.confirmRestore = null;
        this.render();
        break;
      case 'do-delete':
        this.permanentDelete(this.confirmDelete);
        this.confirmDelete = null;
        break;
      case 'cancel-delete':
        this.confirmDelete = null;
        this.render();
        break;
      case 'confirm-empty':
        this.confirmEmpty = true;
        this.render();
        break;
      case 'do-empty':
        this.emptyTrash();
        this.confirmEmpty = false;
        break;
      case 'cancel-empty':
        this.confirmEmpty = false;
        this.render();
        break;
    }
  };

  /* ========== Data ========== */
  TrashCard.prototype.fetchItems = function() {
    var self = this;
    this.loading = true;
    this.error = null;
    this.render();
    HermesClient.get('/api/trash').then(function(data) {
      self.items = Array.isArray(data) ? data : (data.items || []);
      self.loading = false;
      self.render();
    }).catch(function(err) {
      self.error = err.message || '加载回收站失败';
      self.loading = false;
      self.render();
    });
  };

  TrashCard.prototype.restoreItem = function(id) {
    var self = this;
    HermesClient.post('/api/trash/' + id + '/restore').then(function() {
      Bus.emit('notification', { type: 'success', message: '已恢复' });
      self.fetchItems();
    }).catch(function(err) {
      Bus.emit('notification', { type: 'error', message: '恢复失败: ' + (err.message || '') });
    });
  };

  TrashCard.prototype.permanentDelete = function(id) {
    var self = this;
    HermesClient.delete('/api/trash/' + id).then(function() {
      Bus.emit('notification', { type: 'success', message: '已永久删除' });
      self.fetchItems();
    }).catch(function(err) {
      Bus.emit('notification', { type: 'error', message: '删除失败: ' + (err.message || '') });
    });
  };

  TrashCard.prototype.emptyTrash = function() {
    var self = this;
    HermesClient.delete('/api/trash').then(function() {
      Bus.emit('notification', { type: 'success', message: '回收站已清空' });
      self.items = [];
      self.render();
    }).catch(function(err) {
      Bus.emit('notification', { type: 'error', message: '清空失败: ' + (err.message || '') });
    });
  };

  TrashCard.prototype._getFilteredItems = function() {
    var self = this;
    if (this.typeFilter === 'all') return this.items;
    return this.items.filter(function(item) { return item.type === self.typeFilter; });
  };

  /* ========== Render ========== */
  TrashCard.prototype.render = function() {
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

  TrashCard.prototype._renderHeader = function() {
    var h = el('div', PFX + '-header');
    h.innerHTML = '<div class="' + PFX + '-header-title"><span class="icon">\uD83D\uDDD1\uFE0F</span>回收站</div>';
    return h;
  };

  TrashCard.prototype._renderBody = function() {
    switch (this.size) {
      case 'small': return this._renderSmall();
      case 'medium': return this._renderMedium();
      case 'large': return this._renderLarge();
      case 'xlarge': return this._renderXLarge();
      default: return this._renderMedium();
    }
  };

  TrashCard.prototype._renderSmall = function() {
    var body = el('div', PFX + '-body ' + PFX + '-small');
    body.setAttribute('data-action', 'open-overlay');
    body.style.position = 'relative';
    var count = this.items.length;
    var badgeHtml = count > 0 ? '<div class="' + PFX + '-badge">' + count + '</div>' : '';
    body.innerHTML = '<div class="' + PFX + '-small-icon">\uD83D\uDDD1\uFE0F</div><div class="' + PFX + '-small-label">回收站</div>' + badgeHtml;
    return body;
  };

  TrashCard.prototype._renderMedium = function() {
    var body = el('div', PFX + '-body');
    var items = this.items.slice(0, 5);
    if (items.length === 0) {
      body.appendChild(el('div', PFX + '-empty', '回收站为空'));
      return body;
    }
    var self = this;
    items.forEach(function(item) {
      var info = getTypeInfo(item.type);
      var row = el('div', PFX + '-trash-item');
      row.innerHTML =
        '<span class="' + PFX + '-type-badge ' + PFX + '-type-' + info.cls + '"><span class="' + PFX + '-type-icon">' + info.icon + '</span>' + info.label + '</span>' +
        '<div class="' + PFX + '-trash-info"><div class="' + PFX + '-trash-name">' + (item.name || '未命名') + '</div><div class="' + PFX + '-trash-meta">' + formatTime(item.deleted_at) + '</div></div>';
      body.appendChild(row);
    });
    return body;
  };

  TrashCard.prototype._renderLarge = function() {
    var self = this;
    var root = el('div', '');

    /* Type filter */
    var filters = el('div', PFX + '-filters');
    var types = [
      { id: 'all', label: '全部' },
      { id: 'knowledge', label: '知识' },
      { id: 'rule', label: '规则' },
      { id: 'experience', label: '经验' },
      { id: 'skill', label: '技能' },
      { id: 'memory', label: '记忆' }
    ];
    types.forEach(function(t) {
      var btn = el('button', PFX + '-filter-btn' + (self.typeFilter === t.id ? ' active' : ''));
      btn.setAttribute('data-action', 'filter-type');
      btn.setAttribute('data-id', t.id);
      btn.textContent = t.label;
      filters.appendChild(btn);
    });
    root.appendChild(filters);

    /* Trash list */
    var body = el('div', PFX + '-body');
    var items = this._getFilteredItems();
    if (items.length === 0) {
      body.appendChild(el('div', PFX + '-empty', '回收站为空'));
    } else {
      items.forEach(function(item) {
        var info = getTypeInfo(item.type);
        var row = el('div', PFX + '-trash-item');
        row.innerHTML =
          '<span class="' + PFX + '-type-badge ' + PFX + '-type-' + info.cls + '"><span class="' + PFX + '-type-icon">' + info.icon + '</span>' + info.label + '</span>' +
          '<div class="' + PFX + '-trash-info"><div class="' + PFX + '-trash-name">' + (item.name || '未命名') + '</div><div class="' + PFX + '-trash-meta">' + formatTime(item.deleted_at) + '</div></div>' +
          '<div class="' + PFX + '-trash-actions">' +
            '<button class="' + PFX + '-btn ' + PFX + '-btn-primary ' + PFX + '-btn-sm" data-action="confirm-restore" data-id="' + item.id + '">恢复</button>' +
            '<button class="' + PFX + '-btn ' + PFX + '-btn-danger ' + PFX + '-btn-sm" data-action="confirm-delete" data-id="' + item.id + '">删除</button>' +
          '</div>';
        body.appendChild(row);
      });
    }
    root.appendChild(body);
    return root;
  };

  TrashCard.prototype._renderXLarge = function() {
    var self = this;
    var root = el('div', '');
    root.style.display = 'flex';
    root.style.flexDirection = 'column';
    root.style.flex = '1';

    /* Header with empty button */
    var header = el('div', PFX + '-header');
    header.innerHTML = '<div class="' + PFX + '-header-title"><span class="icon">\uD83D\uDDD1\uFE0F</span>回收站</div><div class="' + PFX + '-header-actions"><button class="' + PFX + '-btn ' + PFX + '-btn-warning" data-action="confirm-empty">清空回收站</button></div>';
    root.appendChild(header);

    /* Confirm empty bar */
    if (this.confirmEmpty) {
      var emptyBar = el('div', PFX + '-confirm-bar ' + PFX + '-confirm-empty');
      emptyBar.innerHTML = '<span>确定要清空回收站吗？所有项目将被永久删除，此操作不可撤销。</span>';
      var yesBtn = el('button', PFX + '-btn ' + PFX + '-btn-danger ' + PFX + '-btn-sm');
      yesBtn.setAttribute('data-action', 'do-empty');
      yesBtn.textContent = '确定清空';
      var noBtn = el('button', PFX + '-btn ' + PFX + '-btn-secondary ' + PFX + '-btn-sm');
      noBtn.setAttribute('data-action', 'cancel-empty');
      noBtn.textContent = '取消';
      emptyBar.appendChild(yesBtn);
      emptyBar.appendChild(noBtn);
      root.appendChild(emptyBar);
    }

    /* Type filter */
    var filters = el('div', PFX + '-filters');
    var types = [
      { id: 'all', label: '全部' },
      { id: 'knowledge', label: '知识' },
      { id: 'rule', label: '规则' },
      { id: 'experience', label: '经验' },
      { id: 'skill', label: '技能' },
      { id: 'memory', label: '记忆' }
    ];
    types.forEach(function(t) {
      var btn = el('button', PFX + '-filter-btn' + (self.typeFilter === t.id ? ' active' : ''));
      btn.setAttribute('data-action', 'filter-type');
      btn.setAttribute('data-id', t.id);
      btn.textContent = t.label;
      filters.appendChild(btn);
    });
    root.appendChild(filters);

    /* Trash list */
    var body = el('div', PFX + '-body');
    var items = this._getFilteredItems();
    if (items.length === 0) {
      body.appendChild(el('div', PFX + '-empty', '回收站为空'));
    } else {
      items.forEach(function(item) {
        var info = getTypeInfo(item.type);
        var row = el('div', PFX + '-trash-item');

        /* Main row */
        row.innerHTML =
          '<span class="' + PFX + '-type-badge ' + PFX + '-type-' + info.cls + '"><span class="' + PFX + '-type-icon">' + info.icon + '</span>' + info.label + '</span>' +
          '<div class="' + PFX + '-trash-info"><div class="' + PFX + '-trash-name">' + (item.name || '未命名') + '</div><div class="' + PFX + '-trash-meta">删除于 ' + formatTime(item.deleted_at) + '</div></div>' +
          '<div class="' + PFX + '-trash-actions">' +
            '<button class="' + PFX + '-btn ' + PFX + '-btn-primary ' + PFX + '-btn-sm" data-action="confirm-restore" data-id="' + item.id + '">恢复</button>' +
            '<button class="' + PFX + '-btn ' + PFX + '-btn-danger ' + PFX + '-btn-sm" data-action="confirm-delete" data-id="' + item.id + '">永久删除</button>' +
          '</div>';

        /* Restore confirm bar */
        if (self.confirmRestore === item.id) {
          var cbar = el('div', PFX + '-confirm-bar ' + PFX + '-confirm-restore');
          cbar.innerHTML = '<span>确定要恢复此项目吗？</span>';
          var yesR = el('button', PFX + '-btn ' + PFX + '-btn-primary ' + PFX + '-btn-sm');
          yesR.setAttribute('data-action', 'do-restore');
          yesR.textContent = '确定恢复';
          var noR = el('button', PFX + '-btn ' + PFX + '-btn-secondary ' + PFX + '-btn-sm');
          noR.setAttribute('data-action', 'cancel-restore');
          noR.textContent = '取消';
          cbar.appendChild(yesR);
          cbar.appendChild(noR);
          row.appendChild(cbar);
        }

        /* Delete confirm bar */
        if (self.confirmDelete === item.id) {
          var dbar = el('div', PFX + '-confirm-bar ' + PFX + '-confirm-delete');
          dbar.innerHTML = '<span>确定要永久删除此项目吗？此操作不可撤销！</span>';
          var yesD = el('button', PFX + '-btn ' + PFX + '-btn-danger ' + PFX + '-btn-sm');
          yesD.setAttribute('data-action', 'do-delete');
          yesD.textContent = '确定删除';
          var noD = el('button', PFX + '-btn ' + PFX + '-btn-secondary ' + PFX + '-btn-sm');
          noD.setAttribute('data-action', 'cancel-delete');
          noD.textContent = '取消';
          dbar.appendChild(yesD);
          dbar.appendChild(noD);
          row.appendChild(dbar);
        }

        body.appendChild(row);
      });
    }
    root.appendChild(body);
    return root;
  };

  /* ========== SSE ========== */
  TrashCard.prototype.subscribe = function() {
    var self = this;
    if (typeof DataService !== 'undefined' && DataService.subscribe) {
      var sub = DataService.subscribe('trash:updated', function() {
        self.fetchItems();
      });
      this._subs.push(sub);
    }
  };

  /* ========== Destroy ========== */
  TrashCard.prototype.destroy = function() {
    this.container.removeEventListener('click', this._bound._delegate);
    this._subs.forEach(function(s) { if (s && s.unsubscribe) s.unsubscribe(); });
    this._subs = [];
    this.container.innerHTML = '';
  };

  /* ========== Mount ========== */
  function mount(container, opts) {
    var card = new TrashCard(container, opts);
    card.subscribe();
    return card;
  }

  function mountEntry(container, opts) {
    var card = new TrashCard(container, Object.assign({}, opts, { size: 'small' }));
    card.subscribe();
    return card;
  }

  /* ========== Register ========== */
  if (typeof WidgetRegistry !== 'undefined') {
    WidgetRegistry.register('trash-card', {
      type: 'function',
      label: '回收站',
      icon: '\uD83D\uDDD1\uFE0F',
      defaultSize: { w: 2, h: 1 },
      category: 'functions',
      mount: mount
    });
    WidgetRegistry.register('trash-entry', {
      type: 'entry',
      label: '回收站入口',
      icon: '\uD83D\uDDD1\uFE0F',
      defaultSize: { w: 1, h: 1 },
      category: 'entries',
      mount: mountEntry
    });
  }

})();
