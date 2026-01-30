"""
Tests for the TrainingService.

Tests cover:
- Training from user feedback
- Data query and filtering
- Handling edge cases
"""
import pytest
from unittest.mock import Mock, MagicMock, patch
import numpy as np


class TestTrainingService:
    """Test suite for TrainingService."""

    @pytest.fixture
    def training_service(self, mock_db_session):
        """Create a TrainingService instance with mocked dependencies."""
        with patch('app.services.training.neckenmlTrainer') as MockTrainer:
            MockTrainer.return_value.train_from_data.return_value = True

            from app.services.training import TrainingService
            service = TrainingService(mock_db_session)
            return service

    def test_initialization(self, mock_db_session):
        """Test service can be initialized."""
        with patch('app.services.training.neckenmlTrainer'):
            from app.services.training import TrainingService
            service = TrainingService(mock_db_session)
            assert service.db == mock_db_session

    def test_train_from_feedback_no_data(self, training_service, mock_db_session):
        """Test training with no confirmed data."""
        mock_db_session.query.return_value.join.return_value.join.return_value \
            .filter.return_value.filter.return_value.filter.return_value \
            .all.return_value = []

        result = training_service.train_from_feedback(min_confirmations=1)

        assert result is False

    def test_train_from_feedback_insufficient_data(self, training_service, mock_db_session):
        """Test training with insufficient data (< 5 examples)."""
        # Create mock result with only 3 examples
        mock_results = []
        for i in range(3):
            style_row = Mock()
            style_row.dance_style = "Polska"
            analysis = Mock()
            analysis.raw_data = {'embedding': list(np.random.randn(217))}
            mock_results.append((style_row, analysis))

        mock_db_session.query.return_value.join.return_value.join.return_value \
            .filter.return_value.filter.return_value.filter.return_value \
            .all.return_value = mock_results

        result = training_service.train_from_feedback(min_confirmations=1)

        assert result is False

    def test_train_from_feedback_success(self, training_service, mock_db_session):
        """Test successful training with sufficient data."""
        # Create mock result with 10 examples
        mock_results = []
        for i in range(10):
            style_row = Mock()
            style_row.dance_style = "Polska" if i < 5 else "Schottis"
            analysis = Mock()
            analysis.raw_data = {'embedding': list(np.random.randn(217))}
            mock_results.append((style_row, analysis))

        mock_db_session.query.return_value.join.return_value.join.return_value \
            .filter.return_value.filter.return_value.filter.return_value \
            .all.return_value = mock_results

        result = training_service.train_from_feedback(min_confirmations=1)

        assert result is True
        training_service.trainer.train_from_data.assert_called_once()

    def test_train_from_feedback_missing_embedding(self, training_service, mock_db_session):
        """Test training handles missing embeddings."""
        mock_results = []
        for i in range(10):
            style_row = Mock()
            style_row.dance_style = "Polska"
            analysis = Mock()
            # Some have embeddings, some don't
            if i < 5:
                analysis.raw_data = {'embedding': list(np.random.randn(217))}
            else:
                analysis.raw_data = {}  # No embedding
            mock_results.append((style_row, analysis))

        mock_db_session.query.return_value.join.return_value.join.return_value \
            .filter.return_value.filter.return_value.filter.return_value \
            .all.return_value = mock_results

        result = training_service.train_from_feedback(min_confirmations=1)

        # Should work with available embeddings
        assert result is True


class TestTrainingIntegration:
    """Integration tests for TrainingService."""

    @pytest.mark.integration
    def test_imports_work(self):
        """Test that all imports work correctly."""
        from app.services.training import TrainingService
        from neckenml.core import TrainingService as neckenmlTrainer

        assert TrainingService is not None
        assert neckenmlTrainer is not None
