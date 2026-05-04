/**
 * 告警管理页面 - 共享常量
 * 告警类型配置、级别颜色等
 *
 * v14.1: defaultThreshold 值应与 AlertChecker._defaultRules 保持同步。
 *       修改阈值时请同时更新 AlertChecker.js 中的 _defaultRules。
 */

const ALERT_TYPES = {
    cpu_high: { label: 'CPU 使用率过高', unit: '%', defaultThreshold: 80, icon: 'cpu' },
    memory_high: { label: '内存使用率过高', unit: '%', defaultThreshold: 85, icon: 'memory' },
    disk_high: { label: '磁盘使用率过高', unit: '%', defaultThreshold: 90, icon: 'disk' },
    tool_error_rate: { label: '工具错误率过高', unit: '%', defaultThreshold: 20, icon: 'alertTriangle' },
    mcp_disconnected: { label: 'MCP 服务断开', unit: '', defaultThreshold: 1, icon: 'plug' },
};

const LEVEL_COLORS = {
    critical: 'var(--red)',
    warning: 'var(--orange)',
    info: 'var(--blue)',
};

const LEVEL_BADGE = {
    critical: 'red',
    warning: 'orange',
    info: 'blue',
};

export { ALERT_TYPES, LEVEL_COLORS, LEVEL_BADGE };