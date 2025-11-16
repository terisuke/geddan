"""
DanceFrame Backend API
FastAPI application with Celery task queue for video processing
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import redis.asyncio as redis
import logging
from pathlib import Path

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

    try:
        # Connect to Redis
        redis_url = "redis://redis:6379/0"  # Docker service name
        redis_client = await redis.from_url(
            redis_url,
            encoding="utf-8",
            decode_responses=True
        )
        await redis_client.ping()
        logger.info("✅ Connected to Redis")
    except Exception as e:
        logger.error(f"❌ Failed to connect to Redis: {e}")
        # Continue without Redis for local development
        redis_client = None

    # Create necessary directories
    for dir_path in ["uploads", "outputs"]:
        Path(dir_path).mkdir(exist_ok=True)
    logger.info("📁 Created upload/output directories")

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
