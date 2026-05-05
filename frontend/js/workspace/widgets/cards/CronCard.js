;(function() {
  'use strict';

  var CSS_ID = 'cron-card-css';
  var PREFIX = 'cc';

  // ── CSS ──────────────────────────────────────────────────────────
  var css = [
    '.' + PREFIX + '-wrap{font-family:var(--font-body,system-ui,sans-serif);color:var(--text-primary,#e0e0e0);height:100%;display:flex;flex-direction:column;overflow:hidden;background:var(--card-bg,#1a1a2e);border-radius:12px;padding:12px;box-sizing:border-box;position:relative}',
    '.' + PREFIX + '-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-shrink:0}',
    '.' + PREFIX + '-header h3{margin:0;font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px}',
    '.' + PREFIX + '-header .count{font-size:11px;color:var(--text-secondary,#888);background:var(--bg-tertiary,#2a2a3e);padding:2px 8px;border-radius:10px}',
    '.' + PREFIX + '-small{display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;gap:4px;transition:transform .15s}',
    '.' + PREFIX + '-small:hover{transform:scale(1.05)}',
    '.' + PREFIX + '-small .icon{font-size:28px}',
    '.' + PREFIX + '-small .label{font-size:12px;color:var(--text-secondary,#888)}',
    '.' + PREFIX + '-small .num{font-size:20px;font-weight:700}',
    '.' + PREFIX + '-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px}',
    '.' + PREFIX + '-list::-webkit-scrollbar{width:4px}',
    '.' + PREFIX + '-list::-webkit-scrollbar-thumb{background:var(--bg-tertiary,#2a2a3e);border-radius:2px}',
    '.' + PREFIX + '-item{background:var(--bg-secondary,#22223a);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;transition:background .15s}',
    '.' + PREFIX + '-item:hover{background:var(--bg-hover,#2e2e4a)}',
    '.' + PREFIX + '-item .row{display:flex;align-items:center;justify-content:space-between;gap:6px}',
    '.' + PREFIX + '-item .name{font-size:12px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.' + PREFIX + '-item .cron{font-size:10px;color:var(--text-secondary,#888);font-family:var(--font-mono,monospace)}',
    '.' + PREFIX + '-item .meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text-secondary,#888)}',
    '.' + PREFIX + '-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
    '.' + PREFIX + '-dot-active{background:#6ecf6e;box-shadow:0 0 4px #6ecf6e}',
    '.' + PREFIX + '-dot-paused{background:#cfcf6e;box-shadow:0 0 4px #cfcf6e}',
    '.' + PREFIX + '-dot-error{background:#cf6e6e;box-shadow:0 0 4px #cf6e6e}',
    '.' + PREFIX + '-status{font-size:9px;padding:1px 6px;border-radius:8px;font-weight:600;text-transform:uppercase}',
    '.' + PREFIX + '-status-active{background:#2d4a2d;color:#6ecf6e}',
    '.' + PREFIX + '-status-paused{background:#4a4a2d;color:#cfcf6e}',
    '.' + PREFIX + '-status-error{background:#4a2d2d;color:#cf6e6e}',
    '.' + PREFIX + '-msg-preview{font-size:10px;color:var(--text-secondary,#888);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:200px}',
    '.' + PREFIX + '-toolbar{display:flex;gap:6px;margin-bottom:8px;flex-shrink:0;flex-wrap:wrap}',
    '.' + PREFIX + '-tabs{display:flex;gap:4px}',
    '.' + PREFIX + '-tab{font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border,#333);background:transparent;color:var(--text-secondary,#888);cursor:pointer;transition:all .15s}',
    '.' + PREFIX + '-tab.active{background:var(--accent,#6c63ff);color:#fff;border-color:var(--accent,#6c63ff)}',
    '.' + PREFIX + '-actions{display:flex;gap:4px;flex-wrap:wrap}',
    '.' + PREFIX + '-btn{font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border,#333);background:transparent;color:var(--text-secondary,#888);cursor:pointer;transition:all .15s;white-space:nowrap}',
    '.' + PREFIX + '-btn:hover{background:var(--bg-hover,#2e2e4a);color:var(--text-primary,#e0e0e0)}',
    '.' + PREFIX + '-btn-primary{background:var(--accent,#6c63ff);color:#fff;border-color:var(--accent,#6c63ff)}',
    '.' + PREFIX + '-btn-primary:hover{opacity:.85}',
    '.' + PREFIX + '-btn-danger{color:#cf6e6e;border-color:#4a2d2d}',
    '.' + PREFIX + '-btn-danger:hover{background:#4a2d2d;color:#ff8888}',
    '.' + PREFIX + '-btn-warning{color:#cfcf6e;border-color:#4a4a2d}',
    '.' + PREFIX + '-btn-warning:hover{background:#4a4a2d}',
    '.' + PREFIX + '-detail{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px}',
    '.' + PREFIX + '-detail-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
    '.' + PREFIX + '-detail-header .back{cursor:pointer;font-size:14px;padding:4px 8px;border-radius:6px;background:var(--bg-secondary,#22223a);border:none;color:var(--text-primary,#e0e0e0);transition:background .15s}',
    '.' + PREFIX + '-detail-header .back:hover{background:var(--bg-hover,#2e2e4a)}',
    '.' + PREFIX + '-form{display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--bg-secondary,#22223a);border-radius:8px}',
    '.' + PREFIX + '-form label{font-size:11px;color:var(--text-secondary,#888);display:flex;flex-direction:column;gap:3px}',
    '.' + PREFIX + '-form input,' + '.' + PREFIX + '-form textarea,' + '.' + PREFIX + '-form select{background:var(--bg-tertiary,#2a2a3e);border:1px solid var(--border,#333);border-radius:6px;padding:6px 8px;font-size:12px;color:var(--text-primary,#e0e0e0);outline:none;box-sizing:border-box;font-family:inherit;resize:vertical}',
    '.' + PREFIX + '-form textarea{min-height:60px}',
    '.' + PREFIX + '-form input:focus,' + '.' + PREFIX + '-form textarea:focus,' + '.' + PREFIX + '-form select:focus{border-color:var(--accent,#6c63ff)}',
    '.' + PREFIX + '-form-actions{display:flex;gap:6px;justify-content:flex-end;margin-top:4px}',
    '.' + PREFIX + '-confirm-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#4a2d2d;border-radius:8px;font-size:12px}',
    '.' + PREFIX + '-confirm-bar span{flex:1}',
    '.' + PREFIX + '-confirm-bar-warn{background:#4a4a2d}',
    '.' + PREFIX + '-empty{flex:1;display:flex;align-items:center;justify-content:center;color:var(--text-secondary,#888);font-size:12px}',
    '.' + PREFIX + '-loading{flex:1;display:flex;align-items:center;justify-content:center}',
    '.' + PREFIX + '-loading .spinner{width:24px;height:24px;border:2px solid var(--border,#333);border-top-color:var(--accent,#6c63ff);border-radius:50%;animation:' + PREFIX + '-spin .6s linear infinite}',
    '@keyframes ' + PREFIX + '-spin{to{transform:rotate(360deg)}}',
    '.' + PREFIX + '-error{flex:1;display:flex;align-items:center;justify-content:center;color:#cf6e6e;font-size:12px}'
  ].join('\n');

  // ── Helpers ──────────────────────────────────────────────────────
  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var el = document.createElement('style');
    el.id = CSS_ID;
    el.textContent = css;
    document.head.appendChild(el);
  }

  function truncate(str, len) {
    if (!str) return '';
    return str.length > len ? str.substring(0, len) + '...' : str;
  }

  function formatTime(ts) {
    if (!ts) return '--';
    var d = new Date(ts);
    return d.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function escHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  function statusLabel(s) {
    var map = { active: '活跃', paused: '暂停', error: '错误' };
    return map[s] || s || '未知';
  }

  // ── Card ─────────────────────────────────────────────────────────
  function CronCard(container, options) {
    this.container = container;
    this.options = options || {};
    this.size = this.options.size || 'medium';
    this.jobs = [];
    this.loading = false;
    this.error = null;
    this.filter = 'all';
    this.selectedId = null;
    this.editing = false;
    this.showForm = false;
    this.confirmDelete = false;
    this.confirmToggle = false;
    this.confirmTrigger = false;
    this.formData = { name: '', cron_expression: '', message: '', timezone: 'Asia/Shanghai' };
    this.sseSub = null;
    this._bound = {};
  }

  CronCard.prototype.init = function() {
    injectCSS();
    this.container.innerHTML = '';
    this.container.classList.add(PREFIX + '-wrap');
    this.container.setAttribute('data-widget', 'cron-card');
    this.bindEvents();
    this.loadData();
    this.subscribeSSE();
  };

  CronCard.prototype.bindEvents = function() {
    var self = this;
    this._bound.handleClick = function(e) {
      var action = e.target.closest('[data-action]');
      if (!action) return;
      var act = action.getAttribute('data-action');
      var id = action.getAttribute('data-id');
      self.handleAction(act, id, e);
    };
    this.container.addEventListener('click', this._bound.handleClick);
  };

  CronCard.prototype.handleAction = function(action, id, e) {
    switch (action) {
      case 'open-overlay':
        CardOverlay.open({ widget: 'cron-card', title: '定时任务管理' });
        break;
      case 'back':
        this.selectedId = null;
        this.editing = false;
        this.showForm = false;
        this.confirmDelete = false;
        this.confirmToggle = false;
        this.confirmTrigger = false;
        this.render();
        break;
      case 'new':
        this.formData = { name: '', cron_expression: '', message: '', timezone: 'Asia/Shanghai' };
        this.showForm = true;
        this.selectedId = null;
        this.editing = false;
        this.confirmDelete = false;
        this.confirmToggle = false;
        this.confirmTrigger = false;
        this.render();
        break;
      case 'edit':
        var job = this.getById(id);
        if (job) {
          this.formData = { name: job.name, cron_expression: job.cron_expression, message: job.message || '', timezone: job.timezone || 'Asia/Shanghai' };
          this.selectedId = id;
          this.editing = true;
          this.showForm = false;
          this.confirmDelete = false;
          this.confirmToggle = false;
          this.confirmTrigger = false;
          this.render();
        }
        break;
      case 'save':
        this.saveJob();
        break;
      case 'cancel-form':
        this.showForm = false;
        this.editing = false;
        this.selectedId = null;
        this.render();
        break;
      case 'delete':
        this.confirmDelete = true;
        this.confirmToggle = false;
        this.confirmTrigger = false;
        this.render();
        break;
      case 'confirm-delete':
        this.deleteJob(id);
        break;
      case 'cancel-delete':
        this.confirmDelete = false;
        this.render();
        break;
      case 'toggle':
        this.confirmToggle = true;
        this.confirmDelete = false;
        this.confirmTrigger = false;
        this.render();
        break;
      case 'confirm-toggle':
        this.toggleJob(id);
        break;
      case 'cancel-toggle':
        this.confirmToggle = false;
        this.render();
        break;
      case 'trigger':
        this.confirmTrigger = true;
        this.confirmDelete = false;
        this.confirmToggle = false;
        this.render();
        break;
      case 'confirm-trigger':
        this.triggerJob(id);
        break;
      case 'cancel-trigger':
        this.confirmTrigger = false;
        this.render();
        break;
      case 'filter':
        this.filter = id;
        this.render();
        break;
    }
  };

  CronCard.prototype.getById = function(id) {
    for (var i = 0; i < this.jobs.length; i++) {
      if (this.jobs[i].id === id) return this.jobs[i];
    }
    return null;
  };

  CronCard.prototype.getFiltered = function() {
    if (this.filter === 'all') return this.jobs;
    var f = this.filter;
    return this.jobs.filter(function(j) { return j.status === f; });
  };

  CronCard.prototype.getActiveCount = function() {
    var c = 0;
    for (var i = 0; i < this.jobs.length; i++) {
      if (this.jobs[i].status === 'active') c++;
    }
    return c;
  };

  // ── Data ─────────────────────────────────────────────────────────
  CronCard.prototype.loadData = function() {
    var self = this;
    this.loading = true;
    this.error = null;
    this.render();

    DataService.fetch('/api/cron').then(function(data) {
      self.jobs = data || [];
      self.loading = false;
      self.render();
    }).catch(function(err) {
      self.error = '加载定时任务失败: ' + (err.message || '未知错误');
      self.loading = false;
      self.render();
    });
  };

  CronCard.prototype.saveJob = function() {
    var self = this;
    var form = this.container.querySelector('.' + PREFIX + '-form');
    if (!form) return;
    var name = form.querySelector('[name="name"]').value.trim();
    var cron_expression = form.querySelector('[name="cron_expression"]').value.trim();
    var message = form.querySelector('[name="message"]').value.trim();
    var timezone = form.querySelector('[name="timezone"]').value;

    if (!name || !cron_expression) return;

    var payload = { name: name, cron_expression: cron_expression, message: message || undefined, timezone: timezone || 'Asia/Shanghai' };

    var isEdit = this.editing && this.selectedId;
    var url = isEdit ? '/api/cron/' + this.selectedId : '/api/cron';
    var method = isEdit ? 'PUT' : 'POST';

    DataService.fetch(url, { method: method, body: JSON.stringify(payload) }).then(function() {
      self.showForm = false;
      self.editing = false;
      self.selectedId = null;
      self.loadData();
    }).catch(function(err) {
      self.error = '保存失败: ' + (err.message || '未知错误');
      self.render();
    });
  };

  CronCard.prototype.deleteJob = function(id) {
    var self = this;
    DataService.fetch('/api/cron/' + id, { method: 'DELETE' }).then(function() {
      self.confirmDelete = false;
      self.selectedId = null;
      self.loadData();
    }).catch(function(err) {
      self.error = '删除失败: ' + (err.message || '未知错误');
      self.render();
    });
  };

  CronCard.prototype.toggleJob = function(id) {
    var self = this;
    var job = this.getById(id);
    if (!job) return;
    var endpoint = job.enabled ? '/api/cron/' + id + '/pause' : '/api/cron/' + id + '/resume';
    DataService.fetch(endpoint, { method: 'PUT' }).then(function() {
      self.confirmToggle = false;
      self.loadData();
    }).catch(function(err) {
      self.error = '操作失败: ' + (err.message || '未知错误');
      self.render();
    });
  };

  CronCard.prototype.triggerJob = function(id) {
    var self = this;
    DataService.fetch('/api/cron/' + id + '/trigger', { method: 'POST' }).then(function() {
      self.confirmTrigger = false;
      self.loadData();
    }).catch(function(err) {
      self.error = '触发失败: ' + (err.message || '未知错误');
      self.render();
    });
  };

  // ── SSE ──────────────────────────────────────────────────────────
  CronCard.prototype.subscribeSSE = function() {
    var self = this;
    if (typeof Bus === 'undefined' || !Bus.subscribe) return;
    this.sseSub = Bus.subscribe('cron', function(data) {
      if (data && data.type === 'update') {
        self.loadData();
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────
  CronCard.prototype.render = function() {
    if (this.loading) {
      this.container.innerHTML = '<div class="' + PREFIX + '-loading"><div class="spinner"></div></div>';
      return;
    }
    if (this.error) {
      this.container.innerHTML = '<div class="' + PREFIX + '-error">' + escHtml(this.error) + '</div>';
      return;
    }
    switch (this.size) {
      case 'small': this.renderSmall(); break;
      case 'medium': this.renderMedium(); break;
      case 'large': this.renderLarge(); break;
      case 'xlarge': this.renderXLarge(); break;
      default: this.renderMedium();
    }
  };

  CronCard.prototype.renderSmall = function() {
    var count = this.getActiveCount();
    this.container.innerHTML =
      '<div class="' + PREFIX + '-small" data-action="open-overlay">' +
        '<span class="icon">⏰</span>' +
        '<span class="label">定时任务</span>' +
        '<span class="num">' + count + '</span>' +
      '</div>';
  };

  CronCard.prototype.renderMedium = function() {
    var active = this.jobs.filter(function(j) { return j.status === 'active'; });
    var items = '';
    for (var i = 0; i < active.length; i++) {
      var j = active[i];
      items +=
        '<div class="' + PREFIX + '-item">' +
          '<div class="row">' +
            '<span class="name">' + escHtml(j.name) + '</span>' +
            '<span class="' + PREFIX + '-dot ' + PREFIX + '-dot-' + (j.status || 'active') + '"></span>' +
          '</div>' +
          '<div class="meta">' +
            '<span class="cron">' + escHtml(j.cron_expression) + '</span>' +
            '<span>下次: ' + formatTime(j.next_run) + '</span>' +
          '</div>' +
        '</div>';
    }
    this.container.innerHTML =
      '<div class="' + PREFIX + '-header">' +
        '<h3>⏰ 定时任务 <span class="count">' + this.getActiveCount() + ' 活跃</span></h3>' +
      '</div>' +
      '<div class="' + PREFIX + '-list">' + (items || '<div class="' + PREFIX + '-empty">暂无活跃任务</div>') + '</div>';
  };

  CronCard.prototype.renderLarge = function() {
    var filtered = this.getFiltered();
    var items = '';
    for (var i = 0; i < filtered.length; i++) {
      var j = filtered[i];
      var status = j.status || 'active';
      items +=
        '<div class="' + PREFIX + '-item">' +
          '<div class="row">' +
            '<span class="name">' + escHtml(j.name) + '</span>' +
            '<span class="' + PREFIX + '-status ' + PREFIX + '-status-' + status + '">' + statusLabel(status) + '</span>' +
          '</div>' +
          '<div class="meta">' +
            '<span class="cron">' + escHtml(j.cron_expression) + '</span>' +
            '<span>上次: ' + formatTime(j.last_run) + '</span>' +
            '<span>下次: ' + formatTime(j.next_run) + '</span>' +
          '</div>' +
          '<div class="actions" style="margin-top:4px">' +
            '<button class="' + PREFIX + '-btn" data-action="toggle" data-id="' + j.id + '">' + (j.enabled ? '暂停' : '恢复') + '</button>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-warning" data-action="trigger" data-id="' + j.id + '">触发</button>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-danger" data-action="delete" data-id="' + j.id + '">删除</button>' +
          '</div>' +
        '</div>';
    }
    this.container.innerHTML =
      '<div class="' + PREFIX + '-header"><h3>⏰ 定时任务 <span class="count">' + this.jobs.length + '</span></h3></div>' +
      '<div class="' + PREFIX + '-toolbar">' +
        '<div class="' + PREFIX + '-tabs">' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'all' ? ' active' : '') + '" data-action="filter" data-id="all">全部</button>' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'active' ? ' active' : '') + '" data-action="filter" data-id="active">活跃</button>' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'paused' ? ' active' : '') + '" data-action="filter" data-id="paused">暂停</button>' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'error' ? ' active' : '') + '" data-action="filter" data-id="error">错误</button>' +
        '</div>' +
      '</div>' +
      '<div class="' + PREFIX + '-list">' + (items || '<div class="' + PREFIX + '-empty">暂无定时任务</div>') + '</div>';
  };

  CronCard.prototype.renderXLarge = function() {
    if (this.showForm || this.editing) {
      this.renderForm();
      return;
    }
    this.renderXList();
  };

  CronCard.prototype.renderXList = function() {
    var filtered = this.getFiltered();
    var items = '';
    for (var i = 0; i < filtered.length; i++) {
      var j = filtered[i];
      var status = j.status || 'active';
      items +=
        '<div class="' + PREFIX + '-item">' +
          '<div class="row">' +
            '<span class="name">' + escHtml(j.name) + '</span>' +
            '<span class="' + PREFIX + '-status ' + PREFIX + '-status-' + status + '">' + statusLabel(status) + '</span>' +
          '</div>' +
          '<div class="meta">' +
            '<span class="cron">' + escHtml(j.cron_expression) + '</span>' +
            (j.message ? '<span class="' + PREFIX + '-msg-preview">' + escHtml(truncate(j.message, 40)) + '</span>' : '') +
          '</div>' +
          '<div class="meta">' +
            '<span>上次: ' + formatTime(j.last_run) + '</span>' +
            '<span>下次: ' + formatTime(j.next_run) + '</span>' +
            (j.timezone ? '<span>时区: ' + escHtml(j.timezone) + '</span>' : '') +
          '</div>' +
          '<div class="actions" style="margin-top:4px">' +
            '<button class="' + PREFIX + '-btn" data-action="toggle" data-id="' + j.id + '">' + (j.enabled ? '暂停' : '恢复') + '</button>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-warning" data-action="trigger" data-id="' + j.id + '">手动触发</button>' +
            '<button class="' + PREFIX + '-btn" data-action="edit" data-id="' + j.id + '">编辑</button>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-danger" data-action="delete" data-id="' + j.id + '">删除</button>' +
          '</div>' +
        '</div>';

      if (this.confirmDelete && this.selectedId === j.id) {
        items +=
          '<div class="' + PREFIX + '-confirm-bar">' +
            '<span>确认删除任务 "' + escHtml(j.name) + '"？</span>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-danger" data-action="confirm-delete" data-id="' + j.id + '">确认</button>' +
            '<button class="' + PREFIX + '-btn" data-action="cancel-delete">取消</button>' +
          '</div>';
      }
      if (this.confirmToggle && this.selectedId === j.id) {
        var toggleLabel = j.enabled ? '暂停' : '恢复';
        items +=
          '<div class="' + PREFIX + '-confirm-bar ' + PREFIX + '-confirm-bar-warn">' +
            '<span>确认' + toggleLabel + '任务 "' + escHtml(j.name) + '"？</span>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-warning" data-action="confirm-toggle" data-id="' + j.id + '">确认</button>' +
            '<button class="' + PREFIX + '-btn" data-action="cancel-toggle">取消</button>' +
          '</div>';
      }
      if (this.confirmTrigger && this.selectedId === j.id) {
        items +=
          '<div class="' + PREFIX + '-confirm-bar ' + PREFIX + '-confirm-bar-warn">' +
            '<span>确认手动触发 "' + escHtml(j.name) + '"？</span>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-warning" data-action="confirm-trigger" data-id="' + j.id + '">确认</button>' +
            '<button class="' + PREFIX + '-btn" data-action="cancel-trigger">取消</button>' +
          '</div>';
      }
    }
    this.container.innerHTML =
      '<div class="' + PREFIX + '-header">' +
        '<h3>⏰ 定时任务管理 <span class="count">' + this.jobs.length + '</span></h3>' +
        '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-primary" data-action="new">新建</button>' +
      '</div>' +
      '<div class="' + PREFIX + '-toolbar">' +
        '<div class="' + PREFIX + '-tabs">' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'all' ? ' active' : '') + '" data-action="filter" data-id="all">全部</button>' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'active' ? ' active' : '') + '" data-action="filter" data-id="active">活跃</button>' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'paused' ? ' active' : '') + '" data-action="filter" data-id="paused">暂停</button>' +
          '<button class="' + PREFIX + '-tab' + (this.filter === 'error' ? ' active' : '') + '" data-action="filter" data-id="error">错误</button>' +
        '</div>' +
      '</div>' +
      '<div class="' + PREFIX + '-list">' + (items || '<div class="' + PREFIX + '-empty">暂无定时任务</div>') + '</div>';
  };

  CronCard.prototype.renderForm = function() {
    var title = this.editing ? '编辑任务' : '新建任务';
    var fd = this.formData;
    this.container.innerHTML =
      '<div class="' + PREFIX + '-detail">' +
        '<div class="' + PREFIX + '-detail-header">' +
          '<button class="back" data-action="cancel-form">← 返回</button>' +
          '<h3>' + title + '</h3>' +
        '</div>' +
        '<div class="' + PREFIX + '-form">' +
          '<label>任务名称<input name="name" value="' + escHtml(fd.name) + '" placeholder="例如: 每日摘要"></label>' +
          '<label>Cron 表达式<input name="cron_expression" value="' + escHtml(fd.cron_expression) + '" placeholder="例如: 0 8 * * *"></label>' +
          '<label>任务消息<textarea name="message">' + escHtml(fd.message) + '</textarea></label>' +
          '<label>时区<select name="timezone">' +
            '<option value="Asia/Shanghai"' + (fd.timezone === 'Asia/Shanghai' ? ' selected' : '') + '>Asia/Shanghai</option>' +
            '<option value="Asia/Tokyo"' + (fd.timezone === 'Asia/Tokyo' ? ' selected' : '') + '>Asia/Tokyo</option>' +
            '<option value="America/New_York"' + (fd.timezone === 'America/New_York' ? ' selected' : '') + '>America/New_York</option>' +
            '<option value="America/Los_Angeles"' + (fd.timezone === 'America/Los_Angeles' ? ' selected' : '') + '>America/Los_Angeles</option>' +
            '<option value="Europe/London"' + (fd.timezone === 'Europe/London' ? ' selected' : '') + '>Europe/London</option>' +
            '<option value="UTC"' + (fd.timezone === 'UTC' ? ' selected' : '') + '>UTC</option>' +
          '</select></label>' +
          '<div class="' + PREFIX + '-form-actions">' +
            '<button class="' + PREFIX + '-btn" data-action="cancel-form">取消</button>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-primary" data-action="save">保存</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  // ── Resize ───────────────────────────────────────────────────────
  CronCard.prototype.setSize = function(size) {
    this.size = size;
    this.selectedId = null;
    this.editing = false;
    this.showForm = false;
    this.confirmDelete = false;
    this.confirmToggle = false;
    this.confirmTrigger = false;
    this.render();
  };

  // ── Destroy ──────────────────────────────────────────────────────
  CronCard.prototype.destroy = function() {
    if (this._bound.handleClick) {
      this.container.removeEventListener('click', this._bound.handleClick);
    }
    if (this.sseSub && typeof Bus !== 'undefined' && Bus.unsubscribe) {
      Bus.unsubscribe('cron', this.sseSub);
    }
    this.container.innerHTML = '';
    this.container.classList.remove(PREFIX + '-wrap');
  };

  // ── Mount ────────────────────────────────────────────────────────
  function mount(container, options) {
    var card = new CronCard(container, options);
    card.init();
    return card;
  }

  function mountEntry(container, options) {
    var entry = new CronCard(container, Object.assign({}, options, { size: 'small' }));
    entry.init();
    return entry;
  }

  // ── Register ─────────────────────────────────────────────────────
  WidgetRegistry.register('cron-card', {
    type: 'data',
    label: '定时任务',
    icon: '⏰',
    defaultSize: { w: 2, h: 1 },
    category: 'data',
    mount: mount
  });

  WidgetRegistry.register('cron-entry', {
    type: 'entry',
    label: '定时任务入口',
    icon: '⏰',
    defaultSize: { w: 1, h: 1 },
    category: 'entries',
    mount: mountEntry
  });

})();
