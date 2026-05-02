/**
 * 会话对话页面 - 布局骨架
 * 提供页面框架：sidebar 容器 + main 容器
 */

const ChatPageLayout = (() => {
    function buildLayout() {
        return `
            <div class="chat-layout">
                <div class="chat-sidebar" id="chat-sidebar"></div>
                <div class="chat-main" id="chat-main"></div>
            </div>
        `;
    }

    return { buildLayout };
})();

export default ChatPageLayout;
