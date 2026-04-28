/**
 * 定时任务页面
 * 任务列表、创建/编辑/删除、查看执行历史
 */

const CronPage = (() => {
    let _jobs = [];
    let _expandedJob = null;

    async function render() {
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.cron.list();
            _jobs = data.jobs || data || [];
        } catch (err) {
            _jobs = getMockJobs();
        }

        container.innerHTML = buildPage();
        bindEvents();
    }

    function getMockJobs() {
        return [
            {
                id: 'job_001',
                name: '每日系统检查',
                schedule: '0 9 * * *',
                scheduleHuman: '每天 09:00',
                enabled: true,
                nextRun: new Date(Date.now() + 3600000).toISOString(),
                lastRun: new Date(Date.now() - 86400000).toISOString(),
                lastOutput: '系统运行正常，内存使用率 45%',
                status: 'idle',
            },
            {
                id: 'job_002',
                name: '数据备份',
                schedule: '0 2 * * *',
                scheduleHuman: '每天 02:00',
                enabled: true,
                nextRun: new Date(Date.now() + 7200000).toISOString(),
                lastRun: new Date(Date.now() - 82800000).toISOString(),
                lastOutput: '备份完成，文件大小 2.3MB',
                status: 'idle',
            },
            {
                id: 'job_003',
                name: '缓存清理',
                schedule: '*/30 * * * *',
                scheduleHuman: '每 30 分钟',
                enabled: true,
                nextRun: new Date(Date.now() + 600000).toISOString(),
                lastRun: new Date(Date.now() - 1800000).toISOString(),
                lastOutput: '清理了 15 个过期缓存文件',
                status: 'idle',
            },
            {
                id: 'job_004',
                name: '周报生成',
                schedule: '0 18 * * 5',
                scheduleHuman: '每周五 18:00',
                enabled: false,
                nextRun: null,
                lastRun: new Date(Date.now() - 604800000).toISOString(),
                lastOutput: '周报已生成并发送',
                status: 'disabled',
            },
        ];
    }

    function buildPage() {
        const tableHtml = Components.createTable({
            columns: [
                {
                    key: 'name', label: '任务名称',
                    render: (v, row) => `
                        <div>
                            <div style="font-weight:500;color:var(--text-heading)">${Components.escapeHtml(v)}</div>
                            <div style="font-size:0.75rem;color:var(--text-muted);font-family:monospace">${Components.escapeHtml(row.schedule || '')}</div>
                        </div>
                    `
                },
                {
                    key: 'scheduleHuman', label: '调度',
                    render: (v) => Components.badge(v || '-', 'info')
                },
                {
                    key: 'enabled', label: '状态',
                    render: (v) => v
                        ? Components.badge('启用', 'success')
                        : Components.badge('禁用', 'muted')
                },
                {
                    key: 'nextRun', label: '下次执行',
                    render: (v) => v ? Components.formatTime(v) : '-'
                },
                {
                    key: 'lastOutput', label: '最后输出',
                    render: (v) => Components.truncate(v || '-', 40)
                },
            ],
            rows: _jobs,
            actions: (row) => `
                <button class="btn btn-sm btn-ghost" onclick="CronPage.viewHistory('${row.id}')" title="执行历史">📜</button>
                <button class="btn btn-sm btn-ghost" onclick="CronPage.editJob('${row.id}')" title="编辑">✏️</button>
                <button class="btn btn-sm btn-success" onclick="CronPage.triggerJob('${row.id}')" title="立即执行">▶</button>
                <button class="btn btn-sm btn-danger" onclick="CronPage.deleteJob('${row.id}')" title="删除">🗑</button>
            `,
            emptyText: '暂无定时任务',
            toolbar: {
                actions: `
                    <button class="btn btn-sm btn-primary" onclick="CronPage.createJob()">+ 新建任务</button>
                `,
            },
        });

        return `
            <div class="page-enter">
                ${tableHtml}
                <div id="cronHistoryContainer"></div>
            </div>
        `;
    }

    function createJob() {
        Components.Modal.open({
            title: '创建定时任务',
            content: `
                <form id="cronForm">
                    ${Components.formGroup('任务名称', Components.formInput('name', '例如: 每日备份', ''))}
                    ${Components.formGroup('Cron 表达式', Components.formInput('schedule', '例如: 0 9 * * *', ''), '格式: 分 时 日 月 星期')}
                    ${Components.formGroup('执行命令 / 提示词', Components.formTextarea('command', '描述任务要执行的操作...', '', 5))}
                    ${Components.formGroup('启用', Components.formSwitch('enabled', '创建后立即启用', true))}
                </form>
            `,
            footer: `
                <button class="btn btn-ghost" onclick="Components.Modal.close()">取消</button>
                <button class="btn btn-primary" onclick="CronPage.saveNewJob()">创建</button>
            `,
        });
    }

    async function saveNewJob() {
        const form = document.getElementById('cronForm');
        if (!form) return;

        const name = form.querySelector('[name="name"]').value.trim();
        const schedule = form.querySelector('[name="schedule"]').value.trim();
        const command = form.querySelector('[name="command"]').value.trim();
        const enabled = form.querySelector('[name="enabled"]').checked;

        if (!name || !schedule) {
            Components.Toast.warning('请填写任务名称和 Cron 表达式');
            return;
        }

        try {
            await API.cron.create({ name, schedule, command, enabled });
            Components.Toast.success('任务创建成功');
            Components.Modal.close();
            render();
        } catch (err) {
            Components.Toast.error(`创建失败: ${err.message}`);
        }
    }

    function editJob(id) {
        const job = _jobs.find(j => j.id === id);
        if (!job) return;

        Components.Modal.open({
            title: `编辑任务: ${job.name}`,
            content: `
                <form id="cronEditForm">
                    ${Components.formGroup('任务名称', Components.formInput('name', '', job.name))}
                    ${Components.formGroup('Cron 表达式', Components.formInput('schedule', '', job.schedule))}
                    ${Components.formGroup('启用', Components.formSwitch('enabled', '启用任务', job.enabled))}
                </form>
            `,
            footer: `
                <button class="btn btn-ghost" onclick="Components.Modal.close()">取消</button>
                <button class="btn btn-primary" onclick="CronPage.saveEditJob('${id}')">保存</button>
            `,
        });
    }

    async function saveEditJob(id) {
        const form = document.getElementById('cronEditForm');
        if (!form) return;

        const name = form.querySelector('[name="name"]').value.trim();
        const schedule = form.querySelector('[name="schedule"]').value.trim();
        const enabled = form.querySelector('[name="enabled"]').checked;

        try {
            await API.cron.update(id, { name, schedule, enabled });
            Components.Toast.success('任务已更新');
            Components.Modal.close();
            render();
        } catch (err) {
            Components.Toast.error(`更新失败: ${err.message}`);
        }
    }

    async function deleteJob(id) {
        if (!confirm('确定要删除该定时任务吗？')) return;

        try {
            await API.cron.delete(id);
            Components.Toast.success('任务已删除');
            _jobs = _jobs.filter(j => j.id !== id);
            document.getElementById('contentBody').innerHTML = buildPage();
            bindEvents();
        } catch (err) {
            Components.Toast.error(`删除失败: ${err.message}`);
        }
    }

    async function triggerJob(id) {
        try {
            Components.Toast.info('正在触发任务...');
            await API.cron.trigger(id);
            Components.Toast.success('任务已触发');
        } catch (err) {
            Components.Toast.error(`触发失败: ${err.message}`);
        }
    }

    async function viewHistory(id) {
        const job = _jobs.find(j => j.id === id);
        const container = document.getElementById('cronHistoryContainer');

        if (_expandedJob === id) {
            _expandedJob = null;
            container.innerHTML = '';
            return;
        }

        _expandedJob = id;
        container.innerHTML = Components.createLoading();

        try {
            const data = await API.cron.history(id);
            const history = data.history || data || [];

            if (history.length === 0) {
                container.innerHTML = Components.createEmptyState('📜', '暂无历史', '该任务没有执行记录', '');
                return;
            }

            const historyHtml = history.map(h => `
                <div class="message-item">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
                        <span class="message-role ${h.success !== false ? 'assistant' : 'tool'}">
                            ${h.success !== false ? '成功' : '失败'}
                        </span>
                        <span style="font-size:0.75rem;color:var(--text-muted)">${Components.formatDateTime(h.executedAt || h.timestamp)}</span>
                    </div>
                    <div class="message-content">${Components.truncate(h.output || '无输出', 200)}</div>
                </div>
            `).join('');

            container.innerHTML = `
                <div style="margin-top:16px">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                        <span style="font-size:0.85rem;font-weight:600;color:var(--text-heading)">执行历史 - ${job ? job.name : id}</span>
                        <button class="btn btn-sm btn-ghost" onclick="CronPage.closeHistory()">收起</button>
                    </div>
                    <div class="message-thread">${historyHtml}</div>
                </div>
            `;
        } catch (err) {
            container.innerHTML = Components.createEmptyState('📜', '加载失败', err.message, '');
        }
    }

    function closeHistory() {
        _expandedJob = null;
        const container = document.getElementById('cronHistoryContainer');
        if (container) container.innerHTML = '';
    }

    function bindEvents() {}

    function init() {}

    return { render, init, createJob, saveNewJob, editJob, saveEditJob, deleteJob, triggerJob, viewHistory, closeHistory };
})();
