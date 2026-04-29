import globals from "globals";
import js from "@eslint/js";

export default [
    js.configs.recommended,
    {
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.es2022,
                // 项目全局变量
                Components: "writable",
                API: "writable",
                DashboardPage: "writable",
                KnowledgePage: "writable",
                SessionsPage: "writable",
                ChatPage: "writable",
                ToolsPage: "writable",
                SkillsPage: "writable",
                MemoryPage: "writable",
                CronPage: "writable",
                AgentsPage: "writable",
                ConfigPage: "writable",
                AboutPage: "writable",
                McpPage: "writable",
                MarketplacePage: "writable",
                LogsPage: "writable",
                PluginsPage: "writable",
                TrashPage: "writable",
                APP_VERSION: "readonly",
                HermesMCP: "readonly",
                showToast: "readonly",
                marked: "readonly",
                hljs: "readonly",
            },
            ecmaVersion: 2022,
            sourceType: "script",
        },
        rules: {
            // 放宽规则以适配项目风格
            "no-unused-vars": ["warn", {
                argsIgnorePattern: "^_",
                varsIgnorePattern: "^_",
            }],
            "no-undef": "error",
            "no-redeclare": "off",
            "no-dupe-keys": "error",
            "no-duplicate-case": "error",
            "no-unreachable": "error",
            "no-constant-condition": "warn",
            "no-empty": "warn",
            "no-extra-semi": "off",
            "no-fallthrough": ["warn", { commentPattern: "break omitted" }],
            "preserve-caught-error": "off",
        },
    },
    {
        ignores: [
            "node_modules/",
            "index.html",
        ],
    },
];
