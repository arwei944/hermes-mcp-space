// -*- coding: utf-8 -*-
/**
 * constants - 事件名称常量
 * 集中管理所有事件名称，避免硬编码字符串
 */
(function ConstantsModule() {
    'use strict';

    const Events = Object.freeze({
        SESSION_CREATED: 'session:created',
        SESSION_UPDATED: 'session:updated',
        SESSION_DELETED: 'session:deleted',
        SESSION_MESSAGE: 'session:message',
        TOOL_CALLED: 'tool:called',
        TOOL_COMPLETED: 'tool:completed',
        TOOL_ERROR: 'tool:error',
        MEMORY_UPDATED: 'memory:updated',
        ALERT_TRIGGERED: 'alert:triggered',
        ALERT_ACKNOWLEDGED: 'alert:acknowledged',
        OPS_METRICS_UPDATE: 'ops:metrics:update',
        OPS_MCP_DEGRADED: 'ops:mcp:degraded',
        OPS_CRON_FAILED: 'ops:cron:failed',
        PAGE_CHANGED: 'page:changed',
        THEME_CHANGED: 'theme:changed',
        SIDEBAR_TOGGLED: 'sidebar:toggled',
        API_ERROR: 'api:error',
        COMPONENT_ERROR: 'error:component',
        STORE_ERROR: 'error:store',
    });

    window.Events = Events;
})();
