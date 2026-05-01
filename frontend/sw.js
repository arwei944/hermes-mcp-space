/**
 * Hermes Agent - Service Worker
 * V7-24: PWA 离线缓存支持
 */

const CACHE_NAME = 'hermes-v7';
const STATIC_ASSETS = [
    '/',
    '/css/style.css',
    '/js/app.js',
    '/js/api.js',
    '/js/components.js',
    '/js/i18n.js',
    '/js/utils/sse.js',
    '/js/utils/export-progress.js',
    '/js/utils/confirm-dialog.js',
    '/js/pages/dashboard.js',
    '/js/pages/knowledge.js',
    '/js/pages/sessions.js',
    '/js/pages/chat.js',
    '/js/pages/memory.js',
    '/js/pages/cron.js',
    '/js/pages/agents.js',
    '/js/pages/agents_behavior.js',
    '/js/pages/config.js',
    '/js/pages/about.js',
    '/js/pages/marketplace.js',
    '/js/pages/logs.js',
    '/js/pages/sync.js',
    '/js/pages/trash.js',
    '/js/pages/screenshot.js',
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

// 请求拦截：缓存优先策略（API 请求不缓存）
self.addEventListener('fetch', function (event) {
    // API 请求不缓存
    if (event.request.url.includes('/api/')) return;

    // SSE 请求不缓存
    if (event.request.url.includes('/api/events')) return;

    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) {
                // 后台更新缓存
                fetch(event.request).then(function (response) {
                    if (response && response.ok) {
                        caches.open(CACHE_NAME).then(function (cache) {
                            cache.put(event.request, response);
                        });
                    }
                }).catch(function () {
                    // 网络不可用时忽略
                });
                return cached;
            }

            return fetch(event.request).then(function (response) {
                if (!response || !response.ok) {
                    return response;
                }
                var clone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, clone);
                });
                return response;
            }).catch(function () {
                // 离线降级：返回离线提示页面
                if (event.request.mode === 'navigate') {
                    return caches.match('/');
                }
                return new Response('Offline', { status: 503, statusText: 'Service Unavailable' });
            });
        })
    );
});
