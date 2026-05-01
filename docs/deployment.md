# 部署指南

## CDN 加速

生产环境建议使用 CDN 加速静态资源：

1. 将 `frontend/static/` 目录上传到 CDN
2. 修改 `app.py` 中的静态文件路径指向 CDN URL
3. 设置适当的缓存头

## 环境变量

| 变量 | 说明 | 默认值 |
|------|------|--------|
| APP_VERSION | 应用版本 | 7.0.0 |
| AUTH_TOKEN | 认证 token（空=关闭认证） | "" |
| RATE_LIMIT_ENABLED | 启用速率限制 | false |
| RATE_LIMIT_PER_MINUTE | 每分钟请求数 | 60 |
| CACHE_ENABLED | 启用响应缓存 | false |
| CACHE_TTL | 缓存过期时间(秒) | 60 |
