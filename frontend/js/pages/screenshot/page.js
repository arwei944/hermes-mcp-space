const Page = (() => {
    function buildLayout() {
        return `
        <div class="page-header">
            <h2>截图工具</h2>
            <span style="color:var(--text-tertiary);font-size:13px">输入 URL，自动截取网页截图</span>
        </div>
        <div id="screenshot-grid"></div>`;
    }

    function render() {}
    function destroy() {}

    return { buildLayout, render, destroy };
})();

export default Page;
