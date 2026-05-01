// 对话对比工具
// 提供两个会话的并排对比视图
var SessionCompare = {
    render: function (containerId, sessionA, sessionB) {
        var container = document.getElementById(containerId);
        if (!container) return;

        var msgsA = sessionA.messages || [];
        var msgsB = sessionB.messages || [];
        var maxLen = Math.max(msgsA.length, msgsB.length);

        var html = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">' +
            '<div>' +
            '<h4 style="margin:0 0 8px;font-size:14px;color:#3b82f6;">' + (sessionA.title || '会话 A') + '</h4>' +
            '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;max-height:400px;overflow-y:auto;">';

        for (var i = 0; i < maxLen; i++) {
            var msgA = msgsA[i];
            var roleA = msgA ? msgA.role : '-';
            var contentA = msgA ? (msgA.content || '').substring(0, 200) : '';
            var bgA = roleA === 'user' ? '#eff6ff' : '#f0fdf4';
            html += '<div style="margin-bottom:8px;padding:8px;border-radius:6px;background:' + bgA + ';">' +
                '<strong>' + roleA + ':</strong> ' + contentA +
                '</div>';
        }

        html += '</div></div><div>' +
            '<h4 style="margin:0 0 8px;font-size:14px;color:#8b5cf6;">' + (sessionB.title || '会话 B') + '</h4>' +
            '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px;max-height:400px;overflow-y:auto;">';

        for (var j = 0; j < maxLen; j++) {
            var msgB = msgsB[j];
            var roleB = msgB ? msgB.role : '-';
            var contentB = msgB ? (msgB.content || '').substring(0, 200) : '';
            var bgB = roleB === 'user' ? '#faf5ff' : '#fdf4ff';
            html += '<div style="margin-bottom:8px;padding:8px;border-radius:6px;background:' + bgB + ';">' +
                '<strong>' + roleB + ':</strong> ' + contentB +
                '</div>';
        }

        html += '</div></div>';
        container.innerHTML = html;
    }
};
