/**
 * LayoutEngine — 布局计算引擎
 *
 * 职责:
 * 1. 四种布局算法：grid / list / masonry / canvas
 * 2. 计算每张卡片的位置和尺寸
 * 3. 处理 pinned 卡片（用户手动拖拽过的保持位置）
 * 4. 响应式：根据容器宽度自动调整列数
 *
 * 依赖: Logger (全局)
 */
const LayoutEngine = (() => {
    'use strict';

    // ── Constants ─────────────────────────────────────────
    const GRID_CELL_W = 280;
    const GRID_CELL_H = 240;
    const GRID_GAP = 16;
    const LIST_MAX_W = 720;
    const MASONRY_MIN_COL_W = 240;
    const MIN_COLS = 1;
    const MAX_COLS = 6;

    // 尺寸映射（grid units → px）
    const SIZE_MAP = {
        sm: { w: 1, h: 1 },
        md: { w: 2, h: 1 },
        lg: { w: 2, h: 2 }
    };

    // ── Helpers ───────────────────────────────────────────

    /**
     * 根据容器宽度计算列数
     */
    function _calcCols(containerWidth, mode) {
        if (mode === 'list') return 1;
        if (mode === 'canvas') return 1;

        const gap = GRID_GAP;
        let cellW;
        if (mode === 'masonry') {
            cellW = MASONRY_MIN_COL_W;
        } else {
            cellW = GRID_CELL_W;
        }

        let cols = Math.floor((containerWidth + gap) / (cellW + gap));
        return Math.max(MIN_COLS, Math.min(MAX_COLS, cols));
    }

    /**
     * 获取卡片占用的 grid 单位
     */
    function _getCardSpan(card) {
        if (!card || !card.layout) return { w: 1, h: 1 };
        return {
            w: card.layout.w || 1,
            h: card.layout.h || 1
        };
    }

    /**
     * 计算实际像素尺寸
     */
    function _calcPixelSize(span, containerWidth, cols, gap) {
        const cellW = (containerWidth - (cols - 1) * gap) / cols;
        const cellH = GRID_CELL_H;

        return {
            w: Math.round(cellW * span.w + (span.w - 1) * gap),
            h: Math.round(cellH * span.h + (span.h - 1) * gap)
        };
    }

    // ── Grid Layout ───────────────────────────────────────

    /**
     * 网格布局算法
     * 使用 CSS Grid 自动排列，这里计算每个卡片的 grid-area
     */
    function _layoutGrid(cards, containerWidth, options = {}) {
        const gap = options.gap || GRID_GAP;
        const cols = options.cols || _calcCols(containerWidth, 'grid');

        const positions = [];
        let colCursor = 0;
        let rowCursor = 0;

        for (const card of cards) {
            const span = _getCardSpan(card);
            const isPinned = card.layout && card.layout.pinned;

            if (isPinned) {
                // pinned 卡片保持用户指定的位置
                positions.push({
                    cardId: card.id,
                    x: card.layout.x,
                    y: card.layout.y,
                    w: card.layout.w || span.w,
                    h: card.layout.h || span.h,
                    pinned: true,
                    mode: 'absolute'
                });
                continue;
            }

            // 自动排列：找到下一个可放位置
            if (colCursor + span.w > cols) {
                colCursor = 0;
                rowCursor += 1;
            }

            positions.push({
                cardId: card.id,
                col: colCursor + 1,
                row: rowCursor + 1,
                colSpan: span.w,
                rowSpan: span.h,
                pinned: false,
                mode: 'grid'
            });

            colCursor += span.w;
        }

        return { positions, cols, gap, mode: 'grid' };
    }

    // ── List Layout ───────────────────────────────────────

    /**
     * 列表布局算法
     * 单列排列，宽度撑满（最大 LIST_MAX_W）
     */
    function _layoutList(cards, containerWidth, options = {}) {
        const gap = options.gap || GRID_GAP;
        const width = Math.min(containerWidth, LIST_MAX_W);

        const positions = cards.map((card, index) => {
            const span = _getCardSpan(card);
            const isPinned = card.layout && card.layout.pinned;

            return {
                cardId: card.id,
                index,
                width,
                height: span.h === 2 ? GRID_CELL_H * 2 + gap : GRID_CELL_H,
                pinned: isPinned,
                mode: 'list'
            };
        });

        return { positions, gap, mode: 'list' };
    }

    // ── Masonry Layout ────────────────────────────────────

    /**
     * 瀑布流布局算法
     * 最短列优先分配
     */
    function _layoutMasonry(cards, containerWidth, options = {}) {
        const gap = options.gap || GRID_GAP;
        const cols = options.cols || _calcCols(containerWidth, 'masonry');
        const colWidth = (containerWidth - (cols - 1) * gap) / cols;

        // 每列当前高度
        const colHeights = new Array(cols).fill(0);
        // 每列的卡片列表
        const colCards = Array.from({ length: cols }, () => []);

        // 先放 pinned 卡片
        const unpinned = [];
        for (const card of cards) {
            if (card.layout && card.layout.pinned) {
                const col = card.layout.x || 0;
                const safeCol = Math.min(Math.max(col, 0), cols - 1);
                colCards[safeCol].push(card);
                const span = _getCardSpan(card);
                const estHeight = GRID_CELL_H * span.h + (span.h - 1) * gap;
                colHeights[safeCol] += estHeight + gap;
            } else {
                unpinned.push(card);
            }
        }

        // 分配 unpinned 卡片到最短列
        for (const card of unpinned) {
            const span = _getCardSpan(card);
            // 找最短列
            let minCol = 0;
            let minH = colHeights[0];
            for (let i = 1; i < cols; i++) {
                if (colHeights[i] < minH) {
                    minH = colHeights[i];
                    minCol = i;
                }
            }

            colCards[minCol].push(card);
            const estHeight = GRID_CELL_H * span.h + (span.h - 1) * gap;
            colHeights[minCol] += estHeight + gap;
        }

        // 生成位置
        const positions = [];
        for (let col = 0; col < cols; col++) {
            let yOffset = 0;
            for (const card of colCards[col]) {
                const span = _getCardSpan(card);
                const height = GRID_CELL_H * span.h + (span.h - 1) * gap;

                positions.push({
                    cardId: card.id,
                    col,
                    x: col * (colWidth + gap),
                    y: yOffset,
                    width: colWidth,
                    height,
                    pinned: card.layout && card.layout.pinned,
                    mode: 'masonry'
                });

                yOffset += height + gap;
            }
        }

        return { positions, cols, colWidth, gap, mode: 'masonry' };
    }

    // ── Canvas Layout ─────────────────────────────────────

    /**
     * 画布布局（自由定位）
     * pinned 卡片保持绝对位置，unpinned 卡片自动排列
     */
    function _layoutCanvas(cards, containerWidth, options = {}) {
        const gap = options.gap || GRID_GAP;

        const positions = [];
        let autoY = gap;
        let autoX = gap;
        const maxY = containerWidth - GRID_CELL_W;

        for (const card of cards) {
            const span = _getCardSpan(card);
            const isPinned = card.layout && card.layout.pinned;

            if (isPinned) {
                positions.push({
                    cardId: card.id,
                    x: card.layout.x || 0,
                    y: card.layout.y || 0,
                    w: card.layout.w || span.w,
                    h: card.layout.h || span.h,
                    pinned: true,
                    mode: 'absolute'
                });
            } else {
                // 自动排列（简单的流式布局）
                const w = GRID_CELL_W * span.w + (span.w - 1) * gap;
                if (autoX + w > containerWidth - gap) {
                    autoX = gap;
                    autoY += GRID_CELL_H + gap;
                }

                positions.push({
                    cardId: card.id,
                    x: autoX,
                    y: autoY,
                    w: span.w,
                    h: span.h,
                    pinned: false,
                    mode: 'absolute'
                });

                autoX += w + gap;
            }
        }

        // 计算画布总高度
        let canvasHeight = autoY + GRID_CELL_H + gap;
        for (const pos of positions) {
            if (pos.mode === 'absolute') {
                const h = (pos.h || 1) * GRID_CELL_H + ((pos.h || 1) - 1) * gap;
                canvasHeight = Math.max(canvasHeight, (pos.y || 0) + h + gap);
            }
        }

        return { positions, canvasHeight, gap, mode: 'canvas' };
    }

    // ── Public API ────────────────────────────────────────

    /**
     * 计算布局
     * @param {string} mode - 'grid' | 'list' | 'masonry' | 'canvas'
     * @param {Array} cards - 卡片数组（含 id, layout, type 等）
     * @param {number} containerWidth - 容器宽度（px）
     * @param {Object} options - { gap, cols }
     * @returns {Object} 布局结果
     */
    function calculate(mode, cards, containerWidth, options = {}) {
        if (!cards || cards.length === 0) {
            return { positions: [], mode, empty: true };
        }

        switch (mode) {
            case 'grid':
                return _layoutGrid(cards, containerWidth, options);
            case 'list':
                return _layoutList(cards, containerWidth, options);
            case 'masonry':
                return _layoutMasonry(cards, containerWidth, options);
            case 'canvas':
                return _layoutCanvas(cards, containerWidth, options);
            default:
                Logger.warn('[LayoutEngine] Unknown layout mode:', mode, 'falling back to grid');
                return _layoutGrid(cards, containerWidth, options);
        }
    }

    /**
     * 获取推荐列数
     */
    function getRecommendedCols(containerWidth, mode) {
        return _calcCols(containerWidth, mode || 'grid');
    }

    /**
     * 清除所有卡片的 pinned 状态（一键重排）
     */
    function clearPinned(desktopId) {
        if (typeof StateManager === 'undefined') return;
        const cardIds = StateManager.getCardIds(desktopId);
        for (const cardId of cardIds) {
            StateManager.updateCardLayout(desktopId, cardId, { pinned: false });
        }
        Bus.emit('ws:layout:reset', { desktopId });
        Logger.info('[LayoutEngine] All pins cleared for desktop:', desktopId);
    }

    /**
     * 将像素坐标转换为 grid 坐标
     */
    function pixelToGrid(px, py, containerWidth, cols, gap) {
        const cellW = (containerWidth - (cols - 1) * gap) / cols;
        return {
            col: Math.max(1, Math.min(cols, Math.round(px / (cellW + gap)) + 1)),
            row: Math.max(1, Math.round(py / (GRID_CELL_H + gap)) + 1)
        };
    }

    /**
     * 将 grid 坐标转换为像素坐标
     */
    function gridToPixel(col, row, containerWidth, cols, gap) {
        const cellW = (containerWidth - (cols - 1) * gap) / cols;
        return {
            x: (col - 1) * (cellW + gap),
            y: (row - 1) * (GRID_CELL_H + gap)
        };
    }

    return {
        calculate,
        getRecommendedCols,
        clearPinned,
        pixelToGrid,
        gridToPixel,
        SIZE_MAP
    };
})();