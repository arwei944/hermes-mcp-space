/**
 * ResponsiveManager.js - 响应式布局管理器
 * Hermes Workspace V2
 * 负责移动端/平板适配，断点检测，布局自动切换
 *
 * 位置: frontend/js/workspace/core/ResponsiveManager.js
 * 依赖: Bus, StateManager, LayoutEngine (全局变量)
 */

var ResponsiveManager = (() => {

    'use strict';

    /* ============================================================
     * 常量定义
     * ============================================================ */

    /** 断点阈值配置 */
    var BREAKPOINTS = {
        mobile: 480,     // <= 480px: 单列布局，简化界面
        tablet: 768,     // <= 768px: 两列布局，中等界面
        desktop: 1024,   // <= 1024px: 三列布局
        wide: Infinity   // > 1024px: 四列布局，完整界面
    };

    /** 防抖延迟时间（毫秒） */
    var DEBOUNCE_DELAY = 200;

    /** 注入样式表 ID */
    var STYLE_ELEMENT_ID = 'responsive-styles';

    /** 根元素 CSS 类名前缀 */
    var CLASS_MOBILE = 'ws-mobile';
    var CLASS_TABLET = 'ws-tablet';

    /** 事件名称常量 */
    var EVENT_CHANGE = 'ws:responsive:change';
    var EVENT_MOBILE = 'ws:responsive:mobile';
    var EVENT_DESKTOP = 'ws:responsive:desktop';
    var EVENT_ORIENTATION = 'ws:responsive:orientation';

    /** 布局模式映射 */
    var LAYOUT_MAP = {
        mobile: 'list',
        tablet: 'grid-2col',
        desktop: 'grid',
        wide: 'grid'
    };

    /* ============================================================
     * 内部状态
     * ============================================================ */

    /** 当前断点 */
    var currentBreakpoint = null;

    /** 当前容器宽度 */
    var currentWidth = 0;

    /** 当前方向: 'portrait' | 'landscape' */
    var currentOrientation = 'portrait';

    /** 防抖定时器 ID */
    var resizeTimer = null;

    /** 方向变化防抖定时器 */
    var orientationTimer = null;

    /** 样式元素引用 */
    var styleElement = null;

    /** 是否已初始化 */
    var initialized = false;

    /** 是否已销毁 */
    var destroyed = false;

    /** 绑定的事件处理函数引用（用于移除监听） */
    var boundHandleResize = null;
    var boundHandleOrientation = null;
    var boundHandleVisibility = null;

    /* ============================================================
     * 工具函数
     * ============================================================ */

    /**
     * 根据窗口宽度计算当前断点
     * @param {number} width - 容器宽度（像素）
     * @returns {string} 断点名称: 'mobile' | 'tablet' | 'desktop' | 'wide'
     */
    function calculateBreakpoint(width) {
        if (width <= BREAKPOINTS.mobile) {
            return 'mobile';
        }
        if (width <= BREAKPOINTS.tablet) {
            return 'tablet';
        }
        if (width <= BREAKPOINTS.desktop) {
            return 'desktop';
        }
        return 'wide';
    }

    /**
     * 获取当前视口宽度
     * @returns {number} 视口宽度（像素）
     */
    function getViewportWidth() {
        if (typeof window === 'undefined') {
            return BREAKPOINTS.desktop;
        }
        return window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth || 0;
    }

    /**
     * 获取当前屏幕方向
     * @returns {string} 'portrait' 或 'landscape'
     */
    function detectOrientation() {
        if (typeof screen === 'undefined') {
            return 'portrait';
        }
        // 优先使用 screen.orientation API
        if (screen.orientation && screen.orientation.type) {
            if (screen.orientation.type.indexOf('portrait') !== -1) {
                return 'portrait';
            }
            if (screen.orientation.type.indexOf('landscape') !== -1) {
                return 'landscape';
            }
        }
        // 回退到宽高比较
        if (typeof window !== 'undefined') {
            return (window.innerHeight > window.innerWidth) ? 'portrait' : 'landscape';
        }
        return 'portrait';
    }

    /**
     * 检测是否为触摸设备
     * @returns {boolean}
     */
    function isTouchDevice() {
        if (typeof window === 'undefined') {
            return false;
        }
        return ('ontouchstart' in window) ||
               (navigator.maxTouchPoints > 0) ||
               (navigator.msMaxTouchPoints > 0);
    }

    /**
     * 防抖函数
     * @param {Function} fn - 要防抖的函数
     * @param {number} delay - 延迟毫秒数
     * @returns {Function} 防抖后的函数
     */
    function debounce(fn, delay) {
        var timerId = null;
        return function () {
            var context = this;
            var args = arguments;
            if (timerId) {
                clearTimeout(timerId);
            }
            timerId = setTimeout(function () {
                fn.apply(context, args);
                timerId = null;
            }, delay);
        };
    }

    /* ============================================================
     * CSS 类名管理
     * ============================================================ */

    /**
     * 更新根元素上的响应式 CSS 类名
     * @param {string} breakpoint - 当前断点
     */
    function updateRootClasses(breakpoint) {
        var root = document.documentElement;
        if (!root) {
            return;
        }

        // 移除所有响应式类名
        root.classList.remove(CLASS_MOBILE, CLASS_TABLET);

        // 根据断点添加对应类名
        if (breakpoint === 'mobile') {
            root.classList.add(CLASS_MOBILE);
        } else if (breakpoint === 'tablet') {
            root.classList.add(CLASS_TABLET);
        }
    }

    /**
     * 移除根元素上的所有响应式 CSS 类名
     */
    function removeRootClasses() {
        var root = document.documentElement;
        if (!root) {
            return;
        }
        root.classList.remove(CLASS_MOBILE, CLASS_TABLET);
    }

    /* ============================================================
     * 样式注入
     * ============================================================ */

    /**
     * 生成响应式 CSS 样式内容
     * @returns {string} CSS 字符串
     */
    function generateStyles() {
        var css = '';

        css += '/* ========================================\n';
        css += ' * Hermes Workspace V2 - 响应式样式\n';
        css += ' * 由 ResponsiveManager 自动注入\n';
        css += ' * ======================================== */\n\n';

        /* --- 移动端样式：单列布局，简化界面 --- */
        css += '/* 移动端：单列布局，简化界面 */\n';
        css += '@media (max-width: 480px) {\n';
        css += '    .rsp-dock-icons .ws-dock__item-label { display: none; }\n';
        css += '    .rsp-dock-icons .ws-dock { padding: 4px 8px; gap: 4px; }\n';
        css += '    .rsp-dock-icons .ws-dock__item { width: 44px; height: 44px; font-size: 20px; }\n';
        css += '    .rsp-hide-mobile { display: none !important; }\n';
        css += '    .rsp-full-mobile { width: 100% !important; max-width: 100% !important; }\n';
        css += '    .ws-card-store { max-width: 100%; }\n';
        css += '    .rsp-mobile-stack { flex-direction: column !important; }\n';
        css += '    .rsp-mobile-compact { padding: 8px !important; margin: 4px !important; }\n';
        css += '    .rsp-mobile-no-shadow { box-shadow: none !important; }\n';
        css += '    .rsp-mobile-text-sm { font-size: 13px !important; }\n';
        css += '    .rsp-mobile-overflow { overflow-x: auto; -webkit-overflow-scrolling: touch; }\n';
        css += '}\n\n';

        /* --- 平板样式：两列布局 --- */
        css += '/* 平板：两列布局 */\n';
        css += '@media (max-width: 768px) {\n';
        css += '    .rsp-dock-icons .ws-dock { padding: 6px 12px; gap: 8px; }\n';
        css += '    .rsp-dock-icons .ws-dock__item { width: 48px; height: 48px; }\n';
        css += '    .rsp-hide-tablet { display: none !important; }\n';
        css += '    .rsp-tablet-compact { padding: 12px !important; }\n';
        css += '    .rsp-tablet-2col { column-count: 2; column-gap: 12px; }\n';
        css += '}\n\n';

        /* --- 触摸设备：始终显示操作按钮 --- */
        css += '/* 触摸设备：始终显示操作按钮 */\n';
        css += '@media (hover: none) and (pointer: coarse) {\n';
        css += '    .ws-card__actions { opacity: 1 !important; }\n';
        css += '    .ws-card__resize { width: 20px !important; height: 20px !important; }\n';
        css += '    .rsp-touch-target { min-width: 44px !important; min-height: 44px !important; }\n';
        css += '}\n\n';

        /* --- 桌面端以下通用样式 --- */
        css += '/* 桌面端以下通用样式 */\n';
        css += '@media (max-width: 1024px) {\n';
        css += '    .rsp-hide-below-desktop { display: none !important; }\n';
        css += '    .rsp-desktop-only { display: none !important; }\n';
        css += '}\n\n';

        /* --- 移动端 Dock 图标模式过渡动画 --- */
        css += '/* Dock 过渡动画 */\n';
        css += '.rsp-dock-icons .ws-dock,\n';
        css += '.rsp-dock-icons .ws-dock__item {\n';
        css += '    transition: all 0.2s ease-in-out;\n';
        css += '}\n\n';

        /* --- 根元素类名驱动的样式 --- */
        css += '/* 根元素类名驱动样式 */\n';
        css += '.' + CLASS_MOBILE + ' .ws-statusbar__time { display: none; }\n';
        css += '.' + CLASS_MOBILE + ' .ws-sidebar { width: 100% !important; max-width: 100% !important; }\n';
        css += '.' + CLASS_MOBILE + ' .ws-workspace { padding: 4px !important; }\n';
        css += '.' + CLASS_MOBILE + ' .ws-card { border-radius: 8px !important; }\n';
        css += '.' + CLASS_TABLET + ' .ws-sidebar { width: 240px !important; }\n';
        css += '.' + CLASS_TABLET + ' .ws-workspace { padding: 8px !important; }\n';

        return css;
    }

    /**
     * 注入响应式样式到文档
     */
    function injectStyles() {
        if (typeof document === 'undefined') {
            return;
        }

        // 如果样式元素已存在，先移除
        var existing = document.getElementById(STYLE_ELEMENT_ID);
        if (existing) {
            existing.parentNode.removeChild(existing);
        }

        // 创建新的样式元素
        styleElement = document.createElement('style');
        styleElement.id = STYLE_ELEMENT_ID;
        styleElement.setAttribute('type', 'text/css');
        styleElement.textContent = generateStyles();

        // 插入到 head 末尾
        var head = document.head || document.getElementsByTagName('head')[0];
        if (head) {
            head.appendChild(styleElement);
        }
    }

    /**
     * 移除注入的样式
     */
    function removeStyles() {
        if (typeof document === 'undefined') {
            return;
        }
        var el = document.getElementById(STYLE_ELEMENT_ID);
        if (el) {
            el.parentNode.removeChild(el);
        }
        styleElement = null;
    }

    /* ============================================================
     * 移动端 UI 简化
     * ============================================================ */

    /**
     * 应用移动端简化模式
     * 隐藏状态栏时间，简化 Dock 为仅图标模式
     */
    function applyMobileSimplifications() {
        // 给 Dock 添加图标模式类
        var dock = document.querySelector('.ws-dock');
        if (dock) {
            dock.classList.add('rsp-dock-icons');
        }

        // 隐藏状态栏时间
        var statusBarTime = document.querySelector('.ws-statusbar__time');
        if (statusBarTime) {
            statusBarTime.classList.add('rsp-hide-mobile');
        }
    }

    /**
     * 移除移动端简化模式
     */
    function removeMobileSimplifications() {
        // 移除 Dock 图标模式类
        var dock = document.querySelector('.ws-dock');
        if (dock) {
            dock.classList.remove('rsp-dock-icons');
        }

        // 恢复状态栏时间显示
        var statusBarTime = document.querySelector('.ws-statusbar__time');
        if (statusBarTime) {
            statusBarTime.classList.remove('rsp-hide-mobile');
        }
    }

    /* ============================================================
     * 布局切换
     * ============================================================ */

    /**
     * 通知 LayoutEngine 切换布局
     * @param {string} breakpoint - 当前断点
     */
    function notifyLayoutEngine(breakpoint) {
        if (typeof LayoutEngine === 'undefined' || !LayoutEngine) {
            return;
        }

        var layout = LAYOUT_MAP[breakpoint];
        if (!layout) {
            return;
        }

        // 检查 LayoutEngine 是否有 setLayout 方法
        if (typeof LayoutEngine.setLayout === 'function') {
            try {
                LayoutEngine.setLayout(layout);
            } catch (e) {
                // 静默处理布局切换错误
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[ResponsiveManager] 布局切换失败:', e.message);
                }
            }
        }
    }

    /**
     * 同步状态到 StateManager
     * @param {string} breakpoint - 当前断点
     * @param {number} width - 当前宽度
     */
    function syncState(breakpoint, width) {
        if (typeof StateManager === 'undefined' || !StateManager) {
            return;
        }

        if (typeof StateManager.set === 'function') {
            try {
                StateManager.set('responsive.breakpoint', breakpoint);
                StateManager.set('responsive.width', width);
                StateManager.set('responsive.orientation', currentOrientation);
                StateManager.set('responsive.isMobile', breakpoint === 'mobile');
                StateManager.set('responsive.isTablet', breakpoint === 'tablet');
                StateManager.set('responsive.isTouch', isTouchDevice());
            } catch (e) {
                if (typeof console !== 'undefined' && console.warn) {
                    console.warn('[ResponsiveManager] 状态同步失败:', e.message);
                }
            }
        }
    }

    /* ============================================================
     * 事件发射
     * ============================================================ */

    /**
     * 发射断点变更事件
     * @param {string} from - 之前的断点
     * @param {string} to - 新的断点
     * @param {number} width - 当前宽度
     */
    function emitChange(from, to, width) {
        if (typeof Bus === 'undefined' || !Bus) {
            return;
        }

        var payload = {
            from: from,
            to: to,
            breakpoint: to,
            width: width,
            orientation: currentOrientation,
            timestamp: Date.now()
        };

        if (typeof Bus.emit === 'function') {
            Bus.emit(EVENT_CHANGE, payload);
        }

        // 进入移动端时发射专用事件
        if (to === 'mobile' && from !== 'mobile') {
            if (typeof Bus.emit === 'function') {
                Bus.emit(EVENT_MOBILE, payload);
            }
        }

        // 进入桌面端时发射专用事件
        if ((to === 'desktop' || to === 'wide') && from !== 'desktop' && from !== 'wide') {
            if (typeof Bus.emit === 'function') {
                Bus.emit(EVENT_DESKTOP, payload);
            }
        }
    }

    /**
     * 发射方向变更事件
     * @param {string} newOrientation - 新方向
     */
    function emitOrientationChange(newOrientation) {
        if (typeof Bus === 'undefined' || !Bus) {
            return;
        }

        var payload = {
            from: currentOrientation,
            to: newOrientation,
            breakpoint: currentBreakpoint,
            width: currentWidth,
            timestamp: Date.now()
        };

        if (typeof Bus.emit === 'function') {
            Bus.emit(EVENT_ORIENTATION, payload);
        }
    }

    /* ============================================================
     * 核心处理逻辑
     * ============================================================ */

    /**
     * 处理视口尺寸变化
     * 检测断点变更并执行相应操作
     */
    function handleResize() {
        if (destroyed) {
            return;
        }

        var width = getViewportWidth();
        var newBreakpoint = calculateBreakpoint(width);
        var previousBreakpoint = currentBreakpoint;

        // 更新当前状态
        currentWidth = width;

        // 如果断点没有变化，只更新宽度
        if (newBreakpoint === previousBreakpoint) {
            return;
        }

        // 断点发生变化，执行切换逻辑
        currentBreakpoint = newBreakpoint;

        // 更新根元素 CSS 类名
        updateRootClasses(newBreakpoint);

        // 发射变更事件
        emitChange(previousBreakpoint, newBreakpoint, width);

        // 移动端简化处理
        if (newBreakpoint === 'mobile') {
            applyMobileSimplifications();
        } else {
            removeMobileSimplifications();
        }

        // 通知 LayoutEngine 切换布局
        notifyLayoutEngine(newBreakpoint);

        // 同步状态
        syncState(newBreakpoint, width);

        // 开发环境日志
        if (typeof console !== 'undefined' && console.log) {
            console.log(
                '[ResponsiveManager] 断点变更: ' + previousBreakpoint + ' -> ' + newBreakpoint +
                ' (' + width + 'px)'
            );
        }
    }

    /**
     * 处理屏幕方向变化
     */
    function handleOrientationChange() {
        if (destroyed) {
            return;
        }

        var newOrientation = detectOrientation();

        if (newOrientation === currentOrientation) {
            return;
        }

        var previousOrientation = currentOrientation;
        currentOrientation = newOrientation;

        // 发射方向变更事件
        emitOrientationChange(newOrientation);

        // 方向变化后重新检测断点（宽度可能因虚拟键盘等原因变化）
        setTimeout(function () {
            handleResize();
        }, 100);

        // 开发环境日志
        if (typeof console !== 'undefined' && console.log) {
            console.log(
                '[ResponsiveManager] 方向变更: ' + previousOrientation + ' -> ' + newOrientation
            );
        }
    }

    /**
     * 处理页面可见性变化
     * 页面从隐藏恢复时重新检测断点
     */
    function handleVisibilityChange() {
        if (destroyed) {
            return;
        }

        if (typeof document === 'undefined' || document.hidden) {
            return;
        }

        // 页面恢复可见时，延迟检测（等待布局稳定）
        setTimeout(function () {
            handleResize();
        }, 100);
    }

    /* ============================================================
     * 事件绑定与解绑
     * ============================================================ */

    /**
     * 绑定所有事件监听
     */
    function bindEvents() {
        if (typeof window === 'undefined') {
            return;
        }

        // 创建绑定的处理函数引用
        boundHandleResize = debounce(handleResize, DEBOUNCE_DELAY);
        boundHandleOrientation = debounce(handleOrientationChange, 150);
        boundHandleVisibility = handleVisibilityChange;

        // 监听窗口大小变化
        window.addEventListener('resize', boundHandleResize, false);

        // 监听屏幕方向变化（多种方式兼容）
        window.addEventListener('orientationchange', boundHandleOrientation, false);

        // 使用 screen.orientation API（如果可用）
        if (screen && screen.orientation) {
            try {
                screen.orientation.addEventListener('change', boundHandleOrientation, false);
            } catch (e) {
                // screen.orientation.addEventListener 可能不被所有浏览器支持
            }
        }

        // 监听页面可见性变化
        if (typeof document !== 'undefined' && document.addEventListener) {
            document.addEventListener('visibilitychange', boundHandleVisibility, false);
        }
    }

    /**
     * 解绑所有事件监听
     */
    function unbindEvents() {
        if (typeof window === 'undefined') {
            return;
        }

        // 移除窗口大小变化监听
        if (boundHandleResize) {
            window.removeEventListener('resize', boundHandleResize, false);
            boundHandleResize = null;
        }

        // 移除方向变化监听
        if (boundHandleOrientation) {
            window.removeEventListener('orientationchange', boundHandleOrientation, false);
            if (screen && screen.orientation) {
                try {
                    screen.orientation.removeEventListener('change', boundHandleOrientation, false);
                } catch (e) {
                    // 忽略移除失败
                }
            }
            boundHandleOrientation = null;
        }

        // 移除可见性变化监听
        if (boundHandleVisibility) {
            if (typeof document !== 'undefined' && document.removeEventListener) {
                document.removeEventListener('visibilitychange', boundHandleVisibility, false);
            }
            boundHandleVisibility = null;
        }

        // 清除所有定时器
        if (resizeTimer) {
            clearTimeout(resizeTimer);
            resizeTimer = null;
        }
        if (orientationTimer) {
            clearTimeout(orientationTimer);
            orientationTimer = null;
        }
    }

    /* ============================================================
     * 公共 API
     * ============================================================ */

    /**
     * 初始化响应式管理器
     * 开始监听窗口大小变化，注入样式，执行初始检测
     */
    function init() {
        if (initialized) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[ResponsiveManager] 已经初始化，请勿重复调用');
            }
            return;
        }

        if (destroyed) {
            if (typeof console !== 'undefined' && console.warn) {
                console.warn('[ResponsiveManager] 已被销毁，无法重新初始化');
            }
            return;
        }

        // 检测初始方向
        currentOrientation = detectOrientation();

        // 注入响应式样式
        injectStyles();

        // 绑定事件监听
        bindEvents();

        // 执行初始断点检测
        currentWidth = getViewportWidth();
        currentBreakpoint = calculateBreakpoint(currentWidth);

        // 更新根元素类名
        updateRootClasses(currentBreakpoint);

        // 如果初始就是移动端，应用简化
        if (currentBreakpoint === 'mobile') {
            applyMobileSimplifications();
        }

        // 通知 LayoutEngine
        notifyLayoutEngine(currentBreakpoint);

        // 同步初始状态
        syncState(currentBreakpoint, currentWidth);

        initialized = true;

        // 开发环境日志
        if (typeof console !== 'undefined' && console.log) {
            console.log(
                '[ResponsiveManager] 初始化完成 - 断点: ' + currentBreakpoint +
                ', 宽度: ' + currentWidth + 'px, 方向: ' + currentOrientation +
                ', 触摸设备: ' + isTouchDevice()
            );
        }
    }

    /**
     * 销毁响应式管理器
     * 移除所有事件监听，清理样式和状态
     */
    function destroy() {
        if (destroyed) {
            return;
        }

        // 解绑事件
        unbindEvents();

        // 移除根元素类名
        removeRootClasses();

        // 移除移动端简化
        removeMobileSimplifications();

        // 移除注入的样式
        removeStyles();

        // 重置内部状态
        currentBreakpoint = null;
        currentWidth = 0;
        currentOrientation = 'portrait';
        initialized = false;
        destroyed = true;

        // 开发环境日志
        if (typeof console !== 'undefined' && console.log) {
            console.log('[ResponsiveManager] 已销毁');
        }
    }

    /**
     * 获取当前断点名称
     * @returns {string} 'mobile' | 'tablet' | 'desktop' | 'wide'
     */
    function getBreakpoint() {
        return currentBreakpoint;
    }

    /**
     * 判断当前是否为移动端
     * @returns {boolean}
     */
    function isMobile() {
        return currentBreakpoint === 'mobile';
    }

    /**
     * 判断当前是否为平板
     * @returns {boolean}
     */
    function isTablet() {
        return currentBreakpoint === 'tablet';
    }

    /**
     * 获取当前容器宽度
     * @returns {number} 宽度（像素）
     */
    function getContainerWidth() {
        return currentWidth;
    }

    /**
     * 获取推荐的布局模式
     * mobile -> 'list'
     * tablet -> 'grid-2col'
     * desktop -> 'grid'
     * wide -> 'grid'
     * @returns {string} 布局模式名称
     */
    function getRecommendedLayout() {
        if (!currentBreakpoint) {
            return 'grid';
        }
        return LAYOUT_MAP[currentBreakpoint] || 'grid';
    }

    /**
     * 强制重新检测断点
     * 在 DOM 结构变化后可手动调用
     */
    function forceCheck() {
        handleResize();
    }

    /**
     * 获取所有断点配置
     * @returns {Object} 断点配置对象
     */
    function getBreakpoints() {
        // 返回副本，防止外部修改
        return {
            mobile: BREAKPOINTS.mobile,
            tablet: BREAKPOINTS.tablet,
            desktop: BREAKPOINTS.desktop,
            wide: BREAKPOINTS.wide
        };
    }

    /**
     * 获取当前方向
     * @returns {string} 'portrait' | 'landscape'
     */
    function getOrientation() {
        return currentOrientation;
    }

    /**
     * 判断是否为触摸设备
     * @returns {boolean}
     */
    function checkTouch() {
        return isTouchDevice();
    }

    /* ============================================================
     * 导出公共接口
     * ============================================================ */

    return {
        init: init,
        destroy: destroy,
        getBreakpoint: getBreakpoint,
        isMobile: isMobile,
        isTablet: isTablet,
        getContainerWidth: getContainerWidth,
        getRecommendedLayout: getRecommendedLayout,
        forceCheck: forceCheck,
        getBreakpoints: getBreakpoints,
        getOrientation: getOrientation,
        checkTouch: checkTouch
    };

})();
