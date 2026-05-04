/**
 * Hermes Agent - 集中配置常量 (v14.2.0)
 * 所有魔法数字集中管理，便于调参和维护
 */
const AppConfig = {
    // API
    API_TIMEOUT: 15000,           // API 默认超时 (ms)
    API_RETRY_CODES: [502, 503, 504],
    API_MAX_RETRIES: 3,
    API_RETRY_DELAYS: [1000, 2000, 4000],

    // SSE
    SSE_POLL_INTERVAL: 3000,      // SSE 降级轮询间隔 (ms)
    SSE_MAX_RECONNECTS: 5,

    // OpsSync 轮询间隔
    OPS_METRICS_INTERVAL: 5000,   // 系统指标 (ms)
    OPS_MCP_HEALTH_INTERVAL: 30000, // MCP 健康 (ms)
    OPS_CRON_INTERVAL: 30000,     // 定时任务 (ms)
    OPS_ALERTS_INTERVAL: 30000,   // 告警数据 (ms)
    OPS_FRONTEND_ERRORS_INTERVAL: 10000, // 前端错误 (ms)
    OPS_API_ERRORS_INTERVAL: 10000,    // API 错误 (ms)
    OPS_EVENTS_INTERVAL: 10000,    // 最近事件 (ms)
    OPS_EVAL_INTERVAL: 30000,      // 评估数据 (ms)

    // AlertChecker
    ALERT_CHECK_INTERVAL: 10000,   // 告警检查间隔 (ms)
    ALERT_COOLDOWN: 300,           // 告警冷却时间 (s)

    // Error/Log
    ERROR_MAX_BUFFER: 100,         // 最大错误缓冲条数
    ERROR_DEDUP_WINDOW: 30000,     // 错误去重窗口 (ms)
    ERROR_UPLOAD_QUEUE: 5,         // 最大上报队列
    ERROR_FLUSH_INTERVAL: 5000,    // 错误上报刷出间隔 (ms)
    LOG_MAX_BUFFER: 100,
    LOG_BATCH_SIZE: 10,
    LOG_FLUSH_INTERVAL: 10000,

    // UI
    TOAST_DURATION: 3500,          // Toast 显示时长 (ms)
    TOAST_ANIMATION: 200,          // Toast 动画时长 (ms)
    ONBOARDING_DELAY: 800,         // 引导启动延迟 (ms)
    RESIZE_DEBOUNCE: 200,          // 窗口 resize 防抖 (ms)

    // Data limits
    OPS_METRICS_HISTORY: 360,      // 指标历史最大条数
    OPS_DEFAULT_LIMIT: 50,         // 默认数据获取限制
    OPS_EVENTS_LIMIT: 30,          // 事件获取限制
    ALERT_HISTORY_MAX: 200,        // 告警历史最大条数
    NOTIFICATION_HISTORY_MAX: 50,  // 通知记录最大条数
    ROUTER_HISTORY_MAX: 50,        // 导航历史最大条数

    // Export
    EXPORT_PROGRESS_INCREMENT: 15,
    EXPORT_PROGRESS_PAUSE: 90,
    EXPORT_COMPLETE_DELAY: 500,
};
