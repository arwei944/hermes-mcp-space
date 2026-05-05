;(function() {
  'use strict';

  var CSS_ID = 'rules-card-css';
  var PREFIX = 'rc';
  var API = '/api/rules';
  var instanceCount = 0;

  /* ── CSS ─────────────────────────────────────────────── */
  var css = [
    '.rc-wrap{font-family:system-ui,-apple-system,sans-serif;height:100%;display:flex;flex-direction:column;overflow:hidden;color:#e0e0e0;background:#1a1a2e;border-radius:8px;box-sizing:border-box}',
    '.rc-header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}',
    '.rc-header h3{margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}',
    '.rc-header .rc-count{font-size:11px;color:#888;background:rgba(255,255,255,.06);padding:1px 7px;border-radius:10px}',
    '.rc-body{flex:1;overflow-y:auto;padding:6px 8px}',
    '.rc-body::-webkit-scrollbar{width:4px}',
    '.rc-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:2px}',
    '.rc-search{display:flex;gap:6px;padding:6px 8px;flex-shrink:0}',
    '.rc-search input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;color:#e0e0e0;font-size:12px;outline:none}',
    '.rc-search input:focus{border-color:#6c8cff}',
    '.rc-filters{display:flex;gap:4px;padding:0 8px 6px;flex-shrink:0;flex-wrap:wrap}',
    '.rc-filter-btn{font-size:11px;padding:2px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#aaa;cursor:pointer;transition:.2s}',
    '.rc-filter-btn:hover,.rc-filter-btn.active{background:#6c8cff;color:#fff;border-color:#6c8cff}',
    '.rc-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:.15s;border:1px solid transparent}',
    '.rc-item:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)}',
    '.rc-item .rc-name{flex:1;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.rc-priority{font-size:10px;padding:1px 6px;border-radius:8px;font-weight:600;flex-shrink:0}',
    '.rc-priority-high{background:rgba(255,77,77,.15);color:#ff6b6b}',
    '.rc-priority-medium{background:rgba(255,193,7,.15);color:#ffc107}',
    '.rc-priority-low{background:rgba(76,175,80,.15);color:#66bb6a}',
    '.rc-enabled{width:7px;height:7px;border-radius:50%;flex-shrink:0}',
    '.rc-enabled.on{background:#66bb6a}',
    '.rc-enabled.off{background:#555}',
    '.rc-scope{font-size:10px;color:#888;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.rc-toggle{width:32px;height:18px;border-radius:9px;border:none;cursor:pointer;position:relative;transition:.2s;flex-shrink:0}',
    '.rc-toggle.on{background:#6c8cff}',
    '.rc-toggle.off{background:#444}',
    '.rc-toggle::after{content:"";position:absolute;top:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:.2s}',
    '.rc-toggle.on::after{left:16px}',
    '.rc-toggle.off::after{left:2px}',
    '.rc-actions{display:flex;gap:4px;flex-shrink:0}',
    '.rc-actions button{background:none;border:none;color:#888;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;transition:.15s}',
    '.rc-actions button:hover{color:#e0e0e0;background:rgba(255,255,255,.1)}',
    '.rc-actions button.danger:hover{color:#ff6b6b}',
    '.rc-btn{font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#ccc;cursor:pointer;transition:.2s}',
    '.rc-btn:hover{background:#6c8cff;color:#fff;border-color:#6c8cff}',
    '.rc-btn.primary{background:#6c8cff;color:#fff;border-color:#6c8cff}',
    '.rc-btn.primary:hover{background:#5a7ae6}',
    '.rc-btn.danger{color:#ff6b6b;border-color:rgba(255,77,77,.3)}',
    '.rc-btn.danger:hover{background:rgba(255,77,77,.15)}',
    '.rc-detail{padding:12px;flex:1;overflow-y:auto}',
    '.rc-detail .rc-back{display:flex;align-items:center;gap:4px;background:none;border:none;color:#6c8cff;cursor:pointer;font-size:12px;margin-bottom:10px;padding:4px 8px;border-radius:6px;transition:.15s}',
    '.rc-detail .rc-back:hover{background:rgba(108,140,255,.1)}',
    '.rc-detail .rc-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;font-size:12px}',
    '.rc-detail .rc-meta dt{color:#888}',
    '.rc-detail .rc-meta dd{color:#ccc;margin:0}',
    '.rc-detail .rc-content{font-size:12px;line-height:1.7;color:#bbb;padding:10px;background:rgba(255,255,255,.03);border-radius:6px;margin:10px 0;white-space:pre-wrap}',
    '.rc-form{display:flex;flex-direction:column;gap:8px;margin-top:10px}',
    '.rc-form label{font-size:11px;color:#888}',
    '.rc-form input,.rc-form textarea,.rc-form select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:6px 10px;color:#e0e0e0;font-size:12px;outline:none;font-family:inherit}',
    '.rc-form input:focus,.rc-form textarea:focus,.rc-form select:focus{border-color:#6c8cff}',
    '.rc-form textarea{resize:vertical;min-height:80px}',
    '.rc-form select option{background:#1a1a2e;color:#e0e0e0}',
    '.rc-confirm{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,77,77,.08);border-radius:6px;margin-top:8px;font-size:12px}',
    '.rc-confirm .rc-confirm-text{flex:1;color:#ff6b6b}',
    '.rc-tags{display:flex;gap:4px;flex-wrap:wrap}',
    '.rc-tag{font-size:10px;padding:1px 7px;border-radius:8px;background:rgba(108,140,255,.12);color:#8ea8ff}',
    '.rc-empty,.rc-loading,.rc-error{text-align:center;padding:20px;font-size:12px;color:#888}',
    '.rc-loading::after{content:"";display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.1);border-top-color:#6c8cff;border-radius:50%;animation:rc-spin .6s linear infinite;margin-left:6px;vertical-align:middle}',
    '@keyframes rc-spin{to{transform:rotate(360deg)}}',
    '.rc-small{display:flex;align-items:center;justify-content:center;height:100%;cursor:pointer;gap:8px;font-size:14px;font-weight:600;transition:.15s}',
    '.rc-small:hover{background:rgba(108,140,255,.08)}',
    '.rc-small .rc-badge{font-size:11px;background:#6c8cff;color:#fff;padding:1px 8px;border-radius:10px}'
  ].join('\n');

  function injectCSS() {
    if (document.getElementById(CSS_ID)) return;
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = css;
    document.head.appendChild(s);
  }

  /* ── Helpers ─────────────────────────────────────────── */
  function escapeHTML(str) {
    var d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  function timeAgo(ts) {
    if (!ts) return '';
    var diff = Date.now() - new Date(ts).getTime();
    var m = Math.floor(diff / 60000);
    if (m < 1) return '刚刚';
    if (m < 60) return m + '分钟前';
    var h = Math.floor(m / 60);
    if (h < 24) return h + '小时前';
    var d = Math.floor(h / 24);
    if (d < 30) return d + '天前';
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  /* ── Card ────────────────────────────────────────────── */
  function createCard(container, opts) {
    injectCSS();
    var uid = ++instanceCount;
    var size = (opts && opts.size) || 'medium';
    var el = document.createElement('div');
    el.className = 'rc-wrap';
    el.setAttribute('data-uid', uid);
    container.appendChild(el);

    var state = {
      data: [],
      stats: null,
      loading: true,
      error: null,
      search: '',
      filter: 'all',
      view: 'list',
      current: null,
      editing: false,
      creating: false,
      deleting: false,
      sseId: null
    };

    /* ── API ── */
    function fetchList() {
      state.loading = true;
      state.error = null;
      DataService.get(API).then(function(res) {
        state.data = (res && res.data) ? res.data : (Array.isArray(res) ? res : []);
        state.loading = false;
        render();
      }).catch(function(err) {
        state.loading = false;
        state.error = err.message || '加载失败';
        render();
      });
    }

    function fetchStats() {
      DataService.get(API + '/stats').then(function(res) {
        state.stats = res;
        if (size === 'small') render();
      }).catch(function() {});
    }

    function createRule(data) {
      return DataService.post(API, data).then(function(res) {
        fetchList();
        fetchStats();
        return res;
      });
    }

    function updateRule(id, data) {
      return DataService.put(API + '/' + id, data).then(function(res) {
        fetchList();
        fetchStats();
        return res;
      });
    }

    function deleteRule(id) {
      return DataService.delete(API + '/' + id).then(function() {
        fetchList();
        fetchStats();
        state.view = 'list';
        state.current = null;
        state.deleting = false;
      });
    }

    function toggleRule(id, enabled) {
      return DataService.put(API + '/' + id, { enabled: enabled }).then(function() {
        fetchList();
        fetchStats();
      });
    }

    /* ── SSE ── */
    function subscribeSSE() {
      if (typeof HermesClient === 'undefined' || !HermesClient.sse) return;
      state.sseId = HermesClient.sse.subscribe('rules', function(event) {
        if (event.type === 'update' || event.type === 'create' || event.type === 'delete') {
          fetchList();
          fetchStats();
        }
      });
    }

    function unsubscribeSSE() {
      if (state.sseId && typeof HermesClient !== 'undefined' && HermesClient.sse) {
        HermesClient.sse.unsubscribe(state.sseId);
        state.sseId = null;
      }
    }

    /* ── Filter ── */
    function filtered() {
      var list = state.data;
      if (state.search) {
        var q = state.search.toLowerCase();
        list = list.filter(function(r) {
          return (r.name || '').toLowerCase().indexOf(q) !== -1 ||
                 (r.content || '').toLowerCase().indexOf(q) !== -1 ||
                 (r.scope || '').toLowerCase().indexOf(q) !== -1;
        });
      }
      if (state.filter !== 'all') {
        list = list.filter(function(r) { return r.priority === state.filter; });
      }
      return list;
    }

    /* ── Render ── */
    function render() {
      if (size === 'small') { renderSmall(); return; }
      if (size === 'xlarge') {
        if (state.view === 'detail') renderXlDetail();
        else renderXlList();
        return;
      }
      if (size === 'large') { renderLarge(); return; }
      renderMedium();
    }

    function renderSmall() {
      var active = state.data.filter(function(r) { return r.enabled; }).length;
      el.innerHTML =
        '<div class="rc-small" data-action="open-overlay">' +
          '<span>\u{1F4CB}</span>' +
          '<span>\u89C4\u5219</span>' +
          '<span class="rc-badge">' + active + '</span>' +
        '</div>';
    }

    function renderMedium() {
      var list = filtered().slice(0, 8);
      var h = '<div class="rc-header"><h3>\u{1F4CB} \u89C4\u5219 <span class="rc-count">' + state.data.length + '</span></h3></div>';
      h += '<div class="rc-body">';
      if (state.loading) { h += '<div class="rc-loading">\u52A0\u8F7D\u4E2D</div>'; }
      else if (state.error) { h += '<div class="rc-error">' + escapeHTML(state.error) + '</div>'; }
      else if (list.length === 0) { h += '<div class="rc-empty">\u6682\u65E0\u89C4\u5219</div>'; }
      else {
        list.forEach(function(r) {
          h += '<div class="rc-item" data-action="open-detail" data-id="' + r.id + '">' +
            '<span class="rc-enabled ' + (r.enabled ? 'on' : 'off') + '"></span>' +
            '<span class="rc-name">' + escapeHTML(r.name) + '</span>' +
            '<span class="rc-priority rc-priority-' + (r.priority || 'medium') + '">' + escapeHTML(r.priority || 'medium') + '</span>' +
          '</div>';
        });
      }
      h += '</div>';
      el.innerHTML = h;
    }

    function renderLarge() {
      var list = filtered().slice(0, 20);
      var h = '<div class="rc-header"><h3>\u{1F4CB} \u89C4\u5219 <span class="rc-count">' + state.data.length + '</span></h3></div>';
      h += '<div class="rc-search"><input placeholder="\u641C\u7D22\u89C4\u5219..." data-action="search" value="' + escapeHTML(state.search) + '"></div>';
      h += '<div class="rc-filters">' +
        '<button class="rc-filter-btn ' + (state.filter === 'all' ? 'active' : '') + '" data-action="filter" data-val="all">\u5168\u90E8</button>' +
        '<button class="rc-filter-btn ' + (state.filter === 'high' ? 'active' : '') + '" data-action="filter" data-val="high">\u9AD8</button>' +
        '<button class="rc-filter-btn ' + (state.filter === 'medium' ? 'active' : '') + '" data-action="filter" data-val="medium">\u4E2D</button>' +
        '<button class="rc-filter-btn ' + (state.filter === 'low' ? 'active' : '') + '" data-action="filter" data-val="low">\u4F4E</button>' +
      '</div>';
      h += '<div class="rc-body">';
      if (state.loading) { h += '<div class="rc-loading">\u52A0\u8F7D\u4E2D</div>'; }
      else if (state.error) { h += '<div class="rc-error">' + escapeHTML(state.error) + '</div>'; }
      else if (list.length === 0) { h += '<div class="rc-empty">\u6682\u65E0\u89C4\u5219</div>'; }
      else {
        list.forEach(function(r) {
          h += '<div class="rc-item">' +
            '<span class="rc-enabled ' + (r.enabled ? 'on' : 'off') + '"></span>' +
            '<span class="rc-name">' + escapeHTML(r.name) + '</span>' +
            '<span class="rc-priority rc-priority-' + (r.priority || 'medium') + '">' + escapeHTML(r.priority || 'medium') + '</span>' +
            '<span class="rc-scope">' + escapeHTML(r.scope || '') + '</span>' +
            '<button class="rc-toggle ' + (r.enabled ? 'on' : 'off') + '" data-action="toggle" data-id="' + r.id + '" data-val="' + (!r.enabled) + '"></button>' +
          '</div>';
        });
      }
      h += '</div>';
      el.innerHTML = h;
    }

    function renderXlList() {
      var list = filtered();
      var h = '<div class="rc-header"><h3>\u{1F4CB} \u89C4\u5219\u7BA1\u7406 <span class="rc-count">' + state.data.length + '</span></h3>' +
        '<button class="rc-btn primary" data-action="create">\u65B0\u5EFA</button></div>';
      h += '<div class="rc-search"><input placeholder="\u641C\u7D22\u89C4\u5219..." data-action="search" value="' + escapeHTML(state.search) + '"></div>';
      h += '<div class="rc-filters">' +
        '<button class="rc-filter-btn ' + (state.filter === 'all' ? 'active' : '') + '" data-action="filter" data-val="all">\u5168\u90E8</button>' +
        '<button class="rc-filter-btn ' + (state.filter === 'high' ? 'active' : '') + '" data-action="filter" data-val="high">\u9AD8</button>' +
        '<button class="rc-filter-btn ' + (state.filter === 'medium' ? 'active' : '') + '" data-action="filter" data-val="medium">\u4E2D</button>' +
        '<button class="rc-filter-btn ' + (state.filter === 'low' ? 'active' : '') + '" data-action="filter" data-val="low">\u4F4E</button>' +
      '</div>';
      h += '<div class="rc-body">';
      if (state.loading) { h += '<div class="rc-loading">\u52A0\u8F7D\u4E2D</div>'; }
      else if (state.error) { h += '<div class="rc-error">' + escapeHTML(state.error) + '</div>'; }
      else if (list.length === 0) { h += '<div class="rc-empty">\u6682\u65E0\u89C4\u5219</div>'; }
      else {
        list.forEach(function(r) {
          h += '<div class="rc-item">' +
            '<span class="rc-enabled ' + (r.enabled ? 'on' : 'off') + '"></span>' +
            '<span class="rc-name" data-action="open-detail" data-id="' + r.id + '">' + escapeHTML(r.name) + '</span>' +
            '<span class="rc-priority rc-priority-' + (r.priority || 'medium') + '">' + escapeHTML(r.priority || 'medium') + '</span>' +
            '<span class="rc-scope">' + escapeHTML(r.scope || '') + '</span>' +
            '<button class="rc-toggle ' + (r.enabled ? 'on' : 'off') + '" data-action="toggle" data-id="' + r.id + '" data-val="' + (!r.enabled) + '"></button>' +
            '<div class="rc-actions">' +
              '<button data-action="edit" data-id="' + r.id + '" title="\u7F16\u8F91">\u270F\uFE0F</button>' +
              '<button class="danger" data-action="delete" data-id="' + r.id + '" title="\u5220\u9664">\u{1F5D1}</button>' +
            '</div>' +
          '</div>';
        });
      }
      h += '</div>';
      el.innerHTML = h;
    }

    function renderXlDetail() {
      var r = state.current;
      if (!r) { state.view = 'list'; renderXlList(); return; }
      var h = '<div class="rc-detail">';
      h += '<button class="rc-back" data-action="back">\u2190 \u8FD4\u56DE</button>';
      h += '<div class="rc-header"><h3>' + escapeHTML(r.name) + '</h3></div>';
      h += '<div class="rc-meta">' +
        '<div><dt>\u4F18\u5148\u7EA7</dt><dd><span class="rc-priority rc-priority-' + (r.priority || 'medium') + '">' + escapeHTML(r.priority || 'medium') + '</span></dd></div>' +
        '<div><dt>\u72B6\u6001</dt><dd><span class="rc-enabled ' + (r.enabled ? 'on' : 'off') + '"></span> ' + (r.enabled ? '\u5DF2\u542F\u7528' : '\u5DF2\u7981\u7528') + '</dd></div>' +
        '<div><dt>\u4F5C\u7528\u57DF</dt><dd>' + escapeHTML(r.scope || '-') + '</dd></div>' +
        '<div><dt>\u66F4\u65B0</dt><dd>' + timeAgo(r.updated_at) + '</dd></div>' +
      '</div>';
      if (r.tags && r.tags.length) {
        h += '<div class="rc-tags">';
        r.tags.forEach(function(t) { h += '<span class="rc-tag">' + escapeHTML(t) + '</span>'; });
        h += '</div>';
      }
      h += '<div class="rc-content">' + escapeHTML(r.content || '') + '</div>';

      if (state.editing) {
        h += '<div class="rc-form">' +
          '<label>\u540D\u79F0</label><input id="rc-edit-name" value="' + escapeHTML(r.name) + '">' +
          '<label>\u4F18\u5148\u7EA7</label><select id="rc-edit-priority">' +
            '<option value="low"' + (r.priority === 'low' ? ' selected' : '') + '>\u4F4E</option>' +
            '<option value="medium"' + (r.priority === 'medium' ? ' selected' : '') + '>\u4E2D</option>' +
            '<option value="high"' + (r.priority === 'high' ? ' selected' : '') + '>\u9AD8</option>' +
          '</select>' +
          '<label>\u4F5C\u7528\u57DF</label><input id="rc-edit-scope" value="' + escapeHTML(r.scope || '') + '">' +
          '<label>\u5185\u5BB9</label><textarea id="rc-edit-content">' + escapeHTML(r.content || '') + '</textarea>' +
          '<div style="display:flex;gap:6px;justify-content:flex-end">' +
            '<button class="rc-btn" data-action="cancel-edit">\u53D6\u6D88</button>' +
            '<button class="rc-btn primary" data-action="save-edit">\u4FDD\u5B58</button>' +
          '</div>' +
        '</div>';
      } else if (state.creating) {
        h += '<div class="rc-form">' +
          '<label>\u540D\u79F0</label><input id="rc-edit-name" placeholder="\u89C4\u5219\u540D\u79F0">' +
          '<label>\u4F18\u5148\u7EA7</label><select id="rc-edit-priority">' +
            '<option value="low">\u4F4E</option><option value="medium" selected>\u4E2D</option><option value="high">\u9AD8</option>' +
          '</select>' +
          '<label>\u4F5C\u7528\u57DF</label><input id="rc-edit-scope" placeholder="\u4F5C\u7528\u57DF">' +
          '<label>\u5185\u5BB9</label><textarea id="rc-edit-content" placeholder="\u89C4\u5219\u5185\u5BB9..."></textarea>' +
          '<div style="display:flex;gap:6px;justify-content:flex-end">' +
            '<button class="rc-btn" data-action="cancel-create">\u53D6\u6D88</button>' +
            '<button class="rc-btn primary" data-action="save-create">\u521B\u5EFA</button>' +
          '</div>' +
        '</div>';
      } else {
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:8px">' +
          '<button class="rc-btn" data-action="toggle-detail" data-id="' + r.id + '" data-val="' + (!r.enabled) + '">' + (r.enabled ? '\u7981\u7528' : '\u542F\u7528') + '</button>' +
          '<button class="rc-btn" data-action="start-edit">\u7F16\u8F91</button>' +
          '<button class="rc-btn danger" data-action="confirm-delete">\u5220\u9664</button>' +
        '</div>';
        if (state.deleting) {
          h += '<div class="rc-confirm">' +
            '<span class="rc-confirm-text">\u786E\u5B9A\u5220\u9664\u8FD9\u6761\u89C4\u5219\uFF1F</span>' +
            '<button class="rc-btn danger" data-action="do-delete">\u5220\u9664</button>' +
            '<button class="rc-btn" data-action="cancel-delete">\u53D6\u6D88</button>' +
          '</div>';
        }
      }
      h += '</div>';
      el.innerHTML = h;
    }

    /* ── Events ── */
    el.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action]');
      if (!target) return;
      var action = target.getAttribute('data-action');
      var id = target.getAttribute('data-id');
      var val = target.getAttribute('data-val');

      switch (action) {
        case 'open-overlay':
          if (typeof CardOverlay !== 'undefined') {
            CardOverlay.open('rules-card', { size: 'xlarge' });
          }
          break;
        case 'open-detail':
          var item = state.data.find(function(r) { return r.id == id; });
          if (item) {
            state.current = item;
            state.view = 'detail';
            state.editing = false;
            state.creating = false;
            state.deleting = false;
            render();
          }
          break;
        case 'toggle':
          toggleRule(id, val === 'true');
          break;
        case 'toggle-detail':
          toggleRule(id, val === 'true').then(function() {
            if (state.current && state.current.id == id) {
              state.current.enabled = val === 'true';
              render();
            }
          });
          break;
        case 'back':
          state.view = 'list';
          state.current = null;
          state.editing = false;
          state.creating = false;
          state.deleting = false;
          render();
          break;
        case 'create':
          state.view = 'detail';
          state.current = { id: null, name: '', content: '', priority: 'medium', scope: '', enabled: true, tags: [] };
          state.creating = true;
          state.editing = false;
          state.deleting = false;
          render();
          break;
        case 'save-create':
          var nameEl = el.querySelector('#rc-edit-name');
          var prioEl = el.querySelector('#rc-edit-priority');
          var scopeEl = el.querySelector('#rc-edit-scope');
          var contentEl = el.querySelector('#rc-edit-content');
          if (nameEl && nameEl.value.trim()) {
            createRule({
              name: nameEl.value.trim(),
              priority: prioEl ? prioEl.value : 'medium',
              scope: scopeEl ? scopeEl.value.trim() : '',
              content: contentEl ? contentEl.value.trim() : '',
              enabled: true
            }).then(function() {
              state.view = 'list';
              state.creating = false;
              render();
            });
          }
          break;
        case 'edit':
          var editItem = state.data.find(function(r) { return r.id == id; });
          if (editItem) {
            state.current = editItem;
            state.view = 'detail';
            state.editing = true;
            state.creating = false;
            state.deleting = false;
            render();
          }
          break;
        case 'start-edit':
          state.editing = true;
          render();
          break;
        case 'save-edit':
          var enEl = el.querySelector('#rc-edit-name');
          var epEl = el.querySelector('#rc-edit-priority');
          var esEl = el.querySelector('#rc-edit-scope');
          var ecEl = el.querySelector('#rc-edit-content');
          if (enEl && enEl.value.trim() && state.current) {
            updateRule(state.current.id, {
              name: enEl.value.trim(),
              priority: epEl ? epEl.value : state.current.priority,
              scope: esEl ? esEl.value.trim() : state.current.scope,
              content: ecEl ? ecEl.value.trim() : state.current.content
            }).then(function() {
              state.editing = false;
              render();
            });
          }
          break;
        case 'cancel-edit':
          state.editing = false;
          render();
          break;
        case 'cancel-create':
          state.creating = false;
          state.view = 'list';
          state.current = null;
          render();
          break;
        case 'confirm-delete':
          state.deleting = true;
          render();
          break;
        case 'do-delete':
          if (state.current) {
            deleteRule(state.current.id).then(function() { render(); });
          }
          break;
        case 'cancel-delete':
          state.deleting = false;
          render();
          break;
      }
    });

    el.addEventListener('input', function(e) {
      if (e.target.getAttribute('data-action') === 'search') {
        state.search = e.target.value;
        render();
        var input = el.querySelector('[data-action="search"]');
        if (input) { input.focus(); input.selectionStart = input.selectionEnd = input.value.length; }
      }
    });

    el.addEventListener('click', function(e) {
      var target = e.target.closest('[data-action="filter"]');
      if (target) {
        state.filter = target.getAttribute('data-val');
        render();
      }
    });

    /* ── Bus ── */
    if (typeof Bus !== 'undefined') {
      Bus.on('rules:refresh', fetchList);
    }

    /* ── Init ── */
    fetchList();
    fetchStats();
    subscribeSSE();

    /* ── Destroy ── */
    return {
      destroy: function() {
        unsubscribeSSE();
        if (typeof Bus !== 'undefined') {
          Bus.off('rules:refresh', fetchList);
        }
        if (el.parentNode) el.parentNode.removeChild(el);
        el.innerHTML = '';
      },
      resize: function(newSize) {
        size = newSize;
        state.view = 'list';
        state.current = null;
        state.editing = false;
        state.creating = false;
        state.deleting = false;
        render();
      }
    };
  }

  /* ── Entry (small) ── */
  function mountEntry(container, opts) {
    return createCard(container, { size: 'small' });
  }

  /* ── Mount ── */
  function mount(container, opts) {
    var size = (opts && opts.size) || 'medium';
    return createCard(container, { size: size });
  }

  /* ── Register ── */
  if (typeof WidgetRegistry !== 'undefined') {
    WidgetRegistry.register('rules-card', {
      type: 'data',
      label: '\u89C4\u5219\u5F15\u64CE',
      icon: '\u{1F4CB}',
      defaultSize: { w: 2, h: 1 },
      category: 'data',
      mount: mount
    });
    WidgetRegistry.register('rules-entry', {
      type: 'entry',
      label: '\u89C4\u5219\u5165\u53E3',
      icon: '\u{1F4CB}',
      defaultSize: { w: 1, h: 1 },
      category: 'entries',
      mount: mountEntry
    });
  }

})();
