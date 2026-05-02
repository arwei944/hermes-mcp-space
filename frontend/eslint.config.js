// ESLint 配置 - Hermes 前端 V2
// 宽松规则，适配 Vanilla JS + IIFE 模块风格

import globals from "globals";
import eslintJs from "@eslint/js";
import prettierConfig from "eslint-config-prettier";

export default [
    eslintJs.configs.recommended,
    prettierConfig,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.es2022,
                // Hermes 全局模块
                window: "writable",
                document: "readonly",
                console: "readonly",
                fetch: "readonly",
                setTimeout: "readonly",
                setInterval: "readonly",
                clearTimeout: "readonly",
                clearInterval: "readonly",
                requestAnimationFrame: "readonly",
                localStorage: "readonly",
                URL: "readonly",
                URLSearchParams: "readonly",
                AbortController: "readonly",
                MutationObserver: "readonly",
                IntersectionObserver: "readonly",
                ResizeObserver: "readonly",
                matchMedia: "readonly",
                // Hermes 全局对象（IIFE 模块挂载）
                Logger: "readonly",
                Store: "readonly",
                Bus: "readonly",
                Router: "readonly",
                ErrorHandler: "readonly",
                APIClient: "readonly",
                Events: "readonly",
                Components: "readonly",
                API: "readonly",
                SSEManager: "readonly",
                OpsSyncService: "readonly",
                AlertChecker: "readonly",
                AlertNotifier: "readonly",
                // 页面模块（IIFE 挂载到 window）
                DashboardPage: "readonly",
                KnowledgePage: "readonly",
                SessionsPage: "readonly",
                MarketplacePage: "readonly",
                MemoryPage: "readonly",
                CronPage: "readonly",
                AgentsPage: "readonly",
                AgentsBehaviorPage: "readonly",
                ConfigPage: "readonly",
                LogsPage: "readonly",
                AboutPage: "readonly",
                TrashPage: "readonly",
                ScreenshotPage: "readonly",
                SyncPage: "readonly",
                OpsDashboardPage: "readonly",
                OpsAlertsPage: "readonly",
                ChatPage: "readonly",
                App: "readonly",
                showToast: "readonly",
            },
        },
        rules: {
            // 宽松规则 - 适配现有代码风格
            "no-unused-vars": "off",
            "no-undef": "off", // IIFE 模块通过 window 挂载，ESLint 无法追踪
            "no-redeclare": "off",
            "no-constant-condition": "off",
            "no-empty": "off",
            "no-inner-declarations": "off",
            "no-prototype-builtins": "off",
            "no-control-regex": "off",
            "no-useless-escape": "off",

            // 有用的规则
            "no-dupe-keys": "error",
            "no-duplicate-case": "error",
            "no-func-assign": "error",
            "no-invalid-regexp": "error",
            "no-irregular-whitespace": "error",
            "no-unreachable": "error",
            "no-unsafe-negation": "error",
            "valid-typeof": "error",
            "no-debugger": "warn",
            "no-alert": "warn",
            "no-eval": "warn",

            // 适配现有代码
            "no-useless-assignment": "off",
            "preserve-caught-error": "off",
        },
    },
    {
        ignores: [
            "**/node_modules/**",
            "**/dist/**",
            "**/build/**",
            "**/.venv/**",
            "**/venv/**",
        ],
    },
];
