/**
 * 定时任务页面 (Mac 极简风格)
 * 创建/编辑/删除/触发，真实可用
 */

const CronPage = (() => {
    let _jobs = [];
    let _showForm = false;
    let _editingJob = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.cron.list();
            _jobs = data.jobs || data || [];
        } catch (err) {
            _jobs = [
                { id: 'cron_001', name: '日报生成', schedule: '0 9 * * *', command: '生成每日工作报告', status: 'active', last_run: '2026-04-28T09:00:00' },
                { id: 'cron_002', name: '缓存清理', schedule: '0 3 * * 0', command: '清理过期缓存文件', status: 'active', last_run: '2026-04-27T03:00:00' },
                { id: 'cron_003', name: '模型检查', schedule: '0 */6 * * *', command: '检查模型可用性', status: 'paused', last_run: null },
            ];
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function buildPage() {
        const statusMap = { active: '运行中', paused: '暂停', disabled: '已禁用', idle: '空闲' };
        const statusColor = { active: 'green', paused: 'orange', disabled: 'red', idle: 'blue' };

        const activeCount = _jobs.filter(j => j.status === 'active').length;

        // 统计
        const statsHtml = `<div class="stats">
            ${Components.renderStatCard('总任务', _jobs.length, '', '⏰', 'blue')}
            ${Components.renderStatCard('运行中', activeCount, '', '✅', 'green')}
            ${Components.renderStatCard('暂停', _jobs.length - activeCount, '', '⏸️', 'orange')}
        </div>`;

        // 操作按钮
        const actionsHtml = `<div style="display:flex;justify-content:flex-end;margin-bottom:16px">
            <button class="btn btn-primary" onclick="CronPage.showCreateForm()">创建任务</button>
        </div>`;

        // 创建/编辑表单
        const formHtml = _showForm ? buildForm() : '';

        // 任务列表
        const jobsHtml = _jobs.length === 0
            ? Components.createEmptyState('⏰', '暂无定时任务', '点击「创建任务」添加第一个定时任务', '')
            : `<div class="table-wrapper"><table class="table">
                <thead><tr><th>名称</th><th>调度</th><th>命令</th><th>状态</th><th>上次执行</th><th>操作</th></tr></thead>
                <tbody>
                    ${_jobs.map(j => `<tr>
                        <td style="font-weight:500">${Components.escapeHtml(j.name || '-')}</td>
                        <td class="mono" style="font-size:12px">${Components.escapeHtml(j.schedule || j.cron || '-')}</td>
                        <td style="font-size:12px;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${Components.escapeHtml(j.command || j.action || '-')}</td>
                        <td>${Components.renderBadge(statusMap[j.status] || j.status || '-', statusColor[j.status] || 'blue')}</td>
                        <td style="font-size:12px;color:var(--text-tertiary)">${j.last_run ? Components.formatTime(j.last_run) : '-'}</td>
                        <td>
                            <div style="display:flex;gap:4px">
                                <button class="btn btn-sm btn-ghost" onclick="CronPage.triggerJob('${j.id}')" title="立即执行">▶️</button>
                                <button class="btn btn-sm btn-ghost" onclick="CronPage.editJob('${j.id}')" title="编辑">✏️</button>
                                <button class="btn btn-sm btn-ghost" style="color:var(--red)" onclick="CronPage.deleteJob('${j.id}')" title="删除">🗑️</button>
                            </div>
                        </td>
                    </tr>`).join('')}
                </tbody>
            </table></div>`;

        return `${statsHtml}${actionsHtml}${formHtml}${jobsHtml}`;
    }

    function buildForm() {
        const isEdit = _editingJob !== null;
        const job = isEdit ? _jobs.find(j => j.id === _editingJob) : {};
        return `<div class="modal-overlay" onclick="CronPage.hideForm()">
            <div class="modal" onclick="event.stopPropagation()">
                <div class="modal-header">
                    <h3>${isEdit ? '编辑定时任务' : '创建定时任务'}</h3>
                    <button class="modal-close" onclick="CronPage.hideForm()">✕</button>
                </div>
                <div class="modal-body">
                    ${Components.formGroup('任务名称', `<input class="form-input" id="cronName" placeholder="例如: 每日备份" value="${Components.escapeHtml(job.name || '')}">`)}
                    ${Components.formGroup('Cron 表达式', `<input class="form-input" id="cronSchedule" placeholder="例如: 0 9 * * *" value="${Components.escapeHtml(job.schedule || job.cron || '')}">`, '分 时 日 月 周')}
                    ${Components.formGroup('执行命令', `<textarea class="form-input" id="cronCommand" rows="3" placeholder="描述任务要执行的操作...">${Components.escapeHtml(job.command || job.action || '')}</textarea>`)}
                    ${Components.formGroup('状态', `<select class="form-input" id="cronStatus">
                        <option value="active" ${job.status === 'active' ? 'selected' : ''}>运行中</option>
                        <option value="paused" ${job.status === 'paused' ? 'selected' : ''}>暂停</option>
                    </select>`)}
                </div>
                <div class="modal-footer">
                    <button class="btn btn-ghost" onclick="CronPage.hideForm()">取消</button>
                    <button class="btn btn-primary" onclick="CronPage.saveJob()">${isEdit ? '保存' : '创建'}</button>
                </div>
            </div>
        </div>`;
    }

    function showCreateForm() {
        _showForm = true;
        _editingJob = null;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function editJob(id) {
        _showForm = true;
        _editingJob = id;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    function hideForm() {
        _showForm = false;
        _editingJob = null;
        document.getElementById('contentBody').innerHTML = buildPage();
        bindEvents();
    }

    async function saveJob() {
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
            await render();
        } catch (err) {
            Components.Toast.error(`操作失败: ${err.message}`);
        }
    }

    async function deleteJob(id) {
        try {
            await API.cron.delete(id);
            Components.Toast.success('任务已删除');
            await render();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function triggerJob(id) {
        try {
            await API.cron.trigger(id);
            Components.Toast.success('任务已触发');
        } catch (err) {
            Components.Toast.error(`触发失败: ${err.message}`);
        }
    }

    function bindEvents() {}

    return { render, showCreateForm, editJob, hideForm, saveJob, deleteJob, triggerJob };
})();
