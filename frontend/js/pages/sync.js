/**
 * 数据同步与热更新页面 (Mac 极简风格)
 * 提供持久化状态查看、手动备份/恢复、后端切换、热更新等功能
 */

const SyncPage = (() => {
    let _syncStatus = null;
    let _backends = [];
    let _config = null;
    let _updateInfo = null;
    let _changelog = [];

    // ==========================================
    // 生命周期
    // ==========================================

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            await Promise.all([loadSyncStatus(), loadBackends(), loadConfig(), loadChangelog()]);
        } catch (_err) {
            // 部分加载失败不阻塞页面渲染
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function onSSEEvent(type, data) {
        // SSE 事件暂不处理，预留扩展
    }

    // ==========================================
    // 数据加载
    // ==========================================

    async function loadSyncStatus() {
        try {
            const resp = await API.get('/api/persistence/status');
            _syncStatus = resp;
        } catch (_err) {
            _syncStatus = null;
        }
    }

    async function loadBackends() {
        try {
            const resp = await API.get('/api/persistence/backends');
            _backends = resp.backends || [];
        } catch (_err) {
            _backends = [];
        }
    }

    async function loadConfig() {
        try {
            const resp = await API.get('/api/persistence/config');
            _config = resp;
        } catch (_err) {
            _config = null;
        }
    }

    async function loadChangelog() {
        try {
            const resp = await API.get('/api/version/changelog');
            _changelog = (resp.versions || []).slice(0, 5);
        } catch (_err) {
            _changelog = [];
        }
    }

    // ==========================================
    // 页面构建
    // ==========================================

    function buildPage() {
        return `<div style="max-width:860px">
            ${buildSyncStatusSection()}
            ${buildManualControlsSection()}
            ${buildBackendConfigSection()}
            ${buildHotUpdateSection()}
            ${buildChangelogSection()}
        </div>`;
    }

    // --- Section 1: 同步状态 ---

    function buildSyncStatusSection() {
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

    // --- Section 2: 手动操作 ---

    function buildManualControlsSection() {
        const buttons = `
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <button class="btn btn-primary" id="btnBackup">
                    ${Components.icon('upload', 14)} 立即备份
                </button>
                <button class="btn btn-secondary" id="btnRestore">
                    ${Components.icon('download', 14)} 立即恢复
                </button>
                <button class="btn btn-ghost" id="btnPreUpdate">
                    ${Components.icon('shield', 14)} 更新前备份
                </button>
            </div>
        `;

        return Components.renderSection('手动操作', buttons);
    }

    // --- Section 3: 后端配置 ---

    function buildBackendConfigSection() {
        const currentBackend = _syncStatus?.backend || 'none';
        const currentLabel =
            currentBackend === 'git' ? 'Git' : currentBackend === 'hf_buckets' ? 'HF Buckets' : '未配置';
        const configured = _syncStatus?.configured;

        const backendListHtml = _backends.length > 0
            ? _backends
                  .map(
                      (b) => `
                <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border)">
                    <div>
                        <span style="font-weight:500">${Components.escapeHtml(b.name)}</span>
                        <span style="font-size:12px;color:var(--text-tertiary);margin-left:8px">${Components.escapeHtml(b.description || '')}</span>
                    </div>
                    ${b.name === currentBackend
                        ? Components.renderBadge('当前', 'green')
                        : `<button class="btn btn-sm btn-ghost" onclick="SyncPage.switchBackend('${b.name}')">切换</button>`}
                </div>
            `,
                  )
                  .join('')
            : '<div style="color:var(--text-tertiary);font-size:13px">暂无可用后端</div>';

        const configHtml = _config
            ? `<div style="margin-top:12px">
                <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:8px">当前配置</div>
                <div class="schema-display">${Components.escapeHtml(JSON.stringify(_config, null, 2))}</div>
            </div>`
            : '';

        return Components.renderSection(
            '后端配置',
            `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
                <span>当前后端:</span>
                ${Components.renderBadge(currentLabel, configured ? 'green' : 'red')}
            </div>
            ${backendListHtml}
            ${configHtml}
        `,
        );
    }

    // --- Section 4: 热更新 ---

    function buildHotUpdateSection() {
        const updateInfoHtml = _updateInfo
            ? `
            <div style="display:flex;gap:16px;align-items:center;margin-bottom:12px;flex-wrap:wrap">
                <div>
                    <span style="font-size:12px;color:var(--text-tertiary)">当前版本</span>
                    <div style="font-weight:600;font-size:15px" class="mono">${Components.escapeHtml(_updateInfo.current_version || '-')}</div>
                </div>
                <div style="color:var(--text-tertiary)">${Components.icon('chevronRight', 16)}</div>
                <div>
                    <span style="font-size:12px;color:var(--text-tertiary)">最新版本</span>
                    <div style="font-weight:600;font-size:15px" class="mono">${Components.escapeHtml(_updateInfo.latest_version || '-')}</div>
                </div>
                <div>
                    ${_updateInfo.has_update
                        ? Components.renderBadge('有更新', 'orange')
                        : Components.renderBadge('已是最新', 'green')}
                </div>
            </div>
            ${_updateInfo.error ? `<div style="color:var(--red);font-size:12px;margin-bottom:8px">检查失败: ${Components.escapeHtml(_updateInfo.error)}</div>` : ''}
            ${_updateInfo.commit_info ? `<div style="font-size:11px;color:var(--text-tertiary);font-family:monospace;margin-bottom:8px">${Components.escapeHtml(_updateInfo.commit_info)}</div>` : ''}
        `
            : '<div style="color:var(--text-tertiary);font-size:13px;margin-bottom:12px">点击"检查更新"查看是否有新版本</div>';

        const buttons = `
            <div style="display:flex;gap:12px;flex-wrap:wrap">
                <button class="btn btn-primary" id="btnCheckUpdate">
                    ${Components.icon('refresh', 14)} 检查更新
                </button>
                <button class="btn btn-secondary" id="btnHotUpdate" ${!_updateInfo?.has_update ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
                    ${Components.icon('zap', 14)} 执行热更新
                </button>
            </div>
        `;

        const logContainer = `
            <div id="updateLogContainer" style="display:none;margin-top:12px">
                <div style="font-size:12px;color:var(--text-tertiary);margin-bottom:6px">更新日志</div>
                <div id="updateLog" class="schema-display" style="max-height:200px;overflow-y:auto;font-size:12px"></div>
            </div>
        `;

        return Components.renderSection(
            '热更新',
            `
            ${updateInfoHtml}
            ${buttons}
            ${logContainer}
        `,
        );
    }

    // --- Section 5: 变更记录 ---

    function buildChangelogSection() {
        if (_changelog.length === 0) return '';

        const listHtml = _changelog
            .map(
                (v) => `
            <div style="padding:10px 0;border-bottom:1px solid var(--border)">
                <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
                    <span class="mono" style="font-weight:600;font-size:13px">v${Components.escapeHtml(v.version)}</span>
                    ${Components.renderBadge(v.title || '', 'blue')}
                    <span style="font-size:11px;color:var(--text-tertiary)">${Components.escapeHtml(v.date || '')}</span>
                </div>
                ${(v.changes || []).length > 0
                    ? `<ul style="margin:4px 0 0 16px;font-size:12px;color:var(--text-secondary);line-height:1.8">
                        ${v.changes.map((c) => `<li>${Components.escapeHtml(c)}</li>`).join('')}
                    </ul>`
                    : ''}
            </div>
        `,
            )
            .join('');

        return Components.renderSection('变更记录 (最近 5 个版本)', listHtml);
    }

    // ==========================================
    // 事件绑定
    // ==========================================

    function bindEvents() {
        document.getElementById('btnBackup')?.addEventListener('click', doBackup);
        document.getElementById('btnRestore')?.addEventListener('click', doRestore);
        document.getElementById('btnPreUpdate')?.addEventListener('click', doPreUpdateBackup);
        document.getElementById('btnCheckUpdate')?.addEventListener('click', checkUpdate);
        document.getElementById('btnHotUpdate')?.addEventListener('click', hotUpdate);
    }

    // ==========================================
    // 操作函数
    // ==========================================

    async function doBackup() {
        const btn = document.getElementById('btnBackup');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('upload', 14)} 备份中...`;
        }

        try {
            const result = await API.post('/api/persistence/backup');
            if (result.success !== false) {
                Components.Toast.success('备份完成');
                await loadSyncStatus();
                render();
            } else {
                Components.Toast.error(`备份失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            Components.Toast.error(`备份失败: ${err.message}`);
        }
    }

    async function doRestore() {
        const ok = await Components.Modal.confirm({
            title: '确认恢复数据',
            message: '将从远程存储恢复所有数据，当前本地数据将被覆盖。此操作不可撤销，确定要继续吗？',
            confirmText: '确认恢复',
            type: 'danger',
        });
        if (!ok) return;

        const btn = document.getElementById('btnRestore');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('download', 14)} 恢复中...`;
        }

        try {
            const result = await API.post('/api/persistence/restore');
            if (result.success !== false) {
                Components.Toast.success('恢复完成，建议刷新页面');
                await loadSyncStatus();
                render();
            } else {
                Components.Toast.error(`恢复失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            Components.Toast.error(`恢复失败: ${err.message}`);
        }
    }

    async function doPreUpdateBackup() {
        const btn = document.getElementById('btnPreUpdate');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('shield', 14)} 备份中...`;
        }

        try {
            const result = await API.post('/api/persistence/pre-update');
            if (result.success !== false) {
                Components.Toast.success('更新前备份完成');
            } else {
                Components.Toast.error(`备份失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            Components.Toast.error(`备份失败: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${Components.icon('shield', 14)} 更新前备份`;
            }
        }
    }

    async function switchBackend(backend) {
        const ok = await Components.Modal.confirm({
            title: '切换后端',
            message: `确定要将持久化后端切换为 <strong>${Components.escapeHtml(backend)}</strong> 吗？切换后将自动执行一次备份。`,
            confirmText: '切换',
            type: 'warning',
        });
        if (!ok) return;

        try {
            const result = await API.post('/api/persistence/switch', { backend });
            if (result.success !== false) {
                Components.Toast.success(`已切换到 ${backend}`);
                await Promise.all([loadSyncStatus(), loadBackends(), loadConfig()]);
                render();
            } else {
                Components.Toast.error(`切换失败: ${result.error || '未知错误'}`);
            }
        } catch (err) {
            Components.Toast.error(`切换失败: ${err.message}`);
        }
    }

    async function checkUpdate() {
        const btn = document.getElementById('btnCheckUpdate');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('refresh', 14)} 检查中...`;
        }

        try {
            const result = await API.get('/api/version/check-update');
            _updateInfo = result;
            Components.Toast.info(
                result.has_update ? `发现新版本: ${result.latest_version}` : '当前已是最新版本',
            );
            render();
        } catch (err) {
            Components.Toast.error(`检查更新失败: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${Components.icon('refresh', 14)} 检查更新`;
            }
        }
    }

    async function hotUpdate() {
        const ok = await Components.Modal.confirm({
            title: '执行热更新',
            message: `
                <div style="margin-bottom:8px">即将执行以下操作：</div>
                <ol style="margin:0 0 8px 16px;font-size:13px;line-height:1.8">
                    <li>自动备份当前数据</li>
                    <li>从 GitHub 拉取最新代码</li>
                    <li>更新完成后建议刷新页面</li>
                </ol>
                <div style="color:var(--red);font-weight:500">警告：更新过程中服务可能短暂不可用，请确保当前没有进行中的操作。</div>
            `,
            confirmText: '执行更新',
            type: 'warning',
        });
        if (!ok) return;

        const btn = document.getElementById('btnHotUpdate');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = `${Components.icon('zap', 14)} 更新中...`;
        }

        // 显示日志容器
        const logContainer = document.getElementById('updateLogContainer');
        const logEl = document.getElementById('updateLog');
        if (logContainer) logContainer.style.display = 'block';
        if (logEl) logEl.textContent = '正在执行热更新...\n';

        try {
            const result = await API.request('/api/version/hot-update', { method: 'POST', timeout: 180000 });

            // 渲染日志
            if (logEl && result.steps) {
                const logLines = result.steps
                    .map((step) => {
                        const icon =
                            step.status === 'success' ? '[OK]' : step.status === 'warning' ? '[WARN]' : '[FAIL]';
                        return `${icon} ${step.step}: ${step.detail}`;
                    })
                    .join('\n');
                logEl.textContent = logLines;
            }

            if (result.success) {
                Components.Toast.success(result.message || '更新成功，建议刷新页面');
                // 自动刷新版本信息
                _updateInfo = null;
                setTimeout(() => {
                    window.location.reload();
                }, 3000);
            } else {
                Components.Toast.error(result.message || '更新失败，请检查日志');
            }
        } catch (err) {
            if (logEl) logEl.textContent += `\n[ERROR] ${err.message}`;
            Components.Toast.error(`热更新失败: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${Components.icon('zap', 14)} 执行热更新`;
            }
        }
    }

    return { render, onSSEEvent, switchBackend };
})();
