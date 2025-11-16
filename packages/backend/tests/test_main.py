"""
Tests for main app endpoints
"""

import pytest
from httpx import AsyncClient


@pytest.mark.anyio
async def test_root_endpoint(client: AsyncClient):
    """Test GET / returns API information"""
    response = await client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["service"] == "DanceFrame API"
    assert data["version"] == "1.0.0"
    assert data["docs"] == "/docs"
    assert data["health"] == "/health"


@pytest.mark.anyio
async def test_health_endpoint(client: AsyncClient):
    """Test GET /health returns healthy status"""
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["version"] == "1.0.0"
    assert "redis" in data
