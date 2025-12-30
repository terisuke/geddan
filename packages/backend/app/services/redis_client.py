"""
Redis client with connection retry logic and optimized settings.

Features:
- Exponential backoff retry (max 3 attempts)
- Connection pooling with configurable limits
- Socket timeout settings
- Comprehensive error logging
- Pipeline support for batch operations
- Optional caching layer for frequently accessed data
"""

import logging
import os
import time
from functools import wraps
from typing import Optional, Callable, TypeVar, Any, List, Dict
from contextlib import contextmanager

import redis
from redis.exceptions import ConnectionError, TimeoutError, RedisError

logger = logging.getLogger(__name__)

# Type variable for generic retry decorator
T = TypeVar("T")

# Configuration constants
DEFAULT_MAX_RETRIES = 3
DEFAULT_BASE_DELAY = 0.5  # 500ms
DEFAULT_MAX_DELAY = 4.0   # 4 seconds
DEFAULT_SOCKET_TIMEOUT = 5.0  # 5 seconds
DEFAULT_SOCKET_CONNECT_TIMEOUT = 3.0  # 3 seconds
DEFAULT_POOL_MAX_CONNECTIONS = 20  # Increased from 10 for better concurrency
DEFAULT_HEALTH_CHECK_INTERVAL = 30  # seconds

# Cache configuration
ENABLE_LOCAL_CACHE = os.getenv("REDIS_LOCAL_CACHE", "true").lower() == "true"
LOCAL_CACHE_TTL = int(os.getenv("REDIS_LOCAL_CACHE_TTL", "60"))  # seconds
LOCAL_CACHE_MAX_SIZE = int(os.getenv("REDIS_LOCAL_CACHE_SIZE", "1000"))  # items


class RedisClientConfig:
    """Configuration for Redis client"""

    def __init__(
        self,
        max_retries: int = DEFAULT_MAX_RETRIES,
        base_delay: float = DEFAULT_BASE_DELAY,
        max_delay: float = DEFAULT_MAX_DELAY,
        socket_timeout: float = DEFAULT_SOCKET_TIMEOUT,
        socket_connect_timeout: float = DEFAULT_SOCKET_CONNECT_TIMEOUT,
        max_connections: int = DEFAULT_POOL_MAX_CONNECTIONS,
        health_check_interval: int = DEFAULT_HEALTH_CHECK_INTERVAL,
    ):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.socket_timeout = socket_timeout
        self.socket_connect_timeout = socket_connect_timeout
        self.max_connections = max_connections
        self.health_check_interval = health_check_interval


def get_redis_url() -> str:
    """
    Build Redis URL from environment variables

    Priority:
    1. REDIS_URL (full URL)
    2. REDIS_HOST + REDIS_PORT (individual components)

    Returns:
        Redis connection URL string
    """
    redis_url = os.getenv("REDIS_URL")
    if redis_url:
        return redis_url

    redis_host = os.getenv("REDIS_HOST", "localhost")
    redis_port = os.getenv("REDIS_PORT", "6379")
    redis_db = os.getenv("REDIS_DB", "0")

    return f"redis://{redis_host}:{redis_port}/{redis_db}"


def with_retry(
    max_retries: int = DEFAULT_MAX_RETRIES,
    base_delay: float = DEFAULT_BASE_DELAY,
    max_delay: float = DEFAULT_MAX_DELAY,
    retryable_exceptions: tuple = (ConnectionError, TimeoutError),
) -> Callable:
    """
    Decorator for adding exponential backoff retry logic

    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay between retries (seconds)
        max_delay: Maximum delay between retries (seconds)
        retryable_exceptions: Tuple of exception types to retry on

    Returns:
        Decorated function with retry logic
    """
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @wraps(func)
        def wrapper(*args, **kwargs) -> T:
            last_exception = None

            for attempt in range(max_retries + 1):
                try:
                    return func(*args, **kwargs)
                except retryable_exceptions as e:
                    last_exception = e

                    if attempt < max_retries:
                        # Calculate delay with exponential backoff
                        delay = min(base_delay * (2 ** attempt), max_delay)

                        logger.warning(
                            f"Redis operation failed (attempt {attempt + 1}/{max_retries + 1}): {e}. "
                            f"Retrying in {delay:.2f}s..."
                        )
                        time.sleep(delay)
                    else:
                        logger.error(
                            f"Redis operation failed after {max_retries + 1} attempts: {e}"
                        )

            raise last_exception

        return wrapper
    return decorator


class RedisClientManager:
    """
    Manages Redis client connections with retry logic and connection pooling

    Features:
    - Singleton pattern per configuration
    - Connection pool management
    - Automatic reconnection on failure
    - Health check support
    """

    _instance: Optional["RedisClientManager"] = None
    _client: Optional[redis.Redis] = None
    _pool: Optional[redis.ConnectionPool] = None

    def __init__(self, config: Optional[RedisClientConfig] = None):
        self.config = config or RedisClientConfig()
        self._last_health_check = 0.0
        self._is_healthy = False

    @classmethod
    def get_instance(cls, config: Optional[RedisClientConfig] = None) -> "RedisClientManager":
        """Get or create singleton instance"""
        if cls._instance is None:
            cls._instance = cls(config)
        return cls._instance

    @classmethod
    def reset_instance(cls) -> None:
        """Reset singleton instance (for testing)"""
        if cls._instance and cls._client:
            try:
                cls._client.close()
            except Exception:
                pass
        cls._instance = None
        cls._client = None
        cls._pool = None

    def _create_connection_pool(self) -> redis.ConnectionPool:
        """
        Create optimized connection pool

        Returns:
            Configured Redis connection pool
        """
        redis_url = get_redis_url()

        pool = redis.ConnectionPool.from_url(
            redis_url,
            max_connections=self.config.max_connections,
            socket_timeout=self.config.socket_timeout,
            socket_connect_timeout=self.config.socket_connect_timeout,
            health_check_interval=self.config.health_check_interval,
            encoding="utf-8",
            decode_responses=True,
        )

        logger.info(
            f"Created Redis connection pool: "
            f"max_connections={self.config.max_connections}, "
            f"socket_timeout={self.config.socket_timeout}s, "
            f"connect_timeout={self.config.socket_connect_timeout}s"
        )

        return pool

    @with_retry()
    def _connect(self) -> redis.Redis:
        """
        Establish connection to Redis with retry logic

        Returns:
            Connected Redis client

        Raises:
            ConnectionError: If connection fails after all retries
        """
        if RedisClientManager._pool is None:
            RedisClientManager._pool = self._create_connection_pool()

        client = redis.Redis(connection_pool=RedisClientManager._pool)

        # Verify connection
        client.ping()

        redis_url = get_redis_url()
        # Mask password in URL for logging
        masked_url = redis_url
        if "@" in redis_url:
            parts = redis_url.split("@")
            masked_url = f"redis://****@{parts[-1]}"

        logger.info(f"Connected to Redis: {masked_url}")

        return client

    def get_client(self) -> Optional[redis.Redis]:
        """
        Get Redis client with automatic reconnection

        Returns:
            Redis client or None if connection fails
        """
        try:
            # Check if existing client is still valid
            if RedisClientManager._client is not None:
                try:
                    RedisClientManager._client.ping()
                    return RedisClientManager._client
                except (ConnectionError, TimeoutError) as e:
                    logger.warning(f"Existing Redis connection lost: {e}. Reconnecting...")
                    RedisClientManager._client = None
                    RedisClientManager._pool = None

            # Establish new connection
            RedisClientManager._client = self._connect()
            self._is_healthy = True
            return RedisClientManager._client

        except RedisError as e:
            logger.error(
                f"Failed to connect to Redis after {self.config.max_retries + 1} attempts: {e}"
            )
            self._is_healthy = False
            return None

    def is_healthy(self) -> bool:
        """
        Check if Redis connection is healthy

        Returns:
            True if connected and responsive
        """
        current_time = time.time()

        # Use cached result if within health check interval
        if current_time - self._last_health_check < self.config.health_check_interval:
            return self._is_healthy

        self._last_health_check = current_time

        client = self.get_client()
        if client is None:
            self._is_healthy = False
            return False

        try:
            client.ping()
            self._is_healthy = True
            return True
        except RedisError:
            self._is_healthy = False
            return False

    def execute_with_retry(
        self,
        operation: Callable[[redis.Redis], T],
        operation_name: str = "operation",
    ) -> Optional[T]:
        """
        Execute a Redis operation with retry logic

        Args:
            operation: Callable that takes Redis client and returns result
            operation_name: Name of operation for logging

        Returns:
            Operation result or None if failed
        """
        client = self.get_client()
        if client is None:
            logger.warning(f"Redis not available, cannot execute {operation_name}")
            return None

        last_exception = None

        for attempt in range(self.config.max_retries + 1):
            try:
                return operation(client)
            except (ConnectionError, TimeoutError) as e:
                last_exception = e

                if attempt < self.config.max_retries:
                    delay = min(
                        self.config.base_delay * (2 ** attempt),
                        self.config.max_delay
                    )

                    logger.warning(
                        f"Redis {operation_name} failed (attempt {attempt + 1}/"
                        f"{self.config.max_retries + 1}): {e}. Retrying in {delay:.2f}s..."
                    )

                    # Reset connection for next attempt
                    RedisClientManager._client = None
                    RedisClientManager._pool = None

                    time.sleep(delay)

                    # Try to reconnect
                    client = self.get_client()
                    if client is None:
                        break
                else:
                    logger.error(
                        f"Redis {operation_name} failed after "
                        f"{self.config.max_retries + 1} attempts: {e}"
                    )
            except RedisError as e:
                logger.error(f"Redis {operation_name} failed with non-retryable error: {e}")
                return None

        return None


# Module-level convenience functions

_manager: Optional[RedisClientManager] = None


def get_redis_manager(config: Optional[RedisClientConfig] = None) -> RedisClientManager:
    """
    Get the Redis client manager singleton

    Args:
        config: Optional configuration (only used on first call)

    Returns:
        RedisClientManager instance
    """
    global _manager
    if _manager is None:
        _manager = RedisClientManager.get_instance(config)
    return _manager


def get_redis_client() -> Optional[redis.Redis]:
    """
    Get Redis client with retry logic (convenience function)

    This replaces the simple get_redis_client() in analyze_video.py
    with a robust version that includes:
    - Connection pooling
    - Exponential backoff retry (max 3 attempts)
    - Socket timeouts
    - Automatic reconnection

    Returns:
        Redis client or None if unavailable
    """
    manager = get_redis_manager()
    return manager.get_client()


def execute_redis_operation(
    operation: Callable[[redis.Redis], T],
    operation_name: str = "operation",
) -> Optional[T]:
    """
    Execute a Redis operation with full retry logic

    Args:
        operation: Callable that takes Redis client and returns result
        operation_name: Name for logging purposes

    Returns:
        Operation result or None if failed

    Example:
        result = execute_redis_operation(
            lambda client: client.hgetall("key"),
            "get_job_status"
        )
    """
    manager = get_redis_manager()
    return manager.execute_with_retry(operation, operation_name)


def check_redis_health() -> bool:
    """
    Check if Redis is healthy and responsive.

    Returns:
        True if Redis is available and responding to ping.
    """
    manager = get_redis_manager()
    return manager.is_healthy()


# ============================================================================
# Pipeline and Batch Operations
# ============================================================================


class RedisPipeline:
    """
    Context manager for Redis pipeline operations.

    Pipelines batch multiple Redis commands into a single network round trip,
    significantly improving performance for bulk operations.

    Example:
        with RedisPipeline() as pipe:
            pipe.set("key1", "value1")
            pipe.set("key2", "value2")
            pipe.hset("hash", mapping={"a": "1", "b": "2"})
            results = pipe.execute()
    """

    def __init__(self, transaction: bool = False):
        """
        Initialize pipeline context.

        Args:
            transaction: If True, execute commands atomically (MULTI/EXEC).
        """
        self.transaction = transaction
        self._pipe: Optional[redis.client.Pipeline] = None
        self._client: Optional[redis.Redis] = None

    def __enter__(self) -> Optional[redis.client.Pipeline]:
        """Enter pipeline context."""
        self._client = get_redis_client()
        if self._client is None:
            logger.warning("Redis not available, pipeline operations will be skipped")
            return None

        self._pipe = self._client.pipeline(transaction=self.transaction)
        return self._pipe

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Exit pipeline context."""
        # Pipeline cleanup is automatic
        self._pipe = None
        return False  # Don't suppress exceptions


@contextmanager
def redis_pipeline(transaction: bool = False):
    """
    Context manager for Redis pipeline operations.

    Args:
        transaction: If True, execute commands atomically.

    Yields:
        Redis pipeline object or None if Redis unavailable.

    Example:
        with redis_pipeline() as pipe:
            if pipe:
                pipe.set("key1", "value1")
                pipe.set("key2", "value2")
                results = pipe.execute()
    """
    client = get_redis_client()
    if client is None:
        logger.warning("Redis not available, pipeline operations will be skipped")
        yield None
        return

    pipe = client.pipeline(transaction=transaction)
    try:
        yield pipe
    finally:
        # Ensure any pending commands are executed
        pass


def execute_batch_operations(
    operations: List[Callable[[redis.client.Pipeline], None]],
    operation_name: str = "batch_operation",
) -> Optional[List[Any]]:
    """
    Execute multiple Redis operations in a single pipeline.

    Args:
        operations: List of callables that add commands to a pipeline.
        operation_name: Name for logging.

    Returns:
        List of results from pipeline.execute(), or None on failure.

    Example:
        results = execute_batch_operations([
            lambda p: p.set("key1", "value1"),
            lambda p: p.get("key2"),
            lambda p: p.hgetall("hash"),
        ], "update_job_status")
    """
    client = get_redis_client()
    if client is None:
        logger.warning(f"Redis not available, cannot execute {operation_name}")
        return None

    try:
        with client.pipeline(transaction=False) as pipe:
            for op in operations:
                op(pipe)
            return pipe.execute()
    except RedisError as e:
        logger.error(f"Redis {operation_name} failed: {e}")
        return None


# ============================================================================
# Local Cache Layer
# ============================================================================


class LocalCache:
    """
    Simple in-memory cache with TTL for reducing Redis round trips.

    Used for frequently accessed, slowly changing data like job status.
    Thread-safe using simple dict operations (Python GIL).
    """

    def __init__(
        self,
        max_size: int = LOCAL_CACHE_MAX_SIZE,
        default_ttl: int = LOCAL_CACHE_TTL,
    ):
        """
        Initialize local cache.

        Args:
            max_size: Maximum number of cached items.
            default_ttl: Default time-to-live in seconds.
        """
        self._cache: Dict[str, tuple] = {}  # key -> (value, expiry_time)
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._enabled = ENABLE_LOCAL_CACHE

    def get(self, key: str) -> Optional[Any]:
        """
        Get value from cache if exists and not expired.

        Args:
            key: Cache key.

        Returns:
            Cached value or None if not found/expired.
        """
        if not self._enabled:
            return None

        entry = self._cache.get(key)
        if entry is None:
            return None

        value, expiry = entry
        if time.time() > expiry:
            # Expired, remove from cache
            self._cache.pop(key, None)
            return None

        return value

    def set(self, key: str, value: Any, ttl: Optional[int] = None) -> None:
        """
        Store value in cache with TTL.

        Args:
            key: Cache key.
            value: Value to cache.
            ttl: Time-to-live in seconds (uses default if not specified).
        """
        if not self._enabled:
            return

        # Simple LRU: remove oldest entries if at capacity
        if len(self._cache) >= self._max_size:
            # Remove ~10% of entries (oldest by expiry)
            entries = sorted(self._cache.items(), key=lambda x: x[1][1])
            for k, _ in entries[: self._max_size // 10]:
                self._cache.pop(k, None)

        expiry = time.time() + (ttl if ttl is not None else self._default_ttl)
        self._cache[key] = (value, expiry)

    def delete(self, key: str) -> None:
        """Remove key from cache."""
        self._cache.pop(key, None)

    def clear(self) -> None:
        """Clear all cached entries."""
        self._cache.clear()

    def invalidate_pattern(self, pattern: str) -> int:
        """
        Invalidate all keys matching pattern (simple prefix match).

        Args:
            pattern: Key prefix to match.

        Returns:
            Number of invalidated entries.
        """
        keys_to_remove = [k for k in self._cache if k.startswith(pattern)]
        for key in keys_to_remove:
            self._cache.pop(key, None)
        return len(keys_to_remove)


# Global cache instance
_local_cache = LocalCache()


def get_cached(
    key: str,
    fetch_func: Callable[[], Optional[T]],
    ttl: Optional[int] = None,
) -> Optional[T]:
    """
    Get value from local cache or fetch from Redis.

    Args:
        key: Cache key.
        fetch_func: Function to call if cache miss.
        ttl: Cache TTL in seconds.

    Returns:
        Cached or fetched value, or None if unavailable.

    Example:
        def fetch_job_status():
            return execute_redis_operation(
                lambda c: c.hgetall(f"job:{job_id}:state"),
                "get_job_status"
            )

        status = get_cached(f"status:{job_id}", fetch_job_status, ttl=5)
    """
    # Try local cache first
    cached = _local_cache.get(key)
    if cached is not None:
        return cached

    # Fetch from Redis
    value = fetch_func()
    if value is not None:
        _local_cache.set(key, value, ttl)

    return value


def invalidate_cache(key: str) -> None:
    """Invalidate a specific cache key."""
    _local_cache.delete(key)


def invalidate_cache_pattern(pattern: str) -> int:
    """
    Invalidate all cache keys matching pattern.

    Returns:
        Number of invalidated entries.
    """
    return _local_cache.invalidate_pattern(pattern)
