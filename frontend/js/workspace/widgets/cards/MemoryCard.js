;(function() {
  'use strict';

  var CSS_ID = 'memory-card-css';
  var PREFIX = 'mc';

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
    '.' + PREFIX + '-item{background:var(--bg-secondary,#22223a);border-radius:8px;padding:8px 10px;display:flex;flex-direction:column;gap:4px;transition:background .15s;cursor:pointer}',
    '.' + PREFIX + '-item:hover{background:var(--bg-hover,#2e2e4a)}',
    '.' + PREFIX + '-item .row{display:flex;align-items:center;justify-content:space-between;gap:6px}',
    '.' + PREFIX + '-item .content{font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.' + PREFIX + '-item .meta{display:flex;align-items:center;gap:6px;font-size:10px;color:var(--text-secondary,#888)}',
    '.' + PREFIX + '-badge{font-size:9px;padding:1px 6px;border-radius:8px;font-weight:600;text-transform:uppercase}',
    '.' + PREFIX + '-badge-low{background:#2d4a2d;color:#6ecf6e}',
    '.' + PREFIX + '-badge-medium{background:#4a4a2d;color:#cfcf6e}',
    '.' + PREFIX + '-badge-high{background:#4a2d2d;color:#cf6e6e}',
    '.' + PREFIX + '-tags{display:flex;gap:3px;flex-wrap:wrap}',
    '.' + PREFIX + '-tag{font-size:9px;background:var(--bg-tertiary,#2a2a3e);padding:1px 5px;border-radius:4px;color:var(--text-secondary,#aaa)}',
    '.' + PREFIX + '-toolbar{display:flex;gap:6px;margin-bottom:8px;flex-shrink:0;flex-wrap:wrap}',
    '.' + PREFIX + '-search{flex:1;min-width:100px;background:var(--bg-secondary,#22223a);border:1px solid var(--border,#333);border-radius:6px;padding:5px 8px;font-size:12px;color:var(--text-primary,#e0e0e0);outline:none;box-sizing:border-box}',
    '.' + PREFIX + '-search:focus{border-color:var(--accent,#6c63ff)}',
    '.' + PREFIX + '-filter{display:flex;gap:4px}',
    '.' + PREFIX + '-filter-btn{font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border,#333);background:transparent;color:var(--text-secondary,#888);cursor:pointer;transition:all .15s}',
    '.' + PREFIX + '-filter-btn.active{background:var(--accent,#6c63ff);color:#fff;border-color:var(--accent,#6c63ff)}',
    '.' + PREFIX + '-actions{display:flex;gap:4px}',
    '.' + PREFIX + '-btn{font-size:10px;padding:3px 8px;border-radius:6px;border:1px solid var(--border,#333);background:transparent;color:var(--text-secondary,#888);cursor:pointer;transition:all .15s}',
    '.' + PREFIX + '-btn:hover{background:var(--bg-hover,#2e2e4a);color:var(--text-primary,#e0e0e0)}',
    '.' + PREFIX + '-btn-primary{background:var(--accent,#6c63ff);color:#fff;border-color:var(--accent,#6c63ff)}',
    '.' + PREFIX + '-btn-primary:hover{opacity:.85}',
    '.' + PREFIX + '-btn-danger{color:#cf6e6e;border-color:#4a2d2d}',
    '.' + PREFIX + '-btn-danger:hover{background:#4a2d2d;color:#ff8888}',
    '.' + PREFIX + '-detail{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:10px}',
    '.' + PREFIX + '-detail-header{display:flex;align-items:center;gap:8px;margin-bottom:4px}',
    '.' + PREFIX + '-detail-header .back{cursor:pointer;font-size:14px;padding:4px 8px;border-radius:6px;background:var(--bg-secondary,#22223a);border:none;color:var(--text-primary,#e0e0e0);transition:background .15s}',
    '.' + PREFIX + '-detail-header .back:hover{background:var(--bg-hover,#2e2e4a)}',
    '.' + PREFIX + '-detail-content{font-size:13px;line-height:1.6;padding:10px;background:var(--bg-secondary,#22223a);border-radius:8px}',
    '.' + PREFIX + '-detail-meta{display:flex;flex-wrap:wrap;gap:8px;font-size:11px;color:var(--text-secondary,#888)}',
    '.' + PREFIX + '-detail-meta span{display:flex;align-items:center;gap:4px}',
    '.' + PREFIX + '-form{display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--bg-secondary,#22223a);border-radius:8px}',
    '.' + PREFIX + '-form label{font-size:11px;color:var(--text-secondary,#888);display:flex;flex-direction:column;gap:3px}',
    '.' + PREFIX + '-form textarea,' + '.' + PREFIX + '-form input,' + '.' + PREFIX + '-form select{background:var(--bg-tertiary,#2a2a3e);border:1px solid var(--border,#333);border-radius:6px;padding:6px 8px;font-size:12px;color:var(--text-primary,#e0e0e0);outline:none;box-sizing:border-box;font-family:inherit;resize:vertical}',
    '.' + PREFIX + '-form textarea{min-height:60px}',
    '.' + PREFIX + '-form textarea:focus,' + '.' + PREFIX + '-form input:focus,' + '.' + PREFIX + '-form select:focus{border-color:var(--accent,#6c63ff)}',
    '.' + PREFIX + '-form-actions{display:flex;gap:6px;justify-content:flex-end;margin-top:4px}',
    '.' + PREFIX + '-confirm-bar{display:flex;align-items:center;gap:8px;padding:8px 10px;background:#4a2d2d;border-radius:8px;font-size:12px}',
    '.' + PREFIX + '-confirm-bar span{flex:1}',
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

  function timeAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - new Date(ts).getTime();
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return '刚刚';
    if (mins < 60) return mins + '分钟前';
    var hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + '小时前';
    var days = Math.floor(hrs / 24);
    if (days < 30) return days + '天前';
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  function escHtml(s) {
    if (!s) return '';
    var d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  // ── Card ─────────────────────────────────────────────────────────
  function MemoryCard(container, options) {
    this.container = container;
    this.options = options || {};
    this.size = this.options.size || 'medium';
    this.memories = [];
    this.stats = null;
    this.loading = false;
    this.error = null;
    this.filter = 'all';
    this.search = '';
    this.selectedId = null;
    this.editing = false;
    this.confirmDelete = false;
    this.showForm = false;
    this.formData = { content: '', importance: 'medium', tags: '', source: '' };
    this.sseSub = null;
    this._bound = {};
  }

  MemoryCard.prototype.init = function() {
    injectCSS();
    this.container.innerHTML = '';
    this.container.classList.add(PREFIX + '-wrap');
    this.container.setAttribute('data-widget', 'memory-card');
    this.bindEvents();
    this.loadData();
    this.subscribeSSE();
  };

  MemoryCard.prototype.bindEvents = function() {
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

  MemoryCard.prototype.handleAction = function(action, id, e) {
    switch (action) {
      case 'open-overlay':
        CardOverlay.open({ widget: 'memory-card', title: '记忆管理' });
        break;
      case 'select':
        this.selectedId = id;
        this.editing = false;
        this.confirmDelete = false;
        this.showForm = false;
        this.render();
        break;
      case 'back':
        this.selectedId = null;
        this.editing = false;
        this.confirmDelete = false;
        this.showForm = false;
        this.render();
        break;
      case 'edit':
        var m = this.getById(id);
        if (m) {
          this.formData = { content: m.content, importance: m.importance, tags: (m.tags || []).join(', '), source: m.source || '' };
          this.editing = true;
          this.confirmDelete = false;
          this.render();
        }
        break;
      case 'delete':
        this.confirmDelete = true;
        this.editing = false;
        this.render();
        break;
      case 'confirm-delete':
        this.deleteMemory(id);
        break;
      case 'cancel-delete':
        this.confirmDelete = false;
        this.render();
        break;
      case 'new':
        this.formData = { content: '', importance: 'medium', tags: '', source: '' };
        this.showForm = true;
        this.selectedId = null;
        this.editing = false;
        this.confirmDelete = false;
        this.render();
        break;
      case 'save':
        this.saveMemory();
        break;
      case 'cancel-form':
        this.showForm = false;
        this.editing = false;
        this.render();
        break;
      case 'filter':
        this.filter = id;
        this.render();
        break;
    }
  };

  MemoryCard.prototype.getById = function(id) {
    for (var i = 0; i < this.memories.length; i++) {
      if (this.memories[i].id === id) return this.memories[i];
    }
    return null;
  };

  MemoryCard.prototype.getFiltered = function() {
    var list = this.memories;
    if (this.filter !== 'all') {
      var f = this.filter;
      list = list.filter(function(m) { return m.importance === f; });
    }
    if (this.search) {
      var q = this.search.toLowerCase();
      list = list.filter(function(m) {
        return (m.content || '').toLowerCase().indexOf(q) !== -1 ||
               (m.tags || []).some(function(t) { return t.toLowerCase().indexOf(q) !== -1; });
      });
    }
    return list;
  };

  // ── Data ─────────────────────────────────────────────────────────
  MemoryCard.prototype.loadData = function() {
    var self = this;
    this.loading = true;
    this.error = null;
    this.render();

    var p1 = DataService.fetch('/api/memories').then(function(data) {
      self.memories = data || [];
    }).catch(function(err) {
      self.error = '加载记忆失败: ' + (err.message || '未知错误');
    });

    var p2 = DataService.fetch('/api/memories/stats').then(function(data) {
      self.stats = data;
    }).catch(function() {
      self.stats = null;
    });

    Promise.all([p1, p2]).then(function() {
      self.loading = false;
      self.render();
    });
  };

  MemoryCard.prototype.saveMemory = function() {
    var self = this;
    var form = this.container.querySelector('.' + PREFIX + '-form');
    if (!form) return;
    var content = form.querySelector('[name="content"]').value.trim();
    var importance = form.querySelector('[name="importance"]').value;
    var tags = form.querySelector('[name="tags"]').value;
    var source = form.querySelector('[name="source"]').value.trim();

    if (!content) return;

    var payload = {
      content: content,
      importance: importance,
      tags: tags ? tags.split(',').map(function(t) { return t.trim(); }).filter(Boolean) : [],
      source: source || undefined
    };

    var isEdit = this.editing && this.selectedId;
    var url = isEdit ? '/api/memories/' + this.selectedId : '/api/memories';
    var method = isEdit ? 'PUT' : 'POST';

    DataService.fetch(url, { method: method, body: JSON.stringify(payload) }).then(function() {
      self.showForm = false;
      self.editing = false;
      self.loadData();
    }).catch(function(err) {
      self.error = '保存失败: ' + (err.message || '未知错误');
      self.render();
    });
  };

  MemoryCard.prototype.deleteMemory = function(id) {
    var self = this;
    DataService.fetch('/api/memories/' + id, { method: 'DELETE' }).then(function() {
      self.confirmDelete = false;
      self.selectedId = null;
      self.loadData();
    }).catch(function(err) {
      self.error = '删除失败: ' + (err.message || '未知错误');
      self.render();
    });
  };

  // ── SSE ──────────────────────────────────────────────────────────
  MemoryCard.prototype.subscribeSSE = function() {
    var self = this;
    if (typeof Bus === 'undefined' || !Bus.subscribe) return;
    this.sseSub = Bus.subscribe('memories', function(data) {
      if (data && data.type === 'update') {
        self.loadData();
      }
    });
  };

  // ── Render ───────────────────────────────────────────────────────
  MemoryCard.prototype.render = function() {
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

  MemoryCard.prototype.renderSmall = function() {
    var count = this.memories.length;
    this.container.innerHTML =
      '<div class="' + PREFIX + '-small" data-action="open-overlay">' +
        '<span class="icon">🧠</span>' +
        '<span class="label">记忆</span>' +
        '<span class="num">' + count + '</span>' +
      '</div>';
  };

  MemoryCard.prototype.renderMedium = function() {
    var recent = this.memories.slice(0, 4);
    var items = '';
    for (var i = 0; i < recent.length; i++) {
      var m = recent[i];
      items +=
        '<div class="' + PREFIX + '-item" data-action="select" data-id="' + m.id + '">' +
          '<div class="row">' +
            '<span class="content">' + escHtml(truncate(m.content, 30)) + '</span>' +
            '<span class="' + PREFIX + '-badge ' + PREFIX + '-badge-' + (m.importance || 'medium') + '">' + escHtml(m.importance || 'medium') + '</span>' +
          '</div>' +
          '<div class="meta"><span>' + timeAgo(m.created_at) + '</span></div>' +
        '</div>';
    }
    this.container.innerHTML =
      '<div class="' + PREFIX + '-header">' +
        '<h3>🧠 记忆 <span class="count">' + this.memories.length + '</span></h3>' +
      '</div>' +
      '<div class="' + PREFIX + '-list">' + (items || '<div class="' + PREFIX + '-empty">暂无记忆</div>') + '</div>';
  };

  MemoryCard.prototype.renderLarge = function() {
    var filtered = this.getFiltered();
    var items = '';
    for (var i = 0; i < filtered.length; i++) {
      var m = filtered[i];
      var tags = '';
      if (m.tags && m.tags.length) {
        for (var j = 0; j < m.tags.length; j++) {
          tags += '<span class="' + PREFIX + '-tag">' + escHtml(m.tags[j]) + '</span>';
        }
      }
      items +=
        '<div class="' + PREFIX + '-item" data-action="select" data-id="' + m.id + '">' +
          '<div class="row">' +
            '<span class="content">' + escHtml(truncate(m.content, 50)) + '</span>' +
            '<span class="' + PREFIX + '-badge ' + PREFIX + '-badge-' + (m.importance || 'medium') + '">' + escHtml(m.importance || 'medium') + '</span>' +
          '</div>' +
          '<div class="row meta">' +
            '<div class="' + PREFIX + '-tags">' + tags + '</div>' +
            '<span>' + timeAgo(m.created_at) + '</span>' +
          '</div>' +
        '</div>';
    }
    this.container.innerHTML =
      '<div class="' + PREFIX + '-header"><h3>🧠 记忆 <span class="count">' + this.memories.length + '</span></h3></div>' +
      '<div class="' + PREFIX + '-toolbar">' +
        '<input class="' + PREFIX + '-search" placeholder="搜索记忆..." value="' + escHtml(this.search) + '" data-field="search">' +
        '<div class="' + PREFIX + '-filter">' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'all' ? ' active' : '') + '" data-action="filter" data-id="all">全部</button>' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'high' ? ' active' : '') + '" data-action="filter" data-id="high">高</button>' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'medium' ? ' active' : '') + '" data-action="filter" data-id="medium">中</button>' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'low' ? ' active' : '') + '" data-action="filter" data-id="low">低</button>' +
        '</div>' +
      '</div>' +
      '<div class="' + PREFIX + '-list">' + (items || '<div class="' + PREFIX + '-empty">暂无记忆</div>') + '</div>';
    this.bindSearch();
  };

  MemoryCard.prototype.renderXLarge = function() {
    if (this.showForm) {
      this.renderForm();
      return;
    }
    if (this.selectedId) {
      this.renderDetail();
      return;
    }
    this.renderXList();
  };

  MemoryCard.prototype.renderXList = function() {
    var filtered = this.getFiltered();
    var items = '';
    for (var i = 0; i < filtered.length; i++) {
      var m = filtered[i];
      var tags = '';
      if (m.tags && m.tags.length) {
        for (var j = 0; j < m.tags.length; j++) {
          tags += '<span class="' + PREFIX + '-tag">' + escHtml(m.tags[j]) + '</span>';
        }
      }
      items +=
        '<div class="' + PREFIX + '-item">' +
          '<div class="row">' +
            '<span class="content" data-action="select" data-id="' + m.id + '">' + escHtml(truncate(m.content, 60)) + '</span>' +
            '<span class="' + PREFIX + '-badge ' + PREFIX + '-badge-' + (m.importance || 'medium') + '">' + escHtml(m.importance || 'medium') + '</span>' +
          '</div>' +
          '<div class="row meta">' +
            '<div class="' + PREFIX + '-tags">' + tags + '</div>' +
            '<span>' + timeAgo(m.created_at) + '</span>' +
          '</div>' +
          '<div class="actions">' +
            '<button class="' + PREFIX + '-btn" data-action="edit" data-id="' + m.id + '">编辑</button>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-danger" data-action="delete" data-id="' + m.id + '">删除</button>' +
          '</div>' +
        '</div>';
    }
    this.container.innerHTML =
      '<div class="' + PREFIX + '-header">' +
        '<h3>🧠 记忆管理 <span class="count">' + this.memories.length + '</span></h3>' +
        '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-primary" data-action="new">新建</button>' +
      '</div>' +
      '<div class="' + PREFIX + '-toolbar">' +
        '<input class="' + PREFIX + '-search" placeholder="搜索记忆..." value="' + escHtml(this.search) + '" data-field="search">' +
        '<div class="' + PREFIX + '-filter">' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'all' ? ' active' : '') + '" data-action="filter" data-id="all">全部</button>' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'high' ? ' active' : '') + '" data-action="filter" data-id="high">高</button>' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'medium' ? ' active' : '') + '" data-action="filter" data-id="medium">中</button>' +
          '<button class="' + PREFIX + '-filter-btn' + (this.filter === 'low' ? ' active' : '') + '" data-action="filter" data-id="low">低</button>' +
        '</div>' +
      '</div>' +
      '<div class="' + PREFIX + '-list">' + (items || '<div class="' + PREFIX + '-empty">暂无记忆</div>') + '</div>';
    this.bindSearch();
  };

  MemoryCard.prototype.renderDetail = function() {
    var m = this.getById(this.selectedId);
    if (!m) {
      this.selectedId = null;
      this.render();
      return;
    }
    var tags = '';
    if (m.tags && m.tags.length) {
      for (var j = 0; j < m.tags.length; j++) {
        tags += '<span class="' + PREFIX + '-tag">' + escHtml(m.tags[j]) + '</span>';
      }
    }
    var html =
      '<div class="' + PREFIX + '-detail">' +
        '<div class="' + PREFIX + '-detail-header">' +
          '<button class="back" data-action="back">← 返回</button>' +
          '<h3>记忆详情</h3>' +
          '<div class="actions">' +
            '<button class="' + PREFIX + '-btn" data-action="edit" data-id="' + m.id + '">编辑</button>' +
            '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-danger" data-action="delete" data-id="' + m.id + '">删除</button>' +
          '</div>' +
        '</div>';

    if (this.confirmDelete) {
      html +=
        '<div class="' + PREFIX + '-confirm-bar">' +
          '<span>确认删除这条记忆？</span>' +
          '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-danger" data-action="confirm-delete" data-id="' + m.id + '">确认</button>' +
          '<button class="' + PREFIX + '-btn" data-action="cancel-delete">取消</button>' +
        '</div>';
    }

    if (this.editing) {
      html += this.getFormHtml(m);
    } else {
      html +=
        '<div class="' + PREFIX + '-detail-content">' + escHtml(m.content) + '</div>' +
        '<div class="' + PREFIX + '-detail-meta">' +
          '<span><span class="' + PREFIX + '-badge ' + PREFIX + '-badge-' + (m.importance || 'medium') + '">' + escHtml(m.importance || 'medium') + '</span></span>' +
          '<span>创建: ' + timeAgo(m.created_at) + '</span>' +
          (m.updated_at ? '<span>更新: ' + timeAgo(m.updated_at) + '</span>' : '') +
          (m.source ? '<span>来源: ' + escHtml(m.source) + '</span>' : '') +
        '</div>' +
        (tags ? '<div class="' + PREFIX + '-tags" style="margin-top:6px">' + tags + '</div>' : '');
    }

    html += '</div>';
    this.container.innerHTML = html;
  };

  MemoryCard.prototype.renderForm = function() {
    var title = this.editing ? '编辑记忆' : '新建记忆';
    this.container.innerHTML =
      '<div class="' + PREFIX + '-detail">' +
        '<div class="' + PREFIX + '-detail-header">' +
          '<button class="back" data-action="cancel-form">← 返回</button>' +
          '<h3>' + title + '</h3>' +
        '</div>' +
        this.getFormHtml(null) +
      '</div>';
  };

  MemoryCard.prototype.getFormHtml = function(m) {
    var fd = this.formData;
    return '<div class="' + PREFIX + '-form">' +
      '<label>内容<textarea name="content">' + escHtml(fd.content) + '</textarea></label>' +
      '<label>重要性<select name="importance">' +
        '<option value="low"' + (fd.importance === 'low' ? ' selected' : '') + '>低</option>' +
        '<option value="medium"' + (fd.importance === 'medium' ? ' selected' : '') + '>中</option>' +
        '<option value="high"' + (fd.importance === 'high' ? ' selected' : '') + '>高</option>' +
      '</select></label>' +
      '<label>标签 (逗号分隔)<input name="tags" value="' + escHtml(fd.tags) + '"></label>' +
      '<label>来源<input name="source" value="' + escHtml(fd.source || '') + '" placeholder="可选"></label>' +
      '<div class="' + PREFIX + '-form-actions">' +
        '<button class="' + PREFIX + '-btn" data-action="cancel-form">取消</button>' +
        '<button class="' + PREFIX + '-btn ' + PREFIX + '-btn-primary" data-action="save">保存</button>' +
      '</div>' +
    '</div>';
  };

  MemoryCard.prototype.bindSearch = function() {
    var self = this;
    var input = this.container.querySelector('[data-field="search"]');
    if (!input) return;
    var handler = function() {
      self.search = input.value;
      self.render();
      self.bindSearch();
    };
    input.addEventListener('input', handler);
  };

  // ── Resize ───────────────────────────────────────────────────────
  MemoryCard.prototype.setSize = function(size) {
    this.size = size;
    this.selectedId = null;
    this.editing = false;
    this.confirmDelete = false;
    this.showForm = false;
    this.render();
  };

  // ── Destroy ──────────────────────────────────────────────────────
  MemoryCard.prototype.destroy = function() {
    if (this._bound.handleClick) {
      this.container.removeEventListener('click', this._bound.handleClick);
    }
    if (this.sseSub && typeof Bus !== 'undefined' && Bus.unsubscribe) {
      Bus.unsubscribe('memories', this.sseSub);
    }
    this.container.innerHTML = '';
    this.container.classList.remove(PREFIX + '-wrap');
  };

  // ── Mount ────────────────────────────────────────────────────────
  function mount(container, options) {
    var card = new MemoryCard(container, options);
    card.init();
    return card;
  }

  function mountEntry(container, options) {
    var entry = new MemoryCard(container, Object.assign({}, options, { size: 'small' }));
    entry.init();
    return entry;
  }

  // ── Register ─────────────────────────────────────────────────────
  WidgetRegistry.register('memory-card', {
    type: 'data',
    label: '记忆',
    icon: 'brain',
    defaultSize: { w: 2, h: 1 },
    category: 'data',
    mount: mount
  });

  WidgetRegistry.register('memory-entry', {
    type: 'entry',
    label: '记忆入口',
    icon: 'brain',
    defaultSize: { w: 1, h: 1 },
    category: 'entries',
    mount: mountEntry
  });

})();
