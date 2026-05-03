/**
 * Ops Center - 共享常量
 * 错误类型、健康阈值、流水线步骤等
 */

var ERROR_TYPES = {
    js_error: { label: '前端JS错误', color: 'var(--red)', badge: 'red', dot: '#ef4444' },
    api_error: { label: 'API错误', color: 'var(--orange)', badge: 'orange', dot: '#f97316' },
    tool_error: { label: '工具错误', color: 'var(--yellow)', badge: 'orange', dot: '#eab308' },
};

var HEALTH_THRESHOLDS = {
    cpu: { warning: 70, critical: 90 },
    memory: { warning: 75, critical: 90 },
    disk: { warning: 80, critical: 95 },
};

var PIPELINE_STEPS = [
    { key: 'commit', label: '代码提交', icon: 'gitBranch' },
    { key: 'lint', label: 'Lint 检查', icon: 'shield' },
    { key: 'build', label: 'Docker 构建', icon: 'package' },
    { key: 'deploy', label: 'HF 部署', icon: 'upload' },
    { key: 'verify', label: '健康验证', icon: 'checkCircle' },
];

var OPS_TABS = [
    { key: 'overview', label: '实时总览', version: '1.0.0' },
    { key: 'pipeline', label: '构建部署', version: '1.0.0' },
    { key: 'resource', label: '资源监控', version: '1.0.0' },
    { key: 'quality', label: '代码质量', version: '1.0.0' },
    { key: 'errors', label: '错误追踪', version: '1.0.0' },
    { key: 'alerts', label: '告警管理', version: '1.0.0' },
    { key: 'logs', label: '事件日志', version: '1.0.0' },
    { key: 'about', label: '关于系统', version: '1.0.0' },
];

export { ERROR_TYPES, HEALTH_THRESHOLDS, PIPELINE_STEPS, OPS_TABS };
