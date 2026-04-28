# -*- coding: utf-8 -*-
"""Hermes Agent - 插件系统服务

提供插件的安装、卸载、列表查询以及工具/技能/记忆的聚合功能。

插件目录结构:
    ~/.hermes/plugins/
        plugin-a/
            plugin.json          # 插件元数据
            tools/               # 可选，工具定义 (tools/*.json)
            skills/              # 可选，技能文件 (skills/*.md)
            memory/              # 可选，记忆模板 (memory/*.md)
        plugin-b/
            ...
    ~/.hermes/plugins/installed.json  # 安装记录
"""

import json
import logging
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = logging.getLogger("hermes-mcp")


def get_plugins_dir() -> Path:
    """获取插件根目录 ~/.hermes/plugins/"""
    from backend.config import get_hermes_home
    plugins_dir = get_hermes_home() / "plugins"
    plugins_dir.mkdir(parents=True, exist_ok=True)
    return plugins_dir


def _get_installed_json_path() -> Path:
    """获取 installed.json 路径"""
    return get_plugins_dir() / "installed.json"


def _load_installed() -> Dict[str, Any]:
    """加载 installed.json"""
    path = _get_installed_json_path()
    if path.exists():
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except Exception:
            pass
    return {"plugins": []}


def _save_installed(data: Dict[str, Any]) -> bool:
    """保存 installed.json"""
    try:
        path = _get_installed_json_path()
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return True
    except Exception as e:
        logger.error(f"保存 installed.json 失败: {e}")
        return False


def _load_plugin_meta(plugin_dir: Path) -> Optional[Dict[str, Any]]:
    """加载单个插件的 plugin.json 元数据"""
    meta_path = plugin_dir / "plugin.json"
    if not meta_path.exists():
        return None
    try:
        return json.loads(meta_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.warning(f"加载插件元数据失败 ({meta_path}): {e}")
        return None


def _validate_source(source: str) -> bool:
    """验证 Git URL 格式是否合法"""
    # 支持 https://, git://, ssh://, git@host:user/repo.git 等格式
    patterns = [
        r'^https?://[^\s]+\.git$',
        r'^https?://[^\s]+$',
        r'^git://[^\s]+$',
        r'^ssh://[^\s]+$',
        r'^git@[^\s]+:[^\s]+$',
    ]
    return any(re.match(p, source) for p in patterns)


# ==================== 公开 API ====================


def list_plugins() -> List[Dict[str, Any]]:
    """列出所有已安装插件

    Returns:
        插件列表，每个元素包含 name, version, author, description, type,
        path, installed_at 等字段。
    """
    plugins_dir = get_plugins_dir()
    installed_data = _load_installed()
    installed_map = {
        p["name"]: p for p in installed_data.get("plugins", [])
    }

    result: List[Dict[str, Any]] = []

    # 遍历插件目录（排除 installed.json）
    if not plugins_dir.exists():
        return result

    for item in plugins_dir.iterdir():
        if not item.is_dir():
            continue
        meta = _load_plugin_meta(item)
        if meta is None:
            continue

        name = meta.get("name", item.name)
        installed_info = installed_map.get(name, {})
        result.append({
            "name": name,
            "version": meta.get("version", "unknown"),
            "author": meta.get("author", "unknown"),
            "description": meta.get("description", ""),
            "type": meta.get("type", "tool"),
            "path": str(item),
            "installed_at": installed_info.get("installed_at", ""),
        })

    return result


def install_plugin(source: str) -> Dict[str, Any]:
    """从 Git URL 安装插件

    Args:
        source: Git 仓库地址

    Returns:
        {"success": True/False, "message": "...", "plugin": {...}}
    """
    if not source or not source.strip():
        return {"success": False, "message": "source 不能为空"}

    source = source.strip()

    # 去除末尾的 .git 以提取仓库名
    repo_name = source.rstrip("/").split("/")[-1]
    if repo_name.endswith(".git"):
        repo_name = repo_name[:-4]

    # 安全性检查：防止路径注入
    if not re.match(r'^[a-zA-Z0-9_\-.]+$', repo_name):
        return {
            "success": False,
            "message": f"仓库名 '{repo_name}' 不合法，只能包含字母、数字、下划线、连字符和点",
        }

    plugins_dir = get_plugins_dir()
    target_dir = plugins_dir / repo_name

    # 检查是否已安装
    if target_dir.exists():
        # 检查是否有 plugin.json
        existing_meta = _load_plugin_meta(target_dir)
        existing_name = existing_meta.get("name", repo_name) if existing_meta else repo_name
        return {
            "success": False,
            "message": f"插件 '{existing_name}' 已安装（目录 {repo_name} 已存在）",
        }

    # 执行 git clone
    try:
        logger.info(f"正在克隆插件: {source} -> {target_dir}")
        result = subprocess.run(
            ["git", "clone", "--depth", "1", source, str(target_dir)],
            capture_output=True,
            text=True,
            timeout=120,
        )

        if result.returncode != 0:
            stderr = result.stderr.strip()
            logger.error(f"git clone 失败: {stderr}")
            # 清理可能创建的不完整目录
            if target_dir.exists():
                shutil.rmtree(target_dir, ignore_errors=True)
            return {
                "success": False,
                "message": f"git clone 失败: {stderr}",
            }
    except subprocess.TimeoutExpired:
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        return {"success": False, "message": "git clone 超时（120秒）"}
    except FileNotFoundError:
        return {"success": False, "message": "系统未安装 git，请先安装 git"}
    except Exception as e:
        if target_dir.exists():
            shutil.rmtree(target_dir, ignore_errors=True)
        return {"success": False, "message": f"安装失败: {str(e)}"}

    # 验证 plugin.json
    meta = _load_plugin_meta(target_dir)
    if meta is None:
        shutil.rmtree(target_dir, ignore_errors=True)
        return {
            "success": False,
            "message": f"插件目录中未找到有效的 plugin.json",
        }

    plugin_name = meta.get("name", repo_name)
    plugin_version = meta.get("version", "unknown")

    # 记录到 installed.json
    installed_data = _load_installed()
    plugins_list = installed_data.get("plugins", [])

    # 如果同名插件已存在，先移除旧记录
    plugins_list = [p for p in plugins_list if p.get("name") != plugin_name]

    plugins_list.append({
        "name": plugin_name,
        "version": plugin_version,
        "source": source,
        "installed_at": datetime.now().isoformat(),
    })
    installed_data["plugins"] = plugins_list
    _save_installed(installed_data)

    logger.info(f"插件安装成功: {plugin_name} v{plugin_version}")

    return {
        "success": True,
        "message": f"插件 '{plugin_name}' 安装成功",
        "plugin": {
            "name": plugin_name,
            "version": plugin_version,
            "author": meta.get("author", "unknown"),
            "description": meta.get("description", ""),
            "type": meta.get("type", "tool"),
            "path": str(target_dir),
        },
    }


def uninstall_plugin(name: str) -> Dict[str, Any]:
    """卸载插件

    Args:
        name: 插件名称（plugin.json 中的 name 字段）

    Returns:
        {"success": True/False, "message": "..."}
    """
    if not name or not name.strip():
        return {"success": False, "message": "插件名称不能为空"}

    name = name.strip()

    # 安全性检查
    if not re.match(r'^[a-zA-Z0-9_\-.]+$', name):
        return {"success": False, "message": f"插件名称 '{name}' 不合法"}

    plugins_dir = get_plugins_dir()

    # 查找插件目录
    target_dir = None
    if not plugins_dir.exists():
        return {"success": False, "message": f"插件 '{name}' 不存在"}

    for item in plugins_dir.iterdir():
        if not item.is_dir():
            continue
        meta = _load_plugin_meta(item)
        if meta and meta.get("name") == name:
            target_dir = item
            break

    if target_dir is None:
        return {"success": False, "message": f"插件 '{name}' 不存在"}

    # 删除插件目录
    try:
        shutil.rmtree(target_dir)
    except Exception as e:
        return {"success": False, "message": f"删除插件目录失败: {str(e)}"}

    # 从 installed.json 移除记录
    installed_data = _load_installed()
    plugins_list = installed_data.get("plugins", [])
    installed_data["plugins"] = [p for p in plugins_list if p.get("name") != name]
    _save_installed(installed_data)

    logger.info(f"插件已卸载: {name}")

    return {"success": True, "message": f"插件 '{name}' 已卸载"}


def get_plugin_tools() -> List[Dict[str, Any]]:
    """获取所有插件定义的工具

    扫描所有已安装插件的 tools/ 子目录，读取其中的 *.json 文件，
    合并返回工具定义列表。每个工具定义会附加 plugin_name 字段。

    Returns:
        工具定义列表，格式符合 MCP inputSchema 规范
    """
    plugins_dir = get_plugins_dir()
    tools: List[Dict[str, Any]] = []

    if not plugins_dir.exists():
        return tools

    for plugin_item in plugins_dir.iterdir():
        if not plugin_item.is_dir():
            continue

        meta = _load_plugin_meta(plugin_item)
        if meta is None:
            continue

        plugin_name = meta.get("name", plugin_item.name)
        tools_dir = plugin_item / "tools"

        if not tools_dir.is_dir():
            continue

        for tool_file in sorted(tools_dir.glob("*.json")):
            try:
                tool_def = json.loads(tool_file.read_text(encoding="utf-8"))
                if not isinstance(tool_def, dict):
                    continue
                if not tool_def.get("name"):
                    continue
                # 附加插件来源信息
                tool_def["plugin_name"] = plugin_name
                tool_def["source"] = "plugin"
                tools.append(tool_def)
            except Exception as e:
                logger.warning(f"加载工具定义失败 ({tool_file}): {e}")

    return tools


def get_plugin_skills() -> List[Dict[str, Any]]:
    """获取所有插件的技能

    扫描所有已安装插件的 skills/ 子目录，读取其中的 *.md 文件。

    Returns:
        技能列表，每个元素包含 name, plugin_name, content, path
    """
    plugins_dir = get_plugins_dir()
    skills: List[Dict[str, Any]] = []

    if not plugins_dir.exists():
        return skills

    for plugin_item in plugins_dir.iterdir():
        if not plugin_item.is_dir():
            continue

        meta = _load_plugin_meta(plugin_item)
        if meta is None:
            continue

        plugin_name = meta.get("name", plugin_item.name)
        skills_dir = plugin_item / "skills"

        if not skills_dir.is_dir():
            continue

        for skill_file in sorted(skills_dir.glob("*.md")):
            try:
                content = skill_file.read_text(encoding="utf-8")
                skill_name = skill_file.stem
                skills.append({
                    "name": skill_name,
                    "plugin_name": plugin_name,
                    "description": _extract_first_line(content),
                    "content": content,
                    "path": str(skill_file),
                    "format": "file",
                    "source": "plugin",
                })
            except Exception as e:
                logger.warning(f"加载技能文件失败 ({skill_file}): {e}")

    return skills


def get_plugin_memory() -> str:
    """获取所有插件的记忆模板

    扫描所有已安装插件的 memory/ 子目录，读取其中的 *.md 文件，
    合并为一个字符串返回。

    Returns:
        合并后的记忆模板 Markdown 字符串
    """
    plugins_dir = get_plugins_dir()
    memory_parts: List[str] = []

    if not plugins_dir.exists():
        return ""

    for plugin_item in plugins_dir.iterdir():
        if not plugin_item.is_dir():
            continue

        meta = _load_plugin_meta(plugin_item)
        if meta is None:
            continue

        plugin_name = meta.get("name", plugin_item.name)
        memory_dir = plugin_item / "memory"

        if not memory_dir.is_dir():
            continue

        for mem_file in sorted(memory_dir.glob("*.md")):
            try:
                content = mem_file.read_text(encoding="utf-8").strip()
                if content:
                    memory_parts.append(
                        f"<!-- Plugin: {plugin_name} / {mem_file.name} -->\n{content}"
                    )
            except Exception as e:
                logger.warning(f"加载记忆模板失败 ({mem_file}): {e}")

    return "\n\n---\n\n".join(memory_parts)


# ==================== 内部工具函数 ====================


def _extract_first_line(text: str) -> str:
    """从 Markdown 文本中提取第一行非空、非标题行作为简短描述"""
    for line in text.split("\n"):
        line = line.strip()
        if line and not line.startswith("#"):
            return line[:200]
    return ""


# ==================== 服务类 ====================


class PluginService:
    """插件系统服务类（面向对象的封装）

    提供与模块级函数相同的接口，方便依赖注入和测试。
    """

    def list_plugins(self) -> List[Dict[str, Any]]:
        """列出所有已安装插件"""
        return list_plugins()

    def install_plugin(self, source: str) -> Dict[str, Any]:
        """从 Git URL 安装插件"""
        return install_plugin(source)

    def uninstall_plugin(self, name: str) -> Dict[str, Any]:
        """卸载插件"""
        return uninstall_plugin(name)

    def get_plugin_tools(self) -> List[Dict[str, Any]]:
        """获取所有插件定义的工具"""
        return get_plugin_tools()

    def get_plugin_skills(self) -> List[Dict[str, Any]]:
        """获取所有插件的技能"""
        return get_plugin_skills()

    def get_plugin_memory(self) -> str:
        """获取所有插件的记忆模板"""
        return get_plugin_memory()


# ==================== 全局实例（供外部引用） ====================

plugin_service = PluginService()
