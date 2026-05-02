/**
 * 操作日志页面 - 布局外壳
 * 仅提供页面框架和容器 div，实际列表由 LogList.js 渲染
 */

const LogsPageLayout = (() => {
    function buildLayout() {
        return Components.renderSection('操作日志', '<div id="log-list"></div>');
    }

    return { buildLayout };
})();

export default LogsPageLayout;
