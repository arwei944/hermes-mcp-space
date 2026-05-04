/**
 * Hermes Agent - 导出进度条反馈
 * V7-20: 在导出操作中显示进度条
 */

function showExportProgress(message) {
    // 移除已有的进度条
    var existing = document.getElementById('export-progress-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'export-progress-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:var(--z-overlay);';
    overlay.innerHTML =
        '<div style="background:var(--surface,white);border-radius:12px;padding:24px 32px;min-width:300px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">' +
            '<div style="margin-bottom:12px;font-size:14px;color:var(--text-secondary,#666);">' + (message || '正在导出...') + '</div>' +
            '<div style="width:100%;height:4px;background:var(--bg,#e5e7eb);border-radius:2px;overflow:hidden;">' +
                '<div id="export-progress-bar" style="width:0%;height:100%;background:linear-gradient(90deg,var(--accent,#3b82f6),var(--purple,#8b5cf6));border-radius:2px;transition:width 0.3s;"></div>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    // 模拟进度
    var progress = 0;
    var interval = setInterval(function () {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        var bar = document.getElementById('export-progress-bar');
        if (bar) bar.style.width = progress + '%';
    }, 200);

    return {
        complete: function () {
            clearInterval(interval);
            var bar = document.getElementById('export-progress-bar');
            if (bar) bar.style.width = '100%';
            setTimeout(function () {
                var ov = document.getElementById('export-progress-overlay');
                if (ov) ov.remove();
            }, 500);
        },
        error: function (msg) {
            clearInterval(interval);
            var ov = document.getElementById('export-progress-overlay');
            if (ov) ov.remove();
        }
    };
}
