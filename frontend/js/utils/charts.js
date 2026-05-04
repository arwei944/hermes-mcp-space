// Chart.js 图表工具
// 提供 Chart.js 图表的统一创建和管理接口
const ChartUtils = {
    colors: {
        primary: '#3b82f6',
        secondary: '#8b5cf6',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#06b6d4',
        palette: (typeof AppColors !== 'undefined' && AppColors.palette) || ['#3b82f6', '#8b5cf6', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6']
    },

    _charts: {},

    createTrendChart(canvasId, labels, datasets) {
        var ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this._charts[canvasId]) {
            this._charts[canvasId].destroy();
        }

        var chart = new Chart(ctx, {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: { mode: 'index', intersect: false }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        this._charts[canvasId] = chart;
        return chart;
    },

    createDistributionChart(canvasId, labels, data) {
        var ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this._charts[canvasId]) {
            this._charts[canvasId].destroy();
        }

        var chart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: this.colors.palette.slice(0, labels.length),
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right' }
                }
            }
        });

        this._charts[canvasId] = chart;
        return chart;
    },

    createBarChart(canvasId, labels, data, label) {
        var ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (this._charts[canvasId]) {
            this._charts[canvasId].destroy();
        }

        var chart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label || 'Count',
                    data: data,
                    backgroundColor: this.colors.primary + '80',
                    borderColor: this.colors.primary,
                    borderWidth: 1,
                    borderRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.05)' } },
                    x: { grid: { display: false } }
                }
            }
        });

        this._charts[canvasId] = chart;
        return chart;
    },

    destroyAll() {
        var self = this;
        Object.keys(this._charts).forEach(function (key) {
            self._charts[key].destroy();
        });
        this._charts = {};
    }
};
