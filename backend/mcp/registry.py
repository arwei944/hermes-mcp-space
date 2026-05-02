# -*- coding: utf-8 -*-
"""
工具注册中心 — 积木架构的核心
自动发现、注册、分发 MCP 工具调用
"""

import importlib
import logging
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional
from dataclasses import dataclass, field

logger = logging.getLogger("hermes-mcp")


@dataclass
class ToolDef:
    """工具定义"""
    name: str
    description: str
    input_schema: dict
    handler: Callable
    tags: List[str] = field(default_factory=list)
    enabled: bool = True


class ToolRegistry:
    """工具注册中心 — 自动发现 + 分发"""

    def __init__(self):
        self._tools: Dict[str, ToolDef] = {}
        self._load_errors: Dict[str, str] = {}

    def register(
        self,
        name: str,
        description: str,
        schema: dict,
        handler: Callable,
        tags: Optional[List[str]] = None,
    ):
        """注册一个工具"""
        self._tools[name] = ToolDef(
            name=name,
            description=description,
            input_schema=schema,
            handler=handler,
            tags=tags or [],
        )
        logger.info(f"工具注册: {name} [tags={tags or []}]")

    def unregister(self, name: str):
        """注销一个工具"""
        self._tools.pop(name, None)
        logger.info(f"工具注销: {name}")

    def discover(self, tools_dir: str = None):
        """
        自动扫描 tools/ 目录，加载所有工具模块
        支持：子目录模块 (group/xxx.py)
        """
        if tools_dir is None:
            tools_dir = str(Path(__file__).parent / "tools")

        tools_path = Path(tools_dir)
        if not tools_path.exists():
            logger.warning(f"工具目录不存在: {tools_path}")
            return

        loaded = 0
        # 扫描子目录中的工具模块
        for subdir in sorted(tools_path.iterdir()):
            if not subdir.is_dir() or subdir.name.startswith("_"):
                continue
            for file in sorted(subdir.glob("*.py")):
                if file.name.startswith("_"):
                    continue
                if self._load_module(subdir.name, file):
                    loaded += 1

        logger.info(f"工具发现完成: {loaded} 个工具加载成功, {len(self._load_errors)} 个失败")

    def _load_module(self, group: str, file: Path) -> bool:
        """加载单个工具模块，返回是否成功"""
        module_path = f"backend.mcp.tools.{group}.{file.stem}"
        try:
            module = importlib.import_module(module_path)
            if hasattr(module, "register"):
                module.register(self)
                return True
            else:
                logger.warning(f"模块缺少 register(): {module_path}")
                return False
        except Exception as e:
            error_msg = f"{type(e).__name__}: {e}"
            self._load_errors[module_path] = error_msg
            logger.error(f"工具模块加载失败: {module_path} — {error_msg}")
            return False

    def get_tools(self) -> List[dict]:
        """返回所有已注册工具的 MCP schema 列表（给 tools/list）"""
        result = []
        for tool in self._tools.values():
            if tool.enabled:
                result.append({
                    "name": tool.name,
                    "description": tool.description,
                    "inputSchema": tool.input_schema,
                })
        return result

    def call(self, name: str, arguments: dict) -> Any:
        """
        分发工具调用（给 tools/call）
        单个工具异常不影响其他工具 — 自愈核心
        """
        tool = self._tools.get(name)
        if not tool:
            raise ValueError(f"未知工具: {name}")
        if not tool.enabled:
            raise ValueError(f"工具已禁用: {name}")

        try:
            result = tool.handler(arguments)
            return result
        except Exception as e:
            logger.error(f"工具执行失败: {name} — {type(e).__name__}: {e}")
            raise

    def get_tool(self, name: str) -> Optional[ToolDef]:
        """获取单个工具定义"""
        return self._tools.get(name)

    def list_by_tag(self, tag: str) -> List[ToolDef]:
        """按标签筛选工具"""
        return [t for t in self._tools.values() if tag in t.tags]

    def get_load_errors(self) -> Dict[str, str]:
        """获取加载失败的模块"""
        return dict(self._load_errors)

    def stats(self) -> dict:
        """注册中心统计信息"""
        return {
            "total_tools": len(self._tools),
            "enabled_tools": sum(1 for t in self._tools.values() if t.enabled),
            "disabled_tools": sum(1 for t in self._tools.values() if not t.enabled),
            "load_errors": len(self._load_errors),
            "tags": list(set(t for tool in self._tools.values() for t in tool.tags)),
        }


# 全局单例
registry = ToolRegistry()
