;(function () {
    'use strict';

    /* ================================================================
     *  AgentCard.js  —  Hermes Workspace V2  AI Agent 管理卡片
     *  支持 4 种尺寸: small(1x1) / medium(2x1) / large(2x2) / xlarge(全屏)
     * ================================================================ */

    var PREFIX = 'ac';
    var REFRESH_INTERVAL = 5000;
    var DETAIL_REFRESH_INTERVAL = 3000;

    /* ---------- 状态映射 ---------- */
    var STATUS_MAP = {
        running:   { label: '运行中', color: '#22c55e', cls: 'running' },
        completed: { label: '已完成', color: '#3b82f6', cls: 'completed' },
        failed:    { label: '已失败', color: '#ef4444', cls: 'failed' },
        idle:      { label: '空闲',   color: '#eab308', cls: 'idle' },
        pending:   { label: '等待中', color: '#eab308', cls: 'pending' },
        stopped:   { label: '已停止', color: '#9ca3af', cls: 'stopped' }
    };

    /* ---------- 工具函数 ---------- */
    function statusInfo(s) { return STATUS_MAP[s] || STATUS_MAP.idle; }

    function esc(str) {
        var d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    function formatTime(iso) {
        if (!iso) return '--';
        var d = new Date(iso);
        var pad = function (n) { return n < 10 ? '0' + n : n; };
        return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
               ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
    }

    function truncate(str, len) {
        if (!str) return '';
        return str.length > len ? str.slice(0, len) + '...' : str;
    }

    function runningCount(agents) {
        var c = 0;
        for (var i = 0; i < agents.length; i++) {
            if (agents[i].status === 'running') c++;
        }
        return c;
    }

    function progressColor(pct) {
        if (pct >= 80) return '#22c55e';
        if (pct >= 50) return '#3b82f6';
        if (pct >= 20) return '#eab308';
        return '#f97316';
    }

    /* ================================================================
     *  CSS 注入
     * ================================================================ */
    function injectCSS() {
        if (document.getElementById(PREFIX + '-style')) return;
        var css = [
            '.' + PREFIX + '-root { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; color: #e2e8f0; line-height: 1.5; }',
            '.' + PREFIX + '-root *, .' + PREFIX + '-root *::before, .' + PREFIX + '-root *::after { box-sizing: border-box; margin: 0; padding: 0; }',

            /* small */
            '.' + PREFIX + '-small { display: flex; align-items: center; justify-content: center; gap: 8px; height: 100%; cursor: pointer; user-select: none; }',
            '.' + PREFIX + '-small-icon { font-size: 22px; }',
            '.' + PREFIX + '-small-label { font-size: 13px; font-weight: 600; color: #cbd5e1; }',
            '.' + PREFIX + '-small-badge { background: #22c55e; color: #fff; font-size: 11px; font-weight: 700; min-width: 18px; height: 18px; border-radius: 9px; display: flex; align-items: center; justify-content: center; padding: 0 5px; }',

            /* medium */
            '.' + PREFIX + '-medium { display: flex; flex-direction: column; height: 100%; overflow: hidden; }',
            '.' + PREFIX + '-medium-header { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px 6px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }',
            '.' + PREFIX + '-medium-title { font-size: 13px; font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 6px; }',
            '.' + PREFIX + '-medium-list { flex: 1; overflow-y: auto; padding: 6px 12px; }',
            '.' + PREFIX + '-medium-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; }',
            '.' + PREFIX + '-medium-item:last-child { border-bottom: none; }',
            '.' + PREFIX + '-medium-item-name { font-size: 12px; color: #cbd5e1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 90px; }',
            '.' + PREFIX + '-medium-item-bar { flex: 1; height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }',
            '.' + PREFIX + '-medium-item-bar-fill { height: 100%; border-radius: 3px; transition: width .4s ease; }',
            '.' + PREFIX + '-medium-item-status { font-size: 10px; color: #94a3b8; white-space: nowrap; }',
            '.' + PREFIX + '-medium-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 12px; }',

            /* large */
            '.' + PREFIX + '-large { display: flex; flex-direction: column; height: 100%; overflow: hidden; }',
            '.' + PREFIX + '-large-header { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px 8px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }',
            '.' + PREFIX + '-large-title { font-size: 14px; font-weight: 600; color: #e2e8f0; display: flex; align-items: center; gap: 6px; }',
            '.' + PREFIX + '-large-tabs { display: flex; gap: 2px; background: rgba(255,255,255,0.06); border-radius: 6px; padding: 2px; }',
            '.' + PREFIX + '-large-tab { font-size: 11px; padding: 3px 10px; border-radius: 4px; cursor: pointer; color: #94a3b8; border: none; background: none; transition: all .2s; }',
            '.' + PREFIX + '-large-tab.active { background: rgba(255,255,255,0.12); color: #e2e8f0; }',
            '.' + PREFIX + '-large-body { flex: 1; overflow-y: auto; padding: 8px 14px; }',
            '.' + PREFIX + '-large-section-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin: 8px 0 6px; }',
            '.' + PREFIX + '-large-section-title:first-child { margin-top: 0; }',
            '.' + PREFIX + '-large-agent { display: flex; align-items: center; gap: 8px; padding: 7px 0; border-bottom: 1px solid rgba(255,255,255,0.04); cursor: pointer; }',
            '.' + PREFIX + '-large-agent:last-child { border-bottom: none; }',
            '.' + PREFIX + '-large-agent-info { flex: 1; min-width: 0; }',
            '.' + PREFIX + '-large-agent-name { font-size: 12px; font-weight: 600; color: #e2e8f0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.' + PREFIX + '-large-agent-meta { display: flex; align-items: center; gap: 6px; margin-top: 2px; }',
            '.' + PREFIX + '-large-agent-task { font-size: 11px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }',
            '.' + PREFIX + '-type-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; background: rgba(168,85,247,0.15); color: #c084fc; white-space: nowrap; }',
            '.' + PREFIX + '-large-agent-bar { height: 4px; background: rgba(255,255,255,0.08); border-radius: 2px; overflow: hidden; margin-top: 4px; }',
            '.' + PREFIX + '-large-agent-bar-fill { height: 100%; border-radius: 2px; transition: width .4s ease; }',
            '.' + PREFIX + '-large-agent-status { font-size: 10px; white-space: nowrap; display: flex; align-items: center; gap: 4px; }',
            '.' + PREFIX + '-large-agent-time { font-size: 10px; color: #64748b; }',
            '.' + PREFIX + '-btn-terminate { font-size: 10px; padding: 2px 8px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); color: #f87171; cursor: pointer; white-space: nowrap; transition: all .2s; flex-shrink: 0; }',
            '.' + PREFIX + '-btn-terminate:hover { background: rgba(239,68,68,0.25); }',

            /* xlarge */
            '.' + PREFIX + '-xlarge { display: flex; flex-direction: column; height: 100%; overflow: hidden; }',
            '.' + PREFIX + '-xlarge-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }',
            '.' + PREFIX + '-xlarge-title { font-size: 16px; font-weight: 700; color: #f1f5f9; display: flex; align-items: center; gap: 8px; }',
            '.' + PREFIX + '-xlarge-actions { display: flex; align-items: center; gap: 8px; }',
            '.' + PREFIX + '-btn-refresh { font-size: 12px; padding: 4px 12px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: #cbd5e1; cursor: pointer; transition: all .2s; display: flex; align-items: center; gap: 4px; }',
            '.' + PREFIX + '-btn-refresh:hover { background: rgba(255,255,255,0.12); }',
            '.' + PREFIX + '-xlarge-filters { display: flex; gap: 4px; padding: 10px 20px 0; flex-shrink: 0; }',
            '.' + PREFIX + '-xlarge-filter { font-size: 12px; padding: 5px 14px; border-radius: 6px; cursor: pointer; color: #94a3b8; border: 1px solid transparent; background: none; transition: all .2s; }',
            '.' + PREFIX + '-xlarge-filter.active { background: rgba(255,255,255,0.08); color: #e2e8f0; border-color: rgba(255,255,255,0.12); }',
            '.' + PREFIX + '-xlarge-grid { flex: 1; overflow-y: auto; padding: 12px 20px; display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; align-content: start; }',
            '.' + PREFIX + '-agent-card { background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); border-radius: 10px; padding: 14px; cursor: pointer; transition: all .2s; display: flex; flex-direction: column; gap: 8px; }',
            '.' + PREFIX + '-agent-card:hover { background: rgba(255,255,255,0.07); border-color: rgba(255,255,255,0.12); }',
            '.' + PREFIX + '-agent-card-head { display: flex; align-items: center; justify-content: space-between; }',
            '.' + PREFIX + '-agent-card-name { font-size: 14px; font-weight: 600; color: #f1f5f9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; flex: 1; }',
            '.' + PREFIX + '-status-badge { font-size: 10px; font-weight: 600; padding: 2px 8px; border-radius: 10px; white-space: nowrap; }',
            '.' + PREFIX + '-agent-card-task { font-size: 12px; color: #94a3b8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }',
            '.' + PREFIX + '-agent-card-session { font-size: 11px; font-family: "SF Mono", "Fira Code", monospace; color: #64748b; }',
            '.' + PREFIX + '-agent-card-time { font-size: 11px; color: #64748b; }',
            '.' + PREFIX + '-agent-card-progress { height: 6px; background: rgba(255,255,255,0.08); border-radius: 3px; overflow: hidden; }',
            '.' + PREFIX + '-agent-card-progress-fill { height: 100%; border-radius: 3px; transition: width .4s ease; }',
            '.' + PREFIX + '-agent-card-actions { display: flex; justify-content: flex-end; margin-top: 4px; }',

            /* detail */
            '.' + PREFIX + '-detail { display: flex; flex-direction: column; height: 100%; overflow: hidden; }',
            '.' + PREFIX + '-detail-header { display: flex; align-items: center; gap: 12px; padding: 16px 20px 12px; border-bottom: 1px solid rgba(255,255,255,0.06); flex-shrink: 0; }',
            '.' + PREFIX + '-btn-back { font-size: 12px; padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.06); color: #cbd5e1; cursor: pointer; transition: all .2s; display: flex; align-items: center; gap: 4px; }',
            '.' + PREFIX + '-btn-back:hover { background: rgba(255,255,255,0.12); }',
            '.' + PREFIX + '-detail-name { font-size: 16px; font-weight: 700; color: #f1f5f9; flex: 1; }',
            '.' + PREFIX + '-detail-body { flex: 1; overflow-y: auto; padding: 20px; }',
            '.' + PREFIX + '-detail-section { margin-bottom: 20px; }',
            '.' + PREFIX + '-detail-section-title { font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px; }',
            '.' + PREFIX + '-detail-row { display: flex; align-items: center; gap: 8px; padding: 6px 0; }',
            '.' + PREFIX + '-detail-label { font-size: 12px; color: #94a3b8; min-width: 80px; }',
            '.' + PREFIX + '-detail-value { font-size: 13px; color: #e2e8f0; flex: 1; word-break: break-all; }',
            '.' + PREFIX + '-detail-progress { height: 10px; background: rgba(255,255,255,0.08); border-radius: 5px; overflow: hidden; margin-top: 4px; }',
            '.' + PREFIX + '-detail-progress-fill { height: 100%; border-radius: 5px; transition: width .4s ease; }',
            '.' + PREFIX + '-detail-progress-text { font-size: 12px; color: #94a3b8; margin-top: 4px; text-align: right; }',
            '.' + PREFIX + '-detail-terminate { margin-top: 20px; display: flex; justify-content: flex-end; }',
            '.' + PREFIX + '-btn-terminate-lg { font-size: 13px; padding: 8px 20px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.12); color: #f87171; cursor: pointer; transition: all .2s; }',
            '.' + PREFIX + '-btn-terminate-lg:hover { background: rgba(239,68,68,0.25); }',

            /* confirm bar */
            '.' + PREFIX + '-confirm-bar { display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2); border-radius: 6px; margin-top: 6px; }',
            '.' + PREFIX + '-confirm-text { font-size: 11px; color: #fca5a5; flex: 1; }',
            '.' + PREFIX + '-confirm-yes { font-size: 11px; padding: 3px 10px; border-radius: 4px; border: none; background: #ef4444; color: #fff; cursor: pointer; }',
            '.' + PREFIX + '-confirm-no { font-size: 11px; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(255,255,255,0.15); background: none; color: #cbd5e1; cursor: pointer; }',

            /* dot */
            '.' + PREFIX + '-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }',

            /* states */
            '.' + PREFIX + '-loading { display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 12px; }',
            '.' + PREFIX + '-error { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: #f87171; font-size: 12px; gap: 6px; }',
            '.' + PREFIX + '-error-btn { font-size: 11px; padding: 3px 10px; border-radius: 4px; border: 1px solid rgba(239,68,68,0.3); background: rgba(239,68,68,0.1); color: #f87171; cursor: pointer; }',
            '.' + PREFIX + '-empty { display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 12px; }'
        ].join('\n');
        var style = document.createElement('style');
        style.id = PREFIX + '-style';
        style.textContent = css;
        document.head.appendChild(style);
    }

    /* ================================================================
     *  数据层
     * ================================================================ */
    function fetchAgents(cb) {
        HermesClient.cachedGet('agents:list', function () {
            return HermesClient.get('/api/agents');
        }).then(function (res) {
            var agents = Array.isArray(res) ? res : (res && res.agents ? res.agents : []);
            cb(null, agents);
        }).catch(function (err) {
            cb(err);
        });
    }

    function terminateAgent(id, cb) {
        HermesClient.post('/api/agents/' + id + '/terminate').then(function () {
            HermesClient.invalidateCache && HermesClient.invalidateCache('agents:list');
            cb(null);
        }).catch(function (err) {
            cb(err);
        });
    }

    /* ================================================================
     *  Small (1x1)
     * ================================================================ */
    function renderSmall(container, agents) {
        var count = runningCount(agents);
        container.innerHTML =
            '<div class="' + PREFIX + '-small" data-action="open-overlay">' +
                '<span class="' + PREFIX + '-small-icon">\u{1F916}</span>' +
                '<span class="' + PREFIX + '-small-label">AI\u52A9\u624B</span>' +
                (count > 0 ? '<span class="' + PREFIX + '-small-badge">' + count + '</span>' : '') +
            '</div>';
    }

    /* ================================================================
     *  Medium (2x1)
     * ================================================================ */
    function renderMedium(container, agents) {
        var running = [];
        for (var i = 0; i < agents.length; i++) {
            if (agents[i].status === 'running') running.push(agents[i]);
        }

        var html = '<div class="' + PREFIX + '-medium">';
        html += '<div class="' + PREFIX + '-medium-header">';
        html += '<div class="' + PREFIX + '-medium-title"><span>\u{1F916}</span> AI\u52A9\u624B</div>';
        html += '<span style="font-size:11px;color:#64748b">' + running.length + ' \u8FD0\u884C\u4E2D</span>';
        html += '</div>';

        if (running.length === 0) {
            html += '<div class="' + PREFIX + '-medium-empty">\u6682\u65E0\u8FD0\u884C\u4E2D\u7684 Agent</div>';
        } else {
            html += '<div class="' + PREFIX + '-medium-list">';
            for (var j = 0; j < running.length; j++) {
                var a = running[j];
                var pct = typeof a.progress === 'number' ? a.progress : 0;
                html += '<div class="' + PREFIX + '-medium-item" data-action="open-detail" data-agent-id="' + esc(a.id) + '">';
                html += '<span class="' + PREFIX + '-medium-item-name">' + esc(a.name) + '</span>';
                html += '<div class="' + PREFIX + '-medium-item-bar"><div class="' + PREFIX + '-medium-item-bar-fill" style="width:' + pct + '%;background:' + progressColor(pct) + '"></div></div>';
                html += '<span class="' + PREFIX + '-medium-item-status">' + pct + '%</span>';
                html += '</div>';
            }
            html += '</div>';
        }
        html += '</div>';
        container.innerHTML = html;
    }

    /* ================================================================
     *  Large (2x2)
     * ================================================================ */
    function renderLarge(container, agents, tab) {
        var running = [];
        var others = [];
        for (var i = 0; i < agents.length; i++) {
            if (agents[i].status === 'running') running.push(agents[i]);
            else others.push(agents[i]);
        }

        var showRunning = tab === 'running';
        var list = showRunning ? running : agents;

        var html = '<div class="' + PREFIX + '-large">';
        html += '<div class="' + PREFIX + '-large-header">';
        html += '<div class="' + PREFIX + '-large-title"><span>\u{1F916}</span> AI\u52A9\u624B</div>';
        html += '<div class="' + PREFIX + '-large-tabs">';
        html += '<button class="' + PREFIX + '-large-tab' + (showRunning ? ' active' : '') + '" data-action="tab" data-tab="running">\u8FD0\u884C\u4E2D (' + running.length + ')</button>';
        html += '<button class="' + PREFIX + '-large-tab' + (!showRunning ? ' active' : '') + '" data-action="tab" data-tab="all">\u5168\u90E8 (' + agents.length + ')</button>';
        html += '</div></div>';

        html += '<div class="' + PREFIX + '-large-body">';
        if (list.length === 0) {
            html += '<div class="' + PREFIX + '-empty">' + (showRunning ? '\u6682\u65E0\u8FD0\u884C\u4E2D\u7684 Agent' : '\u6682\u65E0 Agent') + '</div>';
        } else {
            if (showRunning) {
                html += '<div class="' + PREFIX + '-large-section-title">\u8FD0\u884C\u4E2D</div>';
                for (var r = 0; r < list.length; r++) {
                    html += renderLargeAgentItem(list[r], true);
                }
            } else {
                if (running.length > 0) {
                    html += '<div class="' + PREFIX + '-large-section-title">\u8FD0\u884C\u4E2D</div>';
                    for (var r2 = 0; r2 < running.length; r2++) {
                        html += renderLargeAgentItem(running[r2], true);
                    }
                }
                if (others.length > 0) {
                    html += '<div class="' + PREFIX + '-large-section-title">\u5176\u4ED6</div>';
                    for (var o = 0; o < others.length; o++) {
                        html += renderLargeAgentItem(others[o], false);
                    }
                }
            }
        }
        html += '</div></div>';
        container.innerHTML = html;
    }

    function renderLargeAgentItem(a, isRunning) {
        var si = statusInfo(a.status);
        var pct = typeof a.progress === 'number' ? a.progress : 0;
        var html = '<div class="' + PREFIX + '-large-agent" data-action="open-detail" data-agent-id="' + esc(a.id) + '">';
        html += '<div class="' + PREFIX + '-large-agent-info">';
        html += '<div class="' + PREFIX + '-large-agent-name">' + esc(a.name) + '</div>';
        html += '<div class="' + PREFIX + '-large-agent-meta">';
        html += '<span class="' + PREFIX + '-type-badge">' + esc(a.type) + '</span>';
        if (a.currentTask) {
            html += '<span class="' + PREFIX + '-large-agent-task">' + esc(truncate(a.currentTask, 30)) + '</span>';
        }
        html += '</div>';
        if (isRunning) {
            html += '<div class="' + PREFIX + '-large-agent-bar"><div class="' + PREFIX + '-large-agent-bar-fill" style="width:' + pct + '%;background:' + progressColor(pct) + '"></div></div>';
        }
        html += '</div>';
        html += '<div class="' + PREFIX + '-large-agent-status">';
        html += '<span class="' + PREFIX + '-dot" style="background:' + si.color + '"></span>';
        html += '<span style="color:' + si.color + '">' + si.label + '</span>';
        if (!isRunning && a.startTime) {
            html += '<span class="' + PREFIX + '-large-agent-time">' + formatTime(a.startTime) + '</span>';
        }
        html += '</div>';
        if (isRunning) {
            html += '<button class="' + PREFIX + '-btn-terminate" data-action="terminate" data-agent-id="' + esc(a.id) + '" onclick="event.stopPropagation()">\u7EC8\u6B62</button>';
        }
        html += '</div>';
        return html;
    }

    /* ================================================================
     *  XLarge (full overlay) — list state
     * ================================================================ */
    function renderXLargeList(container, agents, filter) {
        var filtered = agents;
        if (filter === 'running') {
            filtered = [];
            for (var i = 0; i < agents.length; i++) {
                if (agents[i].status === 'running') filtered.push(agents[i]);
            }
        } else if (filter === 'completed') {
            filtered = [];
            for (var j = 0; j < agents.length; j++) {
                if (agents[j].status === 'completed') filtered.push(agents[j]);
            }
        } else if (filter === 'failed') {
            filtered = [];
            for (var k = 0; k < agents.length; k++) {
                if (agents[k].status === 'failed') filtered.push(agents[k]);
            }
        }

        var rc = runningCount(agents);

        var html = '<div class="' + PREFIX + '-xlarge">';
        html += '<div class="' + PREFIX + '-xlarge-header">';
        html += '<div class="' + PREFIX + '-xlarge-title"><span>\u{1F916}</span> AI \u52A9\u624B';
        if (rc > 0) html += '<span class="' + PREFIX + '-small-badge">' + rc + '</span>';
        html += '</div>';
        html += '<div class="' + PREFIX + '-xlarge-actions">';
        html += '<button class="' + PREFIX + '-btn-refresh" data-action="refresh">\u{1F504} \u5237\u65B0</button>';
        html += '</div></div>';

        html += '<div class="' + PREFIX + '-xlarge-filters">';
        var filters = [
            { key: 'all', label: '\u5168\u90E8' },
            { key: 'running', label: '\u8FD0\u884C\u4E2D' },
            { key: 'completed', label: '\u5DF2\u5B8C\u6210' },
            { key: 'failed', label: '\u5DF2\u5931\u8D25' }
        ];
        for (var f = 0; f < filters.length; f++) {
            var fc = filters[f];
            html += '<button class="' + PREFIX + '-xlarge-filter' + (filter === fc.key ? ' active' : '') + '" data-action="filter" data-filter="' + fc.key + '">' + fc.label + '</button>';
        }
        html += '</div>';

        html += '<div class="' + PREFIX + '-xlarge-grid">';
        if (filtered.length === 0) {
            html += '<div class="' + PREFIX + '-empty" style="grid-column:1/-1">\u6682\u65E0\u6570\u636E</div>';
        } else {
            for (var m = 0; m < filtered.length; m++) {
                html += renderXLargeAgentCard(filtered[m]);
            }
        }
        html += '</div></div>';
        container.innerHTML = html;
    }

    function renderXLargeAgentCard(a) {
        var si = statusInfo(a.status);
        var pct = typeof a.progress === 'number' ? a.progress : 0;
        var isRunning = a.status === 'running';

        var html = '<div class="' + PREFIX + '-agent-card" data-action="view-detail" data-agent-id="' + esc(a.id) + '">';
        html += '<div class="' + PREFIX + '-agent-card-head">';
        html += '<span class="' + PREFIX + '-agent-card-name">' + esc(a.name) + '</span>';
        html += '<span class="' + PREFIX + '-status-badge" style="background:' + si.color + '22;color:' + si.color + '">' + si.label + '</span>';
        html += '</div>';
        html += '<span class="' + PREFIX + '-type-badge">' + esc(a.type) + '</span>';
        if (a.currentTask) {
            html += '<div class="' + PREFIX + '-agent-card-task">' + esc(truncate(a.currentTask, 50)) + '</div>';
        }
        if (a.sessionId) {
            html += '<div class="' + PREFIX + '-agent-card-session">Session: ' + esc(a.sessionId) + '</div>';
        }
        if (a.startTime) {
            html += '<div class="' + PREFIX + '-agent-card-time">' + formatTime(a.startTime) + '</div>';
        }
        if (isRunning) {
            html += '<div class="' + PREFIX + '-agent-card-progress"><div class="' + PREFIX + '-agent-card-progress-fill" style="width:' + pct + '%;background:' + progressColor(pct) + '"></div></div>';
            html += '<div class="' + PREFIX + '-agent-card-actions">';
            html += '<button class="' + PREFIX + '-btn-terminate" data-action="terminate" data-agent-id="' + esc(a.id) + '" onclick="event.stopPropagation()">\u7EC8\u6B62</button>';
            html += '</div>';
        }
        html += '</div>';
        return html;
    }

    /* ================================================================
     *  XLarge — detail state
     * ================================================================ */
    function renderXLargeDetail(container, agent) {
        if (!agent) {
            container.innerHTML = '<div class="' + PREFIX + '-empty">\u672A\u627E\u5230 Agent \u4FE1\u606F</div>';
            return;
        }
        var si = statusInfo(agent.status);
        var pct = typeof agent.progress === 'number' ? agent.progress : 0;
        var isRunning = agent.status === 'running';

        var html = '<div class="' + PREFIX + '-detail">';
        html += '<div class="' + PREFIX + '-detail-header">';
        html += '<button class="' + PREFIX + '-btn-back" data-action="back">\u2190 \u8FD4\u56DE</button>';
        html += '<span class="' + PREFIX + '-detail-name">' + esc(agent.name) + '</span>';
        html += '<span class="' + PREFIX + '-status-badge" style="background:' + si.color + '22;color:' + si.color + '">' + si.label + '</span>';
        html += '</div>';

        html += '<div class="' + PREFIX + '-detail-body">';
        html += '<div class="' + PREFIX + '-detail-section">';
        html += '<div class="' + PREFIX + '-detail-section-title">\u57FA\u672C\u4FE1\u606F</div>';
        html += '<div class="' + PREFIX + '-detail-row"><span class="' + PREFIX + '-detail-label">\u7C7B\u578B</span><span class="' + PREFIX + '-type-badge">' + esc(agent.type) + '</span></div>';
        html += '<div class="' + PREFIX + '-detail-row"><span class="' + PREFIX + '-detail-label">\u5F53\u524D\u4EFB\u52A1</span><span class="' + PREFIX + '-detail-value">' + (esc(agent.currentTask) || '--') + '</span></div>';
        html += '<div class="' + PREFIX + '-detail-row"><span class="' + PREFIX + '-detail-label">Session ID</span><span class="' + PREFIX + '-detail-value" style="font-family:monospace;font-size:12px">' + (esc(agent.sessionId) || '--') + '</span></div>';
        html += '<div class="' + PREFIX + '-detail-row"><span class="' + PREFIX + '-detail-label">\u542F\u52A8\u65F6\u95F4</span><span class="' + PREFIX + '-detail-value">' + formatTime(agent.startTime) + '</span></div>';
        html += '</div>';

        html += '<div class="' + PREFIX + '-detail-section">';
        html += '<div class="' + PREFIX + '-detail-section-title">\u8FDB\u5EA6</div>';
        html += '<div class="' + PREFIX + '-detail-progress"><div class="' + PREFIX + '-detail-progress-fill" style="width:' + pct + '%;background:' + progressColor(pct) + '"></div></div>';
        html += '<div class="' + PREFIX + '-detail-progress-text">' + pct + '%</div>';
        html += '</div>';

        if (isRunning) {
            html += '<div class="' + PREFIX + '-detail-terminate">';
            html += '<button class="' + PREFIX + '-btn-terminate-lg" data-action="terminate" data-agent-id="' + esc(agent.id) + '">\u7EC8\u6B62 Agent</button>';
            html += '</div>';
        }
        html += '</div></div>';
        container.innerHTML = html;
    }

    /* ================================================================
     *  Card 实例管理
     * ================================================================ */
    var instances = {};

    function CardInstance(el, size) {
        this.el = el;
        this.size = size;
        this.agents = [];
        this.loading = false;
        this.error = null;
        this.timer = null;
        this.detailTimer = null;
        /* large tab */
        this.tab = 'running';
        /* xlarge state */
        this.filter = 'all';
        this.state = 'list';
        this.detailAgentId = null;
        this.confirmId = null;
    }

    CardInstance.prototype.init = function () {
        var self = this;
        this.el.addEventListener('click', function (e) {
            self.handleClick(e);
        });
        this.refresh();
        this._sseHandler = function () { self.refresh(); };
        Bus.on('sse:agent.*', this._sseHandler);
    };

    CardInstance.prototype.destroy = function () {
        if (this.timer) { clearInterval(this.timer); this.timer = null; }
        if (this.detailTimer) { clearInterval(this.detailTimer); this.detailTimer = null; }
        if (this._sseHandler) { Bus.off('sse:agent.*', this._sseHandler); }
    };

    CardInstance.prototype.refresh = function () {
        var self = this;
        if (this.loading) return;
        this.loading = true;
        this.renderLoading();
        fetchAgents(function (err, agents) {
            self.loading = false;
            if (err) {
                self.error = err;
                self.renderError();
                return;
            }
            self.error = null;
            self.agents = agents;
            self.render();
            self.manageAutoRefresh();
        });
    };

    CardInstance.prototype.refreshDetail = function () {
        var self = this;
        if (!this.detailAgentId) return;
        fetchAgents(function (err, agents) {
            if (err) return;
            self.agents = agents;
            var agent = null;
            for (var i = 0; i < agents.length; i++) {
                if (agents[i].id === self.detailAgentId) { agent = agents[i]; break; }
            }
            if (agent && agent.status === 'running') {
                renderXLargeDetail(self.el, agent);
            } else if (agent) {
                renderXLargeDetail(self.el, agent);
                if (self.detailTimer) { clearInterval(self.detailTimer); self.detailTimer = null; }
            }
        });
    };

    CardInstance.prototype.manageAutoRefresh = function () {
        var hasRunning = runningCount(this.agents) > 0;
        if (hasRunning && !this.timer && (this.size === 'medium' || this.size === 'large')) {
            var self = this;
            this.timer = setInterval(function () { self.refresh(); }, REFRESH_INTERVAL);
        } else if (!hasRunning && this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    };

    CardInstance.prototype.renderLoading = function () {
        this.el.innerHTML = '<div class="' + PREFIX + '-loading">\u52A0\u8F7D\u4E2D...</div>';
    };

    CardInstance.prototype.renderError = function () {
        this.el.innerHTML =
            '<div class="' + PREFIX + '-error">' +
                '<span>\u52A0\u8F7D\u5931\u8D25</span>' +
                '<button class="' + PREFIX + '-error-btn" data-action="retry">\u91CD\u8BD5</button>' +
            '</div>';
    };

    CardInstance.prototype.render = function () {
        switch (this.size) {
            case 'small':  renderSmall(this.el, this.agents); break;
            case 'medium': renderMedium(this.el, this.agents); break;
            case 'large':  renderLarge(this.el, this.agents, this.tab); break;
            case 'xlarge':
                if (this.state === 'list') renderXLargeList(this.el, this.agents, this.filter);
                break;
        }
    };

    CardInstance.prototype.handleClick = function (e) {
        var target = e.target.closest('[data-action]');
        if (!target) return;
        var action = target.getAttribute('data-action');
        var agentId = target.getAttribute('data-agent-id');

        switch (action) {
            case 'open-overlay':
                CardOverlay.open('agent-card');
                break;
            case 'open-detail':
                if (agentId) CardOverlay.open('agent-card', { agentId: agentId });
                break;
            case 'tab':
                this.tab = target.getAttribute('data-tab') || 'running';
                this.render();
                break;
            case 'filter':
                this.filter = target.getAttribute('data-filter') || 'all';
                this.state = 'list';
                this.render();
                break;
            case 'refresh':
                this.refresh();
                break;
            case 'retry':
                this.refresh();
                break;
            case 'view-detail':
                if (agentId) this.showDetail(agentId);
                break;
            case 'back':
                this.hideDetail();
                break;
            case 'terminate':
                if (agentId) this.handleTerminate(agentId, target);
                break;
            case 'confirm-terminate':
                this.doTerminate(this.confirmId);
                break;
            case 'cancel-terminate':
                this.confirmId = null;
                this.render();
                break;
        }
    };

    CardInstance.prototype.showDetail = function (agentId) {
        this.state = 'detail';
        this.detailAgentId = agentId;
        var agent = null;
        for (var i = 0; i < this.agents.length; i++) {
            if (this.agents[i].id === agentId) { agent = this.agents[i]; break; }
        }
        renderXLargeDetail(this.el, agent);

        if (CardOverlay && CardOverlay.pushView) {
            CardOverlay.pushView({ onBack: function () {}.bind(this) });
        }

        if (agent && agent.status === 'running') {
            var self = this;
            if (this.detailTimer) clearInterval(this.detailTimer);
            this.detailTimer = setInterval(function () { self.refreshDetail(); }, DETAIL_REFRESH_INTERVAL);
        }
    };

    CardInstance.prototype.hideDetail = function () {
        if (this.detailTimer) { clearInterval(this.detailTimer); this.detailTimer = null; }
        this.state = 'list';
        this.detailAgentId = null;
        this.confirmId = null;
        this.render();

        if (CardOverlay && CardOverlay.popView) {
            CardOverlay.popView();
        }
    };

    CardInstance.prototype.handleTerminate = function (agentId, btn) {
        var self = this;
        this.confirmId = agentId;
        /* Insert inline confirm bar after button */
        var existing = btn.parentNode.querySelector('.' + PREFIX + '-confirm-bar');
        if (existing) { existing.remove(); }
        var bar = document.createElement('div');
        bar.className = PREFIX + '-confirm-bar';
        bar.innerHTML =
            '<span class="' + PREFIX + '-confirm-text">\u786E\u5B9A\u8981\u7EC8\u6B62\u8BE5 Agent \u5417\uFF1F</span>' +
            '<button class="' + PREFIX + '-confirm-yes" data-action="confirm-terminate">\u786E\u5B9A</button>' +
            '<button class="' + PREFIX + '-confirm-no" data-action="cancel-terminate">\u53D6\u6D88</button>';
        btn.parentNode.appendChild(bar);
    };

    CardInstance.prototype.doTerminate = function (agentId) {
        var self = this;
        this.confirmId = null;
        terminateAgent(agentId, function (err) {
            if (err) {
                /* show error inline or just refresh */
            }
            self.refresh();
        });
    };

    /* ================================================================
     *  Mount 函数
     * ================================================================ */
    function mount(el, opts) {
        injectCSS();
        var size = (opts && opts.size) || 'medium';
        var inst = new CardInstance(el, size);
        instances[inst._uid = '_' + Math.random().toString(36).slice(2, 9)] = inst;
        inst.init();
        return {
            destroy: function () { inst.destroy(); delete instances[inst._uid]; },
            resize: function (newSize) { inst.size = newSize; inst.render(); }
        };
    }

    /* ================================================================
     *  Entry mount (small)
     * ================================================================ */
    function mountEntry(el) {
        return mount(el, { size: 'small' });
    }

    /* ================================================================
     *  Registration
     * ================================================================ */
    WidgetRegistry.register('agent-card', {
        type: 'data',
        label: 'AI\u52A9\u624B',
        icon: '\u{1F916}',
        description: 'AI Agent \u7BA1\u7406\uFF0C\u67E5\u770B\u8FD0\u884C\u72B6\u6001\u548C\u7EC8\u6B62\u4EFB\u52A1',
        defaultSize: { w: 2, h: 1 },
        category: 'data',
        mount: mount
    });

    WidgetRegistry.register('agent-entry', {
        type: 'entry',
        label: 'AI\u52A9\u624B\u5165\u53E3',
        icon: '\u{1F916}',
        description: 'AI\u52A9\u624B\u5FEB\u901F\u5165\u53E3',
        defaultSize: { w: 1, h: 1 },
        category: 'entries',
        mount: mountEntry
    });

})();
