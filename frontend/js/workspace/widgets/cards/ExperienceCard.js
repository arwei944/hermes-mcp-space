;(function() {
  'use strict';

  var CSS_ID = 'experience-card-css';
  var PREFIX = 'ec';
  var API = '/api/experiences';
  var instanceCount = 0;

  /* ── CSS ─────────────────────────────────────────────── */
  var css = [
    '.ec-wrap{font-family:system-ui,-apple-system,sans-serif;height:100%;display:flex;flex-direction:column;overflow:hidden;color:#e0e0e0;background:#1a1a2e;border-radius:8px;box-sizing:border-box}',
    '.ec-header{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid rgba(255,255,255,.08);flex-shrink:0}',
    '.ec-header h3{margin:0;font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}',
    '.ec-header .ec-count{font-size:11px;color:#888;background:rgba(255,255,255,.06);padding:1px 7px;border-radius:10px}',
    '.ec-body{flex:1;overflow-y:auto;padding:6px 8px}',
    '.ec-body::-webkit-scrollbar{width:4px}',
    '.ec-body::-webkit-scrollbar-thumb{background:rgba(255,255,255,.12);border-radius:2px}',
    '.ec-search{display:flex;gap:6px;padding:6px 8px;flex-shrink:0}',
    '.ec-search input{flex:1;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:5px 10px;color:#e0e0e0;font-size:12px;outline:none}',
    '.ec-search input:focus{border-color:#f0a050}',
    '.ec-filters{display:flex;gap:4px;padding:0 8px 6px;flex-shrink:0;flex-wrap:wrap}',
    '.ec-filter-btn{font-size:11px;padding:2px 10px;border-radius:10px;border:1px solid rgba(255,255,255,.12);background:transparent;color:#aaa;cursor:pointer;transition:.2s}',
    '.ec-filter-btn:hover,.ec-filter-btn.active{background:#f0a050;color:#fff;border-color:#f0a050}',
    '.ec-item{display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;cursor:pointer;transition:.15s;border:1px solid transparent}',
    '.ec-item:hover{background:rgba(255,255,255,.05);border-color:rgba(255,255,255,.08)}',
    '.ec-item .ec-title{flex:1;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
    '.ec-severity{font-size:10px;padding:1px 6px;border-radius:8px;font-weight:600;flex-shrink:0}',
    '.ec-severity-high{background:rgba(255,77,77,.15);color:#ff6b6b}',
    '.ec-severity-medium{background:rgba(255,193,7,.15);color:#ffc107}',
    '.ec-severity-low{background:rgba(76,175,80,.15);color:#66bb6a}',
    '.ec-tool{font-size:10px;color:#888;max-width:80px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex-shrink:0}',
    '.ec-time{font-size:10px;color:#666;flex-shrink:0}',
    '.ec-context{font-size:11px;color:#999;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '.ec-actions{display:flex;gap:4px;flex-shrink:0}',
    '.ec-actions button{background:none;border:none;color:#888;cursor:pointer;font-size:13px;padding:2px 4px;border-radius:4px;transition:.15s}',
    '.ec-actions button:hover{color:#e0e0e0;background:rgba(255,255,255,.1)}',
    '.ec-actions button.danger:hover{color:#ff6b6b}',
    '.ec-btn{font-size:11px;padding:4px 12px;border-radius:6px;border:1px solid rgba(255,255,255,.15);background:rgba(255,255,255,.06);color:#ccc;cursor:pointer;transition:.2s}',
    '.ec-btn:hover{background:#f0a050;color:#fff;border-color:#f0a050}',
    '.ec-btn.primary{background:#f0a050;color:#fff;border-color:#f0a050}',
    '.ec-btn.primary:hover{background:#e09040}',
    '.ec-btn.danger{color:#ff6b6b;border-color:rgba(255,77,77,.3)}',
    '.ec-btn.danger:hover{background:rgba(255,77,77,.15)}',
    '.ec-detail{padding:12px;flex:1;overflow-y:auto}',
    '.ec-detail .ec-back{display:flex;align-items:center;gap:4px;background:none;border:none;color:#f0a050;cursor:pointer;font-size:12px;margin-bottom:10px;padding:4px 8px;border-radius:6px;transition:.15s}',
    '.ec-detail .ec-back:hover{background:rgba(240,160,80,.1)}',
    '.ec-detail .ec-meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0;font-size:12px}',
    '.ec-detail .ec-meta dt{color:#888}',
    '.ec-detail .ec-meta dd{color:#ccc;margin:0}',
    '.ec-detail .ec-content{font-size:12px;line-height:1.7;color:#bbb;padding:10px;background:rgba(255,255,255,.03);border-radius:6px;margin:10px 0;white-space:pre-wrap}',
    '.ec-form{display:flex;flex-direction:column;gap:8px;margin-top:10px}',
    '.ec-form label{font-size:11px;color:#888}',
    '.ec-form input,.ec-form textarea,.ec-form select{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1);border-radius:6px;padding:6px 10px;color:#e0e0e0;font-size:12px;outline:none;font-family:inherit}',
    '.ec-form input:focus,.ec-form textarea:focus,.ec-form select:focus{border-color:#f0a050}',
    '.ec-form textarea{resize:vertical;min-height:80px}',
    '.ec-form select option{background:#1a1a2e;color:#e0e0e0}',
    '.ec-confirm{display:flex;align-items:center;gap:8px;padding:8px 12px;background:rgba(255,77,77,.08);border-radius:6px;margin-top:8px;font-size:12px}',
    '.ec-confirm .ec-confirm-text{flex:1;color:#ff6b6b}',
    '.ec-tags{display:flex;gap:4px;flex-wrap:wrap}',
    '.ec-tag{font-size:10px;padding:1px 7px;border-radius:8px;background:rgba(240,160,80,.12);color:#f0a050}',
    '.ec-empty,.ec-loading,.ec-error{text-align:center;padding:20px;font-size:12px;color:#888}',
    '.ec-loading::after{content:"";display:inline-block;width:16px;height:16px;border:2px solid rgba(255,255,255,.1);border-top-color:#f0a050;border-radius:50%;animation:ec-spin .6s linear infinite;margin-left:6px;vertical-align:middle}',
    '@keyframes ec-spin{to{transform:rotate(360deg)}}',
    '.ec-small{display:flex;align-items:center;justify-content:center;height:100%;cursor:pointer;gap:8px;font-size:14px;font-weight:600;transition:.15s}',
    '.ec-small:hover{background:rgba(240,160,80,.08)}',
    '.ec-small .ec-badge{font-size:11px;background:#f0a050;color:#fff;padding:1px 8px;border-radius:10px}'
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
    if (m < 1) return '\u521A\u521A';
    if (m < 60) return m + '\u5206\u949F\u524D';
    var h = Math.floor(m / 60);
    if (h < 24) return h + '\u5C0F\u65F6\u524D';
    var d = Math.floor(h / 24);
    if (d < 30) return d + '\u5929\u524D';
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  /* ── Card ────────────────────────────────────────────── */
  function createCard(container, opts) {
    injectCSS();
    var uid = ++instanceCount;
    var size = (opts && opts.size) || 'medium';
    var el = document.createElement('div');
    el.className = 'ec-wrap';
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
        state.error = err.message || '\u52A0\u8F7D\u5931\u8D25';
        render();
      });
    }

    function fetchStats() {
      DataService.get(API + '/stats').then(function(res) {
        state.stats = res;
        if (size === 'small') render();
      }).catch(function() {});
    }

    function createExperience(data) {
      return DataService.post(API, data).then(function(res) {
        fetchList();
        fetchStats();
        return res;
      });
    }

    function updateExperience(id, data) {
      return DataService.put(API + '/' + id, data).then(function(res) {
        fetchList();
        fetchStats();
        return res;
      });
    }

    function deleteExperience(id) {
      return DataService.delete(API + '/' + id).then(function() {
        fetchList();
        fetchStats();
        state.view = 'list';
        state.current = null;
        state.deleting = false;
      });
    }

    /* ── SSE ── */
    function subscribeSSE() {
      if (typeof HermesClient === 'undefined' || !HermesClient.sse) return;
      state.sseId = HermesClient.sse.subscribe('experiences', function(event) {
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
          return (r.title || '').toLowerCase().indexOf(q) !== -1 ||
                 (r.content || '').toLowerCase().indexOf(q) !== -1 ||
                 (r.context || '').toLowerCase().indexOf(q) !== -1 ||
                 (r.tool_name || '').toLowerCase().indexOf(q) !== -1 ||
                 (r.error_type || '').toLowerCase().indexOf(q) !== -1;
        });
      }
      if (state.filter !== 'all') {
        list = list.filter(function(r) { return r.severity === state.filter; });
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
      el.innerHTML =
        '<div class="ec-small" data-action="open-overlay">' +
          '<span>\u{1F4A1}</span>' +
          '<span>\u7ECF\u9A8C</span>' +
          '<span class="ec-badge">' + state.data.length + '</span>' +
        '</div>';
    }

    function renderMedium() {
      var list = filtered().slice(0, 8);
      var h = '<div class="ec-header"><h3>\u{1F4A1} \u7ECF\u9A8C <span class="ec-count">' + state.data.length + '</span></h3></div>';
      h += '<div class="ec-body">';
      if (state.loading) { h += '<div class="ec-loading">\u52A0\u8F7D\u4E2D</div>'; }
      else if (state.error) { h += '<div class="ec-error">' + escapeHTML(state.error) + '</div>'; }
      else if (list.length === 0) { h += '<div class="ec-empty">\u6682\u65E0\u7ECF\u9A8C</div>'; }
      else {
        list.forEach(function(r) {
          h += '<div class="ec-item" data-action="open-detail" data-id="' + r.id + '">' +
            '<span class="ec-title">' + escapeHTML(r.title) + '</span>' +
            '<span class="ec-severity ec-severity-' + (r.severity || 'medium') + '">' + escapeHTML(r.severity || 'medium') + '</span>' +
            '<span class="ec-tool">' + escapeHTML(r.tool_name || '') + '</span>' +
            '<span class="ec-time">' + timeAgo(r.created_at) + '</span>' +
          '</div>';
        });
      }
      h += '</div>';
      el.innerHTML = h;
    }

    function renderLarge() {
      var list = filtered().slice(0, 20);
      var h = '<div class="ec-header"><h3>\u{1F4A1} \u7ECF\u9A8C <span class="ec-count">' + state.data.length + '</span></h3></div>';
      h += '<div class="ec-search"><input placeholder="\u641C\u7D22\u7ECF\u9A8C..." data-action="search" value="' + escapeHTML(state.search) + '"></div>';
      h += '<div class="ec-filters">' +
        '<button class="ec-filter-btn ' + (state.filter === 'all' ? 'active' : '') + '" data-action="filter" data-val="all">\u5168\u90E8</button>' +
        '<button class="ec-filter-btn ' + (state.filter === 'high' ? 'active' : '') + '" data-action="filter" data-val="high">\u9AD8</button>' +
        '<button class="ec-filter-btn ' + (state.filter === 'medium' ? 'active' : '') + '" data-action="filter" data-val="medium">\u4E2D</button>' +
        '<button class="ec-filter-btn ' + (state.filter === 'low' ? 'active' : '') + '" data-action="filter" data-val="low">\u4F4E</button>' +
      '</div>';
      h += '<div class="ec-body">';
      if (state.loading) { h += '<div class="ec-loading">\u52A0\u8F7D\u4E2D</div>'; }
      else if (state.error) { h += '<div class="ec-error">' + escapeHTML(state.error) + '</div>'; }
      else if (list.length === 0) { h += '<div class="ec-empty">\u6682\u65E0\u7ECF\u9A8C</div>'; }
      else {
        list.forEach(function(r) {
          h += '<div class="ec-item" data-action="open-detail" data-id="' + r.id + '">' +
            '<span class="ec-title">' + escapeHTML(r.title) + '</span>' +
            '<span class="ec-severity ec-severity-' + (r.severity || 'medium') + '">' + escapeHTML(r.severity || 'medium') + '</span>' +
            '<span class="ec-context">' + escapeHTML(r.context || '') + '</span>' +
            '<span class="ec-tool">' + escapeHTML(r.tool_name || '') + '</span>' +
            '<span class="ec-time">' + timeAgo(r.created_at) + '</span>' +
          '</div>';
        });
      }
      h += '</div>';
      el.innerHTML = h;
    }

    function renderXlList() {
      var list = filtered();
      var h = '<div class="ec-header"><h3>\u{1F4A1} \u7ECF\u9A8C\u5E93 <span class="ec-count">' + state.data.length + '</span></h3>' +
        '<button class="ec-btn primary" data-action="create">\u65B0\u5EFA</button></div>';
      h += '<div class="ec-search"><input placeholder="\u641C\u7D22\u7ECF\u9A8C..." data-action="search" value="' + escapeHTML(state.search) + '"></div>';
      h += '<div class="ec-filters">' +
        '<button class="ec-filter-btn ' + (state.filter === 'all' ? 'active' : '') + '" data-action="filter" data-val="all">\u5168\u90E8</button>' +
        '<button class="ec-filter-btn ' + (state.filter === 'high' ? 'active' : '') + '" data-action="filter" data-val="high">\u9AD8</button>' +
        '<button class="ec-filter-btn ' + (state.filter === 'medium' ? 'active' : '') + '" data-action="filter" data-val="medium">\u4E2D</button>' +
        '<button class="ec-filter-btn ' + (state.filter === 'low' ? 'active' : '') + '" data-action="filter" data-val="low">\u4F4E</button>' +
      '</div>';
      h += '<div class="ec-body">';
      if (state.loading) { h += '<div class="ec-loading">\u52A0\u8F7D\u4E2D</div>'; }
      else if (state.error) { h += '<div class="ec-error">' + escapeHTML(state.error) + '</div>'; }
      else if (list.length === 0) { h += '<div class="ec-empty">\u6682\u65E0\u7ECF\u9A8C</div>'; }
      else {
        list.forEach(function(r) {
          h += '<div class="ec-item">' +
            '<span class="ec-title" data-action="open-detail" data-id="' + r.id + '">' + escapeHTML(r.title) + '</span>' +
            '<span class="ec-severity ec-severity-' + (r.severity || 'medium') + '">' + escapeHTML(r.severity || 'medium') + '</span>' +
            '<span class="ec-context">' + escapeHTML(r.context || '') + '</span>' +
            '<span class="ec-tool">' + escapeHTML(r.tool_name || '') + '</span>';
          if (r.tags && r.tags.length) {
            h += '<span class="ec-tags">';
            r.tags.slice(0, 3).forEach(function(t) { h += '<span class="ec-tag">' + escapeHTML(t) + '</span>'; });
            if (r.tags.length > 3) h += '<span class="ec-tag">+' + (r.tags.length - 3) + '</span>';
            h += '</span>';
          }
          h += '<div class="ec-actions">' +
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
      var h = '<div class="ec-detail">';
      h += '<button class="ec-back" data-action="back">\u2190 \u8FD4\u56DE</button>';
      h += '<div class="ec-header"><h3>' + escapeHTML(r.title) + '</h3></div>';
      h += '<div class="ec-meta">' +
        '<div><dt>\u4E25\u91CD\u7A0B\u5EA6</dt><dd><span class="ec-severity ec-severity-' + (r.severity || 'medium') + '">' + escapeHTML(r.severity || 'medium') + '</span></dd></div>' +
        '<div><dt>\u5DE5\u5177</dt><dd>' + escapeHTML(r.tool_name || '-') + '</dd></div>' +
        '<div><dt>\u9519\u8BEF\u7C7B\u578B</dt><dd>' + escapeHTML(r.error_type || '-') + '</dd></div>' +
        '<div><dt>\u521B\u5EFA\u65F6\u95F4</dt><dd>' + timeAgo(r.created_at) + '</dd></div>' +
        '<div style="grid-column:1/-1"><dt>\u4E0A\u4E0B\u6587</dt><dd>' + escapeHTML(r.context || '-') + '</dd></div>' +
      '</div>';
      if (r.tags && r.tags.length) {
        h += '<div class="ec-tags" style="margin:8px 0">';
        r.tags.forEach(function(t) { h += '<span class="ec-tag">' + escapeHTML(t) + '</span>'; });
        h += '</div>';
      }
      h += '<div class="ec-content">' + escapeHTML(r.content || '') + '</div>';

      if (state.editing) {
        h += '<div class="ec-form">' +
          '<label>\u6807\u9898</label><input id="ec-edit-title" value="' + escapeHTML(r.title) + '">' +
          '<label>\u4E25\u91CD\u7A0B\u5EA6</label><select id="ec-edit-severity">' +
            '<option value="low"' + (r.severity === 'low' ? ' selected' : '') + '>\u4F4E</option>' +
            '<option value="medium"' + (r.severity === 'medium' ? ' selected' : '') + '>\u4E2D</option>' +
            '<option value="high"' + (r.severity === 'high' ? ' selected' : '') + '>\u9AD8</option>' +
          '</select>' +
          '<label>\u4E0A\u4E0B\u6587</label><input id="ec-edit-context" value="' + escapeHTML(r.context || '') + '">' +
          '<label>\u5DE5\u5177\u540D\u79F0</label><input id="ec-edit-tool" value="' + escapeHTML(r.tool_name || '') + '">' +
          '<label>\u9519\u8BEF\u7C7B\u578B</label><input id="ec-edit-error" value="' + escapeHTML(r.error_type || '') + '">' +
          '<label>\u5185\u5BB9</label><textarea id="ec-edit-content">' + escapeHTML(r.content || '') + '</textarea>' +
          '<div style="display:flex;gap:6px;justify-content:flex-end">' +
            '<button class="ec-btn" data-action="cancel-edit">\u53D6\u6D88</button>' +
            '<button class="ec-btn primary" data-action="save-edit">\u4FDD\u5B58</button>' +
          '</div>' +
        '</div>';
      } else if (state.creating) {
        h += '<div class="ec-form">' +
          '<label>\u6807\u9898</label><input id="ec-edit-title" placeholder="\u7ECF\u9A8C\u6807\u9898">' +
          '<label>\u4E25\u91CD\u7A0B\u5EA6</label><select id="ec-edit-severity">' +
            '<option value="low">\u4F4E</option><option value="medium" selected>\u4E2D</option><option value="high">\u9AD8</option>' +
          '</select>' +
          '<label>\u4E0A\u4E0B\u6587</label><input id="ec-edit-context" placeholder="\u4E0A\u4E0B\u6587\u63CF\u8FF0">' +
          '<label>\u5DE5\u5177\u540D\u79F0</label><input id="ec-edit-tool" placeholder="\u76F8\u5173\u5DE5\u5177">' +
          '<label>\u9519\u8BEF\u7C7B\u578B</label><input id="ec-edit-error" placeholder="\u9519\u8BEF\u7C7B\u578B">' +
          '<label>\u5185\u5BB9</label><textarea id="ec-edit-content" placeholder="\u7ECF\u9A8C\u5185\u5BB9..."></textarea>' +
          '<div style="display:flex;gap:6px;justify-content:flex-end">' +
            '<button class="ec-btn" data-action="cancel-create">\u53D6\u6D88</button>' +
            '<button class="ec-btn primary" data-action="save-create">\u521B\u5EFA</button>' +
          '</div>' +
        '</div>';
      } else {
        h += '<div style="display:flex;gap:6px;flex-wrap:wrap;padding-top:8px">' +
          '<button class="ec-btn" data-action="start-edit">\u7F16\u8F91</button>' +
          '<button class="ec-btn danger" data-action="confirm-delete">\u5220\u9664</button>' +
        '</div>';
        if (state.deleting) {
          h += '<div class="ec-confirm">' +
            '<span class="ec-confirm-text">\u786E\u5B9A\u5220\u9664\u8FD9\u6761\u7ECF\u9A8C\uFF1F</span>' +
            '<button class="ec-btn danger" data-action="do-delete">\u5220\u9664</button>' +
            '<button class="ec-btn" data-action="cancel-delete">\u53D6\u6D88</button>' +
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

      switch (action) {
        case 'open-overlay':
          if (typeof CardOverlay !== 'undefined') {
            CardOverlay.open('experience-card', { size: 'xlarge' });
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
          state.current = { id: null, title: '', content: '', severity: 'medium', context: '', tool_name: '', error_type: '', tags: [] };
          state.creating = true;
          state.editing = false;
          state.deleting = false;
          render();
          break;
        case 'save-create':
          var titleEl = el.querySelector('#ec-edit-title');
          var sevEl = el.querySelector('#ec-edit-severity');
          var ctxEl = el.querySelector('#ec-edit-context');
          var toolEl = el.querySelector('#ec-edit-tool');
          var errEl = el.querySelector('#ec-edit-error');
          var contEl = el.querySelector('#ec-edit-content');
          if (titleEl && titleEl.value.trim()) {
            createExperience({
              title: titleEl.value.trim(),
              severity: sevEl ? sevEl.value : 'medium',
              context: ctxEl ? ctxEl.value.trim() : '',
              tool_name: toolEl ? toolEl.value.trim() : '',
              error_type: errEl ? errEl.value.trim() : '',
              content: contEl ? contEl.value.trim() : ''
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
          var etEl = el.querySelector('#ec-edit-title');
          var esEl = el.querySelector('#ec-edit-severity');
          var ectEl = el.querySelector('#ec-edit-context');
          var etoEl = el.querySelector('#ec-edit-tool');
          var eerEl = el.querySelector('#ec-edit-error');
          var ecoEl = el.querySelector('#ec-edit-content');
          if (etEl && etEl.value.trim() && state.current) {
            updateExperience(state.current.id, {
              title: etEl.value.trim(),
              severity: esEl ? esEl.value : state.current.severity,
              context: ectEl ? ectEl.value.trim() : state.current.context,
              tool_name: etoEl ? etoEl.value.trim() : state.current.tool_name,
              error_type: eerEl ? eerEl.value.trim() : state.current.error_type,
              content: ecoEl ? ecoEl.value.trim() : state.current.content
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
            deleteExperience(state.current.id).then(function() { render(); });
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
      Bus.on('experiences:refresh', fetchList);
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
          Bus.off('experiences:refresh', fetchList);
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
    WidgetRegistry.register('experience-card', {
      type: 'data',
      label: '\u7ECF\u9A8C',
      icon: '\u{1F4A1}',
      defaultSize: { w: 2, h: 1 },
      category: 'data',
      mount: mount
    });
    WidgetRegistry.register('experience-entry', {
      type: 'entry',
      label: '\u7ECF\u9A8C\u5165\u53E3',
      icon: '\u{1F4A1}',
      defaultSize: { w: 1, h: 1 },
      category: 'entries',
      mount: mountEntry
    });
  }

})();
