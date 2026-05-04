-- ============================================================
-- hermes-mcp-space 知识库 Schema v1.0
-- 数据库：knowledge.db
-- ============================================================

-- ==================== 审核队列表 ====================
CREATE TABLE IF NOT EXISTS reviews (
    id          TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,                     -- rule/knowledge/experience/memory
    target_id   TEXT NOT NULL DEFAULT '',
    action      TEXT NOT NULL,                     -- create/update/delete/resolve
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    old_content TEXT NOT NULL DEFAULT '',
    reason      TEXT NOT NULL DEFAULT '',          -- AI 变更理由
    confidence  REAL NOT NULL DEFAULT 0.8,
    priority    TEXT NOT NULL DEFAULT 'normal',    -- urgent/normal/low
    status      TEXT NOT NULL DEFAULT 'pending',   -- pending/approved/rejected/expired
    reviewed_by TEXT NOT NULL DEFAULT '',
    reviewed_at TEXT NOT NULL DEFAULT '',
    review_note TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL,
    expires_at  TEXT NOT NULL DEFAULT '',
    session_id  TEXT NOT NULL DEFAULT '',
    tool_call   TEXT NOT NULL DEFAULT '',
    context     TEXT NOT NULL DEFAULT ''
);

-- ==================== 规则表 ====================
CREATE TABLE IF NOT EXISTS rules (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'general',  -- general/safety/format/workflow/priority
    priority    INTEGER NOT NULL DEFAULT 5,        -- 1-10, 10 最高
    scope       TEXT NOT NULL DEFAULT 'global',    -- global/session_type/tool
    scope_value TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',        -- JSON 数组
    source      TEXT NOT NULL DEFAULT 'manual',    -- manual/ai_learned/imported
    source_ref  TEXT NOT NULL DEFAULT '',
    version     INTEGER NOT NULL DEFAULT 1,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    created_by  TEXT NOT NULL DEFAULT 'manual',    -- ai/manual/import
    review_id   TEXT,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
);

-- ==================== 知识表 ====================
CREATE TABLE IF NOT EXISTS knowledge (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    summary     TEXT NOT NULL DEFAULT '',          -- AI 生成摘要（200字以内）
    category    TEXT NOT NULL DEFAULT 'general',   -- tech/domain/project/reference/faq
    tags        TEXT NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL DEFAULT 'manual',    -- manual/ai_extracted/web_import/session/imported
    source_ref  TEXT NOT NULL DEFAULT '',
    confidence  REAL NOT NULL DEFAULT 0.8,         -- 0-1
    "references" TEXT NOT NULL DEFAULT '[]',        -- JSON [{type, id, title}]
    version     INTEGER NOT NULL DEFAULT 1,
    is_active   INTEGER NOT NULL DEFAULT 1,
    view_count  INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    created_by  TEXT NOT NULL DEFAULT 'manual',
    review_id   TEXT,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
);

-- ==================== 经验表 ====================
CREATE TABLE IF NOT EXISTS experiences (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL DEFAULT '',
    category    TEXT NOT NULL DEFAULT 'best_practice', -- best_practice/error_pattern/pitfall/tip/workflow
    context     TEXT NOT NULL DEFAULT '',
    tool_name   TEXT NOT NULL DEFAULT '',
    error_type  TEXT NOT NULL DEFAULT '',
    severity    TEXT NOT NULL DEFAULT 'medium',    -- high/medium/low
    is_resolved INTEGER NOT NULL DEFAULT 1,
    occurrence_count INTEGER NOT NULL DEFAULT 1,
    last_seen   TEXT NOT NULL DEFAULT '',
    tags        TEXT NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL DEFAULT 'ai_learned',
    source_ref  TEXT NOT NULL DEFAULT '',
    version     INTEGER NOT NULL DEFAULT 1,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    created_by  TEXT NOT NULL DEFAULT 'ai',
    review_id   TEXT,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
);

-- ==================== 记忆表 ====================
CREATE TABLE IF NOT EXISTS memories (
    id          TEXT PRIMARY KEY,
    category    TEXT NOT NULL,                     -- agent_memory/user_profile/preference/context/fact
    title       TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    importance  INTEGER NOT NULL DEFAULT 5,        -- 1-10
    access_count INTEGER NOT NULL DEFAULT 0,
    last_accessed TEXT NOT NULL DEFAULT '',
    expires_at  TEXT NOT NULL DEFAULT '',          -- 空 = 永不过期
    tags        TEXT NOT NULL DEFAULT '[]',
    source      TEXT NOT NULL DEFAULT 'ai',
    source_ref  TEXT NOT NULL DEFAULT '',
    version     INTEGER NOT NULL DEFAULT 1,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    created_by  TEXT NOT NULL DEFAULT 'ai',
    review_id   TEXT,
    FOREIGN KEY (review_id) REFERENCES reviews(id) ON DELETE SET NULL
);



-- ==================== 上下文预算表（单例） ====================
CREATE TABLE IF NOT EXISTS context_budget (
    id              INTEGER PRIMARY KEY CHECK (id = 1),
    total_budget    INTEGER NOT NULL DEFAULT 4000,
    rules_pct       INTEGER NOT NULL DEFAULT 15,
    knowledge_pct   INTEGER NOT NULL DEFAULT 25,
    experience_pct  INTEGER NOT NULL DEFAULT 15,
    memory_pct      INTEGER NOT NULL DEFAULT 20,
    session_pct     INTEGER NOT NULL DEFAULT 25,
    updated_at      TEXT NOT NULL
);

-- ==================== 对话-知识关联表 ====================
CREATE TABLE IF NOT EXISTS session_knowledge_links (
    session_id     TEXT NOT NULL,
    knowledge_id   TEXT NOT NULL,
    link_type      TEXT NOT NULL DEFAULT 'extracted', -- extracted/referenced/created
    created_at     TEXT NOT NULL,
    PRIMARY KEY (session_id, knowledge_id)
);

-- ==================== 版本历史表 ====================
CREATE TABLE IF NOT EXISTS version_history (
    id          TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,                     -- rule/knowledge/experience/memory
    target_id   TEXT NOT NULL,
    version     INTEGER NOT NULL,
    title       TEXT NOT NULL DEFAULT '',
    content     TEXT NOT NULL DEFAULT '',
    changed_by  TEXT NOT NULL DEFAULT '',          -- ai/manual
    change_reason TEXT NOT NULL DEFAULT '',
    created_at  TEXT NOT NULL
);

-- ==================== 索引 ====================
CREATE INDEX IF NOT EXISTS idx_rules_category ON rules(category, is_active);
CREATE INDEX IF NOT EXISTS idx_rules_priority ON rules(priority DESC);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge(category, is_active);
CREATE INDEX IF NOT EXISTS idx_knowledge_confidence ON knowledge(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_experiences_category ON experiences(category, is_active);
CREATE INDEX IF NOT EXISTS idx_experiences_resolved ON experiences(is_resolved, severity);
CREATE INDEX IF NOT EXISTS idx_memories_category ON memories(category, is_active);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_version_history_target ON version_history(target_type, target_id, version);
CREATE INDEX IF NOT EXISTS idx_session_knowledge_links_session ON session_knowledge_links(session_id);
CREATE INDEX IF NOT EXISTS idx_session_knowledge_links_knowledge ON session_knowledge_links(knowledge_id);

-- ==================== FTS5 全文搜索索引 ====================
CREATE VIRTUAL TABLE IF NOT EXISTS rules_fts USING fts5(
    title, content, tags, category,
    content='rules', content_rowid='rowid',
    tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS knowledge_fts USING fts5(
    title, content, summary, tags, category,
    content='knowledge', content_rowid='rowid',
    tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS experiences_fts USING fts5(
    title, content, context, tool_name, tags, category,
    content='experiences', content_rowid='rowid',
    tokenize='unicode61'
);

CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
    title, content, tags, category,
    content='memories', content_rowid='rowid',
    tokenize='unicode61'
);

-- ==================== 统一搜索索引 ====================
CREATE TABLE IF NOT EXISTS unified_fts_content (
    rowid INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    tags TEXT NOT NULL DEFAULT '',
    category TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT ''
);

CREATE VIRTUAL TABLE IF NOT EXISTS unified_fts USING fts5(
    type, title, content, tags, category,
    content='unified_fts_content', content_rowid='rowid',
    tokenize='unicode61'
);

-- ==================== FTS 触发器（自动同步） ====================

-- 规则 FTS 同步
CREATE TRIGGER IF NOT EXISTS rules_ai AFTER INSERT ON rules BEGIN
    INSERT INTO rules_fts(rowid, title, content, tags, category)
    VALUES (new.rowid, new.title, new.content, new.tags, new.category);
END;
CREATE TRIGGER IF NOT EXISTS rules_ad AFTER DELETE ON rules BEGIN
    INSERT INTO rules_fts(rules_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.tags, old.category);
END;
CREATE TRIGGER IF NOT EXISTS rules_au AFTER UPDATE ON rules BEGIN
    INSERT INTO rules_fts(rules_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.tags, old.category);
    INSERT INTO rules_fts(rowid, title, content, tags, category)
    VALUES (new.rowid, new.title, new.content, new.tags, new.category);
END;

-- 知识 FTS 同步
CREATE TRIGGER IF NOT EXISTS knowledge_ai AFTER INSERT ON knowledge BEGIN
    INSERT INTO knowledge_fts(rowid, title, content, summary, tags, category)
    VALUES (new.rowid, new.title, new.content, new.summary, new.tags, new.category);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_ad AFTER DELETE ON knowledge BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, summary, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary, old.tags, old.category);
END;
CREATE TRIGGER IF NOT EXISTS knowledge_au AFTER UPDATE ON knowledge BEGIN
    INSERT INTO knowledge_fts(knowledge_fts, rowid, title, content, summary, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.summary, old.tags, old.category);
    INSERT INTO knowledge_fts(rowid, title, content, summary, tags, category)
    VALUES (new.rowid, new.title, new.content, new.summary, new.tags, new.category);
END;

-- 经验 FTS 同步
CREATE TRIGGER IF NOT EXISTS experiences_ai AFTER INSERT ON experiences BEGIN
    INSERT INTO experiences_fts(rowid, title, content, context, tool_name, tags, category)
    VALUES (new.rowid, new.title, new.content, new.context, new.tool_name, new.tags, new.category);
END;
CREATE TRIGGER IF NOT EXISTS experiences_ad AFTER DELETE ON experiences BEGIN
    INSERT INTO experiences_fts(experiences_fts, rowid, title, content, context, tool_name, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.context, old.tool_name, old.tags, old.category);
END;
CREATE TRIGGER IF NOT EXISTS experiences_au AFTER UPDATE ON experiences BEGIN
    INSERT INTO experiences_fts(experiences_fts, rowid, title, content, context, tool_name, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.context, old.tool_name, old.tags, old.category);
    INSERT INTO experiences_fts(rowid, title, content, context, tool_name, tags, category)
    VALUES (new.rowid, new.title, new.content, new.context, new.tool_name, new.tags, new.category);
END;

-- 记忆 FTS 同步
CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
    INSERT INTO memories_fts(rowid, title, content, tags, category)
    VALUES (new.rowid, new.title, new.content, new.tags, new.category);
END;
CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.tags, old.category);
END;
CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
    INSERT INTO memories_fts(memories_fts, rowid, title, content, tags, category)
    VALUES ('delete', old.rowid, old.title, old.content, old.tags, old.category);
    INSERT INTO memories_fts(rowid, title, content, tags, category)
    VALUES (new.rowid, new.title, new.content, new.tags, new.category);
END;

-- 统一搜索索引同步
CREATE TRIGGER IF NOT EXISTS unified_rules_ai AFTER INSERT ON rules WHEN new.is_active = 1 BEGIN
    INSERT INTO unified_fts_content(type, ref_id, title, content, tags, category, created_at)
    VALUES ('rule', new.id, new.title, new.content, new.tags, new.category, new.created_at);
    INSERT INTO unified_fts(rowid, type, title, content, tags, category)
    VALUES ((SELECT MAX(rowid) FROM unified_fts_content), 'rule', new.title, new.content, new.tags, new.category);
END;
CREATE TRIGGER IF NOT EXISTS unified_knowledge_ai AFTER INSERT ON knowledge WHEN new.is_active = 1 BEGIN
    INSERT INTO unified_fts_content(type, ref_id, title, content, tags, category, created_at)
    VALUES ('knowledge', new.id, new.title, new.content, new.tags, new.category, new.created_at);
    INSERT INTO unified_fts(rowid, type, title, content, tags, category)
    VALUES ((SELECT MAX(rowid) FROM unified_fts_content), 'knowledge', new.title, new.content, new.tags, new.category);
END;
CREATE TRIGGER IF NOT EXISTS unified_experiences_ai AFTER INSERT ON experiences WHEN new.is_active = 1 BEGIN
    INSERT INTO unified_fts_content(type, ref_id, title, content, tags, category, created_at)
    VALUES ('experience', new.id, new.title, new.content, new.tags, new.category, new.created_at);
    INSERT INTO unified_fts(rowid, type, title, content, tags, category)
    VALUES ((SELECT MAX(rowid) FROM unified_fts_content), 'experience', new.title, new.content, new.tags, new.category);
END;
CREATE TRIGGER IF NOT EXISTS unified_memories_ai AFTER INSERT ON memories WHEN new.is_active = 1 BEGIN
    INSERT INTO unified_fts_content(type, ref_id, title, content, tags, category, created_at)
    VALUES ('memory', new.id, new.title, new.content, new.tags, new.category, new.created_at);
    INSERT INTO unified_fts(rowid, type, title, content, tags, category)
    VALUES ((SELECT MAX(rowid) FROM unified_fts_content), 'memory', new.title, new.content, new.tags, new.category);
END;

-- ==================== 初始化上下文预算 ====================
INSERT OR IGNORE INTO context_budget (id, total_budget, rules_pct, knowledge_pct, experience_pct, memory_pct, session_pct, updated_at)
VALUES (1, 4000, 15, 25, 15, 20, 25, datetime('now'));
