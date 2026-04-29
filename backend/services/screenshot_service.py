# -*- coding: utf-8 -*-
"""截图服务 — 使用 Playwright 截取网页截图

截图文件保存到 ~/.hermes/data/screenshots/ 目录。
元数据保存到 ~/.hermes/data/screenshots.json。
"""

import asyncio
import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

logger = None


def _get_logger():
    global logger
    if logger is None:
        import logging
        logger = logging.getLogger("screenshot_service")
    return logger


class ScreenshotService:
    """网页截图服务"""

    def __init__(self):
        self._data_dir = Path(os.environ.get("HERMES_HOME", os.path.expanduser("~/.hermes"))) / "data"
        self._screenshots_dir = self._data_dir / "screenshots"
        self._meta_file = self._data_dir / "screenshots.json"
        self._screenshots_dir.mkdir(parents=True, exist_ok=True)

    def _load_meta(self) -> List[Dict[str, Any]]:
        """加载截图元数据"""
        if not self._meta_file.exists():
            return []
        try:
            return json.loads(self._meta_file.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            return []

    def _save_meta(self, items: List[Dict[str, Any]]) -> None:
        """保存截图元数据"""
        self._data_dir.mkdir(parents=True, exist_ok=True)
        self._meta_file.write_text(json.dumps(items, ensure_ascii=False, indent=2), encoding="utf-8")

    async def capture(
        self,
        url: str,
        width: int = 1280,
        height: int = 720,
        full_page: bool = False,
    ) -> Dict[str, Any]:
        """截取网页截图"""
        log = _get_logger()
        log.info(f"开始截图: {url} ({width}x{height}, full_page={full_page})")

        try:
            from playwright.async_api import async_playwright
        except ImportError:
            # 回退到 httpx + html2image 方案
            return await self._capture_fallback(url, width, height, full_page)

        filename = f"screenshot_{int(time.time())}.png"
        filepath = self._screenshots_dir / filename

        try:
            async with async_playwright() as p:
                browser = await p.chromium.launch(headless=True)
                page = await browser.new_page(viewport={"width": width, "height": height})
                await page.goto(url, wait_until="networkidle", timeout=30000)
                await page.screenshot(path=str(filepath), full_page=full_page)
                await browser.close()

            # 保存元数据
            meta = self._load_meta()
            meta.insert(0, {
                "filename": filename,
                "url": url,
                "width": width,
                "height": height,
                "full_page": full_page,
                "size": filepath.stat().st_size,
                "created_at": datetime.now().isoformat(),
            })
            # 最多保留 50 条
            meta = meta[:50]
            self._save_meta(meta)

            log.info(f"截图完成: {filename} ({filepath.stat().st_size} bytes)")
            return {"success": True, "filename": filename, "url": url, "size": filepath.stat().st_size}

        except Exception as e:
            log.error(f"截图失败: {e}")
            return {"success": False, "error": str(e)}

    async def _capture_fallback(
        self, url: str, width: int, height: int, full_page: bool
    ) -> Dict[str, Any]:
        """回退方案：使用 httpx 获取页面信息（不截图，返回提示）"""
        import httpx

        log = _get_logger()
        log.warning("Playwright 未安装，使用回退方案（仅记录 URL）")

        filename = f"screenshot_{int(time.time())}.json"
        filepath = self._screenshots_dir / filename

        try:
            async with httpx.AsyncClient(timeout=15) as client:
                resp = await client.get(url, follow_redirects=True)
                resp.raise_for_status()

            meta = self._load_meta()
            meta.insert(0, {
                "filename": filename,
                "url": url,
                "width": width,
                "height": height,
                "full_page": full_page,
                "status_code": resp.status_code,
                "content_length": len(resp.content),
                "created_at": datetime.now().isoformat(),
                "note": "Playwright 未安装，仅记录页面信息",
            })
            meta = meta[:50]
            self._save_meta(meta)

            return {"success": True, "filename": filename, "url": url, "note": "Playwright 未安装，仅记录页面信息"}

        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_all(self) -> List[Dict[str, Any]]:
        """列出所有截图元数据"""
        return self._load_meta()

    def get_info(self, filename: str) -> Optional[Dict[str, Any]]:
        """获取截图详情"""
        for item in self._load_meta():
            if item.get("filename") == filename:
                return item
        return None

    def delete(self, filename: str) -> Dict[str, Any]:
        """删除截图文件和元数据"""
        meta = self._load_meta()
        meta = [m for m in meta if m.get("filename") != filename]
        self._save_meta(meta)

        filepath = self._screenshots_dir / filename
        if filepath.exists():
            filepath.unlink()

        return {"success": True, "deleted": filename}


screenshot_service = ScreenshotService()
