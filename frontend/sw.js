/**
 * Hermes Agent - Service Worker
 * V7-24: PWA 离线缓存支持
 * V13.4: 更新缓存列表匹配模块化文件结构
 * V14.3: 添加自愈缓存机制，减少手动维护 CACHE_FILES 的负担
 */

const CACHE_NAME = 'hermes-v8';

// 注意：以下 STATIC_ASSETS 列表需要手动维护，新增页面/模块时需同步更新。
// v14.3 已添加自愈机制：未在预缓存列表中的资源会在首次请求时自动缓存。
const STATIC_ASSETS = [
    '/',
    '/css/style.css',
    '/css/dark-theme.css',
    '/css/knowledge.css',
    '/js/app.js',
    '/js/api.js',
    '/js/i18n.js',
    // Core
    '/js/core/Logger.js',
    '/js/core/Store.js',
    '/js/core/Bus.js',
    '/js/core/ErrorHandler.js',
    '/js/core/APIClient.js',
    '/js/core/constants.js',
    '/js/core/Router.js',
    '/js/core/init.js',
    // Services
    '/js/services/OpsSyncService.js',
    '/js/services/AlertChecker.js',
    '/js/services/AlertNotifier.js',
    // Utilities
    '/js/utils/sse.js',
    '/js/utils/export-progress.js',
    '/js/utils/confirm-dialog.js',
    // Components
    '/js/components/icons.js',
    '/js/components/utils.js',
    '/js/components/feedback.js',
    '/js/components/layout.js',
    '/js/components/form.js',
    '/js/components/data-display.js',
    '/js/components/onboarding.js',
    '/js/components/index.js',
    // Pages (register.js entry points)
    '/js/pages/dashboard/register.js',
    '/js/pages/knowledge/register.js',
    '/js/pages/sessions/register.js',
    '/js/pages/chat/register.js',
    '/js/pages/memory/register.js',
    '/js/pages/cron/register.js',
    '/js/pages/agents_behavior/register.js',
    '/js/pages/config/register.js',
    '/js/pages/about/register.js',
    '/js/pages/trash/register.js',
    '/js/pages/agents/register.js',
    '/js/pages/screenshot/register.js',
    '/js/pages/marketplace/register.js',
    '/js/pages/logs/register.js',
    '/js/pages/sync/register.js',
    '/js/pages/ops-center/register.js',
    '/js/pages/ops-dashboard/register.js',
    '/js/pages/ops-alerts/register.js',
    '/manifest.json',
];

// 安装：预缓存静态资源
self.addEventListener('install', function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// 激活：清理旧缓存
self.addEventListener('activate', function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys.filter(function (k) { return k !== CACHE_NAME; })
                    .map(function (k) { return caches.delete(k); })
            );
        })
    );
    self.clients.claim();
});

// Self-healing: dynamically cache requested resources
self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((response) => {
                if (response) return response;
                // Not in cache - fetch and cache dynamically
                return fetch(event.request).then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                });
            });
        })
    );
});
