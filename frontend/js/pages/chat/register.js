/**
 * 会话对话页面 - 注册入口
 * V2 目录结构：register.js / page.js / ChatSidebar.js / ChatMessages.js
 */

const ChatPage = (() => {
    let _modules = {};

    async function _ensureModules() {
        if (_modules.page) return;
        _modules.page = (await import('./page.js')).default;
        _modules.chatSidebar = (await import('./ChatSidebar.js')).default;
        _modules.chatMessages = (await import('./ChatMessages.js')).default;
    }

    function _buildCallbacks() {
        return {
            onSessionSelect: (id) => {
                _modules.chatMessages.render('#chat-main', id);
            },
            onSessionCreated: (id) => {
                _modules.chatSidebar.render('#chat-sidebar', _buildCallbacks());
                _modules.chatMessages.render('#chat-main', id);
            },
            onSessionDeleted: () => {
                _modules.chatSidebar.render('#chat-sidebar', _buildCallbacks());
                _modules.chatMessages.render('#chat-main', null);
            },
        };
    }

    async function render(sessionId) {
        await _ensureModules();
        const container = document.getElementById('contentBody');
        container.innerHTML = Components.createLoading();

        const callbacks = _buildCallbacks();
        container.innerHTML = _modules.page.buildLayout();

        await _modules.chatSidebar.render('#chat-sidebar', callbacks);
        await _modules.chatMessages.render('#chat-main', sessionId);
    }

    function onSSEEvent(type, data) {}

    function destroy() {
        Object.values(_modules).forEach(m => m.destroy?.());
        _modules = {};
    }

    return { render, onSSEEvent, destroy };
})();

window.ChatPage = ErrorHandler.wrap(ChatPage);
