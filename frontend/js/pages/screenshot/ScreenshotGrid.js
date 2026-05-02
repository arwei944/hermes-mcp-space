const ScreenshotGrid = (() => {
    let _screenshots = [];
    let _loading = false;
    let _container = null;

    async function render(containerSelector) {
        _container = document.querySelector(containerSelector);
        if (!_container) return;
        _container.innerHTML = Components.createLoading();
        await loadScreenshots();
        _container.innerHTML = buildPage();
        bindEvents();
    }

    function buildPage() {
        return `
        <!-- 输入区域 -->
        <div style="background:var(--surface);border-radius:var(--radius-sm);padding:20px;margin-bottom:20px">
            <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
                <div style="flex:1;min-width:300px">
                    <input type="text" id="screenshotUrl" placeholder="输入网页 URL，如 https://example.com"
                        style="width:100%;padding:10px 14px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg-primary);color:var(--text-primary);font-size:14px;outline:none"
                        onfocus="this.style.borderColor='var(--accent)'" onblur="this.style.borderColor='var(--border)'" />
                </div>
                <select id="screenshotWidth" style="padding:10px;border:1px solid var(--border);border-radius:var(--radius-xs);background:var(--bg-primary);color:var(--text-primary);font-size:14px">
                    <option value="1280">1280 × 720</option>
                    <option value="1920">1920 × 1080</option>
                    <option value="768">768 × 1024 (平板)</option>
                    <option value="375">375 × 812 (手机)</option>
                </select>
                <label style="display:flex;align-items:center;gap:6px;color:var(--text-secondary);font-size:13px;cursor:pointer">
                    <input type="checkbox" id="screenshotFullPage" style="accent-color:var(--accent)" />
                    长截图
                </label>
                <button id="captureBtn" data-action="capture"
                    style="padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:var(--radius-xs);cursor:pointer;font-size:14px;display:flex;align-items:center;gap:6px">
                    ${Components.icon('camera', 16)} 截图
                </button>
            </div>
        </div>

        <!-- 截图列表 -->
        <div id="screenshotList">
            ${buildScreenshotList()}
        </div>`;
    }

    function buildScreenshotList() {
        if (_screenshots.length === 0) {
            return Components.createEmptyState(
                Components.icon('camera', 32),
                '暂无截图',
                '输入 URL 开始截取网页截图',
                '',
            );
        }
        const items = _screenshots
            .map((s, idx) => {
                const time = Components.formatTime(s.created_at);
                const size = s.size ? `${(s.size / 1024).toFixed(1)} KB` : '-';
                return `<div style="display:flex;align-items:center;gap:14px;padding:14px 16px;border-bottom:1px solid var(--border);transition:background 0.15s"
                    onmouseenter="this.style.background='var(--hover-bg)'" onmouseleave="this.style.background=''">
                <div style="flex-shrink:0;color:var(--accent)">${Components.icon('image', 18)}</div>
                <div style="flex:1;min-width:0">
                    <div style="font-size:14px;color:var(--text-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${Components.escapeHtml(s.url)}">${Components.escapeHtml(s.url)}</div>
                    <div style="font-size:12px;color:var(--text-tertiary);margin-top:3px">${time} · ${s.width || '-'}×${s.height || '-'} · ${size}${s.note ? ' · ' + Components.escapeHtml(s.note) : ''}</div>
                </div>
                <button data-action="delete" data-filename="${Components.escapeHtml(s.filename)}" data-index="${idx}"
                    style="padding:6px 10px;background:transparent;border:1px solid var(--border);border-radius:var(--radius-xs);cursor:pointer;color:var(--text-tertiary);font-size:12px;transition:all 0.15s"
                    onmouseenter="this.style.borderColor='var(--red)';this.style.color='var(--red)'" onmouseleave="this.style.borderColor='var(--border)';this.style.color='var(--text-tertiary)'">
                    ${Components.icon('trash', 12)}
                </button>
            </div>`;
            })
            .join('');
        return `<div style="background:var(--surface);border-radius:var(--radius-sm);overflow:hidden">${items}</div>`;
    }

    function bindEvents() {
        if (!_container) return;
        const input = document.getElementById('screenshotUrl');
        if (input) {
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') capture();
            });
        }
        _container.addEventListener('click', (e) => {
            const target = e.target.closest('[data-action]');
            if (!target) return;
            const action = target.dataset.action;
            if (action === 'capture') {
                capture();
            } else if (action === 'delete') {
                const filename = target.dataset.filename;
                const idx = parseInt(target.dataset.index, 10);
                deleteScreenshot(filename, idx);
            }
        });
    }

    async function loadScreenshots() {
        try {
            _screenshots = await API.get('/api/screenshots');
        } catch (_err) {
            _screenshots = [];
        }
    }

    async function capture() {
        if (_loading) return;
        const url = document.getElementById('screenshotUrl')?.value?.trim();
        if (!url) {
            Components.Toast.warning('请输入网页 URL');
            return;
        }

        const widthMap = { 1280: 720, 1920: 1080, 768: 1024, 375: 812 };
        const width = parseInt(document.getElementById('screenshotWidth')?.value || '1280');
        const height = widthMap[String(width)] || 720;
        const fullPage = document.getElementById('screenshotFullPage')?.checked || false;

        _loading = true;
        const btn = document.getElementById('captureBtn');
        if (btn) btn.innerHTML = Components.icon('loader', 16) + ' 截取中...';
        Components.Toast.info('正在截取网页...');

        try {
            const result = await API.post('/api/screenshot/capture', { url, width, height, full_page: fullPage });
            if (result.success) {
                Components.Toast.success('截图完成');
                await loadScreenshots();
                const listEl = document.getElementById('screenshotList');
                if (listEl) listEl.innerHTML = buildScreenshotList();
                if (btn) btn.innerHTML = Components.icon('camera', 16) + ' 截图';
            } else {
                Components.Toast.error('截图失败: ' + (result.error || '未知错误'));
                if (btn) btn.innerHTML = Components.icon('camera', 16) + ' 截图';
            }
        } catch (err) {
            Components.Toast.error('截图失败: ' + (err.message || '网络错误'));
            if (btn) btn.innerHTML = Components.icon('camera', 16) + ' 截图';
        }
        _loading = false;
    }

    async function deleteScreenshot(filename, idx) {
        const ok = await Components.Modal.confirm({
            title: '删除截图',
            message: `确定要删除截图 <strong>${Components.escapeHtml(filename)}</strong> 吗？此操作不可撤销。`,
            confirmText: '删除',
            type: 'danger',
        });
        if (!ok) return;

        try {
            await API.del(`/api/screenshots/${filename}`);
            _screenshots.splice(idx, 1);
            const listEl = document.getElementById('screenshotList');
            if (listEl) listEl.innerHTML = buildScreenshotList();
            Components.Toast.success('已删除');
        } catch (err) {
            Components.Toast.error('删除失败: ' + (err.message || '未知错误'));
        }
    }

    function destroy() {
        _screenshots = [];
        _loading = false;
        _container = null;
    }

    return { render, destroy };
})();

export default ScreenshotGrid;
