/**
 * 定时任务页面 - 任务列表组件
 * 创建/编辑/删除/触发，真实可用
 */

const CronList = (() => {
    let _jobs = [];
    let _showForm = false;
    let _editingJob = null;
    let _destroyed = false;

    async function render(containerSelector) {
        _destroyed = false;
        const container = document.querySelector(containerSelector);
        if (!container) return;

        container.innerHTML = Components.createSkeleton(5);

        try {
            const data = await API.cron.list();
            _jobs = data.jobs || data || [];
        } catch (_err) {
            _jobs = [];
        }

        if (_destroyed) return;
        container.innerHTML = buildPage();
        bindEvents(container);
    }

    function buildPage() {
        const statusMap = { active: '运行中', paused: '暂停', disabled: '已禁用', idle: '空闲' };
        const statusColor = { active: 'green', paused: 'orange', disabled: 'red', idle: 'blue' };

        const activeCount = _jobs.filter((j) => j.status === 'active').length;

        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总任务', _jobs.length, '', 'clock', 'blue')}
            ${Components.renderStatCard('运行中', activeCount, '', 'check', 'green')}
            ${Components.renderStatCard('暂停', _jobs.length - activeCount, '', 'pause', 'orange')}
        </div>`;

        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-primary" data-action="showCreateForm">创建任务</button>
        </div>`;

        const formHtml = _showForm ? buildForm() : '';

        const jobsHtml =
            _jobs.length === 0
                ? Components.createEmptyState(
                      Components.icon('clock', 48),
                      '暂无定时任务',
                      '点击「创建任务」添加第一个定时任务',
                      '',
                  )
                : `<div class="table-wrapper"><table class="table">
                <thead><tr><th>名称</th><th>调度</th><th>命令</th><th>状态</th><th>上次执行</th><th>操作</th></tr></thead>
                <tbody>
                    ${_jobs
                        .map(
                            (j) => `<tr>
                        <td style="font-weight:500">${Components.escapeHtml(j.name || '-')}</td>
                        <td class="mono" style="font-size:12px">${Components.escapeHtml(j.schedule || j.cron || '-')}</td>
                        <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(j.command || j.action || '-')}</td>
                        <td>${Components.renderBadge(statusMap[j.status] || j.status || '-', statusColor[j.status] || 'blue')}</td>
                        <td style="font-size:12px;color:var(--text-tertiary)">${j.last_run ? Components.formatDateTime(j.last_run) : '-'}</td>
                        <td>
                            <div style="display:flex;gap:4px">
                                <button class="btn btn-sm btn-ghost" data-action="triggerJob" data-id="${j.id}" title="立即执行">&#9654;</button>
                                <button class="btn btn-sm btn-ghost" data-action="editJob" data-id="${j.id}" title="编辑">${Components.icon('edit', 14)}</button>
                                <button class="btn btn-sm btn-ghost" style="color:var(--red)" data-action="deleteJob" data-id="${j.id}" title="删除">${Components.icon('trash', 16)}</button>
                            </div>
                        </td>
                    </tr>`,
                        )
                        .join('')}
                </tbody>
            </table></div>`;

        return `${statsHtml}${actionsHtml}${formHtml}${jobsHtml}`;
    }

    function buildForm() {
        const isEdit = _editingJob !== null;
        const job = isEdit ? _jobs.find((j) => j.id === _editingJob) : {};
        return `<div class="modal-overlay" data-action="hideForm">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑定时任务' : '创建定时任务'}</h3>
                    <button class="modal-close" data-action="hideForm">${Components.icon('x', 14)}</button>
                </div>
                <div class="modal-body">
                    ${Components.formGroup('任务名称', `<input class="form-input" id="cronName" placeholder="例如: 每日备份" value="${Components.escapeHtml(job.name || '')}">`)}
                    ${Components.formGroup('Cron 表达式', `<input class="form-input" id="cronSchedule" placeholder="例如: 0 9 * * *" value="${Components.escapeHtml(job.schedule || job.cron || '')}">`, '分 时 日 月 周')}
                    ${Components.formGroup('执行命令', `<textarea class="form-input" id="cronCommand" rows="3" placeholder="描述任务要执行的操作...">${Components.escapeHtml(job.command || job.action || '')}</textarea>`)}
                    ${Components.formGroup(
                        '状态',
                        `<select class="form-input" id="cronStatus">
                        <option value="active" ${job.status === 'active' ? 'selected' : ''}>运行中</option>
                        <option value="paused" ${job.status === 'paused' ? 'selected' : ''}>暂停</option>
                    </select>`,
                    )}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" data-action="hideForm">取消</button>
                    <button class="btn btn-primary" data-action="saveJob">${isEdit ? '保存' : '创建'}</button>
                </div>
            </div>
        </div>`;
    }

    function showCreateForm(container) {
        _showForm = true;
        _editingJob = null;
        container.innerHTML = buildPage();
        bindEvents(container);
    }

    function editJob(id, container) {
        _showForm = true;
        _editingJob = id;
        container.innerHTML = buildPage();
        bindEvents(container);
    }

    function hideForm(container) {
        _showForm = false;
        _editingJob = null;
        container.innerHTML = buildPage();
        bindEvents(container);
    }

    async function saveJob(container) {
        const name = document.getElementById('cronName').value.trim();
        const schedule = document.getElementById('cronSchedule').value.trim();
        const command = document.getElementById('cronCommand').value.trim();
        const status = document.getElementById('cronStatus').value;

        if (!name || !schedule) {
            Components.Toast.error('请填写任务名称和 Cron 表达式');
            return;
        }

        try {
            if (_editingJob) {
                await API.cron.update(_editingJob, { name, schedule, command, status });
                Components.Toast.success('任务已更新');
            } else {
                await API.cron.create({ name, schedule, command, status });
                Components.Toast.success('任务已创建');
            }
            _showForm = false;
            _editingJob = null;
            await render('#cron-list');
        } catch (err) {
            Components.Toast.error(`操作失败: ${err.message}`);
        }
    }

    async function deleteJob(id) {
        const ok = await Components.Modal.confirm({
            title: '删除任务',
            message: '确定要删除此定时任务吗？此操作不可撤销。',
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;

        try {
            await API.cron.delete(id);
            Components.Toast.success('任务已删除');
            await render('#cron-list');
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function triggerJob(id) {
        const ok = await Components.Modal.confirm({
            title: '立即执行任务',
            message: '确定要立即触发此定时任务吗？',
            confirmText: '执行',
            type: 'warning',
        });
        if (!ok) return;

        try {
            await API.cron.trigger(id);
            Components.Toast.success('任务已触发');
        } catch (err) {
            Components.Toast.error(`触发失败: ${err.message}`);
        }
    }

    function bindEvents(container) {
        container.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;

            const action = target.dataset.action;
            const id = target.dataset.id;

            switch (action) {
                case 'showCreateForm':
                    showCreateForm(container);
                    break;
                case 'editJob':
                    editJob(id, container);
                    break;
                case 'hideForm':
                    hideForm(container);
                    break;
                case 'saveJob':
                    saveJob(container);
                    break;
                case 'deleteJob':
                    deleteJob(id);
                    break;
                case 'triggerJob':
                    triggerJob(id);
                    break;
            }
        });
    }

    function destroy() {
        _destroyed = true;
    }

    return { render, destroy };
})();

export default CronList;
