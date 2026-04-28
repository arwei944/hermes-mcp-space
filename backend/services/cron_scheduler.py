# -*- coding: utf-8 -*-
"""
Cron 定时任务调度引擎
使用 APScheduler 实现真正的定时执行。
"""

import logging
import subprocess
from datetime import datetime
from pathlib import Path

logger = logging.getLogger("hermes-mcp")

_scheduler = None


def start_scheduler():
    """启动定时任务调度器，加载所有已启用的任务"""
    global _scheduler
    if _scheduler is not None:
        return

    from apscheduler.schedulers.background import BackgroundScheduler
    from apscheduler.triggers.cron import CronTrigger

    _scheduler = BackgroundScheduler(daemon=True)

    # 加载所有已启用的定时任务
    try:
        from backend.services.hermes_service import hermes_service
        jobs = hermes_service.list_cron_jobs()
        loaded = 0
        for job in jobs:
            if job.get("enabled", True) and job.get("schedule"):
                try:
                    schedule = job.get("schedule", "")
                    # 支持标准 cron 表达式
                    parts = schedule.strip().split()
                    if len(parts) >= 5:
                        trigger = CronTrigger(
                            minute=parts[0],
                            hour=parts[1],
                            day=parts[2],
                            month=parts[3],
                            day_of_week=parts[4],
                        )
                        _scheduler.add_job(
                            _execute_job,
                            trigger=trigger,
                            id=job["id"],
                            name=job.get("name", job["id"]),
                            args=[job["id"]],
                            replace_existing=True,
                        )
                        loaded += 1
                except Exception as e:
                    logger.warning(f"加载定时任务 {job.get('id')} 失败: {e}")
        logger.info(f"Cron scheduler loaded {loaded} jobs")
    except Exception as e:
        logger.warning(f"加载定时任务失败: {e}")

    _scheduler.start()
    logger.info("Cron scheduler started")


def reload_scheduler():
    """重新加载所有定时任务（创建/删除/更新后调用）"""
    global _scheduler
    if _scheduler is None:
        start_scheduler()
        return

    # 移除所有现有 job
    for job in _scheduler.get_jobs():
        try:
            _scheduler.remove_job(job.id)
        except Exception:
            pass

    # 重新加载
    try:
        from backend.services.hermes_service import hermes_service
        jobs = hermes_service.list_cron_jobs()
        for job in jobs:
            if job.get("enabled", True) and job.get("schedule"):
                try:
                    from apscheduler.triggers.cron import CronTrigger
                    parts = job.get("schedule", "").strip().split()
                    if len(parts) >= 5:
                        trigger = CronTrigger(
                            minute=parts[0],
                            hour=parts[1],
                            day=parts[2],
                            month=parts[3],
                            day_of_week=parts[4],
                        )
                        _scheduler.add_job(
                            _execute_job,
                            trigger=trigger,
                            id=job["id"],
                            name=job.get("name", job["id"]),
                            args=[job["id"]],
                            replace_existing=True,
                        )
                except Exception as e:
                    logger.warning(f"重载定时任务 {job.get('id')} 失败: {e}")
    except Exception as e:
        logger.warning(f"重载定时任务失败: {e}")

    logger.info("Cron scheduler reloaded")


def stop_scheduler():
    """停止调度器"""
    global _scheduler
    if _scheduler:
        _scheduler.shutdown(wait=False)
        _scheduler = None
        logger.info("Cron scheduler stopped")


def _execute_job(job_id: str):
    """执行单个定时任务"""
    from backend.services.hermes_service import hermes_service
    from backend.config import get_cron_dir

    job = hermes_service.get_cron_job(job_id)
    if not job:
        logger.warning(f"定时任务 {job_id} 不存在")
        return

    command = job.get("command", "")
    if not command:
        logger.warning(f"定时任务 {job_id} 没有命令")
        return

    cron_dir = get_cron_dir()
    cron_dir.mkdir(parents=True, exist_ok=True)
    log_path = cron_dir / f"{job_id}.log"

    start_time = datetime.now()
    logger.info(f"执行定时任务: {job.get('name', job_id)} (command: {command[:80]})")

    try:
        result = subprocess.run(
            command, shell=True, capture_output=True, text=True, timeout=300,
        )
        exit_code = result.returncode
        stdout = result.stdout or ""
        stderr = result.stderr or ""

        # 写入日志
        log_entry = (
            f"=== 执行时间: {start_time.isoformat()} ===\n"
            f"=== 任务: {job.get('name', job_id)} ===\n"
            f"=== 命令: {command} ===\n"
            f"=== 退出码: {exit_code} ===\n"
        )
        if stdout:
            log_entry += f"\n--- stdout ---\n{stdout}\n"
        if stderr:
            log_entry += f"\n--- stderr ---\n{stderr}\n"
        log_entry += f"\n{'='*50}\n\n"

        # 追加到日志文件
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(log_entry)

        # 更新任务状态
        jobs = hermes_service.list_cron_jobs()
        for j in jobs:
            if j.get("id") == job_id:
                j["last_triggered"] = start_time.isoformat()
                j["last_status"] = "success" if exit_code == 0 else "failed"
                j["last_exit_code"] = exit_code
                hermes_service._save_jobs(jobs)
                break

        # 记录操作日志
        try:
            from backend.routers.logs import add_log
            status = "成功" if exit_code == 0 else f"失败(exit:{exit_code})"
            add_log("定时任务执行", job.get("name", job_id), status, "success" if exit_code == 0 else "error", "cron")
        except Exception:
            pass

        # SSE 事件
        try:
            from backend.routers.events import emit_event
            emit_event("cron.triggered", {"job_id": job_id, "name": job.get("name"), "status": "success" if exit_code == 0 else "failed"}, source="cron")
        except Exception:
            pass

        logger.info(f"定时任务 {job.get('name', job_id)} 执行完成: exit_code={exit_code}")

    except subprocess.TimeoutExpired:
        error_msg = f"任务超时（300秒）"
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n=== {start_time.isoformat()} === TIMEOUT: {error_msg}\n\n")
        logger.warning(f"定时任务 {job_id} 超时")
    except Exception as e:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(f"\n=== {start_time.isoformat()} === ERROR: {str(e)}\n\n")
        logger.error(f"定时任务 {job_id} 执行失败: {e}")
