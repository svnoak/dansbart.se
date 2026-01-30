"""
Tests for the ClassificationService.

Tests cover:
- Feature extraction from stored artifacts
- Classification from analysis data
- Reclassification of library
"""
import pytest
from unittest.mock import Mock, MagicMock, patch


class TestClassificationService:
    """Test suite for ClassificationService."""

    @pytest.fixture
    def classification_service(self, mock_db_session):
        """Create a ClassificationService instance with mocked dependencies."""
        with patch('app.services.classification.StyleClassifier') as MockClassifier:
            MockClassifier.return_value.classify.return_value = [
                {
                    'style': 'Polska',
                    'sub_style': None,
                    'type': 'Primary',
                    'confidence': 0.85,
                    'dance_tempo': 'Lagom',
                    'multiplier': 1.0,
                    'effective_bpm': 120
                }
            ]

            from app.services.classification import ClassificationService
            service = ClassificationService(mock_db_session)
            return service

    def test_initialization(self, mock_db_session):
        """Test service can be initialized."""
        with patch('app.services.classification.StyleClassifier'):
            from app.services.classification import ClassificationService
            service = ClassificationService(mock_db_session)
            assert service.db == mock_db_session

    def test_initialization_without_db(self):
        """Test service handles None db gracefully."""
        from app.services.classification import ClassificationService
        service = ClassificationService(None)
        assert service.classifier is None

    def test_get_features_from_neckenml_source(self, classification_service, sample_track):
        """Test feature extraction from neckenml_analyzer source."""
        source = sample_track.analysis_sources[0]
        source.source_type = "neckenml_analyzer"

        with patch('app.services.classification.compute_derived_features') as mock_compute:
            mock_compute.return_value = {
                'tempo_bpm': 120.0,
                'is_likely_instrumental': True
            }

            features = classification_service._get_features_from_source(source)

            mock_compute.assert_called_once_with(source.raw_data)
            assert features['tempo_bpm'] == 120.0

    def test_get_features_from_legacy_source(self, classification_service, sample_track):
        """Test feature extraction from hybrid_ml_v2 source."""
        source = sample_track.analysis_sources[0]
        source.source_type = "hybrid_ml_v2"
        source.raw_data = {'tempo_bpm': 115.0, 'swing_ratio': 1.2}

        features = classification_service._get_features_from_source(source)

        # Legacy format should return raw_data directly
        assert features['tempo_bpm'] == 115.0

    def test_classify_track_immediately(self, classification_service, sample_track, sample_analysis_features):
        """Test immediate classification of a track."""
        classification_service.classify_track_immediately(
            sample_track,
            analysis_data=sample_analysis_features
        )

        # Should have updated vocals flag
        assert sample_track.has_vocals is False

    def test_classify_skips_user_confirmed(self, classification_service, sample_track, sample_analysis_features):
        """Test that user-confirmed tracks are skipped."""
        sample_track.dance_styles[0].is_user_confirmed = True

        # Should not raise an error, just skip
        classification_service.classify_track_immediately(
            sample_track,
            analysis_data=sample_analysis_features
        )

    def test_classify_handles_no_analysis_data(self, classification_service, sample_track):
        """Test classification handles missing analysis data."""
        sample_track.analysis_sources = []

        # Should handle gracefully
        classification_service.classify_track_immediately(sample_track)


class TestClassificationIntegration:
    """Integration tests that test the full classification flow."""

    @pytest.mark.integration
    def test_imports_work(self):
        """Test that all imports work correctly."""
        from app.services.classification import ClassificationService
        from neckenml.core import StyleClassifier, compute_derived_features

        assert ClassificationService is not None
        assert StyleClassifier is not None
        assert compute_derived_features is not None
