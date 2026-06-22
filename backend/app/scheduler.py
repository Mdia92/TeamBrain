"""Application scheduler — APScheduler for event-driven loops."""

from __future__ import annotations

import structlog
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.db.session import SessionLocal
from app.events.worker import (
    job_commitment_reminders,
    job_field_report_gap_alerts,
    job_overdue_task_alerts,
)
from app.events.pattern_job import job_pattern_promotion

log = structlog.get_logger("teambrain.scheduler")
scheduler = AsyncIOScheduler()


async def _run_overdue() -> None:
    async with SessionLocal() as session:
        count = await job_overdue_task_alerts(session)
        log.info("scheduler_overdue", count=count)


async def _run_commitments() -> None:
    async with SessionLocal() as session:
        count = await job_commitment_reminders(session)
        log.info("scheduler_commitments", count=count)


async def _run_field_gaps() -> None:
    async with SessionLocal() as session:
        count = await job_field_report_gap_alerts(session)
        log.info("scheduler_field_gaps", count=count)


async def _run_patterns() -> None:
    async with SessionLocal() as session:
        count = await job_pattern_promotion(session)
        log.info("scheduler_patterns", count=count)


def start_scheduler() -> None:
    if scheduler.running:
        return
    scheduler.add_job(_run_overdue, "interval", hours=6, id="overdue_tasks")
    scheduler.add_job(_run_commitments, "cron", hour=8, minute=0, id="commitment_reminders")
    scheduler.add_job(_run_field_gaps, "cron", day_of_week="mon", hour=7, minute=0, id="field_report_gaps")
    scheduler.add_job(_run_patterns, "cron", day_of_week="sun", hour=3, minute=0, id="pattern_promotion")
    scheduler.start()
    log.info("scheduler_started")


def stop_scheduler() -> None:
    if scheduler.running:
        scheduler.shutdown(wait=False)
