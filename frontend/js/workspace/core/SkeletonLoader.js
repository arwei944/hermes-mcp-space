/**
 * SkeletonLoader.js — 骨架屏加载组件
 * 
 * 为卡片提供骨架屏加载动画，替代简单的"加载中..."文本。
 * 支持 IIFE 模块模式，使用 var 声明，自动注入样式。
 * 
 * @module SkeletonLoader
 * @version 1.0.0
 * @location frontend/js/workspace/core/SkeletonLoader.js
 */
var SkeletonLoader = (() => {

    // ============================================================
    // 样式注入
    // ============================================================

    /** 样式表 ID，防止重复注入 */
    var STYLE_ID = 'skeleton-styles';

    /** 是否已注入样式 */
    var stylesInjected = false;

    /**
     * 生成骨架屏 CSS 样式
     * @returns {string} 完整的 CSS 字符串
     */
    function buildStyles() {
        return [
            /* 基础骨架元素样式 */
            '.skel {',
            '    background: linear-gradient(90deg, var(--bg-secondary, #e8e8e8) 25%, var(--bg-tertiary, #f0f0f0) 50%, var(--bg-secondary, #e8e8e8) 75%);',
            '    background-size: 200% 100%;',
            '    animation: skel-shimmer 1.5s ease-in-out infinite;',
            '    border-radius: var(--radius-xs, 4px);',
            '    box-sizing: border-box;',
            '}',

            /* 闪烁动画 — 从左到右渐变扫过 */
            '@keyframes skel-shimmer {',
            '    0% { background-position: 200% 0; }',
            '    100% { background-position: -200% 0; }',
            '}',

            /* 圆形占位 — 头像、图标 */
            '.skel-circle {',
            '    border-radius: 50%;',
            '    flex-shrink: 0;',
            '}',

            /* 矩形占位 — 按钮、卡片背景 */
            '.skel-rect {',
            '    border-radius: var(--radius-xs, 4px);',
            '}',

            /* 文本行占位 */
            '.skel-line {',
            '    height: 12px;',
            '    width: 100%;',
            '    border-radius: var(--radius-xs, 4px);',
            '}',

            /* 短文本行 */
            '.skel-line--short {',
            '    width: 60px;',
            '}',

            /* 中等文本行 */
            '.skel-line--medium {',
            '    width: 120px;',
            '}',

            /* 长文本行 */
            '.skel-line--long {',
            '    width: 200px;',
            '}',

            /* 内容块占位 */
            '.skel-block {',
            '    height: 48px;',
            '    width: 100%;',
            '}',

            /* 统计数字占位 */
            '.skel-stat-number {',
            '    height: 32px;',
            '    width: 80px;',
            '    margin-bottom: 8px;',
            '}',

            /* 统计标签占位 */
            '.skel-stat-label {',
            '    height: 10px;',
            '    width: 60px;',
            '}',

            /* 骨架卡片容器 */
            '.skel-card {',
            '    padding: 16px;',
            '    border-radius: var(--radius-sm, 8px);',
            '    border: 1px solid var(--border-color, #e0e0e0);',
            '    background: var(--bg-primary, #ffffff);',
            '}',

            /* 骨架行容器 */
            '.skel-row {',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 12px;',
            '    padding: 10px 0;',
            '}',

            /* 骨架统计网格 */
            '.skel-stats-grid {',
            '    display: grid;',
            '    grid-template-columns: 1fr 1fr;',
            '    gap: 12px;',
            '}',

            /* 骨架统计项 */
            '.skel-stat-item {',
            '    padding: 16px;',
            '    border-radius: var(--radius-sm, 8px);',
            '    border: 1px solid var(--border-color, #e0e0e0);',
            '    background: var(--bg-primary, #ffffff);',
            '}',

            /* 骨架头部区域 */
            '.skel-header {',
            '    display: flex;',
            '    align-items: center;',
            '    gap: 12px;',
            '    margin-bottom: 16px;',
            '}',

            /* 骨架头部文本区域 */
            '.skel-header-text {',
            '    flex: 1;',
            '    display: flex;',
            '    flex-direction: column;',
            '    gap: 8px;',
            '}',

            /* 骨架主体区域 */
            '.skel-body {',
            '    display: flex;',
            '    flex-direction: column;',
            '    gap: 10px;',
            '}',

            /* 骨架按钮区域 */
            '.skel-footer {',
            '    margin-top: 16px;',
            '    display: flex;',
            '    justify-content: flex-end;',
            '}'
        ].join('\n');
    }

    /**
     * 注入骨架屏样式到页面（仅注入一次）
     */
    function injectStyles() {
        if (stylesInjected) return;
        if (document.getElementById(STYLE_ID)) {
            stylesInjected = true;
            return;
        }

        var style = document.createElement('style');
        style.id = STYLE_ID;
        style.textContent = buildStyles();
        document.head.appendChild(style);
        stylesInjected = true;
    }

    // ============================================================
    // 工具函数
    // ============================================================

    /**
     * 生成随机动画延迟（0-500ms），产生自然错落效果
     * @returns {string} CSS animation-delay 值
     */
    function randomDelay() {
        var ms = Math.floor(Math.random() * 500);
        return ms + 'ms';
    }

    /**
     * 创建骨架元素
     * @param {string} className - CSS 类名
     * @param {Object} [style] - 额外内联样式
     * @returns {HTMLElement} 骨架 DOM 元素
     */
    function createSkel(className, style) {
        var el = document.createElement('div');
        el.className = 'skel ' + className;
        el.style.animationDelay = randomDelay();
        if (style) {
            var keys = Object.keys(style);
            for (var i = 0; i < keys.length; i++) {
                el.style[keys[i]] = style[keys[i]];
            }
        }
        return el;
    }

    /**
     * 生成随机宽度百分比（用于文本行宽度变化）
     * @param {number} min - 最小百分比
     * @param {number} max - 最大百分比
     * @returns {string} CSS width 值
     */
    function randomWidth(min, max) {
        var pct = min + Math.floor(Math.random() * (max - min));
        return pct + '%';
    }

    /**
     * 获取合并后的选项（默认值 + 用户传入）
     * @param {Object} defaults - 默认选项
     * @param {Object} options - 用户选项
     * @returns {Object} 合并后的选项
     */
    function mergeOptions(defaults, options) {
        var merged = {};
        var keys = Object.keys(defaults);
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            merged[key] = (options && options[key] !== undefined) ? options[key] : defaults[key];
        }
        return merged;
    }

    /**
     * 标记容器为骨架状态
     * @param {HTMLElement} container - 目标容器
     */
    function markContainer(container) {
        container.setAttribute('data-skeleton', 'true');
    }

    // ============================================================
    // 渲染方法
    // ============================================================

    /**
     * 渲染骨架卡片
     * 模拟卡片布局：头部（头像+标题）+ 正文（多行文本）+ 底部按钮
     * 
     * @param {HTMLElement} container - 目标容器
     * @param {Object} [options] - 配置选项
     * @param {number} [options.lines=3] - 正文文本行数
     * @param {boolean} [options.hasAvatar=false] - 是否显示头像占位
     * @param {boolean} [options.hasButton=false] - 是否显示按钮占位
     */
    function renderCard(container, options) {
        if (!container) return;
        injectStyles();

        var opts = mergeOptions({
            lines: 3,
            hasAvatar: false,
            hasButton: false
        }, options);

        // 创建卡片容器
        var card = document.createElement('div');
        card.className = 'skel-card';

        // 头部区域
        var header = document.createElement('div');
        header.className = 'skel-header';

        // 头像占位（可选）
        if (opts.hasAvatar) {
            var avatar = createSkel('skel-circle', {
                width: '40px',
                height: '40px'
            });
            header.appendChild(avatar);
        }

        // 标题和副标题
        var headerText = document.createElement('div');
        headerText.className = 'skel-header-text';

        var titleLine = createSkel('skel-line', { width: '70%' });
        var subtitleLine = createSkel('skel-line', { width: '45%' });
        subtitleLine.style.height = '10px';
        headerText.appendChild(titleLine);
        headerText.appendChild(subtitleLine);

        header.appendChild(headerText);
        card.appendChild(header);

        // 正文区域 — N 行文本，宽度递减
        var body = document.createElement('div');
        body.className = 'skel-body';

        // 预定义宽度比例，模拟真实文本分布
        var widthPatterns = [0.8, 0.6, 0.4, 0.75, 0.55, 0.85, 0.5, 0.7];

        for (var i = 0; i < opts.lines; i++) {
            var widthPct = widthPatterns[i % widthPatterns.length];
            var line = createSkel('skel-line', { width: (widthPct * 100) + '%' });
            body.appendChild(line);
        }

        card.appendChild(body);

        // 底部按钮占位（可选）
        if (opts.hasButton) {
            var footer = document.createElement('div');
            footer.className = 'skel-footer';
            var btn = createSkel('skel-rect', {
                width: '80px',
                height: '32px'
            });
            footer.appendChild(btn);
            card.appendChild(footer);
        }

        container.appendChild(card);
        markContainer(container);
    }

    /**
     * 渲染骨架列表
     * 模拟列表布局：N 行，每行包含图标 + 两行文本 + 元信息
     * 
     * @param {HTMLElement} container - 目标容器
     * @param {Object} [options] - 配置选项
     * @param {number} [options.count=5] - 列表行数
     * @param {boolean} [options.hasIcon=true] - 是否显示图标占位
     */
    function renderList(container, options) {
        if (!container) return;
        injectStyles();

        var opts = mergeOptions({
            count: 5,
            hasIcon: true
        }, options);

        // 文本宽度变化模式，产生自然交替效果
        var textWidths = [
            { line1: '65%', line2: '40%', meta: '60px' },
            { line1: '75%', line2: '50%', meta: '80px' },
            { line1: '55%', line2: '35%', meta: '50px' },
            { line1: '80%', line2: '45%', meta: '70px' },
            { line1: '60%', line2: '55%', meta: '90px' }
        ];

        for (var i = 0; i < opts.count; i++) {
            var row = document.createElement('div');
            row.className = 'skel-row';

            // 图标占位（可选）
            if (opts.hasIcon) {
                var icon = createSkel('skel-circle', {
                    width: '32px',
                    height: '32px'
                });
                row.appendChild(icon);
            }

            // 文本区域
            var textArea = document.createElement('div');
            textArea.style.flex = '1';
            textArea.style.display = 'flex';
            textArea.style.flexDirection = 'column';
            textArea.style.gap = '6px';

            var pattern = textWidths[i % textWidths.length];

            var line1 = createSkel('skel-line', { width: pattern.line1 });
            textArea.appendChild(line1);

            var line2 = createSkel('skel-line', { width: pattern.line2 });
            line2.style.height = '10px';
            textArea.appendChild(line2);

            row.appendChild(textArea);

            // 元信息占位
            var meta = createSkel('skel-line skel-line--short', { width: pattern.meta });
            meta.style.height = '10px';
            row.appendChild(meta);

            container.appendChild(row);
        }

        markContainer(container);
    }

    /**
     * 渲染骨架统计网格
     * 模拟 2x2 统计卡片布局，每项包含大数字 + 标签
     * 
     * @param {HTMLElement} container - 目标容器
     * @param {Object} [options] - 配置选项
     * @param {number} [options.count=4] - 统计项数量（建议为 4 的倍数）
     */
    function renderStats(container, options) {
        if (!container) return;
        injectStyles();

        var opts = mergeOptions({
            count: 4
        }, options);

        var grid = document.createElement('div');
        grid.className = 'skel-stats-grid';

        for (var i = 0; i < opts.count; i++) {
            var item = document.createElement('div');
            item.className = 'skel-stat-item';

            // 数字占位
            var number = createSkel('skel skel-stat-number');
            item.appendChild(number);

            // 标签占位
            var label = createSkel('skel skel-stat-label');
            item.appendChild(label);

            grid.appendChild(item);
        }

        container.appendChild(grid);
        markContainer(container);
    }

    /**
     * 渲染骨架文本块
     * 模拟纯文本内容区域，多行随机宽度
     * 
     * @param {HTMLElement} container - 目标容器
     * @param {Object} [options] - 配置选项
     * @param {number} [options.lines=4] - 文本行数
     */
    function renderText(container, options) {
        if (!container) return;
        injectStyles();

        var opts = mergeOptions({
            lines: 4
        }, options);

        var wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.flexDirection = 'column';
        wrapper.style.gap = '10px';

        for (var i = 0; i < opts.lines; i++) {
            // 随机宽度在 40%-90% 之间
            var width = randomWidth(40, 90);
            var line = createSkel('skel-line', { width: width });
            wrapper.appendChild(line);
        }

        container.appendChild(wrapper);
        markContainer(container);
    }

    /**
     * 移除容器中所有骨架元素
     * 清理骨架屏状态，为真实内容腾出空间
     * 
     * @param {HTMLElement} container - 目标容器
     */
    function remove(container) {
        if (!container) return;

        // 移除所有骨架相关元素
        var skeletons = container.querySelectorAll('.skel, .skel-card, .skel-row, .skel-stats-grid, .skel-stat-item, .skel-header, .skel-body, .skel-footer');
        for (var i = 0; i < skeletons.length; i++) {
            var parent = skeletons[i].parentNode;
            if (parent) {
                parent.removeChild(skeletons[i]);
            }
        }

        // 清除骨架状态标记
        container.removeAttribute('data-skeleton');
    }

    // ============================================================
    // 公开 API
    // ============================================================

    return {
        /** 渲染骨架卡片 */
        renderCard: renderCard,

        /** 渲染骨架列表 */
        renderList: renderList,

        /** 渲染骨架统计网格 */
        renderStats: renderStats,

        /** 渲染骨架文本块 */
        renderText: renderText,

        /** 移除骨架元素 */
        remove: remove
    };

})();
