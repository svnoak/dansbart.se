"""
E2E tests for audio analysis and classification.

Tests the ClassificationService which classifies tracks into dance styles
based on stored audio analysis artifacts from the audio-worker.

Note: The actual ML audio analysis is performed by dansbart-audio-worker.
These tests focus on the classification pipeline that runs in the feature worker.
"""
import pytest
from unittest.mock import patch, MagicMock
import uuid
import numpy as np


class TestClassificationServiceBasics:
    """Tests for basic classification service functionality."""

    @pytest.mark.e2e
    def test_classify_track_from_analysis_data(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: Track is classified correctly from analysis data."""
        from app.services.classification import ClassificationService

        # Mock track
        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Slängpolska från Boda"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': 'Slängpolska',
                'type': 'Primary',
                'confidence': 0.85,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(
                    mock_track,
                    analysis_data=sample_analysis_result['features']
                )

        # Verify classifier was called
        mock_classifier.classify.assert_called_once()

        # Verify track was added to session
        mock_db_session.add.assert_called()

    @pytest.mark.e2e
    def test_classify_track_from_stored_artifacts(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: Track is classified from stored analysis artifacts."""
        from app.services.classification import ClassificationService

        # Mock analysis source with artifacts
        mock_source = MagicMock()
        mock_source.source_type = "neckenml_analyzer"
        mock_source.raw_data = sample_analysis_result['raw_artifacts']

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Test Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = [mock_source]

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': None,
                'type': 'Primary',
                'confidence': 0.75,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.classification.compute_derived_features') as mock_compute:
                mock_compute.return_value = sample_analysis_result['features']

                with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                    service = ClassificationService(mock_db_session)
                    service.classifier = mock_classifier

                    service.classify_track_immediately(mock_track)

        # Should have computed features from artifacts
        mock_compute.assert_called_once_with(sample_analysis_result['raw_artifacts'])

    @pytest.mark.e2e
    def test_classification_skips_user_confirmed_tracks(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: User-confirmed tracks are not re-classified."""
        from app.services.classification import ClassificationService

        # Mock track with user-confirmed style
        mock_style = MagicMock()
        mock_style.is_user_confirmed = True

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Confirmed Track"
        mock_track.dance_styles = [mock_style]
        mock_track.analysis_sources = []

        mock_classifier = MagicMock()

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(
                    mock_track,
                    analysis_data=sample_analysis_result['features']
                )

        # Classifier should NOT be called
        mock_classifier.classify.assert_not_called()

    @pytest.mark.e2e
    def test_classification_handles_no_analysis_data(
        self, mock_db_session, e2e_env_vars
    ):
        """Test: Classification handles missing analysis data gracefully."""
        from app.services.classification import ClassificationService

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "No Data Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []

        mock_classifier = MagicMock()

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                # Should not raise
                service.classify_track_immediately(mock_track)

        # Classifier should NOT be called (no data)
        mock_classifier.classify.assert_not_called()


class TestClassificationPredictions:
    """Tests for classification prediction storage."""

    @pytest.mark.e2e
    def test_primary_style_is_saved(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: Primary dance style prediction is saved to database."""
        from app.services.classification import ClassificationService

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Test Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': 'Slängpolska',
                'type': 'Primary',
                'confidence': 0.90,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(
                    mock_track,
                    analysis_data=sample_analysis_result['features']
                )

        # Verify TrackDanceStyle was added
        add_calls = mock_db_session.add.call_args_list
        assert len(add_calls) > 0

    @pytest.mark.e2e
    def test_multiple_styles_are_saved(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: Multiple dance style predictions are saved."""
        from app.services.classification import ClassificationService

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Multi-Style Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': None,
                'type': 'Primary',
                'confidence': 0.85,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            },
            {
                'style': 'Hambo',
                'sub_style': None,
                'type': 'Secondary',
                'confidence': 0.65,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(
                    mock_track,
                    analysis_data=sample_analysis_result['features']
                )

        # Both styles should be added
        mock_db_session.commit.assert_called()

    @pytest.mark.e2e
    def test_old_predictions_are_replaced(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: Old predictions are removed before saving new ones."""
        from app.services.classification import ClassificationService

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Re-Classify Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Vals',
                'sub_style': None,
                'type': 'Primary',
                'confidence': 0.80,
                'dance_tempo': 'Fast',
                'multiplier': 1.0,
                'effective_bpm': 180
            }
        ]

        # Mock the query chain for deleting old styles
        mock_query = MagicMock()
        mock_db_session.query.return_value.filter.return_value = mock_query

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(
                    mock_track,
                    analysis_data=sample_analysis_result['features']
                )

        # Old styles should be deleted
        mock_query.delete.assert_called()


class TestReclassifyLibrary:
    """Tests for library-wide reclassification."""

    @pytest.mark.e2e
    def test_reclassify_library_processes_all_tracks(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: Library reclassification processes all eligible tracks."""
        from app.services.classification import ClassificationService

        # Mock multiple tracks
        mock_tracks = []
        for i in range(3):
            track = MagicMock()
            track.id = uuid.uuid4()
            track.title = f"Track {i}"
            track.dance_styles = []

            source = MagicMock()
            source.source_type = "neckenml_analyzer"
            source.raw_data = sample_analysis_result['raw_artifacts']
            track.analysis_sources = [source]

            mock_tracks.append(track)

        mock_db_session.query.return_value.join.return_value.filter.return_value.all.return_value = mock_tracks

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': None,
                'type': 'Primary',
                'confidence': 0.80,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('neckenml.core.compute_derived_features') as mock_compute:
                mock_compute.return_value = sample_analysis_result['features']

                with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                    service = ClassificationService(mock_db_session)
                    service.classifier = mock_classifier

                    result = service.reclassify_library()

        assert result['updated'] == 3
        assert mock_classifier.classify.call_count == 3

    @pytest.mark.e2e
    def test_reclassify_library_skips_user_confirmed(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: Library reclassification skips user-confirmed tracks."""
        from app.services.classification import ClassificationService

        # Mock track with user-confirmed style
        confirmed_style = MagicMock()
        confirmed_style.is_user_confirmed = True

        confirmed_track = MagicMock()
        confirmed_track.id = uuid.uuid4()
        confirmed_track.title = "Confirmed Track"
        confirmed_track.dance_styles = [confirmed_style]
        confirmed_track.analysis_sources = []

        # Mock track without user confirmation
        unconfirmed_track = MagicMock()
        unconfirmed_track.id = uuid.uuid4()
        unconfirmed_track.title = "Unconfirmed Track"
        unconfirmed_track.dance_styles = []

        source = MagicMock()
        source.source_type = "neckenml_analyzer"
        source.raw_data = sample_analysis_result['raw_artifacts']
        unconfirmed_track.analysis_sources = [source]

        mock_db_session.query.return_value.join.return_value.filter.return_value.all.return_value = [
            confirmed_track,
            unconfirmed_track
        ]

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': None,
                'type': 'Primary',
                'confidence': 0.80,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('neckenml.core.compute_derived_features') as mock_compute:
                mock_compute.return_value = sample_analysis_result['features']

                with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                    service = ClassificationService(mock_db_session)
                    service.classifier = mock_classifier

                    result = service.reclassify_library()

        assert result['skipped'] == 1
        assert result['updated'] == 1


class TestVocalsDetection:
    """Tests for vocals/instrumental detection."""

    @pytest.mark.e2e
    def test_instrumental_track_sets_has_vocals_false(
        self, mock_db_session, e2e_env_vars
    ):
        """Test: Instrumental tracks have has_vocals set to False."""
        from app.services.classification import ClassificationService

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Instrumental Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []
        mock_track.has_vocals = None

        analysis_data = {
            'is_likely_instrumental': True,
            'voice_probability': 0.1,
            'tempo_bpm': 120
        }

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = []

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(mock_track, analysis_data=analysis_data)

        assert mock_track.has_vocals is False

    @pytest.mark.e2e
    def test_vocal_track_sets_has_vocals_true(
        self, mock_db_session, e2e_env_vars
    ):
        """Test: Tracks with vocals have has_vocals set to True."""
        from app.services.classification import ClassificationService

        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Vocal Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []
        mock_track.has_vocals = None

        analysis_data = {
            'is_likely_instrumental': False,
            'voice_probability': 0.8,
            'tempo_bpm': 120
        }

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = []

        with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
            with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                service = ClassificationService(mock_db_session)
                service.classifier = mock_classifier

                service.classify_track_immediately(mock_track, analysis_data=analysis_data)

        assert mock_track.has_vocals is True


class TestCeleryTaskIntegration:
    """Tests for Celery task integration."""

    @pytest.mark.e2e
    def test_classify_track_task_calls_service(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: classify_track_task correctly invokes ClassificationService."""
        from app.workers.tasks_feature import classify_track_task

        track_id = str(uuid.uuid4())

        mock_track = MagicMock()
        mock_track.id = track_id
        mock_track.title = "Test Track"
        mock_track.dance_styles = []
        mock_track.analysis_sources = []

        mock_db_session.query.return_value.filter.return_value.first.return_value = mock_track

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = []

        with patch('app.workers.tasks_feature.SessionLocal', return_value=mock_db_session):
            with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
                with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                    result = classify_track_task.apply(
                        args=[track_id, sample_analysis_result['features']]
                    ).get()

        assert result['status'] == 'success'
        assert result['track_id'] == track_id

    @pytest.mark.e2e
    def test_classify_track_task_handles_missing_track(
        self, mock_db_session, e2e_env_vars
    ):
        """Test: classify_track_task handles non-existent track."""
        from app.workers.tasks_feature import classify_track_task

        track_id = str(uuid.uuid4())

        # Track not found
        mock_db_session.query.return_value.filter.return_value.first.return_value = None

        mock_classifier = MagicMock()

        with patch('app.workers.tasks_feature.SessionLocal', return_value=mock_db_session):
            with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
                with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                    result = classify_track_task.apply(args=[track_id]).get()

        assert 'error' in result

    @pytest.mark.e2e
    def test_reclassify_library_task_returns_stats(
        self, mock_db_session, sample_analysis_result, e2e_env_vars
    ):
        """Test: reclassify_library_task returns classification statistics."""
        from app.workers.tasks_feature import reclassify_library_task

        # Mock tracks
        mock_track = MagicMock()
        mock_track.id = uuid.uuid4()
        mock_track.title = "Test Track"
        mock_track.dance_styles = []

        source = MagicMock()
        source.source_type = "neckenml_analyzer"
        source.raw_data = sample_analysis_result['raw_artifacts']
        mock_track.analysis_sources = [source]

        mock_db_session.query.return_value.join.return_value.filter.return_value.all.return_value = [mock_track]

        mock_classifier = MagicMock()
        mock_classifier.classify.return_value = [
            {
                'style': 'Polska',
                'sub_style': None,
                'type': 'Primary',
                'confidence': 0.80,
                'dance_tempo': 'Medium',
                'multiplier': 1.0,
                'effective_bpm': 120
            }
        ]

        with patch('app.workers.tasks_feature.SessionLocal', return_value=mock_db_session):
            with patch('neckenml.core.StyleClassifier', return_value=mock_classifier):
                with patch('neckenml.core.compute_derived_features') as mock_compute:
                    mock_compute.return_value = sample_analysis_result['features']

                    with patch('app.services.style_keywords_cache.get_sorted_keywords', return_value=[]):
                        result = reclassify_library_task.apply().get()

        assert 'updated' in result
        assert 'skipped' in result
