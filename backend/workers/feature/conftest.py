"""
Root conftest.py for the feature worker test suite.

Provides a minimal neckenml stub when the library is not installed,
allowing tests to run in CI without the full ML dependency.
"""
import sys
import types


def _install_neckenml_stub():
    """Install a minimal neckenml stub into sys.modules."""

    class StyleClassifier:
        def __init__(self, **kwargs):
            pass

        def classify(self, track, features):
            return []

    def compute_derived_features(artifacts):
        return {}

    core_mod = types.ModuleType("neckenml.core")
    core_mod.StyleClassifier = StyleClassifier
    core_mod.compute_derived_features = compute_derived_features

    neckenml_mod = types.ModuleType("neckenml")
    neckenml_mod.core = core_mod

    sys.modules["neckenml"] = neckenml_mod
    sys.modules["neckenml.core"] = core_mod


try:
    import neckenml  # noqa: F401
except ImportError:
    _install_neckenml_stub()
