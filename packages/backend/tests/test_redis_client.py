"""
Unit tests for Redis client module

Tests cover:
- Connection retry logic with exponential backoff
- Connection pool configuration
- Timeout handling
- Error logging
"""

import pytest
import time
from unittest.mock import Mock, patch, MagicMock
from redis.exceptions import ConnectionError, TimeoutError, RedisError

from app.services.redis_client import (
    RedisClientConfig,
    RedisClientManager,
    get_redis_url,
    with_retry,
    get_redis_client,
    execute_redis_operation,
    check_redis_health,
    get_redis_manager,
)


class TestRedisClientConfig:
    """Tests for RedisClientConfig"""

    def test_default_config(self):
        """Test default configuration values"""
        config = RedisClientConfig()

        assert config.max_retries == 3
        assert config.base_delay == 0.5
        assert config.max_delay == 4.0
        assert config.socket_timeout == 5.0
        assert config.socket_connect_timeout == 3.0
        assert config.max_connections == 10
        assert config.health_check_interval == 30

    def test_custom_config(self):
        """Test custom configuration"""
        config = RedisClientConfig(
            max_retries=5,
            base_delay=1.0,
            max_delay=8.0,
            socket_timeout=10.0,
            socket_connect_timeout=5.0,
            max_connections=20,
            health_check_interval=60,
        )

        assert config.max_retries == 5
        assert config.base_delay == 1.0
        assert config.max_delay == 8.0
        assert config.socket_timeout == 10.0
        assert config.socket_connect_timeout == 5.0
        assert config.max_connections == 20
        assert config.health_check_interval == 60


class TestGetRedisUrl:
    """Tests for get_redis_url function"""

    def test_redis_url_from_env(self):
        """Test REDIS_URL takes priority"""
        with patch.dict("os.environ", {"REDIS_URL": "redis://custom:6380/1"}):
            url = get_redis_url()
            assert url == "redis://custom:6380/1"

    def test_redis_url_from_host_port(self):
        """Test building URL from REDIS_HOST and REDIS_PORT"""
        with patch.dict(
            "os.environ",
            {"REDIS_HOST": "myredis", "REDIS_PORT": "6381", "REDIS_DB": "2"},
            clear=True,
        ):
            # Clear REDIS_URL if it exists
            import os
            if "REDIS_URL" in os.environ:
                del os.environ["REDIS_URL"]

            url = get_redis_url()
            assert url == "redis://myredis:6381/2"

    def test_redis_url_defaults(self):
        """Test default values when no env vars set"""
        with patch.dict("os.environ", {}, clear=True):
            url = get_redis_url()
            assert url == "redis://localhost:6379/0"


class TestWithRetryDecorator:
    """Tests for with_retry decorator"""

    def test_successful_execution_no_retry(self):
        """Test that successful execution doesn't trigger retry"""
        call_count = 0

        @with_retry(max_retries=3, base_delay=0.01)
        def success_func():
            nonlocal call_count
            call_count += 1
            return "success"

        result = success_func()

        assert result == "success"
        assert call_count == 1

    def test_retry_on_connection_error(self):
        """Test retry on ConnectionError"""
        call_count = 0

        @with_retry(max_retries=2, base_delay=0.01)
        def failing_then_success():
            nonlocal call_count
            call_count += 1
            if call_count < 3:
                raise ConnectionError("Connection failed")
            return "success"

        result = failing_then_success()

        assert result == "success"
        assert call_count == 3  # 2 retries + 1 success

    def test_retry_on_timeout_error(self):
        """Test retry on TimeoutError"""
        call_count = 0

        @with_retry(max_retries=1, base_delay=0.01)
        def timeout_func():
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                raise TimeoutError("Timeout")
            return "recovered"

        result = timeout_func()

        assert result == "recovered"
        assert call_count == 2

    def test_max_retries_exceeded(self):
        """Test that exception is raised after max retries"""
        call_count = 0

        @with_retry(max_retries=2, base_delay=0.01)
        def always_fails():
            nonlocal call_count
            call_count += 1
            raise ConnectionError("Always fails")

        with pytest.raises(ConnectionError):
            always_fails()

        assert call_count == 3  # Initial + 2 retries

    def test_exponential_backoff_timing(self):
        """Test that delays follow exponential backoff pattern"""
        times = []

        @with_retry(max_retries=2, base_delay=0.05, max_delay=1.0)
        def track_timing():
            times.append(time.time())
            raise ConnectionError("Fail")

        with pytest.raises(ConnectionError):
            track_timing()

        # Check delays (should be approximately 0.05s, then 0.1s)
        assert len(times) == 3
        delay1 = times[1] - times[0]
        delay2 = times[2] - times[1]

        # Allow some tolerance for timing
        assert 0.04 < delay1 < 0.15
        assert 0.08 < delay2 < 0.25

    def test_max_delay_cap(self):
        """Test that delay is capped at max_delay"""
        times = []

        @with_retry(max_retries=3, base_delay=0.5, max_delay=0.1)
        def track_timing():
            times.append(time.time())
            raise ConnectionError("Fail")

        with pytest.raises(ConnectionError):
            track_timing()

        # All delays should be capped at max_delay (0.1s)
        for i in range(1, len(times)):
            delay = times[i] - times[i - 1]
            assert delay < 0.2  # Should be around 0.1s


class TestRedisClientManager:
    """Tests for RedisClientManager"""

    def setup_method(self):
        """Reset singleton before each test"""
        RedisClientManager.reset_instance()

    def teardown_method(self):
        """Clean up after each test"""
        RedisClientManager.reset_instance()

    def test_singleton_pattern(self):
        """Test that get_instance returns same instance"""
        instance1 = RedisClientManager.get_instance()
        instance2 = RedisClientManager.get_instance()

        assert instance1 is instance2

    def test_reset_instance(self):
        """Test that reset_instance clears singleton"""
        instance1 = RedisClientManager.get_instance()
        RedisClientManager.reset_instance()
        instance2 = RedisClientManager.get_instance()

        assert instance1 is not instance2

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_get_client_creates_connection_pool(self, mock_redis, mock_pool):
        """Test that get_client creates connection pool with correct settings"""
        mock_pool_instance = Mock()
        mock_pool.return_value = mock_pool_instance

        mock_client = Mock()
        mock_redis.return_value = mock_client

        config = RedisClientConfig(
            max_connections=15,
            socket_timeout=7.0,
            socket_connect_timeout=4.0,
            health_check_interval=45,
        )

        manager = RedisClientManager(config)
        manager.get_client()

        mock_pool.assert_called_once()
        call_kwargs = mock_pool.call_args[1]

        assert call_kwargs["max_connections"] == 15
        assert call_kwargs["socket_timeout"] == 7.0
        assert call_kwargs["socket_connect_timeout"] == 4.0
        assert call_kwargs["health_check_interval"] == 45

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_get_client_reuses_connection(self, mock_redis, mock_pool):
        """Test that get_client reuses existing connection"""
        mock_pool_instance = Mock()
        mock_pool.return_value = mock_pool_instance

        mock_client = Mock()
        mock_redis.return_value = mock_client

        manager = RedisClientManager()

        client1 = manager.get_client()
        client2 = manager.get_client()

        assert client1 is client2
        # Redis should only be instantiated once
        assert mock_redis.call_count == 1

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_get_client_reconnects_on_failure(self, mock_redis, mock_pool):
        """Test that get_client reconnects when ping fails"""
        mock_pool.return_value = Mock()

        # First client works, then fails ping, then reconnect succeeds
        mock_client1 = Mock()
        mock_client2 = Mock()
        mock_client1.ping.side_effect = ConnectionError("Lost connection")
        mock_redis.side_effect = [mock_client1, mock_client2]

        manager = RedisClientManager()
        RedisClientManager._client = mock_client1
        RedisClientManager._pool = Mock()

        # Should detect failed ping and reconnect
        client = manager.get_client()

        assert client is mock_client2

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_execute_with_retry_success(self, mock_redis, mock_pool):
        """Test execute_with_retry on successful operation"""
        mock_pool.return_value = Mock()
        mock_client = Mock()
        mock_redis.return_value = mock_client

        manager = RedisClientManager()

        operation_calls = []

        def test_operation(client):
            operation_calls.append(client)
            return "result"

        result = manager.execute_with_retry(test_operation, "test_op")

        assert result == "result"
        assert len(operation_calls) == 1
        assert operation_calls[0] is mock_client

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_execute_with_retry_recovers(self, mock_redis, mock_pool):
        """Test execute_with_retry recovers from transient failure"""
        mock_pool.return_value = Mock()
        mock_client = Mock()
        mock_redis.return_value = mock_client

        config = RedisClientConfig(max_retries=2, base_delay=0.01)
        manager = RedisClientManager(config)

        call_count = 0

        def flaky_operation(client):
            nonlocal call_count
            call_count += 1
            if call_count < 2:
                raise ConnectionError("Transient failure")
            return "recovered"

        result = manager.execute_with_retry(flaky_operation, "flaky_op")

        assert result == "recovered"
        assert call_count == 2


class TestConvenienceFunctions:
    """Tests for module-level convenience functions"""

    def setup_method(self):
        """Reset state before each test"""
        RedisClientManager.reset_instance()
        import app.services.redis_client as rc
        rc._manager = None

    def teardown_method(self):
        """Clean up after each test"""
        RedisClientManager.reset_instance()
        import app.services.redis_client as rc
        rc._manager = None

    @patch("app.services.redis_client.RedisClientManager.get_client")
    def test_get_redis_client(self, mock_get_client):
        """Test get_redis_client convenience function"""
        mock_client = Mock()
        mock_get_client.return_value = mock_client

        result = get_redis_client()

        assert result is mock_client

    @patch("app.services.redis_client.RedisClientManager.execute_with_retry")
    @patch("app.services.redis_client.RedisClientManager.get_client")
    def test_execute_redis_operation(self, mock_get_client, mock_execute):
        """Test execute_redis_operation convenience function"""
        mock_execute.return_value = "op_result"

        def test_op(client):
            return "test"

        result = execute_redis_operation(test_op, "test_operation")

        mock_execute.assert_called_once_with(test_op, "test_operation")
        assert result == "op_result"

    @patch("app.services.redis_client.RedisClientManager.is_healthy")
    def test_check_redis_health(self, mock_is_healthy):
        """Test check_redis_health convenience function"""
        mock_is_healthy.return_value = True

        result = check_redis_health()

        assert result is True
        mock_is_healthy.assert_called_once()


class TestIntegrationScenarios:
    """Integration-like tests for common usage patterns"""

    def setup_method(self):
        """Reset state before each test"""
        RedisClientManager.reset_instance()
        import app.services.redis_client as rc
        rc._manager = None

    def teardown_method(self):
        """Clean up after each test"""
        RedisClientManager.reset_instance()
        import app.services.redis_client as rc
        rc._manager = None

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_job_status_update_pattern(self, mock_redis, mock_pool):
        """Test pattern used in analyze_video.py for updating job status"""
        mock_pool.return_value = Mock()
        mock_client = Mock()
        mock_redis.return_value = mock_client

        job_id = "test-job-123"
        job_status_key = f"job:{job_id}:state"

        def update_status(client):
            client.hset(
                job_status_key,
                mapping={
                    "status": "processing",
                    "progress": "50",
                    "current_step": "Extracting frames...",
                    "error": "",
                }
            )
            client.expire(job_status_key, 86400)
            return True

        result = execute_redis_operation(update_status, f"update_job_status({job_id})")

        assert result is True
        mock_client.hset.assert_called_once()
        mock_client.expire.assert_called_once_with(job_status_key, 86400)

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_result_storage_pattern(self, mock_redis, mock_pool):
        """Test pattern used for storing analysis results"""
        mock_pool.return_value = Mock()
        mock_client = Mock()
        mock_redis.return_value = mock_client

        job_id = "test-job-456"
        result_key = f"job:{job_id}:result"
        result_json = '{"clusters": [], "frame_mapping": {}}'

        def store_result(client):
            client.setex(result_key, 86400, result_json)
            return True

        result = execute_redis_operation(store_result, f"store_result({job_id})")

        assert result is True
        mock_client.setex.assert_called_once_with(result_key, 86400, result_json)

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_connection_failure_returns_none(self, mock_redis, mock_pool):
        """Test that connection failure returns None gracefully"""
        mock_pool.side_effect = ConnectionError("Cannot connect")

        config = RedisClientConfig(max_retries=1, base_delay=0.01)
        manager = RedisClientManager(config)

        result = manager.get_client()

        assert result is None

    @patch("app.services.redis_client.redis.ConnectionPool.from_url")
    @patch("app.services.redis_client.redis.Redis")
    def test_operation_failure_returns_none(self, mock_redis, mock_pool):
        """Test that failed operation returns None after retries"""
        mock_pool.return_value = Mock()
        mock_client = Mock()
        mock_redis.return_value = mock_client

        config = RedisClientConfig(max_retries=1, base_delay=0.01)
        manager = RedisClientManager(config)

        def always_fails(client):
            raise ConnectionError("Operation failed")

        result = manager.execute_with_retry(always_fails, "failing_op")

        assert result is None
