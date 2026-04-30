# ==================== 构建阶段 ====================
FROM python:3.11-slim AS builder

WORKDIR /build

# 安装系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# ==================== 运行阶段 ====================
FROM python:3.11-slim

WORKDIR /app

# 安装运行时系统依赖
RUN apt-get update && apt-get install -y --no-install-recommends \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# 从构建阶段复制 Python 包
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# 复制项目文件
COPY . .

# 创建 Hermes 数据目录
RUN mkdir -p /root/.hermes/{data,skills,memories,cron,agents,logs}

# 配置 Git（用于数据持久化备份）
RUN git config --global user.email "hermes-bot@users.noreply.github.com" && \
    git config --global user.name "Hermes Bot" && \
    git config --global init.defaultBranch main

# 环境变量
ENV PYTHONUNBUFFERED=1
ENV HERMES_HOME=/root/.hermes
ENV PANEL_PORT=7860
ENV MCP_SSE_PORT=8765
ENV ENABLE_MCP_SSE=true
ENV LOG_LEVEL=INFO

# 暴露端口
EXPOSE 7860 8765

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:7860/api/health || exit 1

# 启动命令
CMD ["python", "app.py"]
