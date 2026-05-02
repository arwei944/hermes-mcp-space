/**
 * 会话页面 - 分析仪表盘模块
 * 会话统计概览、趋势图、分布图、行为画像
 */

const AnalyticsView = (() => {
    // ---- 状态 ----
    var _analyticsData = null;
    var _trendPeriod = 'daily';

    // ==========================================
    // 数据加载
    // ==========================================

    async function loadAnalytics() {
        try {
            var results = await Promise.all([
                API.sessions.analyticsOverview(),
                API.sessions.analyticsDistribution(),
                API.sessions.analyticsBehavior(),
            ]);
            _analyticsData = {
                overview: results[0],
                distribution: results[1],
                behavior: results[2],
            };
        } catch (_err) {
            _analyticsData = null;
        }
    }

    async function loadTrends(period) {
        _trendPeriod = period;
        try {
            var data = await API.sessions.analyticsTrends({ period: period, days: 30 });
            if (_analyticsData) _analyticsData.trends = data;
            var trendsEl = document.getElementById('trendsSection');
            if (trendsEl) trendsEl.innerHTML = buildTrendsChart(data);
        } catch (_err) {}
    }

    function changeTrendPeriod(period) {
        _trendPeriod = period;
        document.querySelectorAll('.period-btn').forEach(function (btn) {
            btn.classList.toggle('active', btn.dataset.period === period);
        });
        loadTrends(period);
    }

    // ==========================================
    // 渲染入口
    // ==========================================

    function render(containerSelector) {
        var container = document.querySelector(containerSelector);
        if (!container) return;
        container.innerHTML = buildAnalyticsDashboard();
    }

    function buildAnalyticsDashboard() {
        var d = _analyticsData;
        var overview = d && d.overview || {};
        var dist = d && d.distribution || {};
        var behavior = d && d.behavior || {};

        var totalSessions = overview.total_sessions || 0;
        var totalMessages = overview.total_messages || 0;
        var todaySessions = overview.today_sessions || 0;
        var avgMessages = overview.avg_messages_per_session || '0';
        var totalTags = overview.total_tags || 0;

        // Overview cards
        var overviewHtml = '<div class="overview-grid">' +
            buildOverviewCard(totalSessions, '总会话', 'var(--blue)') +
            buildOverviewCard(totalMessages, '总消息', 'var(--green)') +
            buildOverviewCard(todaySessions, '今日会话', 'var(--orange)') +
            buildOverviewCard(avgMessages, '平均消息数', 'var(--purple)') +
            buildOverviewCard(totalTags, '标签数', 'var(--text-tertiary)') +
        '</div>';

        // Trends section
        var trendsData = d && d.trends || null;
        var trendsHtml = '<div class="analytics-card" id="trendsSection">' +
            '<div class="analytics-card-title">' + Components.icon('activity', 15) + ' 会话趋势' +
                '<div class="period-toggle" style="margin-left:auto">' +
                    '<button type="button" class="period-btn ' + (_trendPeriod === 'daily' ? 'active' : '') + '" data-action="changeTrendPeriod" data-period="daily">日</button>' +
                    '<button type="button" class="period-btn ' + (_trendPeriod === 'weekly' ? 'active' : '') + '" data-action="changeTrendPeriod" data-period="weekly">周</button>' +
                    '<button type="button" class="period-btn ' + (_trendPeriod === 'monthly' ? 'active' : '') + '" data-action="changeTrendPeriod" data-period="monthly">月</button>' +
                '</div>' +
            '</div>' +
            (trendsData ? buildTrendsChart(trendsData) : '<div style="text-align:center;padding:40px;color:var(--text-tertiary);font-size:12px">加载中...</div>') +
        '</div>';

        // Distribution section
        var modelDist = dist.models || dist.model_distribution || [];
        var sourceDist = dist.sources || dist.source_distribution || [];

        var modelDistHtml = '<div class="analytics-card">' +
            '<div class="analytics-card-title">' + Components.icon('bot', 15) + ' 模型使用分布</div>' +
            buildDistributionBars(modelDist, 'var(--blue)') +
        '</div>';

        var sourceDistHtml = '<div class="analytics-card">' +
            '<div class="analytics-card-title">' + Components.icon('pin', 15) + ' 来源分布</div>' +
            buildDistributionBars(sourceDist, 'var(--green)') +
        '</div>';

        // Hourly heatmap
        var hourlyData = behavior.hourly_distribution || behavior.hourly || [];
        var hourlyHtml = '<div class="analytics-card">' +
            '<div class="analytics-card-title">' + Components.icon('clock', 15) + ' 活跃时段分布</div>' +
            buildHourlyChart(hourlyData) +
        '</div>';

        // Behavior profile
        var behaviorHtml = '<div class="analytics-card">' +
            '<div class="analytics-card-title">' + Components.icon('user', 15) + ' Agent 行为画像</div>' +
            buildBehaviorProfile(behavior) +
        '</div>';

        return '<div style="padding:20px;max-width:1200px;margin:0 auto">' +
            '<div style="font-size:16px;font-weight:600;margin-bottom:16px;display:flex;align-items:center;gap:8px">' +
                Components.icon('chart', 18) + ' 会话分析仪表盘' +
            '</div>' +
            overviewHtml +
            '<div style="height:16px"></div>' +
            trendsHtml +
            '<div style="height:16px"></div>' +
            '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">' +
                modelDistHtml +
                sourceDistHtml +
            '</div>' +
            '<div style="height:16px"></div>' +
            hourlyHtml +
            '<div style="height:16px"></div>' +
            behaviorHtml +
        '</div>';
    }

    // ==========================================
    // 图表构建
    // ==========================================

    function buildOverviewCard(value, label, color) {
        return '<div class="overview-card">' +
            '<div class="num" style="color:' + color + '">' + value + '</div>' +
            '<div class="label">' + label + '</div>' +
        '</div>';
    }

    function buildTrendsChart(data) {
        var items = data.data || data.points || data || [];
        if (!Array.isArray(items) || items.length === 0) {
            return '<div style="text-align:center;padding:30px;color:var(--text-tertiary);font-size:12px">暂无趋势数据</div>';
        }
        var maxVal = 0;
        items.forEach(function (item) {
            var val = typeof item === 'object' ? (item.count || item.value || 0) : item;
            if (val > maxVal) maxVal = val;
        });
        if (maxVal === 0) maxVal = 1;

        var barsHtml = items.map(function (item) {
            var val = typeof item === 'object' ? (item.count || item.value || 0) : item;
            var pct = Math.max(2, (val / maxVal) * 100);
            var label = typeof item === 'object' ? (item.date || item.label || item.period || '') : '';
            return '<div class="trend-bar" style="height:' + pct + '%" title="' + Components.escapeHtml(label) + ': ' + val + '"></div>';
        }).join('');

        var labelsHtml = items.map(function (item) {
            var label = typeof item === 'object' ? (item.date || item.label || item.period || '') : '';
            if (label.length > 5) label = label.substring(label.length - 5);
            return '<span>' + Components.escapeHtml(label) + '</span>';
        }).join('');

        return '<div class="trend-bar-container">' + barsHtml + '</div>' +
            '<div class="trend-labels">' + labelsHtml + '</div>';
    }

    function buildDistributionBars(data, baseColor) {
        if (!Array.isArray(data) || data.length === 0) {
            return '<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:12px">暂无数据</div>';
        }
        var maxVal = 0;
        data.forEach(function (item) {
            var val = typeof item === 'object' ? (item.count || item.value || 0) : item;
            if (val > maxVal) maxVal = val;
        });
        if (maxVal === 0) maxVal = 1;

        var colors = ['var(--blue)', 'var(--green)', 'var(--orange)', 'var(--purple)', 'var(--text-tertiary)'];

        return data.map(function (item, idx) {
            var name = typeof item === 'object' ? (item.name || item.label || item.model || item.source || '') : item;
            var val = typeof item === 'object' ? (item.count || item.value || 0) : 0;
            var pct = Math.max(2, (val / maxVal) * 100);
            var color = colors[idx % colors.length];
            return '<div class="dist-row">' +
                '<span class="dist-label" title="' + Components.escapeHtml(name) + '">' + Components.escapeHtml(name) + '</span>' +
                '<div class="dist-bar" style="width:' + pct + '%;background:' + color + '"></div>' +
                '<span class="dist-count">' + val + '</span>' +
            '</div>';
        }).join('');
    }

    function buildHourlyChart(data) {
        var hours = [];
        for (var i = 0; i < 24; i++) {
            hours.push({ hour: i, count: 0 });
        }
        if (Array.isArray(data)) {
            data.forEach(function (item) {
                var h = typeof item === 'object' ? (item.hour || item.h || 0) : 0;
                var c = typeof item === 'object' ? (item.count || item.value || 0) : (item || 0);
                if (h >= 0 && h < 24) hours[h].count = c;
            });
        }

        var maxVal = 0;
        hours.forEach(function (h) { if (h.count > maxVal) maxVal = h.count; });
        if (maxVal === 0) maxVal = 1;

        var barsHtml = hours.map(function (h) {
            var pct = Math.max(2, (h.count / maxVal) * 100);
            var intensity = Math.max(0.15, h.count / maxVal);
            return '<div class="hour-bar" style="height:' + pct + '%;background:rgba(79,70,229,' + intensity + ')" title="' + h.hour + ':00 - ' + h.count + ' 次会话"></div>';
        }).join('');

        var labelsHtml = hours.map(function (h) {
            return '<span>' + (h.hour % 4 === 0 ? h.hour : '') + '</span>';
        }).join('');

        return '<div class="hour-bar-container">' + barsHtml + '</div>' +
            '<div class="hour-labels">' + labelsHtml + '</div>';
    }

    function buildBehaviorProfile(behavior) {
        var rows = [];

        if (behavior.message_distribution) {
            var md = behavior.message_distribution;
            rows.push({ key: '消息分布', val: '用户 ' + (md.user || 0) + ' / 助手 ' + (md.assistant || 0) });
        }
        if (behavior.avg_response_length !== undefined) {
            rows.push({ key: '平均回复长度', val: behavior.avg_response_length + ' 字' });
        }
        if (behavior.avg_response_chars !== undefined) {
            rows.push({ key: '平均回复长度', val: behavior.avg_response_chars + ' 字' });
        }
        if (behavior.most_used_model) {
            rows.push({ key: '最常用模型', val: behavior.most_used_model });
        }
        if (behavior.top_model) {
            rows.push({ key: '最常用模型', val: behavior.top_model });
        }
        if (behavior.sessions_with_summary !== undefined) {
            rows.push({ key: '有摘要的会话', val: behavior.sessions_with_summary });
        }
        if (behavior.summary_count !== undefined) {
            rows.push({ key: '有摘要的会话', val: behavior.summary_count });
        }
        if (behavior.total_tools_used !== undefined) {
            rows.push({ key: '工具调用次数', val: behavior.total_tools_used });
        }
        if (behavior.avg_session_duration !== undefined) {
            rows.push({ key: '平均会话时长', val: behavior.avg_session_duration });
        }
        if (behavior.active_days !== undefined) {
            rows.push({ key: '活跃天数', val: behavior.active_days });
        }

        if (rows.length === 0) {
            return '<div style="text-align:center;padding:20px;color:var(--text-tertiary);font-size:12px">暂无行为数据</div>';
        }

        return rows.map(function (r) {
            return '<div class="behavior-row">' +
                '<span class="behavior-key">' + r.key + '</span>' +
                '<span class="behavior-val">' + Components.escapeHtml(String(r.val)) + '</span>' +
            '</div>';
        }).join('');
    }

    // ==========================================
    // 事件绑定
    // ==========================================

    function bindEvents() {
        var container = document.querySelector('#sessions-analytics');
        if (!container) return;

        container.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-action]');
            if (!btn) return;
            var action = btn.dataset.action;

            if (action === 'changeTrendPeriod') {
                changeTrendPeriod(btn.dataset.period);
            }
        });
    }

    // ==========================================
    // 公开 API
    // ==========================================

    function destroy() {
        _analyticsData = null;
        _trendPeriod = 'daily';
    }

    return {
        render, bindEvents, destroy,
        loadAnalytics, loadTrends, changeTrendPeriod
    };
})();

export default AnalyticsView;
