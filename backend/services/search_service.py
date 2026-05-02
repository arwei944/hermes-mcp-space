"""
统一搜索服务 — jieba 分词 + FTS5 全文检索
支持单类搜索和跨类统一搜索
"""

import jieba
import sqlite3
import re
from typing import Optional, List, Dict, Any

from backend.db import get_knowledge_db, HERMES_HOME


class SearchService:
    """统一搜索服务"""

    # FTS 表名映射
    FTS_TABLES = {
        "rules": "rules_fts",
        "knowledge": "knowledge_fts",
        "experiences": "experiences_fts",
        "memories": "memories_fts",
    }

    # FTS 表字段映射（用于 snippet）
    FTS_COLUMNS = {
        "rules": "title, content",
        "knowledge": "title, content, summary",
        "experiences": "title, content, context",
        "memories": "title, content",
    }

    def __init__(self):
        self.conn = get_knowledge_db()
        # 初始化 jieba
        jieba.initialize()
        custom_dict = HERMES_HOME / "data" / "jieba_custom.dict"
        if custom_dict.exists():
            jieba.load_userdict(str(custom_dict))

    def enhance_query(self, query: str) -> str:
        """
        jieba 搜索模式分词 + FTS5 查询构建

        策略：
        1. 使用 jieba.cut_for_search 进行细粒度分词
        2. 过滤掉单字和停用词
        3. 用 OR 连接提高召回率
        4. 对原始查询也保留（支持精确匹配）
        """
        # 停用词列表
        stop_words = {"的", "了", "是", "在", "我", "有", "和", "就", "不", "人",
                      "都", "一", "一个", "上", "也", "很", "到", "说", "要", "去",
                      "你", "会", "着", "没有", "看", "好", "自己", "这"}
        words = [w for w in jieba.cut_for_search(query)
                 if len(w.strip()) > 1 and w.strip() not in stop_words]
        if not words:
            return query
        # 组合：原始查询 OR 分词结果
        return " OR ".join(f'"{w}"' for w in words)

    def search_single_type(self, table_type: str, query: str,
                           filters: dict = None, limit: int = 20) -> List[dict]:
        """
        搜索单一类别的知识

        Args:
            table_type: rules/knowledge/experiences/memories
            query: 搜索关键词
            filters: 过滤条件 {category, is_active, tags, ...}
            limit: 返回数量上限

        Returns:
            [{id, title, snippet, score, type, ...}, ...]
        """
        fts_table = self.FTS_TABLES.get(table_type)
        if not fts_table:
            return []

        enhanced_q = self.enhance_query(query)

        # 构建 SQL
        sql = f"""
            SELECT
                t.id, t.title,
                snippet({fts_table}, 2, '<mark>', '</mark>', '...', 32) as snippet,
                rank as score
            FROM {fts_table} f
            JOIN {table_type} t ON t.rowid = f.rowid
            WHERE {fts_table} MATCH ?
        """
        params = [enhanced_q]

        # 添加过滤条件
        if filters:
            if filters.get("is_active") is not None:
                sql += " AND t.is_active = ?"
                params.append(1 if filters["is_active"] else 0)
            if filters.get("category"):
                sql += " AND t.category = ?"
                params.append(filters["category"])

        sql += f" ORDER BY score LIMIT ?"
        params.append(limit)

        try:
            cursor = self.conn.execute(sql, params)
            results = []
            for row in cursor.fetchall():
                d = dict(row)
                d["type"] = table_type
                results.append(d)
            return results
        except Exception as e:
            # FTS 查询失败时回退到 LIKE 查询
            return self._fallback_search(table_type, query, limit)

    def _fallback_search(self, table_type: str, query: str, limit: int) -> List[dict]:
        """FTS 查询失败时的 LIKE 回退搜索"""
        sql = f"SELECT id, title, content as snippet, 0 as score FROM {table_type} WHERE is_active=1 AND (title LIKE ? OR content LIKE ?) LIMIT ?"
        params = [f"%{query}%", f"%{query}%", limit]
        cursor = self.conn.execute(sql, params)
        results = []
        for row in cursor.fetchall():
            d = dict(row)
            d["type"] = table_type
            # 截取 snippet
            if len(d["snippet"]) > 200:
                d["snippet"] = d["snippet"][:200] + "..."
            results.append(d)
        return results

    def search_unified(self, query: str, types: List[str] = None,
                       limit: int = 30) -> List[dict]:
        """
        跨类统一搜索

        Args:
            query: 搜索关键词
            types: 搜索类型过滤 [rule, knowledge, experience, memory]
            limit: 返回数量上限

        Returns:
            [{type, id, title, snippet, score, category}, ...]
        """
        enhanced_q = self.enhance_query(query)

        sql = """
            SELECT
                u.type, u.ref_id as id, u.title,
                snippet(unified_fts, 3, '<mark>', '</mark>', '...', 32) as snippet,
                rank as score, u.category
            FROM unified_fts f
            JOIN unified_fts_content u ON u.rowid = f.rowid
            WHERE unified_fts MATCH ?
        """
        params: list = [enhanced_q]

        if types:
            placeholders = ",".join("?" * len(types))
            sql += f" AND u.type IN ({placeholders})"
            params.extend(types)

        sql += " ORDER BY score LIMIT ?"
        params.append(limit)

        try:
            cursor = self.conn.execute(sql, params)
            return [dict(row) for row in cursor.fetchall()]
        except Exception:
            # 回退到逐表搜索
            all_results = []
            search_types = types or ["rule", "knowledge", "experience", "memory"]
            table_map = {"rule": "rules", "knowledge": "knowledge",
                        "experience": "experiences", "memory": "memories"}
            for t in search_types:
                table = table_map.get(t)
                if table:
                    results = self.search_single_type(table, query, limit=limit // len(search_types))
                    all_results.extend(results)
            # 按分数排序
            all_results.sort(key=lambda x: x.get("score", 0))
            return all_results[:limit]

    def rebuild_all_indexes(self):
        """重建所有 FTS 索引"""
        for table_type, fts_table in self.FTS_TABLES.items():
            try:
                # 重建 FTS 索引
                self.conn.execute(f"INSERT INTO {fts_table}({fts_table}) VALUES ('rebuild')")
                self.conn.commit()
            except Exception as e:
                print(f"重建 {fts_table} 失败: {e}")

        # 重建统一搜索索引
        try:
            self.conn.execute("DELETE FROM unified_fts_content")
            self.conn.execute("INSERT INTO unified_fts(unified_fts) VALUES ('rebuild')")
            self.conn.commit()
        except Exception as e:
            print(f"重建 unified_fts 失败: {e}")

    def get_search_suggestions(self, prefix: str, limit: int = 10) -> List[str]:
        """获取搜索建议（前缀匹配）"""
        suggestions = []
        for table_type in ["rules", "knowledge", "experiences", "memories"]:
            sql = f"SELECT DISTINCT title FROM {table_type} WHERE is_active=1 AND title LIKE ? LIMIT ?"
            try:
                cursor = self.conn.execute(sql, (f"{prefix}%", limit))
                for row in cursor.fetchall():
                    suggestions.append(row["title"])
            except Exception:
                pass
        return list(set(suggestions))[:limit]
