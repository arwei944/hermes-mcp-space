"""
知识库种子数据 — 预置规则和经验
"""

def seed_default_rules(conn):
    """预置默认规则"""
    rules = [
        {
            "id": "rule_0001_safety",
            "title": "安全操作规范",
            "content": "## 安全操作规范\n\n1. 禁止执行 `shell=True` 的命令\n2. 禁止直接操作生产数据库\n3. 所有删除操作必须经过确认\n4. 敏感信息不得写入日志",
            "category": "safety",
            "priority": 10,
            "scope": "global",
            "source": "manual"
        },
        {
            "id": "rule_0002_format",
            "title": "代码风格规范",
            "content": "## 代码风格规范\n\n1. Python 3.10+ 语法\n2. 使用 type hints\n3. 函数不超过 50 行\n4. 类不超过 300 行\n5. 文件不超过 500 行",
            "category": "format",
            "priority": 7,
            "scope": "global",
            "source": "manual"
        },
        {
            "id": "rule_0003_workflow",
            "title": "知识库操作规范",
            "content": "## 知识库操作规范\n\n1. 所有写入操作必须经过审核队列\n2. 创建知识条目时必须提供来源\n3. 更新知识条目时必须说明变更理由\n4. 删除操作需要高优先级审核",
            "category": "workflow",
            "priority": 8,
            "scope": "global",
            "source": "manual"
        }
    ]

    for rule in rules:
        conn.execute(
            """INSERT OR IGNORE INTO rules (id, title, content, category, priority, scope, source, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'manual', datetime('now'), datetime('now'))""",
            (rule["id"], rule["title"], rule["content"], rule["category"],
             rule["priority"], rule["scope"], rule["source"])
        )
    conn.commit()
    print(f"  ✅ 预置 {len(rules)} 条默认规则")


def seed_default_experiences(conn):
    """预置默认经验（从 AGENTS.md 提炼）"""
    experiences = [
        {
            "id": "exp_0001_pitfall",
            "title": "FastAPI 路由注册顺序",
            "content": "## FastAPI 路由注册顺序\n\n静态路由必须在动态路由之前注册，否则动态路由会优先匹配导致 404。\n\n**错误示例**：先注册 `/api/{item_id}` 再注册 `/api/overview`\n**正确做法**：先注册 `/api/overview` 再注册 `/api/{item_id}`",
            "category": "pitfall",
            "severity": "high",
            "source": "manual"
        },
        {
            "id": "exp_0002_tip",
            "title": "HF Space 冷启动处理",
            "content": "## HF Space 冷启动处理\n\nHuggingFace Spaces 可能被回收重启，需要：\n1. 使用 persistent storage 保持数据\n2. 配置 Keep-Alive 避免频繁冷启动\n3. 健康检查端点返回 200 确认服务就绪",
            "category": "tip",
            "severity": "medium",
            "source": "manual"
        }
    ]

    for exp in experiences:
        conn.execute(
            """INSERT OR IGNORE INTO experiences (id, title, content, category, severity, source, created_by, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 'manual', datetime('now'), datetime('now'))""",
            (exp["id"], exp["title"], exp["content"], exp["category"],
             exp["severity"], exp["source"])
        )
    conn.commit()
    print(f"  ✅ 预置 {len(experiences)} 条默认经验")


def run_seed():
    """执行种子数据初始化"""
    from backend.db import get_knowledge_db, init_knowledge_db

    print("🌱 初始化种子数据...")
    conn = get_knowledge_db()
    init_knowledge_db(conn)

    seed_default_rules(conn)
    seed_default_experiences(conn)

    print("✅ 种子数据初始化完成！")


if __name__ == "__main__":
    run_seed()
