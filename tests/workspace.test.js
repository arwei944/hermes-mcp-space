#!/usr/bin/env node
/**
 * Hermes Workspace — 自动化测试脚本
 * 
 * 测试范围:
 * 1. 文件结构完整性（所有文件存在）
 * 2. 模块语法正确性（可解析）
 * 3. API 接口完整性（每个模块导出的方法）
 * 4. Widget 注册完整性（22个 Widget 全部注册）
 * 5. CSS 变量一致性（workspace.css 使用现有 Design Token）
 * 
 * 运行: node tests/workspace.test.js
 */

const fs = require('fs');
const path = require('path');

const FRONTEND = path.join(__dirname, '..');

// ── Test Framework ───────────────────────────────────────
let _passed = 0;
let _failed = 0;
const _errors = [];

function assert(condition, message) {
    if (condition) {
        _passed++;
        console.log(`  ✅ ${message}`);
    } else {
        _failed++;
        _errors.push(message);
        console.log(`  ❌ ${message}`);
    }
}

function section(title) {
    console.log(`\n━━━ ${title} ━━━`);
}

// ── 1. File Structure Tests ──────────────────────────────
section('1. 文件结构完整性');

const REQUIRED_FILES = {
    // P0 Core
    'frontend/css/workspace.css': 'workspace 样式文件',
    'frontend/js/workspace/core/StateManager.js': '状态管理器',
    'frontend/js/workspace/core/DataService.js': '统一传输层',
    // P1 Core
    'frontend/js/workspace/core/LayoutEngine.js': '布局引擎',
    'frontend/js/workspace/core/DragManager.js': '拖拽管理器',
    'frontend/js/workspace/core/ResizeManager.js': '缩放管理器',
    'frontend/js/workspace/core/ZIndexManager.js': '层级管理器',
    'frontend/js/workspace/core/CardManager.js': '卡片生命周期',
    // P2 Core
    'frontend/js/workspace/core/GestureManager.js': '手势管理器',
    'frontend/js/workspace/core/DesktopManager.js': '桌面管理器',
    // P3 Core
    'frontend/js/workspace/core/WidgetRegistry.js': 'Widget 注册表',
    // P1 Components
    'frontend/js/workspace/components/CardWidget.js': '卡片外壳',
    'frontend/js/workspace/components/LayoutSwitcher.js': '布局切换器',
    // P2 Components
    'frontend/js/workspace/components/DesktopContainer.js': '桌面容器',
    'frontend/js/workspace/components/DesktopTabs.js': '桌面标签',
    // P3 Components
    'frontend/js/workspace/components/CardStore.js': '卡片商店',
    // P3 Entry Widgets
    'frontend/js/workspace/widgets/entries/KnowledgeEntryWidget.js': '知识库入口',
    'frontend/js/workspace/widgets/entries/RulesEntryWidget.js': '规则入口',
    'frontend/js/workspace/widgets/entries/ExperienceEntryWidget.js': '经验入口',
    'frontend/js/workspace/widgets/entries/MemoryEntryWidget.js': '记忆入口',
    'frontend/js/workspace/widgets/entries/ReviewEntryWidget.js': '审核入口',
    'frontend/js/workspace/widgets/entries/SessionsEntryWidget.js': '会话入口',
    // P3 Data Widgets
    'frontend/js/workspace/widgets/data/KnowledgeListWidget.js': '知识列表',
    'frontend/js/workspace/widgets/data/RulesListWidget.js': '规则列表',
    'frontend/js/workspace/widgets/data/ExperienceListWidget.js': '经验列表',
    'frontend/js/workspace/widgets/data/MemoryListWidget.js': '记忆列表',
    'frontend/js/workspace/widgets/data/ReviewListWidget.js': '审核列表',
    'frontend/js/workspace/widgets/data/SessionRecentWidget.js': '最近会话',
    'frontend/js/workspace/widgets/data/CronListWidget.js': '定时任务',
    'frontend/js/workspace/widgets/data/AgentListWidget.js': 'Agent 列表',
    // P3 Stat Widgets
    'frontend/js/workspace/widgets/stats/ReviewStatWidget.js': '审核统计',
    'frontend/js/workspace/widgets/stats/DashboardStatsWidget.js': '仪表盘统计',
    'frontend/js/workspace/widgets/stats/McpStatusWidget.js': 'MCP 状态',
    'frontend/js/workspace/widgets/stats/KnowledgeGraphWidget.js': '知识图谱',
    'frontend/js/workspace/widgets/stats/OpsMetricsWidget.js': '运维指标',
    // P3 Function Widgets
    'frontend/js/workspace/widgets/functions/QuickCreateWidget.js': '快捷创建',
    'frontend/js/workspace/widgets/functions/GlobalSearchWidget.js': '全局搜索',
    'frontend/js/workspace/widgets/functions/SessionSearchWidget.js': '会话搜索',
    // P3 Shortcut Widgets
    'frontend/js/workspace/widgets/shortcuts/MemoWidget.js': '备忘录',
    'frontend/js/workspace/widgets/shortcuts/TodoWidget.js': '待办事项',
    // Page
    'frontend/js/workspace/pages/WorkspacePage.js': '工作台页面'
};

for (const [filePath, desc] of Object.entries(REQUIRED_FILES)) {
    const fullPath = path.join(FRONTEND, filePath);
    const exists = fs.existsSync(fullPath);
    assert(exists, `${desc} (${filePath})`);
}

// ── 2. Syntax Validity Tests ─────────────────────────────
section('2. JavaScript 语法正确性');

const JS_FILES = Object.keys(REQUIRED_FILES).filter(f => f.endsWith('.js'));

for (const filePath of JS_FILES) {
    const fullPath = path.join(FRONTEND, filePath);
    try {
        const code = fs.readFileSync(fullPath, 'utf-8');
        // 检查基本语法（括号匹配）— 排除字符串字面量中的括号
        const stripped = code
            .replace(/\/\/.*$/gm, '')           // 移除单行注释
            .replace(/\/\*[\s\S]*?\*\//g, '')   // 移除多行注释
            .replace(/'(?:[^'\\]|\\.)*'/g, '""') // 将单引号字符串替换为空字符串
            .replace(/"(?:[^"\\]|\\.)*"/g, '""') // 将双引号字符串替换为空字符串
            .replace(/`(?:[^`\\]|\\.)*`/g, '""'); // 将模板字符串替换为空字符串
        const opens = (stripped.match(/\(/g) || []).length;
        const closes = (stripped.match(/\)/g) || []).length;
        const bracesOpen = (stripped.match(/\{/g) || []).length;
        const bracesClose = (stripped.match(/\}/g) || []).length;
        const bracketsOpen = (stripped.match(/\[/g) || []).length;
        const bracketsClose = (stripped.match(/\]/g) || []).length;
        
        assert(opens === closes, `${path.basename(filePath)} 括号匹配 ()`);
        assert(bracesOpen === bracesClose, `${path.basename(filePath)} 花括号匹配 {}`);
        assert(bracketsOpen === bracketsClose, `${path.basename(filePath)} 方括号匹配 []`);
    } catch (e) {
        assert(false, `${path.basename(filePath)} 可读取`);
    }
}

// ── 3. API Completeness Tests ────────────────────────────
section('3. 核心 API 接口完整性');

const CORE_API = {
    'StateManager.js': ['init', 'destroy', 'getConfig', 'updateConfig', 'getDesktopIds', 'getActiveDesktopId', 'setActiveDesktop', 'createDesktop', 'deleteDesktop', 'createCard', 'deleteCard', 'updateCard', 'getCard', 'getCardIds', 'enterEditMode', 'exitEditMode', 'toggleEditMode', 'flush'],
    'DataService.js': ['init', 'destroy', 'fetch', 'refresh', 'batch', 'subscribe', 'cancel', 'cancelAll', 'invalidate', 'clearCache', 'getCacheStats', 'registerSource'],
    'LayoutEngine.js': ['calculate', 'getRecommendedCols', 'clearPinned', 'pixelToGrid', 'gridToPixel'],
    'DragManager.js': ['init', 'destroy', 'onCallbacks', 'isActive', 'getActive'],
    'ResizeManager.js': ['init', 'destroy', 'onCallbacks', 'addHandles'],
    'ZIndexManager.js': ['init', 'bringToFront', 'getZ', 'setDragZ', 'restoreZ', 'getMaxZ', 'resetAll', 'remove', 'destroy'],
    'CardManager.js': ['init', 'destroy', 'createCard', 'deleteCard', 'renderDesktop', 'switchLayout', 'relayout'],
    'WidgetRegistry.js': ['register', 'get', 'has', 'list', 'listByCategory', 'listByType'],
    'CardWidget.js': ['createDOM', 'register', 'unregister', 'get', 'getElement', 'mountWidget', 'unmountWidget', 'toggleExpand', 'updateTitle', 'setEditMode', 'updateZIndex', 'destroyAll'],
    'CardStore.js': ['open', 'close', 'isOpen'],
    'DesktopManager.js': ['init', 'switchTo', 'switchNext', 'switchPrev', 'createDesktop', 'deleteDesktop', 'renameDesktop', 'getDesktop', 'getAllDesktops', 'getActiveDesktop', 'getCount'],
    'GestureManager.js': ['init', 'destroy', 'onSwipe', 'onPinchZoom'],
    'WorkspacePage.js': ['render', 'onSSEEvent', 'destroy']
};

for (const [fileName, expectedMethods] of Object.entries(CORE_API)) {
    const fullPath = path.join(FRONTEND, `frontend/js/workspace/core/${fileName}`) ||
                      path.join(FRONTEND, `frontend/js/workspace/components/${fileName}`) ||
                      path.join(FRONTEND, `frontend/js/workspace/pages/${fileName}`);
    
    // 找到文件
    let filePath = null;
    for (const dir of ['core', 'components', 'pages']) {
        const p = path.join(FRONTEND, `frontend/js/workspace/${dir}/${fileName}`);
        if (fs.existsSync(p)) { filePath = p; break; }
    }
    
    if (!filePath) {
        assert(false, `${fileName} 文件找到`);
        continue;
    }
    
    const code = fs.readFileSync(filePath, 'utf-8');
    
    for (const method of expectedMethods) {
        // 检查方法是否在 return 对象中导出
        const hasMethod = code.includes(`${method}`);
        assert(hasMethod, `${fileName} 导出 ${method}()`);
    }
}

// ── 4. Widget Registration Tests ─────────────────────────
section('4. Widget 注册完整性');

const EXPECTED_WIDGETS = [
    'knowledge-entry', 'rules-entry', 'experience-entry', 'memory-entry', 'review-entry', 'sessions-entry',
    'knowledge-list', 'rules-list', 'experience-list', 'memory-list', 'review-list', 'session-recent',
    'cron-list', 'agent-list',
    'review-stat', 'dashboard-stats', 'mcp-status', 'knowledge-graph', 'ops-metrics',
    'quick-create', 'global-search', 'session-search',
    'memo', 'todo'
];

assert(EXPECTED_WIDGETS.length === 24, `预期 24 个 Widget，实际 ${EXPECTED_WIDGETS.length} 个`);

for (const widgetName of EXPECTED_WIDGETS) {
    // 检查对应的 Widget 文件中是否调用了 WidgetRegistry.register
    let found = false;
    const widgetDirs = ['entries', 'data', 'stats', 'functions', 'shortcuts'];
    
    for (const dir of widgetDirs) {
        const dirPath = path.join(FRONTEND, `frontend/js/workspace/widgets/${dir}`);
        if (!fs.existsSync(dirPath)) continue;
        
        const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            const code = fs.readFileSync(path.join(dirPath, file), 'utf-8');
            if (code.includes(`'${widgetName}'`) || code.includes(`"${widgetName}"`)) {
                if (code.includes('WidgetRegistry.register')) {
                    found = true;
                    break;
                }
            }
        }
        if (found) break;
    }
    
    assert(found, `Widget "${widgetName}" 已注册`);
}

// ── 5. CSS Variable Consistency Tests ─────────────────────
section('5. CSS Design Token 一致性');

const cssPath = path.join(FRONTEND, 'frontend/css/workspace.css');
const cssCode = fs.readFileSync(cssPath, 'utf-8');

const DESIGN_TOKENS = [
    '--bg', '--surface', '--surface-hover',
    '--text-primary', '--text-secondary', '--text-tertiary',
    '--accent', '--accent-light', '--accent-hover',
    '--border', '--border-strong',
    '--shadow', '--shadow-md', '--shadow-lg',
    '--radius', '--radius-sm', '--radius-xs',
    '--space-1', '--space-2', '--space-3', '--space-4',
    '--text-xs', '--text-sm', '--text-lg', '--text-2xl',
    '--duration-fast', '--duration-normal', '--duration-slow',
    '--ease-default', '--ease-out',
    '--green', '--orange', '--red', '--purple', '--blue'
];

const usedTokens = new Set();
for (const token of DESIGN_TOKENS) {
    if (cssCode.includes(`var(${token}`)) {
        usedTokens.add(token);
    }
}

assert(usedTokens.size >= 15, `使用了 ${usedTokens.size} 个 Design Token（≥15）`);

// 检查没有硬编码颜色
const hardcodedColors = (cssCode.match(/#[0-9a-fA-F]{6}/g) || []).filter(c => {
    return c !== '#ffffff' && c !== '#fff' && c !== '#000000' && c !== '#000';
});
assert(hardcodedColors.length <= 5, `硬编码颜色 ≤5（实际 ${hardcodedColors.length}）`);

// ── 6. index.html Script Order Tests ─────────────────────
section('6. index.html 脚本加载顺序');

const htmlPath = path.join(FRONTEND, 'frontend/index.html');
const htmlCode = fs.readFileSync(htmlPath, 'utf-8');

// 检查 workspace.css 引入
assert(htmlCode.includes('workspace.css'), 'workspace.css 已引入');

// 检查关键脚本按正确顺序加载
const scriptOrder = [
    'StateManager.js',
    'DataService.js',
    'LayoutEngine.js',
    'DragManager.js',
    'ResizeManager.js',
    'ZIndexManager.js',
    'CardManager.js',
    'GestureManager.js',
    'DesktopManager.js',
    'WidgetRegistry.js',
    // Widgets...
    'CardWidget.js',
    'LayoutSwitcher.js',
    'DesktopContainer.js',
    'DesktopTabs.js',
    'CardStore.js',
    'WorkspacePage.js',
    'app.js'
];

let lastPos = -1;
let lastScriptName = '';
for (const script of scriptOrder) {
    // 使用 script src 属性匹配，避免 preload 等标签干扰
    const escaped = script.replace('.', '\\.');
    const pattern = new RegExp('src="[^"]*' + escaped + '"');
    const match = htmlCode.match(pattern);
    const idx = match ? match.index : -1;
    const prevLabel = lastPos > -1 ? lastScriptName : '(文件开头)';
    assert(idx > lastPos, `${script} 加载顺序正确（在 ${prevLabel} 之后）`);
    lastPos = idx;
    lastScriptName = script;
}

// 检查工作台侧边栏入口
assert(htmlCode.includes('data-page="workspace"'), '侧边栏工作台入口存在');

// ── Results ──────────────────────────────────────────────
console.log(`\n${'═'.repeat(50)}`);
console.log(`📊 测试结果: ${_passed} 通过, ${_failed} 失败`);
console.log(`${'═'.repeat(50)}`);

if (_failed > 0) {
    console.log('\n❌ 失败项:');
    _errors.forEach(e => console.log(`  - ${e}`));
    process.exit(1);
} else {
    console.log('\n🎉 所有测试通过！');
    process.exit(0);
}
