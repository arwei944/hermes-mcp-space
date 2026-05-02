# -*- coding: utf-8 -*-
"""Hermes Agent 管理面板 - 技能管理服务

从 HermesService 中提取的技能相关方法，包括：
- 技能 CRUD（支持目录和文件两种格式）
- YAML frontmatter 解析
- 插件技能集成
- 条件激活（根据可用工具集过滤）
"""

import json
import re
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import get_skills_dir


class SkillService:
    """技能管理服务

    所有方法都是同步的，返回 dict 或 list。
    支持目录格式（skills/{name}/SKILL.md）和文件格式（skills/{name}.md）。
    """

    def __init__(self):
        pass

    def list_skills(self, available_tools: list = None) -> List[Dict[str, Any]]:
        """列出所有技能（支持目录和文件两种格式，含插件技能）"""
        skills_dir = get_skills_dir()
        if not skills_dir.exists():
            skills = []
        else:
            skills = []
            # 格式1: 目录结构 skills/{name}/SKILL.md
            for item in skills_dir.iterdir():
                if item.is_dir():
                    skill_md = item / "SKILL.md"
                    meta = self._read_skill_meta(item.name)
                    skills.append({
                        "name": item.name,
                        "description": meta.get("description") or self._read_skill_description(skill_md),
                        "tags": meta.get("tags", []),
                        "category": meta.get("category", ""),
                        "version": meta.get("version", ""),
                        "has_skill_md": skill_md.exists(),
                        "path": str(item),
                        "format": "directory",
                        "source": "builtin",
                    })
            # 格式2: 文件结构 skills/{name}.md
            for item in skills_dir.iterdir():
                if item.is_file() and item.suffix == ".md":
                    name = item.stem
                    if any(s["name"] == name for s in skills):
                        continue
                    meta = self._read_skill_meta(name)
                    skills.append({
                        "name": name,
                        "description": meta.get("description") or self._read_skill_description(item),
                        "tags": meta.get("tags", []),
                        "category": meta.get("category", ""),
                        "version": meta.get("version", ""),
                        "has_skill_md": True,
                        "path": str(item),
                        "format": "file",
                        "source": "builtin",
                    })

        # 合并插件提供的技能
        try:
            from backend.services.plugin_service import get_plugin_skills
            plugin_skills = get_plugin_skills()
            for ps in plugin_skills:
                # 避免同名覆盖
                if any(s["name"] == ps["name"] for s in skills):
                    # 插件技能加前缀避免冲突
                    ps["name"] = f"{ps['plugin_name']}__{ps['name']}"
                skills.append({
                    "name": ps["name"],
                    "description": ps.get("description", ""),
                    "has_skill_md": True,
                    "path": ps.get("path", ""),
                    "format": "file",
                    "source": "plugin",
                    "plugin_name": ps.get("plugin_name", ""),
                })
        except Exception:
            pass

        # 条件激活：根据可用工具集过滤
        if available_tools is not None:
            available_set = set(available_tools)
            filtered = []
            for skill in skills:
                meta = self._read_skill_meta(skill["name"])
                requires = meta.get("requires_toolsets", [])
                fallback_for = meta.get("fallback_for_toolsets", [])

                # 如果技能没有条件要求，始终显示
                if not requires and not fallback_for:
                    filtered.append(skill)
                    continue

                # 检查 requires：所有必需的工具集都必须可用
                if requires:
                    # requires 中的工具名需要在 available_tools 中存在
                    # 支持 "terminal" 映射到 ["shell_execute", "read_file", "write_file"] 等
                    toolset_map = {
                        "terminal": ["shell_execute", "read_file", "write_file", "list_directory", "search_files"],
                        "web": ["web_search", "web_fetch"],
                        "mcp": ["add_mcp_server", "remove_mcp_server", "list_mcp_servers"],
                        "memory": ["read_memory", "write_memory"],
                        "skills": ["list_skills", "create_skill", "update_skill", "delete_skill"],
                    }
                    required_tools = set()
                    for ts in requires:
                        required_tools.update(toolset_map.get(ts, [ts]))

                    if required_tools.issubset(available_set):
                        filtered.append(skill)
                    continue

                # 检查 fallback_for：当指定工具集不可用时显示
                if fallback_for:
                    toolset_map = {
                        "terminal": ["shell_execute", "read_file", "write_file", "list_directory", "search_files"],
                        "web": ["web_search", "web_fetch"],
                        "mcp": ["add_mcp_server", "remove_mcp_server", "list_mcp_servers"],
                        "memory": ["read_memory", "write_memory"],
                        "skills": ["list_skills", "create_skill", "update_skill", "delete_skill"],
                    }
                    fallback_tools = set()
                    for ts in fallback_for:
                        fallback_tools.update(toolset_map.get(ts, [ts]))

                    if not fallback_tools.issubset(available_set):
                        filtered.append(skill)
                    continue

                filtered.append(skill)

            skills = filtered

        return skills

    def get_skill(self, name: str) -> Optional[Dict[str, Any]]:
        """获取技能详情（支持目录和文件两种格式）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file = skills_dir / f"{name}.md"

        content = ""
        files = []
        fmt = "unknown"

        if skill_dir.is_dir():
            fmt = "directory"
            skill_md = skill_dir / "SKILL.md"
            if skill_md.exists():
                content = skill_md.read_text(encoding="utf-8")
            for f in skill_dir.rglob("*"):
                if f.is_file():
                    files.append(str(f.relative_to(skill_dir)))
        elif skill_file.is_file():
            fmt = "file"
            content = skill_file.read_text(encoding="utf-8")
            files.append(f"{name}.md")
        else:
            return None

        return {"name": name, "content": content, "files": files, "format": fmt}

    def create_skill(self, name: str, content: str = "", description: str = "", tags: list = None) -> Dict[str, Any]:
        """创建新技能（目录格式：skills/{name}/SKILL.md）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file_legacy = skills_dir / f"{name}.md"

        if skill_dir.exists() or skill_file_legacy.exists():
            return {"success": False, "message": f"技能 '{name}' 已存在"}

        try:
            # 使用目录格式 skills/{name}/SKILL.md
            skill_dir.mkdir(parents=True, exist_ok=True)
            skill_file = skill_dir / "SKILL.md"
            if not content:
                content = f"# {name}\n\n{description or '技能描述'}"
            elif description and not content.startswith(f"# {name}"):
                content = f"# {name}\n\n> {description}\n\n{content}"
            skill_file.write_text(content, encoding="utf-8")
            # 保存元数据
            if tags or description:
                meta_file = skills_dir / f"{name}.meta.json"
                meta = {"description": description, "tags": tags or []}
                meta_file.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
            return {"success": True, "message": f"技能 '{name}' 创建成功", "name": name, "id": name, "skill": {"id": name, "name": name, "description": description, "tags": tags or []}}
        except Exception as e:
            return {"success": False, "message": f"创建失败: {str(e)}"}

    def update_skill(self, name: str, content: str = "", description: str = "", tags: list = None) -> Dict[str, Any]:
        """更新技能（支持目录和文件两种格式）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file = skills_dir / f"{name}.md"

        try:
            if skill_dir.is_dir():
                (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
            elif skill_file.is_file():
                skill_file.write_text(content, encoding="utf-8")
            else:
                return {"success": False, "message": f"技能 '{name}' 不存在"}
            # 更新元数据
            if tags is not None or description:
                meta_file = skills_dir / f"{name}.meta.json"
                meta = {}
                if meta_file.exists():
                    try:
                        meta = json.loads(meta_file.read_text(encoding="utf-8"))
                    except Exception:
                        pass
                if description:
                    meta["description"] = description
                if tags is not None:
                    meta["tags"] = tags
                meta_file.write_text(json.dumps(meta, ensure_ascii=False), encoding="utf-8")
            return {"success": True, "message": f"技能 '{name}' 更新成功", "name": name}
        except Exception as e:
            return {"success": False, "message": f"更新失败: {str(e)}"}

    def delete_skill(self, name: str) -> Dict[str, Any]:
        """删除技能（支持目录和文件两种格式）"""
        skills_dir = get_skills_dir()
        skill_dir = skills_dir / name
        skill_file = skills_dir / f"{name}.md"

        try:
            if skill_dir.is_dir():
                import shutil
                shutil.rmtree(skill_dir)
            elif skill_file.is_file():
                skill_file.unlink()
            else:
                return {"success": False, "message": f"技能 '{name}' 不存在"}
            # 删除元数据文件
            meta_file = skills_dir / f"{name}.meta.json"
            if meta_file.exists():
                meta_file.unlink()
            return {"success": True, "message": f"技能 '{name}' 已删除", "name": name}
        except Exception as e:
            return {"success": False, "message": f"删除失败: {str(e)}"}

    def _read_skill_meta(self, name: str) -> dict:
        """读取技能元数据（优先 frontmatter，其次 meta.json）"""
        meta = {}

        # 优先从 SKILL.md 的 YAML frontmatter 解析
        skill_file = get_skills_dir() / f"{name}.md"
        skill_dir = get_skills_dir() / name
        if skill_dir.is_dir():
            skill_file = skill_dir / "SKILL.md"

        if skill_file.exists():
            try:
                text = skill_file.read_text(encoding="utf-8")
                match = re.match(r'^---\s*\n(.*?)\n---', text, re.DOTALL)
                if match:
                    import yaml
                    try:
                        fm = yaml.safe_load(match.group(1))
                        if isinstance(fm, dict):
                            meta = fm
                    except Exception:
                        # 简单解析 key: value
                        for line in match.group(1).split("\n"):
                            if ":" in line:
                                k, v = line.split(":", 1)
                                meta[k.strip()] = v.strip()
            except Exception:
                pass

        # 合并 meta.json
        meta_file = get_skills_dir() / f"{name}.meta.json"
        if meta_file.exists():
            try:
                file_meta = json.loads(meta_file.read_text(encoding="utf-8"))
                # meta.json 补充 frontmatter 没有的字段
                for k, v in file_meta.items():
                    if k not in meta:
                        meta[k] = v
            except Exception:
                pass

        return meta

    def _read_skill_description(self, skill_md: Path) -> str:
        """从 SKILL.md 中提取简短描述"""
        if not skill_md.exists():
            return ""
        try:
            text = skill_md.read_text(encoding="utf-8")
            # 取第一行非空内容作为描述
            for line in text.split("\n"):
                line = line.strip()
                if line and not line.startswith("#"):
                    return line[:200]
            return ""
        except Exception:
            return ""
