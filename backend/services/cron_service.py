# -*- coding: utf-8 -*-
"""定时任务管理服务

从 HermesService 提取的定时任务相关方法，包括：
- jobs.json 读写
- CRUD 操作
- 手动触发
"""

import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.config import get_cron_dir


class CronService:
    """定时任务管理服务

    管理基于 jobs.json 的定时任务 CRUD 操作。
    """

    def __init__(self):
        pass

    def _get_jobs_path(self) -> Path:
        """获取定时任务 JSON 文件路径"""
        cron_dir = get_cron_dir()
        cron_dir.mkdir(parents=True, exist_ok=True)
        return cron_dir / "jobs.json"

    def _load_jobs(self) -> List[Dict[str, Any]]:
        """加载定时任务列表"""
        jobs_path = self._get_jobs_path()
        if not jobs_path.exists():
            return []
        try:
            return json.loads(jobs_path.read_text(encoding="utf-8"))
        except Exception:
            return []

    def _save_jobs(self, jobs: List[Dict[str, Any]]) -> bool:
        """保存定时任务列表"""
        try:
            self._get_jobs_path().write_text(
                json.dumps(jobs, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            return True
        except Exception:
            return False

    def list_cron_jobs(self) -> List[Dict[str, Any]]:
        """列出所有定时任务"""
        return self._load_jobs()

    def get_cron_job(self, job_id: str) -> Optional[Dict[str, Any]]:
        """获取单个定时任务"""
        jobs = self._load_jobs()
        for job in jobs:
            if job.get("id") == job_id:
                return job
        return None

    def create_cron_job(self, job: Dict[str, Any]) -> Dict[str, Any]:
        """创建定时任务"""
        jobs = self._load_jobs()
        job_id = job.get("id", f"job-{datetime.now().strftime('%Y%m%d%H%M%S%f')}")
        job["id"] = job_id
        job["created_at"] = datetime.now().isoformat()
        job["status"] = job.get("status", "active")
        jobs.append(job)
        if self._save_jobs(jobs):
            # 重新加载调度器
            try:
                from backend.services.cron_scheduler import reload_scheduler
                reload_scheduler()
            except Exception:
                pass
            return {"success": True, "message": "任务创建成功", "job": job}
        return {"success": False, "message": "保存任务失败"}

    def update_cron_job(self, job_id: str, updates: Dict[str, Any]) -> Dict[str, Any]:
        """更新定时任务"""
        jobs = self._load_jobs()
        for i, job in enumerate(jobs):
            if job.get("id") == job_id:
                job.update(updates)
                job["updated_at"] = datetime.now().isoformat()
                jobs[i] = job
                if self._save_jobs(jobs):
                    try:
                        from backend.services.cron_scheduler import reload_scheduler
                        reload_scheduler()
                    except Exception:
                        pass
                    return {"success": True, "message": "任务更新成功", "job": job}
                return {"success": False, "message": "保存任务失败"}
        return {"success": False, "message": f"任务 {job_id} 不存在"}

    def delete_cron_job(self, job_id: str) -> Dict[str, Any]:
        """删除定时任务（支持 job_id 或任务名称）"""
        jobs = self._load_jobs()
        new_jobs = [j for j in jobs if j.get("id") != job_id and j.get("name") != job_id]
        if len(new_jobs) == len(jobs):
            return {"success": False, "message": f"任务 {job_id} 不存在"}
        if self._save_jobs(new_jobs):
            try:
                from backend.services.cron_scheduler import reload_scheduler
                reload_scheduler()
            except Exception:
                pass
            return {"success": True, "message": f"任务 {job_id} 已删除"}
        return {"success": False, "message": "保存任务失败"}

    def get_cron_job_output(self, job_id: str) -> Optional[Dict[str, Any]]:
        """获取任务输出"""
        cron_dir = get_cron_dir()
        output_path = cron_dir / f"{job_id}.log"
        if not output_path.exists():
            return None
        try:
            content = output_path.read_text(encoding="utf-8")
            return {
                "job_id": job_id,
                "output": content,
                "output_path": str(output_path),
            }
        except Exception:
            return None

    def trigger_cron_job(self, job_id: str) -> Dict[str, Any]:
        """手动触发定时任务"""
        jobs = self._load_jobs()
        for job in jobs:
            if job.get("id") == job_id:
                job["last_triggered"] = datetime.now().isoformat()
                if self._save_jobs(jobs):
                    return {"success": True, "message": f"任务 {job_id} 已触发", "job": job}
                return {"success": False, "message": "保存任务失败"}
        return {"success": False, "message": f"任务 {job_id} 不存在"}


# 全局单例
cron_service = CronService()
