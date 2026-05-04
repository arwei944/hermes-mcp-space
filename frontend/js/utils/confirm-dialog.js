/**
 * Hermes Agent - 二次确认对话框
 * V7-21: 批量操作添加二次确认对话框
 */

function showConfirmDialog(title, message, onConfirm) {
    // 移除已有的对话框
    var existing = document.getElementById('confirm-dialog-overlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'confirm-dialog-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;z-index:var(--z-overlay);';
    overlay.innerHTML =
        '<div style="background:var(--surface,white);border-radius:12px;padding:24px;min-width:360px;box-shadow:0 8px 32px rgba(0,0,0,0.2);">' +
            '<h3 style="margin:0 0 12px;font-size:16px;color:var(--text-primary,#111);">' + title + '</h3>' +
            '<p style="margin:0 0 20px;font-size:14px;color:var(--text-secondary,#666);line-height:1.5;">' + message + '</p>' +
            '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
                '<button id="confirm-cancel" style="padding:8px 16px;border:1px solid var(--border-strong,#d1d5db);border-radius:6px;background:var(--surface,white);cursor:pointer;font-size:14px;color:var(--text-primary,#111);">取消</button>' +
                '<button id="confirm-ok" style="padding:8px 16px;border:none;border-radius:6px;background:var(--red,#ef4444);color:#fff;cursor:pointer;font-size:14px;">确认</button>' +
            '</div>' +
        '</div>';
    document.body.appendChild(overlay);

    document.getElementById('confirm-cancel').onclick = function () { overlay.remove(); };
    document.getElementById('confirm-ok').onclick = function () {
        overlay.remove();
        onConfirm();
    };

    // 点击遮罩关闭
    overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.remove();
    });
}
