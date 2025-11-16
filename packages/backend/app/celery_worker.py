"""
Celery worker configuration for DanceFrame backend

Handles asynchronous video processing tasks:
- Frame extraction
- Perceptual hashing (pHash)
- Frame clustering
- Thumbnail generation
"""

import os
from celery import Celery
import logging

logger = logging.getLogger(__name__)

# Get configuration from environment variables
REDIS_URL = os.getenv("REDIS_URL")
if not REDIS_URL:
    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = os.getenv("REDIS_PORT", "6379")
    REDIS_URL = f"redis://{redis_host}:{redis_port}/0"

CELERY_BROKER_URL = os.getenv("CELERY_BROKER_URL", REDIS_URL)
CELERY_RESULT_BACKEND = os.getenv("CELERY_RESULT_BACKEND", REDIS_URL)

# Create Celery app
celery_app = Celery(
    "danceframe",
    broker=CELERY_BROKER_URL,
    backend=CELERY_RESULT_BACKEND,
    include=["app.tasks.analyze_video"],  # Auto-discover tasks
)

# Celery configuration
celery_app.conf.update(
    # Task settings
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,

    # Task execution
    task_track_started=True,
    task_time_limit=int(os.getenv("TASK_TIME_LIMIT", 600)),  # 10 minutes default
    task_soft_time_limit=int(os.getenv("TASK_SOFT_TIME_LIMIT", 540)),  # 9 minutes default

    # Worker settings
    worker_prefetch_multiplier=1,  # Only fetch one task at a time
    worker_max_tasks_per_child=50,  # Restart worker after 50 tasks (prevent memory leaks)

    # Result backend settings
    result_expires=86400,  # Results expire after 24 hours
    result_persistent=True,  # Store results persistently

    # Task routing
    task_routes={
        "tasks.analyze_video": {"queue": "video_analysis"},
        "tasks.generate_video": {"queue": "video_generation"},
    },

    # Retry settings
    task_acks_late=True,  # Acknowledge task after completion (enables retry on failure)
    task_reject_on_worker_lost=True,  # Reject task if worker crashes
)

logger.info(f"Celery configured with broker: {CELERY_BROKER_URL}")

if __name__ == "__main__":
    celery_app.start()
