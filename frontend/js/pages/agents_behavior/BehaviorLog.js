/**
 * Agent 行为管理页面 - 行为日志 Tab
 * 实时 SSE 行为事件列表 + 清空
 */

const BehaviorLog = (() => {
    // ========== 私有状态 ==========
    let _behaviorLog = [];

    // ========== 数据加载 ==========

    async function loadData() {
        // 行为日志初始为空，由 SSE 实时推送
        _behaviorLog = [];
    }

    function getCount() {
        return _behaviorLog.length;
    }

    function getLog() {
        return _behaviorLog;
    }

    // ========== SSE 事件处理 ==========

    function onSSEEvent(type, data) {
        if (type === 'mcp.tool_call' || type === 'mcp.tool_complete') {
            const entry = {
                type: type,
                timestamp: new Date().toISOString(),
                tool: data?.tool || data?.name || 'unknown',
                args: data?.args || data?.arguments || {},
                success: type === 'mcp.tool_complete',
                duration: data?.duration_ms || data?.ms || 0,
                detail: data?.detail || data?.result || '',
            };
            _behaviorLog.unshift(entry);
            // 最多保留 200 条
            if (_behaviorLog.length > 200) {
                _behaviorLog = _behaviorLog.slice(0, 200);
            }
            // 增量更新 DOM
            updateBehaviorLog();
        }
    }

    // ========== 内容构建 ==========

    function buildContent() {
        const logHtml = buildBehaviorLogList();
        return `<div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${Components.icon('activity', 16)} 行为日志</span>
            <div style="display:flex;gap:8px;align-items:center">
                <span style="font-size:11px;color:var(--text-tertiary)">${_behaviorLog.length} 条记录（实时 SSE）</span>
                <button type="button" class="btn btn-sm btn-ghost" data-action="clearLog">${Components.icon('trash', 12)} 清空</button>
            </div>
        </div>
        <div id="abBehaviorLog" style="max-height:calc(100vh - 260px);overflow-y:auto;display:flex;flex-direction:column;gap:4px">
            ${logHtml}
        </div>`;
    }

    function buildBehaviorLogList() {
        if (_behaviorLog.length === 0) {
            return `<div style="text-align:center;color:var(--text-tertiary);padding:40px">
                <div style="font-size:32px;margin-bottom:12px">${Components.icon('activity', 32)}</div>
                <div>暂无行为日志</div>
                <div style="font-size:12px;margin-top:4px">Agent 的工具调用和行为事件将通过 SSE 实时推送</div>
            </div>`;
        }

        return _behaviorLog
            .slice(0, 100)
            .map((entry) => {
                const isSuccess = entry.success;
                const icon = isSuccess ? Components.icon('check', 14) : Components.icon('x', 14);
                const iconColor = isSuccess ? 'var(--green)' : 'var(--red)';
                const borderColor = isSuccess ? 'var(--green)' : 'var(--orange)';
                const time = Components.formatDateTime(entry.timestamp);
                const toolName = entry.tool || 'unknown';
                const argsSummary = _summarizeArgs(entry.args);
                const durationStr = entry.duration ? `${entry.duration}ms` : '';

                // 使用 class 替代 inline onmouseover/onmouseout
                return `<div class="ab-log-row" style="display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:8px;font-size:12px;border-left:3px solid ${borderColor};background:var(--bg-secondary);transition:background 0.15s">
                    <span style="color:${iconColor};font-weight:700;font-size:14px;flex-shrink:0;width:16px;text-align:center">${icon}</span>
                    <span style="color:var(--text-primary);font-weight:500;flex-shrink:0;min-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(toolName)}">${Components.escapeHtml(toolName)}</span>
                    <span style="color:var(--text-tertiary);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(argsSummary)}">${Components.escapeHtml(argsSummary)}</span>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0">${durationStr}</span>
                    <span style="color:var(--text-tertiary);font-size:10px;flex-shrink:0;min-width:60px;text-align:right">${time}</span>
                </div>`;
            })
            .join('');
    }

    function _summarizeArgs(args) {
        if (!args || typeof args !== 'object') return '';
        try {
            const str = JSON.stringify(args);
            if (str.length > 120) return str.slice(0, 120) + '...';
            return str;
        } catch (_e) {
            return String(args);
        }
    }

    // ========== 增量更新 ==========

    function updateBehaviorLog() {
        const el = document.getElementById('abBehaviorLog');
        if (!el) return;
        el.innerHTML = buildBehaviorLogList();
    }

    // ========== 操作函数 ==========

    function clearLog() {
        Components.Modal.confirm({
            title: '清空日志',
            message: '确定要清空所有行为日志记录吗？此操作不可撤销。',
            confirmText: '清空',
            cancelText: '取消',
            type: 'danger',
        }).then((confirmed) => {
            if (confirmed) {
                _behaviorLog = [];
                updateBehaviorLog();
                Components.Toast.success('日志已清空');
            }
        });
    }

    // ========== 生命周期 ==========

    function destroy() {
        _behaviorLog = [];
    }

    return {
        loadData,
        getCount,
        getLog,
        onSSEEvent,
        buildContent,
        clearLog,
        destroy,
    };
})();

export default BehaviorLog;
