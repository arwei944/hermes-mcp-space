/**
 * Hermes Agent - 颜色工具 (v14.2.0)
 * 从 CSS 变量读取颜色，确保深色/浅色主题联动
 */
const AppColors = {
    _cache: {},
    _root: () => document.documentElement,

    get(name) {
        if (this._cache[name]) return this._cache[name];
        const value = getComputedStyle(this._root()).getPropertyValue(name).trim();
        if (value) this._cache[name] = value;
        return value || '';
    },

    // 语义化颜色快捷方法
    get accent() { return this.get('--accent') || '#0071e3'; },
    get success() { return this.get('--green') || '#22c55e'; },
    get warning() { return this.get('--orange') || '#f59e0b'; },
    get danger() { return this.get('--red') || '#ef4444'; },
    get info() { return this.get('--blue') || '#3b82f6'; },
    get primary() { return this.get('--text-primary') || '#1d1d1f'; },
    get secondary() { return this.get('--text-secondary') || '#86868b'; },
    get bg() { return this.get('--bg-primary') || '#ffffff'; },

    // 图表调色板（从 CSS 变量读取，fallback 到默认值）
    get palette() {
        return [
            this.accent,
            this.get('--purple') || '#8b5cf6',
            this.success,
            this.warning,
            this.danger,
            this.get('--cyan') || '#06b6d4',
            this.get('--pink') || '#ec4899',
            this.get('--indigo') || '#6366f1',
        ];
    },

    // 清除缓存（主题切换时调用）
    clearCache() { this._cache = {}; },
};
