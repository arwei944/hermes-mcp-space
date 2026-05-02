/**
 * 数据同步页面 - 同步状态 & 同步日志
 */

const SyncStatus = (() => {
    let _syncStatus = null;
    let _syncLogs = [];
    let _isSyncing = false;

    async function load() {
        try {
            const resp = await API.get('/api/persistence/status');
            _syncStatus = resp;
        } catch (_err) {
            _syncStatus = null;
        }
    }

    function getStatus() {
        return _syncStatus;
    }

    function getIsSyncing() {
        return _isSyncing;
    }

    function setIsSyncing(val) {
        _isSyncing = val;
    }

    function addSyncLog(action, success, detail) {
        const now = new Date();
        const time = now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });
        _syncLogs.unshift({ time, action, success, detail });
        if (_syncLogs.length > 50) _syncLogs = _syncLogs.slice(0, 50);
    }

    function buildSection() {
        const s = _syncStatus || {};
        const backendName = s.backend || 'none';
        const backendLabel = backendName === 'git' ? 'Git' : backendName === 'hf_buckets' ? 'HF Buckets' : '未配置';
        const lastSync = s.last_sync_time || '-';
        const fileCount = s.file_count ?? '-';
        const storageUsage = s.storage_usage || '-';

        const stats = [
            Components.renderStatCard('后端类型', backendLabel, null, 'database', 'blue'),
            Components.renderStatCard('最后同步', Components.formatTime(lastSync), null, 'clock', 'green'),
            Components.renderStatCard('文件数量', String(fileCount), null, 'file', 'purple'),
            Components.renderStatCard('存储用量', storageUsage, null, 'hardDrive', 'orange'),
        ];

        return `
            ${Components.sectionTitle('同步状态')}
            <div class="stats">${stats.join('')}</div>
        `;
    }

    function buildLogsSection() {
        if (_syncLogs.length === 0) {
            return Components.renderSection('同步日志', '<div style="color:var(--text-tertiary);font-size:13px">暂无同步日志</div>');
        }

        const logsHtml = _syncLogs
            .slice(0, 20)
            .map(
                (log) => `<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">
                    <span style="color:${log.success ? 'var(--green)' : 'var(--red)'}">${log.success ? '✓' : '✗'}</span>
                    <span style="color:var(--text-tertiary);font-family:monospace;min-width:130px">${log.time || '-'}</span>
                    <span style="color:var(--text-secondary)">${Components.escapeHtml(log.action || '')}</span>
                    <span style="color:var(--text-tertiary);margin-left:auto">${Components.escapeHtml(log.detail || '')}</span>
                </div>`,
            )
            .join('');

        return Components.renderSection('同步日志 (最近 20 条)', logsHtml);
    }

    function destroy() {
        _syncStatus = null;
        _syncLogs = [];
        _isSyncing = false;
    }

    return { load, getStatus, getIsSyncing, setIsSyncing, addSyncLog, buildSection, buildLogsSection, destroy };
})();

export default SyncStatus;
