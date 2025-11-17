"""
DanceFrame Backend API
FastAPI application with Celery task queue for video processing
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import redis.asyncio as redis
import logging
import os
from pathlib import Path

# Import routers
from app.routers import upload, analyze

# Base directory: absolute path to packages/backend
# This ensures paths are independent of uvicorn's working directory
BASE_DIR = Path(__file__).resolve().parent.parent

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global Redis client
redis_client = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan events for startup and shutdown
    """
    global redis_client

    # Startup
    logger.info("🚀 Starting DanceFrame API...")

    # Check if Redis is required or optional
    redis_optional = os.getenv("REDIS_OPTIONAL", "true").lower() in ("true", "1", "yes")
    debug_mode = os.getenv("DEBUG", "false").lower() in ("true", "1", "yes")

    # In DEBUG mode, Redis is always optional
    if debug_mode:
        redis_optional = True
        logger.info("🐛 DEBUG mode enabled - Redis is optional")

    try:
        # Connect to Redis
        # 環境変数REDIS_URLがあれば使用、なければREDIS_HOST/REDIS_PORTから構築
        # Docker環境ではREDIS_URL、ローカル開発ではREDIS_HOST/Redisポートを設定可能
        redis_url = os.getenv("REDIS_URL")
        if not redis_url:
            redis_host = os.getenv("REDIS_HOST", "localhost")
            redis_port = os.getenv("REDIS_PORT", "6379")
            redis_url = f"redis://{redis_host}:{redis_port}/0"

        redis_client = await redis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True,
            socket_connect_timeout=2,  # 2秒でタイムアウト
        )
        await redis_client.ping()
        logger.info(f"✅ Connected to Redis at {redis_url}")
    except Exception as e:
        if redis_optional:
            logger.warning(f"⚠️  Redis not available (optional in dev mode): {e}")
            redis_client = None
        else:
            logger.error(f"❌ Failed to connect to Redis (required): {e}")
            raise RuntimeError(f"Redis connection required but failed: {e}")

    # Create necessary directories (using absolute paths from BASE_DIR)
    uploads_dir = BASE_DIR / "uploads"
    outputs_dir = BASE_DIR / "outputs"
    uploads_dir.mkdir(exist_ok=True)
    outputs_dir.mkdir(exist_ok=True)
    logger.info(f"📁 Created upload/output directories: {uploads_dir}, {outputs_dir}")

    yield

    # Shutdown
    if redis_client:
        await redis_client.close()
        logger.info("🔌 Disconnected from Redis")


# Create FastAPI application
app = FastAPI(
    title="DanceFrame API",
    description="AI-powered interactive video generation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(upload.router)
app.include_router(analyze.router)

# Mount static files for outputs (thumbnails)
# This allows serving files from /outputs/{job_id}/thumbnails/ via /outputs/...
# Uses absolute path from BASE_DIR to avoid dependency on uvicorn's working directory
outputs_dir = BASE_DIR / "outputs"
outputs_dir.mkdir(exist_ok=True)  # Ensure directory exists
app.mount("/outputs", StaticFiles(directory=str(outputs_dir)), name="outputs")


@app.get("/")
async def root():
    return {
        "service": "DanceFrame API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/health"
    }


@app.get("/health")
async def health_check():
    health = {"status": "healthy", "version": "1.0.0"}
    if redis_client:
        try:
            await redis_client.ping()
            health["redis"] = "connected"
        except:
            health["redis"] = "error"
            health["status"] = "degraded"
    else:
        health["redis"] = "not configured"
    return health
