;(function() {
  'use strict';

  /* ========== CSS ========== */
  var STYLE_ID = 'hermes-settings-card-css';
  var PFX = 'stc';

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
      '.' + PFX + '-small { display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; gap:6px; transition:background .2s; }',
      '.' + PFX + '-small:hover { background:var(--card-hover,#2a2a3e); }',
      '.' + PFX + '-small-icon { font-size:28px; }',
      '.' + PFX + '-small-label { font-size:12px; color:var(--text-secondary,#aaa); }',

      /* Medium quick items */
      '.' + PFX + '-quick-list { display:flex; flex-direction:column; gap:8px; }',
      '.' + PFX + '-quick-item { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:var(--item-bg,#252538); border-radius:8px; font-size:12px; }',
      '.' + PFX + '-quick-item-label { color:var(--text-secondary,#aaa); }',
      '.' + PFX + '-quick-item-value { color:var(--text-primary,#e0e0e0); font-weight:500; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',

      /* Large sections */
      '.' + PFX + '-section { margin-bottom:12px; }',
      '.' + PFX + '-section-title { font-size:12px; font-weight:600; color:var(--text-secondary,#aaa); margin-bottom:6px; text-transform:uppercase; letter-spacing:.5px; }',
      '.' + PFX + '-section-body { display:flex; flex-direction:column; gap:4px; }',
      '.' + PFX + '-config-row { display:flex; align-items:center; justify-content:space-between; padding:5px 8px; background:var(--item-bg,#252538); border-radius:6px; font-size:11px; }',
      '.' + PFX + '-config-key { color:var(--text-secondary,#aaa); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',
      '.' + PFX + '-config-val { color:var(--text-primary,#e0e0e0); font-weight:500; max-width:100px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }',

      /* xlarge tabs */
      '.' + PFX + '-tabs { display:flex; border-bottom:1px solid var(--border,#333); flex-shrink:0; }',
      '.' + PFX + '-tab { flex:1; padding:10px; text-align:center; font-size:13px; font-weight:500; cursor:pointer; color:var(--text-secondary,#aaa); border-bottom:2px solid transparent; transition:all .2s; }',
      '.' + PFX + '-tab:hover { color:var(--text-primary,#e0e0e0); background:var(--card-hover,#2a2a3e); }',
      '.' + PFX + '-tab.active { color:var(--accent,#7c6ff7); border-bottom-color:var(--accent,#7c6ff7); }',
      '.' + PFX + '-tab-content { display:none; flex:1; overflow-y:auto; padding:12px; }',
      '.' + PFX + '-tab-content.active { display:block; }',

      /* Config form */
      '.' + PFX + '-form-group { margin-bottom:10px; }',
      '.' + PFX + '-form-label { display:block; font-size:11px; color:var(--text-secondary,#aaa); margin-bottom:4px; }',
      '.' + PFX + '-form-input { width:100%; padding:7px 10px; background:var(--input-bg,#1a1a2e); border:1px solid var(--border,#333); border-radius:6px; color:var(--text-primary,#e0e0e0); font-size:12px; outline:none; box-sizing:border-box; }',
      '.' + PFX + '-form-input:focus { border-color:var(--accent,#7c6ff7); }',
      '.' + PFX + '-form-select { width:100%; padding:7px 10px; background:var(--input-bg,#1a1a2e); border:1px solid var(--border,#333); border-radius:6px; color:var(--text-primary,#e0e0e0); font-size:12px; outline:none; box-sizing:border-box; cursor:pointer; }',
      '.' + PFX + '-form-select:focus { border-color:var(--accent,#7c6ff7); }',
      '.' + PFX + '-btn { padding:7px 16px; border:none; border-radius:6px; font-size:12px; font-weight:500; cursor:pointer; transition:all .2s; }',
      '.' + PFX + '-btn-primary { background:var(--accent,#7c6ff7); color:#fff; }',
      '.' + PFX + '-btn-primary:hover { filter:brightness(1.15); }',
      '.' + PFX + '-btn-danger { background:#e74c3c; color:#fff; }',
      '.' + PFX + '-btn-danger:hover { filter:brightness(1.15); }',
      '.' + PFX + '-btn-secondary { background:var(--item-bg,#252538); color:var(--text-primary,#e0e0e0); }',
      '.' + PFX + '-btn-secondary:hover { background:var(--card-hover,#2a2a3e); }',
      '.' + PFX + '-btn-row { display:flex; gap:8px; margin-top:12px; }',

      /* Backup list */
      '.' + PFX + '-backup-list { display:flex; flex-direction:column; gap:6px; }',
      '.' + PFX + '-backup-item { display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:var(--item-bg,#252538); border-radius:8px; font-size:12px; }',
      '.' + PFX + '-backup-info { display:flex; flex-direction:column; gap:2px; }',
      '.' + PFX + '-backup-name { font-weight:500; }',
      '.' + PFX + '-backup-meta { font-size:10px; color:var(--text-secondary,#aaa); }',
      '.' + PFX + '-backup-actions { display:flex; gap:4px; }',
      '.' + PFX + '-btn-sm { padding:4px 10px; font-size:11px; }',

      /* Confirm bar */
      '.' + PFX + '-confirm-bar { display:flex; align-items:center; gap:8px; padding:8px 10px; background:rgba(231,76,60,.15); border:1px solid rgba(231,76,60,.3); border-radius:6px; margin-top:6px; font-size:11px; color:#e74c3c; }',
      '.' + PFX + '-confirm-bar span { flex:1; }',

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
  function formatTime(ts) {
    var d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0') + ' ' + String(d.getHours()).padStart(2,'0') + ':' + String(d.getMinutes()).padStart(2,'0');
  }

  /* ========== Card Component ========== */
  function SettingsCard(container, opts) {
    this.container = container;
    this.opts = opts || {};
    this.size = this.opts.size || 'medium';
    this.config = {};
    this.backups = [];
    this.activeTab = 'config';
    this.confirmRestore = null;
    this.loading = false;
    this.error = null;
    this._subs = [];
    this._bound = {};
    injectCSS();
    this.render();
    this._bindEvents();
    this.fetchConfig();
  }

  SettingsCard.prototype._bindEvents = function() {
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

  SettingsCard.prototype._handleAction = function(action, id) {
    switch (action) {
      case 'open-overlay':
        CardOverlay.open('settings-card', { w: 2, h: 2 });
        break;
      case 'switch-tab':
        this.activeTab = id;
        this.render();
        if (id === 'backup') this.fetchBackups();
        break;
      case 'save-config':
        this.saveConfig();
        break;
      case 'create-backup':
        this.createBackup();
        break;
      case 'confirm-restore':
        this.confirmRestore = id;
        this.render();
        break;
      case 'do-restore':
        this.restoreBackup(this.confirmRestore);
        this.confirmRestore = null;
        break;
      case 'cancel-restore':
        this.confirmRestore = null;
        this.render();
        break;
    }
  };

  /* ========== Data ========== */
  SettingsCard.prototype.fetchConfig = function() {
    var self = this;
    this.loading = true;
    this.error = null;
    this.render();
    HermesClient.get('/api/config').then(function(data) {
      self.config = data || {};
      self.loading = false;
      self.render();
    }).catch(function(err) {
      self.error = err.message || '加载配置失败';
      self.loading = false;
      self.render();
    });
  };

  SettingsCard.prototype.saveConfig = function() {
    var self = this;
    var inputs = $$('.stc-form-input, .stc-form-select', this.container);
    var payload = {};
    inputs.forEach(function(inp) {
      var key = inp.getAttribute('data-key');
      if (key) payload[key] = inp.value;
    });
    HermesClient.put('/api/config', payload).then(function() {
      Bus.emit('notification', { type: 'success', message: '配置已保存' });
      self.fetchConfig();
    }).catch(function(err) {
      Bus.emit('notification', { type: 'error', message: '保存失败: ' + (err.message || '') });
    });
  };

  SettingsCard.prototype.fetchBackups = function() {
    var self = this;
    HermesClient.get('/api/system/backup').then(function(data) {
      self.backups = data || [];
      self.render();
    }).catch(function(err) {
      self.backups = [];
      self.render();
    });
  };

  SettingsCard.prototype.createBackup = function() {
    var self = this;
    HermesClient.post('/api/system/backup').then(function() {
      Bus.emit('notification', { type: 'success', message: '备份已创建' });
      self.fetchBackups();
    }).catch(function(err) {
      Bus.emit('notification', { type: 'error', message: '创建备份失败: ' + (err.message || '') });
    });
  };

  SettingsCard.prototype.restoreBackup = function(id) {
    var self = this;
    HermesClient.post('/api/system/restore', { backup_id: id }).then(function() {
      Bus.emit('notification', { type: 'success', message: '已恢复备份' });
      self.fetchConfig();
      self.fetchBackups();
    }).catch(function(err) {
      Bus.emit('notification', { type: 'error', message: '恢复失败: ' + (err.message || '') });
    });
  };

  /* ========== Render ========== */
  SettingsCard.prototype.render = function() {
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

  SettingsCard.prototype._renderHeader = function() {
    var h = el('div', PFX + '-header');
    h.innerHTML = '<div class="' + PFX + '-header-title"><span class="icon">\u2699\uFE0F</span>系统设置</div>';
    return h;
  };

  SettingsCard.prototype._renderBody = function() {
    switch (this.size) {
      case 'small': return this._renderSmall();
      case 'medium': return this._renderMedium();
      case 'large': return this._renderLarge();
      case 'xlarge': return this._renderXLarge();
      default: return this._renderMedium();
    }
  };

  SettingsCard.prototype._renderSmall = function() {
    var body = el('div', PFX + '-body ' + PFX + '-small');
    body.setAttribute('data-action', 'open-overlay');
    body.innerHTML = '<div class="' + PFX + '-small-icon">\u2699\uFE0F</div><div class="' + PFX + '-small-label">设置</div>';
    return body;
  };

  SettingsCard.prototype._renderMedium = function() {
    var body = el('div', PFX + '-body');
    var list = el('div', PFX + '-quick-list');
    var items = [
      { label: '版本', value: this.config.version || 'N/A' },
      { label: '主题', value: this.config.theme || '默认' },
      { label: '语言', value: this.config.language || '中文' }
    ];
    items.forEach(function(item) {
      var row = el('div', PFX + '-quick-item');
      row.innerHTML = '<span class="' + PFX + '-quick-item-label">' + item.label + '</span><span class="' + PFX + '-quick-item-value">' + item.value + '</span>';
      list.appendChild(row);
    });
    body.appendChild(list);
    return body;
  };

  SettingsCard.prototype._renderLarge = function() {
    var body = el('div', PFX + '-body');
    var self = this;

    /* General section */
    var sec1 = el('div', PFX + '-section');
    sec1.innerHTML = '<div class="' + PFX + '-section-title">通用</div>';
    var sb1 = el('div', PFX + '-section-body');
    var generalKeys = ['version', 'language', 'timezone', 'debug_mode'];
    generalKeys.forEach(function(k) {
      var row = el('div', PFX + '-config-row');
      row.innerHTML = '<span class="' + PFX + '-config-key">' + k + '</span><span class="' + PFX + '-config-val">' + (self.config[k] != null ? self.config[k] : '-') + '</span>';
      sb1.appendChild(row);
    });
    sec1.appendChild(sb1);
    body.appendChild(sec1);

    /* Theme section */
    var sec2 = el('div', PFX + '-section');
    sec2.innerHTML = '<div class="' + PFX + '-section-title">主题</div>';
    var sb2 = el('div', PFX + '-section-body');
    var themeKeys = ['theme', 'primary_color', 'font_size'];
    themeKeys.forEach(function(k) {
      var row = el('div', PFX + '-config-row');
      row.innerHTML = '<span class="' + PFX + '-config-key">' + k + '</span><span class="' + PFX + '-config-val">' + (self.config[k] != null ? self.config[k] : '-') + '</span>';
      sb2.appendChild(row);
    });
    sec2.appendChild(sb2);
    body.appendChild(sec2);

    /* Backup section */
    var sec3 = el('div', PFX + '-section');
    sec3.innerHTML = '<div class="' + PFX + '-section-title">备份</div>';
    var sb3 = el('div', PFX + '-section-body');
    sb3.innerHTML = '<div class="' + PFX + '-config-row"><span class="' + PFX + '-config-key">备份数量</span><span class="' + PFX + '-config-val">' + this.backups.length + '</span></div>';
    sec3.appendChild(sb3);
    body.appendChild(sec3);

    return body;
  };

  SettingsCard.prototype._renderXLarge = function() {
    var root = el('div', '');
    var self = this;

    /* Tabs */
    var tabs = el('div', PFX + '-tabs');
    var tabItems = [
      { id: 'config', label: '系统配置' },
      { id: 'backup', label: '备份恢复' }
    ];
    tabItems.forEach(function(t) {
      var tab = el('div', PFX + '-tab' + (self.activeTab === t.id ? ' active' : ''));
      tab.setAttribute('data-action', 'switch-tab');
      tab.setAttribute('data-id', t.id);
      tab.textContent = t.label;
      tabs.appendChild(tab);
    });
    root.appendChild(tabs);

    /* Config tab */
    var configTab = el('div', PFX + '-tab-content' + (this.activeTab === 'config' ? ' active' : ''));
    configTab.appendChild(this._renderConfigForm());
    root.appendChild(configTab);

    /* Backup tab */
    var backupTab = el('div', PFX + '-tab-content' + (this.activeTab === 'backup' ? ' active' : ''));
    backupTab.appendChild(this._renderBackupPanel());
    root.appendChild(backupTab);

    return root;
  };

  SettingsCard.prototype._renderConfigForm = function() {
    var wrap = el('div', '');
    var self = this;
    var keys = Object.keys(this.config);
    if (keys.length === 0) {
      wrap.innerHTML = '<div class="' + PFX + '-empty">暂无配置项</div>';
      return wrap;
    }
    keys.forEach(function(k) {
      var group = el('div', PFX + '-form-group');
      group.innerHTML = '<label class="' + PFX + '-form-label">' + k + '</label>';
      var val = self.config[k];
      if (typeof val === 'boolean') {
        var sel = el('select', PFX + '-form-select');
        sel.setAttribute('data-key', k);
        sel.innerHTML = '<option value="true"' + (val ? ' selected' : '') + '>true</option><option value="false"' + (!val ? ' selected' : '') + '>false</option>';
        group.appendChild(sel);
      } else if (typeof val === 'number') {
        var inp = el('input', PFX + '-form-input');
        inp.type = 'number';
        inp.setAttribute('data-key', k);
        inp.value = val;
        group.appendChild(inp);
      } else {
        var inp2 = el('input', PFX + '-form-input');
        inp2.type = 'text';
        inp2.setAttribute('data-key', k);
        inp2.value = val != null ? String(val) : '';
        group.appendChild(inp2);
      }
      wrap.appendChild(group);
    });
    var btnRow = el('div', PFX + '-btn-row');
    var saveBtn = el('button', PFX + '-btn ' + PFX + '-btn-primary');
    saveBtn.setAttribute('data-action', 'save-config');
    saveBtn.textContent = '保存配置';
    btnRow.appendChild(saveBtn);
    wrap.appendChild(btnRow);
    return wrap;
  };

  SettingsCard.prototype._renderBackupPanel = function() {
    var wrap = el('div', '');
    var self = this;

    /* Create backup button */
    var btnRow = el('div', PFX + '-btn-row');
    var createBtn = el('button', PFX + '-btn ' + PFX + '-btn-primary');
    createBtn.setAttribute('data-action', 'create-backup');
    createBtn.textContent = '创建备份';
    btnRow.appendChild(createBtn);
    wrap.appendChild(btnRow);

    /* Backup list */
    if (this.backups.length === 0) {
      wrap.appendChild(el('div', PFX + '-empty', '暂无备份'));
      return wrap;
    }
    var list = el('div', PFX + '-backup-list');
    this.backups.forEach(function(b) {
      var item = el('div', PFX + '-backup-item');
      var info = el('div', PFX + '-backup-info');
      info.innerHTML = '<div class="' + PFX + '-backup-name">' + (b.name || b.filename || '备份') + '</div><div class="' + PFX + '-backup-meta">' + (b.created_at ? formatTime(b.created_at) : '') + (b.size ? ' | ' + b.size : '') + '</div>';
      var actions = el('div', PFX + '-backup-actions');
      var restoreBtn = el('button', PFX + '-btn ' + PFX + '-btn-secondary ' + PFX + '-btn-sm');
      restoreBtn.setAttribute('data-action', 'confirm-restore');
      restoreBtn.setAttribute('data-id', b.id || b.filename);
      restoreBtn.textContent = '恢复';
      actions.appendChild(restoreBtn);
      item.appendChild(info);
      item.appendChild(actions);

      /* Confirm bar */
      if (self.confirmRestore === (b.id || b.filename)) {
        var cbar = el('div', PFX + '-confirm-bar');
        cbar.innerHTML = '<span>确定要恢复此备份吗？当前配置将被覆盖。</span>';
        var yesBtn = el('button', PFX + '-btn ' + PFX + '-btn-danger ' + PFX + '-btn-sm');
        yesBtn.setAttribute('data-action', 'do-restore');
        yesBtn.textContent = '确定';
        var noBtn = el('button', PFX + '-btn ' + PFX + '-btn-secondary ' + PFX + '-btn-sm');
        noBtn.setAttribute('data-action', 'cancel-restore');
        noBtn.textContent = '取消';
        cbar.appendChild(yesBtn);
        cbar.appendChild(noBtn);
        item.appendChild(cbar);
      }

      list.appendChild(item);
    });
    wrap.appendChild(list);
    return wrap;
  };

  /* ========== SSE ========== */
  SettingsCard.prototype.subscribe = function() {
    var self = this;
    if (typeof DataService !== 'undefined' && DataService.subscribe) {
      var sub = DataService.subscribe('config:updated', function() {
        self.fetchConfig();
      });
      this._subs.push(sub);
    }
  };

  /* ========== Destroy ========== */
  SettingsCard.prototype.destroy = function() {
    this.container.removeEventListener('click', this._bound._delegate);
    this._subs.forEach(function(s) { if (s && s.unsubscribe) s.unsubscribe(); });
    this._subs = [];
    this.container.innerHTML = '';
  };

  /* ========== Mount ========== */
  function mount(container, opts) {
    var card = new SettingsCard(container, opts);
    card.subscribe();
    return card;
  }

  function mountEntry(container, opts) {
    var card = new SettingsCard(container, Object.assign({}, opts, { size: 'small' }));
    return card;
  }

  /* ========== Register ========== */
  if (typeof WidgetRegistry !== 'undefined') {
    WidgetRegistry.register('settings-card', {
      type: 'function',
      label: '系统设置',
      icon: '\u2699\uFE0F',
      defaultSize: { w: 2, h: 1 },
      category: 'functions',
      mount: mount
    });
    WidgetRegistry.register('settings-entry', {
      type: 'entry',
      label: '设置入口',
      icon: '\u2699\uFE0F',
      defaultSize: { w: 1, h: 1 },
      category: 'entries',
      mount: mountEntry
    });
  }

})();
