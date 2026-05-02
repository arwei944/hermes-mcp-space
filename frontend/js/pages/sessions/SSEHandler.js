/**
 * 会话页面 - SSE 实时事件处理模块
 * 处理 session.message / session.updated / session.deleted / mcp.tool_complete
 */

const SSEHandler = (() => {
    var _modules = {};

    async function _ensureModules() {
        if (_modules.sessionList) return;
        _modules.sessionList = (await import('./SessionList.js')).default;
        _modules.chatView = (await import('./ChatView.js')).default;
        _modules.sessionDetail = (await import('./SessionDetail.js')).default;
    }

    function onSSEEvent(type, data) {
        _ensureModules();
        var sl = _modules.sessionList;
        var cv = _modules.chatView;

        if (type === 'session.message' && data) {
            var sid = data.session_id;
            var msg = { role: data.role, content: data.content, timestamp: data.timestamp };

            if (sid === cv.getCurrentId()) {
                var messages = cv.getMessages();
                messages.push(msg);
                if (data.role === 'assistant') {
                    cv.hideTypingIndicator();
                    cv.appendMessage(msg);
                } else {
                    cv.appendMessage(msg);
                    cv.showTypingIndicator();
                }
                cv.refreshStatusBar();
            } else {
                var sessions = sl.getSessions();
                var exists = sessions.some(function (s) { return (s.id || s.session_id) === sid; });
                if (exists) {
                    var s = sessions.find(function (s) { return (s.id || s.session_id) === sid; });
                    if (s) { s._newMessages = true; s.message_count = (s.message_count || 0) + 1; }
                    sl.refresh();
                    setTimeout(function () {
                        if (s) { s._newMessages = false; sl.refresh(); }
                    }, 3000);
                } else {
                    API.sessions.list().then(function (list) {
                        sl.setSessions(list);
                        sl.refresh();
                    }).catch(function () {});
                }
            }
        }

        if (type === 'session.updated') {
            API.sessions.list().then(function (list) {
                sl.setSessions(list);
                sl.refresh();
                cv.refreshMain();
            }).catch(function () {});
        }

        if (type === 'session.deleted') {
            var deletedId = data && (data.session_id || data.id);
            if (deletedId) {
                var sessions = sl.getSessions().filter(function (s) { return (s.id || s.session_id) !== deletedId; });
                sl.setSessions(sessions);
                if (cv.getCurrentId() === deletedId) {
                    cv.setCurrentId(null);
                    cv.setMessages([]);
                    cv.setToolCards({});
                    if (sessions.length > 0) {
                        var nextId = sessions[0].id || sessions[0].session_id;
                        _modules.sessionDetail.selectSession(nextId).then(function () { cv.refreshMain(); });
                    } else {
                        cv.refreshMain();
                    }
                } else {
                    sl.refresh();
                }
            }
        }

        if (type === 'mcp.tool_complete' && data) {
            var toolSid = data.session_id;
            if (toolSid === cv.getCurrentId()) {
                var key = data.tool_name + '_' + (data.timestamp || Date.now());
                cv.appendToolCard(key, data);
            }
        }
    }

    function destroy() {
        _modules = {};
    }

    return { onSSEEvent, destroy };
})();

export default SSEHandler;
