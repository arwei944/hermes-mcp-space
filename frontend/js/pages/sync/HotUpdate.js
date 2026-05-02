/**
 * 数据同步页面 - 热更新
 */

const HotUpdate = (() => {
    let _updateInfo = null;

    function getUpdateInfo() {
        return _updateInfo;
    }

    function buildSection() {
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
                <button class="btn btn-primary" data-action="checkUpdate">
                    ${Components.icon('refresh', 14)} 检查更新
                </button>
                <button class="btn btn-secondary" data-action="hotUpdate" ${!_updateInfo?.has_update ? 'disabled style="opacity:0.5;cursor:not-allowed"' : ''}>
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

    async function checkUpdate(modules) {
        const btn = document.querySelector('[data-action="checkUpdate"]');
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
            // 重新渲染
            document.getElementById('contentBody').innerHTML = modules.page.buildPage(
                modules.syncStatus.buildSection(),
                modules.autoSync.buildSection(modules.backendConfig.getConfig()),
                modules.manualControls.buildSection(),
                modules.backendConfig.buildSection(modules.syncStatus.getStatus()),
                modules.hotUpdate.buildSection(),
                modules.changelog.buildSection(),
                modules.syncStatus.buildLogsSection(),
            );
            modules.page.bindEvents(modules);
        } catch (err) {
            Components.Toast.error(`检查更新失败: ${err.message}`);
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = `${Components.icon('refresh', 14)} 检查更新`;
            }
        }
    }

    async function execute(modules) {
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

        const btn = document.querySelector('[data-action="hotUpdate"]');
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

    function destroy() {
        _updateInfo = null;
    }

    return { buildSection, checkUpdate, execute, destroy };
})();

export default HotUpdate;
