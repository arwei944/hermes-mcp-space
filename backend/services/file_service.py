# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 文件系统操作服务

提供安全的文件系统操作，包括：
- 路径验证（防止目录穿越）
- 文件读写
- 目录遍历
"""

import os
from pathlib import Path
from typing import Dict, List, Optional


class FileService:
    """文件系统操作服务

    所有操作都经过路径安全验证，防止目录穿越攻击。
    """

    def __init__(self, base_dir: Optional[str] = None):
        """
        Args:
            base_dir: 允许操作的基础目录，默认为 Hermes 主目录
        """
        if base_dir:
            self._base_dir = Path(base_dir).resolve()
        else:
            from backend.config import get_hermes_home
            self._base_dir = get_hermes_home().resolve()

    def _validate_path(self, path: str) -> Optional[Path]:
        """
        验证路径安全性，防止目录穿越

        Args:
            path: 待验证的路径

        Returns:
            安全的绝对路径，如果不安全则返回 None
        """
        try:
            # 解析为绝对路径
            resolved = Path(path).resolve()
            # 确保路径在基础目录内
            if not str(resolved).startswith(str(self._base_dir)):
                return None
            return resolved
        except Exception:
            return None

    def read_file(self, path: str, encoding: str = "utf-8") -> Optional[str]:
        """
        安全地读取文件内容

        Args:
            path: 文件路径（相对于基础目录或绝对路径）
            encoding: 文件编码

        Returns:
            文件内容，如果读取失败返回 None
        """
        safe_path = self._validate_path(path)
        if not safe_path or not safe_path.is_file():
            return None
        try:
            return safe_path.read_text(encoding=encoding)
        except Exception:
            return None

    def write_file(self, path: str, content: str, encoding: str = "utf-8") -> bool:
        """
        安全地写入文件内容

        Args:
            path: 文件路径
            content: 要写入的内容
            encoding: 文件编码

        Returns:
            是否写入成功
        """
        safe_path = self._validate_path(path)
        if not safe_path:
            return False
        try:
            safe_path.parent.mkdir(parents=True, exist_ok=True)
            safe_path.write_text(content, encoding=encoding)
            return True
        except Exception:
            return False

    def delete_file(self, path: str) -> bool:
        """
        安全地删除文件

        Args:
            path: 文件路径

        Returns:
            是否删除成功
        """
        safe_path = self._validate_path(path)
        if not safe_path or not safe_path.exists():
            return False
        try:
            if safe_path.is_file():
                safe_path.unlink()
            elif safe_path.is_dir():
                import shutil
                shutil.rmtree(safe_path)
            return True
        except Exception:
            return False

    def list_directory(self, path: str = "") -> List[Dict[str, str]]:
        """
        安全地列出目录内容

        Args:
            path: 目录路径（相对于基础目录）

        Returns:
            文件/目录信息列表
        """
        if path:
            safe_path = self._validate_path(path)
        else:
            safe_path = self._base_dir

        if not safe_path or not safe_path.is_dir():
            return []

        result = []
        try:
            for item in safe_path.iterdir():
                result.append({
                    "name": item.name,
                    "path": str(item),
                    "type": "directory" if item.is_dir() else "file",
                    "size": item.stat().st_size if item.is_file() else 0,
                })
        except Exception:
            pass
        return result

    def exists(self, path: str) -> bool:
        """检查路径是否存在"""
        safe_path = self._validate_path(path)
        return safe_path is not None and safe_path.exists()

    def is_file(self, path: str) -> bool:
        """检查路径是否为文件"""
        safe_path = self._validate_path(path)
        return safe_path is not None and safe_path.is_file()

    def is_dir(self, path: str) -> bool:
        """检查路径是否为目录"""
        safe_path = self._validate_path(path)
        return safe_path is not None and safe_path.is_dir()


# 全局文件服务实例
file_service = FileService()
