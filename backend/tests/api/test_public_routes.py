"""
Tests for public API routes.

Tests cover:
- Data export endpoints
- Health checks
- Error handling
"""
import pytest
from unittest.mock import Mock, MagicMock, patch


class TestDataExportRoutes:
    """Test suite for data export routes."""

    @pytest.mark.integration
    def test_export_stats_endpoint(self, fastapi_test_client):
        """Test the export stats endpoint."""
        response = fastapi_test_client.get("/api/public/export/stats")

        # Should return 200 or 401 (if auth required)
        assert response.status_code in [200, 401, 403]

    @pytest.mark.integration
    def test_export_endpoint_exists(self, fastapi_test_client):
        """Test that export endpoint exists."""
        response = fastapi_test_client.get("/api/public/export/tracks")

        # Should not return 404
        assert response.status_code != 404


class TestHealthCheck:
    """Test suite for health check endpoints."""

    @pytest.mark.integration
    def test_health_endpoint(self, fastapi_test_client):
        """Test the health check endpoint."""
        response = fastapi_test_client.get("/health")

        # Health check should always work
        assert response.status_code == 200


class TestDataExportService:
    """Unit tests for DataExportService."""

    @pytest.fixture
    def export_service(self, mock_db_session):
        """Create a DataExportService instance."""
        from app.services.data_export import DataExportService
        return DataExportService(mock_db_session)

    def test_get_export_stats(self, export_service, mock_db_session):
        """Test getting export statistics."""
        # Mock query results
        mock_db_session.query.return_value.count.return_value = 100
        mock_db_session.query.return_value.filter.return_value.count.return_value = 80

        stats = export_service.get_export_stats()

        assert 'total_tracks' in stats
        assert isinstance(stats['total_tracks'], int)

    def test_get_license_info(self, export_service):
        """Test getting license information."""
        license_info = export_service._get_license_info()

        assert 'license' in license_info
        assert license_info['license'] == "CC BY 4.0"
        assert 'license_url' in license_info
        assert 'attribution' in license_info

    def test_format_track_export(self, export_service, sample_track):
        """Test formatting a track for export."""
        formatted = export_service._format_track_export(sample_track)

        assert 'isrc' in formatted
        assert 'title' in formatted
        assert 'audio_features' in formatted
        assert 'dance_styles' in formatted

        # Check audio features
        audio = formatted['audio_features']
        assert 'swing_ratio' in audio
        assert 'articulation' in audio

    def test_export_excludes_sensitive_data(self, export_service, sample_track):
        """Test that export excludes sensitive platform data."""
        formatted = export_service._format_track_export(sample_track)

        # Should not include Spotify/YouTube IDs directly (only ISRC)
        assert 'spotify_id' not in formatted
        assert 'youtube_id' not in formatted

        # But should include public identifiers
        assert 'isrc' in formatted
