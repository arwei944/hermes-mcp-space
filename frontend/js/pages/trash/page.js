/**
 * 回收站页面 - 布局外壳
 * 仅提供页面框架和容器 div，实际列表由 TrashList.js 渲染
 */

const TrashPageLayout = (() => {
    function buildLayout() {
        return Components.renderSection('回收站', '<div id="trash-list"></div>');
    }

    return { buildLayout };
})();

export default TrashPageLayout;
