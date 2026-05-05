/**
 * SpotlightSearch.js - 全局搜索弹窗
 * Cmd+K 触发，搜索知识/会话/记忆/规则
 * 使用 IIFE 包裹，暴露全局变量
 */
var SpotlightSearch = (() => {
    'use strict';

    // ========== 状态 ==========
    var _isOpen = false;
    var _overlay = null;
    var _input = null;
    var _resultsContainer = null;
    var _searchTimer = null;
    var _onKeyDown = null;
    var _stylesInjected = false;
    var _currentQuery = '';
    var _isLoading = false;
    var _activeIndex = -1; // 当前高亮的结果索引

    // 搜索分类配置
    var CATEGORIES = {
        knowledge:  { label: '知识库',   icon: '📚', cardId: 'knowledge' },
        sessions:   { label: '会话记录', icon: '💬', cardId: 'sessions' },
        memory:     { label: '记忆',     icon: '🧠', cardId: 'memory' },
        rules:      { label: '规则',     icon: '📋', cardId: 'rules' },
        agents:     { label: 'AI 助手',  icon: '🤖', cardId: 'agents' },
        config:     { label: '配置项',   icon: '⚙️', cardId: 'config' }
    };

    // ========== 样式注入 ==========
    function _injectStyles() {
        if (_stylesInjected) return;
        _stylesInjected = true;

        var css = `
            /* 搜索遮罩层 */
            .spotlight-overlay {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 9500;
                display: flex;
                align-items: flex-start;
                justify-content: center;
                padding-top: 15vh;
                background: rgba(0, 0, 0, 0.3);
                backdrop-filter: blur(4px);
                -webkit-backdrop-filter: blur(4px);
                opacity: 0;
                visibility: hidden;
                transition: opacity 200ms ease, visibility 200ms ease;
            }

            .spotlight-overlay.active {
                opacity: 1;
                visibility: visible;
            }

            /* 搜索框容器 */
            .spotlight-box {
                width: 90%;
                max-width: 600px;
                border-radius: 16px;
                background: rgba(255, 255, 255, 0.9);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25),
                            0 8px 32px rgba(0, 0, 0, 0.1);
                overflow: hidden;
                transform: scale(0.95) translateY(-10px);
                opacity: 0;
                transition: transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
                            opacity 200ms ease;
                display: flex;
                flex-direction: column;
                max-height: 60vh;
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            }

            .spotlight-overlay.active .spotlight-box {
                transform: scale(1) translateY(0);
                opacity: 1;
            }

            /* 搜索输入区域 */
            .spotlight-input-wrap {
                display: flex;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(0, 0, 0, 0.06);
                gap: 12px;
                flex-shrink: 0;
            }

            .spotlight-input-icon {
                font-size: 20px;
                flex-shrink: 0;
                opacity: 0.5;
            }

            .spotlight-input {
                flex: 1;
                border: none;
                outline: none;
                background: transparent;
                font-size: 18px;
                color: #1a1a1a;
                font-weight: 400;
                line-height: 1.4;
            }

            .spotlight-input::placeholder {
                color: #bbb;
            }

            .spotlight-input-hint {
                font-size: 11px;
                color: #999;
                background: rgba(0, 0, 0, 0.05);
                padding: 2px 6px;
                border-radius: 4px;
                flex-shrink: 0;
                font-weight: 500;
            }

            /* 加载指示器 */
            .spotlight-loading {
                display: none;
                align-items: center;
                justify-content: center;
                padding: 24px;
                color: #999;
                font-size: 14px;
                gap: 8px;
            }

            .spotlight-loading.visible {
                display: flex;
            }

            .spotlight-spinner {
                width: 16px;
                height: 16px;
                border: 2px solid rgba(0, 0, 0, 0.1);
                border-top-color: #007aff;
                border-radius: 50%;
                animation: spotlight-spin 0.6s linear infinite;
            }

            @keyframes spotlight-spin {
                to { transform: rotate(360deg); }
            }

            /* 搜索结果区域 */
            .spotlight-results {
                flex: 1;
                overflow-y: auto;
                overflow-x: hidden;
                padding: 8px 0;
                -webkit-overflow-scrolling: touch;
            }

            .spotlight-results::-webkit-scrollbar {
                width: 4px;
            }

            .spotlight-results::-webkit-scrollbar-thumb {
                background: rgba(0, 0, 0, 0.12);
                border-radius: 2px;
            }

            /* 分类标题 */
            .spotlight-category {
                padding: 8px 20px 4px;
                font-size: 11px;
                font-weight: 600;
                color: #999;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            /* 结果项 */
            .spotlight-result {
                display: flex;
                align-items: center;
                padding: 10px 20px;
                gap: 12px;
                cursor: pointer;
                transition: background 0.15s;
            }

            .spotlight-result:hover,
            .spotlight-result.active {
                background: rgba(0, 122, 255, 0.08);
            }

            .spotlight-result-icon {
                width: 36px;
                height: 36px;
                border-radius: 8px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 18px;
                flex-shrink: 0;
                background: rgba(0, 0, 0, 0.04);
            }

            .spotlight-result-content {
                flex: 1;
                min-width: 0;
            }

            .spotlight-result-title {
                font-size: 14px;
                font-weight: 500;
                color: #1a1a1a;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .spotlight-result-desc {
                font-size: 12px;
                color: #999;
                margin-top: 2px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

            .spotlight-result-arrow {
                color: #ccc;
                font-size: 12px;
                flex-shrink: 0;
                opacity: 0;
                transition: opacity 0.15s;
            }

            .spotlight-result:hover .spotlight-result-arrow,
            .spotlight-result.active .spotlight-result-arrow {
                opacity: 1;
            }

            /* 空状态 */
            .spotlight-empty {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 32px 20px;
                color: #bbb;
                font-size: 14px;
                gap: 8px;
            }

            .spotlight-empty-icon {
                font-size: 32px;
                opacity: 0.5;
            }

            /* 底部快捷键提示 */
            .spotlight-footer {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 8px 20px;
                border-top: 1px solid rgba(0, 0, 0, 0.04);
                font-size: 11px;
                color: #bbb;
                flex-shrink: 0;
            }

            .spotlight-footer kbd {
                display: inline-block;
                padding: 1px 5px;
                border-radius: 3px;
                background: rgba(0, 0, 0, 0.06);
                font-family: inherit;
                font-size: 10px;
                margin: 0 2px;
            }

            /* 深色模式 */
            @media (prefers-color-scheme: dark) {
                .spotlight-box {
                    background: rgba(30, 30, 30, 0.92);
                    box-shadow: 0 24px 80px rgba(0, 0, 0, 0.5),
                                0 8px 32px rgba(0, 0, 0, 0.3);
                }

                .spotlight-input-wrap {
                    border-bottom-color: rgba(255, 255, 255, 0.06);
                }

                .spotlight-input {
                    color: #f0f0f0;
                }

                .spotlight-input::placeholder {
                    color: #666;
                }

                .spotlight-input-hint {
                    color: #777;
                    background: rgba(255, 255, 255, 0.08);
                }

                .spotlight-result:hover,
                .spotlight-result.active {
                    background: rgba(0, 122, 255, 0.15);
                }

                .spotlight-result-title {
                    color: #f0f0f0;
                }

                .spotlight-result-desc {
                    color: #888;
                }

                .spotlight-result-icon {
                    background: rgba(255, 255, 255, 0.06);
                }

                .spotlight-category {
                    color: #777;
                }

                .spotlight-empty {
                    color: #666;
                }

                .spotlight-footer {
                    color: #666;
                    border-top-color: rgba(255, 255, 255, 0.04);
                }

                .spotlight-footer kbd {
                    background: rgba(255, 255, 255, 0.08);
                }

                .spotlight-spinner {
                    border-color: rgba(255, 255, 255, 0.1);
                    border-top-color: #0a84ff;
                }
            }
        `;

        var style = document.createElement('style');
        style.id = 'spotlightSearchStyles';
        style.textContent = css;
        document.head.appendChild(style);
    }

    // ========== 创建 DOM ==========
    function _createDOM() {
        if (_overlay) return;

        _overlay = document.createElement('div');
        _overlay.className = 'spotlight-overlay';
        _overlay.innerHTML = `
            <div class="spotlight-box">
                <div class="spotlight-input-wrap">
                    <span class="spotlight-input-icon">🔍</span>
                    <input class="spotlight-input" type="text"
                           placeholder="搜索知识、会话、记忆、规则..."
                           autocomplete="off" spellcheck="false" />
                    <span class="spotlight-input-hint">ESC 关闭</span>
                </div>
                <div class="spotlight-loading">
                    <span class="spotlight-spinner"></span>
                    <span>搜索中...</span>
                </div>
                <div class="spotlight-results"></div>
                <div class="spotlight-footer">
                    <span><kbd>↑</kbd><kbd>↓</kbd> 导航  <kbd>Enter</kbd> 打开</span>
                    <span><kbd>ESC</kbd> 关闭</span>
                </div>
            </div>
        `;

        document.body.appendChild(_overlay);

        // 缓存 DOM 引用
        _input = _overlay.querySelector('.spotlight-input');
        _resultsContainer = _overlay.querySelector('.spotlight-results');
    }

    // ========== 打开搜索弹窗 ==========
    function open() {
        if (_isOpen) return;

        _injectStyles();
        _createDOM();

        _isOpen = true;
        _currentQuery = '';
        _activeIndex = -1;

        // 清空输入和结果
        if (_input) {
            _input.value = '';
        }
        if (_resultsContainer) {
            _resultsContainer.innerHTML = _getEmptyState();
        }

        // 绑定事件
        _bindEvents();

        // 显示遮罩 + 聚焦输入框
        requestAnimationFrame(() => {
            _overlay.classList.add('active');
            if (_input) {
                _input.focus();
            }
        });

        // 锁定 body 滚动
        document.body.style.overflow = 'hidden';
    }

    // ========== 关闭搜索弹窗 ==========
    function close() {
        if (!_isOpen || !_overlay) return;

        // 清除搜索定时器
        if (_searchTimer) {
            clearTimeout(_searchTimer);
            _searchTimer = null;
        }

        // 触发关闭动画
        _overlay.classList.remove('active');

        // 等待动画完成后清理
        setTimeout(() => {
            _cleanup();
        }, 200);
    }

    // ========== 切换搜索弹窗 ==========
    function toggle() {
        if (_isOpen) {
            close();
        } else {
            open();
        }
    }

    // ========== 执行搜索 ==========
    function _search(query) {
        if (!query || !query.trim()) {
            if (_resultsContainer) {
                _resultsContainer.innerHTML = _getEmptyState();
            }
            return;
        }

        _currentQuery = query.trim();
        _isLoading = true;
        _activeIndex = -1;

        // 显示加载状态
        _setLoading(true);

        // 尝试调用 API 搜索
        if (typeof HermesClient !== 'undefined' && HermesClient.search) {
            HermesClient.search(_currentQuery)
                .then(results => {
                    _isLoading = false;
                    _setLoading(false);
                    _renderResults(results || []);
                })
                .catch(err => {
                    console.warn('[SpotlightSearch] 搜索出错:', err);
                    _isLoading = false;
                    _setLoading(false);
                    _renderResults(_getFallbackResults(_currentQuery));
                });
        } else {
            // 无 API 时使用模拟数据
            setTimeout(() => {
                _isLoading = false;
                _setLoading(false);
                _renderResults(_getFallbackResults(_currentQuery));
            }, 300);
        }
    }

    // ========== 设置加载状态 ==========
    function _setLoading(loading) {
        if (!_overlay) return;
        var loadingEl = _overlay.querySelector('.spotlight-loading');
        if (loadingEl) {
            if (loading) {
                loadingEl.classList.add('visible');
            } else {
                loadingEl.classList.remove('visible');
            }
        }
    }

    // ========== 渲染搜索结果 ==========
    function _renderResults(results) {
        if (!_resultsContainer) return;

        if (!results || results.length === 0) {
            _resultsContainer.innerHTML = `
                <div class="spotlight-empty">
                    <span class="spotlight-empty-icon">🔍</span>
                    <span>未找到 "${_escapeHTML(_currentQuery)}" 的相关结果</span>
                </div>
            `;
            return;
        }

        // 按分类分组
        var grouped = {};
        for (var i = 0; i < results.length; i++) {
            var item = results[i];
            var cat = item.category || 'other';
            if (!grouped[cat]) {
                grouped[cat] = [];
            }
            grouped[cat].push(item);
        }

        // 构建 HTML
        var html = '';
        var resultIndex = 0;

        var catKeys = Object.keys(grouped);
        for (var c = 0; c < catKeys.length; c++) {
            var catKey = catKeys[c];
            var catInfo = CATEGORIES[catKey] || { label: catKey, icon: '📁' };
            var items = grouped[catKey];

            html += `<div class="spotlight-category">${catInfo.icon} ${catInfo.label}</div>`;

            for (var j = 0; j < items.length; j++) {
                var item = items[j];
                var desc = item.description || item.summary || item.content || '';
                if (desc.length > 80) {
                    desc = desc.substring(0, 80) + '...';
                }

                html += `
                    <div class="spotlight-result" data-index="${resultIndex}"
                         data-card-id="${item.cardId || catInfo.cardId || ''}"
                         data-item-id="${item.id || ''}">
                        <div class="spotlight-result-icon">${catInfo.icon}</div>
                        <div class="spotlight-result-content">
                            <div class="spotlight-result-title">${_escapeHTML(item.title || item.name || '未命名')}</div>
                            <div class="spotlight-result-desc">${_escapeHTML(desc)}</div>
                        </div>
                        <span class="spotlight-result-arrow">→</span>
                    </div>
                `;
                resultIndex++;
            }
        }

        _resultsContainer.innerHTML = html;

        // 绑定结果点击事件
        _bindResultEvents();
    }

    // ========== 绑定结果点击事件 ==========
    function _bindResultEvents() {
        if (!_resultsContainer) return;

        var results = _resultsContainer.querySelectorAll('.spotlight-result');
        for (var i = 0; i < results.length; i++) {
            (function(el) {
                el.addEventListener('click', function() {
                    _openResult(el);
                });
                el.addEventListener('mouseenter', function() {
                    _setActiveIndex(parseInt(el.getAttribute('data-index'), 10));
                });
            })(results[i]);
        }
    }

    // ========== 打开搜索结果 ==========
    function _openResult(el) {
        var cardId = el.getAttribute('data-card-id');
        var itemId = el.getAttribute('data-item-id');

        if (!cardId) return;

        // 关闭搜索弹窗
        close();

        // 打开对应的 CardOverlay
        setTimeout(() => {
            if (typeof CardOverlay !== 'undefined') {
                CardOverlay.open(cardId, { id: itemId, fromSearch: true, query: _currentQuery });
            }
        }, 250);
    }

    // ========== 设置高亮索引 ==========
    function _setActiveIndex(index) {
        _activeIndex = index;

        if (!_resultsContainer) return;

        var results = _resultsContainer.querySelectorAll('.spotlight-result');
        for (var i = 0; i < results.length; i++) {
            if (parseInt(results[i].getAttribute('data-index'), 10) === index) {
                results[i].classList.add('active');
                // 滚动到可见区域
                results[i].scrollIntoView({ block: 'nearest' });
            } else {
                results[i].classList.remove('active');
            }
        }
    }

    // ========== 获取结果总数 ==========
    function _getResultCount() {
        if (!_resultsContainer) return 0;
        return _resultsContainer.querySelectorAll('.spotlight-result').length;
    }

    // ========== 空状态 HTML ==========
    function _getEmptyState() {
        return `
            <div class="spotlight-empty">
                <span class="spotlight-empty-icon">💡</span>
                <span>输入关键词开始搜索</span>
            </div>
        `;
    }

    // ========== 模拟搜索结果（无 API 时使用） ==========
    function _getFallbackResults(query) {
        var q = query.toLowerCase();
        var results = [];

        // 模拟知识库结果
        results.push({
            category: 'knowledge',
            id: 'kb-001',
            title: `关于 "${query}" 的知识条目`,
            description: '这是一条模拟的知识库搜索结果，实际使用时请接入后端搜索 API。',
            cardId: 'knowledge'
        });

        // 模拟会话结果
        results.push({
            category: 'sessions',
            id: 'sess-001',
            title: `包含 "${query}" 的历史会话`,
            description: '这是一条模拟的会话搜索结果，实际使用时请接入后端搜索 API。',
            cardId: 'sessions'
        });

        // 模拟记忆结果
        results.push({
            category: 'memory',
            id: 'mem-001',
            title: `与 "${query}" 相关的记忆`,
            description: '这是一条模拟的记忆搜索结果，实际使用时请接入后端搜索 API。',
            cardId: 'memory'
        });

        // 模拟规则结果
        results.push({
            category: 'rules',
            id: 'rule-001',
            title: `匹配 "${query}" 的规则`,
            description: '这是一条模拟的规则搜索结果，实际使用时请接入后端搜索 API。',
            cardId: 'rules'
        });

        return results;
    }

    // ========== HTML 转义 ==========
    function _escapeHTML(str) {
        if (!str) return '';
        var div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ========== 绑定事件 ==========
    function _bindEvents() {
        // 输入框输入事件（防抖搜索）
        if (_input) {
            _input.addEventListener('input', function() {
                var value = _input.value;
                if (_searchTimer) {
                    clearTimeout(_searchTimer);
                }
                _searchTimer = setTimeout(() => {
                    _search(value);
                }, 250);
            });
        }

        // 全局键盘事件
        _onKeyDown = function(e) {
            // Esc 关闭
            if (e.key === 'Escape') {
                e.preventDefault();
                close();
                return;
            }

            // 上下键导航
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                var count = _getResultCount();
                if (count > 0) {
                    _setActiveIndex(_activeIndex < count - 1 ? _activeIndex + 1 : 0);
                }
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                var count2 = _getResultCount();
                if (count2 > 0) {
                    _setActiveIndex(_activeIndex > 0 ? _activeIndex - 1 : count2 - 1);
                }
                return;
            }

            // Enter 打开选中结果
            if (e.key === 'Enter') {
                e.preventDefault();
                if (_activeIndex >= 0 && _resultsContainer) {
                    var activeEl = _resultsContainer.querySelector(`.spotlight-result[data-index="${_activeIndex}"]`);
                    if (activeEl) {
                        _openResult(activeEl);
                    }
                }
                return;
            }
        };
        document.addEventListener('keydown', _onKeyDown);

        // 点击遮罩关闭
        if (_overlay) {
            _overlay.addEventListener('click', function(e) {
                // 只在点击遮罩本身（非内容区）时关闭
                if (e.target === _overlay) {
                    close();
                }
            });
        }
    }

    // ========== 清理资源 ==========
    function _cleanup() {
        // 移除键盘事件
        if (_onKeyDown) {
            document.removeEventListener('keydown', _onKeyDown);
            _onKeyDown = null;
        }

        // 清除搜索定时器
        if (_searchTimer) {
            clearTimeout(_searchTimer);
            _searchTimer = null;
        }

        // 重置状态
        _isOpen = false;
        _currentQuery = '';
        _isLoading = false;
        _activeIndex = -1;

        // 移除 DOM
        if (_overlay && _overlay.parentNode) {
            _overlay.parentNode.removeChild(_overlay);
        }
        _overlay = null;
        _input = null;
        _resultsContainer = null;

        // 恢复 body 滚动
        document.body.style.overflow = '';
    }

    // ========== 公开 API ==========
    return {
        open: open,
        close: close,
        toggle: toggle
    };
})();

// 全局 Cmd+K 快捷键（独立注册，确保始终可用）
(function() {
    document.addEventListener('keydown', function(e) {
        // Cmd+K (Mac) 或 Ctrl+K (Windows/Linux)
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
            e.preventDefault();
            if (typeof SpotlightSearch !== 'undefined') {
                SpotlightSearch.toggle();
            }
        }
    });
})();

window.SpotlightSearch = SpotlightSearch;
