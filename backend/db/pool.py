# -*- coding: utf-8 -*-
"""
SQLite 连接池 — 线程安全，自动重连，健康检查
"""

import sqlite3
import queue
import logging
import threading
from typing import Optional
from contextlib import contextmanager

logger = logging.getLogger("hermes-mcp")


class ConnectionPool:
    """SQLite 连接池"""

    def __init__(self, db_path: str, pool_size: int = 5, timeout: int = 30):
        self._db_path = db_path
        self._pool_size = pool_size
        self._timeout = timeout
        self._pool: queue.Queue = queue.Queue(maxsize=pool_size)
        self._lock = threading.Lock()
        self._created = 0
        self._initialize_pool()

    def _create_conn(self) -> sqlite3.Connection:
        """创建新的数据库连接"""
        conn = sqlite3.connect(self._db_path, timeout=self._timeout, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA synchronous=NORMAL")
        conn.execute("PRAGMA cache_size=-64000")
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.execute("PRAGMA foreign_keys=ON")
        with self._lock:
            self._created += 1
        return conn

    def _initialize_pool(self):
        """初始化连接池"""
        for _ in range(self._pool_size):
            try:
                self._pool.put(self._create_conn(), timeout=5)
            except Exception as e:
                logger.error(f"初始化连接池失败: {e}")
        logger.info(f"连接池初始化: {self._pool.qsize()}/{self._pool_size} 连接就绪")

    def acquire(self, timeout: float = 5.0) -> sqlite3.Connection:
        """获取连接（带健康检查和自动重连）"""
        try:
            conn = self._pool.get(timeout=timeout)
        except queue.Empty:
            logger.warning("连接池耗尽，创建新连接")
            return self._create_conn()

        # 健康检查 — 自愈核心
        try:
            conn.execute("SELECT 1")
            return conn
        except Exception:
            logger.warning("连接已失效，自动重建")
            try:
                conn.close()
            except Exception:
                pass
            return self._create_conn()

    def release(self, conn: sqlite3.Connection):
        """释放连接回池"""
        try:
            conn.rollback()
            self._pool.put(conn, timeout=1)
        except queue.Full:
            conn.close()
        except Exception as e:
            logger.warning(f"释放连接失败: {e}")
            try:
                conn.close()
            except Exception:
                pass

    @contextmanager
    def connection(self):
        """上下文管理器 — 自动获取和释放连接"""
        conn = self.acquire()
        try:
            yield conn
        finally:
            self.release(conn)

    def health_check(self) -> dict:
        """连接池健康检查"""
        available = self._pool.qsize()
        return {
            "pool_size": self._pool_size,
            "available": available,
            "in_use": self._pool_size - available,
            "total_created": self._created,
            "status": "healthy" if available > 0 else "degraded",
        }

    def close_all(self):
        """关闭所有连接"""
        closed = 0
        while not self._pool.empty():
            try:
                conn = self._pool.get_nowait()
                conn.close()
                closed += 1
            except Exception:
                pass
        logger.info(f"连接池已关闭: {closed} 个连接")
